"""검색 및 클립 생성 관련 라우터"""
import os
import json
import time
import shutil
import asyncio
import logging
import aiohttp
from typing import Optional, List
from pathlib import Path
from fastapi import APIRouter, Request, File, Form, UploadFile, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from moviepy.video.io.VideoFileClip import VideoFileClip
from database.connection import conn, cursor, ensure_db_connection
from services.video_service import _save_summary_to_db
from utils.helpers import (
    ensure_vss_client, get_via_model, get_recommended_chunk_size,
    create_summarize_prompt, build_query_prompt, build_summarize_params,
    build_query_video_params, get_session, translate_to_korean, check_video_type
)
from utils.video_utils import parse_timestamps
from config.settings import (
    CLIPS_DIR, TMP_DIR, CLIP_CLEANUP_AGE, DEFAULT_SUMMARIZE_PROMPT,
    OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT, VIA_SERVER_URL, CV_EVENT_DETECTOR_API_URL,
    DEFAULT_QUERY_TEMPERATURE, DEFAULT_QUERY_SEED, DEFAULT_QUERY_MAX_TOKENS,
    DEFAULT_QUERY_TOP_P, DEFAULT_QUERY_TOP_K,
    DEFAULT_TOP_K, DEFAULT_TOP_P, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_SEED,
    DEFAULT_NUM_FRAMES_PER_CHUNK, DEFAULT_FRAME_WIDTH, DEFAULT_FRAME_HEIGHT,
    DEFAULT_BATCH_SIZE, DEFAULT_RAG_BATCH_SIZE, DEFAULT_RAG_TOP_K,
    DEFAULT_SUMMARIZE_TOP_P, DEFAULT_SUMMARIZE_TEMPERATURE, DEFAULT_SUMMARIZE_MAX_TOKENS,
    DEFAULT_CHAT_TOP_P, DEFAULT_CHAT_TEMPERATURE, DEFAULT_CHAT_MAX_TOKENS,
    DEFAULT_NOTIFICATION_TOP_P, DEFAULT_NOTIFICATION_TEMPERATURE, DEFAULT_NOTIFICATION_MAX_TOKENS,
    DEFAULT_ENABLE_AUDIO
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _get_subclip(video, start_time, end_time):
    """MoviePy v1/v2 호환: subclip 또는 subclipped 사용"""
    if hasattr(video, "subclip"):
        return video.subclip(start_time, end_time)
    return video.subclipped(start_time, end_time)

# ==================== 요청 모델 ====================
class RecommendedChunkSizeRequest(BaseModel):
    video_length: float

class RemoveMediaRequest(BaseModel):
    media_ids: List[str]

class DeleteClipsRequest(BaseModel):
    clip_urls: List[str]  # 삭제할 클립 URL 리스트

# ==================== 헬퍼 함수 ====================
async def remove_all_media(session: aiohttp.ClientSession, media_ids):
    """VIA 서버에서 여러 미디어 파일을 삭제하는 함수"""
    for media_id in media_ids:
        try:
            async with session.delete(VIA_SERVER_URL + "/files/" + media_id) as resp:
                if resp.status >= 400:
                    logger.warning(f"Failed to delete media {media_id}: HTTP {resp.status}")
                else:
                    logger.info(f"Successfully deleted media {media_id}")
        except Exception as e:
            logger.error(f"Error deleting media {media_id}: {e}")

# ==================== 엔드포인트 ====================
@router.post("/check-search-mode")
async def check_search_mode(
    request: Request
):
    # 요청 본문에서 query 추출
    body = await request.json()
    query = body.get("query", "")
    
    if not query:
        raise HTTPException(status_code=400, detail="query parameter is required")
    
    if "찾아" in query or "장면" in query:
        return {"search_mode": "gen_clip"}
    else:
        return {"search_mode": "query"}

@router.post("/generate-clips")
async def generate_clips(
    request: Request,
    files: List[UploadFile] = File(None),
    prompt: str = Form(...),
    user_id: Optional[str] = Form(None),
    video_ids: Optional[str] = Form(None),  # JSON 문자열로 전달: {"filename1": video_id1, "filename2": video_id2}
    chunk_size: Optional[int] = Form(None),
    top_k: Optional[int] = Form(None),
    top_p: Optional[float] = Form(None),
    temperature: Optional[float] = Form(None),
    max_new_tokens: Optional[int] = Form(None),
    seed: Optional[int] = Form(None),
    # Summarize 파라미터
    summarize_chunk_duration: Optional[int] = Form(None),
    summarize_top_k: Optional[int] = Form(None),
    summarize_top_p: Optional[float] = Form(None),
    summarize_temperature: Optional[float] = Form(None),
    summarize_max_new_tokens: Optional[int] = Form(None),
    summarize_seed: Optional[int] = Form(None),
    summarize_num_frames_per_chunk: Optional[int] = Form(None),
    summarize_frame_width: Optional[int] = Form(None),
    summarize_frame_height: Optional[int] = Form(None),
    summarize_batch_size: Optional[int] = Form(None),
    summarize_rag_batch_size: Optional[int] = Form(None),
    summarize_rag_top_k: Optional[int] = Form(None),
    summarize_summarize_top_p: Optional[float] = Form(None),
    summarize_summarize_temperature: Optional[float] = Form(None),
    summarize_summarize_max_tokens: Optional[int] = Form(None),
    summarize_chat_top_p: Optional[float] = Form(None),
    summarize_chat_temperature: Optional[float] = Form(None),
    summarize_chat_max_tokens: Optional[int] = Form(None),
    summarize_notification_top_p: Optional[float] = Form(None),
    summarize_notification_temperature: Optional[float] = Form(None),
    summarize_notification_max_tokens: Optional[int] = Form(None),
    summarize_enable_audio: Optional[str] = Form(None)
):
    """장면 검색 결과 클립 생성"""
    CLIPS_DIR.mkdir(exist_ok=True)
    
    # 오래된 클립 파일 정리
    try:
        current_time = time.time()
        clips_dir_str = str(CLIPS_DIR.resolve())
        for existing_file in os.listdir(clips_dir_str):
            file_path = os.path.join(clips_dir_str, existing_file)
            try:
                if os.path.isfile(file_path):
                    file_mtime = os.path.getmtime(file_path)
                    if current_time - file_mtime > CLIP_CLEANUP_AGE:
                        os.remove(file_path)
                        logger.info(f"Deleted old clip: {file_path}")
            except Exception as e:
                logger.error(f"Error deleting old clip {file_path}: {e}")
    except Exception as e:
        logger.warning(f"Error cleaning old clips: {e}")

    grouped_clips = []
    from utils.helpers import vss_client

    # Normalize inputs: support single file param or multiple files
    upload_list = []
    if files:
        upload_list.extend(files)

    if not upload_list:
        raise HTTPException(status_code=400, detail="No file provided")

    # Ensure tmp directory exists
    TMP_DIR.mkdir(exist_ok=True)
    
    try:
        # video_ids 파싱 (JSON 문자열)
        video_id_map = {}
        if video_ids and user_id:
            try:
                video_id_map = json.loads(video_ids) if isinstance(video_ids, str) else video_ids
            except:
                video_id_map = {}
        
        for upfile in upload_list:
            file_path = os.path.basename(upfile.filename)
            tmp_path = str(TMP_DIR / file_path)

            await ensure_vss_client()
            model = await get_via_model()

            TMP_DIR.mkdir(exist_ok=True)
            # 업로드용 임시 파일 실제 저장
            with open(tmp_path, "wb") as buffer:
                shutil.copyfileobj(upfile.file, buffer)

            logger.info(f"Uploaded video saved to {tmp_path}")

            # video_ids에서 내부 DB ID 가져오기 (VIA 서버의 video_id로 변환 필요)
            video_id = None
            db_internal_id = None
            if video_id_map:
                # 파일명으로 내부 DB ID 찾기
                db_internal_id = video_id_map.get(file_path) or video_id_map.get(upfile.filename)
                if db_internal_id:
                    try:
                        ensure_db_connection()
                        # 내부 DB ID로 vss_videos 테이블에서 VIDEO_ID (VIA 서버의 video_id) 조회
                        cursor.execute(
                            "SELECT VIDEO_ID FROM vss_videos WHERE ID = ? AND USER_ID = ?",
                            (db_internal_id, user_id)
                        )
                        video_row = cursor.fetchone()
                        if video_row and video_row[0]:
                            video_id = video_row[0]  # VIA 서버의 video_id
                            logger.info(f"video_ids에서 내부 DB ID {db_internal_id}로 VIDEO_ID {video_id} 조회 성공 (파일명: {file_path})")
                        else:
                            logger.warning(f"내부 DB ID {db_internal_id}에 해당하는 VIDEO_ID를 찾을 수 없습니다.")
                    except Exception as e:
                        logger.warning(f"VIDEO_ID 조회 중 오류: {e}")
            
            # video_id가 없으면 VIA 서버에 업로드하여 video_id 얻기
            if not video_id:
                logger.info("업로드 시작")
                video_id = await vss_client.upload_video(tmp_path)
                logger.info(f"VIA 서버에 업로드하여 video_id 획득: {video_id}")

            video_clips = []
            # MoviePy에 파일 경로(문자열)로 전달
            video = VideoFileClip(tmp_path)
            duration = video.duration or 0
            logger.info(f"Video duration: {duration} seconds for {tmp_path}")
            
            # chunk_duration 계산
            chunk_duration = await get_recommended_chunk_size(duration)

            # image_mode 설정 (장면 검색은 비디오만 대상이므로 False, 하지만 파일 타입 확인)
            image_mode = False  # 기본값: 비디오
            if upfile and upfile.content_type:
                # content_type으로 확인 (video/로 시작하면 False, 그 외는 True)
                image_mode = not upfile.content_type.startswith('video/')
            else:
                # 파일 확장자로 확인 (안전장치)
                file_ext = os.path.splitext(file_path)[1].lower()
                image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
                image_mode = file_ext in image_extensions
            
            logger.info(f"image_mode 설정: {image_mode} (파일: {file_path})")

            # DB에서 요약 결과 확인 (user_id와 video_id가 있는 경우)
            has_stored_summary = False
            if user_id and video_id:
                try:
                    ensure_db_connection()
                    # VIDEO_ID (VIA 서버의 video_id)로 요약 결과 확인
                    cursor.execute(
                        """SELECT ID FROM vss_summaries 
                           WHERE VIDEO_ID = ? AND USER_ID = ?""",
                        (video_id, user_id)
                    )
                    if cursor.fetchone():
                        has_stored_summary = True
                        logger.info(f"저장된 요약 결과 발견: VIDEO_ID {video_id}, summarize_video 건너뛰기")
                except Exception as e:
                    logger.warning(f"요약 결과 확인 중 오류: {e}")

            # 요약 파라미터 준비 (Ollama를 사용하여 프롬프트 생성)
            AI_prompt = await create_summarize_prompt(prompt)
            
            # 저장된 요약이 있으면 PROMPT를 비교하여 프롬프트가 변경되었는지 확인
            if has_stored_summary and user_id and video_id:
                try:
                    ensure_db_connection()
                    cursor.execute(
                        """SELECT PROMPT FROM vss_summaries WHERE VIDEO_ID = ? AND USER_ID = ?;""",
                        (video_id, user_id)
                    )
                    summary_row = cursor.fetchone()
                    if summary_row and summary_row[0]:
                        stored_prompt = summary_row[0]
                        # 저장된 PROMPT와 현재 AI_prompt를 비교
                        if stored_prompt.strip() == AI_prompt.strip():
                            has_stored_summary = True
                            logger.info(f"프롬프트가 동일하여 저장된 요약을 사용합니다. (VIDEO_ID: {video_id})")
                        else:
                            has_stored_summary = True
                            logger.info(f"프롬프트가 변경되어 요약을 다시 수행합니다. (VIDEO_ID: {video_id})")
                    else:
                        has_stored_summary = False
                        logger.info(f"저장된 PROMPT가 없어 요약을 다시 수행합니다. (VIDEO_ID: {video_id})")
                except Exception as e:
                    logger.warning(f"PROMPT 조회 중 오류: {e}")
                    has_stored_summary = False

            if not has_stored_summary:
                # Summarize 파라미터 설정 (제공되지 않으면 기본값 사용)
                summarize_chunk = summarize_chunk_duration if summarize_chunk_duration is not None else chunk_duration
                summarize_top_k_val = summarize_top_k if summarize_top_k is not None else DEFAULT_TOP_K
                summarize_top_p_val = summarize_top_p if summarize_top_p is not None else DEFAULT_TOP_P
                summarize_temp_val = summarize_temperature if summarize_temperature is not None else DEFAULT_TEMPERATURE
                summarize_max_tokens_val = summarize_max_new_tokens if summarize_max_new_tokens is not None else DEFAULT_MAX_TOKENS
                summarize_seed_val = summarize_seed if summarize_seed is not None else DEFAULT_SEED
                summarize_nfmc = summarize_num_frames_per_chunk if summarize_num_frames_per_chunk is not None else DEFAULT_NUM_FRAMES_PER_CHUNK
                summarize_fw = summarize_frame_width if summarize_frame_width is not None else DEFAULT_FRAME_WIDTH
                summarize_fh = summarize_frame_height if summarize_frame_height is not None else DEFAULT_FRAME_HEIGHT
                summarize_batch = summarize_batch_size if summarize_batch_size is not None else DEFAULT_BATCH_SIZE
                summarize_rag_batch = summarize_rag_batch_size if summarize_rag_batch_size is not None else DEFAULT_RAG_BATCH_SIZE
                summarize_rag_topk = summarize_rag_top_k if summarize_rag_top_k is not None else DEFAULT_RAG_TOP_K
                summarize_s_top_p = summarize_summarize_top_p if summarize_summarize_top_p is not None else DEFAULT_SUMMARIZE_TOP_P
                summarize_s_temp = summarize_summarize_temperature if summarize_summarize_temperature is not None else DEFAULT_SUMMARIZE_TEMPERATURE
                summarize_s_max_tokens = summarize_summarize_max_tokens if summarize_summarize_max_tokens is not None else DEFAULT_SUMMARIZE_MAX_TOKENS
                summarize_c_top_p = summarize_chat_top_p if summarize_chat_top_p is not None else DEFAULT_CHAT_TOP_P
                summarize_c_temp = summarize_chat_temperature if summarize_chat_temperature is not None else DEFAULT_CHAT_TEMPERATURE
                summarize_c_max_tokens = summarize_chat_max_tokens if summarize_chat_max_tokens is not None else DEFAULT_CHAT_MAX_TOKENS
                summarize_n_top_p = summarize_notification_top_p if summarize_notification_top_p is not None else DEFAULT_NOTIFICATION_TOP_P
                summarize_n_temp = summarize_notification_temperature if summarize_notification_temperature is not None else DEFAULT_NOTIFICATION_TEMPERATURE
                summarize_n_max_tokens = summarize_notification_max_tokens if summarize_notification_max_tokens is not None else DEFAULT_NOTIFICATION_MAX_TOKENS
                summarize_enable_audio_val = (summarize_enable_audio and summarize_enable_audio.lower() == 'true') if summarize_enable_audio is not None else DEFAULT_ENABLE_AUDIO
                
                # Summarize 파라미터 로그 출력
                logger.info("=" * 80)
                logger.info("[generate_clips] Summarize 파라미터 설정:")
                logger.info(f"  - image_mode: {image_mode}")
                logger.info(f"  - video_id: {video_id}")
                logger.info(f"  - chunk_duration: {summarize_chunk}")
                logger.info(f"  - model: {model}")
                logger.info(f"  - prompt: {AI_prompt[:200]}..." if len(AI_prompt) > 200 else f"  - prompt: {AI_prompt}")
                logger.info(f"  - num_frames_per_chunk: {summarize_nfmc}")
                logger.info(f"  - frame_width: {summarize_fw}")
                logger.info(f"  - frame_height: {summarize_fh}")
                logger.info(f"  - top_k: {summarize_top_k_val}")
                logger.info(f"  - top_p: {summarize_top_p_val}")
                logger.info(f"  - temperature: {summarize_temp_val}")
                logger.info(f"  - max_new_tokens: {summarize_max_tokens_val}")
                logger.info(f"  - seed: {summarize_seed_val}")
                logger.info(f"  - batch_size: {summarize_batch}")
                logger.info(f"  - rag_batch_size: {summarize_rag_batch}")
                logger.info(f"  - rag_top_k: {summarize_rag_topk}")
                logger.info(f"  - summarize_top_p: {summarize_s_top_p}")
                logger.info(f"  - summarize_temperature: {summarize_s_temp}")
                logger.info(f"  - summarize_max_tokens: {summarize_s_max_tokens}")
                logger.info(f"  - chat_top_p: {summarize_c_top_p}")
                logger.info(f"  - chat_temperature: {summarize_c_temp}")
                logger.info(f"  - chat_max_tokens: {summarize_c_max_tokens}")
                logger.info(f"  - notification_top_p: {summarize_n_top_p}")
                logger.info(f"  - notification_temperature: {summarize_n_temp}")
                logger.info(f"  - notification_max_tokens: {summarize_n_max_tokens}")
                logger.info(f"  - enable_audio: {summarize_enable_audio_val}")
                logger.info("=" * 80)
                
                summarize_params = build_summarize_params(
                    image_mode=image_mode,
                    video_id=video_id,
                    chunk_duration=summarize_chunk,
                    model=model,
                    prompt=AI_prompt,
                    num_frames_per_chunk=summarize_nfmc,
                    frame_width=summarize_fw,
                    frame_height=summarize_fh,
                    top_k=summarize_top_k_val,
                    top_p=summarize_top_p_val,
                    temperature=summarize_temp_val,
                    max_new_tokens=summarize_max_tokens_val,
                    seed=summarize_seed_val,
                    batch_size=summarize_batch,
                    rag_batch_size=summarize_rag_batch,
                    rag_top_k=summarize_rag_topk,
                    summarize_top_p=summarize_s_top_p,
                    summarize_temperature=summarize_s_temp,
                    summarize_max_tokens=summarize_s_max_tokens,
                    chat_top_p=summarize_c_top_p,
                    chat_temperature=summarize_c_temp,
                    chat_max_tokens=summarize_c_max_tokens,
                    notification_top_p=summarize_n_top_p,
                    notification_temperature=summarize_n_temp,
                    notification_max_tokens=summarize_n_max_tokens,
                    enable_audio=summarize_enable_audio_val
                )
                result = await vss_client.summarize_video(*summarize_params)
                
                # 요약 결과를 DB에 저장
                if user_id and video_id and result:
                    try:
                        summary_text = result
                        if isinstance(result, dict):
                            summary_text = result.get("content", str(result))
                        elif not isinstance(result, str):
                            summary_text = str(result)
                        
                        _save_summary_to_db(video_id, user_id, summary_text, AI_prompt)
                    except Exception as e:
                        logger.error(f"요약 결과 DB 저장 실패: {e}")
            else:
                logger.info(f"저장된 요약 결과가 있어 summarize_video를 건너뜁니다. 바로 query_video로 진행합니다.")
            
            # prompt를 질문으로 처리: VIA 서버의 query_video 사용
            try:
                enhanced_prompt = await build_query_prompt(prompt)
                
                enhanced_prompt = f"""{enhanced_prompt}. Output each match on a new line as START-END=Scene Description using real numeric seconds, in chronological order, with no extra text. Never output the placeholder SS.SSS-SS.SSS. If exact timestamps are unknown, omit that line. Only output scenes that are directly related to the requested content. Do not include scenes that are unrelated to the request. If none match, output nothing."""
                
                logger.info(f"enhanced_prompt: {enhanced_prompt}")
                
                # 설정값이 제공되지 않으면 기본값 사용
                query_chunk_size = chunk_size if chunk_size is not None else chunk_duration
                query_temperature = temperature if temperature is not None else DEFAULT_QUERY_TEMPERATURE
                query_seed = seed if seed is not None else DEFAULT_QUERY_SEED
                query_max_tokens = max_new_tokens if max_new_tokens is not None else DEFAULT_QUERY_MAX_TOKENS
                query_top_p = top_p if top_p is not None else DEFAULT_QUERY_TOP_P
                query_top_k = top_k if top_k is not None else DEFAULT_QUERY_TOP_K
                
                query_params = build_query_video_params(
                    video_id=video_id,
                    model=model,
                    query=enhanced_prompt,
                    chunk_size=query_chunk_size,
                    temperature=query_temperature,
                    seed=query_seed,
                    max_new_tokens=query_max_tokens,
                    top_p=query_top_p,
                    top_k=query_top_k
                )
                
                query_result = await vss_client.query_video(*query_params)
                
                # "Audio transcript not available." 메시지 처리
                if query_result and "Audio transcript not available" in str(query_result):
                    logger.warning("VIA 서버에서 오디오 트랜스크립트를 사용할 수 없다는 응답을 받았습니다.")
                    # 메시지에서 "Audio transcript not available." 부분 제거
                    query_result = str(query_result).replace("Audio transcript not available.", "").strip()
                    query_result = str(query_result).replace("Audio transcript not available", "").strip()
                    if not query_result:
                        query_result = None
                
                # 추출된 타임스탬프를 파싱하여 클립 생성에 사용
                # query_result는 이미 00:00-00:00=장면 설명 형태로 출력됨
                timestamp_data = []
                if query_result:
                    timestamp_data = await parse_timestamps(query_result, duration)
                    
                # 타임스탬프 기반 클립 생성
                base_name, _ = os.path.splitext(file_path)
                timestamp_suffix = int(time.time() * 1000)
                
                if timestamp_data:
                    clip_index = 0
                    for start_time, end_time, sentence in timestamp_data:
                        if end_time - start_time <= 0:
                            logger.warning(f"타임스탬프 간격이 0초 이하인 클립을 건너뜁니다: {start_time} - {end_time}")
                            continue
                        
                        # sentence를 한국어로 변환
                        translated_sentence = sentence
                        if sentence and sentence.strip():
                            try:
                                translated_sentence = await translate_to_korean(sentence)
                            except Exception as e:
                                logger.warning(f"sentence 한국어 번역 실패, 원본 사용: {e}")
                                translated_sentence = sentence
                        
                        clip_filename = f"clip_{base_name}_{timestamp_suffix}_{clip_index+1}.mp4"
                        clip_path = str(CLIPS_DIR / clip_filename)
                        try:
                            _get_subclip(video, start_time, end_time).write_videofile(
                                clip_path,
                                codec="libx264",
                                audio=False
                            )
                            base = str(request.base_url).rstrip('/')
                            clip_url = f"{base}/clips/{clip_filename}"
                            video_clips.append({
                                "id": f"{base_name}_{timestamp_suffix}_{clip_index}",
                                "title": clip_filename,
                                "url": clip_url,
                                "start_time": start_time,
                                "end_time": end_time,
                                "search_query": prompt,
                                "sentence": translated_sentence  # 한국어로 번역된 장면 설명 사용
                            })
                            clip_index += 1
                        except Exception as e:
                            logger.error(f"Error generating clip {clip_filename}: {e}")
                        time.sleep(0.5)
                else:
                    logger.warning(f"타임스탬프를 찾을 수 없습니다. 검색어: '{prompt}'. VIA 서버 답변을 반환합니다.")
                    video_clips.append({
                        "id": f"{base_name}_{timestamp_suffix}_no_timestamp",
                        "title": "VIA 서버 응답",
                        "url": None,
                        "start_time": None,
                        "end_time": None,
                        "search_query": prompt,
                        "via_response": query_result
                    })
            except HTTPException:
                raise
            except Exception as via_error:
                logger.error(f"VIA 서버 query_video 실패: {via_error}")
                raise HTTPException(
                    status_code=500,
                    detail=f"검색 실패: VIA 서버에서 장면 검색 중 오류가 발생했습니다. ({str(via_error)})"
                )
            finally:
                video.close()
                del video

            grouped_clips.append({
                "video": file_path,
                "clips": video_clips
            })

    except Exception as e:
        logger.error(f"Error processing uploaded video(s): {e}")
        raise HTTPException(status_code=500, detail=f"Error processing uploaded video(s): {e}")

    # 클립 추출 여부 확인
    clips_extracted = False
    for group in grouped_clips:
        for clip in group.get("clips", []):
            if clip.get("url") and not clip.get("via_response"):
                clips_extracted = True
                break
        if clips_extracted:
            break
    
    logger.info("All clips generated successfully.")
    return JSONResponse(content={"clips": grouped_clips, "clips_extracted": clips_extracted})

@router.post("/vss-query")
async def vss_query(
    video_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = None,
    chunk_size: int = Form(...),
    temperature: float = Form(...),
    seed: int = Form(...),
    max_new_tokens: int = Form(...),
    top_p: float = Form(...),
    top_k: int = Form(...),
    query: str = Form(...)
):
    """동영상 검색 VSS API"""
    # ========== CA-RAG 컨텍스트 디버깅 로그 시작 ==========
    logger.info(
        "[CA-RAG DEBUG] ====== /vss-query 엔드포인트 호출 ======"
    )
    logger.info(
        "[CA-RAG DEBUG] video_id=%s, query=%s",
        video_id,
        query[:100] + "..." if len(query) > 100 else query
    )
    # ========== CA-RAG 컨텍스트 디버깅 로그 끝 ==========
    
    await ensure_vss_client()
    model = await get_via_model()
    from utils.helpers import vss_client

    if file and not video_id:
        TMP_DIR.mkdir(exist_ok=True)
        file_path = str(TMP_DIR / file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        video_id = await vss_client.upload_video(file_path)
        
        logger.info(
            "[CA-RAG DEBUG] 파일 업로드 완료: video_id=%s",
            video_id
        )
    elif not video_id:
        raise HTTPException(status_code=400, detail="video_id 또는 file 중 하나는 필요합니다.")
    
    logger.info(
        "[CA-RAG DEBUG] query_video 호출 전: video_id=%s",
        video_id
    )
    logger.info(
        "[CA-RAG DEBUG] ⚠️ 이 video_id에 대한 이전 summarize_video 호출 여부 확인 필요"
    )
    
    query_params = build_query_video_params(
        video_id=video_id,
        model=model,
        query=query,
        chunk_size=chunk_size,
        temperature=temperature,
        seed=seed,
        max_new_tokens=max_new_tokens,
        top_p=top_p,
        top_k=top_k
    )
    result = await vss_client.query_video(*query_params)
    
    logger.info(
        "[CA-RAG DEBUG] query_video 호출 완료: 결과 길이=%d",
        len(result) if result else 0
    )
    
    # "Audio transcript not available." 메시지 처리
    if result and "Audio transcript not available" in str(result):
        logger.warning("VIA 서버에서 오디오 트랜스크립트를 사용할 수 없다는 응답을 받았습니다.")
        # 메시지에서 "Audio transcript not available." 부분 제거
        result = str(result).replace("Audio transcript not available.", "").strip()
        result = str(result).replace("Audio transcript not available", "").strip()
        if not result:
            result = "오디오 트랜스크립트를 사용할 수 없어 비디오 내용을 분석할 수 없습니다."
    
    # 응답에서 질문 부분 제거
    if result and query:
        # 질문이 응답의 시작 부분에 포함되어 있는지 확인
        result_str = str(result).strip()
        query_str = str(query).strip()
        
        # 질문이 응답의 시작 부분에 정확히 포함되어 있으면 제거
        if result_str.startswith(query_str):
            # 질문 뒤의 내용만 추출
            remaining = result_str[len(query_str):].strip()
            # 질문 뒤에 줄바꿈이나 구분자가 있으면 제거
            if remaining.startswith('\n') or remaining.startswith('?'):
                remaining = remaining.lstrip('\n?').strip()
            elif remaining.startswith(' '):
                remaining = remaining.lstrip().strip()
            result = remaining if remaining else result_str
        # 질문이 응답에 포함되어 있지만 시작 부분이 아닌 경우
        elif query_str in result_str:
            # 질문 부분을 찾아서 제거 (첫 번째 발생만)
            result = result_str.replace(query_str, '', 1).strip()
            # 질문 제거 후 남은 공백이나 구분자 정리
            result = result.lstrip('\n?').strip()

    return {"summary": result, "video_id": video_id}

@router.get("/via-files")
async def list_via_files(
    purpose: str = Query(default="vision", description="파일 목적 (기본값: vision)")
):
    """VIA 서버에 업로드된 파일 목록 조회"""
    try:
        await ensure_vss_client()
        from utils.helpers import vss_client
        result = await vss_client.list_files(purpose=purpose)
        logger.info(f"VIA 파일 목록 조회 완료: purpose={purpose}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIA 파일 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"VIA 파일 목록 조회 중 오류가 발생했습니다: {str(e)}")

@router.post("/via-upload-file")
async def upload_file_to_via(
    file: UploadFile = File(...),
    purpose: str = Form(default="vision"),
    media_type: str = Form(...)
):
    """VIA 서버에 파일 업로드 (프록시 엔드포인트, CORS 문제 해결)"""
    try:
        await ensure_vss_client()
        from utils.helpers import vss_client
        
        # 임시 파일로 저장
        import tempfile
        TMP_DIR.mkdir(exist_ok=True)
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix, dir=TMP_DIR) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # VIA 서버에 업로드 (purpose와 media_type 전달)
            via_file_id = await vss_client.upload_video(tmp_file_path, purpose=purpose, media_type=media_type)
            logger.info(f"VIA 서버 파일 업로드 완료: file_id={via_file_id}, filename={file.filename}, purpose={purpose}, media_type={media_type}")
            return {"id": via_file_id, "object": "file"}
        finally:
            # 임시 파일 삭제
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIA 서버 파일 업로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"VIA 서버 파일 업로드 중 오류가 발생했습니다: {str(e)}")

@router.post("/get-recommended-chunk-size")
async def get_recommended_chunk_size_endpoint(request: RecommendedChunkSizeRequest):
    """동영상 길이를 받아서 추천 chunk_size를 반환하는 엔드포인트"""
    try:
        recommended_chunk_size = await get_recommended_chunk_size(request.video_length)
        return {"recommended_chunk_size": recommended_chunk_size, "video_length": request.video_length}
    except Exception as e:
        logger.error(f"Error getting recommended chunk size: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting recommended chunk size: {e}")

@router.post("/remove-media")
async def remove_media_endpoint(request: RemoveMediaRequest):
    """VIA 서버에서 미디어 파일들을 삭제하는 엔드포인트"""
    try:
        session = await get_session()
        await remove_all_media(session, request.media_ids)
        return {"success": True, "message": f"Deleted {len(request.media_ids)} media file(s)"}
    except Exception as e:
        logger.error(f"Error removing media: {e}")
        raise HTTPException(status_code=500, detail=f"Error removing media: {e}")

@router.post("/delete-clips")
async def delete_clips(request: DeleteClipsRequest):
    """클립 파일들을 삭제하는 엔드포인트"""
    try:
        if not CLIPS_DIR.exists():
            return {"success": True, "message": "클립 디렉토리가 없습니다.", "deleted_count": 0}
        
        deleted_count = 0
        failed_count = 0
        
        for clip_url in request.clip_urls:
            try:
                # URL에서 파일명 추출
                if "/clips/" in clip_url:
                    filename = clip_url.split("/clips/")[-1].split("?")[0]
                else:
                    filename = clip_url.replace("/clips/", "").split("?")[0]
                
                if not filename:
                    logger.warning(f"클립 파일명을 추출할 수 없습니다: {clip_url}")
                    failed_count += 1
                    continue
                
                clip_file_path = CLIPS_DIR / filename
                
                if clip_file_path.exists() and clip_file_path.is_file():
                    clip_file_path.unlink()
                    deleted_count += 1
                    logger.info(f"클립 파일 삭제 성공: {filename}")
                else:
                    logger.warning(f"클립 파일을 찾을 수 없습니다: {filename}")
                    failed_count += 1
            except Exception as e:
                logger.error(f"클립 삭제 중 오류 발생 ({clip_url}): {e}")
                failed_count += 1
        
        return {
            "success": True,
            "message": f"{deleted_count}개의 클립이 삭제되었습니다.",
            "deleted_count": deleted_count,
            "failed_count": failed_count
        }
    except Exception as e:
        logger.error(f"클립 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=f"클립 삭제 중 오류가 발생했습니다: {str(e)}")

# ==================== CV Event Detector API 프록시 엔드포인트 ====================

@router.post("/cv-event-detector/api/pipeline")
async def cv_create_pipeline(request: Request):
    """CV Event Detector API의 파이프라인 생성 엔드포인트 프록시"""
    try:
        session = await get_session()
        body = await request.json()
        
        async with session.post(
            f"{CV_EVENT_DETECTOR_API_URL}/api/pipeline",
            json=body,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            result = await response.json()
            if response.status >= 400:
                raise HTTPException(status_code=response.status, detail=result)
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV Event Detector 파이프라인 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"파이프라인 생성 중 오류가 발생했습니다: {str(e)}")

@router.post("/cv-event-detector/api/addstream")
async def cv_add_stream(request: Request):
    """CV Event Detector API의 스트림 추가 엔드포인트 프록시"""
    try:
        session = await get_session()
        body = await request.json()
        
        async with session.post(
            f"{CV_EVENT_DETECTOR_API_URL}/api/addstream",
            json=body,
            timeout=aiohttp.ClientTimeout(total=60)
        ) as response:
            result = await response.json()
            if response.status >= 400:
                raise HTTPException(status_code=response.status, detail=result)
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV Event Detector 스트림 추가 실패: {e}")
        raise HTTPException(status_code=500, detail=f"스트림 추가 중 오류가 발생했습니다: {str(e)}")

@router.get("/cv-event-detector/api/streams/{stream_id}/status")
async def cv_get_stream_status(stream_id: str, timeout_ms: Optional[int] = Query(None)):
    """CV Event Detector API의 스트림 상태 확인 엔드포인트 프록시"""
    try:
        session = await get_session()
        params = {}
        if timeout_ms is not None:
            params["timeout_ms"] = timeout_ms
        
        async with session.get(
            f"{CV_EVENT_DETECTOR_API_URL}/api/streams/{stream_id}/status",
            params=params,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            result = await response.json()
            if response.status >= 400:
                raise HTTPException(status_code=response.status, detail=result)
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV Event Detector 스트림 상태 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"스트림 상태 확인 중 오류가 발생했습니다: {str(e)}")

@router.delete("/cv-event-detector/api/stream")
async def cv_delete_stream(request: Request):
    """CV Event Detector API의 스트림 삭제 엔드포인트 프록시"""
    try:
        session = await get_session()
        body = await request.json()
        
        async with session.delete(
            f"{CV_EVENT_DETECTOR_API_URL}/api/stream",
            json=body,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            result = await response.json()
            if response.status >= 400:
                raise HTTPException(status_code=response.status, detail=result)
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CV Event Detector 스트림 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=f"스트림 삭제 중 오류가 발생했습니다: {str(e)}")

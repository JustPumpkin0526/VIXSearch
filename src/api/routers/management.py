"""관리 메뉴 관련 라우터"""
import os
import json
import time
import shutil
import asyncio
import logging
import aiohttp
from typing import Optional, List
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Request, File, Form, UploadFile, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from moviepy.video.io.VideoFileClip import VideoFileClip
from database.connection import conn, cursor, ensure_db_connection, get_db_connection
from services.video_service import _save_summary_to_db
from utils.helpers import (
    ensure_vss_client, get_via_model, get_recommended_chunk_size,
    create_summarize_prompt, build_query_prompt, build_summarize_params,
    build_query_video_params, get_session, translate_to_korean, check_video_type,
    get_text_embedding, cosine_similarity, translate_to_english
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
    DEFAULT_ENABLE_AUDIO, VIA_UPLOAD_TIMEOUT_MIN, VIA_UPLOAD_TIMEOUT_MAX, VIA_UPLOAD_TIMEOUT_PER_MB
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _get_subclip(video, start_time, end_time):
    """MoviePy v1/v2 호환: subclip 또는 subclipped 사용"""
    if hasattr(video, "subclip"):
        return video.subclip(start_time, end_time)
    return video.subclipped(start_time, end_time)

# ==================== 요청 모델 ====================
class DeleteClipsRequest(BaseModel):
    clip_urls: List[str]  # 삭제할 클립 URL 리스트

# ==================== 헬퍼 함수 ====================
async def fetch_via_file_index() -> dict:
    """VIA 서버의 업로드된 파일 목록을 filename -> id로 매핑"""
    session = await get_session()
    try:
        async with session.get(f"{VIA_SERVER_URL}/files") as resp:
            if resp.status >= 400:
                logger.warning(f"VIA /files returned status {resp.status}")
                return {}
            data = await resp.json()
            items = data.get("data", []) if isinstance(data, dict) else []
            return {item.get("filename"): item.get("id") for item in items if item.get("filename") and item.get("id")}
    except Exception as e:
        logger.warning(f"Failed to fetch VIA /files: {e}")
        return {}

def detect_media_type(filename: str, content_type: Optional[str]) -> str:
    """파일 타입 판단 (image/video)"""
    if content_type:
        return "video" if content_type.startswith("video/") else "image"
    ext = os.path.splitext(filename)[1].lower()
    image_exts = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}
    return "image" if ext in image_exts else "video"

async def upload_via_file(tmp_path: str, filename: str, media_type: str) -> str:
    """VIA 서버에 파일 업로드 후 file_id 반환"""
    session = await get_session()
    file_size = os.path.getsize(tmp_path)
    timeout_seconds = max(
        VIA_UPLOAD_TIMEOUT_MIN,
        min(VIA_UPLOAD_TIMEOUT_MAX, int(file_size / (1024 * 1024) * VIA_UPLOAD_TIMEOUT_PER_MB))
    )
    data = aiohttp.FormData()
    file_handle = open(tmp_path, "rb")
    try:
        data.add_field("file", file_handle, filename=filename)
        data.add_field("purpose", "vision")
        data.add_field("media_type", media_type)
        async with session.post(
            f"{VIA_SERVER_URL}/files",
            data=data,
            timeout=aiohttp.ClientTimeout(total=timeout_seconds)
        ) as response:
            if response.status >= 400:
                text = await response.text()
                raise HTTPException(status_code=response.status, detail=f"VIA 업로드 실패: {text}")
            json_data = await response.json()
            return json_data.get("id")
    finally:
        file_handle.close()

# ==================== 엔드포인트 ====================
@router.post("/check-search-mode")
async def check_search_mode(
    request: Request
):
    """검색 모드 확인 (장면 검색 vs 일반 쿼리)"""
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
    # 공통 파라미터 (query와 summarize 구분 없이 통일)
    chunk_size: Optional[int] = Form(None),
    top_k: Optional[int] = Form(None),
    top_p: Optional[float] = Form(None),
    temperature: Optional[float] = Form(None),
    max_new_tokens: Optional[int] = Form(None),
    seed: Optional[int] = Form(None),
    # Summarize 전용 파라미터
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
    
    # 임시 파일 추적을 위한 리스트
    temp_files_to_cleanup = []
    
    try:
        # video_ids 파싱 (JSON 문자열)
        video_id_map = {}
        if video_ids and user_id:
            try:
                video_id_map = json.loads(video_ids) if isinstance(video_ids, str) else video_ids
            except json.JSONDecodeError as e:
                logger.warning(f"video_ids JSON 파싱 실패: {e}, 빈 딕셔너리 사용")
                video_id_map = {}
            except Exception as e:
                logger.warning(f"video_ids 처리 중 오류: {e}, 빈 딕셔너리 사용")
                video_id_map = {}
        
        via_file_index = await fetch_via_file_index()

        for upfile in upload_list:
            file_path = os.path.basename(upfile.filename)
            tmp_path = str(TMP_DIR / file_path)
            temp_files_to_cleanup.append(tmp_path)  # 정리 목록에 추가

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
            
            # video_id가 없으면 VIA 서버 파일 목록에서 확인
            if not video_id:
                existing_id = via_file_index.get(file_path)
                if existing_id:
                    video_id = existing_id
                    logger.info(f"VIA 서버에 이미 존재하는 파일 사용: {file_path} -> {video_id}")
                else:
                    logger.info("VIA 서버에 파일이 없어 업로드 시작")
                    media_type = detect_media_type(file_path, upfile.content_type)
                    video_id = await upload_via_file(tmp_path, file_path, media_type)
                    if video_id:
                        via_file_index[file_path] = video_id
                    logger.info(f"VIA 서버에 업로드하여 video_id 획득: {video_id}")

            video_clips = []
            video = None
            try:
                # MoviePy에 파일 경로(문자열)로 전달
                video = VideoFileClip(tmp_path)
                duration = video.duration or 0
                logger.info(f"Video duration: {duration} seconds for {tmp_path}")
            except Exception as video_error:
                logger.error(f"비디오 파일 로드 실패: {tmp_path}, 오류: {video_error}")
                raise HTTPException(
                    status_code=400,
                    detail=f"비디오 파일을 로드할 수 없습니다: {file_path}. 오류: {str(video_error)}"
                )
            
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
                # 공통 파라미터 사용 (query와 summarize 구분 없이 통일)
                # chunk_size가 None이거나 -1이면 자동 계산된 chunk_duration 사용 (자동 지정 기능)
                # chunk_size가 0이면 "Chunk 없음"으로 처리
                if chunk_size is None or chunk_size == -1:
                    summarize_chunk = chunk_duration
                    logger.info(f"자동 지정: chunk_duration={chunk_duration} 사용")
                else:
                    summarize_chunk = chunk_size
                summarize_top_k_val = top_k if top_k is not None else DEFAULT_TOP_K
                summarize_top_p_val = top_p if top_p is not None else DEFAULT_TOP_P
                summarize_temp_val = temperature if temperature is not None else DEFAULT_TEMPERATURE
                summarize_max_tokens_val = max_new_tokens if max_new_tokens is not None else DEFAULT_MAX_TOKENS
                summarize_seed_val = seed if seed is not None else DEFAULT_SEED
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
                # 영어로 번역된 쿼리 저장 (유사도 계산에 사용)
                english_query = enhanced_prompt.split("Output matching scenes only as START-END=Description using numeric seconds")[0].strip() if "Output matching scenes only as START-END=Description using numeric seconds" in enhanced_prompt else enhanced_prompt
                
                enhanced_prompt = f"""{enhanced_prompt} Output matching scenes only as START-END=Description using numeric seconds (e.g., 10-20=Description or 10.5-20.3=Description)."""
                
                logger.info(f"enhanced_prompt: {enhanced_prompt}")
                
                # 설정값이 제공되지 않으면 기본값 사용
                # chunk_size가 None이거나 -1이면 자동 계산된 chunk_duration 사용 (자동 지정 기능)
                # chunk_size가 0이면 "Chunk 없음"으로 처리
                if chunk_size is None or chunk_size == -1:
                    # chunk_duration이 유효한 값인지 확인 (0 이상)
                    if chunk_duration is None or chunk_duration < 0:
                        logger.warning(f"chunk_duration이 유효하지 않습니다 ({chunk_duration}). 기본값 0 사용")
                        query_chunk_size = 0
                    else:
                        query_chunk_size = chunk_duration
                        logger.info(f"자동 지정: chunk_duration={chunk_duration} 사용")
                else:
                    query_chunk_size = chunk_size
                    # chunk_size가 음수이면 0으로 보정
                    if query_chunk_size < 0:
                        logger.warning(f"chunk_size가 음수입니다 ({query_chunk_size}). 0으로 보정")
                        query_chunk_size = 0
                query_temperature = temperature if temperature is not None else DEFAULT_QUERY_TEMPERATURE
                query_seed = seed if seed is not None else DEFAULT_QUERY_SEED
                query_max_tokens = max_new_tokens if max_new_tokens is not None else DEFAULT_QUERY_MAX_TOKENS
                query_top_p = top_p if top_p is not None else DEFAULT_QUERY_TOP_P
                query_top_k = top_k if top_k is not None else DEFAULT_QUERY_TOP_K
                
                # temperature가 0이면 완전히 결정론적인 결과를 위해 top_k를 1로 설정
                # top_k가 1보다 크면 상위 k개 토큰 중에서 샘플링하므로 랜덤성이 발생함
                if query_temperature == 0.0 and query_top_k > 1:
                    logger.info(f"temperature=0이므로 결정론적 결과를 위해 top_k를 {query_top_k}에서 1로 변경")
                    query_top_k = 1
                
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
                # "=" 다음에 "No"로 시작하는 줄은 클립 생성에서 제외
                filtered_query_result = None
                if query_result:
                    lines = str(query_result).split('\n')
                    filtered_lines = []
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        # "=" 다음 부분이 "No"로 시작하는지 확인 (대소문자 구분 없음)
                        if '=' in line:
                            parts = line.split('=', 1)
                            if len(parts) == 2:
                                description = parts[1].strip()
                                if description.lower().startswith('no '):
                                    logger.info(f"'No'로 시작하는 결과 제외: {line}")
                                    continue
                        filtered_lines.append(line)
                    
                    if filtered_lines:
                        filtered_query_result = '\n'.join(filtered_lines)
                    else:
                        filtered_query_result = None
                
                timestamp_data = []
                if filtered_query_result:
                    timestamp_data = await parse_timestamps(filtered_query_result, duration)
                    
                # 타임스탬프 기반 클립 생성 (최적화: 병렬 처리)
                base_name, _ = os.path.splitext(file_path)
                timestamp_suffix = int(time.time() * 1000)
                base = str(request.base_url).rstrip('/')
                
                if timestamp_data:
                    # 유효한 타임스탬프만 필터링
                    # 타임스탬프가 유효한 숫자인지 확인 (SS.000 같은 잘못된 형식 제외)
                    valid_timestamps = []
                    for start_time, end_time, sentence in timestamp_data:
                        # 타임스탬프가 숫자 타입이고 유효한 범위 내에 있는지 확인
                        if (isinstance(start_time, (int, float)) and isinstance(end_time, (int, float)) and
                            start_time >= 0 and end_time >= 0 and
                            end_time - start_time > 0 and
                            start_time < end_time):
                            valid_timestamps.append((start_time, end_time, sentence))
                        else:
                            logger.warning(f"유효하지 않은 타임스탬프 제외: start={start_time}, end={end_time}, sentence={sentence}")
                    
                    if not valid_timestamps:
                        logger.warning("유효한 타임스탬프가 없습니다.")
                    else:
                        logger.info(f"클립 생성 시작: {len(valid_timestamps)}개 클립 (병렬 처리)")
                        
                        # 1. 번역 작업 병렬 처리 (모든 sentence를 동시에 번역)
                        sentences_to_translate = []
                        for _, _, sentence in valid_timestamps:
                            if sentence and sentence.strip():
                                sentences_to_translate.append(sentence)
                        
                        translated_sentences = {}
                        
                        if sentences_to_translate:
                            logger.info(f"번역 작업 시작: {len(sentences_to_translate)}개 문장 병렬 처리")
                            translation_tasks = [translate_to_korean(sentence) for sentence in sentences_to_translate]
                            try:
                                translated_results = await asyncio.gather(*translation_tasks, return_exceptions=True)
                                for sentence, translated in zip(sentences_to_translate, translated_results):
                                    if isinstance(translated, Exception):
                                        logger.warning(f"sentence 한국어 번역 실패, 원본 사용: {translated}")
                                        translated_sentences[sentence] = sentence
                                    else:
                                        translated_sentences[sentence] = translated
                            except Exception as e:
                                logger.warning(f"번역 작업 중 오류 발생: {e}, 원본 사용")
                                for sentence in sentences_to_translate:
                                    translated_sentences[sentence] = sentence
                        
                        # 번역이 필요 없는 sentence도 매핑에 추가
                        for _, _, sentence in valid_timestamps:
                            if sentence not in translated_sentences:
                                translated_sentences[sentence] = sentence
                        
                        # 2. 클립 생성 함수 (동기 함수를 비동기로 래핑)
                        # 각 스레드에서 비디오 파일을 새로 열어야 함 (MoviePy는 스레드 안전하지 않음)
                        def create_clip_sync(start_time, end_time, sentence, clip_index):
                            """동기 클립 생성 함수 - 각 스레드에서 비디오 파일을 새로 엽니다"""
                            clip_filename = f"clip_{base_name}_{timestamp_suffix}_{clip_index+1}.mp4"
                            subclip = None
                            local_video = None
                            try:
                                clip_path = str(CLIPS_DIR / clip_filename)
                                
                                # 각 스레드에서 비디오 파일을 새로 열기 (스레드 안전성 보장)
                                local_video = VideoFileClip(tmp_path)
                                
                                # 비디오 클립 추출 및 저장 (최적화: 빠른 프리셋 사용)
                                subclip = _get_subclip(local_video, start_time, end_time)
                                subclip.write_videofile(
                                    clip_path,
                                    codec="libx264",
                                    audio=False,
                                    preset="ultrafast",  # 최적화: 빠른 인코딩
                                    threads=4,  # 최적화: 멀티스레딩
                                    logger=None  # 로그 비활성화로 성능 향상
                                )
                                
                                clip_url = f"{base}/clips/{clip_filename}"
                                translated_sentence = translated_sentences.get(sentence, sentence)
                                
                                result = {
                                    "id": f"{base_name}_{timestamp_suffix}_{clip_index}",
                                    "title": clip_filename,
                                    "url": clip_url,
                                    "start_time": start_time,
                                    "end_time": end_time,
                                    "search_query": prompt,
                                    "sentence": translated_sentence
                                }
                                
                                return result
                            except Exception as e:
                                logger.error(f"Error generating clip {clip_filename}: {e}")
                                return None
                            finally:
                                # subclip 리소스 정리
                                if subclip is not None:
                                    try:
                                        subclip.close()
                                        import time
                                        time.sleep(0.1)  # Windows에서 파일 핸들 해제 대기
                                    except Exception as close_error:
                                        logger.warning(f"Subclip 리소스 정리 중 오류: {close_error}")
                                    finally:
                                        del subclip
                                # local_video 리소스 정리
                                if local_video is not None:
                                    try:
                                        local_video.close()
                                        import time
                                        time.sleep(0.1)  # Windows에서 파일 핸들 해제 대기
                                    except Exception as close_error:
                                        logger.warning(f"Local video 리소스 정리 중 오류: {close_error}")
                                    finally:
                                        del local_video
                        
                        # 3. 클립 생성 병렬 처리 (ThreadPoolExecutor 사용)
                        max_workers = min(5, len(valid_timestamps))  # 최대 5개 동시 처리
                        logger.info(f"클립 생성 병렬 처리 시작: {max_workers}개 동시 처리")
                        
                        loop = asyncio.get_event_loop()
                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            clip_tasks = [
                                loop.run_in_executor(
                                    executor,
                                    create_clip_sync,
                                    start_time,
                                    end_time,
                                    sentence,
                                    idx
                                )
                                for idx, (start_time, end_time, sentence) in enumerate(valid_timestamps)
                            ]
                            
                            # 모든 클립 생성 완료 대기
                            clip_results = await asyncio.gather(*clip_tasks, return_exceptions=True)
                            
                            # 성공한 클립만 추가
                            for result in clip_results:
                                if isinstance(result, Exception):
                                    logger.error(f"클립 생성 중 예외 발생: {result}")
                                elif result is not None:
                                    video_clips.append(result)
                        
                        logger.info(f"클립 생성 완료: {len(video_clips)}개 성공")
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
                # 비디오 리소스 정리 (Windows에서 파일 잠금 해제를 위해 충분한 시간 확보)
                if video is not None:
                    try:
                        video.close()
                        # Windows에서 파일 핸들이 완전히 해제될 때까지 대기
                        await asyncio.sleep(0.5)
                    except Exception as close_error:
                        logger.warning(f"비디오 리소스 정리 중 오류: {close_error}")
                    finally:
                        del video
                        # 추가 가비지 컬렉션 대기 (Windows 파일 잠금 해제)
                        await asyncio.sleep(0.2)

            grouped_clips.append({
                "video": file_path,
                "clips": video_clips
            })

    except HTTPException:
        # HTTPException은 그대로 전파
        raise
    except Exception as e:
        logger.error(f"Error processing uploaded video(s): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing uploaded video(s): {e}")
    finally:
        # 임시 파일 정리 (재시도 로직 포함)
        async def safe_delete_file(file_path: str, max_retries: int = 5, delay: float = 1.5):
            """파일 삭제를 안전하게 재시도하는 함수 (Windows 파일 잠금 문제 대응)"""
            for attempt in range(max_retries):
                try:
                    if os.path.exists(file_path):
                        # Windows에서 파일이 사용 중일 수 있으므로 대기 후 시도
                        if attempt > 0:
                            # 재시도 횟수가 많을수록 더 오래 대기 (1.5초, 3초, 4.5초, 6초)
                            await asyncio.sleep(delay * attempt)
                        os.unlink(file_path)
                        logger.debug(f"임시 파일 삭제 완료: {file_path}")
                        return True
                except (PermissionError, OSError) as e:
                    # WinError 32는 OSError의 하위 클래스이므로 OSError도 처리
                    error_code = getattr(e, 'winerror', None) or getattr(e, 'errno', None)
                    # WinError 32: 파일이 다른 프로세스에 의해 사용 중
                    if error_code == 32 or (isinstance(e, OSError) and "사용 중" in str(e)):
                        if attempt < max_retries - 1:
                            logger.debug(f"임시 파일 삭제 재시도 {attempt + 1}/{max_retries}: {file_path} (파일 사용 중)")
                            continue
                        else:
                            logger.warning(f"임시 파일 삭제 실패 (최대 재시도 횟수 초과): {file_path}, 오류: {e}")
                            # 파일이 사용 중이면 나중에 정리하도록 스케줄링 (백그라운드 작업)
                            # Windows에서는 파일이 잠겨있을 수 있으므로 경고만 남기고 계속 진행
                            return False
                    else:
                        # 다른 종류의 PermissionError나 OSError는 즉시 실패 처리
                        logger.warning(f"임시 파일 삭제 실패: {file_path}, 오류: {e}")
                        return False
                except Exception as cleanup_error:
                    logger.warning(f"임시 파일 삭제 실패: {file_path}, 오류: {cleanup_error}")
                    return False
            return False
        
        # 모든 임시 파일 삭제 시도
        for tmp_file in temp_files_to_cleanup:
            await safe_delete_file(tmp_file)

    # 검색 결과와 질문 간의 유사도 필터링 (VERT/Ollama 임베딩 사용)
    # TODO: 유사도 필터링 기능 임시 비활성화
    """
    if grouped_clips and len(grouped_clips) > 0:
        logger.info(f"유사도 필터링 시작: {len(grouped_clips)}개 동영상의 검색 결과")
        filtered_grouped_clips = []
        similarity_threshold = 0.3  # 유사도 임계값 (0.0 ~ 1.0, 이하인 것만 포함)
        
        # 영어로 번역된 질문의 임베딩 생성 (한 번만 계산)
        query_embedding = None
        english_query_for_similarity = None
        try:
            # 검색 쿼리를 영어로 번역 (유사도 계산용)
            english_query_for_similarity = await build_query_prompt(prompt)
            # "Output matching scenes only..." 부분 제거
            if "Output matching scenes only as START-END=Description using numeric seconds" in english_query_for_similarity:
                english_query_for_similarity = english_query_for_similarity.split("Output matching scenes only as START-END=Description using numeric seconds")[0].strip()
            query_embedding = await get_text_embedding(english_query_for_similarity)
            if query_embedding:
                logger.info(f"영어로 번역된 질문 임베딩 생성 완료: {english_query_for_similarity[:50]}...")
        except Exception as e:
            logger.warning(f"질문 임베딩 생성 실패, 유사도 필터링 건너뜀: {e}")
        
        if query_embedding:
            total_clips_before = sum(len(group.get("clips", [])) for group in grouped_clips)
            filtered_count = 0
            
            for group in grouped_clips:
                video_path = group.get("video", "")
                # 비디오 파일명 추출
                video_filename = os.path.basename(video_path) if video_path else "알 수 없음"
                
                video_clips = group.get("clips", [])
                if not video_clips:
                    filtered_grouped_clips.append(group)
                    continue
                
                filtered_clips = []
                # 각 클립의 sentence와 질문 간 유사도 계산
                similarity_tasks = []
                for clip in video_clips:
                    # sentence 필드가 있는 경우에만 유사도 계산
                    sentence = clip.get("sentence") or clip.get("title") or ""
                    if sentence and not clip.get("via_response"):
                        similarity_tasks.append((clip, sentence))
                    else:
                        # sentence가 없거나 via_response인 경우는 그대로 포함
                        filtered_clips.append(clip)
                
                # 유사도 계산 (병렬 처리)
                if similarity_tasks:
                    logger.info(f"[{video_filename}] 유사도 계산 중: {len(similarity_tasks)}개 클립")
                    # 모든 sentence를 영어로 번역한 후 임베딩 생성 (병렬 처리)
                    translation_tasks = [translate_to_english(sentence) for _, sentence in similarity_tasks]
                    english_sentences = await asyncio.gather(*translation_tasks, return_exceptions=True)
                    
                    # 영어로 번역된 sentence의 임베딩을 병렬로 생성
                    embedding_tasks = []
                    for idx, english_sentence in enumerate(english_sentences):
                        if isinstance(english_sentence, Exception):
                            # 번역 실패 시 원본 sentence 사용
                            original_sentence = similarity_tasks[idx][1]
                            embedding_tasks.append(get_text_embedding(original_sentence))
                        else:
                            embedding_tasks.append(get_text_embedding(english_sentence))
                    sentence_embeddings = await asyncio.gather(*embedding_tasks, return_exceptions=True)
                    
                    similarity_results = []
                    for idx, ((clip, sentence), sentence_embedding) in enumerate(zip(similarity_tasks, sentence_embeddings)):
                        try:
                            if isinstance(sentence_embedding, Exception):
                                logger.warning(f"[{video_filename}] 클립 임베딩 생성 실패: {sentence_embedding}, 클립 포함")
                                similarity_results.append((clip, 0.5))
                            elif sentence_embedding:
                                similarity = cosine_similarity(query_embedding, sentence_embedding)
                                similarity_results.append((clip, similarity))
                            else:
                                # 임베딩 생성 실패 시 포함 (안전 장치)
                                similarity_results.append((clip, 0.5))
                        except Exception as e:
                            logger.warning(f"[{video_filename}] 클립 유사도 계산 실패: {e}, 클립 포함")
                            similarity_results.append((clip, 0.5))
                    
                    # 비디오별 유사도 점수 출력
                    if similarity_results:
                        similarities = [sim for _, sim in similarity_results]
                        avg_similarity = sum(similarities) / len(similarities) if similarities else 0.0
                        max_similarity = max(similarities) if similarities else 0.0
                        min_similarity = min(similarities) if similarities else 0.0
                        logger.info(f"[{video_filename}] 유사도 점수 - 평균: {avg_similarity:.3f}, 최대: {max_similarity:.3f}, 최소: {min_similarity:.3f}, 클립 수: {len(similarity_results)}")
                        
                        # 각 클립별 유사도 점수 출력
                        for idx, (clip, similarity) in enumerate(similarity_results):
                            sentence_preview = (clip.get("sentence") or clip.get("title") or "")[:50]
                            # 영어로 번역된 sentence도 출력 (디버깅용)
                            if idx < len(english_sentences) and not isinstance(english_sentences[idx], Exception):
                                english_preview = english_sentences[idx][:50] if english_sentences[idx] else ""
                                logger.info(f"  - 유사도: {similarity:.3f} | 원문: {sentence_preview}... | 영문: {english_preview}...")
                            else:
                                logger.info(f"  - 유사도: {similarity:.3f} | {sentence_preview}...")
                    
                    # 유사도가 임계값 이하인 클립만 포함
                    included_count = 0
                    excluded_count = 0
                    for clip, similarity in similarity_results:
                        if similarity <= similarity_threshold:
                            filtered_clips.append(clip)
                            included_count += 1
                        else:
                            filtered_count += 1
                            excluded_count += 1
                            logger.debug(f"[{video_filename}] 유사도 높은 클립 제외: similarity={similarity:.3f}, sentence={clip.get('sentence', '')[:50]}...")
                    
                    logger.info(f"[{video_filename}] 필터링 결과 - 포함: {included_count}개, 제외: {excluded_count}개 (임계값 이하: {similarity_threshold})")
                
                if filtered_clips:
                    filtered_grouped_clips.append({
                        "video": group.get("video"),
                        "clips": filtered_clips
                    })
                else:
                    # 모든 클립이 필터링된 경우 빈 리스트로 추가
                    logger.info(f"[{video_filename}] 모든 클립이 필터링되어 제외됨")
                    filtered_grouped_clips.append({
                        "video": group.get("video"),
                        "clips": []
                    })
            
            total_clips_after = sum(len(group.get("clips", [])) for group in filtered_grouped_clips)
            logger.info(f"유사도 필터링 완료: {total_clips_before}개 → {total_clips_after}개 클립 ({filtered_count}개 제외)")
            grouped_clips = filtered_grouped_clips
        else:
            logger.warning("질문 임베딩 생성 실패로 유사도 필터링을 건너뜁니다.")
    """
    
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

    temp_file_path = None
    try:
        if file and not video_id:
            TMP_DIR.mkdir(exist_ok=True)
            file_path = str(TMP_DIR / file.filename)
            temp_file_path = file_path
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            video_id = await vss_client.upload_video(file_path)
            
            logger.info(
                "[CA-RAG DEBUG] 파일 업로드 완료: video_id=%s",
                video_id
            )
        elif not video_id:
            raise HTTPException(status_code=400, detail="video_id 또는 file 중 하나는 필요합니다.")
    finally:
        # 임시 파일 정리
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"임시 파일 삭제 완료: {temp_file_path}")
            except Exception as cleanup_error:
                logger.warning(f"임시 파일 삭제 실패: {temp_file_path}, 오류: {cleanup_error}")
    
    logger.info(
        "[CA-RAG DEBUG] query_video 호출 전: video_id=%s",
        video_id
    )
    logger.info(
        "[CA-RAG DEBUG] ⚠️ 이 video_id에 대한 이전 summarize_video 호출 여부 확인 필요"
    )
    
    # temperature가 0이면 완전히 결정론적인 결과를 위해 top_k를 1로 설정
    # top_k가 1보다 크면 상위 k개 토큰 중에서 샘플링하므로 랜덤성이 발생함
    adjusted_top_k = top_k
    if temperature == 0.0 and top_k > 1:
        logger.info(f"temperature=0이므로 결정론적 결과를 위해 top_k를 {top_k}에서 1로 변경")
        adjusted_top_k = 1
    
    query_params = build_query_video_params(
        video_id=video_id,
        model=model,
        query=query,
        chunk_size=chunk_size,
        temperature=temperature,
        seed=seed,
        max_new_tokens=max_new_tokens,
        top_p=top_p,
        top_k=adjusted_top_k
    )
    
    try:
        result = await vss_client.query_video(*query_params)
        
        logger.info(
            "[CA-RAG DEBUG] query_video 호출 완료: 결과 길이=%d",
            len(result) if result else 0
        )
    except HTTPException:
        raise
    except Exception as query_error:
        logger.error(f"query_video 호출 실패: {query_error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"동영상 검색 중 오류가 발생했습니다: {str(query_error)}"
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

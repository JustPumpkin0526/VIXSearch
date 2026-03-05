"""검색 및 클립 생성 관련 라우터"""
import os
import json
import time
import shutil
import asyncio
import logging
import aiohttp
import tempfile
import aiofiles
from typing import Optional, List, Set, Tuple
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Request, File, Form, UploadFile, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from moviepy.video.io.VideoFileClip import VideoFileClip
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
from database.connection import conn, cursor, ensure_db_connection, get_db_connection
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
    DEFAULT_ENABLE_AUDIO, VIA_UPLOAD_TIMEOUT_MIN, VIA_UPLOAD_TIMEOUT_MAX, VIA_UPLOAD_TIMEOUT_PER_MB,
    ENABLE_VST, VST_API_URL, ENABLE_ALERTBRIDGE, ALERTBRIDGE_API_BASE, FILTERED_CLIP_PATH
)

logger = logging.getLogger(__name__)

# cv2 사용 가능 여부 로깅
if not CV2_AVAILABLE:
    logger.warning("cv2를 사용할 수 없습니다. 클립 유효성 검사가 제한됩니다.")

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
        
        via_file_index = await fetch_via_file_index()

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
                # 파일명으로 내부 DB ID 찾기 (여러 가능한 파일명 형식 시도)
                db_internal_id = (
                    video_id_map.get(file_path) or 
                    video_id_map.get(upfile.filename) or
                    video_id_map.get(os.path.basename(upfile.filename))
                )
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
            
            # video_id가 없으면 내부 DB ID로 직접 조회 시도 (video_id_map에서 찾지 못한 경우)
            if not video_id and db_internal_id and user_id:
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
                        logger.info(f"내부 DB ID {db_internal_id}로 VIDEO_ID {video_id} 재조회 성공 (파일명: {file_path})")
                except Exception as e:
                    logger.warning(f"VIDEO_ID 재조회 중 오류: {e}")
            
            # video_id가 없으면 VIA 서버 파일 목록에서 확인
            if not video_id:
                existing_id = via_file_index.get(file_path)
                if existing_id:
                    video_id = existing_id
                    logger.info(f"VIA 서버에 이미 존재하는 파일 사용: {file_path} -> {video_id}")
                else:
                    # db_internal_id가 있는 경우, DB에서 VIDEO_ID를 다시 한 번 확인
                    if db_internal_id and user_id:
                        try:
                            ensure_db_connection()
                            cursor.execute(
                                "SELECT VIDEO_ID FROM vss_videos WHERE ID = ? AND USER_ID = ?",
                                (db_internal_id, user_id)
                            )
                            video_row = cursor.fetchone()
                            if video_row and video_row[0]:
                                video_id = video_row[0]
                                logger.info(f"VIA 서버 업로드 전 DB에서 VIDEO_ID {video_id} 발견 (파일명: {file_path})")
                        except Exception as e:
                            logger.warning(f"VIA 서버 업로드 전 VIDEO_ID 조회 중 오류: {e}")
                    
                    # 여전히 video_id가 없으면 새로 업로드
                    if not video_id:
                        logger.info("VIA 서버에 파일이 없어 업로드 시작")
                        media_type = detect_media_type(file_path, upfile.content_type)
                        video_id = await upload_via_file(tmp_path, file_path, media_type)
                        if video_id:
                            via_file_index[file_path] = video_id
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

            # video_id 확인 (필수)
            if not video_id:
                logger.error(f"VIDEO_ID를 획득하지 못했습니다. 파일: {file_path}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"동영상 파일을 VIA 서버에 업로드하지 못했습니다: {file_path}"
                )

            # 요약 파라미터 준비 (Ollama를 사용하여 프롬프트 생성)
            AI_prompt = await create_summarize_prompt(prompt)
            logger.info(f"AI_prompt 생성 완료: {AI_prompt[:100]}... (전체 길이: {len(AI_prompt)})")
            
            # DB에서 요약 결과 확인 (user_id와 video_id가 있는 경우)
            # 요약 결과가 있으면 요약 단계를 건너뛰고 검색만 진행
            has_stored_summary = False
            should_skip_summarize = False
            if user_id and video_id:
                try:
                    ensure_db_connection()
                    # VIDEO_ID (VIA 서버의 video_id)로 요약 결과 확인
                    cursor.execute(
                        """SELECT ID FROM vss_summaries 
                           WHERE VIDEO_ID = ? AND USER_ID = ?""",
                        (video_id, user_id)
                    )
                    summary_row = cursor.fetchone()
                    if summary_row:
                        has_stored_summary = True
                        # 상세 검색 모드에서 이미 요약 결과가 있으면 요약 단계 건너뛰기
                        should_skip_summarize = True
                        logger.info(f"저장된 요약 결과 발견: VIDEO_ID {video_id}. 요약 단계를 건너뛰고 검색만 진행합니다.")
                    else:
                        has_stored_summary = False
                        should_skip_summarize = False
                        logger.info(f"저장된 요약 결과가 없습니다. 요약을 수행합니다. (VIDEO_ID: {video_id})")
                except Exception as e:
                    logger.warning(f"요약 결과 확인 중 오류: {e}")
                    has_stored_summary = False
                    should_skip_summarize = False

            # 요약 결과가 있고 프롬프트가 동일한 경우 요약 단계 건너뛰기
            logger.info(f"summarize_video 호출 준비: VIDEO_ID={video_id}, image_mode={image_mode}, should_skip_summarize={should_skip_summarize}")
            if video_id and not should_skip_summarize:  # video_id가 있고 요약을 건너뛰지 않는 경우에만 summarize_video 호출
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
                
                logger.info(f"build_summarize_params 호출 전: VIDEO_ID={video_id}, image_mode={image_mode}")
                try:
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
                    logger.info(f"build_summarize_params 완료: 파라미터 개수={len(summarize_params)}")
                    logger.info(f"summarize_video 호출 시작: VIDEO_ID={video_id}")
                    result = await vss_client.summarize_video(*summarize_params)
                    logger.info(f"summarize_video 호출 성공: VIDEO_ID={video_id}, CA-RAG 컨텍스트 초기화 완료")
                    
                    # 요약 결과를 DB에 저장 (프롬프트가 변경되었거나 저장된 요약이 없는 경우만)
                    if not has_stored_summary and user_id and video_id and result:
                        try:
                            summary_text = result
                            if isinstance(result, dict):
                                summary_text = result.get("content", str(result))
                            elif not isinstance(result, str):
                                summary_text = str(result)
                            
                            _save_summary_to_db(video_id, user_id, summary_text, AI_prompt)
                            logger.info(f"요약 결과를 DB에 저장했습니다. (VIDEO_ID: {video_id})")
                        except Exception as e:
                            logger.error(f"요약 결과 DB 저장 실패: {e}")
                    elif has_stored_summary:
                        logger.info(f"저장된 요약이 있어 DB 저장을 건너뜁니다. CA-RAG 컨텍스트는 초기화되었습니다. (VIDEO_ID: {video_id})")
                except Exception as summarize_error:
                    logger.error(f"summarize_video 호출 실패: VIDEO_ID={video_id}, 오류={summarize_error}")
                    logger.error(f"오류 상세: {type(summarize_error).__name__}: {str(summarize_error)}")
                    import traceback
                    logger.error(f"트레이스백: {traceback.format_exc()}")
                    # summarize_video 실패 시에도 query_video를 시도할 수 있지만, 
                    # 컨텍스트가 없으면 실패할 가능성이 높음
                    # 에러를 전파하여 사용자에게 알림
                    raise HTTPException(
                        status_code=500, 
                        detail=f"동영상 요약 중 오류가 발생했습니다. CA-RAG 컨텍스트 초기화 실패: {str(summarize_error)}"
                    )
            elif should_skip_summarize:
                # 요약을 건너뛰는 경우 로그만 출력
                logger.info(f"저장된 요약 결과가 있어 요약 단계를 건너뜁니다. VIDEO_ID={video_id}, 검색만 진행합니다.")
            else:
                logger.error(f"VIDEO_ID가 없어 summarize_video를 호출할 수 없습니다. 파일: {file_path}")
                raise HTTPException(
                    status_code=400,
                    detail=f"동영상 파일의 VIA 서버 ID를 획득하지 못했습니다: {file_path}"
                )
            
            # prompt를 질문으로 처리: VIA 서버의 query_video 사용
            # summarize_video가 성공적으로 완료되었거나 건너뛴 경우 query_video 호출
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
                
                # summarize_video가 성공적으로 완료된 후 query_video 호출
                # CA-RAG 컨텍스트가 초기화되어 있어야 함
                logger.info(f"query_video 호출 전: VIDEO_ID={video_id}, CA-RAG 컨텍스트 초기화 확인됨")
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
    
    # vss-query는 요약 없이 오직 query만 수행
    # (요약이 필요한 경우 generate-clips 엔드포인트를 사용)
    logger.info(
        "[CA-RAG DEBUG] query_video 호출: video_id=%s (요약 없이 query만 수행)",
        video_id
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

@router.post("/save-search-state")
async def save_search_state(
    user_id: str = Form(...),
    state_data: str = Form(...)  # JSON 문자열
):
    """Search 메뉴 상태를 DB에 저장"""
    try:
        state_json = json.loads(state_data)
        
        with get_db_connection() as db_cursor:
            # 기존 상태가 있으면 업데이트, 없으면 삽입
            # 테이블이 없으면 생성 (IF NOT EXISTS는 MariaDB에서 지원하지 않으므로 try-except 사용)
            try:
                db_cursor.execute(
                    """INSERT INTO vss_search_states (USER_ID, STATE_DATA, UPDATED_AT)
                       VALUES (?, ?, CURRENT_TIMESTAMP)
                       ON DUPLICATE KEY UPDATE 
                       STATE_DATA = VALUES(STATE_DATA),
                       UPDATED_AT = CURRENT_TIMESTAMP""",
                    (user_id, json.dumps(state_json))
                )
            except Exception as table_error:
                # 테이블이 없으면 생성
                if "doesn't exist" in str(table_error) or "Unknown table" in str(table_error):
                    logger.info("vss_search_states 테이블이 없어 생성합니다.")
                    db_cursor.execute("""
                        CREATE TABLE IF NOT EXISTS vss_search_states (
                            USER_ID VARCHAR(255) PRIMARY KEY,
                            STATE_DATA TEXT,
                            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        )
                    """)
                    db_cursor.execute(
                        """INSERT INTO vss_search_states (USER_ID, STATE_DATA, UPDATED_AT)
                           VALUES (?, ?, CURRENT_TIMESTAMP)""",
                        (user_id, json.dumps(state_json))
                    )
                else:
                    raise
        
        return {"success": True, "message": "Search 상태 저장 완료"}
    except Exception as e:
        logger.error(f"Search 상태 저장 실패: {e}")
        raise HTTPException(status_code=500, detail=f"상태 저장 중 오류가 발생했습니다: {str(e)}")

@router.get("/load-search-state")
async def load_search_state(
    user_id: str = Query(...)
):
    """Search 메뉴 상태를 DB에서 불러오기"""
    try:
        with get_db_connection() as db_cursor:
            try:
                db_cursor.execute(
                    "SELECT STATE_DATA FROM vss_search_states WHERE USER_ID = ?",
                    (user_id,)
                )
                result = db_cursor.fetchone()
                
                if result and result[0]:
                    state_json = json.loads(result[0])
                    return {"success": True, "state": state_json}
                else:
                    return {"success": True, "state": None}
            except Exception as table_error:
                # 테이블이 없으면 None 반환
                if "doesn't exist" in str(table_error) or "Unknown table" in str(table_error):
                    logger.info("vss_search_states 테이블이 없습니다.")
                    return {"success": True, "state": None}
                else:
                    raise
    except Exception as e:
        logger.error(f"Search 상태 불러오기 실패: {e}")
        raise HTTPException(status_code=500, detail=f"상태 불러오기 중 오류가 발생했습니다: {str(e)}")

# ==================== 고속 검색 (CV Event Detector 기반) ====================

def find_video_clips(clips_folder: Path) -> List[str]:
    """
    클립 폴더에서 비디오 파일을 찾는 함수 (원본 프로젝트의 vlm_main.find_video_clips와 유사)
    
    Args:
        clips_folder: 클립이 저장된 폴더 경로
    
    Returns:
        비디오 파일 경로 리스트
    """
    video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
    clips = []
    
    if not clips_folder.exists():
        return clips
    
    try:
        # 폴더 내의 모든 파일 검색
        for file_path in clips_folder.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in video_extensions:
                clips.append(str(file_path))
    except Exception as e:
        logger.warning(f"클립 폴더 검색 중 오류: {e}")
    
    return clips

def is_valid_video_clip(clip_path: str) -> bool:
    """
    클립 파일이 유효한 비디오인지 확인하는 함수 (원본 프로젝트의 monitor_output_clips 로직 참고)
    
    Args:
        clip_path: 클립 파일 경로
    
    Returns:
        유효한 비디오인지 여부
    """
    if not os.path.exists(clip_path):
        return False
    
    # cv2를 사용할 수 있는 경우 프레임 높이로 유효성 검사
    if CV2_AVAILABLE:
        try:
            cap = cv2.VideoCapture(clip_path)
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            return frame_height > 0
        except Exception as e:
            logger.debug(f"클립 유효성 검사 실패 (cv2): {clip_path}, {e}")
            return False
    else:
        # cv2가 없으면 파일 크기로 간단히 확인
        try:
            file_size = os.path.getsize(clip_path)
            return file_size > 0
        except Exception:
            return False

async def monitor_clips_folder(
    clips_folder: Path,
    processed_clips: Set[str],
    stream_name: str,
    detection_classes: str,
    session: Optional[aiohttp.ClientSession] = None,
    video_input_path: Optional[str] = None,
    alert_prompts: Optional[List[str]] = None,
    system_prompt: Optional[str] = None,
    enable_reasoning: bool = False,
    do_verification: bool = True
) -> List[dict]:
    """
    클립 폴더를 모니터링하여 새로운 클립을 찾고 후처리하는 함수
    (원본 프로젝트의 monitor_output_clips 로직 참고)
    
    Args:
        clips_folder: 클립이 저장된 폴더 경로
        processed_clips: 이미 처리된 클립 파일 경로 집합
        stream_name: 스트림 이름
        detection_classes: 검출 클래스
        session: aiohttp 세션 (VST/AlertBridge 전송용)
        video_input_path: 비디오 입력 경로 (sensor_id 추출용)
        alert_prompts: AlertBridge 전송용 프롬프트 리스트
        system_prompt: 시스템 프롬프트
        enable_reasoning: 추론 활성화 여부
        do_verification: 검증 수행 여부
    
    Returns:
        새로 발견된 클립 정보 리스트
    """
    new_clips = []
    
    try:
        # 클립 폴더에서 비디오 파일 찾기
        clips = find_video_clips(clips_folder)
        
        # FILTERED_CLIP_PATH 디렉토리 생성
        filtered_clip_dir = Path(FILTERED_CLIP_PATH)
        filtered_clip_dir.mkdir(parents=True, exist_ok=True)
        
        # sensor_id 추출
        sensor_id = extract_sensor_id(stream_name, video_input_path)
        
        for clip_path in clips:
            # 이미 처리된 클립은 건너뛰기
            if clip_path in processed_clips:
                continue
            
            # 클립 유효성 검사
            if not is_valid_video_clip(clip_path):
                logger.debug(f"유효하지 않은 클립 파일: {clip_path}")
                continue
            
            # 처리된 클립 목록에 추가
            processed_clips.add(clip_path)
            
            # 클립 정보 추출
            clip_filename = os.path.basename(clip_path)
            clip_basename = os.path.splitext(clip_filename)[0]
            clip_url = f"/clips/{clip_filename}"
            
            # 메타데이터 파일 확인 (선택사항)
            metadata_file = clips_folder / f"{clip_basename}.json"
            metadata = {}
            start_time = None
            end_time = None
            
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        start_time = metadata.get("start_time")
                        end_time = metadata.get("end_time")
                except Exception as e:
                    logger.debug(f"메타데이터 파일 읽기 실패: {metadata_file}, {e}")
            
            # 클립 후처리: FILTERED_CLIP_PATH로 복사 (원본 프로젝트 로직)
            destination_clip_path = filtered_clip_dir / clip_filename
            try:
                shutil.copy(clip_path, destination_clip_path)
                logger.info(f"클립 복사 완료: {clip_path} -> {destination_clip_path}")
            except Exception as e:
                logger.warning(f"클립 복사 실패: {clip_path}, {e}")
                destination_clip_path = clip_path  # 복사 실패 시 원본 경로 사용
            
            # VST 업로드 (선택사항)
            vst_id = ""
            if ENABLE_VST and session:
                try:
                    clip_metadata_filename = f"{clip_basename}.json"
                    success, vst_id = await send_clip_to_vst(
                        session,
                        str(destination_clip_path),
                        clip_filename,
                        clip_metadata_filename,
                        sensor_id
                    )
                    if success:
                        logger.info(f"VST 업로드 성공: {clip_filename}, VST ID: {vst_id}")
                    else:
                        logger.warning(f"VST 업로드 실패: {clip_filename}")
                except Exception as e:
                    logger.error(f"VST 업로드 중 오류: {clip_filename}, {e}", exc_info=True)
            
            # AlertBridge 전송 (선택사항)
            if ENABLE_ALERTBRIDGE and session and alert_prompts:
                try:
                    clip_metadata_filename = f"{clip_basename}.json"
                    default_system_prompt = system_prompt or "You are a helpful assistant. Answer the user's question in yes or no along with a one line description."
                    
                    for index, prompt in enumerate(alert_prompts):
                        logger.info(f"AlertBridge에 알림 전송 중: 프롬프트 {index+1}: {prompt}")
                        await send_alert_to_alertbridge(
                            session,
                            ALERTBRIDGE_API_BASE,
                            index,
                            prompt,
                            default_system_prompt,
                            str(destination_clip_path),
                            clip_metadata_filename,
                            vst_id,
                            sensor_id,
                            start_time,
                            end_time,
                            enable_reasoning,
                            do_verification
                        )
                except Exception as e:
                    logger.error(f"AlertBridge 전송 중 오류: {clip_filename}, {e}", exc_info=True)
            
            # 클립 정보 생성
            clip_info = {
                "id": f"{stream_name}_{clip_basename}",
                "title": clip_filename,
                "url": clip_url,
                "start_time": start_time,
                "end_time": end_time,
                "search_query": detection_classes,
                "sentence": "객체 검출",
                "event_type": "object_detection",
                "metadata": metadata,
                "vst_id": vst_id if vst_id else None,
                "sensor_id": sensor_id
            }
            
            new_clips.append(clip_info)
            logger.info(f"새 클립 발견 및 처리 완료: {clip_filename} (경로: {clip_path})")
    
    except Exception as e:
        logger.error(f"클립 폴더 모니터링 중 오류: {e}", exc_info=True)
    
    return new_clips

async def send_clip_to_vst(
    session: aiohttp.ClientSession,
    clip_path: str,
    clip_filename: str,
    clip_metadata_file: str,
    sensor_id: str
) -> Tuple[bool, str]:
    """
    클립을 VST (Video Storage)에 업로드하는 함수
    (원본 프로젝트의 send_clip_to_vst 로직 참고)
    
    Args:
        session: aiohttp 세션
        clip_path: 클립 파일 경로
        clip_filename: 클립 파일명
        clip_metadata_file: 메타데이터 파일명
        sensor_id: 센서 ID
    
    Returns:
        (성공 여부, VST ID)
    """
    if not ENABLE_VST:
        return False, ""
    
    try:
        # 메타데이터 파일 읽기
        metadata_content = {}
        metadata_path = Path(clip_path).parent / clip_metadata_file
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata_content = json.load(f)
            except Exception as e:
                logger.warning(f"메타데이터 파일 읽기 실패: {metadata_path}, {e}")
        
        # 폼 데이터 생성
        form_data = aiohttp.FormData()
        
        # 클립 파일 업로드
        with open(clip_path, 'rb') as clip_file:
            form_data.add_field('mediaFile', clip_file, filename=clip_filename, content_type='video/mp4')
        
        # 메타데이터 파일 업로드 (있는 경우)
        if metadata_path.exists():
            with open(metadata_path, 'rb') as meta_file:
                form_data.add_field('metaDataFile', meta_file, filename=clip_metadata_file, content_type='application/json')
        
        # 메타데이터 JSON 추가
        event_info = {
            "eventInfo": "object_detection",
            "timestamp": int(time.time()),
            "streamName": Path(clip_path).stem,
            "sensorId": sensor_id
        }
        form_data.add_field('metadata', json.dumps(event_info))
        form_data.add_field('mediaFilePath', clip_filename)
        form_data.add_field('metaDataFilePath', clip_metadata_file)
        
        # VST API에 업로드
        async with session.post(
            f"{VST_API_URL}/upload",
            data=form_data,
            timeout=aiohttp.ClientTimeout(total=60)
        ) as resp:
            if resp.status == 200:
                result = await resp.json()
                vst_id = result.get('id', '')
                logger.info(f"VST 업로드 성공: {clip_filename}, VST ID: {vst_id}")
                return True, vst_id
            else:
                error_text = await resp.text()
                logger.error(f"VST 업로드 실패: {clip_filename}, HTTP {resp.status}, {error_text}")
                return False, ""
    
    except Exception as e:
        logger.error(f"VST 업로드 중 오류: {clip_filename}, {e}", exc_info=True)
        return False, ""

async def send_alert_to_alertbridge(
    session: aiohttp.ClientSession,
    alertbridge_api_base: str,
    prompt_index: int,
    prompt: str,
    system_prompt: str,
    clip_path: str,
    cv_metadata_path: str,
    vst_id: str,
    sensor_id: str,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    enable_reasoning: bool = False,
    do_verification: bool = True
) -> bool:
    """
    AlertBridge에 알림을 전송하는 함수
    (원본 프로젝트의 send_alert_to_alertbridge 로직 참고)
    
    Args:
        session: aiohttp 세션
        alertbridge_api_base: AlertBridge API 기본 URL
        prompt_index: 프롬프트 인덱스
        prompt: 검증 프롬프트
        system_prompt: 시스템 프롬프트
        clip_path: 클립 파일 경로
        cv_metadata_path: CV 메타데이터 파일 경로
        vst_id: VST ID
        sensor_id: 센서 ID
        start_time: 시작 시간
        end_time: 종료 시간
        enable_reasoning: 추론 활성화 여부
        do_verification: 검증 수행 여부
    
    Returns:
        성공 여부
    """
    if not ENABLE_ALERTBRIDGE or not alertbridge_api_base:
        return False
    
    try:
        import uuid
        from datetime import datetime
        
        # Alert ID 생성
        alert_id = str(uuid.uuid4())
        
        # 타임스탬프 생성
        timestamp = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        
        # 클립 파일명 추출
        clip_basename = Path(clip_path).stem
        
        # AlertBridge 페이로드 생성
        payload = {
            "id": alert_id,
            "version": "1.0",
            "@timestamp": timestamp,
            "sensor_id": sensor_id,
            "video_path": clip_path,
            "vst_id": vst_id,
            "start_time": f"{start_time:.3f}" if start_time is not None else "0.000",
            "end_time": f"{end_time:.3f}" if end_time is not None else "0.000",
            "alert": {
                "severity": "MEDIUM",
                "status": "REVIEW_PENDING",
                "type": "object_detection",
                "description": f"Alert verification for prompt: {prompt}"
            },
            "event": {
                "type": "video_analysis",
                "description": f"Video analysis for prompt: {prompt}"
            },
            "confidence": 1,
            "cv_metadata_path": cv_metadata_path,
            "vss_params": {
                "vlm_params": {
                    "prompt": prompt,
                    "system_prompt": system_prompt,
                    "max_tokens": 50,
                    "temperature": 0.3,
                    "top_p": 0.3,
                    "top_k": 40,
                    "seed": 42
                },
                "chunk_overlap_duration": 0,
                "cv_metadata_overlay": False,
                "enable_reasoning": enable_reasoning,
                "do_verification": do_verification,
                "debug": False
            },
            "meta_labels": [
                {"key": "prompt_index", "value": str(prompt_index)},
                {"key": "prompt_text", "value": prompt},
                {"key": "enable_reasoning", "value": str(enable_reasoning)}
            ]
        }
        
        # AlertBridge API에 전송
        async with session.post(
            f"{alertbridge_api_base}/alerts",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=60)
        ) as resp:
            if resp.status == 200 or resp.status == 202:
                result = await resp.json()
                logger.info(f"AlertBridge 전송 성공: {clip_basename}, Alert ID: {alert_id}")
                return True
            else:
                error_text = await resp.text()
                logger.error(f"AlertBridge 전송 실패: {clip_basename}, HTTP {resp.status}, {error_text}")
                return False
    
    except Exception as e:
        logger.error(f"AlertBridge 전송 중 오류: {clip_path}, {e}", exc_info=True)
        return False

def extract_sensor_id(stream_name: str, video_input_path: Optional[str] = None) -> str:
    """
    스트림 이름 또는 비디오 경로에서 sensor ID를 추출하는 함수
    (원본 프로젝트의 monitor_output_clips 로직 참고)
    
    Args:
        stream_name: 스트림 이름
        video_input_path: 비디오 입력 경로 (선택사항)
    
    Returns:
        센서 ID
    """
    if video_input_path:
        if video_input_path.startswith("rtsp://"):
            sensor_id = "rtsp_" + video_input_path.split("rtsp://", 1)[-1].rsplit("@", 1)[-1].translate(
                str.maketrans({"/": "_", ".": "_", ":": "__"})
            )
        elif video_input_path.startswith("http://"):
            sensor_id = "http_" + video_input_path.split("http://", 1)[-1].rsplit("/", 1)[-1].translate(
                str.maketrans({"/": "_", ".": "_", ":": "__"})
            )
        else:
            sensor_id = os.path.splitext(os.path.basename(video_input_path))[0]
    else:
        # stream_name에서 파일명 추출 (확장자 제거)
        sensor_id = os.path.splitext(stream_name)[0]
    
    return sensor_id

def parse_detection_classes(detection_classes: str) -> List[str]:
    """
    검출 클래스 문자열을 리스트로 변환하는 함수
    (원본 프로젝트의 process_video 함수 로직 참고)
    
    Args:
        detection_classes: 줄바꿈으로 구분된 검출 클래스 문자열
    
    Returns:
        검출 클래스 리스트 (공백 제거, 빈 문자열 제외)
    
    Raises:
        ValueError: 검출 클래스가 없거나 비어있는 경우
    """
    if not detection_classes:
        raise ValueError("검출 클래스를 지정해야 합니다.")
    
    # 줄바꿈으로 구분된 클래스들을 리스트로 변환
    classes = [cls.strip() for cls in detection_classes.split('\n') if cls.strip()]
    
    if not classes:
        raise ValueError("최소 1개 이상의 검출 클래스를 지정해야 합니다.")
    
    return classes

def normalize_path_for_uri(file_path: str) -> str:
    """
    파일 경로를 리눅스 스타일로 정규화하여 file:// URI에 사용할 수 있도록 변환
    
    Args:
        file_path: 파일 경로 (Windows 또는 Linux 스타일)
    
    Returns:
        리눅스 스타일 경로 (슬래시로 구분)
    
    Examples:
        normalize_path_for_uri("\\tmp\\alert-media-dir\\file.mp4") -> "/tmp/alert-media-dir/file.mp4"
        normalize_path_for_uri("/tmp/alert-media-dir/file.mp4") -> "/tmp/alert-media-dir/file.mp4"
    """
    # Path 객체인 경우 as_posix()를 사용하여 리눅스 스타일로 변환
    if isinstance(file_path, Path):
        return file_path.as_posix()
    
    # 문자열인 경우 Path 객체로 변환 후 as_posix() 사용
    # 이렇게 하면 Windows 경로도 자동으로 리눅스 스타일로 변환됨
    # as_posix()는 백슬래시를 슬래시로 변환하고, Windows 드라이브 경로도 처리함
    normalized = Path(file_path).as_posix()
    
    return normalized

def parse_rois(rois_input: Optional[str], enable_rois: bool = False, frame_width: int = 1920, frame_height: int = 1080) -> List[List[int]]:
    """
    ROI 문자열을 리스트로 변환하는 함수
    (원본 프로젝트의 process_video 함수 로직 참고)
    
    Args:
        rois_input: ROI 입력 문자열 (줄바꿈으로 구분된 "x1,y1,x2,y2" 형식)
        enable_rois: ROI 사용 여부
        frame_width: 비디오 프레임 너비 (기본값: 1920)
        frame_height: 비디오 프레임 높이 (기본값: 1080)
    
    Returns:
        ROI 리스트: [[]] 또는 [[x1, y1, x2, y2]]
    """
    if not enable_rois or not rois_input:
        return [[]]
    
    try:
        # 줄바꿈으로 구분된 ROI들을 리스트로 변환
        rois = [roi.strip() for roi in rois_input.split("\n") if roi.strip()]
        if not rois:
            return [[]]
        
        # 각 ROI를 좌표 리스트로 변환: "x1,y1,x2,y2" -> [x1, y1, x2, y2]
        rois = [[int(coord) for coord in roi.split(",")] for roi in rois]
        
        # 첫 번째 ROI만 사용하고 해상도에 맞게 스케일링 (원본 프로젝트 로직)
        if rois and len(rois[0]) == 4:
            original_roi = rois[0]
            scaled_roi = [
                int(original_roi[0] * 1920 / frame_width),
                int(original_roi[1] * 1080 / frame_height),
                int(original_roi[2] * 1920 / frame_width),
                int(original_roi[3] * 1080 / frame_height),
            ]
            logger.info(f"ROI 변환 완료: 원본={original_roi}, 스케일링={scaled_roi} (해상도: {frame_width}x{frame_height})")
            return [scaled_roi]
        else:
            logger.warning(f"ROI 형식이 올바르지 않습니다: {rois}")
            return [[]]
    except Exception as e:
        logger.error(f"ROI 파싱 중 오류: {e}", exc_info=True)
        return [[]]

def prepare_video_for_processing(
    video_input_path: str,
    video_input_source: str = "Video File",
    temp_dir: Optional[Path] = None
) -> tuple[str, Path]:
    """
    동영상 전처리: 임시 디렉토리 생성 및 파일 복사
    (원본 프로젝트의 process_video 함수 로직 참고)
    
    Args:
        video_input_path: 입력 비디오 경로
        video_input_source: 비디오 입력 소스 ("Video File" 또는 "RTSP Stream")
        temp_dir: 임시 디렉토리 경로 (None이면 자동 생성)
    
    Returns:
        (처리할 비디오 경로, 임시 디렉토리 경로)
    """
    import tempfile
    
    # 임시 디렉토리 생성
    if temp_dir is None:
        temp_dir = Path(tempfile.mkdtemp())
    else:
        temp_dir = Path(temp_dir)
        temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Video File인 경우 임시 디렉토리로 복사
    if video_input_source == "Video File":
        video_temp_path = temp_dir / "input_video.mp4"
        try:
            # 원본 파일이 존재하는지 확인
            if os.path.exists(video_input_path):
                shutil.copy2(video_input_path, video_temp_path)
                logger.info(f"비디오 파일 복사 완료: {video_input_path} -> {video_temp_path}")
                return str(video_temp_path), temp_dir
            else:
                logger.warning(f"비디오 파일이 존재하지 않습니다: {video_input_path}")
                return video_input_path, temp_dir
        except Exception as e:
            logger.error(f"비디오 파일 복사 실패: {e}", exc_info=True)
            return video_input_path, temp_dir
    else:
        # RTSP Stream 등 다른 소스는 그대로 사용
        return video_input_path, temp_dir

def detection_classes_to_prompt(detection_classes: str) -> str:
    """
    검출 클래스 문자열을 GDINO 프롬프트 형식으로 변환
    (원본 프로젝트의 process_video 함수 로직 참고)
    
    Args:
        detection_classes: 줄바꿈으로 구분된 검출 클래스 문자열
    
    Returns:
        ' . '로 연결된 프롬프트 문자열
    """
    if not detection_classes:
        return ""
    # 줄바꿈으로 구분된 클래스들을 ' . '로 연결 (가이드 규칙)
    classes = [cls.strip() for cls in detection_classes.split('\n') if cls.strip()]
    if not classes:
        return ""
    # 가이드 형식: "person . knife . car ." (마지막에 ' . ' 포함)
    return ' . '.join(classes) + ' .'

class FastSearchRequest(BaseModel):
    """고속 검색 요청 모델"""
    user_id: str
    video_ids: List[str]  # 선택된 동영상 ID 목록 (VIA 서버의 video_id)
    detection_classes: str  # 검출할 객체 클래스 (줄바꿈으로 구분)
    box_threshold: float = 0.5  # 박스 검출 임계값
    min_clip_duration: float = 1.0  # 최소 클립 길이 (초)
    max_clip_duration: float = 30.0  # 최대 클립 길이 (초)
    frame_skip_interval: int = 5  # 프레임 스킵 간격
    minimum_detection_threshold: int = 1  # 최소 검출 임계값 (검출 횟수)
    gdino_rois: Optional[List[List[int]]] = None  # ROI 영역 (선택사항)

@router.post("/fast-search")
async def fast_search(request: FastSearchRequest):
    """
    고속 검색: CV Event Detector를 사용하여 선택된 동영상들에서 객체 검출 수행
    검출 결과를 필터링하여 클립 생성 및 반환
    """
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
    
    # ==================== 동영상 전처리 (원본 프로젝트의 process_video 함수 로직 참고) ====================
    
    # 1. 검출 클래스 검증 및 파싱 (원본: gdino_classes 파싱)
    try:
        detection_classes_list = parse_detection_classes(request.detection_classes)
        logger.info(f"검출 클래스 파싱 완료: {len(detection_classes_list)}개 클래스 - {detection_classes_list}")
    except ValueError as e:
        logger.error(f"검출 클래스 검증 실패: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    # 2. ROI 처리 (원본: gdino_rois 파싱)
    # 현재는 request.gdino_rois가 이미 리스트 형식으로 전달되므로 추가 파싱 불필요
    # 필요시 parse_rois 함수 사용 가능 (문자열 입력인 경우)
    processed_rois = request.gdino_rois if request.gdino_rois is not None else [[]]
    logger.info(f"ROI 설정: {processed_rois}")
    
    # 3. 출력 폴더 준비 (원본: output_clips_folder 생성)
    # CLIPS_DIR은 이미 생성됨
    
    session = await get_session()
    pipeline_id = None
    stream_ids = []
    grouped_clips = []
    temp_dirs = []  # 임시 디렉토리 추적 (정리용)
    downloaded_files = []  # 다운로드한 파일 추적 (정리용)
    failed_videos = []  # 실패한 동영상 정보 수집
    processed_clips_global = set()  # 전역 클립 중복 체크용
    
    try:
        # 1. CV 파이프라인 생성
        logger.info(f"고속 검색 시작: {len(request.video_ids)}개 동영상, 검출 클래스: {detection_classes_list}")
        logger.info(f"CV Event Detector API URL: {CV_EVENT_DETECTOR_API_URL}")
        
        # 원본 클래스 정의에 따르면 PipelineParams의 모든 필드는 int 타입이어야 함
        # min_clip_duration과 max_clip_duration을 int로 변환
        pipeline_payload = {
            "name": "Object Detection Pipeline",
            "type": "object_detection",
            "params": {
                "min_clip_duration": int(request.min_clip_duration),  # 원본: int 타입
                "max_clip_duration": int(request.max_clip_duration),  # 원본: int 타입
                "frame_skip_interval": int(request.frame_skip_interval),  # 원본: int 타입
                "minimum_detection_threshold": int(request.minimum_detection_threshold)  # 원본: int 타입
            }
        }
        
        pipeline_url = f"{CV_EVENT_DETECTOR_API_URL}/api/pipeline"
        logger.info(f"파이프라인 생성 요청 URL: {pipeline_url}, Payload: {json.dumps(pipeline_payload, indent=2)}")
        
        try:
            async with session.post(
                pipeline_url,
                json=pipeline_payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status >= 400:
                    error_text = await response.text()
                    logger.error(f"파이프라인 생성 실패: HTTP {response.status}, URL: {pipeline_url}, Error: {error_text}")
                    raise HTTPException(
                        status_code=500, 
                        detail=f"CV Event Detector API 연결 실패 (HTTP {response.status}): {error_text}. CV Event Detector 서버가 실행 중인지 확인하세요."
                    )
                pipeline_result = await response.json()
                pipeline_id = pipeline_result.get("id")
                if not pipeline_id:
                    logger.error(f"파이프라인 응답에 ID가 없습니다: {pipeline_result}")
                    raise HTTPException(status_code=500, detail="파이프라인 ID를 받지 못했습니다.")
                logger.info(f"파이프라인 생성 완료: pipeline_id={pipeline_id}")
        except aiohttp.ClientConnectorError as e:
            logger.error(f"CV Event Detector 서버에 연결할 수 없습니다: {e}, URL: {pipeline_url}")
            raise HTTPException(
                status_code=503,
                detail=f"CV Event Detector 서버에 연결할 수 없습니다 ({CV_EVENT_DETECTOR_API_URL}). 서버가 실행 중인지 확인하세요."
            )
        except aiohttp.ClientError as e:
            logger.error(f"CV Event Detector API 요청 중 오류 발생: {e}, URL: {pipeline_url}")
            raise HTTPException(
                status_code=500,
                detail=f"CV Event Detector API 요청 중 오류가 발생했습니다: {str(e)}"
            )
        
        # 2. 각 동영상에 대해 스트림 추가
        # 검출 클래스를 GDINO 프롬프트 형식으로 변환 (원본 프로젝트 로직)
        gdino_prompt = detection_classes_to_prompt(request.detection_classes)
        logger.info(f"GDINO 프롬프트: {gdino_prompt}")
        
        for video_id in request.video_ids:
            try:
                # VIA 서버에서 동영상 파일 경로 가져오기
                # video_id가 VIA 서버의 file_id인 경우, 파일 정보 조회
                via_file_info = None
                try:
                    async with session.get(
                        f"{VIA_SERVER_URL}/files/{video_id}",
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as file_resp:
                        if file_resp.status == 200:
                            via_file_info = await file_resp.json()
                except Exception as e:
                    logger.warning(f"VIA 파일 정보 조회 실패 (video_id={video_id}): {e}")
                
                # 스트림 URL 생성 (가이드 참고: file:// 접두사 필요)
                # 중요: 컨테이너에서 접근 가능한 경로여야 함
                # 문제 원인: HTTP URL을 전달하면 cveventrecorder()가 file://http://... 형태로 변환하여 실패
                # 해결: VIA 서버의 실제 파일 경로(path)를 우선 사용하여 file:///... 형태로 전달
                
                stream_url = None
                stream_url_source = None
                
                # 우선순위 1: VIA 서버의 실제 파일 경로(path) 사용 (권장)
                # cveventrecorder()는 rtsp:// 또는 file://로 시작하지 않으면 강제로 file://를 붙여서 로컬 파일로 처리
                # 따라서 HTTP URL 대신 실제 파일 경로를 file:///... 형태로 전달해야 함
                # 중요: GStreamer는 리눅스 스타일 경로(슬래시)를 요구하므로 백슬래시를 슬래시로 변환
                if via_file_info and via_file_info.get("path"):
                    file_path = via_file_info.get("path")
                    # 경로가 이미 절대 경로인지 확인
                    if os.path.isabs(file_path):
                        # 절대 경로: 리눅스 스타일로 정규화 후 file:///... 형태로 변환
                        normalized_path = normalize_path_for_uri(file_path)
                        stream_url = f"file://{normalized_path}"
                        stream_url_source = "VIA_FILE_PATH"
                        logger.info(
                            f"VIA 서버 파일 경로 사용 (video_id={video_id}):\n"
                            f"  - 파일 경로: {file_path}\n"
                            f"  - stream_url: {stream_url}\n"
                            f"  - 출처: {stream_url_source}\n"
                            f"⚠️ 이 경로가 CV Event Detector 컨테이너에서 접근 가능한지 확인하세요.\n"
                            f"컨테이너 마운트 경로: /tmp, /tmp/alert-media-dir\n"
                            f"확인 방법: docker exec -it <container> ls -al {file_path}"
                        )
                    else:
                        # 상대 경로인 경우 절대 경로로 변환 시도
                        logger.warning(f"VIA 서버에서 상대 경로 반환 (video_id={video_id}): {file_path}, 절대 경로로 변환 시도")
                        # 상대 경로는 사용하지 않고 다음 우선순위로 진행
                        file_path = None
                
                # 우선순위 2: VIA 서버의 url 필드 확인 (HTTP URL이 아닌 실제 경로인 경우)
                if not stream_url and via_file_info and via_file_info.get("url"):
                    original_url = via_file_info.get("url")
                    # 로컬 파일 경로인 경우 file:// 접두사 추가
                    # 중요: GStreamer는 리눅스 스타일 경로(슬래시)를 요구하므로 백슬래시를 슬래시로 변환
                    if original_url.startswith("/"):
                        normalized_path = normalize_path_for_uri(original_url)
                        stream_url = f"file://{normalized_path}"
                        stream_url_source = "VIA_URL_LOCAL_PATH"
                        logger.info(
                            f"VIA 서버 URL 필드의 로컬 경로 사용 (video_id={video_id}):\n"
                            f"  - 파일 경로: {original_url}\n"
                            f"  - stream_url: {stream_url}\n"
                            f"⚠️ 이 경로가 CV Event Detector 컨테이너에서 접근 가능한지 확인하세요."
                        )
                    # 이미 file:// 또는 rtsp://로 시작하는 경우
                    elif original_url.startswith("file://") or original_url.startswith("rtsp://"):
                        stream_url = original_url
                        stream_url_source = "VIA_DIRECT_URI"
                    # HTTP/HTTPS URL인 경우는 사용하지 않음 (cveventrecorder()가 처리하지 못함)
                    elif original_url.startswith("http://") or original_url.startswith("https://"):
                        logger.warning(
                            f"VIA 서버가 HTTP URL을 반환했습니다 (video_id={video_id}): {original_url}\n"
                            f"⚠️ HTTP URL은 cveventrecorder()가 처리하지 못합니다 (file://http://... 형태로 변환되어 실패).\n"
                            f"실제 파일 경로(path)를 사용하거나, 파일을 컨테이너에서 접근 가능한 경로로 복사해야 합니다."
                        )
                        # HTTP URL은 사용하지 않고 다음 우선순위로 진행
                
                # 우선순위 3: 파일명이 있지만 경로 정보가 없는 경우
                # VIA 서버의 /files/{id}/content 엔드포인트로 파일을 다운로드하여 로컬에 저장
                # 저장 경로: /tmp 또는 /tmp/alert-media-dir (컨테이너에서 접근 가능)
                if not stream_url:
                    if via_file_info and via_file_info.get("filename"):
                        filename = via_file_info.get("filename")
                        logger.info(
                            f"VIA 서버에서 파일 경로 정보를 찾을 수 없습니다 (video_id={video_id}):\n"
                            f"  - filename: {filename}\n"
                            f"  - path: {via_file_info.get('path', '없음')}\n"
                            f"  - url: {via_file_info.get('url', '없음')}\n"
                            f"파일을 다운로드하여 로컬에 저장합니다..."
                        )
                        
                        # 파일 다운로드 및 저장
                        try:
                            # /files/{id}/content 엔드포인트로 파일 다운로드
                            async with session.get(
                                f"{VIA_SERVER_URL}/files/{video_id}/content",
                                timeout=aiohttp.ClientTimeout(total=300)  # 5분 타임아웃 (대용량 파일 대비)
                            ) as content_resp:
                                if content_resp.status != 200:
                                    error_text = await content_resp.text()
                                    logger.error(f"VIA 파일 다운로드 실패 (video_id={video_id}): HTTP {content_resp.status}, {error_text}")
                                    raise HTTPException(
                                        status_code=500,
                                        detail=f"VIA 서버에서 파일 다운로드 실패 (video_id={video_id}): HTTP {content_resp.status}"
                                    )
                                
                                # 저장 경로 결정: /tmp/alert-media-dir 우선, 없으면 /tmp
                                # FILTERED_CLIP_PATH가 설정되어 있으면 사용, 없으면 /tmp 사용
                                download_dir = Path(FILTERED_CLIP_PATH) if FILTERED_CLIP_PATH else Path("/tmp")
                                download_dir.mkdir(parents=True, exist_ok=True)
                                
                                # 파일명에서 확장자 추출 (없으면 .mp4 기본값)
                                file_ext = os.path.splitext(filename)[1] or ".mp4"
                                # video_id를 포함한 고유한 파일명 생성 (중복 방지)
                                local_filename = f"{video_id}_{filename}" if filename else f"{video_id}{file_ext}"
                                local_file_path = download_dir / local_filename
                                
                                # 파일 다운로드 및 저장
                                async with aiofiles.open(local_file_path, 'wb') as f:
                                    async for chunk in content_resp.content.iter_chunked(8192):
                                        await f.write(chunk)
                                
                                # 저장된 파일 경로를 file:// 형태로 변환
                                # 중요: GStreamer는 리눅스 스타일 경로(슬래시)를 요구하므로 백슬래시를 슬래시로 변환
                                # Path 객체를 리눅스 스타일 경로로 변환 (as_posix() 사용)
                                normalized_path = local_file_path.as_posix() if isinstance(local_file_path, Path) else normalize_path_for_uri(str(local_file_path))
                                stream_url = f"file://{normalized_path}"
                                stream_url_source = "VIA_DOWNLOADED_FILE"
                                
                                logger.info(
                                    f"VIA 파일 다운로드 완료 (video_id={video_id}):\n"
                                    f"  - 원본 파일명: {filename}\n"
                                    f"  - 저장 경로: {local_file_path}\n"
                                    f"  - stream_url: {stream_url}\n"
                                    f"  - 출처: {stream_url_source}\n"
                                    f"✅ 파일이 컨테이너에서 접근 가능한 경로에 저장되었습니다."
                                )
                                
                                # 다운로드한 파일 경로를 downloaded_files에 추가하여 나중에 정리
                                downloaded_files.append(local_file_path)
                                
                        except aiohttp.ClientError as e:
                            logger.error(f"VIA 파일 다운로드 중 네트워크 오류 (video_id={video_id}): {e}")
                            raise HTTPException(
                                status_code=500,
                                detail=f"VIA 서버에서 파일 다운로드 중 네트워크 오류 발생 (video_id={video_id}): {str(e)}"
                            )
                        except Exception as e:
                            logger.error(f"VIA 파일 다운로드 중 오류 (video_id={video_id}): {e}", exc_info=True)
                            raise HTTPException(
                                status_code=500,
                                detail=f"VIA 서버에서 파일 다운로드 중 오류 발생 (video_id={video_id}): {str(e)}"
                            )
                    else:
                        # VIA 서버 정보가 전혀 없는 경우
                        logger.error(f"VIA 서버에서 파일 정보를 찾을 수 없습니다 (video_id={video_id})")
                        raise HTTPException(
                            status_code=400,
                            detail=f"VIA 서버에서 파일 정보를 찾을 수 없습니다 (video_id={video_id}). "
                                   f"파일이 존재하는지 확인하세요."
                        )
                
                # stream_url 검증
                if not stream_url:
                    logger.error(f"스트림 URL을 생성할 수 없습니다 (video_id={video_id})")
                    raise HTTPException(
                        status_code=400,
                        detail=f"스트림 URL을 생성할 수 없습니다 (video_id={video_id}). VIA 서버에서 파일 정보를 확인할 수 없습니다."
                    )
                
                # 로컬 파일 경로인 경우 추가 경고
                if stream_url.startswith("file://"):
                    file_path = stream_url.replace("file://", "")
                    logger.warning(
                        f"로컬 파일 경로 사용 감지 (video_id={video_id}):\n"
                        f"  - 파일 경로: {file_path}\n"
                        f"  - stream_url: {stream_url}\n"
                        f"  - 출처: {stream_url_source}\n"
                        f"⚠️ 이 경로가 CV Event Detector 컨테이너에서 접근 가능한지 확인하세요.\n"
                        f"컨테이너에서 파일이 없으면 파이프라인이 PLAYING 상태로 올라가지 못합니다.\n"
                        f"확인 방법: docker exec -it <container> ls -al {file_path}"
                    )
                
                logger.info(
                    f"스트림 URL 생성 완료 (video_id={video_id}):\n"
                    f"  - stream_url: {stream_url}\n"
                    f"  - 출처: {stream_url_source}\n"
                    f"  - via_file_info: {via_file_info}"
                )
                
                # 스트림 이름 생성
                stream_name = via_file_info.get("filename", f"video_{video_id}") if via_file_info else f"video_{video_id}"
                
                # sensor_id 추출 (원본 클래스 정의: Optional[str])
                # stream_url에서 sensor_id 추출 (원본 프로젝트 로직 참고)
                sensor_id = extract_sensor_id(stream_name, stream_url)
                
                # 스트림 추가 요청
                # gdino_rois는 전처리에서 이미 처리됨
                gdino_rois = processed_rois
                
                # UTC 시간대를 포함한 ISO 8601 형식의 timestamp 생성
                # 원본 클래스 정의: "2025-07-21T12:00:00.000Z" 형식
                timestamp_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                
                # 스트림 추가 요청 페이로드 (원본 클래스 정의: AddStreamRequest 참고)
                add_stream_payload = {
                    "version": "1.0",  # 원본: str, 필수
                    "timestamp": timestamp_iso,  # 원본: Optional[str], ISO 8601 형식
                    "stream_url": stream_url,  # 원본: str, 필수 (file:///path/to/video.mp4 또는 rtsp://...)
                    "pipeline_id": pipeline_id,  # 원본: str, 필수
                    "output_folder": str(CLIPS_DIR.resolve()),  # 원본: Optional[str]
                    "sensor_id": sensor_id,  # 원본: Optional[str] - 추가
                    "stream_name": stream_name,  # 원본: Optional[str]
                    # processing_state는 Optional이므로 생략 (기본값: "enabled"로 처리됨)
                    "cv_params": {  # 원본: Optional[CVParams]
                        "gdinoprompt": gdino_prompt,  # 가이드: "person . knife . car ." 형식
                        "gdinothreshold": request.box_threshold,
                        "overlay": True,
                        "gdino_rois": gdino_rois  # 가이드: [[]] 또는 [[x1, y1, x2, y2]]
                    }
                }
                
                # 스트림 등록 API 호출 (가이드: POST /api/addstream)
                # 중요: stream_url이 컨테이너에서 접근 가능해야 파이프라인이 PLAYING 상태로 올라감
                # 문제 원인: 호스트 경로를 컨테이너에서 접근하려고 하면 파이프라인이 PLAYING 상태로 올라가지 못함
                logger.info(f"스트림 추가 요청 (video_id={video_id}): stream_url={stream_url}")
                
                async with session.post(
                    f"{CV_EVENT_DETECTOR_API_URL}/api/addstream",
                    json=add_stream_payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as add_resp:
                    if add_resp.status >= 400:
                        error_text = await add_resp.text()
                        logger.error(
                            f"스트림 추가 실패 (video_id={video_id}):\n"
                            f"  - HTTP 상태: {add_resp.status}\n"
                            f"  - stream_url: {stream_url}\n"
                            f"  - 에러: {error_text}\n"
                            f"⚠️ 가능한 원인:\n"
                            f"  1. stream_url이 컨테이너에서 접근 불가능\n"
                            f"  2. 잘못된 stream_url 형식 (로컬 파일은 file:// 접두사 필요)\n"
                            f"  3. 파일이 존재하지 않음\n"
                            f"확인 방법: docker exec -it <container> ls -al <file_path>"
                        )
                        # 실패한 동영상 정보 수집
                        error_message = f"스트림 추가 실패: {error_text}"
                        failed_videos.append({
                            "video_id": video_id,
                            "stream_name": stream_name,
                            "error": error_message,
                            "stream_url": stream_url
                        })
                        continue
                    
                    add_result = await add_resp.json()
                    stream_id = add_result.get("stream_id")
                    
                    if not stream_id:
                        error_message = "스트림 ID를 받지 못했습니다"
                        logger.warning(f"스트림 ID를 받지 못했습니다 (video_id={video_id})")
                        # 실패한 동영상 정보 수집
                        failed_videos.append({
                            "video_id": video_id,
                            "stream_name": stream_name,
                            "error": error_message,
                            "stream_url": stream_url
                        })
                        continue
                    
                    stream_ids.append({
                        "stream_id": stream_id,
                        "video_id": video_id,
                        "stream_name": stream_name,
                        "stream_url": stream_url  # sensor_id 추출용
                    })
                    logger.info(f"스트림 추가 완료: stream_id={stream_id}, video_id={video_id}")
                    
                    # 3. 스트림 상태 확인 (202 응답인 경우 폴링)
                    if add_resp.status == 202:
                        # 비동기로 상태 확인 시작 (별도 태스크로 실행)
                        logger.info(f"스트림 준비 중 (stream_id={stream_id}), 상태 확인 시작")
            
            except Exception as e:
                error_message = f"동영상 처리 중 오류: {str(e)}"
                logger.error(f"동영상 처리 중 오류 (video_id={video_id}): {e}", exc_info=True)
                # 실패한 동영상 정보 수집
                stream_name = via_file_info.get("filename", f"video_{video_id}") if via_file_info else f"video_{video_id}"
                failed_videos.append({
                    "video_id": video_id,
                    "stream_name": stream_name,
                    "error": error_message,
                    "stream_url": stream_url if 'stream_url' in locals() else None
                })
                continue
        
        if not stream_ids:
            raise HTTPException(status_code=500, detail="스트림을 추가하지 못했습니다.")
        
        # 4. 모든 스트림의 상태 확인 및 검출 결과 수집
        logger.info(f"{len(stream_ids)}개 스트림의 검출 결과 수집 시작")
        
        # 동영상 길이 추정을 위한 기본 타임아웃 계산 (동영상당 최대 10분 + 여유시간)
        base_timeout_per_video = 600  # 10분
        estimated_timeout = min(base_timeout_per_video * len(stream_ids), 3600)  # 최대 1시간
        
        for stream_info in stream_ids:
            stream_id = stream_info["stream_id"]
            video_id = stream_info["video_id"]
            stream_name = stream_info["stream_name"]
            stream_url = stream_info.get("stream_url", "")  # stream_url 가져오기
            video_clips = []
            processed_clips = set()  # 스트림별 처리된 클립 추적
            
            try:
                # 스트림 상태 폴링 (완료될 때까지)
                # 동적 타임아웃: 동영상 개수에 따라 조정 (최대 1시간)
                max_polling_time = estimated_timeout
                polling_start = time.time()
                status_checked = False
                last_clip_check = time.time()  # 마지막 클립 폴더 확인 시간
                clip_check_interval = 2.0  # 클립 폴더 확인 간격 (초)
                
                while time.time() - polling_start < max_polling_time:
                    # 클립 폴더 모니터링 (원본 프로젝트의 monitor_output_clips 로직)
                    current_time = time.time()
                    if current_time - last_clip_check >= clip_check_interval:
                        try:
                            new_clips = await monitor_clips_folder(
                                CLIPS_DIR,
                                processed_clips,
                                stream_name,
                                request.detection_classes,
                                session=session,
                                video_input_path=stream_url,  # 스트림 URL을 video_input_path로 전달
                                alert_prompts=None,  # TODO: FastSearchRequest에 alert_prompts 추가 필요
                                system_prompt=None,  # TODO: FastSearchRequest에 system_prompt 추가 필요
                                enable_reasoning=False,  # TODO: FastSearchRequest에 enable_reasoning 추가 필요
                                do_verification=True  # TODO: FastSearchRequest에 do_verification 추가 필요
                            )
                            # 새로 발견된 클립 추가
                            for clip_info in new_clips:
                                # 강화된 중복 체크: URL, 파일 경로, 메타데이터 모두 확인
                                clip_url = clip_info.get("url")
                                clip_title = clip_info.get("title")
                                clip_start = clip_info.get("start_time")
                                clip_end = clip_info.get("end_time")
                                
                                # 전역 중복 체크 (다른 스트림과의 중복 방지)
                                clip_key = f"{clip_url}_{clip_start}_{clip_end}"
                                if clip_key in processed_clips_global:
                                    logger.debug(f"전역 중복 클립 건너뛰기: {clip_title}")
                                    continue
                                
                                # 스트림별 중복 체크
                                clip_exists = any(
                                    (c.get("url") == clip_url and 
                                     c.get("start_time") == clip_start and 
                                     c.get("end_time") == clip_end)
                                    for c in video_clips
                                )
                                if not clip_exists:
                                    processed_clips_global.add(clip_key)
                                    video_clips.append(clip_info)
                                    logger.info(f"실시간 클립 발견: {clip_title} (stream_id={stream_id}, start={clip_start}, end={clip_end})")
                        except Exception as e:
                            logger.warning(f"클립 폴더 모니터링 중 오류 (stream_id={stream_id}): {e}")
                        
                        last_clip_check = current_time
                    
                    # 스트림 상태 확인 API 호출 (가이드: GET /api/streams/{stream_id}/status)
                    async with session.get(
                        f"{CV_EVENT_DETECTOR_API_URL}/api/streams/{stream_id}/status",
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as status_resp:
                        if status_resp.status >= 400:
                            error_text = await status_resp.text()
                            logger.error(f"스트림 상태 확인 실패 (stream_id={stream_id}): HTTP {status_resp.status}, {error_text}")
                            # 상태 확인 실패해도 수집된 클립은 유지
                            # 폴링 종료하되 수집된 클립은 반환
                            status_checked = True
                            break
                        
                        status_result = await status_resp.json()
                        status = status_result.get("status", "")
                        
                        if status == "completed":
                            # 검출 완료: 이벤트 클립 수집
                            events = status_result.get("events")
                            # events가 None이거나 리스트가 아닌 경우 빈 리스트로 처리
                            if events is None:
                                events = []
                            elif not isinstance(events, list):
                                logger.warning(f"events가 리스트가 아닙니다 (stream_id={stream_id}): {type(events)}")
                                events = []
                            logger.info(f"스트림 완료 (stream_id={stream_id}): {len(events)}개 이벤트 검출")
                            logger.debug(f"이벤트 상세 정보: {json.dumps(status_result, indent=2, default=str)}")
                            
                            # 이벤트에서 클립 정보 추출
                            for event_idx, event in enumerate(events):
                                try:
                                    # 이벤트에서 클립 정보 추출
                                    clip_path = event.get("clip")
                                    event_type = event.get("event_type", "object_detection")
                                    metadata = event.get("metadata", {})
                                    start_time = metadata.get("start_time")
                                    end_time = metadata.get("end_time")
                                    
                                    logger.debug(f"이벤트 {event_idx}: clip_path={clip_path}, event_type={event_type}, metadata={metadata}")
                                    
                                    if clip_path:
                                        # 클립 파일 경로 처리 (다양한 형식 지원)
                                        actual_clip_path = None
                                        
                                        # 1. 절대 경로인 경우 그대로 사용
                                        if os.path.isabs(clip_path):
                                            actual_clip_path = clip_path
                                        # 2. 상대 경로인 경우 CLIPS_DIR 기준으로 변환
                                        else:
                                            # 파일명만 있는 경우
                                            if os.path.basename(clip_path) == clip_path:
                                                actual_clip_path = str(CLIPS_DIR / clip_path)
                                            # 상대 경로인 경우
                                            else:
                                                # CLIPS_DIR 기준으로 해석
                                                actual_clip_path = str(CLIPS_DIR / clip_path.lstrip('/'))
                                        
                                        # 클립 파일이 존재하는지 확인
                                        if actual_clip_path and os.path.exists(actual_clip_path):
                                            clip_filename = os.path.basename(actual_clip_path)
                                            # 클립 URL 생성 (FastAPI 정적 파일 서빙 경로 사용)
                                            clip_url = f"/clips/{clip_filename}"
                                            
                                            # 강화된 중복 체크
                                            clip_key = f"{clip_url}_{start_time}_{end_time}"
                                            if clip_key in processed_clips_global:
                                                logger.debug(f"중복 클립 건너뛰기: {clip_filename} (start={start_time}, end={end_time})")
                                                continue
                                            
                                            # 스트림별 중복 체크
                                            clip_exists = any(
                                                (c.get("url") == clip_url and 
                                                 c.get("start_time") == start_time and 
                                                 c.get("end_time") == end_time)
                                                for c in video_clips
                                            )
                                            if not clip_exists:
                                                processed_clips_global.add(clip_key)
                                                video_clips.append({
                                                    "id": f"{stream_id}_{event_idx}",
                                                    "title": clip_filename,
                                                    "url": clip_url,
                                                    "start_time": start_time,
                                                    "end_time": end_time,
                                                    "search_query": request.detection_classes,
                                                    "sentence": event_type or "객체 검출",
                                                    "event_type": event_type,
                                                    "metadata": metadata
                                                })
                                                logger.info(f"클립 추가 성공: {clip_filename} (경로: {actual_clip_path}, start={start_time}, end={end_time})")
                                        else:
                                            # 파일을 찾지 못한 경우, CLIPS_DIR에서 파일명으로 검색
                                            clip_filename_only = os.path.basename(clip_path)
                                            search_path = CLIPS_DIR / clip_filename_only
                                            
                                            if search_path.exists():
                                                clip_url = f"/clips/{clip_filename_only}"
                                                
                                                # 강화된 중복 체크
                                                clip_key = f"{clip_url}_{start_time}_{end_time}"
                                                if clip_key in processed_clips_global:
                                                    logger.debug(f"중복 클립 건너뛰기: {clip_filename_only} (start={start_time}, end={end_time})")
                                                    continue
                                                
                                                # 스트림별 중복 체크
                                                clip_exists = any(
                                                    (c.get("url") == clip_url and 
                                                     c.get("start_time") == start_time and 
                                                     c.get("end_time") == end_time)
                                                    for c in video_clips
                                                )
                                                if not clip_exists:
                                                    processed_clips_global.add(clip_key)
                                                    video_clips.append({
                                                        "id": f"{stream_id}_{event_idx}",
                                                        "title": clip_filename_only,
                                                        "url": clip_url,
                                                        "start_time": start_time,
                                                        "end_time": end_time,
                                                        "search_query": request.detection_classes,
                                                        "sentence": event_type or "객체 검출",
                                                        "event_type": event_type,
                                                        "metadata": metadata
                                                    })
                                                    logger.info(f"클립 추가 성공 (파일명 검색): {clip_filename_only} (start={start_time}, end={end_time})")
                                            else:
                                                logger.warning(f"클립 파일을 찾을 수 없습니다: 원본 경로={clip_path}, 시도한 경로={actual_clip_path}, 검색 경로={search_path}")
                                                # CLIPS_DIR의 모든 파일 목록 로깅 (디버깅용)
                                                try:
                                                    clips_dir_files = list(CLIPS_DIR.glob("*"))
                                                    logger.debug(f"CLIPS_DIR ({CLIPS_DIR}) 내 파일 목록: {[f.name for f in clips_dir_files if f.is_file()]}")
                                                except Exception as e:
                                                    logger.debug(f"CLIPS_DIR 파일 목록 조회 실패: {e}")
                                    else:
                                        logger.warning(f"이벤트 {event_idx}에 clip_path가 없습니다. event={event}")
                                except Exception as e:
                                    logger.error(f"이벤트 처리 중 오류 (event_idx={event_idx}): {e}", exc_info=True)
                            else:
                                # 이벤트가 없는 경우에도 로그 출력
                                logger.info(f"이벤트가 없습니다 (stream_id={stream_id}). 클립 폴더 모니터링 결과를 확인합니다.")
                            
                            # 스트림 완료 처리 완료: 폴링 종료 (이벤트가 있어도 없어도 종료)
                            status_checked = True
                            logger.info(f"스트림 상태 확인 완료 (stream_id={stream_id}): 폴링 종료")
                            break
                            
                        elif status == "terminated" or status == "error":
                            # 스트림 종료 또는 오류: 원인 분석
                            error_details = status_result.get("error_details") or status_result.get("message", "")
                            logger.error(
                                f"스트림 종료 또는 오류 (stream_id={stream_id}):\n"
                                f"  - status: {status}\n"
                                f"  - stream_url: {stream_url}\n"
                                f"  - error_details: {error_details}\n"
                                f"⚠️ 가능한 원인:\n"
                                f"  1. stream_url이 컨테이너에서 접근 불가능 → 파이프라인 PLAYING 실패\n"
                                f"  2. 파일이 존재하지 않음\n"
                                f"  3. 잘못된 파일 형식\n"
                                f"확인 방법: docker exec -it <container> ls -al <file_path>"
                            )
                            # 스트림 종료 처리 완료: 폴링 종료
                            status_checked = True
                            break
                        elif status == "processing" or status_resp.status == 202:
                            # 처리 중: 계속 폴링
                            await asyncio.sleep(5)
                            continue
                        else:
                            # 알 수 없는 상태
                            logger.warning(f"알 수 없는 스트림 상태 (stream_id={stream_id}): status={status}")
                            await asyncio.sleep(5)
                
                if not status_checked:
                    logger.warning(f"스트림 상태 확인 시간 초과 (stream_id={stream_id})")
                
            except Exception as e:
                logger.error(f"스트림 상태 확인 중 오류 (stream_id={stream_id}): {e}", exc_info=True)
                # 오류 발생해도 수집된 클립은 유지
                # 실패한 동영상 정보 수집
                failed_videos.append({
                    "video_id": video_id,
                    "stream_name": stream_name,
                    "error": f"스트림 상태 확인 중 오류: {str(e)}",
                    "stream_url": stream_url
                })
            
            # 동영상별 클립 그룹 추가
            grouped_clips.append({
                "video": stream_name,
                "clips": video_clips
            })
        
        # 5. 스트림 제거
        for stream_info in stream_ids:
            stream_id = stream_info["stream_id"]
            try:
                async with session.delete(
                    f"{CV_EVENT_DETECTOR_API_URL}/api/stream",
                    json={"stream_id": stream_id, "version": "1.0"},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as del_resp:
                    if del_resp.status == 200:
                        logger.info(f"스트림 제거 완료: stream_id={stream_id}")
                    else:
                        logger.warning(f"스트림 제거 실패 (stream_id={stream_id}): HTTP {del_resp.status}")
            except Exception as e:
                logger.warning(f"스트림 제거 중 오류 (stream_id={stream_id}): {e}")
        
        # 6. 파이프라인 제거 (가이드: DELETE /api/pipeline)
        if pipeline_id:
            try:
                async with session.delete(
                    f"{CV_EVENT_DETECTOR_API_URL}/api/pipeline",
                    json={"id": pipeline_id, "cleanup_resources": True},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as del_resp:
                    if del_resp.status == 200:
                        logger.info(f"파이프라인 제거 완료: pipeline_id={pipeline_id}")
                    else:
                        logger.warning(f"파이프라인 제거 실패 (pipeline_id={pipeline_id}): HTTP {del_resp.status}")
            except Exception as e:
                logger.warning(f"파이프라인 제거 중 오류 (pipeline_id={pipeline_id}): {e}")
        
        # 7. 임시 디렉토리 및 다운로드 파일 정리
        # 다운로드한 파일 정리
        for downloaded_file in downloaded_files:
            try:
                if downloaded_file.exists():
                    downloaded_file.unlink()
                    logger.info(f"다운로드 파일 정리 완료: {downloaded_file}")
            except Exception as e:
                logger.warning(f"다운로드 파일 정리 실패 ({downloaded_file}): {e}")
        
        # 임시 디렉토리 정리 (원본 프로젝트 로직 참고)
        for temp_dir in temp_dirs:
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
                    logger.info(f"임시 디렉토리 정리 완료: {temp_dir}")
            except Exception as e:
                logger.warning(f"임시 디렉토리 정리 실패 ({temp_dir}): {e}")
        
        # 클립 추출 여부 확인
        clips_extracted = False
        for group in grouped_clips:
            for clip in group.get("clips", []):
                if clip.get("url"):
                    clips_extracted = True
                    break
            if clips_extracted:
                break
        
        # grouped_clips의 clips가 None인 경우를 처리
        total_clips = 0
        for g in grouped_clips:
            clips = g.get('clips', [])
            if clips is None:
                clips = []
            elif not isinstance(clips, list):
                clips = []
            total_clips += len(clips)
        logger.info(f"고속 검색 완료: {len(grouped_clips)}개 동영상, {total_clips}개 클립")
        
        # 실패한 동영상이 있으면 경고 로그
        if failed_videos:
            logger.warning(f"고속 검색 중 {len(failed_videos)}개 동영상 처리 실패:")
            for failed in failed_videos:
                logger.warning(f"  - {failed['stream_name']} (video_id={failed['video_id']}): {failed['error']}")
        
        return JSONResponse(content={
            "clips": grouped_clips,
            "clips_extracted": clips_extracted,
            "failed_videos": failed_videos if failed_videos else [],  # 실패한 동영상 정보 포함
            "summary": {
                "total_videos": len(request.video_ids),
                "successful_videos": len(grouped_clips),
                "failed_videos": len(failed_videos),
                "total_clips": total_clips
            }
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"고속 검색 실패: {e}", exc_info=True)
        
        # 에러 발생 시 정리 작업
        if stream_ids:
            for stream_info in stream_ids:
                try:
                    async with session.delete(
                        f"{CV_EVENT_DETECTOR_API_URL}/api/stream",
                        json={"stream_id": stream_info["stream_id"], "version": "1.0"},
                        timeout=aiohttp.ClientTimeout(total=10)
                    ):
                        pass
                except Exception as e:
                    logger.warning(f"스트림 정리 중 오류 (stream_id={stream_info['stream_id']}): {e}")
        
        if pipeline_id:
            try:
                async with session.delete(
                    f"{CV_EVENT_DETECTOR_API_URL}/api/pipeline",
                    json={"id": pipeline_id, "cleanup_resources": True},
                    timeout=aiohttp.ClientTimeout(total=10)
                ):
                    pass
            except Exception as e:
                logger.warning(f"파이프라인 정리 중 오류 (pipeline_id={pipeline_id}): {e}")
        
        # 다운로드한 파일 정리
        for downloaded_file in downloaded_files:
            try:
                if downloaded_file.exists():
                    downloaded_file.unlink()
                    logger.info(f"에러 발생 시 다운로드 파일 정리: {downloaded_file}")
            except Exception as e:
                logger.warning(f"다운로드 파일 정리 실패 ({downloaded_file}): {e}")
        
        raise HTTPException(status_code=500, detail=f"고속 검색 중 오류가 발생했습니다: {str(e)}")
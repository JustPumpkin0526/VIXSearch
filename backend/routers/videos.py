"""동영상 관련 라우터"""
import asyncio
import logging
import os
import time
import aiofiles
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException, Query, File, UploadFile, Form, BackgroundTasks, Request
from database.repositories.vss_videos_repo import VideoRepository
from app_config.settings import (
    BACKEND_DIR,
    VIDEOS_DIR,
    CONVERTED_VIDEOS_DIR,
    resolve_storage_file_path,
)
from utils.helpers import build_file_url
from utils.video_utils import convert_video_to_mp4, extract_video_metadata
from services.video_service import upload_to_via_server_background
from app_config.settings import UNSUPPORTED_VIDEO_FORMATS
from exceptions import NotFoundException, ValidationException, DatabaseException

from database.services.vss_videos_service import VSSVideoService


logger = logging.getLogger(__name__)

router = APIRouter()

# def _format_datetime(value):
#     if value is None:
#         return None
#     return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _stored_filename_from_video_file_url(file_url: Optional[str]) -> Optional[str]:
    """DB의 FILE_URL(/video-files/...) 또는 절대 URL에서 저장 파일명 추출."""
    if not file_url or not str(file_url).strip():
        return None
    u = str(file_url).strip().split("?")[0]
    if "/video-files/" in u:
        tail = u.split("/video-files/", 1)[-1].lstrip("/")
        name = os.path.basename(tail) if tail else None
        return name or None
    if u.startswith("http://") or u.startswith("https://"):
        path = (urlparse(u).path or "").split("?")[0]
        if "/video-files/" in path:
            tail = path.split("/video-files/", 1)[-1].lstrip("/")
            name = os.path.basename(tail) if tail else None
            return name or None
    name = os.path.basename(u.rstrip("/"))
    return name if name else None


def _paths_to_delete_for_video_row(file_path_str: Optional[str], file_url: Optional[str]) -> list[Path]:
    """
    업로드 원본·변환본 삭제 후보 경로 (FILE_PATH 누락/이전 backend 경로/재기동 후 해석 실패 대비).
    """
    candidates: list[Path] = []
    seen: set[str] = set()

    def push(p: Optional[Path]) -> None:
        if p is None:
            return
        try:
            key = str(p.resolve()).casefold()
        except OSError:
            key = str(p).casefold()
        if key not in seen:
            seen.add(key)
            candidates.append(p)

    if file_path_str and str(file_path_str).strip():
        raw = str(file_path_str).strip()
        resolved = resolve_storage_file_path(raw)
        if resolved:
            push(resolved)
        push(Path(raw))

    stored_name = _stored_filename_from_video_file_url(file_url)
    if stored_name:
        push(VIDEOS_DIR / stored_name)
        push(BACKEND_DIR / "videos" / stored_name)
        stem = Path(stored_name).stem
        push(CONVERTED_VIDEOS_DIR / f"{stem}_converted.mp4")
        push(CONVERTED_VIDEOS_DIR / f"{stem}.mp4")

    return candidates


# 허용된 동영상 확장자
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
# 허용된 이미지 확장자
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
# 모든 허용된 파일 확장자 (동영상 + 이미지)
ALLOWED_FILE_EXTENSIONS = ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS
FILE_BUFFER_SIZE = 8192  # 8KB 청크
        

@router.get("")
async def get_videos(
    request: Request,
    user_id: str = Query(...)
):
    try:
        return await VSSVideoService.get_videos(request, user_id, VIDEOS_DIR, CONVERTED_VIDEOS_DIR)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="동영상 목록 조회 중 오류가 발생했습니다."
        )

@router.delete("/{video_id}")
async def delete_video(
    video_id: int,
    user_id: str = Query(...)
):
    """동영상 삭제"""
    try:
        result = VSSVideoService.delete_video(video_id, user_id)
        return result
    except NotFoundException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"동영상 삭제 실패: {e}")
        raise DatabaseException(f"동영상 삭제 중 오류가 발생했습니다: {str(e)}")

@router.post("")
async def upload_video(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    """동영상 또는 이미지 파일을 서버에 업로드하고 DB에 저장"""
    try:
        return await VSSVideoService.upload_video(request, file, user_id)
    except (ValidationException, NotFoundException):
        raise
    except Exception as e:
        logger.error(f"파일 업로드 실패: {e}")
        raise DatabaseException(f"파일 업로드 중 오류가 발생했습니다: {str(e)}")
    except (ValidationException, NotFoundException):
        # 파일이 저장되었지만 검증 실패 시 파일 삭제
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except:
                pass
        raise
    except Exception as e:
        logger.error(f"파일 업로드 실패: {e}")
        # 파일이 저장되었지만 DB 저장 실패 시 파일 삭제
        if file_path and file_path.exists():
            try:
                file_path.unlink()
            except:
                pass
        raise DatabaseException(f"파일 업로드 중 오류가 발생했습니다: {str(e)}")

@router.get("/convert-video/{video_id}")
async def convert_video(
    request: Request,
    video_id: int,
    user_id: str = Query(...)
):
    """동영상을 MP4로 변환"""
    try:
        video = VideoRepository.get_by_id_and_user_session(video_id, user_id)
        if not video:
            raise NotFoundException("동영상", str(video_id))

        file_path_str = video.FILE_PATH
        _file_name = video.FILE_NAME
        file_url = video.FILE_URL

        resolved = resolve_storage_file_path(file_path_str)
        file_path = resolved if resolved else Path(file_path_str)
        
        if not file_path.exists():
            raise NotFoundException("동영상 파일", file_path_str)
        
        # 파일 확장자 확인
        file_ext = file_path.suffix.lower()
        if file_ext not in UNSUPPORTED_VIDEO_FORMATS:
            # 이미 지원하는 형식이면 원본 URL 반환
            return {
                "success": True,
                "converted_url": build_file_url(file_url, request),
                "message": "이미 지원하는 형식입니다."
            }
        
        # 변환된 파일 경로 생성
        base_name = file_path.stem
        converted_filename = f"{base_name}_converted.mp4"
        converted_file_path = CONVERTED_VIDEOS_DIR / converted_filename
        converted_url = f"/converted-videos/{converted_filename}"
        
        # 이미 변환된 파일이 있으면 반환
        if converted_file_path.exists():
            converted_file_url = build_file_url(converted_url, request)
            logger.info(f"변환된 파일이 이미 존재함: {converted_file_path}")
            logger.info(f"변환된 파일 URL: {converted_file_url}")
            return {
                "success": True,
                "converted_url": converted_file_url,
                "message": "변환된 동영상이 준비되었습니다."
            }
        
        # 동영상 변환 실행
        logger.info(f"동영상 변환 시작: {file_path} -> {converted_file_path}")
        try:
            success = convert_video_to_mp4(str(file_path), str(converted_file_path))
            
            if not success:
                raise DatabaseException("동영상 변환에 실패했습니다.")
            
            # 변환된 파일 존재 확인
            if not converted_file_path.exists():
                raise DatabaseException("변환된 파일이 생성되지 않았습니다.")
            
            return {
                "success": True,
                "converted_url": build_file_url(converted_url, request),
                "message": "동영상이 MP4로 변환되었습니다."
            }
        except Exception as convert_error:
            logger.error(f"동영상 변환 실패: {convert_error}", exc_info=True)
            # 변환 실패 시 생성된 파일 정리
            if converted_file_path.exists():
                try:
                    converted_file_path.unlink()
                except:
                    pass
            raise DatabaseException(f"동영상 변환 중 오류가 발생했습니다: {str(convert_error)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"동영상 변환 실패: {e}")
        raise HTTPException(status_code=500, detail=f"동영상 변환 중 오류가 발생했습니다: {str(e)}")

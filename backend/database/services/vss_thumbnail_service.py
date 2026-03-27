"""썸네일 관련 유틸과 서비스 함수들
원본 `backend/routers/reports.py`에서 추출한 코드입니다.
"""
import logging
import os
import tempfile
import io
import requests
from pathlib import Path
from typing import Optional
from PIL import Image
from utils.video_utils import get_VideoFileClip
from app_config.settings import (
    FAST_SEARCH_OUTPUT_DIR,
    VIDEOS_DIR,
    CONVERTED_VIDEOS_DIR,
    resolve_storage_file_path,
    API_BASE_URL,
)
from database.services.vss_videos_service import VideoService

logger = logging.getLogger(__name__)
class ThumbnailService:
    @staticmethod
    def normalize_url(url: str) -> str:
        if not url:
            return url
        if url.startswith('http://') or url.startswith('https://'):
            return url
        if url.startswith('/'):
            base_url = API_BASE_URL.rstrip('/')
            return f"{base_url}{url}"
        return url

    @staticmethod
    def download_image(url: str, timeout: int = 10) -> Optional[bytes]:
        try:
            normalized_url = ThumbnailService.normalize_url(url)
            response = requests.get(normalized_url, timeout=timeout, stream=True)
            if response.status_code == 200:
                return response.content
            logger.warning(f"이미지 다운로드 실패: HTTP {response.status_code} ({normalized_url})")
        except Exception as e:
            logger.warning(f"이미지 다운로드 실패 ({url}): {e}")
        return None

    @staticmethod
    def get_original_video_path(source_video: str, user_id: Optional[str] = None) -> Optional[str]:
        if not source_video:
            return None

        normalized_url = ThumbnailService.normalize_url(source_video) if source_video.startswith('/') or not source_video.startswith('http') else source_video

        if '/fast-search-output/' in normalized_url:
            filename = os.path.basename(normalized_url.split('/fast-search-output/')[-1].split('?')[0])
            local_path = FAST_SEARCH_OUTPUT_DIR / filename
            if os.path.exists(local_path):
                return str(local_path)
        elif '/video-files/' in normalized_url:
            filename = os.path.basename(normalized_url.split('/video-files/')[-1].split('?')[0])
            local_path = VIDEOS_DIR / filename
            if os.path.exists(local_path):
                return str(local_path)
        elif '/converted-videos/' in normalized_url:
            filename = os.path.basename(normalized_url.split('/converted-videos/')[-1].split('?')[0])
            local_path = CONVERTED_VIDEOS_DIR / filename
            if os.path.exists(local_path):
                return str(local_path)

        video_filename = os.path.basename(source_video.split('?')[0])

        if user_id:
            try:
                v = VideoService.find_by_filename(user_id, video_filename)
                if v:
                    file_path = getattr(v, 'FILE_PATH', None)
                    file_url = getattr(v, 'FILE_URL', None)
                    if file_path:
                        resolved_fp = resolve_storage_file_path(file_path)
                        if resolved_fp:
                            return str(resolved_fp)
                    if file_url:
                        url_filename = os.path.basename(file_url.split('?')[0])
                        local_path = VIDEOS_DIR / url_filename
                        if os.path.exists(local_path):
                            return str(local_path)
            except Exception:
                logger.warning("DB에서 원본 동영상 조회 실패")

        local_path = VIDEOS_DIR / video_filename
        if os.path.exists(local_path):
            return str(local_path)

        local_path = CONVERTED_VIDEOS_DIR / video_filename
        if os.path.exists(local_path):
            return str(local_path)

        resolved_src = resolve_storage_file_path(source_video)
        if resolved_src:
            return str(resolved_src)
        if os.path.exists(source_video):
            return source_video

        if normalized_url.startswith('http://') or normalized_url.startswith('https://'):
            return normalized_url

        return None

    @staticmethod
    def get_video_thumbnail(video_url: str, time_seconds: float = 0.0) -> Optional[bytes]:
        video_path = None
        is_temp_file = False
        try:
            normalized_url = ThumbnailService.normalize_url(video_url)

            local_path = None
            if '/fast-search-output/' in normalized_url:
                filename = os.path.basename(normalized_url.split('/fast-search-output/')[-1].split('?')[0])
                local_path = FAST_SEARCH_OUTPUT_DIR / filename
            elif '/video-files/' in normalized_url:
                filename = os.path.basename(normalized_url.split('/video-files/')[-1].split('?')[0])
                local_path = VIDEOS_DIR / filename
            elif '/converted-videos/' in normalized_url:
                filename = os.path.basename(normalized_url.split('/converted-videos/')[-1].split('?')[0])
                local_path = CONVERTED_VIDEOS_DIR / filename

            if local_path and os.path.exists(local_path):
                video_path = str(local_path)
            elif os.path.exists(video_url):
                video_path = video_url
            else:
                try:
                    response = requests.get(normalized_url, timeout=30, stream=True)
                    if response.status_code != 200:
                        logger.warning(f"비디오 다운로드 실패: HTTP {response.status_code} ({normalized_url})")
                        return None
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                        for chunk in response.iter_content(chunk_size=8192):
                            tmp_file.write(chunk)
                        video_path = tmp_file.name
                        is_temp_file = True
                except Exception as e:
                    logger.warning(f"비디오 다운로드 실패 ({normalized_url}): {e}")
                    return None

            if not video_path or not os.path.exists(video_path):
                return None

            VFC = get_VideoFileClip()
            video = VFC(video_path)
            frame_time = min(time_seconds, getattr(video, 'duration', 0) - 0.1) if getattr(video, 'duration', None) else 0.0
            frame = video.get_frame(frame_time)
            try:
                video.close()
            except Exception:
                pass

            img = Image.fromarray(frame)
            max_width = 800
            if img.width > max_width:
                ratio = max_width / img.width
                new_size = (max_width, int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            return img_byte_arr.getvalue()
        except Exception as e:
            logger.warning(f"비디오 썸네일 추출 실패 ({video_url}): {e}")
            return None
        finally:
            if is_temp_file and video_path and os.path.exists(video_path):
                try:
                    os.unlink(video_path)
                except Exception:
                    pass

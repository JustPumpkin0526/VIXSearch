from exceptions import NotFoundException, ValidationException
from app_config.settings import VIDEOS_DIR, CONVERTED_VIDEOS_DIR, BACKEND_DIR, resolve_storage_file_path

# Allowed extensions (duplicate of routers.videos constants to avoid circular import)
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'}
ALLOWED_FILE_EXTENSIONS = ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS

def _paths_to_delete_for_video_row(file_path_str, file_url):
    candidates: list[Path] = []
    seen: set[str] = set()

    def push(p: Path | None):
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

    stored_name = None
    if file_url:
        u = str(file_url).strip().split("?")[0]
        if "/video-files/" in u:
            tail = u.split("/video-files/", 1)[-1].lstrip("/")
            stored_name = Path(tail).name
        else:
            stored_name = Path(u.rstrip("/")).name

    if stored_name:
        push(VIDEOS_DIR / stored_name)
        push(BACKEND_DIR / "videos" / stored_name)
        stem = Path(stored_name).stem
        push(CONVERTED_VIDEOS_DIR / f"{stem}_converted.mp4")
        push(CONVERTED_VIDEOS_DIR / f"{stem}.mp4")

    return candidates

from ..orm.vss_videos import VSSVideo
from ..repositories.vss_videos_repo import VideoRepository
from ..repositories.vss_videos_repo import VideoRepository
import asyncio
import logging
from pathlib import Path
from utils.helpers import build_file_url
from database.services.vss_file_service import FileService as VideoFileService
from services.video_service import upload_to_via_server_background
from database.repositories.vss_videos_repo import VideoRepository

logger = logging.getLogger(__name__)

def _format_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)

class VSSVideoService:
    @staticmethod
    async def _process_video(request, video, videos_dir: str, converted_videos_dir: str):
        valid_file_url = ""

        file_url = video.FILE_URL
        file_name = video.FILE_NAME

        if file_url:
            original_filename = file_url.replace("/video-files/", "").lstrip("/")
            original_file_path = videos_dir / original_filename

            if await asyncio.to_thread(original_file_path.exists):
                valid_file_url = build_file_url(file_url, request)

            else:
                base_name = Path(original_filename).stem

                converted_filename = await VSSVideoService._find_converted_file(base_name, converted_videos_dir)

                if converted_filename:
                    converted_url = f"/converted-videos/{converted_filename}"
                    valid_file_url = build_file_url(converted_url, request)
                else:
                    valid_file_url = build_file_url(file_url, request)

        else:
            logger.warning(f"FILE_URL 없음: video_id={video.ID}")

        return {
            "id": video.ID,
            "title": file_name,
            "file_url": valid_file_url,
            "file_size": video.FILE_SIZE,
            "width": video.WIDTH,
            "height": video.HEIGHT,
            "duration": video.DURATION,
            "created_at": _format_datetime(video.CREATED_AT),
            "video_id": video.VIDEO_ID
        }

    @staticmethod
    async def _find_converted_file(base_name: str, converted_videos_dir: str):
        candidates = [
            f"{base_name}_converted.mp4",
            f"{base_name}.mp4",
        ]

        for candidate in candidates:
            path = converted_videos_dir / candidate
            if await asyncio.to_thread(path.exists):
                return candidate

        # fallback: 디렉토리 전체 검색
        try:
            if await asyncio.to_thread(converted_videos_dir.exists):
                files = await asyncio.to_thread(list, converted_videos_dir.iterdir())

                for file in files:
                    if file.is_file() and file.suffix.lower() == ".mp4":
                        if base_name in file.stem:
                            return file.name
        except Exception as e:
            logger.warning(f"변환 파일 검색 실패: {e}")

        return None

    @staticmethod
    async def get_videos(request, user_id: str, videos_dir: str, converted_videos_dir: str):
        videos = VideoRepository.get_videos_by_user_id_session(user_id)

        if not videos:
            return {"success": True, "videos": []}

        # ORM 객체 → dict 변환 + 기존 process_video_row 재사용
        tasks = [
            VSSVideoService._process_video(request, video, videos_dir, converted_videos_dir)
            for video in videos
        ]

        result = await asyncio.gather(*tasks)

        return {
            "success": True,
            "videos": list(result)
        }
        
    @staticmethod
    def delete_video(video_id: int, user_id: str):
        video = VideoRepository.get_by_id_and_user_session(video_id, user_id)
        if not video:
            raise NotFoundException("동영상", video_id)

        # 1. 파일 삭제
        paths = _paths_to_delete_for_video_row(
            video.FILE_PATH,
            video.FILE_URL
        )

        VideoFileService.delete_video_files(paths)

        # 2/3. DB 삭제 (repository가 처리)
        ok = VideoRepository.delete_by_id_and_user(video_id, user_id)
        if not ok:
            raise Exception("DB 삭제 실패")

        return {"success": True}
    
    @staticmethod
    async def upload_video(request, file, user_id):
        # 1. 검증
        if not file.filename:
            raise ValidationException("파일명 없음")

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_FILE_EXTENSIONS:
            raise ValidationException("지원하지 않는 형식")

        # 2. 중복 검사 (레포지토리에 위임)
        if VideoRepository.exists_by_filename_session(user_id, file.filename):
            raise ValidationException("이미 존재하는 파일")

        # 3. 파일 저장
        file_path, file_url, file_size = await VideoFileService.save(file, user_id)

        try:
            # 4. DB 저장
            # 비디오 메타데이터(width, height, duration)를 가능한 경우 즉시 추출하여 저장
            width = None
            height = None
            duration = None
            try:
                def _extract_meta():
                    from utils.video_utils import get_VideoFileClip
                    VFC = get_VideoFileClip()
                    clip = VFC(str(file_path))
                    try:
                        if hasattr(clip, 'size') and clip.size:
                            w, h = clip.size
                        else:
                            w = getattr(clip, 'w', None)
                            h = getattr(clip, 'h', None)
                        dur = float(clip.duration) if getattr(clip, 'duration', None) else None
                    finally:
                        try:
                            clip.reader.close()
                        except Exception:
                            pass
                        try:
                            if getattr(clip, 'audio', None):
                                clip.audio.reader.close_proc()
                        except Exception:
                            pass
                    return (int(w) if w else None, int(h) if h else None, dur)

                width, height, duration = await asyncio.to_thread(_extract_meta)
            except Exception:
                logger.info("비디오 메타데이터 추출 실패 — 나중에 후처리로 시도")

            video = VSSVideo(
                USER_ID=user_id,
                FILE_NAME=file.filename,
                FILE_PATH=str(file_path),
                FILE_SIZE=file_size,
                FILE_URL=file_url,
                WIDTH=width,
                HEIGHT=height,
                DURATION=duration
            )

            created = VideoRepository.create_video(video)
            if not created:
                raise Exception("DB 저장 실패")
            # 동기적으로 VIA 서버에 업로드 시도하여 VIDEO_ID를 즉시 반영합니다.
            try:
                via_id = await upload_to_via_server_background(str(file_path), created.ID, user_id)
                logger.info(f"upload_video: via_id returned: {via_id} for internal_id={created.ID}")
                if via_id:
                    ok = VideoRepository.update_video_id_by_id(created.ID, via_id)
                    if ok:
                        logger.info(f"VIDEO_ID 저장 완료: internal_id={created.ID} via_id={via_id}")
                    else:
                        logger.warning(f"VIDEO_ID 저장 실패: internal_id={created.ID} via_id={via_id}")
                else:
                    logger.warning(f"VIA 업로드가 실패했거나 ID를 반환하지 않음: internal_id={created.ID}")
            except Exception as e:
                logger.exception(f"VIA 업로드/DB 업데이트 중 예외 for internal_id={getattr(created,'ID',None)}: {e}")
        except Exception:
            # 롤백 + 파일 삭제
            if file_path.exists():
                file_path.unlink()
            raise

        # 5. 후처리 (비동기) - DB에 저장된 레코드를 사용
        asyncio.create_task(
            VSSVideoService._post_process(created, file_path, user_id)
        )

        return {
            "success": True,
            "video_id": getattr(created, 'ID', None),
            "file_url": build_file_url(file_url, request)
        }

    @staticmethod
    async def _post_process(video, file_path: Path, user_id: str):
        """비디오 메타데이터(width, height, duration)를 추출하여 DB에 저장합니다."""
        try:
            def _extract():
                from utils.video_utils import get_VideoFileClip
                VFC = get_VideoFileClip()

                clip = VFC(str(file_path))
                try:
                    if hasattr(clip, 'size') and clip.size:
                        w, h = clip.size
                    else:
                        w = getattr(clip, 'w', None)
                        h = getattr(clip, 'h', None)
                    dur = float(clip.duration) if getattr(clip, 'duration', None) else None
                finally:
                    try:
                        clip.reader.close()
                    except Exception:
                        pass
                    try:
                        if getattr(clip, 'audio', None):
                            clip.audio.reader.close_proc()
                    except Exception:
                        pass

                return (int(w) if w else None, int(h) if h else None, dur)

            width, height, duration = await asyncio.to_thread(_extract)

            # 저장은 레포지토리에 위임
            ok = VideoRepository.update_metadata_by_id(video.ID, width, height, duration)
            if ok:
                logger.info(f"비디오 메타데이터 저장 완료: id={video.ID} w={width} h={height} dur={duration}")
            else:
                logger.warning(f"후처리 대상 비디오를 찾을 수 없음: id={video.ID}")

        except Exception as e:
            # 상세 로그: moviepy import 문제나 환경 불일치 진단 도움
            import sys, traceback
            logger.warning(f"비디오 후처리 실패: {e}")
            logger.warning(f"Exception type: {type(e)}")
            logger.warning(f"Python executable during post_process: {sys.executable}")
            tb = ''.join(traceback.format_exception(None, e, e.__traceback__))
            logger.debug(f"Post-process traceback:\n{tb}")
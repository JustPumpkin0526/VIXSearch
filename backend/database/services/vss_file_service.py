from pathlib import Path
import time

from fastapi import HTTPException

from app_config.settings import PROFILE_IMAGES_DIR, ALLOWED_IMAGE_EXTENSIONS
from exceptions import NotFoundException, ValidationException, DatabaseException, ForbiddenException

class FileService:

    @staticmethod
    async def save_profile_image(user_id: str, file):
        if not file.filename:
            raise ValidationException("파일명 없음")

        ext = Path(file.filename).suffix.lower()

        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise ValidationException("지원하지 않는 형식")

        content = await file.read()

        if len(content) > 5 * 1024 * 1024:
            raise ValidationException("파일 크기 초과")

        filename = f"{user_id}_{int(time.time()*1000)}{ext}"
        path = PROFILE_IMAGES_DIR / filename

        PROFILE_IMAGES_DIR.mkdir(exist_ok=True)

        with open(path, "wb") as f:
            f.write(content)

        return f"/profile-images/{filename}"
    
    @staticmethod
    def delete_video_files(paths: list[Path]):
        failed = []

        for path in paths:
            if path.is_file():
                try:
                    path.unlink()
                except Exception as e:
                    failed.append((path, e))

        if failed:
            locked = [str(p) for p, e in failed if isinstance(e, PermissionError)]
            detail = "파일이 사용 중입니다."
            if locked:
                detail += f" (잠금: {locked[:3]})"
            raise HTTPException(status_code=423, detail=detail)

    @staticmethod
    async def save(file, user_id: str = None):
        """Save uploaded file (video or image) to storage directory and return (Path, file_url, size).

        Args:
            file: UploadFile-like object (has .filename and async .read())
            user_id: optional user id for filename prefix

        Returns:
            (path: Path, file_url: str, size: int)
        """
        if not file or not getattr(file, 'filename', None):
            raise ValidationException("파일명 없음")

        orig_name = Path(file.filename).name
        ext = Path(orig_name).suffix.lower()

        # Allow both images and videos; caller is responsible for validating extensions if needed
        # Use VIDEOS_DIR for all non-profile files
        try:
            from app_config.settings import VIDEOS_DIR
        except Exception:
            from backend.app_config.settings import VIDEOS_DIR

        VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

        timestamp = int(time.time() * 1000)
        prefix = f"{user_id}_" if user_id else ""
        safe_filename = f"{Path(orig_name).stem}_{timestamp}{ext}"
        filename = prefix + safe_filename
        path = VIDEOS_DIR / filename

        # write file
        size = 0
        try:
            content = await file.read()
            with open(path, "wb") as f:
                f.write(content)
            size = path.stat().st_size
        except Exception as e:
            # cleanup on failure
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass
            raise DatabaseException(f"파일 저장 실패: {e}")

        file_url = f"/video-files/{filename}"
        return path, file_url, size
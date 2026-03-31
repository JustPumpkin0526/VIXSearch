from pathlib import Path
import time
import os
import logging
from typing import Optional

from fastapi import HTTPException

try:
    # prefer package-style import when running as a package
    from backend.app_config.settings import PROFILE_IMAGES_DIR, ALLOWED_IMAGE_EXTENSIONS, REPORTS_DIR
except Exception:
    # fallback for script mode or different import contexts
    from app_config.settings import PROFILE_IMAGES_DIR, ALLOWED_IMAGE_EXTENSIONS, REPORTS_DIR

from exceptions import NotFoundException, ValidationException, DatabaseException, ForbiddenException

logger = logging.getLogger(__name__)

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


    # --- report file helpers (moved from services/vss_file_service) ---
    @staticmethod
    def save_docx_temp_and_finalize(doc, report_id: Optional[int] = None, safe_title: Optional[str] = None) -> (str, str):
        """문서 객체를 임시로 저장하고, report_id가 주어지면 최종 이름으로 변경하여 경로와 파일명 반환.
        반환: (final_file_path (str), final_filename (str))
        """
        REPORTS_DIR.mkdir(exist_ok=True, parents=True)
        timestamp = int(time.time() * 1000)
        if safe_title:
            tmp_name = f"{safe_title}_{timestamp}.docx"
        else:
            tmp_name = f"report_{timestamp}.docx"
        tmp_path = REPORTS_DIR / tmp_name
        doc.save(str(tmp_path))

        if report_id:
            final_filename = f"report_{report_id}_{timestamp}.docx"
            final_file_path = REPORTS_DIR / final_filename
            try:
                if tmp_path.exists():
                    tmp_path.rename(final_file_path)
            except Exception as e:
                logger.warning(f"파일명 변경 실패: {e}")
                final_file_path = tmp_path
        else:
            final_file_path = tmp_path
            final_filename = tmp_name

        return str(final_file_path), final_filename


    # 리포트 파일 전용 함수인 것 같음
    @staticmethod
    def find_report_file(report_id: int) -> Optional[str]:
        """로컬에 저장된 보고서 파일을 찾는 함수"""
        pattern = str(REPORTS_DIR / f"report_{report_id}_*.docx")
        from glob import glob
        matches = glob(pattern)
        if matches:
            return matches[0]
        return None

    @staticmethod
    def delete_report_files(report_id: int):
        """보고서 파일을 삭제하는 함수 (report_id로 패턴 매칭하여 삭제)"""
        path = FileService.find_report_file(report_id)
        if path and os.path.exists(path):
            try:
                os.unlink(path)
            except Exception as e:
                logger.warning(f"파일 삭제 실패: {e}")
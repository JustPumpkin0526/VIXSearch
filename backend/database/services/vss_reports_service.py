"""ORM-backed service layer for vss_reports using ReportRepository.

Repository layer is the only component performing direct DB queries; services
orchestrate logic and map ORM objects to the tuple shapes expected by routers.
"""
import json
import logging
from typing import Optional, Tuple

from database.db.connection import get_db_connection

from ..orm.vss_reports import VSSReport
from database.repositories.vss_reports_repo import ReportRepository
from database.repositories.vss_user_repo import UserRepository
from database.services.vss_file_service import FileService


logger = logging.getLogger(__name__)

class ReportService:
    @staticmethod
    def check_title_exists(user_id: str, title: str) -> bool:
        with get_db_connection() as db:
            return db.query(VSSReport).filter(VSSReport.USER_ID == user_id, VSSReport.TITLE == title).count() > 0

    @staticmethod
    def create_report(user_id: str, title: str, description: str, content: str, word_count: int, video_ids_json: Optional[str], video_titles_json: Optional[str]) -> int:
        with get_db_connection() as db:
            # ensure user exists
            if not UserRepository.exists(db, user_id):
                raise Exception("사용자를 찾을 수 없습니다.")

            report = VSSReport(
                USER_ID=user_id,
                TITLE=title,
                DESCRIPTION=description,
                CONTENT=content,
                WORD_COUNT=word_count,
                VIDEO_IDS=video_ids_json,
                VIDEO_TITLES=video_titles_json
            )
            created = ReportRepository.create(report, db)
            # Session will be committed by context manager
            return getattr(created, "ID", None)

    @staticmethod
    def get_reports(user_id: str, page: int, page_size: int) -> Tuple[list, int]:
        with get_db_connection() as db:
            try:
                rows, total = ReportRepository.list_by_user(user_id, page, page_size, db)
            except Exception as e:
                logger.warning(f"vss_reports table missing or list failed: {e}")
                return [], 0

            # map ORM objects to tuple shape expected by router
            mapped = []
            for r in rows:
                mapped.append((r.ID, r.TITLE, r.DESCRIPTION, r.CONTENT, r.WORD_COUNT, r.VIDEO_IDS, r.VIDEO_TITLES, r.CREATED_AT, r.UPDATED_AT))
            return mapped, total

    @staticmethod
    def get_report(report_id: int, user_id: str):
        with get_db_connection() as db:
            r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
            if not r:
                return None
            return (r.ID, r.TITLE, r.DESCRIPTION, r.CONTENT, r.WORD_COUNT, r.VIDEO_IDS, r.VIDEO_TITLES, r.CREATED_AT, r.UPDATED_AT)

    @staticmethod
    def delete_report(report_id: int, user_id: str) -> int:
        with get_db_connection() as db:
            return ReportRepository.delete_by_id_and_user(report_id, user_id, db)

    @staticmethod
    def update_report(report_id: int, user_id: str, title: str, description: str, content: str, word_count: int):
        with get_db_connection() as db:
            r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
            if not r:
                raise Exception("보고서를 찾을 수 없습니다.")
            ReportRepository.update_fields(r, title, description, content, word_count, db)

    @staticmethod
    def update_report_content(report_id: int, user_id: str, content: str, description: str, word_count: int, video_ids_json: Optional[str], video_titles_json: Optional[str]):
        with get_db_connection() as db:
            r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
            if not r:
                raise Exception("보고서를 찾을 수 없습니다.")
            ReportRepository.update_content_and_videos(r, content, description, word_count, video_ids_json, video_titles_json, db)

    @staticmethod
    def create_word_report(user_id: str, title: str, author: str, description: str, query: str, clips: list):
        """문서(Word) 생성 -> DB 저장 -> 파일 확정. 라우터에서 호출할 수 있는 클래스 메서드.

        clips: list of dict-like objects expected by document service.
        """
        try:
            # import here to avoid top-level circular imports
            from database.services.vss_document_service import DocumentService

            doc, report_content, word_count, thumbs = DocumentService.create_word_document(user_id, title, author, description, query, clips)

            # DB에 저장
            report_id = ReportService.create_report(user_id, title, description, report_content, word_count, None, None)

            # 파일 저장 및 확정
            safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).rstrip().replace(' ', '_')[:50]
            final_path, final_filename = FileService.save_docx_temp_and_finalize(doc, report_id=report_id, safe_title=safe_title)

            return {
                'report_id': report_id,
                'file_path': final_path,
                'file_name': final_filename,
                'file_url': f"/reports-files/{final_filename}",
                'word_count': word_count,
                'thumbs': thumbs
            }
        except Exception as e:
            logger.error(f"create_word_report 실패: {e}")
            raise

    @staticmethod
    def find_file_for_report(report_id: int) -> Optional[str]:
        return FileService.find_report_file(report_id)

    @staticmethod
    def delete_report_files(report_id: int):
        return FileService.delete_report_files(report_id)
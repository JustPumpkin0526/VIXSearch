"""ORM-backed service layer for vss_reports using ReportRepository.

Repository layer is the only component performing direct DB queries; services
orchestrate logic and map ORM objects to the tuple shapes expected by routers.
"""
import json
import logging
from typing import Optional, Tuple
from database.db.connection import get_db_connection
from database.repositories.vss_reports_repo import ReportRepository
from ..orm.vss_reports import VSSReport
from database.repositories.vss_user_repo import UserRepository

logger = logging.getLogger(__name__)


def check_title_exists(user_id: str, title: str) -> bool:
    with get_db_connection() as db:
        return db.query(VSSReport).filter(VSSReport.USER_ID == user_id, VSSReport.TITLE == title).count() > 0


def create_report_db(user_id: str, title: str, description: str, content: str, word_count: int, video_ids_json: Optional[str], video_titles_json: Optional[str]) -> int:
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


def get_reports_db(user_id: str, page: int, page_size: int) -> Tuple[list, int]:
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


def get_report_db(report_id: int, user_id: str):
    with get_db_connection() as db:
        r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
        if not r:
            return None
        return (r.ID, r.TITLE, r.DESCRIPTION, r.CONTENT, r.WORD_COUNT, r.VIDEO_IDS, r.VIDEO_TITLES, r.CREATED_AT, r.UPDATED_AT)


def delete_report_db(report_id: int, user_id: str) -> int:
    with get_db_connection() as db:
        return ReportRepository.delete_by_id_and_user(report_id, user_id, db)


def update_report_db(report_id: int, user_id: str, title: str, description: str, content: str, word_count: int):
    with get_db_connection() as db:
        r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
        if not r:
            raise Exception("보고서를 찾을 수 없습니다.")
        ReportRepository.update_fields(r, title, description, content, word_count, db)


def update_report_content_db(report_id: int, user_id: str, content: str, description: str, word_count: int, video_ids_json: Optional[str], video_titles_json: Optional[str]):
    with get_db_connection() as db:
        r = ReportRepository.get_by_id_and_user(report_id, user_id, db)
        if not r:
            raise Exception("보고서를 찾을 수 없습니다.")
        ReportRepository.update_content_and_videos(r, content, description, word_count, video_ids_json, video_titles_json, db)

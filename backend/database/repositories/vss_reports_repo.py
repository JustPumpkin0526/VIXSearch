from sqlalchemy.orm import Session
from typing import Optional, Tuple
from sqlalchemy import func
from ..orm.vss_reports import VSSReport


class ReportRepository:

    @staticmethod
    def create(report: VSSReport, db: Session) -> VSSReport:
        db.add(report)
        db.flush()
        return report

    @staticmethod
    def get_by_id_and_user(report_id: int, user_id: str, db: Session) -> Optional[VSSReport]:
        return db.query(VSSReport).filter(VSSReport.ID == report_id, VSSReport.USER_ID == user_id).first()

    @staticmethod
    def list_by_user(user_id: str, page: int, page_size: int, db: Session) -> Tuple[list, int]:
        total = db.query(func.count(VSSReport.ID)).filter(VSSReport.USER_ID == user_id).scalar() or 0
        offset = (page - 1) * page_size
        rows = db.query(VSSReport).filter(VSSReport.USER_ID == user_id).order_by(VSSReport.CREATED_AT.desc()).limit(page_size).offset(offset).all()
        return rows, total

    @staticmethod
    def delete_by_id_and_user(report_id: int, user_id: str, db: Session) -> int:
        res = db.query(VSSReport).filter(VSSReport.ID == report_id, VSSReport.USER_ID == user_id).delete()
        return res

    @staticmethod
    def update_fields(report: VSSReport, title: str, description: str, content: str, word_count: int, db: Session):
        report.TITLE = title
        report.DESCRIPTION = description
        report.CONTENT = content
        report.WORD_COUNT = word_count
        db.flush()

    @staticmethod
    def update_content_and_videos(report: VSSReport, content: str, description: str, word_count: int, video_ids: str, video_titles: str, db: Session):
        report.CONTENT = content
        report.DESCRIPTION = description
        report.WORD_COUNT = word_count
        report.VIDEO_IDS = video_ids
        report.VIDEO_TITLES = video_titles
        db.flush()

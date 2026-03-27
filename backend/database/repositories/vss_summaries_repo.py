from sqlalchemy.orm import Session
from typing import List, Optional
from ..orm.vss_summaries import VSSSummary
from database.db.connection import get_db_connection


class SummaryRepository:

    @staticmethod
    def get_by_video_and_user(video_id: str, user_id: str, db: Session) -> Optional[VSSSummary]:
        return db.query(VSSSummary).filter(VSSSummary.VIDEO_ID == video_id, VSSSummary.USER_ID == user_id).first()

    @staticmethod
    def get_batch_by_video_ids(video_ids: List[str], user_id: str, db: Session):
        return db.query(VSSSummary).filter(VSSSummary.VIDEO_ID.in_(video_ids), VSSSummary.USER_ID == user_id).all()

    @staticmethod
    def list_by_user(user_id: str, db: Session):
        return db.query(VSSSummary).filter(VSSSummary.USER_ID == user_id).order_by(VSSSummary.UPDATED_AT.desc()).all()

    @staticmethod
    def delete_by_video_ids(video_ids: List[str], user_id: str, db: Session) -> int:
        if not video_ids:
            return 0
        res = db.query(VSSSummary).filter(VSSSummary.VIDEO_ID.in_(video_ids), VSSSummary.USER_ID == user_id).delete(synchronize_session=False)
        return res

    @staticmethod
    def create(video_id: str, user_id: str, summary_text: str, prompt: str, db: Session) -> VSSSummary:
        """Create a new summary record and return it."""
        from ..orm.vss_summaries import VSSSummary
        new = VSSSummary(
            VIDEO_ID=video_id,
            USER_ID=user_id,
            SUMMARY_TEXT=summary_text,
            PROMPT=prompt
        )
        db.add(new)
        try:
            db.flush()
        except Exception:
            pass
        try:
            db.commit()
        except Exception:
            pass
        return new

    @staticmethod
    def update(existing: VSSSummary, summary_text: str, prompt: str, db: Session) -> VSSSummary:
        """Update an existing summary instance and return it."""
        existing.SUMMARY_TEXT = summary_text
        existing.PROMPT = prompt
        try:
            from sqlalchemy import func
            existing.UPDATED_AT = func.now()
        except Exception:
            pass
        try:
            db.add(existing)
            db.commit()
        except Exception:
            pass
        return existing

    # --- Convenience methods that manage their own DB session
    @staticmethod
    def get_batch_by_video_ids_session(video_ids: List[str], user_id: str):
        if not video_ids:
            return []
        try:
            with get_db_connection() as db:
                return SummaryRepository.get_batch_by_video_ids(video_ids, user_id, db)
        except Exception:
            return []

    @staticmethod
    def list_by_user_session(user_id: str):
        try:
            with get_db_connection() as db:
                return SummaryRepository.list_by_user(user_id, db)
        except Exception:
            return []

    @staticmethod
    def get_by_video_and_user_session(video_id: str, user_id: str):
        try:
            with get_db_connection() as db:
                return SummaryRepository.get_by_video_and_user(video_id, user_id, db)
        except Exception:
            return None

    @staticmethod
    def delete_by_video_ids_session(video_ids: List[str], user_id: str) -> int:
        if not video_ids:
            return 0
        try:
            with get_db_connection() as db:
                return SummaryRepository.delete_by_video_ids(video_ids, user_id, db)
        except Exception:
            return 0

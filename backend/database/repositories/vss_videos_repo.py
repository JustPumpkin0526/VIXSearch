from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy.exc import SQLAlchemyError
from ..orm.vss_videos import VSSVideo
from database.db.connection import get_db_connection
import logging

logger = logging.getLogger(__name__)

class VideoRepository:

    @staticmethod
    def get_by_id_and_user(video_id: int, user_id: str, db: Session):
        return db.query(VSSVideo).filter(
            VSSVideo.ID == video_id,
            VSSVideo.USER_ID == user_id
        ).first()

    @staticmethod
    def get_by_user_and_filename(user_id: str, filename: str, db: Session):
        return db.query(VSSVideo).filter(
            VSSVideo.USER_ID == user_id,
            VSSVideo.FILE_NAME == filename
        ).order_by(VSSVideo.CREATED_AT.desc()).first()

    @staticmethod
    def find_partial_by_filename(user_id: str, filename_fragment: str, db: Session):
        pattern1 = f"%{filename_fragment}"
        pattern2 = f"{filename_fragment}%"
        return db.query(VSSVideo).filter(
            VSSVideo.USER_ID == user_id,
            (VSSVideo.FILE_NAME.like(pattern1) | VSSVideo.FILE_NAME.like(pattern2))
        ).order_by(VSSVideo.CREATED_AT.desc()).first()

    @staticmethod
    def delete(video, db: Session):
        db.delete(video)

    @staticmethod
    def delete_summaries(video_id: int, user_id: str, db: Session):
        return db.execute(
            """DELETE FROM vss_summaries WHERE VIDEO_ID = :vid AND USER_ID = :uid""",
            {"vid": video_id, "uid": user_id}
        )

    @staticmethod
    def exists_by_filename(user_id: str, filename: str, db: Session):
        return db.query(VSSVideo.ID).filter(
            VSSVideo.USER_ID == user_id,
            VSSVideo.FILE_NAME == filename
        ).first() is not None

    @staticmethod
    def create(video: VSSVideo, db: Session):
        db.add(video)
        db.flush()  # ID 확보용
        try:
            # Ensure the instance is refreshed so callers see DB-assigned defaults
            db.refresh(video)
        except Exception:
            # Non-fatal: still return the instance
            logger.debug("DB refresh failed for video instance, returning flushed object")
        return video

    @staticmethod
    def get_videos_by_user_id(user_id: str, db: Session):
        """Return all VSSVideo records for a user ordered by created_at desc."""
        return db.query(VSSVideo).filter(
            VSSVideo.USER_ID == user_id
        ).order_by(VSSVideo.CREATED_AT.desc()).all()

    # --- Convenience methods that manage their own DB session (services/routers can call these)
    @staticmethod
    def batch_get_video_ids_by_internal_ids(internal_ids: list, user_id: str) -> dict:
        """Return mapping internal_id -> VIDEO_ID for given internal DB IDs."""
        if not internal_ids:
            return {}
        try:
            with get_db_connection() as db:
                rows = db.query(VSSVideo.ID, VSSVideo.VIDEO_ID).filter(
                    VSSVideo.ID.in_(internal_ids), VSSVideo.USER_ID == user_id
                ).all()
                return {r[0]: r[1] for r in rows}
        except Exception:
            return {}

    @staticmethod
    def get_durations_by_video_ids(video_ids: list, user_id: str) -> dict:
        """Return mapping VIDEO_ID -> DURATION for given video_ids."""
        if not video_ids:
            return {}
        try:
            with get_db_connection() as db:
                rows = db.query(VSSVideo.VIDEO_ID, VSSVideo.DURATION).filter(
                    VSSVideo.VIDEO_ID.in_(video_ids), VSSVideo.USER_ID == user_id
                ).all()
                return {r[0]: float(r[1]) for r in rows if r[1] is not None}
        except Exception:
            return {}

    @staticmethod
    def update_metadata(video_id: str, width: Optional[int], height: Optional[int], duration: Optional[float]):
        """Update WIDTH/HEIGHT/DURATION for a video by VIDEO_ID. Manages its own session."""
        try:
            with get_db_connection() as db:
                obj = db.query(VSSVideo).filter(VSSVideo.VIDEO_ID == video_id).first()
                if not obj:
                    return False
                obj.WIDTH = width
                obj.HEIGHT = height
                obj.DURATION = duration
                db.add(obj)
            return True
        except Exception:
            return False

    @staticmethod
    def get_videos_by_user_id_session(user_id: str):
        try:
            with get_db_connection() as db:
                return VideoRepository.get_videos_by_user_id(user_id, db)
        except Exception:
            return []

    @staticmethod
    def get_by_id_and_user_session(video_id: int, user_id: str):
        try:
            with get_db_connection() as db:
                return VideoRepository.get_by_id_and_user(video_id, user_id, db)
        except Exception:
            return None

    @staticmethod
    def create_video(video: VSSVideo):
        try:
            with get_db_connection() as db:
                created = VideoRepository.create(video, db)
                return created
        except Exception as ex:
            logger.exception(f"VideoRepository.create_video failed: {ex}")
            return None

    @staticmethod
    def delete_by_id_and_user(video_id: int, user_id: str) -> bool:
        try:
            with get_db_connection() as db:
                video = VideoRepository.get_by_id_and_user(video_id, user_id, db)
                if not video:
                    return False
                # delete summaries if exists
                if video.VIDEO_ID:
                    try:
                        VideoRepository.delete_summaries(video.VIDEO_ID, user_id, db)
                    except Exception:
                        pass
                VideoRepository.delete(video, db)
                db.commit()
            return True
        except Exception:
            return False

    @staticmethod
    def update_metadata_by_id(internal_id: int, width: Optional[int], height: Optional[int], duration: Optional[float]) -> bool:
        try:
            with get_db_connection() as db:
                obj = db.query(VSSVideo).filter(VSSVideo.ID == internal_id).first()
                if not obj:
                    return False
                obj.WIDTH = width
                obj.HEIGHT = height
                obj.DURATION = duration
                db.add(obj)
            return True
        except Exception:
            return False

    @staticmethod
    def update_video_id_by_id(internal_id: int, video_id: str) -> bool:
        """Set the VIDEO_ID (VIA server id) for a video by internal ID."""
        try:
            with get_db_connection() as db:
                obj = db.query(VSSVideo).filter(VSSVideo.ID == internal_id).first()
                if not obj:
                    logger.warning(f"update_video_id_by_id: video not found internal_id={internal_id}")
                    return False
                logger.info(f"update_video_id_by_id: setting VIDEO_ID={video_id} for internal_id={internal_id}")
                obj.VIDEO_ID = video_id
                db.add(obj)
            return True
        except Exception:
            logger.exception(f"update_video_id_by_id failed: internal_id={internal_id} video_id={video_id}")
            return False

    @staticmethod
    def exists_by_filename_session(user_id: str, filename: str) -> bool:
        try:
            with get_db_connection() as db:
                return VideoRepository.exists_by_filename(user_id, filename, db)
        except Exception:
            return False
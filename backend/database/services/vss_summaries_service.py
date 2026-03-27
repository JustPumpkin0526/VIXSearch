"""Service layer for vss_summaries - used by routers.summarize
"""
import logging
from typing import List, Dict, Optional
from exceptions import NotFoundException
from database.repositories.vss_summaries_repo import SummaryRepository
from database.repositories.vss_user_repo import UserRepository
from database.repositories.vss_videos_repo import VideoRepository

logger = logging.getLogger(__name__)


class SummaryService:
    @staticmethod
    def ensure_user_exists(user_id: str):
        if not UserRepository.exists_by_id(user_id):
            raise NotFoundException("사용자", user_id)

    @staticmethod
    def get_summaries_batch(video_id_list: List[str], user_id: str) -> Dict[str, Dict]:
        SummaryService.ensure_user_exists(user_id)
        summary_map: Dict[str, Dict] = {}
        if not video_id_list:
            return summary_map

        rows = SummaryRepository.get_batch_by_video_ids_session(video_id_list, user_id)
        for s in rows:
            summary_map[s.VIDEO_ID] = {
                "id": s.ID,
                "video_id": s.VIDEO_ID,
                "user_id": s.USER_ID,
                "prompt": s.PROMPT,
                "summary_text": s.SUMMARY_TEXT,
                "created_at": s.CREATED_AT,
                "updated_at": s.UPDATED_AT
            }

        return summary_map

    @staticmethod
    def get_summaries(user_id: str) -> List[Dict]:
        SummaryService.ensure_user_exists(user_id)
        rows = SummaryRepository.list_by_user_session(user_id)

        summaries = [
            {
                "id": r.ID,
                "video_id": r.VIDEO_ID,
                "user_id": r.USER_ID,
                "prompt": r.PROMPT,
                "summary_text": r.SUMMARY_TEXT,
                "created_at": r.CREATED_AT,
                "updated_at": r.UPDATED_AT
            }
            for r in rows
        ]

        return summaries

    @staticmethod
    def get_summary(video_id: str, user_id: str) -> Optional[Dict]:
        SummaryService.ensure_user_exists(user_id)
        s = SummaryRepository.get_by_video_and_user_session(video_id, user_id)
        if not s:
            return None

        return {
            "id": s.ID,
            "video_id": s.VIDEO_ID,
            "user_id": s.USER_ID,
            "prompt": s.PROMPT,
            "summary_text": s.SUMMARY_TEXT,
            "created_at": s.CREATED_AT,
            "updated_at": s.UPDATED_AT
        }

    @staticmethod
    def delete_summaries_by_videos(video_ids: List[str], user_id: str) -> int:
        if not video_ids:
            return 0
        return SummaryRepository.delete_by_video_ids_session(video_ids, user_id)

    @staticmethod
    def delete_summaries_by_internal_ids(internal_ids: List[int], user_id: str) -> int:
        """Map internal vss_videos.IDs to VIDEO_IDs and delete summaries via repository."""
        if not internal_ids:
            return 0

        video_ids = []
        for vid in internal_ids:
            v = VideoRepository.get_by_id_and_user_session(vid, user_id)
            if v and getattr(v, "VIDEO_ID", None):
                video_ids.append(v.VIDEO_ID)

        if not video_ids:
            return 0

        return SummaryRepository.delete_by_video_ids_session(video_ids, user_id)
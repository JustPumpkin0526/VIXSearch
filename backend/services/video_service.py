"""동영상 서비스"""
import logging
from pathlib import Path
from database.db.connection import get_db_connection
from utils.helpers import ensure_vss_client
from database.repositories.vss_summaries_repo import SummaryRepository

logger = logging.getLogger(__name__)

async def upload_to_via_server_background(file_path: str, video_id: int, user_id: str):
    """VIA 서버에 동영상 또는 이미지를 업로드하고 VIDEO_ID 반환 (동기적으로 처리)"""
    try:
        # 파일이 존재하는지 확인
        if not Path(file_path).exists():
            logger.error(f"파일이 존재하지 않습니다: {file_path}")
            return None
        
        vss_client = await ensure_vss_client()
        via_video_id = await vss_client.upload_video(str(file_path))
        logger.info(f"VIA 서버 업로드 성공: video_id={via_video_id}, db_video_id={video_id}")
        return via_video_id
    except Exception as e:
        logger.warning(f"VIA 서버 업로드 실패 (video_id={video_id}): {e}")
        # VIA 업로드 실패해도 계속 진행 (나중에 재시도 가능)
        return None

def _save_summary_to_db(video_id: str, user_id: str, summary_text: str, prompt: str):
    """
    요약 결과를 DB에 저장하는 공통 함수
    
    Args:
        video_id: VIA 서버의 video_id (vss_videos.VIDEO_ID 컬럼 값)
        user_id: 사용자 ID
        summary_text: 요약 텍스트
        prompt: 사용된 프롬프트
    
    Returns:
        summary_id: 저장된 요약의 ID (INSERT인 경우), None (UPDATE인 경우)
    """
    try:
        # ORM 방식으로 저장 (레거시 cursor/conn 사용 금지)
        with get_db_connection() as db:
            existing = SummaryRepository.get_by_video_and_user(video_id, user_id, db)
            if existing:
                summary = SummaryRepository.update(existing, summary_text, prompt, db)
            else:
                summary = SummaryRepository.create(video_id, user_id, summary_text, prompt, db)
            summary_id = getattr(summary, 'ID', None)
            logger.info(f"요약 결과 DB 저장 완료 (ORM): VIDEO_ID={video_id}, USER_ID={user_id}, summary_id={summary_id}")
            return summary_id
    except Exception as e:
        logger.error(f"요약 결과 DB 저장 실패 (ORM): {e}")
        raise


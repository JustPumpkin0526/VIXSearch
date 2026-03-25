"""동영상 서비스"""
import logging
from pathlib import Path
from database.connection import conn, cursor, ensure_db_connection
from utils.helpers import ensure_vss_client

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
        # vss_summaries 테이블에 저장 또는 업데이트
        ensure_db_connection()
        cursor.execute(
            """INSERT INTO vss_summaries (VIDEO_ID, USER_ID, SUMMARY_TEXT, PROMPT) 
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
               SUMMARY_TEXT = VALUES(SUMMARY_TEXT),
               PROMPT = VALUES(PROMPT),
               UPDATED_AT = CURRENT_TIMESTAMP""",
            (video_id, user_id, summary_text, prompt)
        )
        conn.commit()
        
        summary_id = cursor.lastrowid if cursor.rowcount == 1 else None
        if summary_id is None:
            # UPDATE인 경우 ID 조회
            cursor.execute(
                "SELECT ID FROM vss_summaries WHERE VIDEO_ID = ? AND USER_ID = ?",
                (video_id, user_id)
            )
            row = cursor.fetchone()
            summary_id = row[0] if row else None
        
        logger.info(f"요약 결과 DB 저장 완료: VIDEO_ID={video_id}, USER_ID={user_id}, summary_id={summary_id}")
        return summary_id
    except Exception as e:
        logger.error(f"요약 결과 DB 저장 실패: {e}")
        raise


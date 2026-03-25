"""FastAPI 의존성 주입 모듈"""
import logging
from typing import Optional
from fastapi import Depends, HTTPException, Query
from database.connection import get_db_connection
from exceptions import NotFoundException, DatabaseException

logger = logging.getLogger(__name__)


def get_user_id(
    user_id: Optional[str] = Query(None, description="사용자 ID")
) -> str:
    """
    사용자 ID 검증 의존성
    
    Usage:
        @router.get("/example")
        async def example(user_id: str = Depends(get_user_id)):
            ...
    """
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id가 필요합니다.")
    return user_id


def verify_user_dependency(user_id: str = Depends(get_user_id)) -> str:
    """
    사용자 존재 확인 의존성
    
    Usage:
        @router.get("/example")
        async def example(user_id: str = Depends(verify_user_dependency)):
            ...
    """
    try:
        with get_db_connection() as cursor:
            cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
            if not cursor.fetchone():
                raise NotFoundException("사용자", user_id)
        return user_id
    except NotFoundException:
        raise
    except Exception as e:
        logger.error(f"사용자 확인 중 오류: {e}")
        raise DatabaseException(f"사용자 확인 중 오류가 발생했습니다: {str(e)}")

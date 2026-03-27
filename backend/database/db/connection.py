"""데이터베이스 연결 관리"""
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

try:
    # package mode
    from backend.app_config import DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_NAME
except Exception:
    # script mode
    from app_config import DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_NAME

logger = logging.getLogger(__name__)

# SQLAlchemy URL
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# 엔진 + 세션 생성
engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=5, echo=False)
# Prevent expiring instances on commit so returned ORM objects remain usable without a live session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)

# Base 클래스
Base = declarative_base()

# 컨텍스트 매니저: ORM 전용 세션 반환
from contextlib import contextmanager


@contextmanager
def get_db_connection():
    """ORM 세션을 제공하는 컨텍스트 매니저. with 블록이 끝나면 자동으로 커밋 또는 롤백 후 세션 종료."""
    """기존 cursor를 사용하는 raw 방식에서 안정성과 편의성을 높인 SQLAlchemy ORM 방식으로 전환."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except:
        session.rollback()
        raise
    finally:
        session.close()

# Legacy DB-API compatibility removed. Use SQLAlchemy ORM via `get_db_connection()`.

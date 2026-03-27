"""데이터베이스 연결 관리"""
# import mariadb
# import re
# import threading
# from queue import Queue, Empty

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
    """Return a SQLAlchemy `Session` from `SessionLocal`.

    This function yields a plain `Session` (no DB-API cursor compatibility).
    Repositories and services should use SQLAlchemy ORM APIs only.
    """
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

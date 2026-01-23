"""VSS API 메인 애플리케이션"""
import asyncio
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import logging

# 로깅 설정 먼저 초기화
from config.logging_config import setup_logging
setup_logging()

logger = logging.getLogger(__name__)

# ==================== asyncio 예외 핸들러 설정 ====================
def ignore_connection_reset(loop, context):
    """ConnectionResetError를 무시하는 asyncio 예외 핸들러"""
    exception = context.get('exception')
    if isinstance(exception, ConnectionResetError):
        # ConnectionResetError는 클라이언트가 연결을 끊었을 때 발생하는 정상적인 동작
        # 로그에 기록하지 않고 무시
        return
    
    # 다른 예외는 기본 핸들러로 전달
    loop.default_exception_handler(context)

# asyncio 이벤트 루프에 예외 핸들러 설정
# Python 3.10+에서는 get_event_loop()가 deprecated되었으므로
# lifespan에서 get_running_loop()를 사용하도록 변경
# (모듈 레벨에서는 이벤트 루프가 없을 수 있으므로 여기서는 설정하지 않음)

# 설정 import
from config.settings import (
    VIDEOS_DIR, CLIPS_DIR, CONVERTED_VIDEOS_DIR, PROFILE_IMAGES_DIR, SAMPLE_DIR, REPORTS_DIR
)

# 데이터베이스 연결 초기화
from database.connection import db_pool, conn, cursor

# 유틸리티 import
from utils.helpers import get_session
# http_session을 전역으로 접근하기 위해
import utils.helpers as utils_helpers

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리 (startup 및 shutdown)"""
    # Startup
    # Windows에서 asyncio 예외 핸들러 설정 (이벤트 루프가 생성된 후)
    if sys.platform == 'win32':
        try:
            loop = asyncio.get_running_loop()
            loop.set_exception_handler(ignore_connection_reset)
        except RuntimeError:
            # 이벤트 루프가 없는 경우 무시
            pass
    
    await get_session()
    
    # 데이터베이스 연결 확인 (실패해도 애플리케이션은 계속 시작)
    global conn, cursor
    if conn is None or cursor is None:
        try:
            conn = db_pool.get_connection()
            conn.autocommit = True
            cursor = conn.cursor()
            logger.info("데이터베이스 연결 성공 (startup)")
        except Exception as e:
            logger.warning(f"데이터베이스 연결 실패 (startup): {e}")
            logger.warning("첫 요청 시 연결을 다시 시도합니다.")
    
    logger.info("애플리케이션이 시작되었습니다. VIA 서버의 query_video를 사용합니다.")
    logger.info("=" * 60)
    logger.info("서버가 정상적으로 시작되었습니다.")
    logger.info(f"서버 주소: http://0.0.0.0:8001")
    logger.info(f"로컬 접속: http://localhost:8001")
    logger.info("API 문서: http://localhost:8001/docs")
    logger.info("=" * 60)
    logger.info("서버가 요청을 기다리는 중입니다... (정상 상태)")
    
    yield  # 애플리케이션이 실행되는 동안 여기서 대기
    
    # Shutdown
    if utils_helpers.http_session and not utils_helpers.http_session.closed:
        await utils_helpers.http_session.close()
        logger.info("aiohttp 세션이 종료되었습니다.")

app = FastAPI(lifespan=lifespan)

# Serve generated clips as static files under /clips
CLIPS_DIR.mkdir(exist_ok=True)
app.mount("/clips", StaticFiles(directory=str(CLIPS_DIR.resolve())), name="clips")

# Serve uploaded videos as static files under /video-files (API 엔드포인트와 충돌 방지)
VIDEOS_DIR.mkdir(exist_ok=True)
app.mount("/video-files", StaticFiles(directory=str(VIDEOS_DIR.resolve())), name="video-files")

# Serve converted videos as static files under /converted-videos
CONVERTED_VIDEOS_DIR.mkdir(exist_ok=True)
app.mount("/converted-videos", StaticFiles(directory=str(CONVERTED_VIDEOS_DIR.resolve())), name="converted-videos")

# Serve profile images as static files under /profile-images
PROFILE_IMAGES_DIR.mkdir(exist_ok=True)
app.mount("/profile-images", StaticFiles(directory=str(PROFILE_IMAGES_DIR.resolve())), name="profile-images")

# Serve reports as static files under /reports-files
REPORTS_DIR.mkdir(exist_ok=True, parents=True)
app.mount("/reports-files", StaticFiles(directory=str(REPORTS_DIR.resolve())), name="reports-files")

# Serve sample videos as static files under /sample
SAMPLE_DIR.mkdir(exist_ok=True, parents=True)
logger.info(f"Serving sample videos from: {SAMPLE_DIR}")

# sample.mp4 파일 존재 여부 확인
sample_file = SAMPLE_DIR / "sample.mp4"
if sample_file.exists():
    logger.info(f"샘플 동영상을 찾았습니다. : {sample_file}")
else:
    logger.warning(f"샘플 동영상은 해당 경로에 없습니다. : {sample_file}")

try:
    app.mount("/sample", StaticFiles(directory=str(SAMPLE_DIR.resolve())), name="sample")
    logger.info(f"/sample 엔드포인트를 {SAMPLE_DIR}에 성공적으로 마운트했습니다.")
except Exception as e:
    logger.error(f"/sample 엔드포인트를 마운트하는데 실패했습니다. : {e}")

# CORS 설정 (Vue와 통신 가능하게)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 운영에서는 도메인 제한 권장
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
from routers import auth, users, summarize, reports, search, videos

app.include_router(auth.router, tags=["auth"])
app.include_router(users.router, tags=["users"])
app.include_router(summarize.router, tags=["summarize"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(search.router, tags=["search"])
app.include_router(videos.router, prefix="/videos", tags=["videos"])
# upload-video와 convert-video는 별도 경로로도 등록 (하위 호환성)
from routers.videos import upload_video, convert_video
app.add_api_route("/upload-video", upload_video, methods=["POST"], tags=["videos"])
app.add_api_route("/convert-video/{video_id}", convert_video, methods=["GET"], tags=["videos"])

# 모든 엔드포인트가 라우터로 마이그레이션되었으므로 vss-api.py는 더 이상 사용하지 않습니다.
logger.info("모든 엔드포인트가 라우터로 마이그레이션되었습니다.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)


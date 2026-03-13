"""로깅 설정"""
import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
from datetime import datetime
from .settings import LOGS_DIR

def setup_logging():
    """로깅 설정 초기화"""
    # 로그 디렉토리 생성
    LOGS_DIR.mkdir(exist_ok=True, parents=True)
    
    # 오늘 날짜를 파일명에 포함
    today = datetime.now().strftime('%Y-%m-%d')
    log_file = LOGS_DIR / f"vss-api-{today}.log"
    uvicorn_log_file = LOGS_DIR / f"uvicorn-{today}.log"
    uvicorn_access_log_file = LOGS_DIR / f"uvicorn-access-{today}.log"
    
    # 루트 로거 가져오기
    root_logger = logging.getLogger()
    
    # 기존 핸들러가 있으면 제거 (중복 방지)
    root_logger.handlers.clear()
    
    # 로깅 설정
    # Python 3.8+에서는 force=True 지원, 그 이전 버전에서는 수동으로 설정
    try:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            handlers=[
                # 콘솔 출력
                logging.StreamHandler(),
                # 파일 출력 (매일 자정에 새 파일 생성, 30일 보관)
                TimedRotatingFileHandler(
                    filename=str(log_file),
                    when='midnight',  # 매일 자정
                    interval=1,  # 1일마다
                    backupCount=30,  # 30일치 보관
                    encoding='utf-8',
                    delay=False  # 즉시 파일 생성
                )
            ],
            force=True  # 기존 설정 덮어쓰기 (Python 3.8+)
        )
    except TypeError:
        # Python 3.7 이하에서는 force 파라미터가 없으므로 수동으로 설정
        root_logger.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', 
                                     datefmt='%Y-%m-%d %H:%M:%S')
        
        # 콘솔 핸들러
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # 파일 핸들러
        file_handler = TimedRotatingFileHandler(
            filename=str(log_file),
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8',
            delay=False
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # 로그 파일이 즉시 생성되도록 테스트 로그 기록
    test_logger = logging.getLogger(__name__)
    test_logger.info("로깅 설정이 완료되었습니다.")
    
    # FastAPI와 uvicorn 로거 설정
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_access_logger = logging.getLogger("uvicorn.access")
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    
    # uvicorn access logger의 콘솔 핸들러에 타임스탬프 포맷 설정
    access_formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    
    # uvicorn.access 로거의 기존 핸들러에 포맷터 적용
    # uvicorn이 시작되기 전에는 핸들러가 없을 수 있으므로, 핸들러가 추가될 때 포맷터를 적용하도록 설정
    if uvicorn_access_logger.handlers:
        for handler in uvicorn_access_logger.handlers:
            handler.setFormatter(access_formatter)
    
    # uvicorn 로그도 파일에 기록
    uvicorn_file_handler = TimedRotatingFileHandler(
        filename=str(uvicorn_log_file),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8',
        delay=False
    )
    uvicorn_file_handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    )
    
    uvicorn_access_file_handler = TimedRotatingFileHandler(
        filename=str(uvicorn_access_log_file),
        when='midnight',
        interval=1,
        backupCount=30,
        encoding='utf-8',
        delay=False
    )
    uvicorn_access_file_handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    )
    
    uvicorn_logger.addHandler(uvicorn_file_handler)
    uvicorn_access_logger.addHandler(uvicorn_access_file_handler)
    uvicorn_error_logger.addHandler(uvicorn_file_handler)


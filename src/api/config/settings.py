"""애플리케이션 설정"""
import os
from pathlib import Path
from typing import Optional

# .env 파일 지원 (python-dotenv가 설치되어 있는 경우)
try:
    from dotenv import load_dotenv
    # 프로젝트 루트 기준 상대 경로에서 .env 파일 로드
    env_path = Path(__file__).resolve().parents[3] / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        # 경로가 바뀐 경우를 대비해 현재 디렉터리에서도 탐색
        load_dotenv()
except ImportError:
    pass  # python-dotenv가 없으면 시스템 환경 변수 사용

# ==================== API 설정 ====================
# 외부 접속 지원: localhost를 기본값으로 사용 (같은 서버에서 실행되는 경우)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8001")

# ==================== VIA 서버 설정 ====================
# VIA 서버가 다른 서버에서 실행되는 경우 환경 변수로 IP 주소 설정 필요
# 예: VIA_SERVER_URL=http://192.168.1.100:8101
# 같은 서버에서 실행되는 경우 localhost 사용
VIA_SERVER_URL = os.getenv("VIA_SERVER_URL", "http://172.16.15.88:8101")
VIA_MODEL_TIMEOUT = int(os.getenv("VIA_MODEL_TIMEOUT", "10"))  # VIA 모델 조회 타임아웃 (초)
VIA_UPLOAD_TIMEOUT_MIN = 300  # 최소 업로드 타임아웃 (초, 5분)
VIA_UPLOAD_TIMEOUT_MAX = 1800  # 최대 업로드 타임아웃 (초, 30분)
VIA_UPLOAD_TIMEOUT_PER_MB = 15  # 1MB당 타임아웃 (초, 기존 10초에서 증가)

# ==================== Ollama 설정 ====================
# Ollama가 다른 서버에서 실행되는 경우 환경 변수로 IP 주소 설정 필요
# 예: OLLAMA_BASE_URL=http://192.168.1.100:11434
# 같은 서버에서 실행되는 경우 localhost 사용
# 기본 포트는 11434입니다 (Ollama 기본 포트)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://172.16.7.64:11434")
# 로깅으로 변경 (print 대신)
import logging
_logger = logging.getLogger(__name__)
_logger.info(f"OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_TRANSLATION_MODEL = os.getenv("OLLAMA_TRANSLATION_MODEL", "hy-mt15-translation")  # 번역 전용 모델
OLLAMA_TIMEOUT = 60  # Ollama API 타임아웃 (초)

# ==================== CV Event Detector API 설정 ====================
# CV Event Detector가 다른 서버에서 실행되는 경우 환경 변수로 IP 주소 설정 필요
# 예: CV_EVENT_DETECTOR_API_URL=http://192.168.1.100:23491
# 같은 서버에서 실행되는 경우 localhost 사용
CV_EVENT_DETECTOR_API_URL = os.getenv("CV_EVENT_DETECTOR_API_URL", "http://172.16.7.64:23491")

# ==================== VST 및 AlertBridge 설정 ====================
# VST (Video Storage) 설정
ENABLE_VST = os.getenv("NV_ENABLE_VST", "false").lower() == "true"
VST_API_URL = os.getenv("VST_API_URL", "http://api-gateway:80/api/vst")

# AlertBridge 설정
ENABLE_ALERTBRIDGE = os.getenv("NV_ENABLE_ALERTBRIDGE", "false").lower() == "true"
ALERTBRIDGE_API_BASE = os.getenv("NV_ALERTBRIDGE_API_BASE", "http://api-gateway:80/api/alertbridge")

# 클립 후처리 설정
FILTERED_CLIP_PATH = os.getenv("FILTERED_CLIP_PATH", "/tmp/alert-media-dir")

# ==================== 파일 설정 ====================
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
FILE_BUFFER_SIZE = 16 * 1024 * 1024  # 16MB (업로드 성능 최적화)
CLIP_CLEANUP_AGE = 86400  # 클립 파일 정리 기준 시간 (24시간, 초)
UNSUPPORTED_VIDEO_FORMATS = {'.avi', '.mkv', '.flv', '.wmv'}  # 변환이 필요한 비디오 형식 (브라우저 호환성을 위해 .avi도 변환 필요)

# ==================== 타임아웃 설정 ====================
DEFAULT_VIA_TARGET_RESPONSE_TIME = 2 * 60  # 초
DEFAULT_VIA_TARGET_USECASE_EVENT_DURATION = 10  # 초

# ==================== 정규식 패턴 ====================
EMAIL_REGEX = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
IP_PATTERN = r'^(\d{1,3}\.){3}\d{1,3}$'

# ==================== 이메일 설정 ====================
EMAIL_CODE_EXPIRY_MINUTES = 10
# 회원가입 시 이메일 인증 활성화 여부 (환경 변수로 설정 가능, 기본값: True)
ENABLE_EMAIL_VERIFICATION = os.getenv("ENABLE_EMAIL_VERIFICATION", "true").lower() == "true"

# ==================== VIA 서버 요약 기본 설정 ====================
#DEFAULT_SUMMARIZE_PROMPT = "You are a video monitoring system. Analyze the video frame by frame and identify all meaningful events. For each event, output in the format START_TIME-END_TIME=Detailed Event Description using seconds for timestamps. Each event must be on a separate line with no text before or after the timestamp-event pairs. Describe events chronologically from initial state through actions to final outcome. Include specific details about human behavior (movements, directions, posture changes, gestures, object interactions, person-to-person interactions, facial expressions if visible), environmental context (location type, background elements, weather, lighting, spatial relationships, time of day), and scene changes (objects appearing/disappearing, doors opening/closing). Focus on events involving human activity, movement, or interaction that are relevant for security or monitoring. Be precise and specific, use active voice and present tense, include quantitative details when possible, and distinguish between multiple people. For overlapping events, create separate entries. Each description must be self-contained and focus on observable facts. Output only timestamp-event pairs in the specified format."
DEFAULT_SUMMARIZE_PROMPT = "You are a video/CCTV monitoring system. Describe events chronologically and flag any anomalies. For each event, start the sentence with SS.SSS-SS.SSS and include when visible the location/area in the scene, the people involved with distinguishing attributes what happens, and why it may be anomalous or safety-relevant."
DEFAULT_CAPTION_SUMMARIZATION_PROMPT = "You will be given captions from sequential clips of a video. Aggregate captions in the format start_time:end_time:caption based on whether captions are related to one another or create a continuous scene."
DEFAULT_SUMMARY_AGGREGATION_PROMPT = "Based on the available information, generate a summary that captures the important events in the video. The summary should be organized chronologically and in logical sections. This should be a concise, yet descriptive summary of all the important events. The format should be intuitive and easy for a user to read and understand what happened. Format the output in Markdown so it can be displayed nicely. Timestamps are in seconds so please format them as SS.SSS"

# ==================== VIA 서버 요약 파라미터 기본값 ====================
DEFAULT_NUM_FRAMES_PER_CHUNK = 15
DEFAULT_FRAME_WIDTH = 0
DEFAULT_FRAME_HEIGHT = 0
DEFAULT_TOP_K = 80
DEFAULT_TOP_P = 1.0
DEFAULT_TEMPERATURE = 0.4
DEFAULT_MAX_TOKENS = 512
DEFAULT_SEED = 1
DEFAULT_BATCH_SIZE = 6
DEFAULT_RAG_BATCH_SIZE = 1
DEFAULT_RAG_TOP_K = 5
DEFAULT_SUMMARIZE_TOP_P = 0.7
DEFAULT_SUMMARIZE_TEMPERATURE = 0.2
DEFAULT_SUMMARIZE_MAX_TOKENS = 2048
DEFAULT_CHAT_TOP_P = 0.7
DEFAULT_CHAT_TEMPERATURE = 0.2
DEFAULT_CHAT_MAX_TOKENS = 2048
DEFAULT_NOTIFICATION_TOP_P = 0.7
DEFAULT_NOTIFICATION_TEMPERATURE = 0.2
DEFAULT_NOTIFICATION_MAX_TOKENS = 2048
DEFAULT_ENABLE_AUDIO = True

# ==================== VIA 서버 질의(query) 기본 설정 ====================
DEFAULT_QUERY_TEMPERATURE = 0.3
DEFAULT_QUERY_SEED = 42
DEFAULT_QUERY_MAX_TOKENS = 1024  # VIA 서버는 최대 1024까지만 허용
DEFAULT_QUERY_TOP_P = 1.0
DEFAULT_QUERY_TOP_K = 80

# ==================== 데이터베이스 설정 ====================
# 외부 접속 지원: localhost를 기본값으로 사용 (같은 서버에서 실행되는 경우)
DB_HOST = os.getenv("DB_HOST", "172.16.15.69")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")  # 환경 변수에서 로드 (필수)
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "vss")
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
DB_POOL_WARMUP = int(os.getenv("DB_POOL_WARMUP", "1"))

# ==================== SMTP 설정 ====================
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)

# ==================== 디렉토리 경로 ====================
BASE_DIR = Path(__file__).parent.parent
VIDEOS_DIR = BASE_DIR / "videos"
CLIPS_DIR = BASE_DIR / "clips"
CONVERTED_VIDEOS_DIR = BASE_DIR / "converted-videos"
PROFILE_IMAGES_DIR = BASE_DIR / "profile-images"
REPORTS_DIR = BASE_DIR / "reports"
TMP_DIR = BASE_DIR / "tmp"
LOGS_DIR = BASE_DIR / "logs"
SAMPLE_DIR = BASE_DIR.parent / "assets" / "sample"


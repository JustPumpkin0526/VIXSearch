# VSS (Video Summarization System)

동영상 요약·검색·보고서 기능을 제공하는 웹 애플리케이션입니다.  
**프론트엔드**는 Vue 3 + Vite + Pinia, **백엔드**는 FastAPI이며, 동영상 분석은 **NVIDIA VIA** 등 외부 서비스와 연동합니다.

## 목차

- [시스템 요구사항](#시스템-요구사항)
- [프로젝트 구조](#프로젝트-구조)
- [설치](#설치)
- [환경 변수](#환경-변수)
- [데이터베이스](#데이터베이스)
- [실행 방법](#실행-방법)
- [주요 기능](#주요-기능)
- [API·정적 경로 개요](#api정적-경로-개요)
- [문제 해결](#문제-해결)
- [추가 문서](#추가-문서)

## 시스템 요구사항

### 프론트엔드

- **Node.js**: 20.x LTS 이상 권장
- **npm**: 10.x 이상
- **Vue** 3.5.x, **Vite** 7.x, **Tailwind CSS** 3.x (저장소에 설정 포함)

### 백엔드

- **Python** 3.10+ 권장 (3.8+ 호환 목표)
- **MariaDB** 10.x 이상 또는 **MySQL** 8.x
- **FFmpeg**: 동영상 변환·처리 (`moviepy` 등)

### 외부 서비스 (선택·연동)

- **VIA 서버**: 동영상 분석·요약·질의 (`VIA_SERVER_URL`)
- **Ollama**: LLM·번역 등 (`OLLAMA_BASE_URL`, 선택)
- **CV Event Detector**: 고속 검색·이벤트 파이프라인 (`CV_EVENT_DETECTOR_API_URL`, 선택)

## 프로젝트 구조

```
VSS_Project/
├── backend/                 # FastAPI 앱 (실행 시 작업 디렉터리로 사용)
│   ├── main.py              # 진입점, 정적 마운트, 라우터 등록
│   ├── exceptions.py      # HTTP 연동 커스텀 예외
│   ├── dependencies.py    # FastAPI Depends 공통 검증
│   ├── routers/             # auth, users, summarize, search, reports, videos
│   ├── services/            # VSS 클라이언트, 이메일, 동영상 서비스
│   ├── utils/               # helpers, video_utils, validators
│   ├── config/              # settings.py, logging_config.py
│   ├── database/            # DB 풀·연결
│   ├── videos/              # 동영상 루트 (업로드 원본·하위 폴더 포함)
│   │   ├── converted-videos/   # 변환본(MP4 등)
│   │   ├── fast-search-output/ # 고속 검색(CV) 출력
│   │   └── staging/            # 업로드·VIA 전송용 임시 파일
│   ├── profile-images/
│   ├── reports/             # 생성된 보고서(docx 등)
│   └── logs/                # 애플리케이션·uvicorn 로그
├── src/                     # Vue 3 SPA (Vite 루트 `index.html` 기준)
│   ├── components/
│   ├── router/
│   ├── stores/
│   ├── composables/
│   ├── assets/
│   └── utils/
├── public/
├── sql/                     # 스키마 SQL 스크립트
├── docs/                    # SMTP 등 보조 문서
├── NVIDIA-VSS/              # 참조·외부 VIA/VLM 관련 스크립트(선택)
├── requirements.txt
├── package.json
└── .env                     # 루트에 생성 (Git 제외)
```

백엔드 설정(`backend/config/settings.py`)은 **프로젝트 루트**의 `.env`를 읽습니다 (`Path(__file__).parents[2] / ".env"`).

## 설치

### 프론트엔드

```bash
cd VSS_Project   # 또는 본인의 클론 경로
npm install
```

Tailwind·PostCSS는 이미 `package.json` / `tailwind.config.js`에 맞춰져 있습니다. 최초 세팅이 아니라면 `npx tailwindcss init`은 필요 없습니다.

### 백엔드

```bash
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

### FFmpeg (OS별)

- **Windows**: [FFmpeg](https://ffmpeg.org/download.html) 설치 후 PATH 등록
- **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
- **macOS**: `brew install ffmpeg`

## 환경 변수

프로젝트 **루트**에 `.env` 파일을 두세요. 저장소에 `.env.example`이 없을 수 있으므로, 아래를 참고해 직접 생성하면 됩니다.

```env
# 백엔드가 클라이언트에 알려 줄 API 베이스 (파일 URL 등)
API_BASE_URL=http://localhost:8001

# 프론트(Vite) — 개발 시 선택. 자세한 동작은 src/utils/apiConfig.js 참고
VITE_API_BASE_URL=http://localhost:8001

# VIA (동영상 분석 서버)
VIA_SERVER_URL=http://localhost:8101
VITE_VIA_SERVER_URL=http://localhost:8101

# DB
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306
DB_NAME=vss

# Ollama (선택)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# CV Event Detector (선택)
CV_EVENT_DETECTOR_API_URL=http://localhost:23491
VITE_CV_EVENT_DETECTOR_API_URL=http://localhost:23491

# SMTP (이메일 인증·비밀번호 재설정, 선택)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
```

- 비밀번호·키는 **코드에 넣지 말고** `.env`만 사용합니다.
- SMTP 상세는 `docs/SMTP_SETUP_GUIDE.md` 또는 루트의 `setup_smtp.py`를 참고할 수 있습니다.

## 데이터베이스

1. MariaDB/MySQL에서 DB 생성 (예: `vss`, utf8mb4).
2. `sql/` 아래 스크립트를 순서에 맞게 실행해 테이블을 만듭니다 (예: `create_vss_user_table.sql` 등).
3. `.env`의 `DB_*` 값을 실제 서버에 맞게 설정합니다.

원격 DB를 쓰는 경우 방화벽·`bind-address`·사용자 권한을 확인하세요.

## 실행 방법

### 백엔드

**반드시 `backend` 디렉터리를 현재 디렉터리로 한 뒤** 실행합니다 (`config`, `routers` 등 상대 import 때문).

```bash
cd backend
python main.py
# 또는
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

- 기본 API 문서: `http://localhost:8001/docs`
- 로그: `backend/logs/` (날짜별 로그, 보관 정책은 `logging_config.py` 기준)

### 프론트엔드

프로젝트 **루트**에서:

```bash
npm run dev
```

- `vite.config.js`에서 포트 **3000**, `host: true`로 로컬 네트워크 접속이 가능합니다.

### 프로덕션 빌드 (예시)

```bash
# 프론트
npm run build
npm run preview -- --host 0.0.0.0 --port 3000

# 백엔드 (워커 수는 CPU에 맞게)
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

## 주요 기능

- **사용자**: 회원가입(이메일 인증), 로그인, 비밀번호 재설정, 프로필 이미지
- **동영상**: 업로드, 목록, 삭제, 메타데이터, 일부 포맷 MP4 변환
- **요약**: VIA 연동 요약 생성·저장·조회
- **검색**: 질의·클립·고속 검색 출력(`/fast-search-output`) 등
- **보고서**: 생성·목록·삭제(docx 등)

## API·정적 경로 개요

라우터별 세부 경로는 `backend/routers/*.py`와 Swagger(`GET /docs`)를 기준으로 하면 됩니다.

| 구분 | 예시 |
|------|------|
| 인증·사용자 | `auth`, `users` 라우터 |
| 동영상 | `/videos`, `/upload-video`, `/convert-video/{video_id}` 등 |
| 요약·검색·보고서 | `summarize`, `search`, `/reports` 프리픽스 |
| 정적 파일 | `/video-files`, `/converted-videos`, `/profile-images`, `/reports-files`, `/sample`, `/fast-search-output` |

## 문제 해결

- **백엔드에만 연결 안 됨**: 방화벽에서 8001 허용, `0.0.0.0` 바인딩 여부 확인.
- **DB 오류**: MariaDB 프로세스, `.env`의 `DB_*`, 방화벽 3306, 사용자 권한.
- **MoviePy/FFmpeg 오류**: `ffmpeg -version`으로 설치 확인.
- **CORS**: `main.py`에 CORS 미들웨어가 있음. 프론트가 가리키는 API URL(`VITE_API_BASE_URL` / `apiConfig.js`)이 실제 백엔드와 일치하는지 확인.
- **`.env` 미적용**: 루트 경로에 파일이 있는지, `python-dotenv` 설치 여부, `KEY=value` 형식 확인.

## 추가 문서

- `docs/SMTP_SETUP_GUIDE.md` — SMTP 설정
- `README_DEPLOYMENT.md`, `DEPLOYMENT_GUIDE.md` — 배포·프로세스 예시(경로는 문서 내용 기준으로 조정)

## 보안 권장

- 프로덕션에서 `allow_origins=["*"]` 제한, HTTPS, `--reload` 비사용
- DB 전용 계정·최소 권한, 정기 백업
- `.env`·비밀키는 Git에 올리지 않기

## 라이선스·지원

내부용 프로젝트로 가정합니다. 이슈 시 `backend/logs`·DB 연결·VIA/Ollama URL을 우선 확인하세요.

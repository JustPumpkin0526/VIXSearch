#!/bin/bash
# VSS 프로젝트 서버 중지 스크립트

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

echo "========================================"
echo "VSS 서버 중지 중..."
echo "========================================"

# PID 파일에서 프로세스 종료
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "백엔드 서버 중지 중... (PID: $BACKEND_PID)"
        kill $BACKEND_PID
    else
        echo "백엔드 서버가 실행 중이 아닙니다."
    fi
    rm logs/backend.pid
fi

if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "프론트엔드 서버 중지 중... (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID
    else
        echo "프론트엔드 서버가 실행 중이 아닙니다."
    fi
    rm logs/frontend.pid
fi

# 추가로 포트를 사용 중인 프로세스 종료 (안전장치)
echo "포트 8001과 5173을 사용 중인 프로세스 확인 중..."
lsof -ti:8001 | xargs -r kill -9 2>/dev/null
lsof -ti:5173 | xargs -r kill -9 2>/dev/null

echo "========================================"
echo "서버가 중지되었습니다."
echo "========================================"

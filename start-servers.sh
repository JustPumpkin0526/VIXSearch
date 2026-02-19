#!/bin/bash
# VSS 프로젝트 서버 시작 스크립트 (백그라운드 실행)

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

# 로그 디렉토리 생성
mkdir -p logs

echo "========================================"
echo "VSS 서버 시작 중..."
echo "========================================"

# 백엔드 서버 시작 (nohup 사용)
echo "백엔드 서버 시작 중..."
cd src/api
nohup python3 main.py > ../../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "백엔드 PID: $BACKEND_PID"
cd ../..

# 프론트엔드 서버 시작 (nohup 사용)
echo "프론트엔드 서버 시작 중..."
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "프론트엔드 PID: $FRONTEND_PID"

# PID를 파일에 저장
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid

echo "========================================"
echo "서버가 백그라운드에서 시작되었습니다!"
echo "백엔드 PID: $BACKEND_PID"
echo "프론트엔드 PID: $FRONTEND_PID"
echo "========================================"
echo "로그 확인:"
echo "  백엔드: tail -f logs/backend.log"
echo "  프론트엔드: tail -f logs/frontend.log"
echo ""
echo "서버 중지:"
echo "  ./stop-servers.sh"
echo "========================================"

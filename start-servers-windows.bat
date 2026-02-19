@echo off
REM VSS 프로젝트 Windows용 서버 시작 스크립트

echo ========================================
echo VSS 서버 시작 중...
echo ========================================

REM 로그 디렉토리 생성
if not exist logs mkdir logs

REM 백엔드 서버 시작 (새 창에서)
echo 백엔드 서버 시작 중...
start "VSS Backend" cmd /k "cd src\api && python main.py"

REM 잠시 대기
timeout /t 3 /nobreak >nul

REM 프론트엔드 서버 시작 (새 창에서)
echo 프론트엔드 서버 시작 중...
start "VSS Frontend" cmd /k "npm run dev"

echo ========================================
echo 서버가 새 창에서 시작되었습니다!
echo ========================================
echo 백엔드: http://localhost:8001
echo 프론트엔드: http://localhost:5173
echo ========================================
echo 서버를 종료하려면 각 창을 닫으세요.
echo ========================================

pause

@echo off
REM VSS 프로젝트 Windows용 서버 중지 스크립트

echo ========================================
echo VSS 서버 중지 중...
echo ========================================

REM Python 프로세스 종료
echo Python (백엔드) 프로세스 종료 중...
taskkill /IM python.exe /F 2>nul

REM Node.js 프로세스 종료
echo Node.js (프론트엔드) 프로세스 종료 중...
taskkill /IM node.exe /F 2>nul

REM 포트별 확인
echo.
echo 포트 8001 (백엔드) 사용 중인 프로세스 확인:
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8001') do (
    echo PID %%a 종료 중...
    taskkill /PID %%a /F 2>nul
)

echo 포트 5173 (프론트엔드) 사용 중인 프로세스 확인:
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo PID %%a 종료 중...
    taskkill /PID %%a /F 2>nul
)

echo.
echo ========================================
echo 서버가 중지되었습니다.
echo ========================================

pause

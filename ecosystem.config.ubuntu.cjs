/**
 * PM2 Ecosystem 설정 파일 (우분투/리눅스 전용)
 * 
 * 사용법:
 * 1. PM2 설치: npm install -g pm2
 * 2. Python 패키지 설치: pip install -r requirements.txt
 * 3. 서버 시작: pm2 start ecosystem.config.ubuntu.cjs
 * 4. 프로세스 확인: pm2 list
 * 5. 로그 확인: pm2 logs
 * 6. 서버 중지: pm2 stop all
 * 7. 서버 재시작: pm2 restart all
 * 8. 부팅 시 자동 시작: pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'vss-frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2-frontend-error.log',
      out_file: './logs/pm2-frontend-out.log',
      log_file: './logs/pm2-frontend-combined.log',
      time: true,
      min_uptime: '10s',
      max_restarts: 5,
    },
    {
      name: 'vss-backend',
      script: 'python3',
      args: 'main.py',
      cwd: './src/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_file: './logs/pm2-backend-combined.log',
      time: true,
      min_uptime: '10s',
      max_restarts: 5,
    },
  ],
};

/**
 * PM2 Ecosystem 설정 파일
 * PM2를 사용하여 프론트엔드와 백엔드를 백그라운드에서 실행합니다.
 * 
 * 사용법:
 * 1. PM2 설치: npm install -g pm2
 * 2. 서버 시작: pm2 start ecosystem.config.cjs
 * 3. 프로세스 확인: pm2 list
 * 4. 로그 확인: pm2 logs
 * 5. 서버 중지: pm2 stop all
 * 6. 서버 재시작: pm2 restart all
 * 7. 부팅 시 자동 시작: pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'vss-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true,
    },
    {
      name: 'vss-backend',
      script: 'python',
      args: 'main.py',
      cwd: './src/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
  ],
};

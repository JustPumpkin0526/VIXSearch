"""이메일 서비스"""
import random
import smtplib
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config.settings import (
    SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL,
    EMAIL_CODE_EXPIRY_MINUTES
)

logger = logging.getLogger(__name__)

# 이메일 인증 코드 저장소 (실제 운영에서는 Redis 등 사용 권장)
# 구조: {email: {"code": "123456", "expires_at": datetime, "verified": False}}
email_verification_codes = {}

# 비밀번호 재설정용 인증 코드 저장소
# 구조: {email: {"code": "123456", "expires_at": datetime, "verified": False, "username": "user_id"}}
reset_password_codes = {}

# SMTP 설정 로드 확인 로깅
if SMTP_USER and SMTP_PASSWORD:
    logger.info(f"SMTP 설정 로드 완료: SERVER={SMTP_SERVER}, PORT={SMTP_PORT}, USER={SMTP_USER[:3]}***")
else:
    logger.warning("SMTP 설정이 로드되지 않았습니다!")
    logger.warning(f"   SMTP_USER: {'설정됨' if SMTP_USER else '비어있음'}")
    logger.warning(f"   SMTP_PASSWORD: {'설정됨' if SMTP_PASSWORD else '비어있음'}")
    logger.warning("   .env 파일을 확인하거나 setup_smtp.py를 실행하여 설정하세요.")


def generate_verification_code():
    """6자리 인증 코드 생성"""
    return str(random.randint(100000, 999999))


def send_verification_email(to_email: str, code: str, is_reset_password: bool = False):
    """인증 코드를 이메일로 전송"""
    try:
        # 이메일 메시지 생성
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM_EMAIL
        msg['To'] = to_email
        purpose_text = "비밀번호 재설정" if is_reset_password else "회원가입"
        msg['Subject'] = f"VSS {purpose_text} 이메일 인증"
        
        # 이메일 본문 (HTML 형식으로 개선)
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
        .code-box {{ background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }}
        .code {{ font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VSS {purpose_text} 인증</h1>
        </div>
        <div class="content">
            <p>안녕하세요,</p>
            <p>VSS {purpose_text}을 위한 이메일 인증 코드입니다.</p>
            <div class="code-box">
                <div class="code">{code}</div>
            </div>
            <p>이 코드는 <strong>10분간</strong> 유효합니다.</p>
            <p style="color: #999; font-size: 12px;">본인이 요청한 것이 아니라면 이 이메일을 무시하세요.</p>
        </div>
        <div class="footer">
            <p>감사합니다.<br>VSS Team</p>
        </div>
    </div>
</body>
</html>
        """
        
        # 텍스트 버전도 포함 (HTML을 지원하지 않는 클라이언트용)
        text_body = f"""
안녕하세요,

VSS {purpose_text}을 위한 이메일 인증 코드입니다.

인증 코드: {code}

이 코드는 10분간 유효합니다.
본인이 요청한 것이 아니라면 이 이메일을 무시하세요.

감사합니다.
VSS Team
        """
        
        # HTML과 텍스트 버전 모두 첨부
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        
        # SMTP 서버 연결 및 이메일 전송
        if SMTP_USER and SMTP_PASSWORD:
            # 포트 465는 SSL, 포트 587은 TLS 사용
            if SMTP_PORT == 465:
                # SSL 사용 (Naver, Daum 등)
                server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
                server.login(SMTP_USER, SMTP_PASSWORD)
            else:
                # TLS 사용 (Gmail, Outlook 등)
                server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
            
            text = msg.as_string()
            server.sendmail(SMTP_FROM_EMAIL, to_email, text)
            server.quit()
            logger.info(f"인증 코드 이메일 전송 성공: {to_email}")
            return True
        else:
            # SMTP 설정이 없으면 로그만 출력 (개발 환경)
            logger.warning(f"SMTP 설정이 없어 이메일을 전송하지 않습니다.")
            logger.warning(f"인증 코드: {code} (이메일: {to_email})")
            logger.warning(f"실제 운영 환경에서는 .env 파일에 SMTP 설정을 추가하세요.")
            return True  # 개발 환경에서는 항상 성공으로 처리
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP 인증 실패: {e}")
        logger.error(f"사용자명과 비밀번호를 확인하세요. Gmail의 경우 앱 비밀번호를 사용해야 합니다.")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP 오류: {e}")
        return False
    except Exception as e:
        logger.error(f"이메일 전송 실패: {e}")
        logger.error(f"SMTP 설정 확인: SERVER={SMTP_SERVER}, PORT={SMTP_PORT}, USER={SMTP_USER[:3] + '***' if SMTP_USER else 'None'}")
        return False


def cleanup_expired_codes():
    """만료된 인증 코드 정리"""
    current_time = datetime.now()
    expired_emails = [
        email for email, data in email_verification_codes.items()
        if data["expires_at"] < current_time
    ]
    for email in expired_emails:
        del email_verification_codes[email]


def cleanup_expired_reset_codes():
    """만료된 비밀번호 재설정 인증 코드 정리"""
    current_time = datetime.now()
    expired_emails = [
        email for email, data in reset_password_codes.items()
        if data["expires_at"] < current_time
    ]
    for email in expired_emails:
        del reset_password_codes[email]


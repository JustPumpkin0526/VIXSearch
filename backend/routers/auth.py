"""인증 관련 라우터"""
import re
import bcrypt
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel
from database.services.vss_user_service import UserService

# from utils.validators import validate_email
from exceptions import NotFoundException, ValidationException, DatabaseException
from services.email_service import (
    email_verification_codes, reset_password_codes,
    generate_verification_code, send_verification_email,
    cleanup_expired_codes, cleanup_expired_reset_codes
)
from app_config.settings import EMAIL_CODE_EXPIRY_MINUTES, ENABLE_EMAIL_VERIFICATION

logger = logging.getLogger(__name__)

from utils.helpers import is_validated_email

router = APIRouter()

# ==================== 요청 모델 ====================
class LoginRequest(BaseModel):
    username: str
    password: str

class SendVerificationCodeRequest(BaseModel):
    email: str

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class User(BaseModel):
    username: str
    password: str
    email: str
    verification_code: str = ""  # 이메일 인증이 비활성화된 경우 빈 문자열 허용

class SendResetPasswordCodeRequest(BaseModel):
    username: str
    email: str

class VerifyResetPasswordCodeRequest(BaseModel):
    username: str
    email: str
    code: str

class ResetPasswordRequest(BaseModel):
    username: str
    email: str
    verification_code: str
    new_password: str

# ==================== 엔드포인트 ====================
@router.get("/email-verification-enabled")
def get_email_verification_enabled():
    """이메일 인증 활성화 여부 확인"""
    return {"enabled": ENABLE_EMAIL_VERIFICATION}

# NOTE: `is_validated_email` is provided from `utils.helpers` to avoid circular imports.

def verify_user_exists(user_id: str):
    """사용자 존재 확인 헬퍼 (예외 발생 시 NotFoundException)"""
    if not user_id:
        raise NotFoundException("사용자", "(없음)")
    result = UserService.get_email_with_user_id(user_id)
    if not result.get("success"):
        raise NotFoundException("사용자", user_id)
    return True

@router.post("/login")
def login(data: LoginRequest = Body(...)):
    """로그인"""
    result = UserService.check_user_login(data.username)
    if not result["success"]:
        return result
    
    try:
        if not bcrypt.checkpw(data.password.encode("utf-8"), result["db_pw"].encode("utf-8")):
            return {"success": False, "message": "비밀번호가 틀렸습니다."}
    except Exception as e:
        logger.warning(f"비밀번호 검증 실패: {e}")
        return {"success": False, "message": "비밀번호 검증 중 오류가 발생했습니다."}

    if result["role"] != "ADMIN" and not result["approved"]:
        return {"success": False, "message": "관리자 승인 대기 중입니다."}

    return {"success": True, "role": result["role"], "approved": result["approved"]}

@router.get("/debug/email-check/{email}")
def debug_email_check(email: str):
    """ (임시) 이메일 검증 디버깅용 엔드포인트"""
    [b_validated, email_lower] = is_validated_email(email)

    result = UserService.get_user_id_with_email(email_lower)
    is_existing = result["success"]
    user_id = result["user_id"] if is_existing else None
    
    return {
        "email": email_lower,
        "is_valid_format": b_validated,
        "is_existing": is_existing,
        "existing_user_id": user_id
    }

@router.post("/send-verification-code")
def send_verification_code(request: SendVerificationCodeRequest):
    """이메일 인증 코드 전송"""
    try:
        # 요청 데이터 로깅
        logger.info(f"인증 코드 전송 요청 수신: {request.email}")
        [b_validated, email] = is_validated_email(request.email)    
        logger.info(f"처리할 이메일: {email}")

        result = UserService.get_user_id_with_email(email)
        if result["success"]:
            logger.warning(f"이미 사용 중인 이메일: {email}")
            raise ValidationException("이미 사용 중인 이메일입니다.")
        
        # 만료된 코드 정리
        cleanup_expired_codes()
        
        # 인증 코드 생성 및 저장
        code = generate_verification_code()
        expires_at = datetime.now() + timedelta(minutes=EMAIL_CODE_EXPIRY_MINUTES)
        
        email_verification_codes[email] = {
            "code": code,
            "expires_at": expires_at,
            "verified": False
        }
        logger.info(f"인증 코드 생성 완료: {email} (코드: {code})")
        
        # 이메일 전송
        if send_verification_email(email, code):
            logger.info(f"인증 코드 이메일 전송 성공: {email}")
            return {"success": True, "message": "인증 코드가 이메일로 전송되었습니다."}
        else:
            logger.error(f"이메일 전송 실패: {email}")
            raise HTTPException(status_code=500, detail="이메일 전송에 실패했습니다. SMTP 설정을 확인하거나 다시 시도해주세요.")
    except HTTPException:
        # HTTPException은 그대로 전달
        raise
    except Exception as e:
        logger.error(f"인증 코드 전송 중 예상치 못한 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"서버 오류가 발생했습니다: {str(e)}")

@router.post("/verify-email-code")
def verify_email_code(request: VerifyEmailRequest):
    """이메일 인증 코드 검증"""
    [b_validated, email] = is_validated_email(request.email)
    code = request.code.strip()
    
    # 만료된 코드 정리
    cleanup_expired_codes()
    
    # 인증 코드 확인
    if email not in email_verification_codes:
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 존재하지 않습니다. 다시 요청해주세요.")
    
    verification_data = email_verification_codes[email]
    
    # 만료 확인
    if verification_data["expires_at"] < datetime.now():
        del email_verification_codes[email]
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다. 다시 요청해주세요.")
    
    # 코드 일치 확인
    if verification_data["code"] != code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    
    # 인증 성공 표시
    verification_data["verified"] = True
    logger.info(f"이메일 인증 성공: {email}")
    return {"success": True, "message": "이메일 인증이 완료되었습니다."}

@router.post("/register")
def register(user: User):
    """회원가입 (이메일 인증 선택적)"""
    # 이메일 인증이 활성화된 경우에만 이메일 검증 및 인증 확인
    if ENABLE_EMAIL_VERIFICATION:
        [b_validated, email] = is_validated_email(user.email)
        cleanup_expired_codes()
        if email not in email_verification_codes:
            raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다. 인증 코드를 먼저 요청해주세요.")
        
        verification_data = email_verification_codes[email]
        
        # 인증 코드 검증 확인
        if not verification_data["verified"]:
            raise HTTPException(status_code=400, detail="이메일 인증이 완료되지 않았습니다. 인증 코드를 먼저 검증해주세요.")
        
        # 인증 코드 만료 확인
        if verification_data["expires_at"] < datetime.now():
            del email_verification_codes[email]
            raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다. 다시 요청해주세요.")
        
        # 최종 인증 코드 확인 (추가 보안)
        if verification_data["code"] != user.verification_code.strip():
            raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    else:
        # 이메일 인증이 비활성화된 경우, 이메일이 있으면 검증하고 없으면 빈 문자열 허용
        if user.email and user.email.strip():
            [b_validated, email] = is_validated_email(user.email)
        else:
            email = ""
    
    try:
        # 비밀번호를 bcrypt로 해시화
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
        hashed_password = hashed_password.decode('utf-8')

        result = UserService.register_user(user.username, hashed_password, email)
        if not result["success"]:
            logger.warning(f"회원가입 실패: {result['message']} (username: {user.username}, email: {email})")
            raise ValidationException(result["message"])
        
        # 회원가입 성공 후 인증 코드 삭제 (이메일 인증이 활성화된 경우에만)
        if ENABLE_EMAIL_VERIFICATION and email in email_verification_codes:
            del email_verification_codes[email]
        
        logger.info(f"회원가입 성공: {user.username} ({email})")
        return {"message": "회원가입 성공"}
    except ValidationException as ve:
        raise HTTPException(status_code=400, detail=ve.message)

@router.post("/send-reset-password-code")
def send_reset_password_code(request: SendResetPasswordCodeRequest):
    """비밀번호 재설정용 이메일 인증 코드 전송"""
    try:
        username = request.username.strip()
        email = request.email.strip().lower()
        
        if not username:
            raise HTTPException(status_code=400, detail="ID를 입력해주세요.")
        [b_validated, email] = is_validated_email(request.email)

        result = UserService.get_user_email_with_id(username)
        if not result["success"]:
            raise NotFoundException("사용자", username)
        email = result["email"]
        if email != request.email.strip().lower():
            raise ValidationException("등록된 이메일과 일치하지 않습니다.")
        
        # 만료된 코드 정리
        cleanup_expired_reset_codes()
        
        # 인증 코드 생성 및 저장
        code = generate_verification_code()
        expires_at = datetime.now() + timedelta(minutes=EMAIL_CODE_EXPIRY_MINUTES)
        
        reset_password_codes[email] = {
            "code": code,
            "expires_at": expires_at,
            "verified": False,
            "username": username
        }
        logger.info(f"비밀번호 재설정 인증 코드 생성 완료: {email} (코드: {code})")
        
        # 이메일 전송
        if send_verification_email(email, code, is_reset_password=True):
            logger.info(f"비밀번호 재설정 인증 코드 이메일 전송 성공: {email}")
            return {"success": True, "message": "인증 코드가 이메일로 전송되었습니다."}
        else:
            logger.error(f"이메일 전송 실패: {email}")
            raise HTTPException(status_code=500, detail="이메일 전송에 실패했습니다. SMTP 설정을 확인하거나 다시 시도해주세요.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"비밀번호 재설정 인증 코드 전송 중 예상치 못한 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"서버 오류가 발생했습니다: {str(e)}")

@router.post("/verify-reset-password-code")
def verify_reset_password_code(request: VerifyResetPasswordCodeRequest):
    """비밀번호 재설정용 이메일 인증 코드 검증"""
    username = request.username.strip()
    [b_validated, email] = is_validated_email(request.email)
    code = request.code.strip()
    
    # 만료된 코드 정리
    cleanup_expired_reset_codes()
    
    # 인증 코드 확인
    if email not in reset_password_codes:
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 존재하지 않습니다. 다시 요청해주세요.")
    
    verification_data = reset_password_codes[email]
    
    # 사용자 ID 일치 확인
    if verification_data["username"] != username:
        raise HTTPException(status_code=400, detail="사용자 ID가 일치하지 않습니다.")
    
    # 만료 확인
    if verification_data["expires_at"] < datetime.now():
        del reset_password_codes[email]
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다. 다시 요청해주세요.")
    
    # 코드 일치 확인
    if verification_data["code"] != code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    
    # 인증 성공 표시
    verification_data["verified"] = True
    logger.info(f"비밀번호 재설정 이메일 인증 성공: {email}")
    return {"success": True, "message": "이메일 인증이 완료되었습니다."}

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    """비밀번호 재설정"""
    username = request.username.strip()
    [b_validated, email] = is_validated_email(request.email)
    code = request.verification_code.strip()
    new_password = request.new_password
    
    # 비밀번호 길이 검증
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    
    # 이메일 인증 확인
    cleanup_expired_reset_codes()
    if email not in reset_password_codes:
        raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다. 인증 코드를 먼저 요청해주세요.")
    
    verification_data = reset_password_codes[email]
    
    # 인증 코드 검증 확인
    if not verification_data["verified"]:
        raise HTTPException(status_code=400, detail="이메일 인증이 완료되지 않았습니다. 인증 코드를 먼저 검증해주세요.")
    
    # 사용자 ID 일치 확인
    if verification_data["username"] != username:
        raise HTTPException(status_code=400, detail="사용자 ID가 일치하지 않습니다.")
    
    # 인증 코드 만료 확인
    if verification_data["expires_at"] < datetime.now():
        del reset_password_codes[email]
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었습니다. 다시 요청해주세요.")
    
    # 최종 인증 코드 확인 (추가 보안)
    if verification_data["code"] != code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    
    try:
        # 새 비밀번호를 bcrypt로 해시화
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        hashed_password = hashed_password.decode('utf-8')


        result = UserService.change_password(username, email, hashed_password)

        if not result["success"]:
            logger.warning(f"비밀번호 재설정 실패: {result['message']} (username: {username}, email: {email})")
            raise ValidationException(result["message"])
        
        # 비밀번호 재설정 성공 후 인증 코드 삭제
        del reset_password_codes[email]
        
        logger.info(f"비밀번호 재설정 성공: {username} ({email})")
        return {"success": True, "message": "비밀번호가 재설정되었습니다."}
    except Exception as e:
        logger.error(f"비밀번호 재설정 실패: {e}")
        raise HTTPException(status_code=500, detail="비밀번호 재설정에 실패했습니다.")


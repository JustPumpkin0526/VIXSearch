"""검증 유틸리티 함수"""
import re
from fastapi import HTTPException
from config.settings import EMAIL_REGEX

def validate_email(email: str) -> str:
    """이메일 형식 검증 및 정규화"""
    if not email or not email.strip():
        raise HTTPException(status_code=400, detail="이메일 주소를 입력해주세요.")
    email = email.strip().lower()
    if not re.match(EMAIL_REGEX, email):
        raise HTTPException(status_code=400, detail="올바른 이메일 형식이 아닙니다.")
    return email


"""커스텀 예외 클래스"""
from fastapi import HTTPException
from typing import Optional


class VSSException(HTTPException):
    """VSS 애플리케이션 기본 예외 클래스"""
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code


class DatabaseException(VSSException):
    """데이터베이스 관련 예외"""
    def __init__(self, detail: str, error_code: str = "DB_ERROR"):
        super().__init__(status_code=500, detail=detail, error_code=error_code)


class ValidationException(VSSException):
    """검증 관련 예외"""
    def __init__(self, detail: str, error_code: str = "VALIDATION_ERROR"):
        super().__init__(status_code=400, detail=detail, error_code=error_code)


class NotFoundException(VSSException):
    """리소스를 찾을 수 없을 때 예외"""
    def __init__(self, resource: str, resource_id: Optional[str] = None, error_code: str = "NOT_FOUND"):
        detail = f"{resource}을(를) 찾을 수 없습니다."
        if resource_id:
            detail = f"{resource} (ID: {resource_id})을(를) 찾을 수 없습니다."
        super().__init__(status_code=404, detail=detail, error_code=error_code)


class UnauthorizedException(VSSException):
    """인증/인가 관련 예외"""
    def __init__(self, detail: str = "인증이 필요합니다.", error_code: str = "UNAUTHORIZED"):
        super().__init__(status_code=401, detail=detail, error_code=error_code)


class ForbiddenException(VSSException):
    """권한 부족 예외"""
    def __init__(self, detail: str = "권한이 없습니다.", error_code: str = "FORBIDDEN"):
        super().__init__(status_code=403, detail=detail, error_code=error_code)


class ExternalServiceException(VSSException):
    """외부 서비스 호출 실패 예외"""
    def __init__(self, service_name: str, detail: Optional[str] = None, error_code: str = "EXTERNAL_SERVICE_ERROR"):
        if not detail:
            detail = f"{service_name} 서비스 호출에 실패했습니다."
        super().__init__(status_code=502, detail=detail, error_code=error_code)

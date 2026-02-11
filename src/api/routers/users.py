"""사용자 관리 라우터"""
import time
import logging
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from database.connection import conn, cursor, ensure_db_connection, verify_user_exists, get_db_connection
from utils.validators import validate_email
from utils.helpers import build_file_url
from config.settings import ALLOWED_IMAGE_EXTENSIONS, PROFILE_IMAGES_DIR

logger = logging.getLogger(__name__)

router = APIRouter()

def _format_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)

class UpdateUserEmailRequest(BaseModel):
    email: str

class ApproveUserRequest(BaseModel):
    admin_id: str
    user_id: str
    approved: bool = True

@router.get("/user/{user_id}")
def get_user_info(user_id: str):
    """사용자 정보 조회"""
    try:
        verify_user_exists(user_id)
        with get_db_connection() as local_cursor:
            local_cursor.execute(
                "SELECT ID, EMAIL, CREATED_AT, UPDATED_AT, ROLE, APPROVED FROM vss_user WHERE ID = ?",
                (user_id,)
            )
            row = local_cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        
        # 프로필 이미지 경로 조회 (PROFILE_IMAGE_URL 필드가 있는 경우)
        profile_image_url = None
        try:
            with get_db_connection() as local_cursor:
                local_cursor.execute(
                    "SELECT PROFILE_IMAGE_URL FROM vss_user WHERE ID = ?",
                    (user_id,)
                )
                profile_row = local_cursor.fetchone()
            if profile_row and profile_row[0]:
                profile_image_url = profile_row[0]
        except Exception as e:
            # PROFILE_IMAGE_URL 필드가 없을 수 있으므로 무시
            logger.debug(f"프로필 이미지 조회 중 오류 (무시됨): {e}")
        
        # profile_image_url이 있으면 build_file_url로 전체 URL 생성
        if profile_image_url:
            profile_image_url = build_file_url(profile_image_url)
        
        return {
            "success": True,
            "user": {
                "id": row[0],
                "email": row[1],
                "created_at": _format_datetime(row[2]),
                "updated_at": _format_datetime(row[3]),
                "profile_image_url": profile_image_url,
                "role": row[4] if len(row) > 4 else "USER",
                "approved": bool(row[5]) if len(row) > 5 else True
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사용자 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 정보 조회 중 오류가 발생했습니다: {str(e)}")

@router.put("/user/{user_id}/email")
def update_user_email(user_id: str, request: UpdateUserEmailRequest):
    """사용자 이메일 업데이트"""
    try:
        verify_user_exists(user_id)
        email = validate_email(request.email)
        
        ensure_db_connection()
        cursor.execute(
            "UPDATE vss_user SET EMAIL = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (email, user_id)
        )
        conn.commit()
        
        logger.info(f"사용자 이메일 업데이트 성공: {user_id} -> {email}")
        return {"success": True, "message": "이메일이 업데이트되었습니다.", "email": email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사용자 이메일 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail=f"이메일 업데이트 중 오류가 발생했습니다: {str(e)}")

@router.post("/user/{user_id}/profile-image")
async def upload_profile_image(user_id: str, file: UploadFile = File(...)):
    """사용자 프로필 이미지 업로드"""
    try:
        verify_user_exists(user_id)
        
        # 파일 확장자 검증
        if not file.filename:
            raise HTTPException(status_code=400, detail="파일명이 없습니다.")
        
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 이미지 형식입니다: {file_ext}. 지원 형식: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}")
        
        # 파일 크기 제한 (5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="이미지 파일 크기는 5MB를 초과할 수 없습니다.")
        
        # 고유한 파일명 생성
        timestamp = int(time.time() * 1000)
        unique_filename = f"{user_id}_{timestamp}{file_ext}"
        file_path = PROFILE_IMAGES_DIR / unique_filename
        file_url = f"/profile-images/{unique_filename}"
        
        # 파일 저장
        PROFILE_IMAGES_DIR.mkdir(exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # DB 업데이트 (PROFILE_IMAGE_URL 필드가 있는 경우)
        try:
            ensure_db_connection()
            cursor.execute(
                "UPDATE vss_user SET PROFILE_IMAGE_URL = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
                (file_url, user_id)
            )
            conn.commit()
            logger.info(f"프로필 이미지 업로드 성공: {user_id} -> {file_url}")
        except Exception as e:
            # PROFILE_IMAGE_URL 필드가 없을 수 있으므로 경고만 출력
            logger.warning(f"프로필 이미지 URL DB 업데이트 실패 (필드가 없을 수 있음): {e}")
        
        return {
            "success": True,
            "message": "프로필 이미지가 업로드되었습니다.",
            "profile_image_url": build_file_url(file_url)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"프로필 이미지 업로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"프로필 이미지 업로드 중 오류가 발생했습니다: {str(e)}")

@router.post("/admin/approve-user")
def approve_user(request: ApproveUserRequest):
    """관리자 승인/반려 처리"""
    try:
        ensure_db_connection()
        cursor.execute(
            "SELECT ROLE, APPROVED FROM vss_user WHERE ID = ?",
            (request.admin_id,)
        )
        admin_row = cursor.fetchone()
        if not admin_row:
            raise HTTPException(status_code=404, detail="관리자 계정을 찾을 수 없습니다.")
        admin_role = admin_row[0] if admin_row else None
        if (admin_role or "").strip().upper() != "ADMIN":
            raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")

        verify_user_exists(request.user_id)
        cursor.execute(
            "UPDATE vss_user SET APPROVED = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (1 if request.approved else 0, request.user_id)
        )
        conn.commit()

        return {
            "success": True,
            "user_id": request.user_id,
            "approved": bool(request.approved)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"사용자 승인 처리 실패: {e}")
        raise HTTPException(status_code=500, detail="사용자 승인 처리 중 오류가 발생했습니다.")

@router.get("/admin/pending-users")
def list_pending_users(admin_id: str):
    """승인 대기 사용자 목록 조회"""
    try:
        ensure_db_connection()
        cursor.execute(
            "SELECT ROLE, APPROVED FROM vss_user WHERE ID = ?",
            (admin_id,)
        )
        admin_row = cursor.fetchone()
        if not admin_row:
            raise HTTPException(status_code=404, detail="관리자 계정을 찾을 수 없습니다.")
        admin_role = admin_row[0] if admin_row else None
        if (admin_role or "").strip().upper() != "ADMIN":
            raise HTTPException(status_code=403, detail="관리자 권한이 없습니다.")

        cursor.execute(
            "SELECT ID, EMAIL, CREATED_AT FROM vss_user WHERE APPROVED = 0 AND UPPER(ROLE) != 'ADMIN' ORDER BY CREATED_AT DESC"
        )
        rows = cursor.fetchall() or []
        users = []
        for row in rows:
            users.append({
                "id": row[0],
                "email": row[1],
                "created_at": row[2].isoformat() if row[2] else None
            })

        return {"success": True, "users": users}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"승인 대기 사용자 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="승인 대기 사용자 조회 중 오류가 발생했습니다.")

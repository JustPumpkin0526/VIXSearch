from ..orm.vss_user import VSSUser as User
from ..repositories.vss_user_repo import UserRepository
from ..db.connection import get_db_connection
from typing import Dict
import bcrypt

from exceptions import NotFoundException, ValidationException, DatabaseException, ForbiddenException
from utils.helpers import is_validated_email
from .vss_file_service import FileService

import logging
logger = logging.getLogger(__name__)

def _format_datetime(value):
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)

class UserService:

    @staticmethod
    def check_user_login(username: str):
        with get_db_connection() as db:
            user = UserRepository.get_user_by_id(username, db)
            if not user:
                raise NotFoundException("사용자", username)
            
            return {
                "success": True,
                "db_pw": user.PW,
                "role": user.ROLE or "USER",
                "approved": bool(user.APPROVED)
            }

    @staticmethod
    def register_user(username: str, password: str, email: str):
        with get_db_connection() as db:
            # 중복 체크
            if UserRepository.get_user_by_id(username, db):
                return {"success": False, "message": "이미 존재하는 사용자 ID입니다."}
            if UserRepository.get_user_by_email(email, db):
                return {"success": False, "message": "이미 사용 중인 이메일입니다."}

        hashed_pw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        new_user = User(ID=username, PW=hashed_pw, EMAIL=email, ROLE="USER", APPROVED=False)
        UserRepository.create(new_user, db)

        return {"success": True, "message": "회원가입 성공"}

    @staticmethod
    def change_password(username: str, email: str, new_password: str):
        with get_db_connection() as db:
            hashed_pw = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            updated = UserRepository.update_password(username, email, hashed_pw, db)
            if not updated:
                return {"success": False, "message": "사용자 정보가 일치하지 않습니다."}
            return {"success": True, "message": "비밀번호 변경 성공"}

    @staticmethod
    def get_user_id_with_email(email: str):
        with get_db_connection() as db:
            user = UserRepository.get_user_by_email(email, db)
            if not user:
                return {"success": False, "message": "해당 이메일로 등록된 계정이 없습니다."}
            return {"success": True, "user_id": user.ID}

    @staticmethod
    def get_email_with_user_id(user_id: str):
        with get_db_connection() as db:
            user = UserRepository.get_user_by_id(user_id, db)
            if not user:
                return {"success": False, "message": "해당 사용자 ID가 없습니다."}
            return {"success": True, "email": user.EMAIL}
        
    @staticmethod
    def get_user_info(db, user_id: str):
        user = UserRepository.get_user_by_id(user_id, db)

        if not user:
            raise NotFoundException("사용자", user_id)

        return {
            "success": True,
            "user": {
                "id": user.ID,
                "email": user.EMAIL,
                "created_at": _format_datetime(user.CREATED_AT),
                "updated_at": _format_datetime(user.UPDATED_AT),
                "profile_image_url": getattr(user, "PROFILE_IMAGE_URL", None),
                "role": user.ROLE or "USER",
                "approved": bool(user.APPROVED)
            }
        }

    @staticmethod
    def update_email(db, user_id: str, email: str):
        if not UserRepository.exists(db, user_id):
            raise NotFoundException("사용자", user_id)

        email = is_validated_email(email)

        UserRepository.update_email(db, user_id, email)
        db.commit()

        return {
            "success": True,
            "email": email
        }

    @staticmethod
    async def upload_profile_image(db, user_id: str, file):
        if not UserRepository.exists(db, user_id):
            raise NotFoundException("사용자", user_id)

        file_url = await FileService.save_profile_image(user_id, file)

        try:
            UserRepository.update_profile_image(db, user_id, file_url)
            db.commit()
        except Exception:
            logger.warning("PROFILE_IMAGE_URL 필드 없음 (무시)")

        return {
            "success": True,
            "profile_image_url": file_url
        }

    @staticmethod
    def approve_user(db, admin_id: str, user_id: str, approved: bool):
        admin = UserRepository.get_user_by_id(admin_id, db)

        if not admin:
            raise NotFoundException("관리자", admin_id)

        if (admin.ROLE or "").upper() != "ADMIN":
            raise ForbiddenException("관리자 권한 없음")

        if not UserRepository.exists(db, user_id):
            raise NotFoundException("사용자", user_id)

        UserRepository.approve_user(db, user_id, approved)
        db.commit()

        return {
            "success": True,
            "user_id": user_id,
            "approved": approved
        }

    @staticmethod
    def list_pending_users(db, admin_id: str):
        admin = UserRepository.get_user_by_id(admin_id, db)

        if not admin:
            raise NotFoundException("관리자", admin_id)

        if (admin.ROLE or "").upper() != "ADMIN":
            raise ForbiddenException("관리자 권한 없음")

        users = UserRepository.get_pending_users(db)

        return {
            "success": True,
            "users": [
                {
                    "id": u.ID,
                    "email": u.EMAIL,
                    "created_at": _format_datetime(u.CREATED_AT)
                }
                for u in users
            ]
        }
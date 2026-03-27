"""사용자 관리 라우터"""
# import time
import logging
# from pathlib import Path
from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel
# from database.db.connection import get_db_connection
# from routers.auth import is_validated_email
# from app_config.settings import ALLOWED_IMAGE_EXTENSIONS, PROFILE_IMAGES_DIR
# from exceptions import NotFoundException, ValidationException, DatabaseException, ForbiddenException

from database.services.vss_user_service import UserService
from database.db.connection import get_db_connection

logger = logging.getLogger(__name__)

router = APIRouter()

class UpdateUserEmailRequest(BaseModel):
    email: str

class ApproveUserRequest(BaseModel):
    admin_id: str
    user_id: str
    approved: bool = True

@router.get("/user/{user_id}")
def get_user_info(user_id: str):
    with get_db_connection() as db:
        return UserService.get_user_info(db, user_id)

@router.put("/user/{user_id}/email")
def update_email(user_id: str, request: UpdateUserEmailRequest):
    with get_db_connection() as db:
        return UserService.update_email(db, user_id, request.email)

@router.post("/user/{user_id}/profile-image")
async def upload_profile(user_id: str, file: UploadFile):
    with get_db_connection() as db:
        return await UserService.upload_profile_image(db, user_id, file)

@router.post("/admin/approve-user")
def approve_user(request: ApproveUserRequest):
    with get_db_connection() as db:
        return UserService.approve_user(db, request.admin_id, request.user_id, request.approved)

@router.get("/admin/pending-users")
def pending_users(admin_id: str):
    with get_db_connection() as db:
        return UserService.list_pending_users(db, admin_id)
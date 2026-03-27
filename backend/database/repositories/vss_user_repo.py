from sqlalchemy.orm import Session
from typing import Optional
from ..orm.vss_user import VSSUser as User
from database.db.connection import get_db_connection

class UserRepository:

    @staticmethod
    def create(user: User, db: Session) -> User:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_user_by_id(user_id: str, db: Session) -> Optional[User]:
        return db.query(User).filter(User.ID == user_id).first()

    @staticmethod
    def get_user_by_email(email: str, db: Session) -> Optional[User]:
        return db.query(User).filter(User.EMAIL == email).first()

    @staticmethod
    def update_password(user_id: str, email: str, new_password: str, db: Session) -> bool:
        user = db.query(User).filter(User.ID == user_id, User.EMAIL == email).first()
        if not user:
            return False
        user.PW = new_password
        db.commit()
        db.refresh(user)
        return True
    
    @staticmethod
    def exists(db: Session, user_id: str) -> bool:
        return db.query(User.ID).filter(User.ID == user_id).first() is not None

    @staticmethod
    def exists_by_id(user_id: str) -> bool:
        """Check existence of user by ID using an internal session."""
        try:
            with get_db_connection() as db:
                return db.query(User.ID).filter(User.ID == user_id).first() is not None
        except Exception:
            return False

    @staticmethod
    def update_email(db: Session, user_id: str, email: str):
        return db.query(User).filter(User.ID == user_id).update({
            "EMAIL": email
        })

    @staticmethod
    def update_profile_image(db: Session, user_id: str, file_url: str):
        return db.query(User).filter(User.ID == user_id).update({
            "PROFILE_IMAGE_URL": file_url
        })

    @staticmethod
    def approve_user(db: Session, user_id: str, approved: bool):
        return db.query(User).filter(User.ID == user_id).update({
            "APPROVED": 1 if approved else 0
        })

    @staticmethod
    def get_pending_users(db: Session):
        return db.query(User).filter(
            User.APPROVED == 0,
            User.ROLE != "ADMIN"
        ).order_by(User.CREATED_AT.desc()).all()
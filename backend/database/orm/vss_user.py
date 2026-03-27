from sqlalchemy import Column, String, TIMESTAMP, Integer, SmallInteger
from sqlalchemy.orm import relationship
from ..db.connection import Base

class VSSUser(Base):
    __tablename__ = "vss_user"

    ID = Column(String(50), primary_key=True)
    PW = Column(String(255), nullable=False)
    EMAIL = Column(String(255), unique=True, nullable=False)
    CREATED_AT = Column(TIMESTAMP)
    UPDATED_AT = Column(TIMESTAMP)
    PROFILE_IMAGE_URL = Column(String(255))
    ROLE = Column(String(50))
    APPROVED = Column(SmallInteger, default=0)

    reports = relationship("VSSReport", back_populates="user")
    summaries = relationship("VSSSummary", back_populates="user")
    videos = relationship("VSSVideo", back_populates="user")
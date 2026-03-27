from sqlalchemy import Column, Integer, String, BigInteger, Float, TIMESTAMP, ForeignKey, Index
from sqlalchemy.orm import relationship
from ..db.connection import Base

class VSSVideo(Base):
    __tablename__ = "vss_videos"
    __table_args__ = (
        Index("idx_user_id", "USER_ID"),
    )

    ID = Column(Integer, primary_key=True, autoincrement=True)
    USER_ID = Column(String(50), ForeignKey("vss_user.ID"), nullable=False)
    VIDEO_ID = Column(String(255), nullable=False)
    FILE_NAME = Column(String(255), nullable=False)
    FILE_PATH = Column(String(255))
    FILE_SIZE = Column(BigInteger)
    FILE_URL = Column(String(255))
    WIDTH = Column(Integer)
    HEIGHT = Column(Integer)
    DURATION = Column(Float)
    CREATED_AT = Column(TIMESTAMP)
    UPDATED_AT = Column(TIMESTAMP)

    user = relationship("VSSUser", back_populates="videos")
from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from ..db.connection import Base

class VSSSummary(Base):
    __tablename__ = "vss_summaries"
    __table_args__ = (
        UniqueConstraint("VIDEO_ID", "USER_ID", name="uq_video_user"),
        Index("idx_video_user", "VIDEO_ID", "USER_ID")
    )

    ID = Column(Integer, primary_key=True, autoincrement=True)
    VIDEO_ID = Column(String(255), nullable=False)
    USER_ID = Column(String(50), ForeignKey("vss_user.ID"), nullable=False)
    PROMPT = Column(Text)
    SUMMARY_TEXT = Column(Text)
    CREATED_AT = Column(TIMESTAMP)
    UPDATED_AT = Column(TIMESTAMP)

    user = relationship("VSSUser", back_populates="summaries")
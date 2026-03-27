from sqlalchemy import Column, Integer, String, Text, BigInteger, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from ..db.connection import Base

class VSSReport(Base):
    __tablename__ = "vss_reports"

    ID = Column(Integer, primary_key=True, autoincrement=True)
    USER_ID = Column(String(50), ForeignKey("vss_user.ID"), nullable=False)
    TITLE = Column(String(255), nullable=False)
    DESCRIPTION = Column(Text)
    CONTENT = Column(Text)
    WORD_COUNT = Column(Integer)
    VIDEO_IDS = Column(Text)
    VIDEO_TITLES = Column(Text)
    CREATED_AT = Column(TIMESTAMP)
    UPDATED_AT = Column(TIMESTAMP)

    user = relationship("VSSUser", back_populates="reports")
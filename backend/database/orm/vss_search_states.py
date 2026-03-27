from sqlalchemy import Column, String, Text, TIMESTAMP
from ..db.connection import Base

class VSSSearchState(Base):
    __tablename__ = "vss_search_states"

    USER_ID = Column(String(50), primary_key=True)
    STATE_DATA = Column(Text)
    UPDATED_AT = Column(TIMESTAMP)
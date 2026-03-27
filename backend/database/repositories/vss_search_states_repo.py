from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy.exc import SQLAlchemyError
from ..orm.vss_search_states import VSSSearchState as SearchState

class SearchStateRepository:

    @staticmethod
    def get_by_user_id(user_id: str, db: Session):
        return db.query(SearchState).filter(SearchState.USER_ID == user_id).first()

    @staticmethod
    def create(user_id: str, state_data: str, db: Session):
        try:
            entity = SearchStateRepository.get_by_user_id(user_id, db)

            if entity:
                entity.STATE_DATA = state_data
            else:
                entity = SearchState(USER_ID=user_id, STATE_DATA=state_data)
                db.add(entity)

            db.commit()
            return entity

        except SQLAlchemyError:
            db.rollback()
            raise
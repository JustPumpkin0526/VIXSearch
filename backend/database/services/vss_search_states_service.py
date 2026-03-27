from ..orm.vss_search_states import VSSSearchState
from ..repositories.vss_search_states_repo import SearchStateRepository
from ..db.connection import get_db_connection
import json

class SearchStateService:

    @staticmethod
    def save_search_state(user_id: str, state_data: str):
        state_json = json.loads(state_data)

        # JSON → 문자열로 저장
        state_str = json.dumps(state_json)

        with get_db_connection() as db:
            SearchStateRepository.create(user_id, state_str, db)
            return {"success": True, "message": "Search 상태 저장 완료"}

    @staticmethod
    def load_search_state(user_id: str):
        with get_db_connection() as db:
            entity = SearchStateRepository.get_by_user_id(user_id, db)

            if entity and entity.STATE_DATA:
                return {
                    "success": True,
                    "state": json.loads(entity.STATE_DATA)
                }

            return {"success": True, "state": None}
    
"""데이터베이스 연결 관리"""
import mariadb
import re
import threading
import logging
from queue import Queue, Empty
from config.settings import (
    DB_HOST, DB_USER, DB_PASSWORD, DB_PORT, DB_NAME, IP_PATTERN, DB_POOL_SIZE, DB_POOL_WARMUP
)
from exceptions import DatabaseException, NotFoundException

logger = logging.getLogger(__name__)

# ==================== 데이터베이스 연결 풀 설정 클래스 ====================
class ConnectionPool:
    """DB 커넥션 풀 (동시 요청 처리 최적화)"""
    def __init__(self, max_connections=10, warmup_connections=1, **kwargs):
        self.max_connections = max_connections
        self.warmup_connections = max(0, min(warmup_connections, max_connections))
        self.connection_kwargs = kwargs
        self.pool = Queue(maxsize=max_connections)
        self.lock = threading.Lock()
        self.created_connections = 0
        
        # 초기 연결 생성 (실패해도 애플리케이션 시작은 계속)
        try:
            for _ in range(self.warmup_connections):
                try:
                    conn = self._create_connection()
                    self.pool.put(conn)
                    self.created_connections += 1
                except Exception as e:
                    logger.warning(f"초기 DB 연결 생성 실패 (무시됨): {e}")
                    break
        except Exception as e:
            logger.warning(f"ConnectionPool 초기화 중 오류 (무시됨): {e}")
            logger.warning("첫 요청 시 연결을 다시 시도합니다.")
    
    def _create_connection(self):
        """새 DB 연결 생성"""
        # 호스트명이 명시적으로 전달되도록 보장
        connection_params = {
            'autocommit': True,  # 자동 커밋으로 성능 향상
            **self.connection_kwargs
        }
        
        # host.docker.internal 변환 방지: host를 강제로 IP 주소로 설정
        if 'host' in connection_params:
            original_host = connection_params['host']
            # IP 주소 형식인지 확인 (IPv4)
            if re.match(IP_PATTERN, str(original_host)):
                # IP 주소인 경우 그대로 사용 (변환 방지)
                # 문자열로 명시적 변환하여 호스트명 해석 방지
                connection_params['host'] = str(original_host).strip()
                logger.info(f"DB 연결 시도: host={connection_params['host']} (IP 주소 직접 사용), user={connection_params.get('user', 'N/A')}, database={connection_params.get('database', 'N/A')}")
            else:
                # 호스트명인 경우 그대로 사용
                connection_params['host'] = str(original_host).strip()
                logger.info(f"DB 연결 시도: host={connection_params['host']} (호스트명), user={connection_params.get('user', 'N/A')}, database={connection_params.get('database', 'N/A')}")
        
        # MariaDB 연결 시도
        try:
            conn = mariadb.connect(**connection_params)
            logger.info(f"DB 연결 성공: {connection_params.get('host', 'N/A')}")
            return conn
        except Exception as e:
            logger.error(f"DB 연결 실패: host={connection_params.get('host', 'N/A')}, error={e}")
            raise
    
    def get_connection(self, timeout=5):
        """풀에서 연결 가져오기"""
        try:
            conn = self.pool.get(timeout=timeout)
            # 연결이 살아있는지 확인
            try:
                conn.ping()
            except:
                # 연결이 끊어진 경우 새로 생성
                conn = self._create_connection()
            return conn
        except Empty:
            # 풀이 비어있으면 새 연결 생성 (최대치 내에서)
            with self.lock:
                if self.created_connections < self.max_connections:
                    self.created_connections += 1
                    return self._create_connection()
                else:
                    # 최대치 도달 시 대기
                    return self.pool.get(timeout=timeout)
    
    def return_connection(self, conn):
        """연결을 풀에 반환"""
        try:
            self.pool.put_nowait(conn)
        except:
            # 풀이 가득 찬 경우 연결 종료
            try:
                conn.close()
            except:
                pass
            with self.lock:
                self.created_connections -= 1


# ============================================================================
# 데이터베이스 연결 풀 초기화
# ============================================================================
# DB_PASSWORD가 설정되지 않았으면 경고
if not DB_PASSWORD:
    logger.warning("DB_PASSWORD가 설정되지 않았습니다!")
    logger.warning("   .env 파일에 DB_PASSWORD를 설정하거나 환경 변수로 설정하세요.")

# ConnectionPool에 명시적으로 host를 IP 주소로 전달
# host.docker.internal 변환을 방지하기 위해 IP 주소를 문자열로 명시
# IP 주소 형식 검증
if not re.match(IP_PATTERN, str(DB_HOST)):
    logger.warning(f"DB_HOST가 IP 주소 형식이 아닙니다: {DB_HOST}")
    logger.warning("IP 주소 형식(예: 172.16.15.69)을 사용하는 것을 권장합니다.")

# IP 주소를 명시적으로 문자열로 변환 (호스트명 변환 방지)
db_host_str = str(DB_HOST).strip()
logger.info(f"DB 연결 풀 초기화: host={db_host_str} (타입: {type(db_host_str).__name__})")

db_pool = ConnectionPool(
    max_connections=DB_POOL_SIZE,
    warmup_connections=DB_POOL_WARMUP,
    user=DB_USER,
    password=DB_PASSWORD,
    host=db_host_str,  # IP 주소를 문자열로 명시적으로 전달
    port=int(DB_PORT),
    database=DB_NAME
)

# ==================== 하위 호환성을 위한 전역 연결 (Deprecated) ====================
# ⚠️ 경고: 전역 변수 conn, cursor는 동시성 문제를 일으킬 수 있습니다.
# 새로운 코드에서는 get_db_connection() 컨텍스트 매니저를 사용하세요.
# 이 변수들은 기존 코드와의 호환성을 위해 유지되지만, 사용을 권장하지 않습니다.

conn = None
cursor = None

def _is_connection_alive(connection) -> bool:
    """연결이 살아있는지 확인"""
    if connection is None:
        return False
    try:
        connection.ping()
        return True
    except Exception:
        return False

try:
    conn = db_pool.get_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    logger.info("데이터베이스 연결 성공 (전역 연결 - Deprecated)")
except Exception as e:
    logger.warning(f"전역 데이터베이스 연결 실패 (시작 시점): {e}")
    logger.warning("첫 요청 시 연결을 다시 시도합니다.")
    conn = None
    cursor = None


def ensure_db_connection():
    """
    전역 DB 연결이 없으면 다시 시도 (Deprecated)
    
    ⚠️ 경고: 이 함수는 하위 호환성을 위해 유지됩니다.
    새로운 코드에서는 get_db_connection() 컨텍스트 매니저를 사용하세요.
    """
    global conn, cursor
    if conn is None or cursor is None or not _is_connection_alive(conn):
        try:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
            conn = db_pool.get_connection()
            conn.autocommit = True
            cursor = conn.cursor()
            logger.info("데이터베이스 연결 성공 (재연결)")
        except Exception as e:
            logger.error(f"데이터베이스 연결 실패: {e}")
            raise DatabaseException(f"데이터베이스 연결에 실패했습니다: {str(e)}")


def verify_user_exists(user_id: str):
    """
    사용자 존재 확인 (Deprecated)
    
    ⚠️ 경고: 이 함수는 하위 호환성을 위해 유지됩니다.
    새로운 엔드포인트에서는 `dependencies.verify_user_dependency` 사용을 권장합니다.
    """
    with get_db_connection() as local_cursor:
        local_cursor.execute("SELECT ID FROM vss_user WHERE ID = ?", (user_id,))
        if not local_cursor.fetchone():
            raise NotFoundException("사용자", user_id)


class DBConnectionContext:
    """DB 연결 컨텍스트 매니저"""
    def __enter__(self):
        self.conn = db_pool.get_connection()
        self.conn.autocommit = True  # 자동 커밋 활성화
        self.cursor = self.conn.cursor()
        return self.cursor
    
    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        # autocommit이 활성화되어 있으므로 명시적 커밋 불필요
        db_pool.return_connection(self.conn)


def get_db_connection():
    """DB 연결 가져오기 (컨텍스트 매니저)"""
    return DBConnectionContext()


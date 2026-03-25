/**
 * 인증 관련 Composable
 * 로그인, 로그아웃, 사용자 정보 관리
 */
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { apiPost } from '@/utils/apiClient';

/**
 * 인증 Composable
 * @returns {object} { user, isAuthenticated, login, logout, checkAuth }
 */
export function useAuth() {
  const router = useRouter();
  const userId = ref(localStorage.getItem('vss_user_id') || '');
  const userRole = ref(localStorage.getItem('vss_user_role') || '');
  
  const isAuthenticated = computed(() => !!userId.value);
  
  /**
   * 로그인
   * @param {string} username - 사용자 ID
   * @param {string} password - 비밀번호
   * @returns {Promise}
   */
  const login = async (username, password) => {
    try {
      const response = await apiPost('/login', {
        username: username.trim(),
        password: password,
      });
      
      if (response.data?.success) {
        // 이전 사용자 ID 확인
        const previousUserId = localStorage.getItem('vss_user_id');
        const newUserId = username.trim();
        
        // 사용자가 변경된 경우 이전 사용자의 세션 데이터 정리
        if (previousUserId && previousUserId !== newUserId) {
          // 이전 사용자의 localStorage 데이터 정리
          // vss_user_id와 vss_user_role은 제외 (아래에서 새로 설정)
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // 사용자별 데이터 키 패턴 확인 (예: vss_summarize_*, vss_search_*, vss_management_* 등)
            if (key && (
              key.startsWith('vss_summarize_') ||
              key.startsWith('vss_search_') ||
              key.startsWith('vss_management_') ||
              key.startsWith('vss_storage_') ||
              key === 'videoItems' || // 기존 공용 키
              key === `videoItems_${previousUserId}` || // 이전 사용자별 키
              (key.startsWith('vss_') && key !== 'vss_user_id' && key !== 'vss_user_role')
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // 기존 공용 videoItems 키도 정리 (사용자별 키로 마이그레이션)
          if (localStorage.getItem('videoItems')) {
            localStorage.removeItem('videoItems');
          }
          
          // 로그아웃 이벤트 발생 (이전 사용자 세션 정리)
          window.dispatchEvent(new Event('vss-logout'));
        } else if (!previousUserId) {
          // 신규 로그인 (이전 사용자가 없었던 경우)에도 기존 공용 videoItems 키 정리
          if (localStorage.getItem('videoItems')) {
            localStorage.removeItem('videoItems');
          }
        }
        
        userId.value = newUserId;
        localStorage.setItem('vss_user_id', newUserId);
        
        if (response.data.role) {
          userRole.value = response.data.role;
          localStorage.setItem('vss_user_role', response.data.role);
        } else {
          userRole.value = '';
          localStorage.removeItem('vss_user_role');
        }
        
        // 로그인 이벤트 발생
        window.dispatchEvent(new Event('vss-login'));
        
        return response.data;
      } else {
        throw new Error(response.data?.message || '로그인에 실패했습니다.');
      }
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * 로그아웃
   */
  const logout = () => {
    userId.value = '';
    userRole.value = '';
    localStorage.removeItem('vss_user_id');
    localStorage.removeItem('vss_user_role');
    window.dispatchEvent(new Event('vss-logout'));
    router.push('/login');
  };
  
  /**
   * 인증 상태 확인
   */
  const checkAuth = () => {
    const storedUserId = localStorage.getItem('vss_user_id');
    const storedUserRole = localStorage.getItem('vss_user_role');
    
    if (storedUserId) {
      userId.value = storedUserId;
      userRole.value = storedUserRole || '';
      return true;
    }
    
    return false;
  };
  
  /**
   * 관리자 권한 확인
   */
  const isAdmin = computed(() => userRole.value === 'ADMIN');
  
  return {
    userId,
    userRole,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    checkAuth,
  };
}

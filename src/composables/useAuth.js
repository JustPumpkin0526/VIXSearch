/**
 * 인증 관련 Composable
 * 로그인, 로그아웃, 사용자 정보 관리
 */
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from './useApi';
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
        userId.value = username.trim();
        localStorage.setItem('vss_user_id', username.trim());
        
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

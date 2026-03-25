/**
 * API 호출을 위한 Composable
 * 로딩 상태, 에러 처리, 재시도 로직 포함
 */
import { ref } from 'vue';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/utils/apiClient';

/**
 * API 호출 Composable
 * @param {Function} apiFunction - API 호출 함수
 * @param {object} options - 옵션
 * @returns {object} { execute, loading, error, data }
 */
export function useApi(apiFunction, options = {}) {
  const loading = ref(false);
  const error = ref(null);
  const data = ref(null);
  
  const {
    onSuccess = null,
    onError = null,
    showError = true,
  } = options;
  
  /**
   * API 실행
   * @param {...any} args - API 함수에 전달할 인자들
   * @returns {Promise}
   */
  const execute = async (...args) => {
    loading.value = true;
    error.value = null;
    data.value = null;
    
    try {
      const response = await apiFunction(...args);
      data.value = response.data;
      
      if (onSuccess) {
        onSuccess(response.data, response);
      }
      
      return response.data;
    } catch (err) {
      error.value = err;
      
      if (onError) {
        onError(err);
      } else if (showError) {
        // 기본 에러 처리 (콘솔 로그)
        console.error('API 호출 실패:', err.message || err.userMessage || '알 수 없는 오류');
      }
      
      throw err;
    } finally {
      loading.value = false;
    }
  };
  
  return {
    execute,
    loading,
    error,
    data,
  };
}

/**
 * GET 요청용 Composable
 */
export function useGet(url, options = {}) {
  return useApi(() => apiGet(url), options);
}

/**
 * POST 요청용 Composable
 */
export function usePost(url, options = {}) {
  return useApi((data) => apiPost(url, data), options);
}

/**
 * PUT 요청용 Composable
 */
export function usePut(url, options = {}) {
  return useApi((data) => apiPut(url, data), options);
}

/**
 * DELETE 요청용 Composable
 */
export function useDelete(url, options = {}) {
  return useApi(() => apiDelete(url), options);
}

/**
 * 파일 업로드용 Composable
 */
export function useUpload(url, options = {}) {
  const { onProgress = null } = options;
  
  return useApi(
    (formData) => apiUpload(url, formData, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }),
    options
  );
}

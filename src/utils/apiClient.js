/**
 * 통합 API 클라이언트
 * axios 인스턴스 및 인터셉터 설정
 */
import axios from 'axios';
import { getApiBaseUrl } from './apiConfig';

// axios 인스턴스 생성
// baseURL은 요청 인터셉터에서 동적으로 설정 (외부 IP 접속 지원)
const apiClient = axios.create({
  timeout: 300000, // 5분 (대용량 파일 업로드 대비)
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 요청 인터셉터
 */
apiClient.interceptors.request.use(
  (config) => {
    // baseURL을 동적으로 설정 (외부 IP 접속 지원)
    // 매 요청마다 현재 호스트를 기반으로 API URL 생성
    // 환경 변수가 localhost로 설정되어 있어도 현재 호스트를 우선 사용
    const apiBaseUrl = getApiBaseUrl();
    config.baseURL = apiBaseUrl;
    
    // 디버깅: 생성된 URL 로그 출력 (항상 출력하여 문제 진단)
      console.log('[apiClient] API Base URL:', apiBaseUrl);
      console.log('[apiClient] Request URL:', `${apiBaseUrl}${config.url}`);
    console.log('[apiClient] Full URL:', config.baseURL ? `${config.baseURL}${config.url}` : config.url);
    
    // 필요시 인증 토큰 추가
    const userId = localStorage.getItem('vss_user_id');
    if (userId && !config.headers['X-User-Id']) {
      config.headers['X-User-Id'] = userId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 응답 인터셉터
 * 에러 처리 통합
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 에러 응답 표준화
    if (error.response) {
      // 서버에서 응답을 받았지만 에러 상태 코드
      const { status, data } = error.response;
      
      // 에러 메시지 추출
      let errorMessage = '요청 처리 중 오류가 발생했습니다.';
      
      if (data) {
        if (data.detail) {
          errorMessage = data.detail;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      }
      
      // 상태 코드별 기본 메시지
      if (status === 401) {
        errorMessage = errorMessage || '인증이 필요합니다.';
      } else if (status === 403) {
        errorMessage = errorMessage || '권한이 없습니다.';
      } else if (status === 404) {
        errorMessage = errorMessage || '요청한 리소스를 찾을 수 없습니다.';
      } else if (status === 500) {
        errorMessage = errorMessage || '서버 오류가 발생했습니다.';
      } else if (status === 502) {
        errorMessage = errorMessage || '외부 서비스 연결에 실패했습니다.';
      }
      
      // 표준화된 에러 객체 생성
      error.message = errorMessage;
      error.userMessage = errorMessage;
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못함
      error.message = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      error.userMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
    } else {
      // 요청 설정 중 오류
      error.message = error.message || '요청 설정 중 오류가 발생했습니다.';
      error.userMessage = error.message;
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * API 호출 헬퍼 함수들
 */

/**
 * GET 요청
 * @param {string} url - API 엔드포인트
 * @param {object} config - axios 설정
 * @returns {Promise}
 */
export function apiGet(url, config = {}) {
  return apiClient.get(url, config);
}

/**
 * POST 요청
 * @param {string} url - API 엔드포인트
 * @param {object} data - 요청 데이터
 * @param {object} config - axios 설정
 * @returns {Promise}
 */
export function apiPost(url, data = {}, config = {}) {
  return apiClient.post(url, data, config);
}

/**
 * PUT 요청
 * @param {string} url - API 엔드포인트
 * @param {object} data - 요청 데이터
 * @param {object} config - axios 설정
 * @returns {Promise}
 */
export function apiPut(url, data = {}, config = {}) {
  return apiClient.put(url, data, config);
}

/**
 * DELETE 요청
 * @param {string} url - API 엔드포인트
 * @param {object} config - axios 설정
 * @returns {Promise}
 */
export function apiDelete(url, config = {}) {
  return apiClient.delete(url, config);
}

/**
 * 파일 업로드 (FormData)
 * @param {string} url - API 엔드포인트
 * @param {FormData} formData - FormData 객체
 * @param {object} config - axios 설정 (onUploadProgress 등)
 * @returns {Promise}
 */
export function apiUpload(url, formData, config = {}) {
  return apiClient.post(url, formData, {
    ...config,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...config.headers,
    },
  });
}

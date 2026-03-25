/**
 * API 기본 URL 설정 유틸리티
 * 외부 IP 접속 시에도 올바른 API URL을 자동으로 생성
 */

/**
 * API 기본 URL을 가져옵니다.
 * 환경 변수가 설정되어 있으면 사용하고, 없으면 현재 호스트를 기반으로 생성합니다.
 * @returns {string} API 기본 URL
 */
export function getApiBaseUrl() {
  // 환경 변수가 명시적으로 설정되어 있고 localhost가 아닌 경우에만 사용
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  console.log('[apiConfig] VITE_API_BASE_URL 환경 변수:', envUrl);
  
  // localhost나 127.0.0.1이 아닌 경우에만 환경 변수 사용
  if (envUrl && envUrl.trim() !== '' && 
      !envUrl.includes('localhost') && 
      !envUrl.includes('127.0.0.1') &&
      !envUrl.includes('0.0.0.0')) {
    console.log('[apiConfig] 환경 변수 사용:', envUrl);
    return envUrl;
  }
  
  // 기본값: 172.16.15.69:8001 (API 서버 기본 위치)
  // localhost 환경 변수는 무시하고 항상 172.16.15.69 사용
  const defaultUrl = "http://localhost:8001";
  console.log('[apiConfig] 기본값 사용 (localhost 환경 변수 무시):', defaultUrl);
  return defaultUrl;
}

/**
 * VIA 서버 URL을 가져옵니다.
 * 환경 변수가 설정되어 있으면 사용하고, 없으면 현재 호스트를 기반으로 생성합니다.
 * VIA 서버가 다른 서버에서 실행되는 경우 환경 변수로 IP 주소를 설정해야 합니다.
 * @returns {string} VIA 서버 URL
 */
export function getViaServerUrl() {
  // 환경 변수가 명시적으로 설정되어 있으면 사용 (다른 서버의 VIA 서버 사용 시 필수)
  if (import.meta.env.VITE_VIA_SERVER_URL) {
    return import.meta.env.VITE_VIA_SERVER_URL;
  }
  
  // 기본값: 172.16.15.88:8101 (VIA 서버 기본 위치)
  // VIA 서버가 다른 서버에 있다면 VITE_VIA_SERVER_URL 환경 변수를 설정해야 함
  return "http://172.16.7.64:8101";
}

/**
 * CV Event Detector API 서버 URL을 가져옵니다.
 * 환경 변수가 설정되어 있으면 사용하고, 없으면 현재 호스트의 7862 포트를 사용합니다.
 * @returns {string} CV Event Detector API 서버 URL
 */
export function getCVEventDetectorApiUrl() {
  // 환경 변수가 명시적으로 설정되어 있으면 사용
  if (import.meta.env.VITE_CV_EVENT_DETECTOR_API_URL) {
    return import.meta.env.VITE_CV_EVENT_DETECTOR_API_URL;
  }
  
  // 현재 접속한 호스트와 포트를 기반으로 API URL 생성
  const host = window.location.hostname;
  const protocol = window.location.protocol; // http: 또는 https:
  
  // 기본값: 현재 호스트의 7862 포트 (cv_event_detector.py의 기본 포트)
  return `${protocol}//${host}:23491`;
}

// 기본 export
export default getApiBaseUrl;

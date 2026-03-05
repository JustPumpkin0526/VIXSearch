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
  // 현재 접속한 호스트와 포트를 기반으로 API URL 생성
  // 외부 IP 접속 시에도 올바른 URL을 생성하기 위해 window.location 사용
  const host = window.location.hostname;
  const port = window.location.port;
  const protocol = window.location.protocol; // http: 또는 https:
  
  // 환경 변수가 설정되어 있고 localhost/127.0.0.1가 아닌 경우에만 사용
  // (외부 IP 접속 시 환경 변수의 localhost를 무시하기 위함)
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && 
      !envUrl.includes('localhost') && 
      !envUrl.includes('127.0.0.1') &&
      !envUrl.includes('0.0.0.0')) {
    // 환경 변수가 외부 IP를 가리키는 경우에만 사용
    return envUrl;
  }
  
  // 환경 변수가 localhost이거나 없으면 현재 호스트를 기반으로 URL 생성
  // 이렇게 하면 외부 IP로 접속했을 때도 올바른 URL이 생성됨
  
  // 개발 환경에서 Vite 개발 서버를 사용하는 경우 (포트 3000 또는 5173)
  if (import.meta.env.DEV) {
    // 같은 호스트의 8001 포트 사용
    return `${protocol}//${host}:8001`;
  }
  
  // 프로덕션 환경에서는 현재 호스트와 같은 포트를 사용하거나 8001 포트 사용
  // 백엔드가 같은 서버의 다른 포트에서 실행되는 경우
  if (port === '3000' || port === '5173') {
    // 프론트엔드 개발 서버 포트인 경우, 백엔드는 8001 포트
    return `${protocol}//${host}:8001`;
  }
  
  // 프로덕션 환경에서 포트가 없거나 80/443인 경우
  // 같은 호스트의 8001 포트 사용
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${host}:8001`;
  }
  
  // 기본값: 현재 호스트의 8001 포트
  return `${protocol}//${host}:8001`;
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
  
  // 현재 접속한 호스트를 기반으로 VIA 서버 URL 생성
  // VIA 서버가 같은 서버에서 실행되는 경우에만 작동
  const host = window.location.hostname;
  const protocol = window.location.protocol; // http: 또는 https:
  
  // 기본값: 현재 호스트의 8101 포트 (VIA 서버의 기본 포트)
  // VIA 서버가 다른 서버에 있다면 VITE_VIA_SERVER_URL 환경 변수를 설정해야 함
  return `${protocol}//${host}:8101`;
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

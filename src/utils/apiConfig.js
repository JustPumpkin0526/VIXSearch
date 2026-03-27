/**
 * API 기본 URL 설정 유틸리티
 * 외부 IP 접속 시에도 올바른 API URL을 자동으로 생성
 */

/**
 * API 기본 URL을 가져옵니다.
 *
 * - VITE_API_BASE_URL이 localhost가 아닌 실제 호스트면 그대로 사용 (프론트·백이 다른 도메인일 때).
 * - localhost/127.0.0.1/비어 있음: 브라우저에서는 **현재 접속한 페이지의 hostname** + :8001 사용.
 *   (다른 PC에서 http://172.16.15.69:3000 으로 들어오면 API는 http://172.16.15.69:8001 로 감)
 */
export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const raw = envUrl != null ? String(envUrl).trim() : '';

  const isLocalPlaceholder = (u) => {
    if (!u) return true;
    const lower = u.toLowerCase();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0')
    );
  };

  // 프론트는 172.x:3000 인데 .env만 localhost:8001이면 원격 브라우저가 "자기 PC"로 요청하는 문제 방지
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (!raw || isLocalPlaceholder(raw)) {
      const protocol = window.location.protocol || 'http:';
      const host = window.location.hostname;
      const derived = `${protocol}//${host}:8001`;
      console.log('[apiConfig] 접속 호스트 기준 API URL:', derived, '(VITE_API_BASE_URL:', raw || '없음', ')');
      return derived;
    }
  }

  if (raw && !isLocalPlaceholder(raw)) {
    console.log('[apiConfig] VITE_API_BASE_URL 사용:', raw);
    return raw;
  }

  const fallback = 'http://localhost:8001';
  console.log('[apiConfig] 기본 API URL:', fallback);
  return fallback;
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

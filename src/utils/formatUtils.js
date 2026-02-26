/**
 * 포맷 관련 유틸리티 함수
 */

/**
 * 초를 시간 형식으로 변환 (HH:MM:SS)
 */
export function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '00:00';
  
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 초를 지속 시간 형식으로 변환 (예: "1시간 30분", "45분")
 */
export function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0초';
  
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}초`);
  
  return parts.join(' ') || '0초';
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 현재 시간을 HH:MM 형식으로 반환
 */
export function getCurrentTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

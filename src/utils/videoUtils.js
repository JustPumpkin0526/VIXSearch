/**
 * 비디오 관련 공통 유틸리티 함수
 */

export const UNSUPPORTED_VIDEO_FORMATS = ['avi', 'mkv', 'flv', 'wmv'];

/**
 * 파일 확장자 추출
 */
export function getVideoFileExtension(filename) {
  return filename.toLowerCase().split('.').pop();
}

/**
 * 지원하지 않는 비디오 형식인지 확인
 */
export function isUnsupportedFormat(filename) {
  return UNSUPPORTED_VIDEO_FORMATS.includes(getVideoFileExtension(filename));
}

/**
 * 이미지 파일인지 확인
 */
export function isImageFile(video) {
  if (!video) return false;
  
  // file 객체가 있으면 type으로 확인
  if (video.file && video.file.type) {
    return video.file.type.startsWith('image/');
  }
  
  // 파일명으로 확인
  const filename = video.title || video.name || '';
  if (!filename) return false;
  
  const ext = getVideoFileExtension(filename);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
  return imageExtensions.includes(ext.toLowerCase());
}

/**
 * 비디오 파일 필터링
 */
export function filterVideoFiles(files) {
  return Array.from(files).filter((file) => {
    return file.type.startsWith('video/') || file.type.startsWith('image/');
  });
}

/**
 * 비디오 객체 생성
 */
export function createVideoObject(videoData, options = {}) {
  const {
    id,
    title,
    originUrl,
    displayUrl,
    date,
    fileSize = null,
    width = null,
    height = null,
    duration = null,
    dbId = null,
    videoId = null,
    file = null,
    objectUrl = null
  } = videoData;

  return {
    id,
    title,
    originUrl: originUrl || displayUrl || '',
    displayUrl: displayUrl || originUrl || '',
    objectUrl: objectUrl || (displayUrl?.startsWith('blob:') ? displayUrl : null),
    date: date || new Date().toISOString().slice(0, 10),
    file,
    url: originUrl || displayUrl || '',
    fileSize,
    width,
    height,
    duration,
    progress: 0,
    dbId,
    videoId,
    _errorRetryCount: 0,
    _triedUrls: new Set(),
    _isConverting: false,
    ...options
  };
}

/**
 * 비디오 ID 비교 (타입 안전)
 */
export function compareVideoIds(id1, id2) {
  if (id1 == null || id2 == null) return false;
  
  // 직접 비교
  if (id1 === id2) return true;
  
  // 타입 변환 후 비교
  const id1Str = String(id1);
  const id2Str = String(id2);
  if (id1Str === id2Str) return true;
  
  // 숫자 변환 후 비교
  const id1Num = !isNaN(Number(id1)) ? Number(id1) : null;
  const id2Num = !isNaN(Number(id2)) ? Number(id2) : null;
  if (id1Num != null && id2Num != null && id1Num === id2Num) return true;
  
  return false;
}

/**
 * 비디오가 삭제 대상인지 확인
 */
export function isVideoDeleted(videoId, videoDbId, deletedIds, deletedDbIds) {
  if (videoId == null && videoDbId == null) return false;
  
  // 모든 가능한 ID 조합 확인 (타입 변환 포함)
  const idStr = videoId != null ? String(videoId) : null;
  const idNum = videoId != null && !isNaN(Number(videoId)) ? Number(videoId) : null;
  const dbIdStr = videoDbId != null ? String(videoDbId) : null;
  const dbIdNum = videoDbId != null && !isNaN(Number(videoDbId)) ? Number(videoDbId) : null;
  
  return deletedIds.has(videoId) || 
         deletedIds.has(idStr) || 
         deletedIds.has(idNum) ||
         deletedDbIds.has(videoDbId) ||
         deletedDbIds.has(dbIdStr) ||
         deletedDbIds.has(dbIdNum) ||
         (videoId != null && deletedDbIds.has(videoId)) ||
         (videoId != null && deletedDbIds.has(idStr)) ||
         (videoId != null && deletedDbIds.has(idNum)) ||
         (videoDbId != null && deletedIds.has(videoDbId)) ||
         (videoDbId != null && deletedIds.has(dbIdStr)) ||
         (videoDbId != null && deletedIds.has(dbIdNum));
}

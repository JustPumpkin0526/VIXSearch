/**
 * 동영상 썸네일 관련 유틸리티
 */

/**
 * 동영상 URL에서 썸네일 URL 생성
 * 서버에서 썸네일을 제공하는 경우 사용
 */
export function getThumbnailUrl(videoUrl, timestamp = 1) {
  if (!videoUrl) return null;
  
  // blob URL인 경우 원본 URL 사용
  if (videoUrl.startsWith('blob:')) {
    return null;
  }
  
  // 이미 썸네일 URL인 경우 그대로 반환
  if (videoUrl.includes('thumbnail') || videoUrl.includes('thumb')) {
    return videoUrl;
  }
  
  // 동영상 URL에 타임스탬프 추가하여 첫 프레임 추출
  // 서버에서 썸네일을 제공하는 경우 이 부분을 수정
  const separator = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${separator}t=${timestamp}`;
}

/**
 * 동영상 썸네일을 위한 poster URL 생성
 */
export function getPosterUrl(videoUrl) {
  return getThumbnailUrl(videoUrl, 1);
}

/**
 * 동영상 메타데이터에서 썸네일 추출 (Canvas 사용)
 */
export function extractThumbnailFromVideo(videoElement, timestamp = 1) {
  return new Promise((resolve, reject) => {
    if (!videoElement) {
      reject(new Error('Video element is required'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = videoElement.videoWidth || 320;
    canvas.height = videoElement.videoHeight || 240;

    const onSeeked = () => {
      try {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve(url);
          } else {
            reject(new Error('Failed to create thumbnail blob'));
          }
          videoElement.removeEventListener('seeked', onSeeked);
        }, 'image/jpeg', 0.8);
      } catch (error) {
        reject(error);
        videoElement.removeEventListener('seeked', onSeeked);
      }
    };

    videoElement.addEventListener('seeked', onSeeked);
    
    // 동영상이 로드되지 않은 경우 로드 대기
    if (videoElement.readyState >= 2) {
      videoElement.currentTime = Math.min(timestamp, videoElement.duration || 1);
    } else {
      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.currentTime = Math.min(timestamp, videoElement.duration || 1);
      }, { once: true });
    }
  });
}

/**
 * 썸네일 캐시 관리
 */
class ThumbnailCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      const oldValue = this.cache.get(firstKey);
      if (oldValue && oldValue.startsWith('blob:')) {
        URL.revokeObjectURL(oldValue);
      }
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.forEach((value) => {
      if (value && value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
    });
    this.cache.clear();
  }
}

export const thumbnailCache = new ThumbnailCache(100);

/**
 * 동영상 지연 로딩 Composable
 * Intersection Observer를 사용하여 화면에 보이는 동영상만 로드
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';

/**
 * 동영상 지연 로딩 Composable
 */
export function useLazyVideo() {
  const visibleVideos = ref(new Set());
  const videoObservers = ref(new Map());
  let observer = null;

  // Intersection Observer 생성
  const createObserver = () => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      return null;
    }

    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.dataset.videoId;
          if (!videoId) return;

          if (entry.isIntersecting) {
            visibleVideos.value.add(videoId);
            // 한 번 로드되면 관찰 중지
            if (observer && entry.target) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '50px', // 뷰포트 50px 전에 미리 로드
        threshold: 0.01
      }
    );
  };

  // 동영상 요소 관찰 시작
  const observeVideo = (element, videoId) => {
    if (!element || !videoId) return;

    if (!observer) {
      observer = createObserver();
      if (!observer) {
        // Intersection Observer를 지원하지 않는 경우 모든 비디오를 표시
        visibleVideos.value.add(videoId);
        return;
      }
    }

    element.dataset.videoId = videoId;
    observer.observe(element);
    videoObservers.value.set(videoId, element);
  };

  // 동영상 요소 관찰 중지
  const unobserveVideo = (videoId) => {
    const element = videoObservers.value.get(videoId);
    if (element && observer) {
      observer.unobserve(element);
      videoObservers.value.delete(videoId);
    }
  };

  // 모든 관찰 중지
  const disconnect = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    videoObservers.value.clear();
  };

  // 비디오가 보이는지 확인
  const isVideoVisible = (videoId) => {
    return visibleVideos.value.has(videoId);
  };

  // 초기화
  onMounted(() => {
    observer = createObserver();
  });

  // 정리
  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    visibleVideos,
    observeVideo,
    unobserveVideo,
    disconnect,
    isVideoVisible
  };
}

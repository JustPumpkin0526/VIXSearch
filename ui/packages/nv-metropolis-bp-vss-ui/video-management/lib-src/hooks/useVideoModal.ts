// SPDX-License-Identifier: MIT
import { useRef, useState } from 'react';
import type { StreamInfo } from '../types';

interface VideoModalState {
  isOpen: boolean;
  videoUrl: string;
  title: string;
}

interface TimelineRange {
  startTime: string;
  endTime: string;
}

export const useVideoModal = (
  vstApiUrl?: string | null,
  getTimelineRangeForStream?: (streamId: string) => TimelineRange | null,
) => {
  const [videoModal, setVideoModal] = useState<VideoModalState>({
    isOpen: false,
    videoUrl: '',
    title: '',
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const openVideoModal = async (stream: StreamInfo) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      if (!vstApiUrl) {
        throw new Error('VST API URL not configured');
      }

      const timelineRange = getTimelineRangeForStream?.(stream.streamId);
      if (!timelineRange) {
        throw new Error('No playback timeline available for this video');
      }

      const sensorId = stream.sensorId || stream.streamId;
      if (!sensorId) {
        throw new Error('No sensor identifier available for playback');
      }

      const params = new URLSearchParams({
        startTime: timelineRange.startTime,
        endTime: timelineRange.endTime,
        expiryMinutes: '60',
        container: 'mp4',
        disableAudio: 'true',
      });

      const fetchVideoUrl = `${vstApiUrl}/v1/storage/file/${sensorId}/url?${params.toString()}`;
      const response = await fetch(fetchVideoUrl, { signal: abortController.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch video URL: ${response.status}`);
      }

      const data = await response.json();
      if (abortController.signal.aborted) {
        return;
      }

      let finalVideoUrl = data.videoUrl;
      if (data.videoUrl && vstApiUrl) {
        try {
          const vstUrl = new URL(vstApiUrl);
          const videoUrl = new URL(data.videoUrl);
          const vstPathIndex = vstUrl.pathname.indexOf('/vst');
          const videoPathIndex = videoUrl.pathname.indexOf('/vst');

          if (vstPathIndex !== -1 && videoPathIndex !== -1) {
            const vstBase = `${vstUrl.protocol}//${vstUrl.host}${vstUrl.pathname.substring(0, vstPathIndex + 4)}`;
            const videoPathAfterVst = videoUrl.pathname.substring(videoPathIndex + 4);
            finalVideoUrl = `${vstBase}${videoPathAfterVst}${videoUrl.search}${videoUrl.hash}`;
          }
        } catch (error) {
          console.warn('Failed to replace video URL base, using original:', error);
        }
      }

      setVideoModal({
        isOpen: true,
        videoUrl: finalVideoUrl,
        title: stream.name,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching video playback URL:', error);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const closeVideoModal = () => {
    setVideoModal({
      isOpen: false,
      videoUrl: '',
      title: '',
    });
  };

  return {
    videoModal,
    openVideoModal,
    closeVideoModal,
  };
};
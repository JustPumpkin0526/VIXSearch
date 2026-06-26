// SPDX-License-Identifier: MIT

import { useState, useEffect, useCallback } from 'react';
import type { StreamInfo, StreamsApiResponse } from '../types';
import { createApiEndpoints } from '../api';
import { parseStreamsResponse, isRtspStream } from '../utils';

interface UseStreamsOptions {
  vstApiUrl?: string | null;
}

interface UseStreamsResult {
  streams: StreamInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

type UserVideoRecord = {
  sensor_id?: string | null;
  video_id?: string | null;
  video_url?: string | null;
  filename?: string | null;
  show_filename?: string | null;
};

async function fetchUserVideos(): Promise<UserVideoRecord[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const token = window.localStorage.getItem('vss.auth.token');

  if (!token) {
    return [];
  }

  const response = await fetch('/api/videos/list', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();

  return Array.isArray(payload?.videos) ? payload.videos : [];
}

function findMatchingUserVideo(
  stream: StreamInfo,
  videosBySensorId: Map<string, UserVideoRecord>,
  userVideos: UserVideoRecord[],
): UserVideoRecord | null {
  if (stream.sensorId) {
    const matched = videosBySensorId.get(stream.sensorId);
    if (matched) {
      return matched;
    }
  }

  const streamUrls = [stream.vodUrl, stream.url].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  if (streamUrls.length === 0) {
    return null;
  }

  return (
    userVideos.find((video) => {
      const videoUrl = video.video_url;

      if (!videoUrl) {
        return false;
      }

      return streamUrls.some(
        (streamUrl) =>
          streamUrl === videoUrl ||
          streamUrl.includes(videoUrl) ||
          videoUrl.includes(streamUrl),
      );
    }) ?? null
  );
}

export function useStreams({
  vstApiUrl,
}: UseStreamsOptions = {}): UseStreamsResult {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    if (!vstApiUrl) {
      setError('VST API URL not configured');
      setIsLoading(false);
      return;
    }

    const apiEndpoints = createApiEndpoints(vstApiUrl);

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(apiEndpoints.STREAMS);

      if (!response.ok) {
        throw new Error(`Failed to fetch streams: ${response.status}`);
      }

      const data: StreamsApiResponse = await response.json();
      const parsedStreams = parseStreamsResponse(data);

      const userVideos = await fetchUserVideos();

      const videosBySensorId = new Map<string, UserVideoRecord>(
        userVideos
          .filter(
            (video): video is UserVideoRecord & { sensor_id: string } =>
              typeof video.sensor_id === 'string' &&
              video.sensor_id.trim().length > 0,
          )
          .map((video) => [video.sensor_id.trim(), video]),
      );

      const filteredStreams = parsedStreams
        .map((stream) => {
          // RTSP를 계속 보여줄 계획이면 유지합니다.
          // 사용자님처럼 video_file만 쓸 경우 아래 RTSP 유지 로직은 제거해도 됩니다.
          if (isRtspStream(stream)) {
            return stream;
          }

          const matchedVideo = findMatchingUserVideo(
            stream,
            videosBySensorId,
            userVideos,
          );

          if (!matchedVideo) {
            return null;
          }

          return {
            ...stream,
            name:
              matchedVideo.show_filename ||
              matchedVideo.filename ||
              stream.name,
          };
        })
        .filter((stream): stream is StreamInfo => stream !== null);

      setStreams(filteredStreams);
    } catch (err) {
      console.error('Error fetching streams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch streams');
    } finally {
      setIsLoading(false);
    }
  }, [vstApiUrl]);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  return {
    streams,
    isLoading,
    error,
    refetch: fetchStreams,
  };
}
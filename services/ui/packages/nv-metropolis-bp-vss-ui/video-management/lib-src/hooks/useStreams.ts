// SPDX-License-Identifier: MIT

import { useState, useEffect, useCallback } from 'react';
import type { StreamInfo, StreamsApiResponse } from '../types';
import { createApiEndpoints } from '../api';
import { parseStreamsResponse } from '../utils';

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
  stream_id?: string | null;
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
    console.warn(
      '[useStreams] auth token is missing',
    );
  
    return [];
  }

  const response = await fetch('/api/videos/list', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.error(
      '[useStreams] failed to fetch user videos:',
      response.status,
    );

    return [];
  }

  const payload = await response.json();

  return Array.isArray(payload?.videos) ? payload.videos : [];
}

function findMatchingUserVideo(
  stream: StreamInfo,
  videosByStreamId: Map<string, UserVideoRecord>,
  videosBySensorId: Map<string, UserVideoRecord>,
  videosByVideoId: Map<string, UserVideoRecord>,
  userVideos: UserVideoRecord[],
): UserVideoRecord | null {
  const streamId = stream.streamId?.trim();
  const sensorId = stream.sensorId?.trim();

  if (streamId) {
    const matchedByStreamId = videosByStreamId.get(streamId);

    if (matchedByStreamId) {
      return matchedByStreamId;
    }
  }

  if (sensorId) {
    const matchedBySensorId = videosBySensorId.get(sensorId);
    if (matchedBySensorId) return matchedBySensorId;
  }

  if (streamId) {
    const matchedByVideoId = videosByVideoId.get(streamId);
    if (matchedByVideoId) return matchedByVideoId;
  }

  if (sensorId) {
    const matchedByVideoId = videosByVideoId.get(sensorId);
    if (matchedByVideoId) return matchedByVideoId;
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

      const videosBySensorId = new Map(
        userVideos
          .filter(
            (video): video is UserVideoRecord & { sensor_id: string } =>
              typeof video.sensor_id === 'string' && video.sensor_id.trim().length > 0,
          )
          .map((video) => [video.sensor_id.trim(), video]),
      );

      const videosByVideoId = new Map(
        userVideos
          .filter(
            (video): video is UserVideoRecord & { video_id: string } =>
              typeof video.video_id === 'string' && video.video_id.trim().length > 0,
          )
          .map((video) => [video.video_id.trim(), video]),
      );

      const videosByStreamId = new Map(
        userVideos
          .filter(
            (
              video,
            ): video is UserVideoRecord & {
              stream_id: string;
            } =>
              typeof video.stream_id === 'string' &&
              video.stream_id.trim().length > 0,
          )
          .map((video) => [
            video.stream_id.trim(),
            video,
          ]),
      );

      const filteredStreams: StreamInfo[] = parsedStreams.map<StreamInfo | null>((stream) => {
        const matchedVideo = findMatchingUserVideo(
          stream,
          videosByStreamId,
          videosBySensorId,
          videosByVideoId,
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
        
          databaseVideoId:
            matchedVideo.video_id ?? null,
        
          databaseStreamId:
            matchedVideo.stream_id ?? null,
        
          databaseSensorId:
            matchedVideo.sensor_id ?? null,
        
          databaseVideoUrl:
            matchedVideo.video_url ?? null,
        
          originalFilename:
            matchedVideo.filename ?? null,
        };
      })
      .filter(
        (stream): stream is StreamInfo =>
          stream !== null,
      );
      
      setStreams(filteredStreams);

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
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
  refetch: () => void;
}

export function useStreams({ vstApiUrl }: UseStreamsOptions = {}): UseStreamsResult {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const findMatchingUserVideo = useCallback(
    (
      stream: StreamInfo,
      videosBySensorId: Map<string, { show_filename?: string } & Record<string, unknown>>,
      userVideos: Array<{
        sensor_id?: string;
        video_name?: string;
        filename?: string;
        file_path?: string;
        video_url?: string;
        show_filename?: string;
      }>
    ) => {
      if (stream.sensorId) {
        const matchedBySensor = videosBySensorId.get(stream.sensorId);
        if (matchedBySensor) {
          return matchedBySensor;
        }
      }

      const streamUrls = [stream.vodUrl, stream.url].filter(Boolean);
      if (streamUrls.length === 0) {
        return null;
      }

      return (
        userVideos.find((video) => {
          const videoUrl = video.video_url ?? video.file_path;
          if (!videoUrl) {
            return false;
          }

          return streamUrls.some((streamUrl) => streamUrl === videoUrl || streamUrl.includes(videoUrl));
        }) ?? null
      );
    },
    []
  );

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
      let allStreams = parseStreamsResponse(data);

      // Restrict uploaded videos to those owned by current logged-in user.
      // Fetch user's persisted video records from the UI API (user_videos) and
      // filter out any non-RTSP streams that are not present in the user's list.
      try {
        let userVideos: Array<{
          sensor_id?: string;
          video_name?: string;
          filename?: string;
          file_path?: string;
          video_url?: string;
          show_filename?: string;
        }> = [];
        if (typeof window !== 'undefined') {
          const token = window.localStorage?.getItem('vss.auth.token');
          if (token) {
            const listResp = await fetch('/api/videos/list', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (listResp.ok) {
              const parsed = await listResp.json();
              userVideos = Array.isArray(parsed.videos) ? parsed.videos : [];
            }
          }
        }

        if (Array.isArray(userVideos) && userVideos.length > 0) {
          const videosBySensorId = new Map(
            userVideos
              .filter((video): video is typeof video & { sensor_id: string } => typeof video?.sensor_id === 'string' && video.sensor_id.length > 0)
              .map((video) => [video.sensor_id, video])
          );

          allStreams = allStreams.map((stream) => {
            // Keep RTSP streams as is
            if (isRtspStream(stream)) return stream;

            const matchingVideo = findMatchingUserVideo(stream, videosBySensorId, userVideos);

            // Update stream.name with show_filename if match found
            if (matchingVideo && matchingVideo.show_filename) {
              return { ...stream, name: matchingVideo.show_filename };
            }

            return stream;
          }).filter((stream) => {
            // Keep RTSP streams always
            if (isRtspStream(stream)) return true;

            // For uploaded videos, require a matching user_videos entry
            return findMatchingUserVideo(stream, videosBySensorId, userVideos) != null;
          });
        } else {
          // No authenticated user or no user_videos -> strip out uploaded (non-RTSP) streams
          allStreams = allStreams.filter((s) => isRtspStream(s));
        }
      } catch (e) {
        // Non-fatal: if the user list fetch fails, fall back to original streams but log
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch user_videos; leaving streams unfiltered by owner', e);
      }

      setStreams(allStreams);
    } catch (err) {
      // eslint-disable-next-line no-console
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


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
        let userVideos: Array<{ sensor_id?: string; video_name?: string; file_path?: string }> = [];
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
          allStreams = allStreams.filter((stream) => {
            // Keep RTSP streams always
            if (isRtspStream(stream)) return true;

            // For uploaded videos, require a matching user_videos entry
            return userVideos.some((v) => {
              if (!v) return false;
              if (v.sensor_id && stream.sensorId && v.sensor_id === stream.sensorId) return true;
              if (v.video_name && stream.name && (stream.name === v.video_name || stream.name === v.video_name.replace(/\.[^.]+$/, ''))) return true;
              if (v.file_path && (stream.vodUrl === v.file_path || stream.url === v.file_path)) return true;
              if (v.file_path && stream.vodUrl && stream.vodUrl.includes(v.file_path)) return true;
              return false;
            });
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


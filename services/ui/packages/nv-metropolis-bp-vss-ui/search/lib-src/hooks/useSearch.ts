// SPDX-License-Identifier: MIT
/**
 * Custom React hook for managing search data fetching and state
 * 
 * This hook provides comprehensive search data management including API calls,
 * sensor mapping, error handling, and real-time data synchronization with
 * configurable time windows and verification filters.
 *
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchData, SearchParams } from '../types';
import { formatDateToLocalISO } from '../utils/Formatter';

/**
 * Configuration options for the useSearch hook
 */
interface UseSearchOptions {
  agentApiUrl?: string;
  params?: SearchParams;
}

function buildRequestBody(searchParams: SearchParams): Record<string, unknown> {
  const { query, startDate, endDate, videoSources, similarity, topK = 10, agentMode = false, sourceType = 'video_file' } = searchParams;
  if (agentMode) {
    return { agent_mode: agentMode, query, top_k: topK, source_type: sourceType };
  }
  return {
    query,
    video_sources: videoSources || [],
    timestamp_start: formatDateToLocalISO(startDate || null),
    timestamp_end: formatDateToLocalISO(endDate || null),
    min_cosine_similarity: Number(similarity)?.toFixed(2),
    top_k: topK,
    agent_mode: agentMode,
    source_type: sourceType,
  };
}

export type OwnedVideoLookup = {
  ownedVideoIds: string[];
  showFilenameBySensorId: Map<string, string>;
};

export async function fetchOwnedVideoLookup(): Promise<OwnedVideoLookup | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = window.localStorage.getItem('vss.auth.token');

  if (!token) {
    return {
      ownedVideoIds: [],
      showFilenameBySensorId: new Map(),
    };
  }

  const response = await fetch('/api/videos/list', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return {
      ownedVideoIds: [],
      showFilenameBySensorId: new Map(),
    };
  }

  const payload = await response.json();
  const videos = Array.isArray(payload?.videos) ? payload.videos : [];

  const showFilenameBySensorId = new Map<string, string>();
  const ownedVideoIdSet = new Set<string>();

  videos.forEach((video: any) => {
    const sensorId =
      typeof video?.sensor_id === 'string'
        ? video.sensor_id.trim()
        : '';

    if (!sensorId) {
      return;
    }

    const showFilename =
      typeof video?.show_filename === 'string'
        ? video.show_filename.trim()
        : '';

    const filename =
      typeof video?.filename === 'string'
        ? video.filename.trim()
        : '';

    ownedVideoIdSet.add(sensorId);

    showFilenameBySensorId.set(
      sensorId,
      showFilename || filename || sensorId,
    );
  });

  const ownedVideoIds = Array.from(ownedVideoIdSet);

  return {
    ownedVideoIds,
    showFilenameBySensorId,
  };
}

async function getHttpErrorMessage(response: Response): Promise<string> {
  let errorMessage = `HTTP error! status: ${response.status}`;
  try {
    const errorBody = await response.text();
    if (errorBody) {
      errorMessage = `${errorMessage}\n\nResponse:\n${errorBody}`;
    }
  } catch {
    // Ignore if can't read response body
  }
  return errorMessage;
}

/**
 * Custom React hook for managing search data fetching and state management
 *
 */
export const useSearch = ({ agentApiUrl, params = {} }: UseSearchOptions) => {
  const [searchResults, setSearchResults] = useState<SearchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>(params);
  
  // AbortController ref for canceling ongoing requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel the current search request
  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  }, []);

  const fetchSearch = useCallback(async () => {
    if (!agentApiUrl) {
      setError('Agent API URL is not configured. Please set NEXT_PUBLIC_AGENT_API_URL_BASE in your environment.');
      setLoading(false);
      return;
    }
    
    // Cancel any ongoing request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    try {
      if (!searchParams.query) {
        setSearchResults([]);
        setLoading(false);
        return;
      }
      const body = buildRequestBody(searchParams);
      setLoading(true);
      setError(null);
      setSearchResults([]);

      const ownedVideoLookup = await fetchOwnedVideoLookup();

      if (ownedVideoLookup !== null) {
        const { ownedVideoIds } = ownedVideoLookup;
      
        if (ownedVideoIds.length === 0) {
          setSearchResults([]);
          setLoading(false);
          return;
        }
      
        body.owned_video_ids = ownedVideoIds;
      
        if (
          !Array.isArray(body.video_sources) ||
          body.video_sources.length === 0
        ) {
          body.video_sources = ownedVideoIds;
        }
      }

      const response = await fetch(`${agentApiUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
      
      if (!response.ok) {
        throw new Error(await getHttpErrorMessage(response));
      }
      const data = await response.json();
      
      // Transform API response to SearchData format
      const showFilenameBySensorId = ownedVideoLookup?.showFilenameBySensorId ?? new Map<string, string>();

      const transformedSearchResults: SearchData[] = (data.data || []).map(
        (searchResult: any) => {
          const sensorId =
            typeof searchResult.sensor_id === 'string'
              ? searchResult.sensor_id.trim()
              : '';
        
          const showFilename = sensorId
            ? showFilenameBySensorId.get(sensorId)
            : '';
        
          return {
            video_name: showFilename || searchResult.video_name || '',
            similarity: Number(searchResult.similarity) || 0,
            screenshot_url: searchResult.screenshot_url || '',
            description: searchResult.description || '',
            start_time: searchResult.start_time || '',
            end_time: searchResult.end_time || '',
            sensor_id: sensorId,
            object_ids: searchResult.object_ids || [],
            critic_result: searchResult.critic_result || undefined,
          };
        },
      );
      
      setSearchResults(transformedSearchResults);
    } catch (err) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch search');
      console.error('Error fetching search:', err);
    } finally {
      setLoading(false);
    }
  }, [agentApiUrl, searchParams]);

  const fetchData = useCallback(async () => {
    await fetchSearch();
  }, [fetchSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData, searchParams]);
  
  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchResults,
    loading,
    error,
    refetch: fetchSearch,
    onUpdateSearchParams: setSearchParams,
    cancelSearch,
    clearSearchResults,
  };
};

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
  scopeVideoSources?: string[] | null;
  scopeGroupId?: string | null;
}

function buildRequestBody(
  searchParams: SearchParams,
  scopeVideoSources: string[] | null,
): Record<string, unknown> {
  const {
    query,
    startDate,
    endDate,
    videoSources,
    similarity,
    topK = 10,
    agentMode = false,
  } = searchParams;

  /*
   * 그룹 범위가 존재하면 일반 Video Source
   * 필터보다 그룹 sensorIds를 우선합니다.
   */
  const effectiveVideoSources =
    scopeVideoSources === null
      ? videoSources || []
      : scopeVideoSources;

  return {
    query,
    video_sources: effectiveVideoSources,
    timestamp_start:
      formatDateToLocalISO(
        startDate || null,
      ),
    timestamp_end:
      formatDateToLocalISO(
        endDate || null,
      ),
    min_cosine_similarity:
      Number(similarity).toFixed(2),
    top_k: topK,
    agent_mode: agentMode,
    source_type: 'video_file',
  };
}

function normalizeLookupKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export type OwnedVideoLookup = {
  ownedVideoIds: string[];
  showFilenameBySensorId: Map<string, string>;
  showFilenameByStorageFilename: Map<string, string>;
  showFilenameByFilename: Map<string, string>;
};

type FetchOwnedVideoLookupOptions = {
  groupId?: string | null;
};

export async function fetchOwnedVideoLookup({groupId = null}: FetchOwnedVideoLookupOptions = {},): Promise<OwnedVideoLookup | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const emptyLookup: OwnedVideoLookup = {
    ownedVideoIds: [],
    showFilenameBySensorId: new Map<string, string>(),
    showFilenameByStorageFilename: new Map<string, string>(),
    showFilenameByFilename: new Map<string, string>(),
  };

  const token = window.localStorage.getItem('vss.auth.token');

  if (!token) {
    return emptyLookup;
  }

  const normalizedGroupId =
    normalizeLookupKey(groupId);

  const requestUrl =
    normalizedGroupId
      ? `/api/videos/list?group_id=${encodeURIComponent(
          normalizedGroupId,
        )}`
      : '/api/videos/list';

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: {
      Authorization:
        `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return emptyLookup;
  }

  const payload = await response.json();
  const videos = Array.isArray(payload?.videos) ? payload.videos : [];

  const ownedVideoIdSet = new Set<string>();
  const showFilenameBySensorId = new Map<string, string>();
  const showFilenameByStorageFilename = new Map<string, string>();
  const showFilenameByFilename = new Map<string, string>();

  videos.forEach((video: any) => {
    const sensorId = normalizeLookupKey(video?.sensor_id);
    const filename = normalizeLookupKey(video?.filename);
    const showFilename = normalizeLookupKey(video?.show_filename);
    const storageFilename = normalizeLookupKey(video?.storage_filename);

    const displayName =
      showFilename ||
      filename ||
      storageFilename ||
      sensorId;

    if (sensorId) {
      ownedVideoIdSet.add(sensorId);
      showFilenameBySensorId.set(sensorId, displayName);
    }

    if (storageFilename) {
      showFilenameByStorageFilename.set(storageFilename, displayName);
    }

    if (filename) {
      showFilenameByFilename.set(filename, displayName);
    }
  });

  return {
    ownedVideoIds: Array.from(ownedVideoIdSet),
    showFilenameBySensorId,
    showFilenameByStorageFilename,
    showFilenameByFilename,
  };
}

function resolveDisplayVideoName(
  searchResult: any,
  lookup: OwnedVideoLookup | null,
): string {
  const rawVideoName = normalizeLookupKey(searchResult?.video_name);
  const sensorId = normalizeLookupKey(searchResult?.sensor_id);

  if (!lookup) {
    return rawVideoName;
  }

  return (
    (sensorId && lookup.showFilenameBySensorId.get(sensorId)) ||
    (rawVideoName && lookup.showFilenameByStorageFilename.get(rawVideoName)) ||
    (rawVideoName && lookup.showFilenameByFilename.get(rawVideoName)) ||
    rawVideoName
  );
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
export const useSearch = ({
  agentApiUrl,
  params = {},
  scopeVideoSources = null,
  scopeGroupId = null,
}: UseSearchOptions) => {
  const [searchResults, setSearchResults] = useState<SearchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>(params);

  const scopeVideoSourcesRef =
    useRef<string[] | null>(
      scopeVideoSources,
    );

  scopeVideoSourcesRef.current =
    scopeVideoSources;
  
  const scopeGroupIdRef =
    useRef<string | null>(
      scopeGroupId,
    );

  scopeGroupIdRef.current =
    scopeGroupId;
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

      const rawScopeVideoSources =
        scopeVideoSourcesRef.current;

      const normalizedScopeVideoSources =
        rawScopeVideoSources === null
          ? null
          : Array.from(
              new Set(
                rawScopeVideoSources
                  .filter(
                    (value): value is string =>
                      typeof value === 'string',
                  )
                  .map((value) => value.trim())
                  .filter(Boolean),
              ),
            );
          
      if (
        normalizedScopeVideoSources !== null &&
        normalizedScopeVideoSources.length === 0
      ) {
        setSearchResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      const body = buildRequestBody(
        searchParams,
        normalizedScopeVideoSources,
      );
      setLoading(true);
      setError(null);
      setSearchResults([]);

      const activeGroupId =
        normalizeLookupKey(
          scopeGroupIdRef.current,
        );
      
      let effectiveScopeVideoIds:
        string[] | null =
          normalizedScopeVideoSources;
      
      /*
       * 그룹이 선택된 경우:
       * /api/videos/list가 username + group_id로
       * 필터링된 영상만 반환합니다.
       */
      const ownedVideoLookup =
        await fetchOwnedVideoLookup({
          groupId:
            activeGroupId || null,
        });

      if (ownedVideoLookup !== null) {
        const { ownedVideoIds } =
          ownedVideoLookup;
      
        if (ownedVideoIds.length === 0) {
          setSearchResults([]);
          setLoading(false);
          return;
        }
      
        if (activeGroupId) {
          /*
           * ownedVideoIds는 list.ts에서 이미
           * username + group_id로 필터링된 결과입니다.
           */
          effectiveScopeVideoIds =
            ownedVideoIds;
                
          body.video_sources =
            ownedVideoIds;
                
          body.owned_video_ids =
            ownedVideoIds;
        } else if (
          normalizedScopeVideoSources !== null
        ) {
          /*
           * 이전 방식과의 호환성을 위한 방어 코드입니다.
           * groupId 없이 sensorIds만 전달된 경우 사용합니다.
           */
          const ownedVideoIdSet =
            new Set(ownedVideoIds);
        
          const allowedScopeVideoSources =
            normalizedScopeVideoSources.filter(
              (sensorId) =>
                ownedVideoIdSet.has(sensorId),
            );
          
          if (
            allowedScopeVideoSources.length === 0
          ) {
            setSearchResults([]);
            setLoading(false);
            return;
          }
        
          effectiveScopeVideoIds =
            allowedScopeVideoSources;
        
          body.video_sources =
            allowedScopeVideoSources;
        
          body.owned_video_ids =
            allowedScopeVideoSources;
        } else {
          /*
           * 그룹을 선택하지 않은 일반 검색입니다.
           */
          body.owned_video_ids =
            ownedVideoIds;
        
          if (
            !Array.isArray(
              body.video_sources,
            ) ||
            body.video_sources.length === 0
          ) {
            body.video_sources =
              ownedVideoIds;
          }
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
      const transformedSearchResults: SearchData[] = (data.data || []).map(
        (searchResult: any) => {
          const sensorId = normalizeLookupKey(searchResult?.sensor_id);
        
          return {
            video_name: resolveDisplayVideoName(searchResult, ownedVideoLookup),
            similarity: Number(searchResult.similarity) || 0,
            screenshot_url: searchResult.screenshot_url || '',
            description: searchResult.description || '',
            start_time: searchResult.start_time || '',
            end_time: searchResult.end_time || '',
            sensor_id: sensorId,
            object_ids: Array.isArray(searchResult.object_ids)
              ? searchResult.object_ids
              : [],
            critic_result: searchResult.critic_result || undefined,
          };
        },
      );
            const effectiveScopeVideoIdSet =
        effectiveScopeVideoIds === null
          ? null
          : new Set(
              effectiveScopeVideoIds,
            );

      const scopedSearchResults =
        effectiveScopeVideoIdSet === null
          ? transformedSearchResults
          : transformedSearchResults.filter(
              (result) =>
                effectiveScopeVideoIdSet.has(
                  result.sensor_id,
                ),
            );

      setSearchResults(
        scopedSearchResults,
      );
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

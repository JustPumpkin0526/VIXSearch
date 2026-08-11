// SPDX-License-Identifier: MIT
/**
 * Main Search Management Component
 * 
 * This is the primary component for the search management system, providing
 * a comprehensive interface for viewing, filtering, and managing security
 * and monitoring search with advanced time-based filtering capabilities.
 * 
 */
import React from 'react';
import dynamic from 'next/dynamic';
import { useVideoModal } from '@aiqtoolkit-ui/common';
import { InfoRound as InfoRoundIcon } from '@rsuite/icons';
import { VideoModalTooltip } from '@aiqtoolkit-ui/common';

// Types
import {
  SearchComponentProps,
  SearchData,
  VideoGroupSearchScope,
} from './types';

// Hooks
import {
  useSearch,
  fetchOwnedVideoLookup,
  OwnedVideoLookup,
} from './hooks/useSearch';
import { useSearchByImage } from './hooks/useSearchByImage';
import { fetchReportFrameDataUrl } from '@nv-metropolis-bp-vss-ui/report';
import { extractSearchResultsFromAgentResponse } from './utils/agentResponseParser';

// Components
import { SearchHeader } from './components/SearchHeader';
import { SearchSidebarControls } from './components/SearchSidebarControls';
import { VideoSearchList } from './components/VideoSearchList';
import {
  SearchVideoModal,
  NewReportFormValues,
} from './components/SearchVideoModal';
import { SearchByImageOverlayInfo } from './components/SearchByImageOverlayInfo';
import { useFilter } from './hooks/useFilter';

const GROUP_SEARCH_STORAGE_KEY =
  'vixsearch:selected-video-group';

const GROUP_SEARCH_CHANGED_EVENT =
  'vss:video-group-search-changed';

const REPORTS_UPDATED_EVENT = 'vss:reports-updated';

const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';

function readVideoGroupSearchScope():
  VideoGroupSearchScope | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawScope =
      window.sessionStorage.getItem(
        GROUP_SEARCH_STORAGE_KEY,
      );

    if (!rawScope) {
      return null;
    }

    const parsed = JSON.parse(
      rawScope,
    ) as Partial<VideoGroupSearchScope>;

    if (
      typeof parsed.groupId !== 'string' ||
      !parsed.groupId.trim() ||
      typeof parsed.groupName !== 'string' ||
      !Array.isArray(parsed.sensorIds)
    ) {
      return null;
    }

    const sensorIds = Array.from(
      new Set(
        parsed.sensorIds
          .filter(
            (value): value is string =>
              typeof value === 'string',
          )
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    return {
      groupId: parsed.groupId.trim(),
      groupName:
        parsed.groupName.trim() ||
        'Unnamed group',
      sensorIds,
      videoCount:
        typeof parsed.videoCount === 'number' &&
        Number.isFinite(parsed.videoCount)
          ? Math.max(
              0,
              Math.trunc(parsed.videoCount),
            )
          : sensorIds.length,
      totalDurationSeconds:
        typeof parsed.totalDurationSeconds ===
          'number' &&
        Number.isFinite(
          parsed.totalDurationSeconds,
        )
          ? Math.max(
              0,
              parsed.totalDurationSeconds,
            )
          : 0,
    };
  } catch (error) {
    console.warn(
      '[SearchComponent] invalid group search scope:',
      error,
    );

    return null;
  }
}

const loadSearchByImageOverlay = () =>
  import('./components/SearchByImageOverlay').then((mod) => mod.SearchByImageOverlay);

const SearchByImageOverlayComponent = dynamic(loadSearchByImageOverlay, {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full min-h-[400px] bg-black text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Preparing Search by Image overlay...</span>
      </div>
    </div>
  ),
});

export const SearchComponent: React.FC<SearchComponentProps> = ({
  theme = 'light',
  onThemeChange,
  isActive = true,
  searchData,
  renderControlsInLeftSidebar = false,
  onControlsReady,
  submitChatMessage,
  registerChatAnswerHandler,
  registerSidebarChatEventSubscriber,
  chatSidebarCollapsed = true,
  chatSidebarBusy = false,
  addChatQueryContext,
}) => {
  const isDark = theme === 'dark';
  const [agentSearchResults, setAgentSearchResults] = React.useState<SearchData[] | null>(null);

  const [groupSearchScope, setGroupSearchScope] =
    React.useState<VideoGroupSearchScope | null>(
      () => readVideoGroupSearchScope(),
    );

  const groupSearchSensorIdSet =
    React.useMemo(() => {
      if (!groupSearchScope) {
        return null;
      }

      return new Set(
        groupSearchScope.sensorIds
          .filter(
            (sensorId): sensorId is string =>
              typeof sensorId === 'string',
          )
          .map((sensorId) =>
            sensorId.trim(),
          )
          .filter(Boolean),
      );
    }, [groupSearchScope]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncGroupSearchScope = () => {
      setGroupSearchScope(
        readVideoGroupSearchScope(),
      );
    };

    window.addEventListener(
      GROUP_SEARCH_CHANGED_EVENT,
      syncGroupSearchScope,
    );

    /*
     * Search 컴포넌트가 이미 마운트된 상태뿐 아니라,
     * Search 탭이 나중에 활성화되는 경우도 처리합니다.
     */
    if (isActive) {
      syncGroupSearchScope();
    }

    return () => {
      window.removeEventListener(
        GROUP_SEARCH_CHANGED_EVENT,
        syncGroupSearchScope,
      );
    };
  }, [isActive]);

  const showFilenameLookupRef = React.useRef<OwnedVideoLookup | null>(null);

  const resolveAgentDisplayVideoName = React.useCallback(
    (item: SearchData): string => {
      const lookup = showFilenameLookupRef.current;
      const rawVideoName =
        typeof item.video_name === 'string'
          ? item.video_name.trim()
          : '';
      const sensorId =
        typeof item.sensor_id === 'string'
          ? item.sensor_id.trim()
          : '';

      if (!lookup) {
        return rawVideoName;
      }

      return (
        (sensorId && lookup.showFilenameBySensorId.get(sensorId)) ||
        (rawVideoName && lookup.showFilenameByStorageFilename.get(rawVideoName)) ||
        (rawVideoName && lookup.showFilenameByFilename.get(rawVideoName)) ||
        rawVideoName
      );
    },
    [],
  );

  const refreshShowFilenameLookup = React.useCallback(async () => {
    try {
      showFilenameLookupRef.current = await fetchOwnedVideoLookup();
    } catch (error) {
      console.warn('[SearchComponent] Failed to load video filename lookup:', error);
      showFilenameLookupRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (isActive) {
      refreshShowFilenameLookup();
    }
  }, [isActive, refreshShowFilenameLookup]);

  React.useEffect(() => {
    loadSearchByImageOverlay()
      .then(() => undefined)
      .catch((error) => {
        console.error('[SearchComponent] Failed to preload SearchByImageOverlay:', error);
      });
  }, []);

  const agentApiUrl = searchData?.agentApiUrl;
  const vstApiUrl = searchData?.vstApiUrl;
  const mdxWebApiUrl = searchData?.mdxWebApiUrl;
  const mediaWithObjectsBbox = searchData?.mediaWithObjectsBbox ?? false;

  const { videoModal, openVideoModal, closeVideoModal } = useVideoModal(vstApiUrl);  
  const { streams, filterParams, setFilterParams, addFilter, removeFilterTag, filterTags, refetch: refetchStreams } = useFilter({vstApiUrl});
  const {searchResults, loading, error, refetch, onUpdateSearchParams, cancelSearch, clearSearchResults, } = useSearch({
    agentApiUrl,
    params: filterParams,
    scopeVideoSources:
      groupSearchScope?.sensorIds ?? null,
    scopeGroupId:
      groupSearchScope?.groupId ?? null,
  });

  const handleClearGroupSearchScope =
    React.useCallback(() => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(
          GROUP_SEARCH_STORAGE_KEY,
        );

        window.dispatchEvent(
          new CustomEvent(
            GROUP_SEARCH_CHANGED_EVENT,
            {
              detail: null,
            },
          ),
        );
      }

      setGroupSearchScope(null);
      setAgentSearchResults(null);
      clearSearchResults();
    }, [clearSearchResults]);

  const groupSearchScopeKey =
    groupSearchScope
      ? [
          groupSearchScope.groupId,
          ...groupSearchScope.sensorIds,
        ].join(':')
      : null;

  const previousGroupSearchScopeKeyRef =
    React.useRef<string | null>(
      groupSearchScopeKey,
    );

  React.useEffect(() => {
    if (
      previousGroupSearchScopeKeyRef.current ===
      groupSearchScopeKey
    ) {
      return;
    }

    setAgentSearchResults(null);
    clearSearchResults();

    previousGroupSearchScopeKeyRef.current =
      groupSearchScopeKey;
  }, [
    groupSearchScopeKey,
    clearSearchResults,
  ]);

  // Map streamId (UUID) -> sensor name for /frames API lookup
  const sensorIdToNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    streams.forEach((stream) => map.set(stream.sensorId, stream.name));
    return map;
  }, [streams]);

  // Track which SearchData item is currently playing so Search by Image knows sensorId + start_time.
  const [activeVideoData, setActiveVideoData] = React.useState<SearchData | null>(null);

  const [creatingReport, setCreatingReport] =
    React.useState(false);

  const handleCreateReportFromActiveVideo = React.useCallback(
    async (
      values: NewReportFormValues,
    ) => {
      if (
        !activeVideoData ||
        creatingReport
      ) {
        return;
      }

      setCreatingReport(true);

      try {
        const item = activeVideoData;
        if (!vstApiUrl || !item.sensor_id) {
          throw new Error(
            'VST frame API information is missing',
          );
        }

        const clipStartTime = videoModal.actualStartTime || item.start_time;

        const reportStreamId = videoModal.streamId || item.sensor_id;

        const frameDataUrl = await fetchReportFrameDataUrl(
            vstApiUrl,
            reportStreamId,
            clipStartTime,
            values.pauseTime,
          );
        const displayVideoName = resolveAgentDisplayVideoName(item) || item.video_name || '검색 결과';
        const report = {
          id: `report-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          title: values.title,
          createdAt: values.createdAt,
          author: values.author,
          query: filterParams.query?.trim() ?? '',
          items: [
            {
              id: [
                item.sensor_id ?? '',
                item.start_time ?? '',
                item.end_time ?? '',
                item.video_name ?? '',
              ].join('::'),
              videoName: displayVideoName,
              description: item.description?.trim() ?? '',
              startTime: item.start_time,
              endTime: item.end_time,
              sensorId: item.sensor_id,
              similarity: item.similarity,
              pauseTime: values.pauseTime,
              screenshotUrl: frameDataUrl,
            },
          ],
        };

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        const token =
          window.localStorage.getItem(
            'vss.auth.token',
          );

        if (token) {
          headers.Authorization =
            `Bearer ${token}`;
        }

        const response =
          await fetch('/api/reports', {
            method: 'POST',
            headers,
            body: JSON.stringify(report),
          });
        
        const responsePayload = await response.json();

        const savedReportId = typeof responsePayload?.report?.id === 'string'
            ? responsePayload.report.id
            : report.id;

        if (!response.ok) {
          throw new Error(
            `Failed to save report: ${response.status}`,
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            REPORTS_UPDATED_EVENT,
          ),
        );

        window.dispatchEvent(
          new CustomEvent(
            OPEN_REPORT_TAB_EVENT,
            {
              detail: {
                tabId: 'report',
                reportId: savedReportId,
              },
            },
          ),
        );

        closeVideoModal();
        setActiveVideoData(null);
      } catch (error) {
        console.error(
          '[SearchComponent] Failed to create report:',
          error,
        );

        window.alert(
          '보고서 생성에 실패했습니다.',
        );
      } finally {
        setCreatingReport(false);
      }
    }, [
      activeVideoData,
      creatingReport,
      closeVideoModal,
      resolveAgentDisplayVideoName,
      filterParams.query,
      vstApiUrl,
      videoModal.actualStartTime,
      videoModal.streamId,
    ]);

  // Search by Image hook
  const {
    searchByImageActive,
    searchByImageLoading,
    searchByImageError,
    searchByImageFrameData,
    startSearchByImage,
    cancelSearchByImage,
  } = useSearchByImage({ vstApiUrl, mdxWebApiUrl });
  const [searchByImageSelectedObjectId, setSearchByImageSelectedObjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSearchByImageSelectedObjectId(null);
  }, [searchByImageFrameData, searchByImageActive]);

  const handlePlayVideo = React.useCallback(
    (data: SearchData, showBbox: boolean) => {
      setActiveVideoData(data);
      openVideoModal(data, showBbox);
    },
    [openVideoModal]
  );

  const handleCloseVideoModal = React.useCallback(() => {
    closeVideoModal();
    cancelSearchByImage();
    setActiveVideoData(null);
  }, [closeVideoModal, cancelSearchByImage]);

  const handleSearchByImageRequest = React.useCallback(
    (pauseOffsetSeconds: number) => {
      if (!activeVideoData) return;
      const sensorName = sensorIdToNameMap.get(activeVideoData.sensor_id) || activeVideoData.sensor_id;
      startSearchByImage(activeVideoData.sensor_id, sensorName, activeVideoData.start_time, pauseOffsetSeconds, videoModal.videoUrl);
    },
    [activeVideoData, startSearchByImage, videoModal.videoUrl, sensorIdToNameMap]
  );

  const handleSearchByImageConfirm = React.useCallback((objectId: string) => {
    if (!submitChatMessage) return;
    const prompt = `Find similar objects matching object_id=${objectId}`;
    submitChatMessage(prompt);
    cancelSearchByImage();
    closeVideoModal();
    setActiveVideoData(null);
  }, [submitChatMessage, cancelSearchByImage, closeVideoModal]);

  const refetchStreamsRef = React.useRef(refetchStreams);
  const getPendingQueryRef = React.useRef<() => string>(() => '');

  React.useEffect(() => {
    refetchStreamsRef.current = refetchStreams;
  }, [refetchStreams]);

  const handleGetPendingQuery = React.useCallback((getPendingFn: () => string) => {
    getPendingQueryRef.current = getPendingFn;
  }, []);

  React.useEffect(() => {
    if (isActive) {
      refetchStreamsRef.current();
    }
  }, [isActive]);

  // When agent mode is off, show normal search results (clear agent-driven results).
  React.useEffect(() => {
    if (!filterParams.agentMode) {
      setAgentSearchResults(null);
    }
  }, [filterParams.agentMode]);

  // Clear video results only when a new search starts (loading transitions to true), not on every render while loading.
  const prevLoadingRef = React.useRef(loading);
  React.useEffect(() => {
    const becameLoading = loading && !prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (becameLoading) {
      setAgentSearchResults(null);
    }
  }, [loading]);

  // Only clear results when an agent-mode search query was submitted (via submitChatMessage),
  // not when the user sends a regular chat message (e.g. "+ Chat" + question).
  const agentSearchSubmittedRef = React.useRef(false);
  const wrappedSubmitChatMessage = React.useMemo(() => {
    if (!submitChatMessage) return undefined;
    return (message: string) => {
      agentSearchSubmittedRef.current = true;
      submitChatMessage(message);
    };
  }, [submitChatMessage]);

  const prevChatSidebarBusyRef = React.useRef(chatSidebarBusy);
  React.useEffect(() => {
    const becameBusy = chatSidebarBusy && !prevChatSidebarBusyRef.current;
    prevChatSidebarBusyRef.current = chatSidebarBusy;
    if (becameBusy && agentSearchSubmittedRef.current) {
      agentSearchSubmittedRef.current = false;
      setAgentSearchResults(null);
      clearSearchResults?.();
    }
  }, [chatSidebarBusy, clearSearchResults]);

  // Stable forwarder + ref so Home's register callback stays identity-stable while we always invoke the latest parser/setState.
  const deliverAgentAnswerRef =
    React.useRef<
      (answer: string) => boolean
    >(() => false);

  deliverAgentAnswerRef.current =
    (answer: string) => {
      const results =
        extractSearchResultsFromAgentResponse(
          answer,
        );

      if (results === null) {
        return false;
      }

      /*
       * 그룹 검색이 활성화되어 있으면
       * Agent 결과에서도 그룹 외 영상을 제거합니다.
       */
      const scopedResults =
        groupSearchSensorIdSet === null
          ? results
          : results.filter((item) => {
              const sensorId =
                typeof item.sensor_id ===
                'string'
                  ? item.sensor_id.trim()
                  : '';

              return (
                sensorId.length > 0 &&
                groupSearchSensorIdSet.has(
                  sensorId,
                )
              );
            });

      const displayResults =
        scopedResults.map((item) => ({
          ...item,
          video_name:
            resolveAgentDisplayVideoName(
              item,
            ),
        }));

      setAgentSearchResults(
        displayResults,
      );

      return true;
    };
  
  const forwardAgentAnswer = React.useCallback((answer: string) => {
    return deliverAgentAnswerRef.current(answer);
  }, []);

  React.useEffect(() => {
    if (!registerChatAnswerHandler) return;
    return registerChatAnswerHandler(forwardAgentAnswer);
  }, [registerChatAnswerHandler, forwardAgentAnswer]);

  // Clear main results on any Chat sidebar send (bridge emits messageSubmitted to Search even when another tab is focused).
  // Header-driven submit also sets agentSearchSubmittedRef for the chatSidebarBusy path.
  React.useEffect(() => {
    if (!registerSidebarChatEventSubscriber) return;
    const unsubscribe = registerSidebarChatEventSubscriber((event) => {
      if (event.type === 'messageSubmitted') {
        setAgentSearchResults(null);
        clearSearchResults?.();
      }
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [registerSidebarChatEventSubscriber, clearSearchResults]);

  const controlsComponent = React.useMemo(
    () => (
      <SearchSidebarControls
        isDark={isDark}
        onRefresh={refetch}
      />
    ),
    [
      isDark,
      refetch,
    ]
  );

  React.useEffect(() => {
    if (onControlsReady && renderControlsInLeftSidebar) {
      onControlsReady({
        isDark,
        onRefresh: refetch,
        controlsComponent,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onControlsReady,
    renderControlsInLeftSidebar,
  ]);

  const searchByImageFooterElement = React.useMemo(() => {
    if (!searchByImageActive) return undefined;

    return (
      <SearchByImageOverlayInfo
        frameData={searchByImageFrameData}
        selectedObjectId={searchByImageSelectedObjectId}
        onConfirm={handleSearchByImageConfirm}
        onCancel={cancelSearchByImage}
        isDark={isDark}
      />
    );
  }, [searchByImageActive, searchByImageFrameData, searchByImageSelectedObjectId, handleSearchByImageConfirm, cancelSearchByImage, isDark]);

  // Build Search by Image overlay element when Search by Image is active
  const searchByImageOverlayElement = React.useMemo(() => {
    if (!searchByImageActive) return undefined;

    let content: React.ReactNode;

    if (searchByImageLoading) {
      content = (
        <div
          data-testid="search-by-image-loading"
          className="flex h-full min-h-[400px] items-center justify-center bg-black text-white"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span className="text-sm">Loading frame data for Search by Image...</span>
          </div>
        </div>
      );
    } else if (searchByImageError) {
      content = (
        <div
          data-testid="search-by-image-error"
          className="flex h-full min-h-[400px] items-center justify-center bg-black text-red-400"
        >
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <span className="text-sm">{searchByImageError}</span>
          </div>
        </div>
      );
    } else if (searchByImageFrameData) {
      content = (
        <SearchByImageOverlayComponent
          frameData={searchByImageFrameData}
          selectedObjectId={searchByImageSelectedObjectId}
          onSelectObject={setSearchByImageSelectedObjectId}
        />
      );
    }

    if (!content) return undefined;

    return <div className="h-full min-h-0">{content}</div>;
  }, [searchByImageActive, searchByImageLoading, searchByImageError, searchByImageFrameData, searchByImageSelectedObjectId]);

  const modalTitle = searchByImageActive ? (
    <span className="inline-flex items-baseline gap-2">
      <span className="inline-flex items-center gap-2">
        <span>{videoModal.title}</span>
      </span>
      <span className="max-w-[360px] truncate text-xs font-normal text-gray-600 dark:text-gray-400" style={{display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px'}}>
        ( Search by Image Mode 
        <VideoModalTooltip
          content="Select a bounding box to perform Agentic Search for similar objects across cameras. Press Cancel below to exit this mode"
          placement="bottomStart"
        >
          <InfoRoundIcon style={{ cursor: 'help', opacity: 0.75, fontSize: 11, marginBottom: '3px'}} />
        </VideoModalTooltip>)
      </span>
    </span>
  ) : (
    videoModal.title
  );

  const visibleSearchResults =
    React.useMemo(() => {
      const sourceResults =
        agentSearchResults ??
        searchResults;

      if (
        groupSearchSensorIdSet === null
      ) {
        return sourceResults;
      }

      return sourceResults.filter(
        (item) => {
          const sensorId =
            typeof item.sensor_id ===
            'string'
              ? item.sensor_id.trim()
              : '';

          return (
            sensorId.length > 0 &&
            groupSearchSensorIdSet.has(
              sensorId,
            )
          );
        },
      );
    }, [
      agentSearchResults,
      searchResults,
      groupSearchSensorIdSet,
    ]);
  
  return (
    <div 
      data-testid="search-component"
      className={`flex min-h-0 min-w-0 max-w-full flex-col h-full max-h-full ${isDark ? 'bg-black text-gray-100' : 'bg-gray-50 text-gray-900'}`}
    >
      <div className={`flex-shrink-0 px-6 py-4 border-b ${isDark ? 'bg-black border-gray-700' : 'bg-white border-gray-200'}`}>
        <SearchHeader
          theme={isDark ? 'dark' : 'light'}
          streams={streams}
          filterParams={filterParams}
          setFilterParams={setFilterParams}
          onUpdateSearchParams={
            onUpdateSearchParams
          }
          addFilter={addFilter}
          removeFilterTag={removeFilterTag}
          filterTags={filterTags}
          groupSearchScope={
            groupSearchScope
          }
          onClearGroupSearchScope={
            handleClearGroupSearchScope
          }
          isSearching={loading}
          onCancelSearch={cancelSearch}
          onGetPendingQuery={
            handleGetPendingQuery
          }
          submitChatMessage={
            wrappedSubmitChatMessage
          }
          contentDisabled={
            !chatSidebarCollapsed ||
            loading ||
            chatSidebarBusy
          }
        />
      </div>
      <div className="flex-1 overflow-auto">
        <VideoSearchList
          data={visibleSearchResults}
          loading={
            agentSearchResults !== null
              ? false
              : loading
          }
          error={agentSearchResults !== null ? null : error}
          isDark={isDark}
          onRefresh={refetch}
          onPlayVideo={handlePlayVideo}
          showObjectsBbox={mediaWithObjectsBbox}
          onAddContext={addChatQueryContext}
        />
      </div>
      <SearchVideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={modalTitle}
        onClose={handleCloseVideoModal}
        searchByImageEnabled={mediaWithObjectsBbox}
        onSearchByImageRequest={handleSearchByImageRequest}
        searchByImageFooter={searchByImageFooterElement}
        searchByImageOverlay={searchByImageOverlayElement}
        onCreateReport={handleCreateReportFromActiveVideo}
        creatingReport={creatingReport}
      />
    </div>
  );
};

// Re-export types for convenience
export type { SearchData, SearchComponentProps } from './types';


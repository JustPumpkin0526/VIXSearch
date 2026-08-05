// SPDX-License-Identifier: MIT
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Button } from '@nvidia/foundations-react-core';
import { IconInbox, IconCheck } from '@tabler/icons-react';
import { Whisper, Tooltip } from 'rsuite';
import { SearchData, QueryDataContext } from '../types';
import { formatTime, parseDateAsLocal } from '../utils/Formatter';

const REPORTS_UPDATED_EVENT = 'vss:reports-updated';
const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';

type GeneratedReportItem = {
  id: string;
  title: string;
  createdAt: string;
  query?: string;
  description?: string;
  content?: string;
  items: Array<{
    id: string;
    videoName: string;
    description: string;
    startTime: string;
    endTime: string;
    sensorId: string;
    similarity: number;
    screenshotUrl: string;
  }>;
};

type ContextMenuState =
  | {
      x: number;
      y: number;
      targetKey: string;
    }
  | null;

const AddContextButton: React.FC<{
  item: SearchData;
  displayVideoName: string;
  onAddContext?: (ctx: QueryDataContext) => void;
}> = ({ item, displayVideoName, onAddContext }) => {
  const [addedState, setAddedState] = useState<'idle' | 'success'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

 const handleClick = useCallback(
  (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!onAddContext) {
      return;
    }

    const ctx: QueryDataContext = {
      id: `${displayVideoName}-${item.start_time}-${item.end_time}`,
      label: displayVideoName,
      contextType: 'media/video',
      data: {
        sensorName: displayVideoName,
        startTime: item.start_time,
        endTime: item.end_time,
        mediaType: 'sensor-clip',
      },
    };
    
    onAddContext(ctx);
    setAddedState('success');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setAddedState('idle');
      timeoutRef.current = null;
    }, 2000);
  },
  [displayVideoName, item.start_time, item.end_time, onAddContext],
);

  return (
    <Button
      kind="primary"
      size="small"
      className="flex-shrink-0 text-xs"
      onClick={handleClick}
      disabled={!onAddContext}
      title="Add sensor context to chat"
    >
      {addedState === 'success' ? (
        <>
          <IconCheck
            className="w-2.5 h-2.5 shrink-0"
            style={{ color: 'inherit' }}
          />
          <span>Added</span>
        </>
      ) : (
        <span>+ Chat</span>
      )}
    </Button>
  );
};

const MIN_VISIBLE_CLIP_DURATION_SECONDS = 1;

function getSearchClipDurationSeconds(item: SearchData): number | null {
  const startDate = parseDateAsLocal(item.start_time);
  const endDate = parseDateAsLocal(item.end_time);

  if (!startDate || !endDate) {
    return null;
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  return (endMs - startMs) / 1000;
}

function shouldDisplaySearchClip(item: SearchData): boolean {
  const durationSeconds = getSearchClipDurationSeconds(item);

  // 시간 파싱 실패 시에는 기존 동작을 유지하기 위해 숨기지 않음
  if (durationSeconds === null) {
    return true;
  }

  return durationSeconds >= MIN_VISIBLE_CLIP_DURATION_SECONDS;
}

function getResultKey(item: SearchData): string {
  return [
    item.sensor_id ?? '',
    item.start_time ?? '',
    item.end_time ?? '',
    item.video_name ?? '',
  ].join('::');
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('vss.auth.token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

export type UploadedVideoMetadata = {
  video_id?: string;
  sensor_id?: string;
  filename?: string;
  show_filename?: string;
  storage_filename?: string;
  video_url?: string;
  group_id?: string | null;
};

type VideoFilenameLookup = {
  showFilenameBySensorId: Map<string, string>;
  showFilenameByStorageFilename: Map<string, string>;
  showFilenameByFilename: Map<string, string>;
};

function createEmptyVideoFilenameLookup(): VideoFilenameLookup {
  return {
    showFilenameBySensorId: new Map<string, string>(),
    showFilenameByStorageFilename: new Map<string, string>(),
    showFilenameByFilename: new Map<string, string>(),
  };
}

function normalizeLookupKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function createVideoFilenameLookup(
  videos: UploadedVideoMetadata[],
): VideoFilenameLookup {
  const lookup =
    createEmptyVideoFilenameLookup();

  for (const video of videos) {
    const sensorId =
      normalizeLookupKey(
        video.sensor_id,
      );

    const filename =
      normalizeLookupKey(
        video.filename,
      );

    const showFilename =
      normalizeLookupKey(
        video.show_filename,
      );

    const storageFilename =
      normalizeLookupKey(
        video.storage_filename,
      );

    const displayName =
      showFilename ||
      filename ||
      storageFilename ||
      sensorId;

    if (!displayName) {
      continue;
    }

    if (sensorId) {
      lookup.showFilenameBySensorId.set(
        sensorId,
        displayName,
      );
    }

    if (storageFilename) {
      lookup.showFilenameByStorageFilename.set(
        storageFilename,
        displayName,
      );
    }

    if (filename) {
      lookup.showFilenameByFilename.set(
        filename,
        displayName,
      );
    }
  }

  return lookup;
}

function resolveDisplayVideoName(
  item: SearchData,
  lookup: VideoFilenameLookup,
): string {
  const rawVideoName =
    normalizeLookupKey(
      item.video_name,
    );

  const sensorId =
    normalizeLookupKey(
      item.sensor_id,
    );

  return (
    (
      sensorId &&
      lookup
        .showFilenameBySensorId
        .get(sensorId)
    ) ||
    (
      rawVideoName &&
      lookup
        .showFilenameByStorageFilename
        .get(rawVideoName)
    ) ||
    (
      rawVideoName &&
      lookup
        .showFilenameByFilename
        .get(rawVideoName)
    ) ||
    rawVideoName ||
    sensorId
  );
}

function getDisplayDescription(description?: string | null): string | null {
  const text = description?.trim();

  if (!text) {
    return null;
  }

  const emptyDescriptionTexts = new Set([
    '설명 없음',
    '설명이 없습니다',
    'No description',
    'No description available',
  ]);

  if (emptyDescriptionTexts.has(text)) {
    return null;
  }

  return text;
}

function buildReportTitle(items: SearchData[]): string {
  if (items.length <= 1) {
    return `${items[0]?.video_name ?? '검색 결과'} 보고서`;
  }

  return `${items[0]?.video_name ?? '검색 결과'} 외 ${
    items.length - 1
  }건 보고서`;
}

function toReportItems(items: SearchData[]): GeneratedReportItem['items'] {
  return items.map((item) => ({
    id: getResultKey(item),
    videoName: item.video_name,
    description: getDisplayDescription(item.description) ?? '',
    startTime: item.start_time,
    endTime: item.end_time,
    sensorId: item.sensor_id,
    similarity: item.similarity,
    screenshotUrl: item.screenshot_url,
  }));
}

function mergeReportItems(
  existingItems: GeneratedReportItem['items'],
  newItems: GeneratedReportItem['items'],
): GeneratedReportItem['items'] {
  const merged = new Map<string, GeneratedReportItem['items'][number]>();

  for (const item of existingItems || []) {
    merged.set(item.id, item);
  }

  for (const item of newItems || []) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

async function fetchExistingReports(): Promise<GeneratedReportItem[]> {
  const response = await fetch('/api/reports', {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch reports: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.reports) ? data.reports : [];
}

async function createNewReportFromItems(
  items: SearchData[],
  userQuery?: string,
): Promise<GeneratedReportItem | null> {
  if (typeof window === 'undefined' || items.length === 0) {
    return null;
  }

  const report: GeneratedReportItem = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: buildReportTitle(items),
    createdAt: new Date().toISOString(),
    query: userQuery?.trim() || undefined,
    items: toReportItems(items),
  };

  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    throw new Error(`Failed to save report: ${response.status}`);
  }

  window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
  window.dispatchEvent(
    new CustomEvent(OPEN_REPORT_TAB_EVENT, {
      detail: { tabId: 'report' },
    }),
  );

  return report;
}

async function appendItemsToExistingReport(
  report: GeneratedReportItem,
  items: SearchData[],
): Promise<void> {
  if (typeof window === 'undefined' || items.length === 0) {
    return;
  }

  const nextItems = mergeReportItems(report.items || [], toReportItems(items));

  const response = await fetch('/api/reports', {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      ...report,
      items: nextItems,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update report: ${response.status}`);
  }

  window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
  window.dispatchEvent(
    new CustomEvent(OPEN_REPORT_TAB_EVENT, {
      detail: { tabId: 'report' },
    }),
  );
}

export interface VideoSearchListProps {
  data: SearchData[];
  loading: boolean;
  error: string | null;
  isDark: boolean;

  uploadedVideos?: UploadedVideoMetadata[];

  onRefresh: () => void;

  onPlayVideo: (
    data: SearchData,
    showObjectsBbox: boolean,
  ) => void;

  showObjectsBbox?: boolean;

  onAddContext?: (
    ctx: QueryDataContext,
  ) => void;
}

const EmptyState: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <div className="p-4">
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <IconInbox
        className={`w-12 h-12 mb-3 ${
          isDark ? 'text-gray-500' : 'text-gray-400'
        }`}
        stroke={1.5}
      />
      <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
        Results will update here
      </p>
    </div>
  </div>
);

interface ErrorStateProps {
  error: string;
  isDark: boolean;
  onRefresh: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  isDark,
  onRefresh,
}) => (
  <div className="flex items-center justify-center h-full p-4">
    <div
      className={`w-full max-w-2xl p-6 rounded-lg ${
        isDark
          ? 'bg-red-500/10 border border-red-500/20'
          : 'bg-red-50 border border-red-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <svg
          className={`w-5 h-5 flex-shrink-0 ${
            isDark ? 'text-red-400' : 'text-red-600'
          }`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <p
          className={`font-bold text-lg ${
            isDark ? 'text-red-400' : 'text-red-700'
          }`}
        >
          Error loading items
        </p>
      </div>

      <div
        className={`text-sm mb-4 p-3 rounded max-h-48 overflow-y-auto ${
          isDark
            ? 'bg-gray-800/50 text-gray-300'
            : 'bg-white text-red-600 border border-red-100'
        }`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {error}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          className="px-5 py-2.5 rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
        >
          Retry
        </button>
      </div>
    </div>
  </div>
);

const CRITIC_SORT_ORDER: Record<string, number> = {
  confirmed: 0,
  unverified: 1,
  rejected: 2,
};

function getCriticSortRank(item: SearchData): number {
  return item.critic_result
    ? CRITIC_SORT_ORDER[item.critic_result.result] ?? 3
    : 3;
}

interface VideoCardProps {
  item: SearchData;
  index: number;
  isDark: boolean;
  showObjectsBbox: boolean;
  displayVideoName: string;
  selected: boolean;
  onToggleSelection: (item: SearchData) => void;
  onContextMenu: (event: React.MouseEvent, item: SearchData) => void;
  onPlayVideo: (data: SearchData, showObjectsBbox: boolean) => void;
  onAddContext?: (ctx: QueryDataContext) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  item,
  index,
  isDark,
  showObjectsBbox,
  displayVideoName,
  onPlayVideo,
  onAddContext,
  selected,
  onToggleSelection,
  onContextMenu,
}) => {
  const [isOpeningVideo, setIsOpeningVideo] = useState(false);
  const openingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (openingTimeoutRef.current) {
        clearTimeout(openingTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenVideo = useCallback(() => {
    setIsOpeningVideo(true);
    onPlayVideo(item, showObjectsBbox);
  
    if (openingTimeoutRef.current) {
      clearTimeout(openingTimeoutRef.current);
    }
  
    openingTimeoutRef.current = setTimeout(() => {
      setIsOpeningVideo(false);
      openingTimeoutRef.current = null;
    }, 900);
  }, [item, onPlayVideo, showObjectsBbox]);
  
  const displayDescription = getDisplayDescription(item.description);

  const videoTitle = displayVideoName || item.video_name || '';

  const cardBorderClass = selected
  ? 'border-2 border-[#76b900] dark:border-[#76b900]'
  : item.critic_result?.result === 'confirmed'
    ? 'border border-green-500 dark:border-green-400'
    : item.critic_result?.result === 'rejected'
      ? 'border border-red-500 dark:border-red-400'
      : item.critic_result?.result === 'unverified'
        ? 'border border-yellow-500 dark:border-yellow-400'
        : 'border border-gray-200 dark:border-gray-600';

  return (
    <div
      onClick={() => onToggleSelection(item)}
      onContextMenu={(event) =>
        onContextMenu(event, item)
      }
      data-testid="search-result-card"
      key={`${videoTitle}-${index}`}
      aria-selected={selected}
      className={`
        rounded-lg
        overflow-hidden
        bg-white
        shadow-sm
        dark:bg-neutral-900
        w-[280px]
        min-w-[280px]
        max-w-[280px]
        box-border
        transition-colors
        ${cardBorderClass}
      `}
    >
      <div className="p-4 pb-0 space-y-3">
        <div className="flex items-center gap-2">
          <Whisper
            placement="top"
            trigger="hover"
            speaker={<Tooltip>{videoTitle}</Tooltip>}
          >
            <h3 className="font-medium text-sm truncate cursor-default flex-1 min-w-0">
              {videoTitle}
            </h3>
          </Whisper>

          {onAddContext ? (
            <AddContextButton
              item={item}
              displayVideoName={videoTitle}
              onAddContext={onAddContext}
            />
          ) : null}
        </div>

        <div className="rounded-lg relative aspect-video group cursor-pointer">
          <div className="rounded-lg absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900">
            <img
              src={item.screenshot_url}
              alt={videoTitle}
              className="rounded-lg w-full h-full object-cover"
            />
          </div>

          <button
            type="button"
            data-testid="video-play-overlay"
            className={`absolute inset-0 flex items-center justify-center bg-transparent border-none p-0 ${
              isOpeningVideo ? 'cursor-wait' : 'cursor-pointer'
            }`}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenVideo();
            }}
            disabled={isOpeningVideo}
            aria-label={`Play ${videoTitle}`}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#76b900]/50 flex items-center justify-center shadow-lg transition-transform hover:scale-110 border border-white/30">
              {isOpeningVideo ? (
                <div className="h-6 w-6 sm:h-7 sm:w-7 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </button>

          <div className="rounded-b-lg absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
            <div className="text-white text-xs">
              <span className="font-medium">
                {formatTime(parseDateAsLocal(item.start_time))}
              </span>
              <span className="mx-1">/</span>
              <span className="font-medium">
                {formatTime(parseDateAsLocal(item.end_time))}
              </span>
            </div>

            {displayDescription && (
              <Whisper
                placement="top"
                trigger="hover"
                speaker={<Tooltip>{displayDescription}</Tooltip>}
              >
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 cursor-default">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </Whisper>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pt-0 space-y-2 my-2">
        <div className="flex justify-between items-baseline">
          <div className="flex items-center justify-between text-xs">
            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
              Similarity:
            </span>
            <span
              data-testid="search-result-similarity"
              className="bg-gray-200 dark:bg-neutral-800 dark:text-white text-gray-900 font-semibold ml-1 px-3 py-1 rounded-md"
            >
              {item.similarity.toFixed(2)}
            </span>
          </div>
        </div>

        {item.critic_result && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  item.critic_result.result === 'confirmed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : item.critic_result.result === 'rejected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}
              >
                {item.critic_result.result === 'confirmed'
                  ? '✓'
                  : item.critic_result.result === 'rejected'
                  ? '✗'
                  : '?'}{' '}
                {item.critic_result.result.charAt(0).toUpperCase() +
                  item.critic_result.result.slice(1)}
              </span>
            </div>

            {Object.keys(item.critic_result.criteria_met).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {Object.entries(item.critic_result.criteria_met).map(
                  ([criterion, met]) => (
                    <span
                      key={criterion}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        met
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      {met ? '✓' : '✗'} {criterion}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const VideoSearchList:
  React.FC<VideoSearchListProps> = ({
    data,
    loading,
    error,
    isDark,
    uploadedVideos = [],
    onRefresh,
    onPlayVideo,
    showObjectsBbox = false,
    onAddContext,
  }) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [creatingReport, setCreatingReport] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [existingReports, setExistingReports] = useState<GeneratedReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const filenameLookup =
    useMemo(
      () =>
        createVideoFilenameLookup(
          uploadedVideos,
        ),
      [uploadedVideos],
    );

  const toDisplaySearchItem = useCallback(
    (item: SearchData): SearchData => ({
      ...item,
      video_name: resolveDisplayVideoName(item, filenameLookup),
    }),
    [filenameLookup],
  );

  const visibleData = useMemo(
    () => data.filter(shouldDisplaySearchClip),
    [data],
  );

  const sortedData = useMemo(() => {
    const hasCritic = visibleData.some((item) => item.critic_result);

    if (!hasCritic) {
      return visibleData;
    }

    return [...visibleData].sort((a, b) => {
      const rankDiff = getCriticSortRank(a) - getCriticSortRank(b);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return (Number(b.similarity) || 0) - (Number(a.similarity) || 0);
    });
  }, [visibleData]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleOutside = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleOutside);
    window.addEventListener('contextmenu', handleOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleOutside);
      window.removeEventListener('contextmenu', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    let cancelled = false;

    async function loadReports() {
      setLoadingReports(true);
      try {
        const reports = await fetchExistingReports();
        if (!cancelled) {
          setExistingReports(reports);
        }
      } catch (error) {
        console.warn('[VideoSearchList] Failed to fetch existing reports:', error);
        if (!cancelled) {
          setExistingReports([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingReports(false);
        }
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [contextMenu]);

  useEffect(() => {
    setSelectedKeys((prev) => {
      const validKeys = new Set(visibleData.map((item) => getResultKey(item)));
      const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleData]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, item: SearchData) => {
      event.preventDefault();
      event.stopPropagation();
    
      const key = getResultKey(item);
    
      setSelectedKeys((prev) => {
        if (prev.has(key)) {
          return prev;
        }
      
        return new Set([key]);
      });
    
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        targetKey: key,
      });
    },
    [],
  );

  const selectedItems = useMemo(() => {
    if (selectedKeys.size === 0) {
      return [];
    }

    return sortedData.filter((item) => selectedKeys.has(getResultKey(item)));
  }, [sortedData, selectedKeys]);

  const toggleSelection = useCallback((item: SearchData) => {
    const key = getResultKey(item);

    setSelectedKeys((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  const getContextTargetItems = useCallback((): SearchData[] => {
    if (selectedItems.length > 0) {
      return selectedItems;
    }

    if (!contextMenu?.targetKey) {
      return [];
    }

    return sortedData.filter((item) => getResultKey(item) === contextMenu.targetKey);
  }, [contextMenu?.targetKey, selectedItems, sortedData]);

  const handleCreateNewReport = useCallback(async () => {
    if (creatingReport) {
      return;
    }

    const targetItems = getContextTargetItems();

    if (targetItems.length === 0) {
      setContextMenu(null);
      return;
    }

    setCreatingReport(true);

    try {
      await createNewReportFromItems(targetItems.map(toDisplaySearchItem));
    } catch (error) {
      console.error('Failed to create report:', error);
      if (typeof window !== 'undefined') {
        window.alert('보고서 생성에 실패했습니다.');
      }
    } finally {
      setCreatingReport(false);
      setContextMenu(null);
    }
  }, [creatingReport, getContextTargetItems]);

  const handleAppendToReport = useCallback(
    async (report: GeneratedReportItem) => {
      if (creatingReport) {
        return;
      }

      const targetItems = getContextTargetItems();

      if (targetItems.length === 0) {
        setContextMenu(null);
        return;
      }

      setCreatingReport(true);

      try {
        await appendItemsToExistingReport(report, targetItems.map(toDisplaySearchItem));
      } catch (error) {
        console.error('Failed to append report:', error);
        if (typeof window !== 'undefined') {
          window.alert('기존 보고서에 클립을 추가하지 못했습니다.');
        }
      } finally {
        setCreatingReport(false);
        setContextMenu(null);
      }
    },
    [creatingReport, getContextTargetItems, toDisplaySearchItem],
  );

  if (loading) {
    return <EmptyState isDark={isDark} />;
  }

  if (error) {
    return <ErrorState error={error} isDark={isDark} onRefresh={onRefresh} />;
  }

  if (visibleData.length === 0) {
    return <EmptyState isDark={isDark} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-neutral-900">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {selectedKeys.size > 0
            ? `${selectedKeys.size}개 클립 선택됨`
            : '리포트로 만들 클립을 선택하세요'}
        </div>

        <button
          type="button"
          disabled={selectedItems.length === 0 || creatingReport}
          onClick={handleCreateNewReport}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creatingReport ? '보고서 생성 중...' : '선택 클립으로 보고서 생성'}
        </button>
      </div>

      <div
        data-testid="search-results-grid"
        className="grid gap-4 grid-cols-[repeat(auto-fill,280px)] justify-start"
      >
        {sortedData.map((item, index) => {
          const key = getResultKey(item);
          const selected = selectedKeys.has(key);
                
          return (
            <div
              key={key}
              className={
                selected ? 'rounded-xl ring-2 ring-green-500' : 'rounded-xl'
              }
            >
              <label className="mb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelection(item)}
                  onClick={(event) => event.stopPropagation()}
                />
                리포트에 포함
              </label>
            
              <VideoCard
                item={item}
                index={index}
                isDark={isDark}
                showObjectsBbox={showObjectsBbox}
                displayVideoName={resolveDisplayVideoName(item, filenameLookup)}
                selected={selected}
                onToggleSelection={toggleSelection}
                onContextMenu={handleContextMenu}
                onPlayVideo={onPlayVideo}
                onAddContext={onAddContext}
              />
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <div
          className={`fixed z-[9999] min-w-[260px] rounded-lg border p-2 shadow-xl ${
            isDark
              ? 'border-gray-700 bg-gray-900 text-white'
              : 'border-gray-200 bg-white text-gray-900'
          }`}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className={`px-3 py-2 text-xs ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {getContextTargetItems().length}개 클립 선택됨
          </div>

          <button
            type="button"
            className={`w-full rounded px-3 py-2 text-left text-sm ${
              isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
            disabled={creatingReport}
            onClick={handleCreateNewReport}
          >
            {creatingReport ? '생성 중...' : '신규 보고서 생성'}
          </button>

          <div
            className={`my-1 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          />

          <div
            className={`px-3 py-2 text-xs ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            기존 보고서에 추가
          </div>

          {loadingReports ? (
            <div className="px-3 py-2 text-sm">
              보고서 목록 불러오는 중...
            </div>
          ) : existingReports.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              기존 보고서가 없습니다
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto">
              {existingReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`w-full rounded px-3 py-2 text-left text-sm ${
                    isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  }`}
                  disabled={creatingReport}
                  onClick={() => handleAppendToReport(report)}
                  title={report.title}
                >
                  <div className="truncate">{report.title}</div>
                  <div
                    className={`text-xs ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {report.items?.length ?? 0}개 클립
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
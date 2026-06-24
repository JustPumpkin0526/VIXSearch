'use client';

import React from 'react';
import { env } from 'next-runtime-env';
import { createPortal } from 'react-dom';

import { VideoModal } from '../Markdown/VideoModal';

export type SearchResultItem = {
  video_name: string;
  sensor_id: string;
  start_time: string;
  end_time: string;
  description: string;
  similarity: number;
  screenshot_url: string;
  video_url?: string;
  clip_url?: string;
  url?: string;
  object_ids?: string[];
};

type ParsedSearchResultsMessage = {
  results: SearchResultItem[];
};

type ContextMenuState = {
  x: number;
  y: number;
  targetKey: string;
  showReportOptions: boolean;
} | null;

type ClipAnalysisState = {
  loading?: boolean;
  description?: string;
  error?: string;
};

type ClipDescribeResponse = {
  description?: string;
};

type VideoModalState = {
  isOpen: boolean;
  videoUrl: string;
  title: string;
};

type ReportSceneItem = {
  id: string;
  videoName: string;
  description: string;
  startTime: string;
  endTime: string;
  sensorId: string;
  similarity: number;
  screenshotUrl: string;
};

type StoredReport = {
  id: string;
  title: string;
  createdAt: string;
  author?: string;
  query?: string;
  description?: string;
  content?: string;
  wordCount?: number;
  items?: ReportSceneItem[];
};

type CreateReportFormState = {
  title: string;
  author: string;
  description: string;
};

const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';
const REPORTS_UPDATED_EVENT = 'vss:reports-updated';

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractTopLevelJsonObjects(payload: string): unknown[] {
  const results: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < payload.length; index += 1) {
    const ch = payload[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (ch === '\\') {
      escaping = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        const parsed = tryParseJson(payload.slice(start, index + 1));
        if (parsed !== null) {
          results.push(parsed);
        }
        start = -1;
      }
    }
  }

  return results;
}

function normalizePossibleLink(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  const markdownLink = trimmed.match(/^\[(.*?)\]\((.*?)\)$/);
  if (markdownLink) {
    return markdownLink[2].trim() || markdownLink[1].trim();
  }

  return trimmed;
}

function normalizeSearchResult(candidate: unknown): SearchResultItem | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  const videoName = typeof value.video_name === 'string'
    ? value.video_name
    : (typeof value.videoName === 'string' ? value.videoName : '검색 결과 클립');
  const sensorId = typeof value.sensor_id === 'string'
    ? value.sensor_id
    : (typeof value.sensorId === 'string' ? value.sensorId : '');
  const startTime = typeof value.start_time === 'string'
    ? value.start_time
    : (typeof value.startTime === 'string' ? value.startTime : '');
  const endTime = typeof value.end_time === 'string'
    ? value.end_time
    : (typeof value.endTime === 'string' ? value.endTime : '');
  const description = typeof value.description === 'string' ? value.description : '';
  const similarityRaw = typeof value.similarity === 'number'
    ? value.similarity
    : (typeof value.similarity === 'string' ? Number(value.similarity) : 0);

  return {
    video_name: videoName,
    sensor_id: sensorId,
    start_time: startTime,
    end_time: endTime,
    description,
    similarity: Number.isFinite(similarityRaw) ? similarityRaw : 0,
    screenshot_url: normalizePossibleLink(value.screenshot_url ?? value.screenshotUrl),
    video_url: normalizePossibleLink(value.video_url ?? value.videoUrl),
    clip_url: normalizePossibleLink(value.clip_url ?? value.clipUrl),
    url: normalizePossibleLink(value.url),
    object_ids: Array.isArray(value.object_ids)
      ? value.object_ids.filter((item): item is string => typeof item === 'string')
      : Array.isArray(value.objectIds)
        ? value.objectIds.filter((item): item is string => typeof item === 'string')
        : [],
  };
}

function extractResultsFromUnknown(input: unknown): SearchResultItem[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map(normalizeSearchResult).filter((item): item is SearchResultItem => item !== null);
  }

  if (typeof input !== 'object') {
    return [];
  }

  const value = input as Record<string, unknown>;
  const directArrayKeys = ['data', 'results', 'search_results', 'videos'];
  for (const key of directArrayKeys) {
    if (Array.isArray(value[key])) {
      const normalized = extractResultsFromUnknown(value[key]);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  if (value.side_effects && typeof value.side_effects === 'object') {
    const nested = extractResultsFromUnknown((value.side_effects as Record<string, unknown>).search_results);
    if (nested.length > 0) {
      return nested;
    }
  }

  const stringKeys = ['content', 'payload', 'response', 'message'];
  for (const key of stringKeys) {
    if (typeof value[key] === 'string') {
      const parsed = tryParseJson(value[key] as string);
      if (parsed !== null) {
        const nested = extractResultsFromUnknown(parsed);
        if (nested.length > 0) {
          return nested;
        }
      }
    }
  }

  return [];
}

export function extractSearchResultsMessage(rawContent: string): ParsedSearchResultsMessage | null {
  if (!rawContent || !rawContent.trim()) {
    return null;
  }

  const directParsed = tryParseJson(rawContent);
  if (directParsed !== null) {
    const directResults = extractResultsFromUnknown(directParsed);
    if (directResults.length > 0) {
      return { results: directResults };
    }
  }

  const topLevelObjects = extractTopLevelJsonObjects(rawContent);
  for (const candidate of topLevelObjects) {
    const nestedResults = extractResultsFromUnknown(candidate);
    if (nestedResults.length > 0) {
      return { results: nestedResults };
    }
  }

  return null;
}

function getResultKey(item: SearchResultItem): string {
  return [item.sensor_id, item.video_name, item.start_time, item.end_time].join('::');
}

function buildDescribeClipUrl(agentApiUrl: string): string {
  const trimmed = agentApiUrl.replace(/\/$/, '');
  return trimmed.endsWith('/api/v1') ? `${trimmed}/describe_clip` : `${trimmed}/api/v1/describe_clip`;
}

function parseDateAsLocal(value: string): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: string): string {
  const parsed = parseDateAsLocal(value);
  return parsed ? parsed.toLocaleString('ko-KR') : value || '-';
}

function formatOriginalTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '-';
  }

  return trimmed.replace('T', ' ');
}

function formatClipTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '--:--:--';
  }

  const match = trimmed.match(/(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : trimmed;
}

function formatOffsetClipTime(value: string, timelineStart: string | undefined): string {
  const clipTime = value.trim();
  const startTime = String(timelineStart || '').trim();

  if (!clipTime || !startTime) {
    return formatClipTime(value);
  }

  const clipMillis = Date.parse(clipTime);
  const startMillis = Date.parse(startTime);
  if (!Number.isFinite(clipMillis) || !Number.isFinite(startMillis)) {
    return formatClipTime(value);
  }

  const totalSeconds = Math.max(0, Math.floor((clipMillis - startMillis) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getPlayableUrl(item: SearchResultItem): string {
  return item.clip_url || item.video_url || item.url || '';
}

function toReportItems(items: SearchResultItem[]): ReportSceneItem[] {
  return items.map((item) => ({
    id: getResultKey(item),
    videoName: item.video_name,
    description: item.description,
    startTime: item.start_time,
    endTime: item.end_time,
    sensorId: item.sensor_id,
    similarity: item.similarity,
    screenshotUrl: item.screenshot_url,
  }));
}

function buildReportTitle(items: SearchResultItem[]): string {
  if (items.length <= 1) {
    return `${items[0]?.video_name ?? '검색 결과'} 보고서`;
  }

  return `${items[0]?.video_name ?? '검색 결과'} 외 ${items.length - 1}건 보고서`;
}

function buildReportDescription(items: SearchResultItem[]): string {
  const sensorCount = new Set(items.map((item) => item.sensor_id).filter(Boolean)).size;
  return `선택된 검색 결과 ${items.length}건과 센서 ${sensorCount}개를 바탕으로 생성된 보고서입니다.`;
}

function buildReportSection(items: SearchResultItem[], sectionTitle: string, createdAt: string): string {
  const sensorCount = new Set(items.map((item) => item.sensor_id).filter(Boolean)).size;
  const similarities = items.map((item) => item.similarity || 0);
  const averageSimilarity = similarities.length > 0
    ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
    : 0;
  const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
  const sceneLines = items.map((item, index) => {
    const description = item.description?.trim() || '설명 없음';
    return [
      `${index + 1}. ${item.video_name || '검색 결과 클립'}`,
      `   시간: ${formatOriginalTimestamp(item.start_time)} ~ ${formatOriginalTimestamp(item.end_time)}`,
      `   센서 ID: ${item.sensor_id || '-'}`,
      `   유사도: ${item.similarity.toFixed(2)}`,
      `   설명: ${description}`,
    ].join('\n');
  });

  return [
    sectionTitle,
    `생성 시각: ${new Date(createdAt).toLocaleString('ko-KR')}`,
    `선택된 클립 수: ${items.length}건`,
    `포함된 센서 수: ${sensorCount}개`,
    `평균 유사도: ${averageSimilarity.toFixed(2)}`,
    `최고 유사도: ${maxSimilarity.toFixed(2)}`,
    '',
    '장면 목록',
    sceneLines.join('\n\n'),
  ].join('\n');
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function mergeReportItems(existingItems: ReportSceneItem[] | undefined, nextItems: ReportSceneItem[]): ReportSceneItem[] {
  const merged = new Map<string, ReportSceneItem>();

  for (const item of existingItems ?? []) {
    merged.set(item.id, item);
  }

  for (const item of nextItems) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function buildDefaultAuthor(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const direct = window.localStorage.getItem('vss.auth.username');
  if (direct) {
    return direct;
  }

  const rawUser = window.localStorage.getItem('vss.auth.user');
  if (!rawUser) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawUser) as Record<string, unknown>;
    return typeof parsed.username === 'string' ? parsed.username : '';
  } catch {
    return '';
  }
}

async function fetchReports(): Promise<StoredReport[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const token = window.localStorage.getItem('vss.auth.token');
  if (!token) {
    return [];
  }

  const response = await fetch('/api/reports', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load reports: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.reports) ? payload.reports as StoredReport[] : [];
}

async function postReport(payload: StoredReport): Promise<void> {
  const token = window.localStorage.getItem('vss.auth.token');
  if (!token) {
    throw new Error('Authentication token is missing');
  }

  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save report: ${response.status}`);
  }
}

async function patchReport(payload: StoredReport): Promise<void> {
  const token = window.localStorage.getItem('vss.auth.token');
  if (!token) {
    throw new Error('Authentication token is missing');
  }

  const response = await fetch('/api/reports', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update report: ${response.status}`);
  }
}

function ActionModal({
  isOpen,
  title,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactPortal | null {
  const backdropPressedRef = React.useRef(false);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    backdropPressedRef.current = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose = backdropPressedRef.current && event.target === event.currentTarget;
    backdropPressedRef.current = false;

    if (shouldClose) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            닫기
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export const SearchResultsMessage: React.FC<{ results: SearchResultItem[]; sourceQuery?: string }> = ({ results, sourceQuery = '' }) => {
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState>(null);
  const [videoModal, setVideoModal] = React.useState<VideoModalState>({ isOpen: false, videoUrl: '', title: '' });
  const [clipAnalysisByKey, setClipAnalysisByKey] = React.useState<Record<string, ClipAnalysisState>>({});
  const [analyzingClips, setAnalyzingClips] = React.useState(false);
  const [timelineStartTimes, setTimelineStartTimes] = React.useState<Record<string, string>>({});
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<CreateReportFormState>({ title: '', author: '', description: '' });
  const [existingModalOpen, setExistingModalOpen] = React.useState(false);
  const [existingReports, setExistingReports] = React.useState<StoredReport[]>([]);
  const [existingQuery, setExistingQuery] = React.useState('');
  const [selectedExistingReportId, setSelectedExistingReportId] = React.useState<string>('');
  const [loadingExistingReports, setLoadingExistingReports] = React.useState(false);
  const [savingReport, setSavingReport] = React.useState(false);
  const [reportError, setReportError] = React.useState('');
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const vstApiUrl = env('NEXT_PUBLIC_VST_API_URL') || process?.env?.NEXT_PUBLIC_VST_API_URL || '';
  const agentApiUrl = env('NEXT_PUBLIC_AGENT_API_URL')
    || env('NEXT_PUBLIC_AGENT_API_URL_BASE')
    || process?.env?.NEXT_PUBLIC_AGENT_API_URL
    || process?.env?.NEXT_PUBLIC_AGENT_API_URL_BASE
    || '';

  const allKeys = React.useMemo(() => results.map((item) => getResultKey(item)), [results]);
  const selectedItems = React.useMemo(
    () => results.filter((item) => selectedKeys.includes(getResultKey(item))),
    [results, selectedKeys],
  );
  const contextTargetItem = React.useMemo(
    () => results.find((item) => getResultKey(item) === contextMenu?.targetKey) ?? null,
    [contextMenu?.targetKey, results],
  );
  const reportSourceItems = React.useMemo(() => {
    if (selectedItems.length > 0) {
      return selectedItems;
    }
    return contextTargetItem ? [contextTargetItem] : [];
  }, [contextTargetItem, selectedItems]);

  const filteredExistingReports = React.useMemo(() => {
    const query = existingQuery.trim().toLowerCase();
    if (!query) {
      return existingReports;
    }

    return existingReports.filter((report) => report.title.toLowerCase().includes(query));
  }, [existingQuery, existingReports]);

  React.useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      setContextMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    if (!vstApiUrl || results.length === 0) {
      setTimelineStartTimes({});
      return undefined;
    }

    const sensorIds = Array.from(new Set(results.map((item) => item.sensor_id).filter(Boolean)));
    if (sensorIds.length === 0) {
      setTimelineStartTimes({});
      return undefined;
    }

    let cancelled = false;

    const loadTimelineStarts = async () => {
      try {
        const response = await fetch(`${vstApiUrl}/v1/storage/timelines`);
        if (!response.ok) {
          throw new Error(`Failed to load timelines: ${response.status}`);
        }

        const payload = await response.json() as Record<string, Array<{ startTime?: string }>>;
        if (cancelled) {
          return;
        }

        const nextStarts: Record<string, string> = {};
        for (const sensorId of sensorIds) {
          const startTime = payload?.[sensorId]?.[0]?.startTime;
          if (typeof startTime === 'string' && startTime.trim()) {
            nextStarts[sensorId] = startTime;
          }
        }

        setTimelineStartTimes(nextStarts);
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load VST timelines for clip offsets:', error);
          setTimelineStartTimes({});
        }
      }
    };

    void loadTimelineStarts();

    return () => {
      cancelled = true;
    };
  }, [results, vstApiUrl]);

  const setDefaultCreateForm = React.useCallback((items: SearchResultItem[]) => {
    setCreateForm({
      title: buildReportTitle(items),
      author: buildDefaultAuthor(),
      description: buildReportDescription(items),
    });
  }, []);

  const toggleSelection = React.useCallback((key: string) => {
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }, []);

  const openVideoModal = React.useCallback(async (item: SearchResultItem) => {
    const directUrl = getPlayableUrl(item);
    if (directUrl) {
      setVideoModal({ isOpen: true, videoUrl: directUrl, title: item.video_name });
      return;
    }

    if (!vstApiUrl || !item.sensor_id) {
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const params = new URLSearchParams({
        startTime: item.start_time,
        endTime: item.end_time,
        expiryMinutes: '60',
        container: 'mp4',
        disableAudio: 'true',
      });

      const response = await fetch(`${vstApiUrl}/v1/storage/file/${item.sensor_id}/url?${params.toString()}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video URL: ${response.status}`);
      }

      const payload = await response.json() as { videoUrl?: string };
      if (abortController.signal.aborted || !payload.videoUrl) {
        return;
      }

      let resolvedVideoUrl = payload.videoUrl;
      try {
        const baseUrl = new URL(vstApiUrl);
        const clipUrl = new URL(payload.videoUrl);
        const baseVstIndex = baseUrl.pathname.indexOf('/vst');
        const clipVstIndex = clipUrl.pathname.indexOf('/vst');

        if (baseVstIndex !== -1 && clipVstIndex !== -1) {
          const basePrefix = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.substring(0, baseVstIndex + 4)}`;
          const clipSuffix = clipUrl.pathname.substring(clipVstIndex + 4);
          resolvedVideoUrl = `${basePrefix}${clipSuffix}${clipUrl.search}${clipUrl.hash}`;
        }
      } catch {
        resolvedVideoUrl = payload.videoUrl;
      }

      setVideoModal({ isOpen: true, videoUrl: resolvedVideoUrl, title: item.video_name });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching video URL:', error);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [vstApiUrl]);

  const handleCardContextMenu = React.useCallback((event: React.MouseEvent, item: SearchResultItem) => {
    event.preventDefault();
    const targetKey = getResultKey(item);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      targetKey,
      showReportOptions: false,
    });
  }, []);

  const handleSelectAll = React.useCallback(() => {
    setSelectedKeys(allKeys);
  }, [allKeys]);

  const handleClearSelection = React.useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const handleOpenCreateModal = React.useCallback(() => {
    if (reportSourceItems.length === 0) {
      return;
    }

    setReportError('');
    setDefaultCreateForm(reportSourceItems);
    setCreateModalOpen(true);
    setExistingModalOpen(false);
    setContextMenu(null);
  }, [reportSourceItems, setDefaultCreateForm]);

  const handleOpenExistingModal = React.useCallback(async () => {
    if (reportSourceItems.length === 0) {
      return;
    }

    setReportError('');
    setLoadingExistingReports(true);
    setExistingModalOpen(true);
    setCreateModalOpen(false);
    setContextMenu(null);

    try {
      const reports = await fetchReports();
      setExistingReports(reports);
      setSelectedExistingReportId(reports[0]?.id ?? '');
    } catch (error) {
      setReportError(error instanceof Error ? error.message : '보고서 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingExistingReports(false);
    }
  }, [reportSourceItems]);

  const analyzeSingleClip = React.useCallback(async (item: SearchResultItem) => {
    const key = getResultKey(item);
    if (!agentApiUrl) {
      setClipAnalysisByKey((current) => ({
        ...current,
        [key]: { error: 'Agent API URL이 설정되지 않았습니다.' },
      }));
      return;
    }

    setClipAnalysisByKey((current) => ({
      ...current,
      [key]: { loading: true },
    }));

    try {
      const response = await fetch(buildDescribeClipUrl(agentApiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sensor_id: item.sensor_id,
          start_timestamp: item.start_time,
          end_timestamp: item.end_time,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error ${response.status}`);
      }

      const payload = await response.json() as ClipDescribeResponse;
      setClipAnalysisByKey((current) => ({
        ...current,
        [key]: { description: payload.description || '' },
      }));
    } catch (error) {
      setClipAnalysisByKey((current) => ({
        ...current,
        [key]: { error: error instanceof Error ? error.message : 'VLM 분석 요청에 실패했습니다.' },
      }));
    }
  }, [agentApiUrl]);

  const handleAnalyzeClips = React.useCallback(async () => {
    if (reportSourceItems.length === 0 || analyzingClips) {
      return;
    }

    setContextMenu(null);
    setAnalyzingClips(true);
    try {
      for (const item of reportSourceItems) {
        await analyzeSingleClip(item);
      }
    } finally {
      setAnalyzingClips(false);
    }
  }, [analyzeSingleClip, analyzingClips, reportSourceItems]);

  const handleCreateReport = React.useCallback(async () => {
    if (reportSourceItems.length === 0 || savingReport) {
      return;
    }

    const createdAt = new Date().toISOString();
    const content = buildReportSection(reportSourceItems, '보고서 개요', createdAt);
    const normalizedSourceQuery = sourceQuery.trim();
    const payload: StoredReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      title: createForm.title.trim() || buildReportTitle(reportSourceItems),
      createdAt,
      author: createForm.author.trim(),
      query: normalizedSourceQuery || undefined,
      description: createForm.description.trim() || buildReportDescription(reportSourceItems),
      content,
      wordCount: countWords(content),
      items: toReportItems(reportSourceItems),
    };

    setSavingReport(true);
    setReportError('');
    try {
      await postReport(payload);
      setCreateModalOpen(false);
      window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(OPEN_REPORT_TAB_EVENT, { detail: { tabId: 'dashboard' } }));
    } catch (error) {
      setReportError(error instanceof Error ? error.message : '보고서를 생성하지 못했습니다.');
    } finally {
      setSavingReport(false);
    }
  }, [createForm.author, createForm.description, createForm.title, reportSourceItems, savingReport, sourceQuery]);

  const handleAppendToExistingReport = React.useCallback(async () => {
    if (!selectedExistingReportId || reportSourceItems.length === 0 || savingReport) {
      return;
    }

    const baseReport = existingReports.find((report) => report.id === selectedExistingReportId);
    if (!baseReport) {
      setReportError('추가할 보고서를 선택해주세요.');
      return;
    }

    const appendedSection = buildReportSection(
      reportSourceItems,
      `추가 장면 (${new Date().toLocaleString('ko-KR')})`,
      new Date().toISOString(),
    );
    const nextContent = [baseReport.content?.trim(), appendedSection].filter(Boolean).join('\n\n');
    const nextItems = mergeReportItems(baseReport.items, toReportItems(reportSourceItems));
    const normalizedSourceQuery = sourceQuery.trim();
    const payload: StoredReport = {
      id: baseReport.id,
      title: baseReport.title,
      createdAt: baseReport.createdAt,
      author: baseReport.author ?? '',
      query: baseReport.query?.trim() || normalizedSourceQuery || undefined,
      description: baseReport.description ?? buildReportDescription(reportSourceItems),
      content: nextContent,
      wordCount: countWords(nextContent),
      items: nextItems,
    };

    setSavingReport(true);
    setReportError('');
    try {
      await patchReport(payload);
      setExistingModalOpen(false);
      window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
      window.dispatchEvent(new CustomEvent(OPEN_REPORT_TAB_EVENT, { detail: { tabId: 'dashboard' } }));
    } catch (error) {
      setReportError(error instanceof Error ? error.message : '기존 보고서에 추가하지 못했습니다.');
    } finally {
      setSavingReport(false);
    }
  }, [existingReports, reportSourceItems, savingReport, selectedExistingReportId, sourceQuery]);

  const renderContextMenu = () => {
    if (!contextMenu || typeof document === 'undefined') {
      return null;
    }

    const selectedCount = reportSourceItems.length;
    return createPortal(
      <div ref={menuRef} className="fixed z-[70]" style={{ left: contextMenu.x, top: contextMenu.y }}>
        <div className="min-w-[220px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setContextMenu((current) => current ? { ...current, showReportOptions: !current.showReportOptions } : current)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <span>보고서 생성</span>
            <span className="text-xs text-gray-400">{contextMenu.showReportOptions ? '닫기' : '열기'}</span>
          </button>
          <p className="px-3 pt-2 text-xs text-gray-500 dark:text-gray-400">
            현재 선택된 클립 {selectedCount}건을 대상으로 보고서 작업을 진행합니다.
          </p>
          <button
            type="button"
            onClick={handleAnalyzeClips}
            disabled={analyzingClips || selectedCount === 0}
            className="mt-2 flex w-full items-center justify-between rounded-lg border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-gray-800 dark:text-gray-100 dark:hover:bg-gray-800 dark:disabled:text-gray-500"
          >
            <span>{analyzingClips ? '분석 중...' : 'VLM 분석'}</span>
            <span className="text-xs text-gray-400">선택 결과 사용</span>
          </button>
        </div>
        {contextMenu.showReportOptions ? (
          <div className="absolute left-[calc(100%+12px)] top-0 min-w-[220px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <span>새 보고서 생성</span>
              <span className="text-xs text-gray-400">새로 만들기</span>
            </button>
            <button
              type="button"
              onClick={handleOpenExistingModal}
              className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <span>기존 보고서에 추가</span>
              <span className="text-xs text-gray-400">이어붙이기</span>
            </button>
          </div>
        ) : null}
      </div>,
      document.body,
    );
  };

  return (
    <>
      <div className="not-prose mt-4 w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
              Search Results
            </h4>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {results.length} items
            </span>
            {selectedItems.length > 0 ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                {selectedItems.length} selected
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              선택 해제
            </button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {results.map((item) => {
            const key = getResultKey(item);
            const isSelected = selectedKeys.includes(key);
            const playableUrl = getPlayableUrl(item);
            const canPlay = Boolean(playableUrl || (vstApiUrl && item.sensor_id));
            const clipAnalysis = clipAnalysisByKey[key];

            return (
              <div
                key={key}
                onContextMenu={(event) => handleCardContextMenu(event, item)}
                className={`group relative w-full overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors dark:bg-gray-700 ${
                  isSelected
                    ? 'border-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.22)] dark:border-green-400'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="space-y-3 p-4 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3
                      title={item.video_name}
                      className="cursor-default truncate text-sm font-medium text-gray-900 dark:text-gray-100"
                    >
                      {item.video_name}
                    </h3>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/85 dark:text-gray-200 dark:ring-white/10">
                      <span>선택</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(key)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </label>
                  </div>

                  <div className="relative aspect-video rounded-2xl">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900">
                      {item.screenshot_url ? (
                        <img src={item.screenshot_url} alt={item.video_name} className="h-full w-full rounded-2xl object-cover" />
                      ) : null}
                    </div>
                    {!item.screenshot_url ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl text-sm text-gray-300">
                        미리보기 없음
                      </div>
                    ) : null}

                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          void openVideoModal(item);
                        }}
                        disabled={!canPlay}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-[rgb(209_255_117_/_0.6)] shadow-lg transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14"
                      >
                        <svg className="ml-0.5 h-6 w-6 text-white sm:h-7 sm:w-7" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 py-2">
                      <div className="text-xs text-white">
                        <span className="font-medium">{formatOffsetClipTime(item.start_time, timelineStartTimes[item.sensor_id])}</span>
                        <span className="mx-1">/</span>
                        <span className="font-medium">{formatOffsetClipTime(item.end_time, timelineStartTimes[item.sensor_id])}</span>
                      </div>
                      {item.description ? (
                        <div
                          title={item.description}
                          className="cursor-default rounded-full bg-white/20 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm"
                        >
                          설명
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between p-4 pt-3">
                  <div className="min-w-0 pr-3">
                    {clipAnalysis?.loading ? (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-300">VLM 분석 중...</p>
                    ) : item.description ? (
                      <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-300">{item.description}</p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">설명 없음</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Similarity:</span>
                    <span className="ml-1 rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
                      {Number(item.similarity || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                {(clipAnalysis?.description || clipAnalysis?.error) ? (
                  <div
                    className={`mx-4 mb-4 max-h-32 overflow-y-auto rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                      clipAnalysis.error
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                        : 'border-amber-200 bg-amber-50 text-gray-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-gray-200'
                    }`}
                  >
                    {clipAnalysis.error || clipAnalysis.description}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {renderContextMenu()}

      <ActionModal isOpen={createModalOpen} title="새 보고서 생성" onClose={() => setCreateModalOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              제목
              <input
                type="text"
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-500"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              작성자
              <input
                type="text"
                value={createForm.author}
                onChange={(event) => setCreateForm((current) => ({ ...current, author: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-500"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            설명
            <textarea
              rows={4}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-500"
            />
          </label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
            선택된 클립 {reportSourceItems.length}건으로 새 보고서를 생성합니다.
          </div>
          {reportError ? <p className="text-sm font-medium text-red-500">{reportError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleCreateReport}
              disabled={savingReport}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              {savingReport ? '생성 중' : '생성'}
            </button>
          </div>
        </div>
      </ActionModal>

      <ActionModal isOpen={existingModalOpen} title="기존 보고서에 추가" onClose={() => setExistingModalOpen(false)}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            보고서 검색
            <input
              type="text"
              value={existingQuery}
              onChange={(event) => setExistingQuery(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-500"
            />
          </label>

          <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700">
            {loadingExistingReports ? (
              <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">보고서 목록을 불러오는 중입니다.</div>
            ) : filteredExistingReports.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">선택 가능한 보고서가 없습니다.</div>
            ) : (
              filteredExistingReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedExistingReportId(report.id)}
                  className={`flex w-full flex-col border-b px-4 py-4 text-left transition-colors last:border-b-0 ${
                    selectedExistingReportId === report.id
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{report.title}</span>
                  <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(report.createdAt)}</span>
                  {report.author ? (
                    <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">작성자: {report.author}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
            선택된 클립 {reportSourceItems.length}건을 기존 보고서에 추가합니다.
          </div>
          {reportError ? <p className="text-sm font-medium text-red-500">{reportError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExistingModalOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleAppendToExistingReport}
              disabled={savingReport || !selectedExistingReportId}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              {savingReport ? '추가 중' : '선택한 보고서에 추가'}
            </button>
          </div>
        </div>
      </ActionModal>

      <VideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={videoModal.title}
        onClose={() => setVideoModal({ isOpen: false, videoUrl: '', title: '' })}
      />
    </>
  );
};
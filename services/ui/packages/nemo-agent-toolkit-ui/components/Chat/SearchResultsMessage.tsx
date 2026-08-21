'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { env } from 'next-runtime-env';

import { useVideoModal } from '@aiqtoolkit-ui/common';
import {
  SearchByImageOverlayInfo,
  SearchVideoModal,
  VideoSearchList,
  useFilter,
  useSearchByImage,
  type AddToExistingReportFormValues,
  type SearchData,
  type NewReportFormValues,
} from '@nv-metropolis-bp-vss-ui/search';
import {
  fetchReportFrameDataUrl,
} from '@nv-metropolis-bp-vss-ui/report';

type CriticResult = {
  result: 'confirmed' | 'rejected' | 'unverified' | string;
  criteria_met: Record<string, boolean>;
};

const REPORTS_UPDATED_EVENT = 'vss:reports-updated';
const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';

type ReportItem = {
  id: string;
  videoName: string;
  locationName?: string;
  description: string;
  comment?: string;
  query?: string;
  startTime: string;
  endTime: string;
  sensorId: string;
  similarity: number;
  pauseTime?: number;
  screenshotUrl: string;
};

type StoredReport = {
  id: string;
  title: string;
  createdAt?: string;
  author?: string;
  query?: string;
  items?: ReportItem[];
};

const loadSearchByImageOverlay = () =>
  import(
    '@nv-metropolis-bp-vss-ui/search/components/SearchByImageOverlay'
  ).then((module) => module.SearchByImageOverlay);

const SearchByImageOverlayComponent = dynamic(
  loadSearchByImageOverlay,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />

          <span className="text-sm">
            Preparing Search by Image overlay...
          </span>
        </div>
      </div>
    ),
  },
);

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

  matched_object_timestamp?: string;
  matched_object_type?: string;
  matched_object_bbox?:
    SearchData[
      'matched_object_bbox'
    ];

  critic_result?:
    CriticResult | null;
};

export type ParsedSearchResultsMessage = {
  results: SearchResultItem[];
};

function formatSceneTime(
  value: string | number | undefined,
): string {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    const totalSeconds = Math.max(
      0,
      Math.floor(value),
    );

    const hours = Math.floor(
      totalSeconds / 3600,
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );

    const seconds =
      totalSeconds % 60;

    return [
      hours,
      minutes,
      seconds,
    ]
      .map(part =>
        String(part).padStart(2, '0'),
      )
      .join(':');
  }

  const text =
    String(value).trim();

  if (!text) {
    return '';
  }

  const timeMatch = text.match(
    /T(\d{2}:\d{2}:\d{2})/,
  );

  return timeMatch?.[1] || text;
}

function buildVideoTimestampRange(
  startTime:
    | string
    | undefined,
  endTime:
    | string
    | undefined,
  fallbackTime?:
    | string
    | undefined,
): string {
  const formattedStart =
    formatSceneTime(startTime);

  const formattedEnd =
    formatSceneTime(endTime);

  if (
    formattedStart &&
    formattedEnd
  ) {
    return (
      `${formattedStart} - ` +
      `${formattedEnd}`
    );
  }

  if (formattedStart) {
    return formattedStart;
  }

  if (formattedEnd) {
    return formattedEnd;
  }

  return formatSceneTime(
    fallbackTime,
  );
}

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

function normalizeCriticResult(value: unknown): CriticResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const result =
    typeof raw.result === 'string'
      ? raw.result
      : typeof raw.verdict === 'string'
        ? raw.verdict
        : '';

  if (!result) {
    return null;
  }

  const criteriaRaw =
    raw.criteria_met && typeof raw.criteria_met === 'object'
      ? raw.criteria_met
      : raw.criteriaMet && typeof raw.criteriaMet === 'object'
        ? raw.criteriaMet
        : {};

  const criteria_met: Record<string, boolean> = {};

  for (const [key, met] of Object.entries(criteriaRaw as Record<string, unknown>)) {
    criteria_met[key] = Boolean(met);
  }

  return {
    result,
    criteria_met,
  };
}

function isSearchResultCandidate(
  candidate: unknown,
): candidate is Record<string, unknown> {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  const hasVideoIdentifier =
    typeof value.video_name === 'string' ||
    typeof value.videoName === 'string' ||
    typeof value.sensor_id === 'string' ||
    typeof value.sensorId === 'string';
  const hasTimeRange =
    typeof value.start_time === 'string' ||
    typeof value.startTime === 'string' ||
    typeof value.end_time === 'string' ||
    typeof value.endTime === 'string';

  return hasVideoIdentifier && hasTimeRange;
}

function normalizeSearchResult(candidate: unknown): SearchResultItem | null {
  if (!isSearchResultCandidate(candidate)) {
    return null;
  }

  const value = candidate;
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
  const similarityValue =
    value.similarity ??
    value.similarity_score ??
    value.frame_score ??
    value.behavior_score;
  
  const similarityRaw =
    typeof similarityValue === 'number'
      ? similarityValue
      : typeof similarityValue === 'string'
        ? Number(similarityValue)
        : 0;

  // Support multiple possible key names/locations for object ids coming from agents
  const rawObjectIds: unknown =
    value.object_ids ??
    value.objectIds ??
    value.matched_object_ids ??
    value.matchedObjectIds ??
    value.matched_object_id ??
    value.matchedObjectId ??
    value.object_id ??
    value.objectId ??
    (value.metadata && (value.metadata.object_ids ?? value.metadata.objectIds)) ??
    undefined;

  const objectIds = Array.isArray(rawObjectIds)
    ? rawObjectIds.filter((item): item is | string | number => typeof item === 'string' || typeof item === 'number').map(String)
    : typeof rawObjectIds === 'string' || typeof rawObjectIds === 'number'
      ? [String(rawObjectIds)]
      : [];

  const matchedObjectTimestamp = typeof value.matched_object_timestamp === 'string'
      ? value.matched_object_timestamp
      : typeof value.matchedObjectTimestamp === 'string'
        ? value.matchedObjectTimestamp
        : undefined;

  const matchedObjectType = typeof value.matched_object_type === 'string'
      ? value.matched_object_type
      : typeof value.matchedObjectType === 'string'
        ? value.matchedObjectType
        : undefined;

  const rawMatchedObjectBbox = value.matched_object_bbox ?? value.matchedObjectBbox;
  const matchedObjectBbox = rawMatchedObjectBbox && typeof rawMatchedObjectBbox === 'object' 
      ? (rawMatchedObjectBbox as SearchData['matched_object_bbox'])
      : undefined;

  return {
    video_name: videoName,
    sensor_id: sensorId,
    start_time: startTime,
    end_time: endTime,
    description,
    similarity: Number.isFinite(similarityRaw)
        ? similarityRaw
        : 0,
    screenshot_url: normalizePossibleLink(value.screenshot_url ?? value.screenshotUrl),
    video_url: normalizePossibleLink(value.video_url ?? value.videoUrl),
    clip_url: normalizePossibleLink(value.clip_url ?? value.clipUrl),
    url: normalizePossibleLink(value.url),
    object_ids: objectIds,
    matched_object_timestamp: matchedObjectTimestamp,
    matched_object_type: matchedObjectType,
    matched_object_bbox: matchedObjectBbox,
    critic_result: normalizeCriticResult(value.critic_result ?? value.criticResult),
  };
}

function extractResultsFromUnknown(input: unknown): SearchResultItem[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    const directResults = input
      .map(normalizeSearchResult)
      .filter((item): item is SearchResultItem => item !== null);

    if (directResults.length > 0) {
      return directResults;
    }

    for (const item of input) {
      const nested = extractResultsFromUnknown(item);
      if (nested.length > 0) {
        return nested;
      }
    }

    return [];
  }

  if (typeof input !== 'object') {
    if (typeof input === 'string') {
      const parsed = tryParseJson(input);
      return parsed !== null
        ? extractResultsFromUnknown(parsed)
        : [];
    }

    return [];
  }

  const value = input as Record<string, unknown>;
  const directKeys = ['data', 'results', 'search_results', 'videos'];
  for (const key of directKeys) {
    if (value[key] !== undefined) {
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

  const nestedKeys = [
    'content',
    'payload',
    'response',
    'message',
    'value',
    'output',
    'result',
  ];

  for (const key of nestedKeys) {
    const candidate = value[key];
    if (candidate === undefined) {
      continue;
    }

    if (typeof candidate === 'string') {
      const parsed = tryParseJson(candidate);
      if (parsed !== null) {
        const nested = extractResultsFromUnknown(parsed);
        if (nested.length > 0) {
          return nested;
        }
      }

      const objects = extractTopLevelJsonObjects(candidate);
      for (const object of objects) {
        const nested = extractResultsFromUnknown(object);
        if (nested.length > 0) {
          return nested;
        }
      }

      continue;
    }

    const nested = extractResultsFromUnknown(candidate);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

export function extractSearchResultsValue(
  value: unknown,
): ParsedSearchResultsMessage | null {
  const results = extractResultsFromUnknown(value);

  return results.length > 0
    ? { results }
    : null;
}

export function extractSearchResultsMessage(rawContent: string): ParsedSearchResultsMessage | null {
  if (!rawContent || !rawContent.trim()) {
    return null;
  }

  const directParsed = tryParseJson(rawContent);
  if (directParsed !== null) {
    const directResult = extractSearchResultsValue(directParsed);
    if (directResult) {
      return directResult;
    }
  }

  const topLevelObjects = extractTopLevelJsonObjects(rawContent);
  for (const candidate of topLevelObjects) {
    const nestedResult = extractSearchResultsValue(candidate);
    if (nestedResult) {
      return nestedResult;
    }
  }

  return null;
}

type SearchCriticResult = NonNullable<SearchData['critic_result']>;
type SearchCriticStatus = SearchCriticResult['result'];

function normalizeCriticStatus(
  value: unknown,
): SearchCriticStatus | undefined {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    normalized === 'confirmed' ||
    normalized === 'rejected' ||
    normalized === 'unverified'
  ) {
    return normalized;
  }

  return undefined;
}

function toSearchData(item: SearchResultItem): SearchData {
  const criticStatus = normalizeCriticStatus(item.critic_result?.result);

  return {
    video_name: item.video_name ?? '',
    sensor_id: item.sensor_id ?? '',
    start_time: item.start_time ?? '',
    end_time: item.end_time ?? '',
    description: item.description ?? '',
    similarity: typeof item.similarity === 'number'
        ? item.similarity
        : Number(item.similarity) || 0,
    screenshot_url: item.screenshot_url ?? '',
    object_ids: Array.isArray(item.object_ids)
        ? item.object_ids
        : [],
    matched_object_timestamp: item.matched_object_timestamp,
    matched_object_type: item.matched_object_type,
    matched_object_bbox: item.matched_object_bbox,
    critic_result: criticStatus 
      ? {result: criticStatus, criteria_met: item.critic_result ?.criteria_met ?? {}} 
      : undefined,
  };
}

function getResultKey(
  item: Pick<
    SearchResultItem,
    'sensor_id' | 'video_name' | 'start_time' | 'end_time'
  >,
): string {
  return [
    item.sensor_id ?? '',
    item.video_name ?? '',
    item.start_time ?? '',
    item.end_time ?? '',
  ].join('::');
}

function useDarkTheme(): boolean {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;

    const updateTheme = () => {
      setIsDark(root.classList.contains('dark'));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

export interface SearchResultsMessageProps {
  results: SearchResultItem[];
  sourceQuery: string;
  onSubmitMessage?: (
    content: string,
  ) => void | Promise<void>;
}

export const SearchResultsMessage: React.FC<
  SearchResultsMessageProps
> = ({
  results,
  sourceQuery,
  onSubmitMessage,
}) => {

  console.log(
    '[DEBUG] SearchResultsMessage rendered',
    {
      resultCount: results.length,
      hasOnSubmitMessage:
        !!onSubmitMessage,
    },
  );

  const isDark = useDarkTheme();

  const vstApiUrl =
    env('NEXT_PUBLIC_VST_API_URL') ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_VST_API_URL
      : '') ||
    '';
  
  const mdxWebApiUrl =
    env('NEXT_PUBLIC_MDX_WEB_API_URL') ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_MDX_WEB_API_URL
      : '') ||
    '';

  const searchByImageFlag =
    env('NEXT_PUBLIC_SEARCH_TAB_MEDIA_WITH_OBJECTS_BBOX') ||
    (typeof process !== 'undefined'
      ? process.env
          .NEXT_PUBLIC_SEARCH_TAB_MEDIA_WITH_OBJECTS_BBOX
      : '') ||
    '';

  const searchByImageConfigured = [
    'true',
    '1',
    'yes',
    'on',
  ].includes(searchByImageFlag.trim().toLowerCase());

  const [availableReports, setAvailableReports] = React.useState<StoredReport[]>([]);
  const [loadingReports, setLoadingReports] = React.useState(false);

  const canSearchByImage =
    searchByImageConfigured &&
    Boolean(vstApiUrl) &&
    Boolean(onSubmitMessage);

  const searchData = React.useMemo<SearchData[]>(
    () => results.map(toSearchData),
    [results],
  );

  const [activeVideoData, setActiveVideoData] = React.useState<SearchData | null>(null);

  const [creatingReport, setCreatingReport] = React.useState(false);

  const [
    searchByImageSelectedObjectId,
    setSearchByImageSelectedObjectId,
  ] = React.useState<string | null>(null);

  const { streams } = useFilter({ vstApiUrl });

  const agentApiUrl =
    env('NEXT_PUBLIC_AGENT_API_URL') ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_AGENT_API_URL
      : '') ||
    '';

  const [criticDescriptions, setCriticDescriptions] = React.useState<Record<string, string>>({});
  const [criticDescriptionLoading, setCriticDescriptionLoading] = React.useState(false);

  const sensorIdToNameMap = React.useMemo(() => {
    const map = new Map<string, string>();

    streams.forEach((stream) => {
      map.set(stream.sensorId, stream.name);
    });

    return map;
  }, [streams]);

  const {
    searchByImageActive,
    searchByImageLoading,
    searchByImageError,
    searchByImageFrameData,
    startSearchByImage,
    cancelSearchByImage,
  } = useSearchByImage({
    vstApiUrl,
    mdxWebApiUrl,
  });

  React.useEffect(() => {
    setSearchByImageSelectedObjectId(null);
  }, [
    searchByImageFrameData,
    searchByImageActive,
  ]);

  const {
    videoModal,
    openVideoModal,
    closeVideoModal,
  } = useVideoModal(vstApiUrl);

  const buildCurrentReportItem = React.useCallback((
    values: AddToExistingReportFormValues,
    screenshotUrl: string,
  ): ReportItem | null => {
    if (!activeVideoData) {
      return null;
    }

    const displayVideoName =
      sensorIdToNameMap.get(activeVideoData.sensor_id) ||
      activeVideoData.video_name ||
      '검색 결과';
    const normalizedDescription =
      values.situationDescription.trim();
    const normalizedPauseTime = Number.isFinite(values.pauseTime)
      ? Math.max(0, values.pauseTime)
      : 0;

    return {
      id: [
        activeVideoData.sensor_id ?? '',
        activeVideoData.start_time ?? '',
        activeVideoData.end_time ?? '',
        activeVideoData.video_name ?? '',
        Math.round(normalizedPauseTime * 1000),
      ].join('::'),
      videoName: displayVideoName,
      locationName: displayVideoName,
      description: normalizedDescription,
      comment: normalizedDescription,
      query:
        typeof sourceQuery === 'string'
          ? sourceQuery.trim()
          : '',
      startTime: activeVideoData.start_time ?? '',
      endTime: activeVideoData.end_time ?? '',
      sensorId: activeVideoData.sensor_id ?? '',
      similarity: activeVideoData.similarity ?? 0,
      pauseTime: normalizedPauseTime,
      screenshotUrl,
    };
  }, [
    activeVideoData,
    sensorIdToNameMap,
    sourceQuery,
  ]);

  const loadExistingReports = React.useCallback(
    async (): Promise<void> => {
      setLoadingReports(true);

      try {
        const token =
          window.localStorage.getItem(
            'vss.auth.token',
          );

        if (!token) {
          throw new Error(
            'Authentication token is missing',
          );
        }

        const response =
          await fetch('/api/reports', {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          });

        if (!response.ok) {
          throw new Error(
            `Failed to load reports: ${response.status}`,
          );
        }

        const payload =
          await response.json();

        const reports: StoredReport[] =
          Array.isArray(payload?.reports)
            ? payload.reports
            : [];

        setAvailableReports(
          reports,
        );
      } catch (error) {
        console.error(
          '[SearchResultsMessage] Failed to load reports:',
          error,
        );

        setAvailableReports([]);
      } finally {
        setLoadingReports(false);
      }
    },
    [],
  );

  const handleAddToExistingReport = React.useCallback(
    async (
      reportId: string,
      values: AddToExistingReportFormValues,
    ) => {
      if (!activeVideoData || creatingReport) {
        return;
      }

      const clipStartTime =
        videoModal.actualStartTime ||
        activeVideoData.start_time;
      const reportStreamId =
        videoModal.streamId ||
        activeVideoData.sensor_id;

      if (!vstApiUrl.trim()) {
        window.alert('VST API URL이 설정되지 않았습니다.');
        return;
      }

      if (!reportStreamId?.trim()) {
        window.alert(
          '보고서 프레임의 Stream ID를 확인할 수 없습니다.',
        );
        return;
      }

      if (!clipStartTime?.trim()) {
        window.alert(
          '검색 결과 클립의 시작 시간을 확인할 수 없습니다.',
        );
        return;
      }

      setCreatingReport(true);

      try {
        const token = window.localStorage.getItem('vss.auth.token');

        if (!token) {
          throw new Error('Authentication token is missing');
        }

        const frameDataUrl = await fetchReportFrameDataUrl(
          vstApiUrl,
          reportStreamId,
          clipStartTime,
          values.pauseTime,
        );

        const reportItem = buildCurrentReportItem(
          values,
          frameDataUrl,
        );

        if (!reportItem) {
          throw new Error('Report item could not be created');
        }

        const response = await fetch('/api/reports', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: reportId,
            appendItem: reportItem,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to update report: ${response.status} ${errorText}`,
          );
        }

        const responsePayload = await response.json();
        const updatedReport = responsePayload?.report as StoredReport | undefined;

        if (updatedReport?.id) {
          setAvailableReports((current) =>
            current.map((report) =>
              report.id === updatedReport.id
                ? updatedReport
                : report,
            ),
          );
        }

        window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));

        window.dispatchEvent(
          new CustomEvent(OPEN_REPORT_TAB_EVENT, {
            detail: {
              tabId: 'report',
              reportId,
            },
          }),
        );

        closeVideoModal();
        setActiveVideoData(null);
      } catch (error) {
        console.error(
          '[SearchResultsMessage] Failed to append report:',
          error,
        );

        window.alert('기존 보고서에 추가하지 못했습니다.');
      } finally {
        setCreatingReport(false);
      }
    },
    [
      activeVideoData,
      creatingReport,
      buildCurrentReportItem,
      closeVideoModal,
      videoModal.actualStartTime,
      videoModal.streamId,
      vstApiUrl,
    ],
  );

  const handlePlayVideo = React.useCallback(
    (item: SearchData, showObjectsBbox: boolean) => {
      cancelSearchByImage();
      setSearchByImageSelectedObjectId(null);

      setActiveVideoData(item);

      void openVideoModal(item, showObjectsBbox);
    },
    [
      cancelSearchByImage,
      openVideoModal,
    ],
  );

  const handleCloseVideoModal = React.useCallback(() => {
    closeVideoModal();
    cancelSearchByImage();
    setActiveVideoData(null);
    setSearchByImageSelectedObjectId(null);
  }, [
    closeVideoModal,
    cancelSearchByImage,
  ]);

  const handleCreateReport = React.useCallback(async (values: NewReportFormValues) => {
    if (!activeVideoData || creatingReport) {
      return;
    }

    const normalizedSourceQuery =
      typeof sourceQuery === 'string'
        ? sourceQuery.trim()
        : '';

    if (!normalizedSourceQuery) {
      console.error(
        '[SearchResultsMessage] sourceQuery is missing:',
        sourceQuery,
      );

      window.alert(
        '검색 쿼리를 확인할 수 없어 보고서를 생성할 수 없습니다.',
      );
      return;
    }

    const clipStartTime =
      videoModal.actualStartTime ||
      activeVideoData.start_time;

    const reportStreamId =
      videoModal.streamId ||
      activeVideoData.sensor_id;

    if (!vstApiUrl.trim()) {
      window.alert('VST API URL이 설정되지 않았습니다.');
      return;
    }

    if (
      typeof reportStreamId !== 'string' ||
      !reportStreamId.trim()
    ) {
      window.alert(
        '보고서 프레임의 Stream ID를 확인할 수 없습니다.',
      );
      return;
    }

    if (
      typeof clipStartTime !== 'string' ||
      !clipStartTime.trim()
    ) {
      window.alert(
        '검색 결과 클립의 시작 시간을 확인할 수 없습니다.',
      );
      return;
    }

    setCreatingReport(true);

    try {
      const frameDataUrl =
        await fetchReportFrameDataUrl(
          vstApiUrl,
          reportStreamId,
          clipStartTime,
          values.pauseTime,
        );

      const token =
        window.localStorage.getItem('vss.auth.token');

      if (!token) {
        throw new Error(
          'Authentication token is missing',
        );
      }

      const displayVideoName =
        sensorIdToNameMap.get(
          activeVideoData.sensor_id,
        ) ||
        activeVideoData.video_name ||
        '검색 결과';

      const reportId =
        `report-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      const report = {
        id: reportId,
        title: values.title,
        createdAt: new Date().toISOString(),
        author: values.author,
        description: values.situationDescription?.trim() ?? '',
        query: normalizedSourceQuery,
        items: [
          {
            id: [
              activeVideoData.sensor_id ?? '',
              activeVideoData.start_time ?? '',
              activeVideoData.end_time ?? '',
              activeVideoData.video_name ?? '',
              Math.round(
                Math.max(0, values.pauseTime) * 1000,
              ),
            ].join('::'),
            videoName: displayVideoName,
            locationName: values.place?.trim() || displayVideoName,
            description:
              values.situationDescription?.trim() ?? '',
            comment:
              values.situationDescription?.trim() ?? '',
            query: normalizedSourceQuery,
            startTime:
              activeVideoData.start_time ?? '',
            endTime:
              activeVideoData.end_time ?? '',
            sensorId:
              activeVideoData.sensor_id ?? '',
            similarity:
              activeVideoData.similarity ?? 0,
            pauseTime:
              values.pauseTime,
            screenshotUrl:
              frameDataUrl,
          },
        ],
      };
      
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Failed to create report: ${response.status} ${errorText}`,
        );
      }

      window.dispatchEvent(
        new CustomEvent(REPORTS_UPDATED_EVENT),
      );

      window.dispatchEvent(
        new CustomEvent(OPEN_REPORT_TAB_EVENT, {
          detail: {
            tabId: 'report',
            reportId,
          },
        }),
      );

      closeVideoModal();
      setActiveVideoData(null);
    } catch (error) {
      console.error(
        '[SearchResultsMessage] Failed to create report:',
        error,
      );

      window.alert('보고서 생성에 실패했습니다.');
    } finally {
      setCreatingReport(false);
    }
  },
  [
    activeVideoData,
    creatingReport,
    sourceQuery,
    sensorIdToNameMap,
    closeVideoModal,
    vstApiUrl,
    videoModal.actualStartTime,
    videoModal.streamId,
  ],
);

  const handleRefresh = React.useCallback(() => {
    /*
     * Chat 메시지의 검색 결과는 이미 완료된 응답이므로
     * Search 메뉴처럼 재조회할 API 호출은 하지 않습니다.
     */
  }, []);

  const searchByImageTargetOffsetSeconds = React.useMemo(() => {
    if (!activeVideoData?.matched_object_timestamp || !activeVideoData.start_time) {
      return undefined;
    }

    const matchedTime = new Date(activeVideoData.matched_object_timestamp).getTime();
    const clipStartTime = new Date(activeVideoData.start_time).getTime();

    if (Number.isNaN(matchedTime) || Number.isNaN(clipStartTime)) {
      return undefined;
    }

    return Math.max(0, (matchedTime - clipStartTime) / 1000);
  }, [activeVideoData]);

  const requestedClipDurationSeconds = React.useMemo(() => {
    if (!activeVideoData?.start_time || !activeVideoData.end_time) {
      return undefined;
    }

    const startTime = new Date(activeVideoData.start_time).getTime();
    const endTime = new Date(activeVideoData.end_time).getTime();

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return undefined;
    }

    return Math.max(0, (endTime - startTime) / 1000);
  }, [activeVideoData]);

  const handleSearchByImageRequest = React.useCallback(
    (pauseOffsetSeconds: number) => {
      if (
        !activeVideoData ||
        !videoModal.videoUrl
      ) {
        console.error(
          '[SearchByImage] active video data or video URL is missing',
          {
            activeVideoData,
            videoUrl:
              videoModal.videoUrl,
          },
        );

        return;
      }

      const sensorName = sensorIdToNameMap.get(activeVideoData.sensor_id) || activeVideoData.sensor_id;
      const matchedTimestamp = activeVideoData.matched_object_timestamp;

      void startSearchByImage(
        activeVideoData.sensor_id, 
        sensorName,matchedTimestamp || activeVideoData.start_time,
        matchedTimestamp
          ? 0
          : pauseOffsetSeconds,
        videoModal.videoUrl,
        Array.isArray(activeVideoData.object_ids)
          ? activeVideoData.object_ids
          : undefined,
        activeVideoData.matched_object_timestamp,
        activeVideoData.matched_object_type,
        activeVideoData.matched_object_bbox,
      );
    },
    [
      activeVideoData,
      sensorIdToNameMap,
      startSearchByImage,
      videoModal.videoUrl,
    ],
  );

  const handleSearchByImageConfirm = 
  React.useCallback(
    (objectId: string) => {
      if (!onSubmitMessage) {
        return;
      }

      const prompt =
        `Find similar objects matching object_id=${objectId}`;

      void Promise.resolve(
        onSubmitMessage(prompt),
      );

      cancelSearchByImage();
      closeVideoModal();
      setActiveVideoData(null);
      setSearchByImageSelectedObjectId(null);
    },
    [
      onSubmitMessage,
      cancelSearchByImage,
      closeVideoModal,
    ],
  );

  const searchByImageFooterElement =
  React.useMemo(() => {
    if (!searchByImageActive) {
      return undefined;
    }

    return (
      <SearchByImageOverlayInfo
        frameData={searchByImageFrameData}
        selectedObjectId={
          searchByImageSelectedObjectId
        }
        onConfirm={handleSearchByImageConfirm}
        onCancel={cancelSearchByImage}
        isDark={isDark}
      />
    );
  }, [
    searchByImageActive,
    searchByImageFrameData,
    searchByImageSelectedObjectId,
    handleSearchByImageConfirm,
    cancelSearchByImage,
    isDark,
  ]);

  const modalSituationDescription = React.useMemo(() => {
    if (!activeVideoData) {
      return '';
    }

    const criticKey =
      activeVideoData.critic_result
        ? JSON.stringify({
            sensorId:
              activeVideoData.sensor_id,
            timestamp:
              activeVideoData
                .matched_object_timestamp ||
              activeVideoData.start_time,
            criteria:
              activeVideoData
                .critic_result
                ?.criteria_met,
          })
        : undefined;

    if (criticKey) {
      return (
        criticDescriptions[criticKey] ??
        '검증 설명을 생성하고 있습니다…'
      );
    }

    return (
      activeVideoData
        .critic_result
        ?.result ||
      activeVideoData.description ||
      ''
    );
  }, [
    activeVideoData,
    criticDescriptions,
  ]);

  const metadataFooterElement = React.useMemo(() => {
    if (!activeVideoData) return undefined;

    const displayVideoName =
      sensorIdToNameMap.get(activeVideoData.sensor_id) || activeVideoData.video_name || '검색 결과';

    const timestamp = buildVideoTimestampRange(activeVideoData.start_time, activeVideoData.end_time, activeVideoData.matched_object_timestamp);

    const activeCriticKey = activeVideoData && activeVideoData.critic_result
      ? JSON.stringify({ sensorId: activeVideoData.sensor_id, timestamp: activeVideoData.matched_object_timestamp || activeVideoData.start_time, criteria: activeVideoData.critic_result?.criteria_met })
      : undefined;

    // If there is a critic_result but no cached description yet,
    // show a consistent "generating" message rather than the raw verdict.
    const sentence = activeCriticKey
      ? (criticDescriptions[activeCriticKey] ?? '검증 설명을 생성하고 있습니다…')
      : (activeVideoData.critic_result?.result || activeVideoData.description || '');

    console.debug('[SearchResultsMessage] activeCriticKey, cachedDescription, sentence', {
      activeCriticKey,
      cached: activeCriticKey ? criticDescriptions[activeCriticKey] : undefined,
      sentence,
    });

    return (
      <div data-testid="video-modal-critic-summary" className={`px-4 py-3 text-base leading-6 ${isDark ? 'bg-slate-900 text-gray-100' : 'bg-slate-50 text-gray-900'}`}>
        <div><span className="font-bold">시간: </span><span>{timestamp}</span></div>
        <div><span className="font-bold">설명: {' '}</span><span>{modalSituationDescription || '-'}</span></div>
      </div>
    );
  }, [
    activeVideoData,
    sensorIdToNameMap,
    isDark,
    modalSituationDescription,
  ]);

  React.useEffect(() => {
    const critic = activeVideoData?.critic_result;
    if (!critic) {
      console.info('[SearchResultsMessage] No critic_result on activeVideoData');
      setCriticDescriptionLoading(false);
      return;
    }

    if (!agentApiUrl) {
      console.info('[SearchResultsMessage] NEXT_PUBLIC_AGENT_API_URL is not configured');
      setCriticDescriptionLoading(false);
      return;
    }

    const key = JSON.stringify({ sensorId: activeVideoData?.sensor_id, timestamp: activeVideoData?.matched_object_timestamp || activeVideoData?.start_time, criteria: critic.criteria_met });
    if (criticDescriptions[key]) {
      console.info('[SearchResultsMessage] Critic description already cached for key', key);
      return;
    }

    const controller = new AbortController();
    setCriticDescriptionLoading(true);

    const url = `${agentApiUrl.replace(/\/$/, '')}/critic-description`;
    const body = { criteria_met: critic.criteria_met };

    console.info('[SearchResultsMessage] Fetching critic description', { url, key, body });

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (res) => {
        const text = await res.text();
        console.info('[SearchResultsMessage] /critic-description response', { status: res.status, statusText: res.statusText, text });
        if (!res.ok) throw new Error(text || `Status ${res.status}`);
        try {
          return JSON.parse(text);
        } catch (e) {
          console.warn('[SearchResultsMessage] Failed to parse JSON from critic-description response', e);
          return null;
        }
      })
      .then((body) => {
        const description = String(body?.description ?? '').trim();
        console.info('[SearchResultsMessage] Parsed critic-description body', { description });
        if (description) {
          setCriticDescriptions((cur) => ({ ...cur, [key]: description }));
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('[SearchResultsMessage] Failed to fetch critic description:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCriticDescriptionLoading(false);
      });

    return () => controller.abort();
  }, [activeVideoData, agentApiUrl, criticDescriptions]);

  const searchByImageOverlayElement =
  React.useMemo<React.ReactNode | undefined>(
    () => {
      if (!searchByImageActive) {
        return undefined;
      }

      let content: React.ReactNode;

      if (searchByImageLoading) {
        content = (
          <div className="flex h-full min-h-[400px] items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />

              <span className="text-sm">
                Loading frame data for Search by Image...
              </span>
            </div>
          </div>
        );
      } else if (searchByImageError) {
        content = (
          <div className="flex h-full min-h-[400px] items-center justify-center bg-black text-red-400">
            <div className="flex max-w-md flex-col items-center gap-3 text-center">
              <span className="text-sm">
                {searchByImageError}
              </span>
            </div>
          </div>
        );
      } else if (searchByImageFrameData) {
        content = (
          <SearchByImageOverlayComponent
            frameData={searchByImageFrameData}
            selectedObjectId={
              searchByImageSelectedObjectId
            }
            onSelectObject={
              setSearchByImageSelectedObjectId
            }
          />
        );
      } else {
        return undefined;
      }

      return (
        <div className="h-full min-h-0">
          {content}
        </div>
      );
    },
    [
      searchByImageActive,
      searchByImageLoading,
      searchByImageError,
      searchByImageFrameData,
      searchByImageSelectedObjectId,
    ],
  );

  const modalTitle = searchByImageActive ? (
    <span className="inline-flex items-baseline gap-2">
      <span>{videoModal.title}</span>

      <span className="max-w-[360px] truncate text-xs font-normal text-gray-600 dark:text-gray-400">
        (Search by Image Mode)
      </span>
    </span>
  ) : (
    videoModal.title
  );

  console.log(
    '[DEBUG] SearchResultsMessage -> SearchVideoModal',
    {
      handleCreateReport,
      handleCreateReportType:
        typeof handleCreateReport,
      hasHandleCreateReport:
        !!handleCreateReport,
      creatingReport,
      activeVideoData:
        !!activeVideoData,
      videoModalIsOpen:
        videoModal.isOpen,
      videoUrl:
        videoModal.videoUrl,
    },
  );

  return (
    <div className="not-prose mt-4 w-full min-w-0">
      <VideoSearchList
        data={searchData}
        loading={false}
        error={null}
        isDark={isDark}
        onRefresh={handleRefresh}
        onPlayVideo={handlePlayVideo}
        showObjectsBbox={false}
      />

      <SearchVideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={modalTitle}
        onClose={handleCloseVideoModal}
        defaultSituationDescription={modalSituationDescription}
        searchByImageEnabled={canSearchByImage}
        onSearchByImageRequest={
          canSearchByImage ? handleSearchByImageRequest : undefined
        }
        searchByImageFooter={searchByImageFooterElement ?? metadataFooterElement}
        searchByImageOverlay={searchByImageOverlayElement}
        onCreateReport={handleCreateReport}
        onAddToExistingReport={handleAddToExistingReport}
        onLoadExistingReports={loadExistingReports}
        searchByImageTargetOffsetSeconds={searchByImageTargetOffsetSeconds}
        faceMatchBbox={
          activeVideoData?.matched_object_type === 'face'
            ? activeVideoData.matched_object_bbox
            : undefined
        }
        faceMatchOffsetSeconds={
          activeVideoData?.matched_object_type === 'face'
            ? searchByImageTargetOffsetSeconds
            : undefined
        }
        requestedClipDurationSeconds={
          activeVideoData?.matched_object_type === 'face'
            ? requestedClipDurationSeconds
            : undefined
        }
        existingReports={availableReports.map((report) => ({
          id: report.id,
          title: report.title,
        }))}
        loadingReports={loadingReports}
        creatingReport={creatingReport}
      />
    </div>
  );
};
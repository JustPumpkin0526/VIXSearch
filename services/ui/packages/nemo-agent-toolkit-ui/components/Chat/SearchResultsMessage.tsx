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
  type SearchData,
} from '@nv-metropolis-bp-vss-ui/search';

type CriticResult = {
  result: 'confirmed' | 'rejected' | 'unverified' | string;
  criteria_met: Record<string, boolean>;
};

const SearchByImageOverlayComponent = dynamic(
  () =>
    import('@nv-metropolis-bp-vss-ui/search').then(
      (module) => module.SearchByImageOverlay,
    ),
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
  critic_result?: CriticResult | null;
};

type ParsedSearchResultsMessage = {
  results: SearchResultItem[];
};

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
    critic_result: normalizeCriticResult(value.critic_result ?? value.criticResult),
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
    similarity:
      typeof item.similarity === 'number'
        ? item.similarity
        : Number(item.similarity) || 0,
    screenshot_url: item.screenshot_url ?? '',
    object_ids: Array.isArray(item.object_ids)
      ? item.object_ids
      : [],
    critic_result: criticStatus
      ? {
          result: criticStatus,
          criteria_met:
            item.critic_result?.criteria_met ?? {},
        }
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
  sourceQuery?: string;
  onSubmitMessage?: (
    content: string,
  ) => void | Promise<void>;
}

export const SearchResultsMessage: React.FC<SearchResultsMessageProps> = ({ results, onSubmitMessage }) => {
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

  const canSearchByImage =
    searchByImageConfigured &&
    Boolean(vstApiUrl) &&
    Boolean(mdxWebApiUrl) &&
    Boolean(onSubmitMessage);

  const searchData = React.useMemo<SearchData[]>(
    () => results.map(toSearchData),
    [results],
  );

  const [activeVideoData, setActiveVideoData] = React.useState<SearchData | null>(null);

  const [
    searchByImageSelectedObjectId,
    setSearchByImageSelectedObjectId,
  ] = React.useState<string | null>(null);

  const { streams } = useFilter({ vstApiUrl });

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

  const handleRefresh = React.useCallback(() => {
    /*
     * Chat 메시지의 검색 결과는 이미 완료된 응답이므로
     * Search 메뉴처럼 재조회할 API 호출은 하지 않습니다.
     */
  }, []);

  const handleSearchByImageRequest =
  React.useCallback(
    (pauseOffsetSeconds: number) => {
      if (!activeVideoData) {
        return;
      }

      const sensorName =
        sensorIdToNameMap.get(
          activeVideoData.sensor_id,
        ) || activeVideoData.sensor_id;

      void startSearchByImage(
        activeVideoData.sensor_id,
        sensorName,
        activeVideoData.start_time,
        pauseOffsetSeconds,
        videoModal.videoUrl,
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
        searchByImageEnabled={canSearchByImage}
        onSearchByImageRequest={
          canSearchByImage
            ? handleSearchByImageRequest
            : undefined
        }
        searchByImageFooter={
          searchByImageFooterElement
        }
        searchByImageOverlay={
          searchByImageOverlayElement
        }
      />
    </div>
  );
};
'use client';

import React from 'react';
import { env } from 'next-runtime-env';

import { useVideoModal } from '@aiqtoolkit-ui/common';
import {
  SearchVideoModal,
  VideoSearchList,
  type SearchData,
} from '@nv-metropolis-bp-vss-ui/search';

type CriticResult = {
  result: 'confirmed' | 'rejected' | 'unverified' | string;
  criteria_met: Record<string, boolean>;
};

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

type ReportSceneItem = {
  id: string;
  videoName: string;
  description: string;
  screenshotUrl?: string;

  // 기존 보고서 데이터와의 호환성을 위해 optional로 유지
  startTime?: string;
  endTime?: string;
  sensorId?: string;
  similarity?: number;
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

function resolveDirectVideoUrl(
  rawUrl: string,
  vstApiUrl: string,
): string {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const baseUrl =
      vstApiUrl ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : undefined);

    return baseUrl
      ? new URL(trimmed, baseUrl).toString()
      : trimmed;
  } catch {
    return trimmed;
  }
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
}

export const SearchResultsMessage: React.FC<
  SearchResultsMessageProps
> = ({ results }) => {
  const isDark = useDarkTheme();

  const vstApiUrl =
    env('NEXT_PUBLIC_VST_API_URL') ||
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_VST_API_URL
      : '') ||
    '';

  const searchData = React.useMemo<SearchData[]>(
    () => results.map(toSearchData),
    [results],
  );

  const originalResultMap = React.useMemo(() => {
    return new Map(
      results.map((item) => [getResultKey(item), item]),
    );
  }, [results]);

  const {
    videoModal,
    openVideoModal,
    openVideoModalFromUrl,
    closeVideoModal,
  } = useVideoModal(vstApiUrl);

  const handlePlayVideo = React.useCallback(
    (item: SearchData, showObjectsBbox: boolean) => {
      const original = originalResultMap.get(
        getResultKey(item),
      );

      /*
       * Chat API가 직접 clip URL을 내려준 경우에는 해당 URL을 사용하고,
       * 직접 URL이 없으면 기존 Search 메뉴와 동일하게
       * sensor_id/start_time/end_time으로 VST clip URL을 조회합니다.
       */
      const directUrl =
        original?.clip_url ||
        original?.video_url ||
        original?.url ||
        '';

      if (directUrl) {
        openVideoModalFromUrl(
          item.video_name,
          resolveDirectVideoUrl(directUrl, vstApiUrl),
        );
        return;
      }

      void openVideoModal(item, showObjectsBbox);
    },
    [
      originalResultMap,
      openVideoModal,
      openVideoModalFromUrl,
      vstApiUrl,
    ],
  );

  const handleRefresh = React.useCallback(() => {
    /*
     * Chat 메시지의 검색 결과는 이미 완료된 응답이므로
     * Search 메뉴처럼 재조회할 API 호출은 하지 않습니다.
     */
  }, []);

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
        title={videoModal.title}
        onClose={closeVideoModal}
      />
    </div>
  );
};
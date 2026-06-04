import React from 'react';
import { env } from 'next-runtime-env';
import { Whisper, Tooltip } from 'rsuite';

import { VideoModal } from '../Markdown/VideoModal';

type SearchResultItem = {
  video_name: string;
  similarity: number;
  screenshot_url: string;
  description: string;
  start_time: string;
  end_time: string;
  sensor_id: string;
  object_ids: string[];
};

type SearchApiShape = {
  data?: unknown[];
};

export type ParsedSearchResultsMessage = {
  results: SearchResultItem[];
  summary: string;
};

type SearchResultsMessageProps = {
  results: SearchResultItem[];
};

type VideoModalState = {
  isOpen: boolean;
  videoUrl: string;
  title: string;
};

const parseDateAsLocal = (dateString: string): Date | null => {
  if (!dateString || typeof dateString !== 'string' || !dateString.trim()) {
    return null;
  }

  const cleanedDateString = dateString.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const date = new Date(cleanedDateString);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatTime = (date: Date | null): string => {
  if (!date || isNaN(date.getTime())) {
    return '--:--:--';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const normalizeSearchResult = (item: any): SearchResultItem => ({
  video_name: item.video_name || '',
  similarity: item.similarity ?? 0,
  screenshot_url: item.screenshot_url || '',
  description: item.description || '',
  start_time: item.start_time || '',
  end_time: item.end_time || '',
  sensor_id: item.sensor_id || '',
  object_ids: Array.isArray(item.object_ids) ? item.object_ids : [],
});

const extractFirstTopLevelJsonObject = (text: string): { json: string; start: number; end: number } | null => {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  for (let index = firstBrace; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    } else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          json: text.slice(firstBrace, index + 1),
          start: firstBrace,
          end: index + 1,
        };
      }
    }
  }

  return null;
};

export const extractSearchResultsMessage = (responseText: string): ParsedSearchResultsMessage | null => {
  if (!responseText || typeof responseText !== 'string') {
    return null;
  }

  const trimmed = responseText.trim();
  let parsed: SearchApiShape | null = null;
  let summary = trimmed;

  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (jsonBlockMatch) {
    try {
      parsed = JSON.parse(jsonBlockMatch[1].trim()) as SearchApiShape;
      summary = trimmed.replace(jsonBlockMatch[0], '').trim();
    } catch {
      parsed = null;
    }
  }

  if (!parsed || !Array.isArray(parsed.data)) {
    const extractedObject = extractFirstTopLevelJsonObject(trimmed);
    if (extractedObject) {
      try {
        parsed = JSON.parse(extractedObject.json) as SearchApiShape;
        summary = `${trimmed.slice(0, extractedObject.start)}${trimmed.slice(extractedObject.end)}`.trim();
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed || !Array.isArray(parsed.data)) {
    return null;
  }

  const results = parsed.data.map(normalizeSearchResult).filter((item) => item.video_name || item.screenshot_url || item.sensor_id);
  if (results.length === 0) {
    return null;
  }

  return { results, summary };
};

export const SearchResultsMessage: React.FC<SearchResultsMessageProps> = ({ results }) => {
  const [videoModal, setVideoModal] = React.useState<VideoModalState>({
    isOpen: false,
    videoUrl: '',
    title: '',
  });
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const vstApiUrl = env('NEXT_PUBLIC_VST_API_URL') || process?.env?.NEXT_PUBLIC_VST_API_URL || '';
  const showObjectsBbox = String(env('NEXT_PUBLIC_SEARCH_TAB_MEDIA_WITH_OBJECTS_BBOX') || process?.env?.NEXT_PUBLIC_SEARCH_TAB_MEDIA_WITH_OBJECTS_BBOX || '') === 'true';

  const closeVideoModal = React.useCallback(() => {
    setVideoModal({
      isOpen: false,
      videoUrl: '',
      title: '',
    });
  }, []);

  const openVideoModal = React.useCallback(async (videoData: SearchResultItem) => {
    if (!vstApiUrl || !videoData.sensor_id) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const hasObjectIds = showObjectsBbox && Array.isArray(videoData.object_ids) && videoData.object_ids.length > 0;
      const params = new URLSearchParams({
        startTime: videoData.start_time,
        endTime: videoData.end_time,
        expiryMinutes: '60',
        container: 'mp4',
        disableAudio: 'true',
      });

      if (hasObjectIds) {
        params.set('configuration', JSON.stringify({
          overlay: {
            bbox: { showAll: false, showObjId: true, objectId: videoData.object_ids.map(String) },
            color: 'red',
            thickness: 5,
            debug: false,
            opacity: 254,
          },
        }));
      }

      const response = await fetch(`${vstApiUrl}/v1/storage/file/${videoData.sensor_id}/url?${params.toString()}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video URL: ${response.status}`);
      }

      const data = await response.json();
      if (abortController.signal.aborted) {
        return;
      }

      let finalVideoUrl = data.videoUrl;

      if (data.videoUrl && vstApiUrl) {
        try {
          const vstUrl = new URL(vstApiUrl);
          const videoUrl = new URL(data.videoUrl);
          const vstPathIndex = vstUrl.pathname.indexOf('/vst');
          const videoPathIndex = videoUrl.pathname.indexOf('/vst');

          if (vstPathIndex !== -1 && videoPathIndex !== -1) {
            const vstBase = `${vstUrl.protocol}//${vstUrl.host}${vstUrl.pathname.substring(0, vstPathIndex + 4)}`;
            const videoPathAfterVst = videoUrl.pathname.substring(videoPathIndex + 4);
            finalVideoUrl = `${vstBase}${videoPathAfterVst}${videoUrl.search}${videoUrl.hash}`;
          }
        } catch {
          finalVideoUrl = data.videoUrl;
        }
      }

      setVideoModal({
        isOpen: true,
        videoUrl: finalVideoUrl,
        title: videoData.video_name,
      });
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
  }, [showObjectsBbox, vstApiUrl]);

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <>
      <div className="not-prose mt-4 w-full">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
            Search Results
          </h4>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {results.length} items
          </span>
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {results.map((item, index) => (
            <div
              key={`${item.video_name}-${item.sensor_id}-${index}`}
              className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700"
            >
              <div className="space-y-3 p-4 pb-0">
                <div>
                  <Whisper placement="top" trigger="hover" speaker={<Tooltip>{item.video_name}</Tooltip>}>
                    <h3 className="cursor-default truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.video_name}
                    </h3>
                  </Whisper>
                </div>
                <div className="group relative aspect-video rounded-2xl">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900">
                    {item.screenshot_url ? (
                      <img src={item.screenshot_url} alt={item.video_name} className="h-full w-full rounded-2xl object-cover" />
                    ) : null}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => openVideoModal(item)}
                      disabled={!vstApiUrl || !item.sensor_id}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-[rgb(209_255_117_/_0.6)] shadow-lg transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14"
                    >
                      <svg className="ml-0.5 h-6 w-6 text-white sm:h-7 sm:w-7" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 py-2">
                    <div className="text-xs text-white">
                      <span className="font-medium">{formatTime(parseDateAsLocal(item.start_time))}</span>
                      <span className="mx-1">/</span>
                      <span className="font-medium">{formatTime(parseDateAsLocal(item.end_time))}</span>
                    </div>
                    {item.description ? (
                      <Whisper placement="top" trigger="hover" speaker={<Tooltip>{item.description}</Tooltip>}>
                        <div className="cursor-default rounded-full bg-white/20 px-2 py-1 backdrop-blur-sm">
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </Whisper>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-baseline justify-between p-4 pt-3">
                <span className="text-xs text-gray-600 dark:text-gray-400">Similarity:</span>
                <span className="ml-1 rounded-md bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
                  {Number(item.similarity || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <VideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={videoModal.title}
        onClose={closeVideoModal}
      />
    </>
  );
};
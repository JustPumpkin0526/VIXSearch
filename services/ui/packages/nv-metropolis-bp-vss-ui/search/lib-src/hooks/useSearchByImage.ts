// SPDX-License-Identifier: MIT

import { useCallback, useRef, useState } from 'react';
import { SearchByImageFrameData, BboxObject, BboxCoords } from '../types';

interface UseSearchByImageOptions {
  vstApiUrl?: string;
  mdxWebApiUrl?: string;
}

interface SearchByImageState {
  active: boolean;
  loading: boolean;
  error: string | null;
  frameData: SearchByImageFrameData | null;
}

/**
 * The frame index and the object-embedding index can be recorded at slightly
 * different cadences. Query around the matched instant, then choose the
 * closest indexed frame rather than assuming an exact timestamp exists.
 */
const FRAME_LOOKUP_WINDOW_MS = 1_000;
// A tracker ID alone does not identify an object across arbitrary frames. Only
// highlight it when the paused frame is the exact matched frame (within index
// cadence), otherwise leave every box white and let the user choose manually.
const MATCH_TIMESTAMP_TOLERANCE_MS = 250;

interface FrameApiBbox {
  leftX?: number;
  topY?: number;
  rightX?: number;
  bottomY?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

interface FrameApiObject {
  id?: string | number;
  objectId?: string | number;
  bbox?: FrameApiBbox;
  type?: string;
  class?: string;
  className?: string;
  objectType?: string;
}

interface FrameDataItem {
  timestamp?: string;
  frame_timestamp?: string;
  frameTimestamp?: string;
  metadata?: {
    objects?: FrameApiObject[];
  };
  objects?: FrameApiObject[];
}

interface FrameMetadataResult {
  objects: BboxObject[];
  indexedTimestamp: string | null;
}

interface FrameImageResult {
  frameImage: HTMLImageElement;
  timestamp: string;
}

const FRAME_SEARCH_WINDOWS_MS = [
  250,
  1000,
  3000,
];

const PICTURE_FALLBACK_OFFSETS_MS = [
  0,
  -100,
  100,
  -250,
  250,
];

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function getFrameTimestamp(
  frame: FrameDataItem,
): string | null {
  return (
    frame.timestamp ||
    frame.frame_timestamp ||
    frame.frameTimestamp ||
    null
  );
}

function normalizeFrames(
  payload: unknown,
): FrameDataItem[] {
  if (Array.isArray(payload)) {
    return payload as FrameDataItem[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const value = payload as Record<string, unknown>;

  if (Array.isArray(value.frames)) {
    return value.frames as FrameDataItem[];
  }

  if (Array.isArray(value.data)) {
    return value.data as FrameDataItem[];
  }

  if (Array.isArray(value.items)) {
    return value.items as FrameDataItem[];
  }

  return [payload as FrameDataItem];
}

function normalizeObjects(
  frame: FrameDataItem | undefined,
): BboxObject[] {
  const rawObjects =
    frame?.metadata?.objects ??
    frame?.objects ??
    [];

  return rawObjects
    .filter(
      (object) =>
        (object.id !== undefined ||
          object.objectId !== undefined) &&
        object.bbox,
    )
    .map((object) => ({
      id: String(
        object.id ??
        object.objectId,
      ),
      type:
        object.type ??
        object.class ??
        object.className ??
        object.objectType,
      bbox: {
        leftX: Number(
          object.bbox?.leftX ??
          object.bbox?.left ??
          0,
        ),
        topY: Number(
          object.bbox?.topY ??
          object.bbox?.top ??
          0,
        ),
        rightX: Number(
          object.bbox?.rightX ??
          object.bbox?.right ??
          0,
        ),
        bottomY: Number(
          object.bbox?.bottomY ??
          object.bbox?.bottom ??
          0,
        ),
      },
    }));
}

async function fetchNearestFrameMetadata(
  mdxWebApiUrl: string | undefined,
  sensorName: string,
  targetTimestamp: string,
  signal: AbortSignal,
): Promise<FrameMetadataResult> {
  const empty: FrameMetadataResult = {
    objects: [],
    indexedTimestamp: null,
  };

  if (!mdxWebApiUrl || !sensorName) {
    return empty;
  }

  const targetMs = parseTimestamp(targetTimestamp);

  if (targetMs === null) {
    return empty;
  }

  for (const windowMs of FRAME_SEARCH_WINDOWS_MS) {
    const fromTimestamp =
      new Date(targetMs - windowMs).toISOString();

    const toTimestamp =
      new Date(targetMs + windowMs).toISOString();

    const params = new URLSearchParams({
      sensorId: sensorName,
      fromTimestamp,
      toTimestamp,
    });

    const url =
      `${mdxWebApiUrl}/frames?${params.toString()}`;

    try {
      const response = await fetch(url, {
        signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn(
          '[SearchByImage] /frames failed',
          {
            status: response.status,
            url,
          },
        );

        continue;
      }

      const payload = await response.json();
      const frames = normalizeFrames(payload);

      if (frames.length === 0) {
        continue;
      }

      let bestFrame:
        | FrameDataItem
        | undefined;

      let bestTimestamp:
        | string
        | null = null;

      let bestDelta = Number.POSITIVE_INFINITY;

      for (const frame of frames) {
        const timestamp =
          getFrameTimestamp(frame);

        const timestampMs =
          parseTimestamp(timestamp);

        if (
          !timestamp ||
          timestampMs === null
        ) {
          continue;
        }

        const delta =
          Math.abs(timestampMs - targetMs);

        if (delta < bestDelta) {
          bestDelta = delta;
          bestFrame = frame;
          bestTimestamp = timestamp;
        }
      }

      /*
       * API가 timestamp 없이 단일 프레임을 반환하는
       * 경우에 대한 fallback입니다.
       */
      if (!bestFrame) {
        bestFrame = frames[0];
      }

      return {
        objects: normalizeObjects(bestFrame),
        indexedTimestamp: bestTimestamp,
      };
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error;
      }

      console.warn(
        '[SearchByImage] failed to fetch frame metadata',
        error,
      );
    }
  }

  return empty;
}

async function decodeImageBlob(
  blob: Blob,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  if (blob.size === 0) {
    throw new Error(
      'VST returned an empty frame image',
    );
  }

  if (
    blob.type &&
    !blob.type.startsWith('image/')
  ) {
    throw new Error(
      `Unexpected frame content type: ${blob.type}`,
    );
  }

  const objectUrl =
    URL.createObjectURL(blob);

  return new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';

      let settled = false;

      const cleanup = () => {
        signal.removeEventListener(
          'abort',
          handleAbort,
        );

        URL.revokeObjectURL(objectUrl);
      };

      const finishResolve = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(image);
      };

      const finishReject = (
        error: Error,
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(error);
      };

      const handleAbort = () => {
        image.src = '';

        finishReject(
          new DOMException(
            'Aborted',
            'AbortError',
          ),
        );
      };

      signal.addEventListener(
        'abort',
        handleAbort,
        { once: true },
      );

      image.onload = () => {
        /*
         * onload 이후에는 이미지 데이터가 브라우저에
         * 디코딩되었으므로 object URL을 해제해도
         * Konva에서 HTMLImageElement를 사용할 수 있습니다.
         */
        finishResolve();
      };

      image.onerror = () => {
        finishReject(
          new Error(
            'Failed to decode frame image',
          ),
        );
      };

      image.src = objectUrl;
    },
  );
}

async function fetchFrameImageAtTimestamp(
  vstApiUrl: string,
  sensorId: string,
  timestamp: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  const params = new URLSearchParams({
    startTime: timestamp,
  });

  const url =
    `${vstApiUrl}/v1/replay/stream/` +
    `${encodeURIComponent(sensorId)}/picture?` +
    params.toString();

  const response = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'image/*',
      streamId: sensorId,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch frame picture: ${response.status}`,
    );
  }

  const blob = await response.blob();

  return decodeImageBlob(
    blob,
    signal,
  );
}

function buildPictureTimestampCandidates(
  preferredTimestamp: string,
  requestedTimestamp: string,
): string[] {
  const values: string[] = [];

  const add = (value: string) => {
    if (
      value &&
      !values.includes(value)
    ) {
      values.push(value);
    }
  };

  add(preferredTimestamp);
  add(requestedTimestamp);

  const requestedMs =
    parseTimestamp(requestedTimestamp);

  if (requestedMs !== null) {
    for (
      const offsetMs of
      PICTURE_FALLBACK_OFFSETS_MS
    ) {
      add(
        new Date(
          requestedMs + offsetMs,
        ).toISOString(),
      );
    }
  }

  return values;
}

async function fetchFrameImageWithFallback(
  vstApiUrl: string,
  sensorId: string,
  timestamps: string[],
  signal: AbortSignal,
): Promise<FrameImageResult> {
  let lastError: unknown;

  for (const timestamp of timestamps) {
    try {
      const frameImage =
        await fetchFrameImageAtTimestamp(
          vstApiUrl,
          sensorId,
          timestamp,
          signal,
        );

      return {
        frameImage,
        timestamp,
      };
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error;
      }

      lastError = error;

      console.warn(
        '[SearchByImage] picture request failed',
        {
          sensorId,
          timestamp,
          error,
        },
      );
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          'Failed to load the nearest frame image',
        )
  );
}

function extractStartTimeFromVideoUrl(
  videoUrl: string,
): string | null {
  if (!videoUrl) {
    return null;
  }

  try {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.href
        : 'http://localhost';

    const url = new URL(
      videoUrl,
      baseUrl,
    );

    const possibleParams = [
      'startTime',
      'start_time',
      'fromTimestamp',
    ];

    for (const key of possibleParams) {
      const value =
        url.searchParams.get(key);

      const timestampMs =
        parseTimestamp(value);

      if (
        value &&
        timestampMs !== null
      ) {
        return new Date(
          timestampMs,
        ).toISOString();
      }
    }
  } catch {
    // 파일명 파싱으로 fallback
  }

  /*
   * 예:
   * video_20260101_120031_a83fd.mp4
   */
  const match = videoUrl.match(
    /(\d{8})_(\d{6})(?:_[^/?]+)?\.mp4/i,
  );

  if (!match) {
    return null;
  }

  const [, date, time] = match;

  const iso =
    `${date.slice(0, 4)}-` +
    `${date.slice(4, 6)}-` +
    `${date.slice(6, 8)}T` +
    `${time.slice(0, 2)}:` +
    `${time.slice(2, 4)}:` +
    `${time.slice(4, 6)}.000Z`;

  const timestampMs =
    parseTimestamp(iso);

  return timestampMs === null
    ? null
    : new Date(timestampMs).toISOString();
}

export const useSearchByImage = ({
  vstApiUrl,
  mdxWebApiUrl,
}: UseSearchByImageOptions) => {
  const [state, setState] =
    useState<SearchByImageState>({
      active: false,
      loading: false,
      error: null,
      frameData: null,
    });

  const abortRef = useRef<AbortController | null>(null);

  const startSearchByImage =
    useCallback(
      async (
        sensorId: string,
        sensorName: string,
        videoStartTime: string,
        pauseOffsetSeconds: number,
        videoUrl: string,
        matchedObjectIds?: string[],
        matchedObjectTimestamp?: string,
        matchedObjectType?: string,
        matchedObjectBbox?: BboxCoords
      ) => {
        if (!vstApiUrl) {
          setState({
            active: true,
            loading: false,
            error:
              'VST API URL is not configured',
            frameData: null,
          });

          return;
        }

        if (!sensorId) {
          setState({
            active: true,
            loading: false,
            error:
              'Sensor ID is missing',
            frameData: null,
          });

          return;
        }

        abortRef.current?.abort();

        const controller =
          new AbortController();

        abortRef.current = controller;

        setState({
          active: true,
          loading: true,
          error: null,
          frameData: null,
        });

        try {
          const actualStart =
            extractStartTimeFromVideoUrl(
              videoUrl,
            );

          const baseTime =
            actualStart ||
            videoStartTime;

          const startMs =
            parseTimestamp(baseTime);

          if (startMs === null) {
            throw new Error(
              `Invalid video start time: ${baseTime}`,
            );
          }

          const safePauseSeconds =
            Number.isFinite(
              pauseOffsetSeconds,
            )
              ? Math.max(
                  0,
                  pauseOffsetSeconds,
                )
              : 0;

          const requestedTimestamp =
            new Date(
              startMs +
              Math.round(
                safePauseSeconds *
                1000,
              ),
            ).toISOString();

          /*
           * 먼저 가장 가까운 분석 프레임을 찾습니다.
           */
          const metadataResult =
            await fetchNearestFrameMetadata(
              mdxWebApiUrl,
              sensorName,
              requestedTimestamp,
              controller.signal,
            );

          if (controller.signal.aborted) {
            return;
          }

          /*
           * 찾은 인덱싱 시각을 실제 picture 요청에 사용합니다.
           */
          const preferredTimestamp =
            metadataResult.indexedTimestamp ||
            requestedTimestamp;

          const timestampCandidates =
            buildPictureTimestampCandidates(
              preferredTimestamp,
              requestedTimestamp,
            );

              const imageResult =
            await fetchFrameImageWithFallback(
              vstApiUrl,
              sensorId,
              timestampCandidates,
              controller.signal,
            );

          if (controller.signal.aborted) {
            return;
          }

          /*
           * 이미지와 bbox의 시각이 크게 다르면 잘못된
           * bbox가 표시되지 않도록 객체 목록을 비웁니다.
           */
          let objects =
            metadataResult.objects;

          // If the caller provided matched object ids, mark those objects
          // so the overlay can render them differently (green stroke).
          if (Array.isArray(matchedObjectIds) && matchedObjectIds.length > 0) {
            const idsSet = new Set(matchedObjectIds.map(String));
            objects = objects.map((o) => ({
              ...o,
              isSearchMatch: idsSet.has(String(o.id)),
            }));
          }

          // Debug logs to help verify whether the matched ids are applied
          try {
            // eslint-disable-next-line no-console
            console.log('[SearchByImage] matchedObjectIds', matchedObjectIds);
            // eslint-disable-next-line no-console
            console.log('[SearchByImage] frame objects', objects.map((o) => ({ id: o.id, isSearchMatch: (o as any).isSearchMatch ?? false })));
          } catch (e) {
            // ignore logging errors
          }

          if (
            metadataResult.indexedTimestamp
          ) {
            const metadataMs =
              parseTimestamp(
                metadataResult.indexedTimestamp,
              );

            const imageMs =
              parseTimestamp(
                imageResult.timestamp,
              );

            if (
              metadataMs !== null &&
              imageMs !== null &&
              Math.abs(
                metadataMs - imageMs,
              ) > 500
            ) {
              objects = [];
            }
          }

          console.info(
            '[SearchByImage] frame loaded',
            {
              sensorId,
              sensorName,
              videoStartTime,
              actualStart,
              pauseOffsetSeconds:
                safePauseSeconds,
              requestedTimestamp,
              indexedTimestamp:
                metadataResult.indexedTimestamp,
              imageTimestamp:
                imageResult.timestamp,
              objectCount:
                objects.length,
            },
          );

          setState({
            active: true,
            loading: false,
            error: null,
            frameData: {
              frameImage:
                imageResult.frameImage,
              objects,
              sensorId,
              sensorName,
              timestamp:
                imageResult.timestamp,
            },
          });
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return;
          }

          console.error(
            '[SearchByImage] fetch failed',
            error,
          );

          setState({
            active: true,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load Search by Image frame',
            frameData: null,
          });
        }
      },
      [
        vstApiUrl,
        mdxWebApiUrl,
      ],
    );

  const cancelSearchByImage =
    useCallback(() => {
      abortRef.current?.abort();
      abortRef.current = null;

      setState({
        active: false,
        loading: false,
        error: null,
        frameData: null,
      });
    }, []);

  return {
    searchByImageActive:
      state.active,
    searchByImageLoading:
      state.loading,
    searchByImageError:
      state.error,
    searchByImageFrameData:
      state.frameData,
    startSearchByImage,
    cancelSearchByImage,
  };
};

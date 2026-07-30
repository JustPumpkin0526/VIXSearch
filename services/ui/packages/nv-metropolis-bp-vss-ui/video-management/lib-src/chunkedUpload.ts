// SPDX-License-Identifier: MIT
//
// Chunked upload helpers for the Video Management tab. The core chunking
// logic lives in the shared `@nemo-agent-toolkit/ui` package so the Chat
// upload path can reuse it; this file wraps it with notifyUploadComplete(),
// which posts to the universal /api/v1/videos/{sensor_id}/complete endpoint
// (sensor_id = VST sensor id returned in the final chunk response) so VM
// upload works on every profile (search/lvs/base/alerts).

// SPDX-License-Identifier: MIT

import type { FileUploadResponse } from './types';

import {
  chunkedUpload as sharedChunkedUpload,
} from '@nemo-agent-toolkit/ui';

import type {
  ChunkedUploadOptions,
} from '@nemo-agent-toolkit/ui';


const uploadCompleteRequests = new Map<string, Promise<void>>();

export type { ChunkedUploadOptions };

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

function isFileUploadResponse(
  value: unknown,
): value is FileUploadResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const response =
    value as Record<string, unknown>;

  const bytes = response['bytes'];

  return (
    isNonEmptyString(response['id']) &&
    isNonEmptyString(response['filename']) &&
    
    typeof bytes === 'number' &&
    Number.isFinite(bytes) &&
    
    typeof response['sensorId'] === 'string' &&
    isNonEmptyString(response['streamId']) &&
    isNonEmptyString(response['filePath']) &&
    isNonEmptyString(response['created_at'])
  );
}

export async function chunkedUpload(
  options: ChunkedUploadOptions,
): Promise<FileUploadResponse> {
  const response: unknown =
    await sharedChunkedUpload(options);

  if (!isFileUploadResponse(response)) {
    console.error(
      '[VideoManagement] Invalid VST upload response:',
      response,
    );

    throw new Error(
      'VST upload response does not match FileUploadResponse',
    );
  }

  return {
    id: response.id.trim(),
    filename: response.filename.trim(),
    bytes: response.bytes,
    sensorId: response.sensorId.trim(),
    streamId: response.streamId.trim(),
    filePath: response.filePath.trim(),
    created_at: response.created_at.trim(),
  };
}

export async function notifyUploadComplete(
  agentApiUrl: string,
  filename: string,
  videoUploadApiResponse: FileUploadResponse,
  formData?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const streamId = videoUploadApiResponse.streamId;

  if (!streamId) {
    throw new Error(
      'notifyUploadComplete: VST upload response missing streamId',
    );
  }

  const existing =
    uploadCompleteRequests.get(streamId);

  if (existing) {
    console.warn(
      `[VideoManagement] /complete already in flight ` +
      `for streamId=${streamId}; reusing existing request`,
    );

    return existing;
  }

  const requestPromise = (async () => {
    const url =
      `${agentApiUrl.replace(/\/+$/, '')}` +
      `/videos/${encodeURIComponent(streamId)}/complete`;

    const body: Record<string, unknown> = {
      ...videoUploadApiResponse,
      filename,
    };

    if (
      formData &&
      Object.keys(formData).length > 0
    ) {
      body.custom_params = formData;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',

        // _app.tsx의 fetch wrapper 자동 재시도 방지
        'X-Skip-Auth-Retry': 'true',

        // 동일 영상에 대한 중복 완료 처리 방지
        'Idempotency-Key':
          `video-complete-${streamId}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let message =
        `Post-processing failed with status ` +
        `${response.status}`;

      try {
        const errorData = await response.json();

        if (errorData?.detail) {
          message =
            typeof errorData.detail === 'string'
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        // JSON 응답이 아니면 기본 메시지 유지
      }

      throw new Error(message);
    }
  })();

  uploadCompleteRequests.set(
    streamId,
    requestPromise,
  );

  try {
    await requestPromise;
  } finally {
    if (
      uploadCompleteRequests.get(streamId) ===
      requestPromise
    ) {
      uploadCompleteRequests.delete(streamId);
    }
  }
}
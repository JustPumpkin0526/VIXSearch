// SPDX-License-Identifier: MIT
export const createApiEndpoints = (vstApiUrl: string) => ({
  STREAMS: `${vstApiUrl}/v1/replay/streams`,
  DELETE_STORAGE_FILES: (sensorId: string, startTime: string, endTime: string) =>
    `${vstApiUrl}/v1/storage/file/${sensorId}?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`,
  REPLAY_PICTURE: (streamId: string, startTime: string) =>
    `${vstApiUrl}/v1/replay/stream/${streamId}/picture?startTime=${encodeURIComponent(startTime)}`,
  STORAGE_SIZE: `${vstApiUrl}/v1/storage/size?timelines=true`,
  UPLOAD_FILE: `${vstApiUrl}/v1/storage/file`,
} as const);


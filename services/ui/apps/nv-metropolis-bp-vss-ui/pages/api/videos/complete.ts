import { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureUploadedVideoGroupingSchema,
  getAccountIdFromVideosPayload,
  getVideosPool,
  verifyVideosJwt,
} from './_lib';

function pickStringValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();

      if (normalized) {
        return normalized;
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickNextShowFilename(
  providedFilename: string,
  existingShowFilenames: Array<string | null | undefined>,
): string {
  const escapedFilename = escapeRegExp(providedFilename);
  const pattern = new RegExp(`^${escapedFilename}(?:_(\\d+))?$`);
  const usedSuffixes = new Set<number>();

  for (const existing of existingShowFilenames) {
    if (!existing) {
      continue;
    }

    const match = pattern.exec(existing);

    if (!match) {
      continue;
    }

    const suffix = match[1]
      ? Number.parseInt(match[1], 10)
      : 0;

    if (Number.isInteger(suffix) && suffix >= 0) {
      usedSuffixes.add(suffix);
    }
  }

  let nextSuffix = 0;

  while (usedSuffixes.has(nextSuffix)) {
    nextSuffix += 1;
  }

  return nextSuffix === 0
    ? providedFilename
    : `${providedFilename}_${nextSuffix}`;
}

function toValidDate(value: unknown, fallback: Date): Date {
  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    return value;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return fallback;
}

function toTimestampText(
  value: unknown,
  fallback: Date,
): string {
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    return fallback.toISOString();
  }

  if (typeof value === 'string') {
    const normalized = value.trim();

    if (normalized) {
      return normalized;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return String(value);
  }

  return fallback.toISOString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const authHeader = String(
    req.headers.authorization || '',
  );

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing Authorization Bearer token',
    });
  }

  const token = authHeader
    .slice('Bearer '.length)
    .trim();

  const verification = verifyVideosJwt(token);

  if (!verification.valid) {
    return res.status(401).json({
      error: `Invalid token: ${verification.reason}`,
    });
  }

  const tokenAccountId =
    getAccountIdFromVideosPayload(
      verification.payload,
    );

  if (!tokenAccountId) {
    return res.status(401).json({
      error: 'Token missing account identifier claim',
    });
  }

  await ensureUploadedVideoGroupingSchema();

  const body = req.body || {};

  const videoId = pickStringValue(
    body.video_id,
    body.videoId,
    body.id,
  );

  const streamId = pickStringValue(
    body.stream_id,
    body.streamId,
  );

  const sensorId = pickStringValue(
    body.sensor_id,
    body.sensorId,
  );

  const filename = pickStringValue(
    body.filename,
    body.fileName,
    body.name,
  );

  const storageFilename = pickStringValue(
    body.storage_filename,
    body.storageFilename,
    body.storage_name,
  );

  const videoUrl = pickStringValue(
    body.video_url,
    body.videoUrl,
    body.url,
    body.filePath,
  );

  const filePath = pickStringValue(
    body.file_path,
    body.filePath,
    body.video_url,
    body.videoUrl,
  );

  const groupId = pickStringValue(
    body.group_id,
    body.groupId,
  );

  const bytes =
    body.bytes ??
    body.size ??
    null;

  let timestamp =
    body.timestamp ??
    body.created_at ??
    body.createdAt ??
    null;

  let uploadedAt =
    body.uploaded_at ??
    body.uploadedAt ??
    body.created_at ??
    body.createdAt ??
    null;

  if (!timestamp && uploadedAt) {
    timestamp = uploadedAt;
  }

  const normalizedVideoId =
    videoId?.trim() || '';

  const normalizedStreamId =
    streamId?.trim() || '';

  const normalizedSensorId =
    sensorId?.trim() || '';

  const normalizedVideoUrl =
    videoUrl?.trim() || '';

  const normalizedFilePath =
    filePath?.trim() || '';

  if (
    !normalizedVideoId ||
    !normalizedStreamId ||
    !normalizedSensorId ||
    !normalizedVideoUrl
  ) {
    return res.status(400).json({
      ok: false,
      error:
        'video_id, stream_id, sensor_id, and video_url are required',
      received: {
        video_id:
          normalizedVideoId || null,

        stream_id:
          normalizedStreamId || null,

        sensor_id:
          normalizedSensorId || null,

        video_url:
          normalizedVideoUrl || null,

        file_path:
          normalizedFilePath || null,
      },
    });
  }

  try {
    const client =
      await getVideosPool().connect();

    try {
      const insertUsername =
        tokenAccountId;

      const duplicateResult =
        await client.query(
          `
            SELECT
              video_id,
              stream_id,
              sensor_id
            FROM public.uploaded_videos
            WHERE video_url = $1
              AND username IS NOT DISTINCT FROM $2
            LIMIT 1
          `,
          [
            normalizedVideoUrl,
            insertUsername,
          ],
        );

      if ((duplicateResult.rowCount ?? 0) > 0) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason:
            'Duplicate video_url for user',
          existing: duplicateResult.rows[0],
        });
      }

      const providedFilename =
        filename?.trim() || '';

      const normalizedFilename:
        string | null =
        providedFilename || null;

      let showFilename:
        string | null =
        providedFilename || null;

      if (
        insertUsername &&
        providedFilename
      ) {
        const existingNamesResult =
          await client.query(
            `
              SELECT show_filename
              FROM public.uploaded_videos
              WHERE username = $1
                AND filename = $2
            `,
            [
              insertUsername,
              providedFilename,
            ],
          );

        const existingShowFilenames =
          existingNamesResult.rows.map(
            (row: {
              show_filename:
              string | null;
            }) => row.show_filename,
          );

        showFilename =
          pickNextShowFilename(
            providedFilename,
            existingShowFilenames,
          );
      }

      const uploadedAtDate =
        toValidDate(
          uploadedAt,
          new Date(),
        );

      const timestampText =
        toTimestampText(
          timestamp,
          uploadedAtDate,
        );

      const insertSql = `
        INSERT INTO public.uploaded_videos (video_id, stream_id, sensor_id, filename, show_filename, storage_filename, video_url, file_path, bytes, username, group_id, uploaded_at, "timestamp")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (video_id) DO NOTHING
        RETURNING video_id, stream_id, sensor_id, filename, video_url, file_path, username, uploaded_at`; 

      const params = [
        normalizedVideoId,
        normalizedStreamId,
        normalizedSensorId,
        normalizedFilename,
        showFilename,
        storageFilename,
        normalizedVideoUrl,
        normalizedFilePath || null,
        bytes,
        insertUsername,
        groupId,
        uploadedAtDate,
        timestampText,
      ];

      const insertResult =
        await client.query(
          insertSql,
          params,
        );

      if ((insertResult.rowCount ?? 0) === 0) {
        return res.status(200).json({
          ok: true,
          skipped: true,
          reason:
            'Duplicate video_id',
          identifiers: {
            video_id:
              normalizedVideoId,

            stream_id:
              normalizedStreamId,

            sensor_id:
              normalizedSensorId,
          },
        });
      }

      return res.status(200).json({
        ok: true,
        video: insertResult.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error(
      'Error inserting uploaded_videos record:',
      err,
    );

    const message =
      err instanceof Error
        ? err.message
        : String(err);

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
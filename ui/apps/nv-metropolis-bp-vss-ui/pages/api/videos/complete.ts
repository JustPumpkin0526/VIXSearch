import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';
import crypto from 'crypto';

const DATABASE_URL = String(process.env.UI_AUTH_DATABASE_URL || '').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
let pool: Pool | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error('UI_AUTH_DATABASE_URL is required to write uploaded_videos');
  }
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

function verifyJwt(token: string): { valid: boolean; payload?: any; reason?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'Malformed JWT' };
    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest();
    const expectedSigB64 = base64url(expectedSig);
    if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSigB64))) {
      return { valid: false, reason: 'Invalid signature' };
    }
    const payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return { valid: false, reason: 'Token expired' };
    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, reason: String(err?.message || err) };
  }
}

function pickStringValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const v = value.trim();
      if (v) return v;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function extractAccountIdFromJwtPayload(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  return pickStringValue(
    payload.sub,
    payload.user_id,
    payload.userId,
    payload.uid,
    payload.username,
    payload.preferred_username,
    payload.email
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickNextShowFilename(providedFilename: string, existingShowFilenames: Array<string | null | undefined>): string {
  const escapedFilename = escapeRegExp(providedFilename);
  const pattern = new RegExp(`^${escapedFilename}(?:_(\\d+))?$`);
  const usedSuffixes = new Set<number>();

  for (const existing of existingShowFilenames) {
    if (!existing) continue;
    const match = pattern.exec(existing);
    if (!match) continue;

    const suffix = match[1] ? Number.parseInt(match[1], 10) : 0;
    if (Number.isInteger(suffix) && suffix >= 0) {
      usedSuffixes.add(suffix);
    }
  }

  let nextSuffix = 0;
  while (usedSuffixes.has(nextSuffix)) {
    nextSuffix += 1;
  }

  return nextSuffix === 0 ? providedFilename : `${providedFilename}_${nextSuffix}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: require Bearer token
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyJwt(token);
  if (!verification.valid) {
    return res.status(401).json({ error: `Invalid token: ${verification.reason}` });
  }
  const tokenAccountId = extractAccountIdFromJwtPayload(verification.payload);
  if (!tokenAccountId) {
    return res.status(401).json({ error: 'Token missing account identifier claim' });
  }

  const body = req.body || {};
  // Accept both snake_case and camelCase from clients; prefer snake_case
  let video_id = body.video_id ?? body.videoId ?? null;
  let sensor_id = body.sensor_id ?? body.sensorId ?? null;
  let filename = body.filename ?? null;
  let storage_filename = body.storage_filename ?? null;
  let video_url = body.video_url ?? body.videoUrl ?? body.filePath ?? body.file_path ?? null;
  let bytes = body.bytes ?? null;
  let timestamp = body.timestamp ?? null;
  let uploaded_at = body.uploaded_at ?? body.uploadedAt ?? null;
  

  // If timestamp wasn't provided by the agent, fall back to uploaded_at (client-generated)
  if (!timestamp && uploaded_at) {
    timestamp = uploaded_at;
  }

  // Debug: log incoming payload and token subject for troubleshooting
  // received payload and token subject intentionally not logged in normal operation

  // Only persist records that have both a stable ID and URL.
  // This prevents duplicate/incomplete rows from secondary notifications.
  const normalizedVideoId = video_id ? String(video_id).trim() : '';
  const normalizedVideoUrl = video_url ? String(video_url).trim() : '';
  if (!normalizedVideoId || !normalizedVideoUrl) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'Ignored incomplete payload (video_id and video_url are both required)',
    });
  }

  try {
    const client = await getPool().connect();
    try {
      // Compute per-user display name (show_filename) to only append numeric
      // suffixes when the same account uploads identical original filenames.
      // Keep `filename` as the original filename at all times.
      const insertUsername = tokenAccountId;

      // App-level idempotency: skip if the same user already has the same video_url.
      const duplicateRes = await client.query(
        `SELECT 1 FROM uploaded_videos WHERE video_url = $1 AND username IS NOT DISTINCT FROM $2 LIMIT 1`,
        [normalizedVideoUrl, insertUsername]
      );
      if ((duplicateRes.rowCount ?? 0) > 0) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'Duplicate video_url for user' });
      }

      // Filename is already normalized by caller.
      const providedFilename = filename ? String(filename).trim() : '';

      let show_filename: string | null = providedFilename || null;
      let normalizedFilename: string | null = providedFilename || null;

      if (insertUsername && providedFilename) {
        const existingNamesRes = await client.query(
          `SELECT show_filename FROM uploaded_videos WHERE username = $1 AND filename = $2`,
          [insertUsername, providedFilename]
        );
        const existingShowFilenames = existingNamesRes.rows.map(
          (row: { show_filename: string | null }) => row.show_filename
        );
        show_filename = pickNextShowFilename(providedFilename, existingShowFilenames);
      }

      // Insert into the DB using the agreed columns (snake_case identifiers)
      const insertSql = `
        INSERT INTO uploaded_videos (
          video_id, filename, show_filename, storage_filename, video_url, username, uploaded_at, bytes, sensor_id, timestamp
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT DO NOTHING
      `;
      const params = [
        normalizedVideoId,
        normalizedFilename,
        show_filename,
        storage_filename,
        normalizedVideoUrl,
        insertUsername,
        uploaded_at = new Date(uploaded_at),
        bytes,
        sensor_id,
        timestamp,
      ];

      await client.query(insertSql, params);

    } finally {
      client.release();
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error inserting uploaded_videos record:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

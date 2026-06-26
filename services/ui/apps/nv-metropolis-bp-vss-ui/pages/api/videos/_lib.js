import crypto from 'crypto';

const { Pool } = require('pg');

const DATABASE_URL = String(process.env.UI_AUTH_DATABASE_URL || '').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

let pool = null;
let schemaInitPromise = null;

export function getVideosPool() {
  if (!DATABASE_URL) {
    throw new Error('UI_AUTH_DATABASE_URL is required for video metadata APIs');
  }

  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }

  return pool;
}

export function verifyVideosJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'Malformed JWT' };

    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSigB64 = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signingInput)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const actualSig = Buffer.from(sigB64, 'utf8');
    const expectedSig = Buffer.from(expectedSigB64, 'utf8');
    if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    const payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return { valid: false, reason: 'Token expired' };
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: String(err?.message || err) };
  }
}

function pickStringValue(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        return trimmedValue;
      }
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

export function getAccountIdFromVideosPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  return pickStringValue(
    payload.sub,
    payload.user_id,
    payload.userId,
    payload.uid,
    payload.username,
    payload.preferred_username,
    payload.email,
  );
}

export async function ensureUploadedVideoGroupingSchema() {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await getVideosPool().query(`
        CREATE TABLE IF NOT EXISTS uploaded_videos (
          video_id TEXT NOT NULL,
          filename TEXT,
          show_filename TEXT,
          storage_filename TEXT,
          video_url TEXT,
          username TEXT NOT NULL REFERENCES ui_auth_users(username) ON DELETE CASCADE,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          bytes BIGINT,
          sensor_id TEXT,
          timestamp TIMESTAMPTZ,
          group_id TEXT,
          PRIMARY KEY (username, video_id)
        );

        CREATE INDEX IF NOT EXISTS idx_uploaded_videos_username_uploaded_at
          ON uploaded_videos (username, uploaded_at DESC);

        CREATE INDEX IF NOT EXISTS idx_uploaded_videos_username_sensor_id
          ON uploaded_videos (username, sensor_id);

        CREATE INDEX IF NOT EXISTS idx_uploaded_videos_username_video_url
          ON uploaded_videos (username, video_url);

        CREATE TABLE IF NOT EXISTS uploaded_video_groups (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL REFERENCES ui_auth_users(username) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_uploaded_video_groups_username_created_at
          ON uploaded_video_groups (username, created_at DESC);

        ALTER TABLE uploaded_videos
          ADD COLUMN IF NOT EXISTS group_id TEXT;

        CREATE INDEX IF NOT EXISTS idx_uploaded_videos_username_group_id
          ON uploaded_videos (username, group_id);

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_name = 'uploaded_videos'
              AND constraint_name = 'uploaded_videos_group_id_fkey'
          ) THEN
            ALTER TABLE uploaded_videos
              ADD CONSTRAINT uploaded_videos_group_id_fkey
              FOREIGN KEY (group_id)
              REFERENCES uploaded_video_groups(id)
              ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    })().catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }

  await schemaInitPromise;
}

export async function cleanupEmptyUploadedVideoGroups(client, username) {
  await client.query(
    `DELETE FROM uploaded_video_groups g
     WHERE g.username = $1
       AND NOT EXISTS (
         SELECT 1
         FROM uploaded_videos v
         WHERE v.username = g.username
           AND v.group_id = g.id
       )`,
    [username]
  );
}
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

async function ensureTable(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploaded_videos (
        id SERIAL PRIMARY KEY,
        video_id TEXT,
        filename TEXT,
        video_url TEXT,
        username TEXT,
        uploaded_at TIMESTAMPTZ,
        bytes BIGINT,
        sensor_id TEXT,
        stream_id TEXT,
        file_path TEXT,
        timestamp TEXT
      );
    `);
  } finally {
    client.release();
  }
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

  const body = req.body || {};
  // Accept both snake_case and camelCase from clients; prefer snake_case
  let {
    video_id,
    sensor_id,
    filename,
    video_url,
    username: bodyUsername,
    bytes,
    timestamp,
    uploaded_at,
  } = body as any;

  // If crucial fields are missing, try to enrich them by querying the VST replay streams API.
  // Configure VST base URL via env `VST_REPLAY_URL` (defaults to local port used in dev).
  const VST_REPLAY_URL = process.env.VST_REPLAY_URL || 'http://172.16.7.64:30888';

  if ((video_id || filename)) {
    try {
      const resp = await fetch(`${VST_REPLAY_URL}/vst/api/v1/replay/streams`);
      if (resp.ok) {
        const data = await resp.json();
        let foundStreamId: string | null = null;
        let foundFilePath: string | null = null;
        let foundName: string | null = null;
        for (const entry of data) {
          for (const key of Object.keys(entry)) {
            const items = entry[key];
            if (!Array.isArray(items) || items.length === 0) continue;
            const meta = items[0] as any;
            // Match by stream id (key) or by name
            if (video_id && key === video_id) {
              foundStreamId = key;
              foundFilePath = meta.vodUrl ?? meta.url ?? null;
              foundName = meta.name ?? null;
              break;
            }
            if (filename && (meta.name === filename || meta.name === filename.replace(/\.[^.]+$/, ''))) {
              foundStreamId = key;
              foundFilePath = meta.vodUrl ?? meta.url ?? null;
              foundName = meta.name ?? null;
              break;
            }
          }
          if (foundStreamId) break;
        }
        if (foundStreamId) {
          filename = filename ?? foundName ?? filename;
          // enriched from VST: foundStreamId/foundFilePath/foundName (no debug log)
        } else {
          // no matching stream found in VST for provided identifiers
        }
      } else {
        console.warn('[api/videos/complete] failed to query VST replay streams:', resp.status, await resp.text());
      }
    } catch (e) {
      console.warn('[api/videos/complete] error querying VST replay streams:', String(e));
    }
  }

  // If timestamp wasn't provided by the agent, fall back to uploaded_at (client-generated)
  if (!timestamp && uploaded_at) {
    timestamp = uploaded_at;
  }

  // Debug: log incoming payload and token subject for troubleshooting
  // received payload and token subject intentionally not logged in normal operation

  // Accept any reasonable identifier or fallback (video_id, sensorId, streamId, filename, or video_url/filePath)
  // Accept any reasonable identifier or fallback (video_id, sensor_id/sensorId, streamId, filename, or video_url/file_path)
  if (!video_id && !filename && !video_url && !sensor_id) {
    return res.status(400).json({ error: 'Missing video identifier (video_id / sensor_id / filename / video_url)' });
  }

  try {
    await ensureTable();
    const client = await getPool().connect();
    try {
      // Insert into the DB using the agreed columns (snake_case identifiers)
      const insertSql = `
        INSERT INTO uploaded_videos (
          video_id, filename, video_url, username, uploaded_at, bytes, sensor_id, timestamp
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT DO NOTHING
      `;

      // Prefer username from verified token subject if present
      const tokenUsername = verification.payload?.sub ?? null;
      const params = [
        // Determine a stable video identifier: prefer explicit video_id, then streamId/effective_sensor_id, then file path or filename
        video_id ?? null,
        filename ?? null,
        video_url ?? null,
        bodyUsername ?? tokenUsername ?? null,
        uploaded_at ? new Date(uploaded_at) : null,
        typeof bytes === 'number' ? bytes : null,
        sensor_id ?? null,
        timestamp ?? null,
      ];
      // insert params prepared (not logged)

      await client.query(insertSql, params);

      // Also insert a lightweight per-user video record for filtering by owner
      try {
        const owner = bodyUsername ?? tokenUsername ?? null;
        if (owner) {
          const userVideoSql = `
            INSERT INTO user_videos (sensor_id, video_name, timestamp, file_path, current_user_id)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT DO NOTHING
          `;
          const userVideoParams = [
            sensor_id ?? null,
            filename ?? null,
            timestamp ? new Date(timestamp) : null,
            video_url ?? null,
            owner,
          ];
          // user_videos insert params prepared (not logged)
          await client.query(userVideoSql, userVideoParams);
        }
      } catch (e) {
        // Non-fatal: log and continue — uploaded_videos insert already performed
        console.error('[api/videos/complete] failed to insert user_videos record:', e);
      }
    } finally {
      client.release();
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error inserting uploaded_videos record:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

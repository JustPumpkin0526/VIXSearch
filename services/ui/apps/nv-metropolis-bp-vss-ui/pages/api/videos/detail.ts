import { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureUploadedVideoGroupingSchema,
  getAccountIdFromVideosPayload,
  getVideosPool,
  verifyVideosJwt,
} from './_lib';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyVideosJwt(token);
  if (!verification.valid) {
    return res.status(401).json({ error: `Invalid token: ${verification.reason}` });
  }

  const username = getAccountIdFromVideosPayload(verification.payload);
  if (!username) return res.status(400).json({ error: 'Token missing subject' });

  const videoId = typeof req.query.video_id === 'string' ? req.query.video_id.trim() : '';
  const streamId = typeof req.query.stream_id === 'string' ? req.query.stream_id.trim() : '';

  if (!videoId && !streamId) {
    return res.status(400).json({ error: 'video_id or stream_id query parameter is required' });
  }

  await ensureUploadedVideoGroupingSchema();

  try {
    const client = await getVideosPool().connect();
    try {
      console.info('[api/videos/detail] request params:', { videoId, streamId, username });
      let q: string;
      let params: any[];

      if (videoId) {
        q = `
          SELECT *
          FROM uploaded_videos
          WHERE video_id = $1
            AND username IS NOT DISTINCT FROM $2
          LIMIT 1
        `;
        params = [videoId, username];
      } else {
        q = `
          SELECT *
          FROM uploaded_videos
          WHERE stream_id = $1
            AND username IS NOT DISTINCT FROM $2
          ORDER BY uploaded_at DESC
          LIMIT 1
        `;
        params = [streamId, username];
      }

      let result = await client.query(q, params);

      if ((result.rowCount ?? 0) === 0) {
        // If not found for this user, attempt a global lookup as a fallback
        try {
          const fallbackQ = q.replace(/\n\s+AND username IS NOT DISTINCT FROM \$2\n/, '\n');
          const fallbackParams = params.slice(0, 1);
          const fallbackResult = await client.query(fallbackQ, fallbackParams);

            console.info('[api/videos/detail] fallback (global) query returned rows:', fallbackResult.rowCount ?? 0);

          if ((fallbackResult.rowCount ?? 0) === 0) {
            // continue to additional fallbacks (e.g., treating provided videoId as streamId)
            result = fallbackResult;
          } else {
            result = fallbackResult;
          }
        } catch (fallbackErr) {
          console.warn('[api/videos/detail] fallback query failed:', fallbackErr);
          return res.status(404).json({ error: 'Not found' });
        }
      }

      // Additional fallback: if client provided video_id but it's actually a streamId,
      // try querying by stream_id using the provided videoId value.
      if ((result.rowCount ?? 0) === 0 && videoId) {
        try {
          const q2 = `
            SELECT *
            FROM uploaded_videos
            WHERE stream_id = $1
            ORDER BY uploaded_at DESC
            LIMIT 1
          `;
          const r2 = await client.query(q2, [videoId]);

            console.info('[api/videos/detail] streamId-as-videoId fallback returned rows:', r2.rowCount ?? 0);

          if ((r2.rowCount ?? 0) > 0) {
            return res.status(200).json({ video: r2.rows[0] });
          }
        } catch (e) {
          console.warn('[api/videos/detail] streamId fallback failed:', e);
        }
      }

      const row = result.rows[0] ?? null;

      if (!row) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (row) {
        // If DB returns timestamptz/timestamp columns, format them for API consumers
        try {
          if (row.uploaded_at) {
            // keep server-side timezone handling; format as requested
            const fmt = await client.query(`SELECT to_char($1::timestamptz, 'YYYY/MM/DD - HH24:MI:SS') AS v`, [row.uploaded_at]);
            row.uploaded_at = fmt.rows[0]?.v ?? row.uploaded_at;
          }

          if (row.created_at) {
            const fmt2 = await client.query(`SELECT to_char($1::timestamptz, 'YYYY/MM/DD - HH24:MI:SS') AS v`, [row.created_at]);
            row.created_at = fmt2.rows[0]?.v ?? row.created_at;
          }
        } catch (fmtErr) {
          // ignore formatting errors and return raw values
          console.warn('[api/videos/detail] failed to format timestamps:', fmtErr);
        }
      }

      // Hide raw timestamp field from API consumers
      if (row && 'timestamp' in row) {
        delete row.timestamp;
      }

      return res.status(200).json({ video: row });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[api/videos/detail] failed:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

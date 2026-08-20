import { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureUploadedVideoGroupingSchema,
  getAccountIdFromVideosPayload,
  getVideosPool,
  verifyVideosJwt,
} from './_lib';
import { checkAndIncrConnection } from '../_connectionLimit';

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

  // Enforce per-tab connection limit when client provides `X-Client-Id` header.
  try {
    const conn = await checkAndIncrConnection(req, res);
    if (!conn.allowed) {
      res.setHeader('Retry-After', '30');
      return res.status(503).json({ error: 'Too many active clients, try again later.' });
    }
  } catch (err) {
    console.warn('[api/videos/list] connection check failed, continuing:', err);
  }

  const rawGroupId =
    Array.isArray(req.query.group_id)
      ? req.query.group_id[0]
      : req.query.group_id;

  const groupId =
    typeof rawGroupId === 'string'
      ? rawGroupId.trim()
      : '';

  await ensureUploadedVideoGroupingSchema();

  try {
    const client = await getVideosPool().connect();
    try {
      const queryParams: string[] = [
        username,
      ];

      const conditions: string[] = [
        'username = $1',
      ];
      
      if (groupId) {
        queryParams.push(groupId);
      
        conditions.push(
          `group_id = $${queryParams.length}`,
        );
      }

      const q = `
        SELECT
          video_id,
          stream_id,
          sensor_id,
          filename,
          show_filename,
          storage_filename,
          timestamp,
          video_url,
          username,
          to_char(uploaded_at::timestamptz, 'YYYY/MM/DD - HH24:MI:SS') AS uploaded_at,
          group_id
        FROM uploaded_videos
        WHERE ${conditions.join('\n    AND ')}
        ORDER BY uploaded_at DESC
      `;

      const result =
        await client.query(
          q,
          queryParams,
        );
      return res.status(200).json({ videos: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[api/videos/list] failed:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
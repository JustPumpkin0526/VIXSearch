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

  await ensureUploadedVideoGroupingSchema();

  try {
    const client = await getVideosPool().connect();
    try {
      const q = `
        SELECT
          video_id,
          sensor_id,
          filename,
          show_filename,
          storage_filename,
          timestamp,
          video_url,
          username,
          uploaded_at,
          group_id
        FROM uploaded_videos
        WHERE username = $1
        ORDER BY uploaded_at DESC
      `;
      const result = await client.query(q, [username]);
      return res.status(200).json({ videos: result.rows });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[api/videos/list] failed:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

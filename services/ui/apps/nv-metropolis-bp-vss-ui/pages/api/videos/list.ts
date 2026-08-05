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

      console.log(
        '[api/videos/list] request',
        {
          method: req.method,
          url: req.url,
          query: req.query,
          rawGroupId,
          groupId,
          referer: req.headers.referer,
          username,
        },
      );
      
      if (groupId) {
        queryParams.push(groupId);
      
        conditions.push(
          `group_id = $${queryParams.length}`,
        );
      }

      console.log('conditions: ',conditions)

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
        WHERE ${conditions.join('\n    AND ')}
        ORDER BY uploaded_at DESC
      `;

      console.log("query: ", q) 

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

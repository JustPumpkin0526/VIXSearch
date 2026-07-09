import { NextApiRequest, NextApiResponse } from 'next';
import {
  cleanupEmptyUploadedVideoGroups,
  ensureUploadedVideoGroupingSchema,
  getAccountIdFromVideosPayload,
  getVideosPool,
  verifyVideosJwt,
} from './_lib';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const body = req.body || {};
  // Accept both snake_case and camelCase keys from callers
  const video_id = (body.video_id || body.videoId || null) as string | null;
  const sensorId = (body.sensorId || body.sensor_id || body.sensor || null) as string | null;
  const filePath = (body.filePath || body.file_path || body.video_url || body.videoUrl || null) as string | null;
  const filename = (body.filename || body.file_name || body.name || null) as string | null;

  if (!video_id && !sensorId && !filePath && !filename) {
    return res.status(400).json({ error: 'Missing identifier to delete (video_id / sensorId / filePath / filename)' });
  }

  try {
    const client = await getVideosPool().connect();
    try {
      // Check whether 'file_path' column exists in uploaded_videos
      const uploadedHasFilePathRes = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'uploaded_videos' AND column_name = 'file_path' LIMIT 1`
      );
      const uploadedHasFilePath = uploadedHasFilePathRes.rowCount > 0;

      // Build DELETE query for uploaded_videos dynamically to avoid referencing missing columns
      // $1 is reserved for username, so conditions start at $2
      const uploadedConditions: string[] = [];
      const uploadedParams: any[] = [username];
      let idx = 2;
          
      if (video_id) {
        uploadedConditions.push(`video_id = $${idx}`);
        uploadedParams.push(video_id);
        idx++;
      }
      
      if (sensorId) {
        uploadedConditions.push(`sensor_id = $${idx}`);
        uploadedParams.push(sensorId);
        idx++;
      }
      
      if (filePath) {
        if (uploadedHasFilePath) {
          uploadedConditions.push(`file_path = $${idx}`);
          uploadedParams.push(filePath);
          idx++;
        }
      
        uploadedConditions.push(`video_url = $${idx}`);
        uploadedParams.push(filePath);
        idx++;
      }
      
      // filename은 video_id/sensor_id/filePath가 아무것도 없을 때만 fallback으로 사용
      if (uploadedConditions.length === 0 && filename) {
        uploadedConditions.push(`filename = $${idx}`);
        uploadedParams.push(filename);
        idx++;
      }

      if (filename) {
        uploadedConditions.push(`filename = $${idx}`);
        uploadedParams.push(filename);
        idx++;
      }

      let uploadedRes = { rowCount: 0 } as any;
      if (uploadedConditions.length > 0) {
        const deleteUploadedSql = `DELETE FROM uploaded_videos WHERE username = $1 AND (${uploadedConditions.join(' OR ')})`;
        uploadedRes = await client.query(deleteUploadedSql, uploadedParams);
      }

      await cleanupEmptyUploadedVideoGroups(client, username);

      return res.status(200).json({ ok: true, deleted: { uploaded: uploadedRes.rowCount } });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error deleting video records:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}


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

      const uploadedConditions: string[] = [];
      const uploadedParams: unknown[] = [username];

      if (video_id) {
        uploadedConditions.push('video_id = $2');
        uploadedParams.push(video_id);
      } else if (sensorId) {
        uploadedConditions.push('sensor_id = $2');
        uploadedParams.push(sensorId);
      } else if (filePath) {
        uploadedConditions.push(
          uploadedHasFilePath ? 'file_path = $2' : 'video_url = $2',
        );
        uploadedParams.push(filePath);
      } else if (filename) {
        uploadedConditions.push('filename = $2');
        uploadedParams.push(filename);
      }

      let uploadedRes: { rowCount: number | null } = { rowCount: 0 };
      if (uploadedConditions.length > 0) {
        const deleteUploadedSql = `
          DELETE FROM uploaded_videos
          WHERE username = $1
            AND ${uploadedConditions[0]}
        `;
        uploadedRes = await client.query(deleteUploadedSql, uploadedParams);
      }

      if ((uploadedRes.rowCount ?? 0) === 0) {
        return res.status(404).json({
          ok: false,
          error: 'Uploaded video ownership record was not found',
        });
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
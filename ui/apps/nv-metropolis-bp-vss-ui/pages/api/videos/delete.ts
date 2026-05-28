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
    throw new Error('UI_AUTH_DATABASE_URL is required to delete uploaded_videos');
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
  const verification = verifyJwt(token);
  if (!verification.valid) {
    return res.status(401).json({ error: `Invalid token: ${verification.reason}` });
  }

  const body = req.body || {};
  const { video_id, sensorId, filePath, filename } = body;

  if (!video_id && !sensorId && !filePath && !filename) {
    return res.status(400).json({ error: 'Missing identifier to delete (video_id / sensorId / filePath / filename)' });
  }

  try {
    const client = await getPool().connect();
    try {
      // Check whether 'file_path' column exists in uploaded_videos and user_videos
      const uploadedHasFilePathRes = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'uploaded_videos' AND column_name = 'file_path' LIMIT 1`
      );
      const uploadedHasFilePath = uploadedHasFilePathRes.rowCount > 0;

      const userHasFilePathRes = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'user_videos' AND column_name = 'file_path' LIMIT 1`
      );
      const userHasFilePath = userHasFilePathRes.rowCount > 0;

      // Build DELETE query for uploaded_videos dynamically to avoid referencing missing columns
      const uploadedConditions: string[] = [];
      const uploadedParams: any[] = [];
      let idx = 1;

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
        // always also check video_url as a fallback
        uploadedConditions.push(`video_url = $${idx}`);
        uploadedParams.push(filePath);
        idx++;
      }

      if (filename) {
        uploadedConditions.push(`filename = $${idx}`);
        uploadedParams.push(filename);
        idx++;
      }

      let uploadedRes = { rowCount: 0 } as any;
      if (uploadedConditions.length > 0) {
        const deleteUploadedSql = `DELETE FROM uploaded_videos WHERE ${uploadedConditions.join(' OR ')}`;
        uploadedRes = await client.query(deleteUploadedSql, uploadedParams);
      }

      // Build DELETE for user_videos
      const userConditions: string[] = [];
      const userParams: any[] = [];
      idx = 1;

      if (sensorId) {
        userConditions.push(`sensor_id = $${idx}`);
        userParams.push(sensorId);
        idx++;
      }

      if (filePath) {
        if (userHasFilePath) {
          userConditions.push(`file_path = $${idx}`);
          userParams.push(filePath);
          idx++;
        }
        // also check by file_path fallback to video URL field in user_videos insert logic
        userConditions.push(`file_path = $${idx}`);
        userParams.push(filePath);
        idx++;
      }

      if (filename) {
        userConditions.push(`video_name = $${idx}`);
        userParams.push(filename);
        idx++;
      }

      let userRes = { rowCount: 0 } as any;
      if (userConditions.length > 0) {
        const deleteUserSql = `DELETE FROM user_videos WHERE ${userConditions.join(' OR ')}`;
        userRes = await client.query(deleteUserSql, userParams);
      }

      return res.status(200).json({ ok: true, deleted: { uploaded: uploadedRes.rowCount, user: userRes.rowCount } });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error deleting video records:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}


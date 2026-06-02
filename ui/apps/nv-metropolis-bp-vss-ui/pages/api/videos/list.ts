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
    throw new Error('UI_AUTH_DATABASE_URL is required to read uploaded_videos');
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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const username = verification.payload?.sub ?? null;
  if (!username) return res.status(400).json({ error: 'Token missing subject' });

  try {
    const client = await getPool().connect();
    try {
      const q = `SELECT sensor_id, filename, show_filename, timestamp, video_url, username, uploaded_at FROM uploaded_videos WHERE username = $1 ORDER BY uploaded_at DESC`;
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

import type { NextApiRequest, NextApiResponse } from 'next';
const REDIS_URL = process.env.REDIS_URL || '';
let redis: any = null;

// Attempt to load ioredis at runtime. If not installed, fall back to null (no limit enforcement).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const IORedis = require('ioredis');
  if (REDIS_URL) {
    redis = new IORedis(REDIS_URL);
  }
} catch (err) {
  // ioredis not available — continue without Redis-based enforcement
  redis = null;
}

const DEFAULT_LIMIT = Number(process.env.UI_GLOBAL_CONNECTION_LIMIT || '200');
const KEY_PREFIX = 'vss:connections:';
const TTL_SEC = 60 * 5; // keep presence for 5 minutes

export async function checkAndIncrConnection(req: NextApiRequest, res: NextApiResponse, limit = DEFAULT_LIMIT) {
  const clientId = String(req.headers['x-client-id'] || req.headers['x-clientid'] || '').trim();
  if (!clientId) return { allowed: true, reason: 'no_client_id' };

  const key = `${KEY_PREFIX}client:${clientId}`;

  try {
    if (redis) {
      // Set a presence key with TTL; count unique keys to get current connections.
      await redis.set(key, '1', 'EX', TTL_SEC);
      const count = await redis.keys(`${KEY_PREFIX}client:*`).then((k) => k.length);
      if (count > limit) {
        return { allowed: false, reason: 'limit_exceeded', count };
      }
      return { allowed: true, count };
    }

    // Fallback: no redis — allow and don't enforce limit.
    return { allowed: true, reason: 'no_redis' };
  } catch (err) {
    console.error('[connectionLimit] error:', err);
    return { allowed: true, reason: 'error' };
  }
}

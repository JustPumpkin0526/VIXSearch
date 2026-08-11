import type { NextApiRequest, NextApiResponse } from 'next';

type RateEntry = {
  timestamps: number[];
};

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 5; // per IP per window

// Simple in-memory store persisted on the Node.js process.
// Not suitable for multi-instance production but it's a low-effort mitigation.
const store: Map<string, RateEntry> = new Map();

export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    const now = Date.now();

    const entry = store.get(ip) || { timestamps: [] };

    // drop timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > now - WINDOW_MS);

    if (entry.timestamps.length >= MAX_REQUESTS) {
      res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
      res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', error: '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해 주세요.' });
      return Promise.reject(new Error('rate_limited'));
    }

    entry.timestamps.push(now);
    store.set(ip, entry);

    return Promise.resolve();
  } catch (err) {
    // On unexpected failures, allow the request so we don't block legit users.
    console.error('[rateLimit] error:', err);
    return Promise.resolve();
  }
}

export function _resetRateLimitForTest(ip: string) {
  store.delete(ip);
}

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildClearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  revokeRefreshToken,
} from './_lib';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const refreshToken = getRefreshTokenFromCookie(req.headers.cookie);

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    res.setHeader('Set-Cookie', buildClearRefreshTokenCookie());

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[auth/logout] failed:', error);
    res.setHeader('Set-Cookie', buildClearRefreshTokenCookie());
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
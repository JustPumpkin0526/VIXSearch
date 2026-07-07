import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildClearRefreshTokenCookie,
  buildRefreshTokenCookie,
  getRefreshTokenFromCookie,
  rotateRefreshToken,
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

    if (!refreshToken) {
      res.setHeader('Set-Cookie', buildClearRefreshTokenCookie());
      return res.status(401).json({ error: 'refresh token required' });
    }

    const rotated = await rotateRefreshToken(refreshToken);

    if (!rotated) {
      res.setHeader('Set-Cookie', buildClearRefreshTokenCookie());
      return res.status(401).json({
        error: 'refresh token expired or invalid',
      });
    }

    res.setHeader(
      'Set-Cookie',
      buildRefreshTokenCookie(rotated.refreshToken),
    );

    return res.status(200).json({
      user: rotated.user,
      token: rotated.token,
      expiresAt: rotated.expiresAt,
    });
  } catch (error) {
    console.error('[auth/refresh] failed:', error);
    res.setHeader('Set-Cookie', buildClearRefreshTokenCookie());
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
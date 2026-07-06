import type { NextApiRequest, NextApiResponse } from 'next';
import {
  findUserByRefreshToken,
  getRefreshTokenFromCookie,
  issueJwt,
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
      return res.status(401).json({ error: 'refresh token required' });
    }

    const user = await findUserByRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({
        error: 'refresh token expired or invalid',
      });
    }

    const { token, exp } = issueJwt(user.username, user.role);

    return res.status(200).json({
      user,
      token,
      expiresAt: exp,
    });
  } catch (error) {
    console.error('[auth/refresh] failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
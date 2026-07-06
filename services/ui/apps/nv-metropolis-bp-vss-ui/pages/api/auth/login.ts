import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildSetRefreshTokenCookie,
  findUserByUsername,
  issueJwt,
  issueRefreshToken,
  sanitizeUsername,
  verifyPassword,
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

    const username = sanitizeUsername(String(req.body?.username || ''));
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: 'username and password are required',
      });
    }

    const user = await findUserByUsername(username);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = verifyPassword(password, user.salt, user.passwordHash);

    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const { token, exp } = issueJwt(user.username, user.role);
    const refresh = await issueRefreshToken(user.username);
      
    res.setHeader(
      'Set-Cookie',
      buildSetRefreshTokenCookie(refresh.token, refresh.expiresAt),
    );
    
    return res.status(200).json({
      user: {
        username: user.username,
        role: user.role,
      },
      token,
      expiresAt: exp,
    });
  } catch (error) {
    console.error('[auth/login] failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
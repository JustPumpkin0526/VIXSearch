import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildRefreshTokenCookie,
  createRefreshToken,
  findUserByUsername,
  issueJwt,
  sanitizeUsername,
  storeRefreshToken,
  verifyPasswordAsync,
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

    const startedAt = Date.now();
    const mark = (name: string) => {
      console.info(`[auth/login] ${name}: ${Date.now() - startedAt}ms`);
    };

    const username = sanitizeUsername(String(req.body?.username || ''));
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: 'username and password are required',
      });
    }

    const user = await findUserByUsername(username);
    mark('findUserByUsername');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await verifyPasswordAsync(password, user.salt, user.passwordHash);
    mark('verifyPasswordAsync');


    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const { token, exp } = issueJwt(user.username, user.role);
    mark('issueJwt');

    const refreshToken = createRefreshToken();
    await storeRefreshToken(user.username, refreshToken);
    mark('storeRefreshToken');
      
    res.setHeader(
      'Set-Cookie',
      buildRefreshTokenCookie(refreshToken),
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
import type { NextApiRequest, NextApiResponse } from 'next';

import { hashPassword, insertUser, issueJwt, sanitizeUsername, validateCredentials } from './_lib';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const username = sanitizeUsername(String(req.body?.username || ''));
    const password = String(req.body?.password || '');
    const validationError = validateCredentials(username, password);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { hash, salt } = hashPassword(password);
    const inserted = await insertUser({
      username,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    });

    if (!inserted) {
      return res.status(409).json({ error: 'username already exists' });
    }

    const { token, exp } = issueJwt(username);
    return res.status(201).json({
      user: { username },
      token,
      expiresAt: exp,
    });
  } catch (error) {
    console.error('[auth/register] failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

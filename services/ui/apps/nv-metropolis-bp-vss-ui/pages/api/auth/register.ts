import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Allow', '');

  return res.status(403).json({
    error: 'Public registration is disabled. Please contact an administrator.',
  });
}
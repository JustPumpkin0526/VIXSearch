import type { NextApiRequest, NextApiResponse } from 'next';

type StoreValue = { code: string; expiresAt: number };

const verificationStore: Map<string, StoreValue> = globalThis.__emailVerificationStore ||= new Map();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, code } = req.body || {};
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string')
    return res.status(400).json({ ok: false, message: 'Invalid payload' });

  const entry = verificationStore.get(email);
  if (!entry) return res.status(400).json({ ok: false, message: 'No code sent' });
  if (Date.now() > entry.expiresAt) {
    verificationStore.delete(email);
    return res.status(400).json({ ok: false, message: 'Code expired' });
  }
  if (entry.code !== code) return res.status(400).json({ ok: false, message: 'Incorrect code' });

  // success
  verificationStore.delete(email);
  return res.status(200).json({ ok: true });
}

import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

type StoreValue = { code: string; expiresAt: number };

// Simple in-memory store for dev only. Not persistent across server instances.
const verificationStore: Map<string, StoreValue> = (globalThis as any).__emailVerificationStore ||= new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ ok: false, message: 'Invalid email' });

  // create 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  verificationStore.set(email, { code, expiresAt });

  // Build email content
  const subject = 'VIXSearch 이메일 인증번호';
  const text = `인증번호: ${code}\n유효시간: 10분`;
  const html = `<p>인증번호: <strong>${code}</strong></p><p>유효시간: 10분</p>`;

  // SMTP configuration from env
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user || `no-reply@${host || 'localhost'}`;

  if (host && port && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: !!secure,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: email,
        subject,
        text,
        html,
      });

      return res.status(200).json({ ok: true });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('SMTP send error', err);
      return res.status(500).json({ ok: false, message: '메일 전송 실패' });
    }
  }

  // Fallback for dev: log the code
  // eslint-disable-next-line no-console
  console.log(`[email-verification] (no SMTP configured) code for ${email}: ${code}`);
  return res.status(200).json({ ok: true, warning: 'SMTP not configured; code logged on server' });
}

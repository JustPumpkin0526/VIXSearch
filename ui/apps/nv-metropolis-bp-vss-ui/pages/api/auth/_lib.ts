import crypto from 'crypto';
import { Pool } from 'pg';

type StoredUser = {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

const DATABASE_URL = String(process.env.UI_AUTH_DATABASE_URL || '').trim();
let pool: Pool | null = null;
let dbInitPromise: Promise<void> | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseDurationSeconds(raw: string | undefined, fallbackSec: number): number {
  if (!raw) return fallbackSec;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallbackSec;
  return Math.floor(n);
}

function getPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error('UI_AUTH_DATABASE_URL is required in DB-only auth mode');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
    });
  }
  return pool;
}

async function initPostgresStore(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ui_auth_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      } finally {
        client.release();
      }
    })();
  }
  await dbInitPromise;
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  await initPostgresStore();
  const result = await getPool().query(
    `SELECT username, password_hash, salt, created_at
     FROM ui_auth_users
     WHERE username = $1`,
    [username]
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0] as {
    username: string;
    password_hash: string;
    salt: string;
    created_at: string;
  };
  return {
    username: row.username,
    passwordHash: row.password_hash,
    salt: row.salt,
    createdAt: row.created_at,
  };
}

export async function insertUser(user: StoredUser): Promise<boolean> {
  await initPostgresStore();
  const insertSql = `INSERT INTO ui_auth_users (username, password_hash, salt, created_at)\n     VALUES ($1, $2, $3, $4)\n     ON CONFLICT (username) DO NOTHING`;
  console.log('[insertUser] SQL:', insertSql, 'params:', [user.username, user.passwordHash, user.salt, user.createdAt]);
  const result = await getPool().query(
    insertSql,
    [user.username, user.passwordHash, user.salt, user.createdAt]
  );
  return result.rowCount > 0;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, salt: string, passwordHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(passwordHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateCredentials(username: string, password: string): string | null {
  if (!username || username.length < 3 || username.length > 64) {
    return 'username must be between 3 and 64 characters';
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) {
    return 'username must use lowercase letters, numbers, dot, underscore, or hyphen';
  }
  if (!password || password.length < 8 || password.length > 128) {
    return 'password must be between 8 and 128 characters';
  }
  return null;
}

export function issueJwt(username: string): { token: string; exp: number } {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  const algorithm = (process.env.JWT_ALGORITHM || 'HS256').toUpperCase();
  if (algorithm !== 'HS256') {
    throw new Error('Only HS256 is supported by this UI auth endpoint');
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = parseDurationSeconds(process.env.UI_AUTH_TOKEN_TTL_SEC, 12 * 60 * 60);
  const exp = now + ttl;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: username,
    iat: now,
    exp,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const encodedSig = base64url(sig);

  return { token: `${signingInput}.${encodedSig}`, exp };
}

export type { StoredUser };

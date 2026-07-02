import crypto from 'crypto';
import { Pool } from 'pg';

export type UserRole = 'admin' | 'user';

type StoredUser = {
  username: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  createdBy?: string | null;
};

export type AuthUser = {
  username: string;
  role: UserRole;
};

type JwtVerification = {
  valid: boolean;
  payload?: Record<string, unknown>;
  reason?: string;
};

const DATABASE_URL = String(process.env.UI_AUTH_DATABASE_URL || '').trim();
let pool: Pool | null = null;
let dbInitPromise: Promise<void> | null = null;

export async function getAuthenticatedUserFromAuthHeader(
  rawHeader: string | string[] | undefined,
): Promise<AuthUser | null> {
  const username = getUsernameFromAuthHeader(rawHeader);

  if (!username) {
    return null;
  }

  const user = await findUserByUsername(username);

  if (!user || !user.isActive) {
    return null;
  }

  return {
    username: user.username,
    role: user.role,
  };
}

export async function requireAdminFromAuthHeader(
  rawHeader: string | string[] | undefined,
): Promise<AuthUser | null> {
  const user = await getAuthenticatedUserFromAuthHeader(rawHeader);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return user;
}

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
  if (!pool) {
    if (DATABASE_URL) {
      pool = new Pool({ connectionString: DATABASE_URL });
    } else {
      // Fallback: build connection string from common env vars when UI_AUTH_DATABASE_URL is not provided
      const host = String(process.env.UI_AUTH_DB_HOST || process.env.POSTGRES_HOST || 'localhost');
      const port = String(process.env.UI_AUTH_DB_PORT || process.env.AUTH_DB_PORT || process.env.POSTGRES_PORT || '5432');
      const user = String(process.env.UI_AUTH_DB_USER || process.env.POSTGRES_USER || 'vss');
      const password = String(process.env.UI_AUTH_DB_PASSWORD || process.env.POSTGRES_PASSWORD || '');
      const database = String(process.env.UI_AUTH_DB_NAME || process.env.POSTGRES_DB || 'vss_ui_auth');
      const conn = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
      pool = new Pool({ connectionString: conn });
    }
  }
  return pool;
}

async function ensureBootstrapAdminUser(): Promise<void> {
  const username = sanitizeUsername(
    String(process.env.UI_AUTH_BOOTSTRAP_ADMIN_USERNAME || 'admin'),
  );
  const password = String(process.env.UI_AUTH_BOOTSTRAP_ADMIN_PASSWORD || '');

  if (!password) {
    return;
  }

  const existingAdmin = await getPool().query(
    `SELECT username FROM ui_auth_users WHERE role = 'admin' LIMIT 1`,
  );

  if ((existingAdmin.rowCount ?? 0) > 0) {
    return;
  }

  const validationError = validateCredentials(username, password);
  if (validationError) {
    console.warn(`[auth/bootstrap] invalid bootstrap admin: ${validationError}`);
    return;
  }

  const { hash, salt } = hashPassword(password);

  await getPool().query(
    `
      INSERT INTO ui_auth_users (
        username,
        password_hash,
        salt,
        role,
        is_active,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'admin', TRUE, 'bootstrap', NOW(), NOW())
      ON CONFLICT (username) DO UPDATE
      SET role = 'admin',
          is_active = TRUE,
          updated_at = NOW()
    `,
    [username, hash, salt],
  );

  console.info(`[auth/bootstrap] admin user is ready: ${username}`);
}

export async function ensureUiAuthSchema(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS ui_auth_users (
          username TEXT PRIMARY KEY,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user'
            CHECK (role IN ('admin', 'user')),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_by TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE ui_auth_users
          ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

        ALTER TABLE ui_auth_users
          ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

        ALTER TABLE ui_auth_users
          ADD COLUMN IF NOT EXISTS created_by TEXT NULL;

        ALTER TABLE ui_auth_users
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ui_auth_users_role_check'
          ) THEN
            ALTER TABLE ui_auth_users
              ADD CONSTRAINT ui_auth_users_role_check
              CHECK (role IN ('admin', 'user'));
          END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS ui_user_chat_state (
          username TEXT NOT NULL REFERENCES ui_auth_users(username) ON DELETE CASCADE,
          storage_key_prefix TEXT NOT NULL,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (username, storage_key_prefix)
        );

        CREATE TABLE IF NOT EXISTS ui_user_reports (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL REFERENCES ui_auth_users(username) ON DELETE CASCADE,
          title TEXT NOT NULL,
          report_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_ui_user_reports_username_created_at
          ON ui_user_reports (username, created_at DESC);
      `);

      await ensureBootstrapAdminUser();
    })().catch((error) => {
      dbInitPromise = null;
      throw error;
    });
  }

  await dbInitPromise;
}

export function verifyJwt(token: string): JwtVerification {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Malformed JWT' };
    }

    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
    const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest();
    const expectedSigB64 = base64url(expectedSig);

    if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSigB64))) {
      return { valid: false, reason: 'Invalid signature' };
    }

    const payloadJson = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    if (exp && exp < now) {
      return { valid: false, reason: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error: any) {
    return { valid: false, reason: String(error?.message || error) };
  }
}

export function getUsernameFromAuthHeader(rawHeader: string | string[] | undefined): string | null {
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : String(rawHeader || '');
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyJwt(token);
  if (!verification.valid) {
    return null;
  }

  const subject = verification.payload?.sub;
  return typeof subject === 'string' && subject.trim() ? subject.trim().toLowerCase() : null;
}

export async function getUiAuthPool(): Promise<Pool> {
  await ensureUiAuthSchema();
  return getPool();
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  await ensureUiAuthSchema();

  const result = await getPool().query(
    `
      SELECT
        username,
        password_hash,
        salt,
        role,
        is_active,
        created_by,
        created_at
      FROM ui_auth_users
      WHERE username = $1
    `,
    [username],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0] as {
    username: string;
    password_hash: string;
    salt: string;
    role: UserRole;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
  };

  return {
    username: row.username,
    passwordHash: row.password_hash,
    salt: row.salt,
    role: row.role,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function insertUser(user: StoredUser): Promise<boolean> {
  await ensureUiAuthSchema();
  const insertSql = `INSERT INTO ui_auth_users (username, password_hash, salt, created_at)\n     VALUES ($1, $2, $3, $4)\n     ON CONFLICT (username) DO NOTHING`;
  // Avoid logging password hash/salt to reduce risk of leakage in logs
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

export function issueJwt(
    username: string,
    role: UserRole = 'user',
  ): { token: string; exp: number } {
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
    role,
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

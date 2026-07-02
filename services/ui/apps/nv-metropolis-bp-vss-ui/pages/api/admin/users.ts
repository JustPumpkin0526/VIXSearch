import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getUiAuthPool,
  hashPassword,
  requireAdminFromAuthHeader,
  sanitizeUsername,
  validateCredentials,
  type UserRole,
} from '../auth/_lib';

type CreateUserBody = {
  username?: string;
  password?: string;
  role?: UserRole;
};

function normalizeRole(raw: unknown): UserRole {
  return raw === 'admin' ? 'admin' : 'user';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const admin = await requireAdminFromAuthHeader(req.headers.authorization);

    if (!admin) {
      return res.status(403).json({ error: 'admin permission required' });
    }

    const pool = await getUiAuthPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        `
          SELECT
            username,
            role,
            is_active,
            created_by,
            created_at,
            updated_at
          FROM ui_auth_users
          ORDER BY created_at DESC, username ASC
        `,
      );

      return res.status(200).json({
        users: result.rows.map((row) => ({
          username: row.username,
          role: row.role,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = req.body as CreateUserBody;

      const username = sanitizeUsername(String(body?.username || ''));
      const password = String(body?.password || '');
      const role = normalizeRole(body?.role);

      const validationError = validateCredentials(username, password);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const { hash, salt } = hashPassword(password);

      const result = await pool.query(
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
          VALUES ($1, $2, $3, $4, TRUE, $5, NOW(), NOW())
          ON CONFLICT (username) DO NOTHING
          RETURNING username, role, is_active, created_by, created_at, updated_at
        `,
        [username, hash, salt, role, admin.username],
      );

      if (result.rowCount === 0) {
        return res.status(409).json({ error: 'username already exists' });
      }

      const row = result.rows[0];

      return res.status(201).json({
        user: {
          username: row.username,
          role: row.role,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[admin/users] failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
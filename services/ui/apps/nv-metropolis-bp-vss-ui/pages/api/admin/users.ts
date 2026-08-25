import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getAuthenticatedUserFromAuthHeader,
  getUiAuthPool,
  hashPassword,
  requireAdminFromAuthHeader,
  sanitizeUsername,
  validateCredentials,
  type UserRole,
} from '../auth/_lib';

type CreateUserBody = {
  username?: string;
  fullName?: string;
  password?: string;
  role?: UserRole;
};

type DeleteUserBody = {
  username?: string;
};

function normalizeRole(raw: unknown): UserRole {
  return raw === 'admin' ? 'admin' : 'user';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await getAuthenticatedUserFromAuthHeader(
      req.headers.authorization,
    );

    if (!user) {
      return res.status(401).json({
        error: 'authentication required or token expired',
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'admin permission required',
      });
    }

    const admin = user;

    const pool = await getUiAuthPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        `
          SELECT
            username,
            full_name,
            role,
            is_active,
            created_by,
            created_at,
            updated_at
          FROM ui_auth_users
        `,
      );

      return res.status(200).json({
        users: result.rows.map((row) => ({
          username: row.username,
          fullName: row.full_name,
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
      const fullName = String(body?.fullName || '').replace(/\s+/g, ' ').trim();
      const password = String(body?.password || '');
      const role = normalizeRole(body?.role);

      const validationError = validateCredentials(username, password);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (!fullName) {
        return res.status(400).json({
          error: '이름을 입력해 주세요.',
        });
      }

      if (fullName.length > 100) {
        return res.status(400).json({
          error:
            '이름은 100자 이하로 입력해 주세요.',
        });
      }

      const { hash, salt } = hashPassword(password);

      const result = await pool.query(
        `
          INSERT INTO ui_auth_users (username, full_name, password_hash, salt, role, is_active, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
          ON CONFLICT (username) DO NOTHING 
          RETURNING username, full_name, role, is_active, created_by, created_at, updated_at
        `,
        [username, fullName, hash, salt, role, admin.username],
      );

      if (result.rowCount === 0) {
        return res.status(409).json({ error: 'username already exists' });
      }

      const row = result.rows[0];

      return res.status(201).json({
        user: {
          username: row.username,
          fullName: row.full_name,
          role: row.role,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      const body = req.body as DeleteUserBody;

      const targetUsername = sanitizeUsername(
        String(body?.username || ''),
      );
    
      if (!targetUsername) {
        return res.status(400).json({
          error: 'username is required',
        });
      }
    
      if (
        targetUsername.length < 3 ||
        targetUsername.length > 64 ||
        !/^[a-z0-9][a-z0-9._-]*$/.test(targetUsername)
      ) {
        return res.status(400).json({
          error: 'invalid username',
        });
      }
    
      if (targetUsername === admin.username) {
        return res.status(400).json({
          error: '현재 로그인한 계정은 삭제할 수 없습니다.',
        });
      }
    
      const client = await pool.connect();
    
      try {
        await client.query('BEGIN');
      
        const targetResult = await client.query(
          `
            SELECT
              username,
              role,
              is_active
            FROM ui_auth_users
            WHERE username = $1
            FOR UPDATE
          `,
          [targetUsername],
        );
      
        if (targetResult.rowCount === 0) {
          await client.query('ROLLBACK');
        
          return res.status(404).json({
            error: '삭제할 계정을 찾을 수 없습니다.',
          });
        }
      
        const targetUser = targetResult.rows[0] as {
          username: string;
          role: UserRole;
          is_active: boolean;
        };
      
        if (
          targetUser.role === 'admin' &&
          targetUser.is_active
        ) {
          const adminCountResult = await client.query(
            `
              SELECT COUNT(*)::int AS count
              FROM ui_auth_users
              WHERE role = 'admin'
                AND is_active = TRUE
            `,
          );
        
          const activeAdminCount = Number(
            adminCountResult.rows[0]?.count || 0,
          );
        
          if (activeAdminCount <= 1) {
            await client.query('ROLLBACK');
          
            return res.status(400).json({
              error: '마지막 활성 관리자 계정은 삭제할 수 없습니다.',
            });
          }
        }
      
        const deleteResult = await client.query(
          `
            DELETE FROM ui_auth_users
            WHERE username = $1
            RETURNING
              username,
              role,
              is_active
          `,
          [targetUsername],
        );
      
        await client.query('COMMIT');
      
        const deletedUser = deleteResult.rows[0];
      
        return res.status(200).json({
          deleted: true,
          user: {
            username: deletedUser.username,
            role: deletedUser.role,
            isActive: deletedUser.is_active,
          },
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[admin/users] failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
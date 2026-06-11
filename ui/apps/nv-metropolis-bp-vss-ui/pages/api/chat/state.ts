import { NextApiRequest, NextApiResponse } from 'next';
import { getUiAuthPool, getUsernameFromAuthHeader } from '../auth/_lib';

type PersistedChatStatePayload = {
  storageKeyPrefix?: string;
  folders?: unknown[];
  conversations?: unknown[];
  selectedConversation?: unknown;
  showChatbar?: boolean;
};

function normalizeStorageKeyPrefix(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'default';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = getUsernameFromAuthHeader(req.headers.authorization);
  if (!username) {
    return res.status(401).json({ error: 'Missing or invalid Authorization Bearer token' });
  }

  const storageKeyPrefix = normalizeStorageKeyPrefix(
    req.method === 'GET' ? req.query.storageKeyPrefix : req.body?.storageKeyPrefix,
  );

  try {
    const pool = await getUiAuthPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT state_json, updated_at
         FROM ui_user_chat_state
         WHERE username = $1 AND storage_key_prefix = $2`,
        [username, storageKeyPrefix],
      );

      if (result.rowCount === 0) {
        return res.status(200).json({ state: null });
      }

      return res.status(200).json({
        state: result.rows[0]?.state_json ?? null,
        updatedAt: result.rows[0]?.updated_at ?? null,
      });
    }

    if (req.method === 'PUT') {
      const body = (req.body || {}) as PersistedChatStatePayload;
      const stateJson = {
        folders: Array.isArray(body.folders) ? body.folders : [],
        conversations: Array.isArray(body.conversations) ? body.conversations : [],
        selectedConversation: body.selectedConversation ?? null,
        showChatbar: typeof body.showChatbar === 'boolean' ? body.showChatbar : true,
      };

      await pool.query(
        `INSERT INTO ui_user_chat_state (username, storage_key_prefix, state_json, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW(), NOW())
         ON CONFLICT (username, storage_key_prefix)
         DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()`,
        [username, storageKeyPrefix, JSON.stringify(stateJson)],
      );

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[api/chat/state] failed:', error);
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
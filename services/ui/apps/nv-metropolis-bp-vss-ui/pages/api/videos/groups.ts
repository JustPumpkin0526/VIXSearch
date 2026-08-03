import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import {
  cleanupEmptyUploadedVideoGroups,
  ensureUploadedVideoGroupingSchema,
  getAccountIdFromVideosPayload,
  getVideosPool,
  verifyVideosJwt,
} from './_lib';
import { useBodyStyles } from 'rsuite/esm/Modal/utils';

type GroupRow = {
  id: string;
  name: string;
  created_at: string;
  sensor_ids: string[] | null;
};

async function getGroupsForUser(username: string) {
  const result = await getVideosPool().query<GroupRow>(
    `SELECT
       g.id,
       g.name,
       g.created_at,
       COALESCE(
         array_agg(v.sensor_id ORDER BY v.uploaded_at DESC) FILTER (WHERE v.sensor_id IS NOT NULL),
         ARRAY[]::TEXT[]
       ) AS sensor_ids
     FROM uploaded_video_groups g
     LEFT JOIN uploaded_videos v
       ON v.group_id = g.id
      AND v.username = g.username
     WHERE g.username = $1
     GROUP BY g.id, g.name, g.created_at
     HAVING COUNT(v.sensor_id) > 0
     ORDER BY g.created_at DESC`,
    [username]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    sensorIds: Array.isArray(row.sensor_ids) ? row.sensor_ids : [],
    createdAt: row.created_at,
  }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verification = verifyVideosJwt(token);
  if (!verification.valid) {
    return res.status(401).json({ error: `Invalid token: ${verification.reason}` });
  }

  const username = getAccountIdFromVideosPayload(verification.payload);
  if (!username) {
    return res.status(400).json({ error: 'Token missing account identifier claim' });
  }

  await ensureUploadedVideoGroupingSchema();

  if (req.method === 'GET') {
    try {
      const client = await getVideosPool().connect();
      try {
        await cleanupEmptyUploadedVideoGroups(client, username);
      } finally {
        client.release();
      }

      const groups = await getGroupsForUser(username);
      return res.status(200).json({ groups });
    } catch (err: any) {
      console.error('[api/videos/groups][GET] failed:', err);
      return res.status(500).json({ error: String(err?.message || err) });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const name = typeof (body.name ?? body.group_name ?? body.groupName) === 'string'
      ? String(body.name ?? body.group_name ?? body.groupName).trim()
      : '';
    const rawSensorIds = body.sensor_ids ?? body.sensorIds ?? [];
    const sensorIds = Array.isArray(rawSensorIds)
      ? rawSensorIds
          .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
          .filter(Boolean)
      : [];

    if (sensorIds.length === 0) {
      return res.status(400).json({ error: 'At least one sensor_id is required' });
    }

    try {
      const client = await getVideosPool().connect();
      try {
        await client.query('BEGIN');

        const validSensorRows = await client.query<{ sensor_id: string }>(
          `SELECT DISTINCT sensor_id
           FROM uploaded_videos
           WHERE username = $1
             AND sensor_id = ANY($2::text[])`,
          [username, sensorIds]
        );

        const validSensorIds = validSensorRows.rows
          .map((row) => row.sensor_id)
          .filter(Boolean);

        if (validSensorIds.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'No uploaded videos matched the selected items' });
        }

        const groupId = crypto.randomUUID();
        await client.query(
          `INSERT INTO uploaded_video_groups (id, username, name)
           VALUES ($1, $2, $3)`,
          [groupId, username, name || `그룹 ${Date.now()}`]
        );

        await client.query(
          `UPDATE uploaded_videos
           SET group_id = $1
           WHERE username = $2
             AND sensor_id = ANY($3::text[])`,
          [groupId, username, validSensorIds]
        );

        await cleanupEmptyUploadedVideoGroups(client, username);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const groups = await getGroupsForUser(username);
      return res.status(200).json({ ok: true, groups });
    } catch (err: any) {
      console.error('[api/videos/groups][POST] failed:', err);
      return res.status(500).json({ error: String(err?.message || err) });
    }
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};

    const group_id = typeof (body.group_id) === 'string'
      ? String(body.group_id).trim()
      : '';

    const group_name = typeof (body.group_name) === 'string'
      ? String(body.group_name).trim()
      : '';
    
    if (!group_id) {
      return res.status(400).json({
        error: 'group_id is required',
      });
    }

    if (!group_name) {
      return res.status(400).json({
        error: 'Group name is required'
      });
    }

    if (group_name.length > 100) {
      return res.status(400).json({
        error: 'Group name must be 100 characters on fewer'
      });
    }

    try {
      const result = await getVideosPool().query(
        `UPDATE uploaded_video_groups
        SET name = $1
        WHERE id = $2
          AND username = $3
        RETURNING id`,
        [group_name, group_id, username],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error: 'Video group not found',
        });
      }

      const groups = await getGroupsForUser(username);

      return res.status(200).json({
        ok: true,
        groups,
      });
    } catch (err: any){
      console.error(
        '[api/videos/groups][PATCH] failed: ',
        err,
      );

      return res.status(500).json({
        error: String(err?.message || err),
      });
    }
  }

  if (req.method === 'DELETE') {
    const body = req.body || {};
    const rawGroupIds = body.group_ids ?? body.groupIds ?? [];
    const groupIds = Array.isArray(rawGroupIds)
      ? rawGroupIds
          .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
          .filter(Boolean)
      : [];

    if (groupIds.length === 0) {
      return res.status(400).json({ error: 'At least one group id is required' });
    }

    try {
      const client = await getVideosPool().connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE uploaded_videos
           SET group_id = NULL
           WHERE username = $1
             AND group_id = ANY($2::text[])`,
          [username, groupIds]
        );

        await client.query(
          `DELETE FROM uploaded_video_groups
           WHERE username = $1
             AND id = ANY($2::text[])`,
          [username, groupIds]
        );

        await cleanupEmptyUploadedVideoGroups(client, username);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const groups = await getGroupsForUser(username);
      return res.status(200).json({ ok: true, groups });
    } catch (err: any) {
      console.error('[api/videos/groups][DELETE] failed:', err);
      return res.status(500).json({ error: String(err?.message || err) });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
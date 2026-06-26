import { NextApiRequest, NextApiResponse } from 'next';

import { getUiAuthPool, getUsernameFromAuthHeader } from '../../auth/_lib';
import {
  buildAccidentReportWordBuffer,
  convertWordBufferToPdfBuffer,
  createPdfFileName,
  createWordFileName,
  ReportPayload,
} from '../_docx';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = getUsernameFromAuthHeader(req.headers.authorization);
  if (!username) {
    return res.status(401).json({ error: 'Missing or invalid Authorization Bearer token' });
  }

  const reportId = Array.isArray(req.query.reportId) ? req.query.reportId[0] : req.query.reportId;
  if (!reportId) {
    return res.status(400).json({ error: 'report id is required' });
  }

  try {
    const pool = await getUiAuthPool();
    const result = await pool.query(
      `SELECT id, title, report_json, created_at
       FROM ui_user_reports
       WHERE id = $1 AND username = $2
       LIMIT 1`,
      [reportId, username],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const row = result.rows[0];
    const reportJson = row.report_json && typeof row.report_json === 'object'
      ? (row.report_json as Record<string, unknown>)
      : {};

    const payload: ReportPayload = {
      id: String(row.id),
      title: typeof reportJson.title === 'string' ? reportJson.title : String(row.title),
      createdAt: typeof reportJson.createdAt === 'string' ? reportJson.createdAt : new Date(row.created_at).toISOString(),
      author: typeof reportJson.author === 'string' ? reportJson.author : '',
      query: typeof reportJson.query === 'string' ? reportJson.query : '',
      description: typeof reportJson.description === 'string' ? reportJson.description : '',
      content: typeof reportJson.content === 'string' ? reportJson.content : '',
      wordCount: typeof reportJson.wordCount === 'number' ? reportJson.wordCount : 0,
      items: Array.isArray(reportJson.items) ? (reportJson.items as ReportPayload['items']) : [],
      pdfSource: typeof reportJson.pdfSource === 'string' ? reportJson.pdfSource : undefined,
      wordFileName: typeof reportJson.wordFileName === 'string' ? reportJson.wordFileName : createWordFileName(String(row.title), String(row.id)),
      wordBase64: typeof reportJson.wordBase64 === 'string' ? reportJson.wordBase64 : undefined,
      pdfFileName: typeof reportJson.pdfFileName === 'string' ? reportJson.pdfFileName : createPdfFileName(String(row.title), String(row.id)),
      pdfFileUrl: typeof reportJson.pdfFileUrl === 'string' ? reportJson.pdfFileUrl : `/api/reports/pdf/${encodeURIComponent(String(row.id))}`,
      pdfBase64: typeof reportJson.pdfBase64 === 'string' ? reportJson.pdfBase64 : undefined,
    };

    let buffer: Buffer;
    if (payload.pdfBase64 && payload.pdfSource === 'word-converter') {
      buffer = Buffer.from(payload.pdfBase64, 'base64');
    } else {
      const wordBuffer = payload.wordBase64
        ? Buffer.from(payload.wordBase64, 'base64')
        : await buildAccidentReportWordBuffer(payload);
      buffer = await convertWordBufferToPdfBuffer(wordBuffer, payload.wordFileName || createWordFileName(payload.title, payload.id));
      payload.wordBase64 = wordBuffer.toString('base64');
      payload.pdfBase64 = buffer.toString('base64');
      payload.pdfSource = 'word-converter';
      await pool.query(
        `UPDATE ui_user_reports
         SET report_json = $3::jsonb, updated_at = NOW()
         WHERE id = $1 AND username = $2`,
        [payload.id, username, JSON.stringify(payload)],
      );
    }

    const fileName = payload.pdfFileName || createPdfFileName(payload.title, payload.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).end(buffer);
  } catch (error: any) {
    console.error('[api/reports/pdf] failed:', error);
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
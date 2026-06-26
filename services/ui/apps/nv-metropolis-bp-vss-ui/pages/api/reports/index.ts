import { NextApiRequest, NextApiResponse } from 'next';
import { getUiAuthPool, getUsernameFromAuthHeader } from '../auth/_lib';
import {
  buildAccidentReportWordBuffer,
  buildAccidentReportPdfBuffer,
  convertWordBufferToPdfBuffer,
  createPdfFileName,
  createWordFileName,
  ReportPayload,
  ReportSceneItem,
} from './_docx';

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function normalizeReportItems(raw: unknown): ReportSceneItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item, index) => {
    const candidate = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      id: typeof candidate.id === 'string' ? candidate.id : `scene-${index}`,
      videoName: typeof candidate.videoName === 'string' ? candidate.videoName : '검색 결과',
      description: typeof candidate.description === 'string' ? candidate.description : '',
      startTime: typeof candidate.startTime === 'string' ? candidate.startTime : '',
      endTime: typeof candidate.endTime === 'string' ? candidate.endTime : '',
      sensorId: typeof candidate.sensorId === 'string' ? candidate.sensorId : '',
      similarity: typeof candidate.similarity === 'number' ? candidate.similarity : 0,
      screenshotUrl: typeof candidate.screenshotUrl === 'string' ? candidate.screenshotUrl : '',
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = getUsernameFromAuthHeader(req.headers.authorization);
  if (!username) {
    return res.status(401).json({ error: 'Missing or invalid Authorization Bearer token' });
  }

  try {
    const pool = await getUiAuthPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT id, title, report_json, created_at
         FROM ui_user_reports
         WHERE username = $1
         ORDER BY created_at DESC`,
        [username],
      );

      const reports = result.rows.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        createdAt:
          typeof row.report_json?.createdAt === 'string'
            ? row.report_json.createdAt
            : new Date(row.created_at).toISOString(),
        author: typeof row.report_json?.author === 'string' ? row.report_json.author : '',
        query: typeof row.report_json?.query === 'string' ? row.report_json.query : '',
        description: typeof row.report_json?.description === 'string' ? row.report_json.description : '',
        content: typeof row.report_json?.content === 'string' ? row.report_json.content : '',
        wordCount: typeof row.report_json?.wordCount === 'number' ? row.report_json.wordCount : 0,
        wordFileUrl: `/api/reports/word/${encodeURIComponent(String(row.id))}`,
        wordFileName: typeof row.report_json?.wordFileName === 'string' ? row.report_json.wordFileName : createWordFileName(String(row.title), String(row.id)),
        pdfFileUrl: `/api/reports/pdf/${encodeURIComponent(String(row.id))}`,
        pdfFileName: typeof row.report_json?.pdfFileName === 'string' ? row.report_json.pdfFileName : createPdfFileName(String(row.title), String(row.id)),
        items: Array.isArray(row.report_json?.items) ? row.report_json.items : [],
      }));

      return res.status(200).json({ reports });
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const reportId =
        typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `report-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '보고서';
      const createdAt =
        typeof body.createdAt === 'string' && body.createdAt.trim() ? body.createdAt.trim() : new Date().toISOString();
      const author = typeof body.author === 'string' ? body.author : '';
      const query = typeof body.query === 'string' ? body.query : '';
      const description = typeof body.description === 'string' ? body.description : '';
      const content = typeof body.content === 'string' ? body.content : '';
      const wordCount = typeof body.wordCount === 'number' ? body.wordCount : countWords(content);
      const reportPayload: ReportPayload = {
        id: reportId,
        title,
        createdAt,
        author,
        query,
        description,
        content,
        wordCount,
        items: normalizeReportItems(body.items),
      };
      const wordBuffer = await buildAccidentReportWordBuffer(reportPayload);
      reportPayload.wordFileName = createWordFileName(title, reportId);
      reportPayload.wordFileUrl = `/api/reports/word/${encodeURIComponent(reportId)}`;
      reportPayload.pdfFileName = createPdfFileName(title, reportId);
      reportPayload.pdfFileUrl = `/api/reports/pdf/${encodeURIComponent(reportId)}`;
      let pdfBuffer: Buffer;
      let pdfSource = 'word-converter';
          
      try {
        pdfBuffer = await convertWordBufferToPdfBuffer(
          wordBuffer,
          reportPayload.wordFileName,
        );
      } catch (error) {
        console.warn(
          '[api/reports] Word to PDF conversion failed, using pdf-lib fallback:',
          error,
        );
      
        pdfBuffer = await buildAccidentReportPdfBuffer(reportPayload);
        pdfSource = 'pdf-lib';
      }
      
      reportPayload.wordBase64 = wordBuffer.toString('base64');
      reportPayload.pdfBase64 = pdfBuffer.toString('base64');
      reportPayload.pdfSource = pdfSource;

      await pool.query(
        `INSERT INTO ui_user_reports (id, username, title, report_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())`,
        [reportId, username, title, JSON.stringify(reportPayload)],
      );

      return res.status(201).json({ report: reportPayload });
    }

    if (req.method === 'PATCH') {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const reportId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : '';

      if (!reportId) {
        return res.status(400).json({ error: 'report id is required' });
      }

      const existingResult = await pool.query(
        `SELECT title, report_json, created_at
         FROM ui_user_reports
         WHERE id = $1 AND username = $2
         LIMIT 1`,
        [reportId, username],
      );

      if (existingResult.rowCount === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const existingRow = existingResult.rows[0];
      const existingJson = existingRow.report_json && typeof existingRow.report_json === 'object'
        ? (existingRow.report_json as Record<string, unknown>)
        : {};

      const title = typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : (typeof existingJson.title === 'string' ? existingJson.title : String(existingRow.title));
      const createdAt = typeof existingJson.createdAt === 'string'
        ? existingJson.createdAt
        : new Date(existingRow.created_at).toISOString();
      const author = typeof body.author === 'string'
        ? body.author
        : (typeof existingJson.author === 'string' ? existingJson.author : '');
      const query = typeof body.query === 'string'
        ? body.query
        : (typeof existingJson.query === 'string' ? existingJson.query : '');
      const description = typeof body.description === 'string'
        ? body.description
        : (typeof existingJson.description === 'string' ? existingJson.description : '');
      const content = typeof body.content === 'string'
        ? body.content
        : (typeof existingJson.content === 'string' ? existingJson.content : '');
      const items = Array.isArray(body.items)
        ? normalizeReportItems(body.items)
        : normalizeReportItems(existingJson.items);
      const wordCount = typeof body.wordCount === 'number' ? body.wordCount : countWords(content);

      const reportPayload: ReportPayload = {
        id: reportId,
        title,
        createdAt,
        author,
        query,
        description,
        content,
        wordCount,
        items,
      };
      const wordBuffer = await buildAccidentReportWordBuffer(reportPayload);
      reportPayload.wordFileName = createWordFileName(title, reportId);
      reportPayload.wordFileUrl = `/api/reports/word/${encodeURIComponent(reportId)}`;
      reportPayload.pdfFileName = createPdfFileName(title, reportId);
      reportPayload.pdfFileUrl = `/api/reports/pdf/${encodeURIComponent(reportId)}`;
      let pdfBuffer: Buffer;
      let pdfSource = 'word-converter';
          
      try {
        pdfBuffer = await convertWordBufferToPdfBuffer(
          wordBuffer,
          reportPayload.wordFileName,
        );
      } catch (error) {
        console.warn(
          '[api/reports] Word to PDF conversion failed, using pdf-lib fallback:',
          error,
        );
      
        pdfBuffer = await buildAccidentReportPdfBuffer(reportPayload);
        pdfSource = 'pdf-lib';
      }
      
      reportPayload.wordBase64 = wordBuffer.toString('base64');
      reportPayload.pdfBase64 = pdfBuffer.toString('base64');
      reportPayload.pdfSource = pdfSource;

      await pool.query(
        `UPDATE ui_user_reports
         SET title = $3, report_json = $4::jsonb, updated_at = NOW()
         WHERE id = $1 AND username = $2`,
        [reportId, username, title, JSON.stringify(reportPayload)],
      );

      return res.status(200).json({ report: reportPayload });
    }

    if (req.method === 'DELETE') {
      const reportIdFromQuery = typeof req.query.id === 'string' ? req.query.id.trim() : '';
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const reportIdFromBody = typeof body.id === 'string' ? body.id.trim() : '';
      const reportId = reportIdFromQuery || reportIdFromBody;

      if (!reportId) {
        return res.status(400).json({ error: 'report id is required' });
      }

      const deleteResult = await pool.query(
        `DELETE FROM ui_user_reports
         WHERE id = $1 AND username = $2`,
        [reportId, username],
      );

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      return res.status(200).json({ deletedId: reportId });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[api/reports] failed:', error);
    return res.status(500).json({ error: String(error?.message || error) });
  }
}
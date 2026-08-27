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

 
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = getUsernameFromAuthHeader(req.headers.authorization);

function normalizeReportItems(raw: unknown): ReportSceneItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item, index) => {
  const candidate = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  return {
    id: typeof candidate.id === 'string'
    ? candidate.id
    : `scene-${index}`,
    videoName: typeof candidate.videoName === 'string'
      ? candidate.videoName
      : '검색 결과',
    locationName: typeof candidate.locationName === 'string'
      ? candidate.locationName
      : undefined,
    description: typeof candidate.description === 'string'
      ? candidate.description
      : '',
    comment: typeof candidate.comment === 'string'
      ? candidate.comment
      : undefined,
    query: typeof candidate.query === 'string'
      ? candidate.query
      : undefined,
    startTime: typeof candidate.startTime === 'string'
      ? candidate.startTime
      : '',
    endTime: typeof candidate.endTime === 'string'
      ? candidate.endTime
      : '',
    sensorId: typeof candidate.sensorId === 'string'
      ? candidate.sensorId
      : '',
    similarity: typeof candidate.similarity === 'number'
      ? candidate.similarity
      : 0,
    pauseTime: typeof candidate.pauseTime === 'number'
      ? candidate.pauseTime
      : undefined,
    screenshotUrl: typeof candidate.screenshotUrl === 'string'
      ? candidate.screenshotUrl
      : '',
    // Prefer originalFileName (client-provided) -> fileName -> derive from screenshotUrl
    fileName: ((): string | undefined => {
      if (typeof candidate.originalFileName === 'string' && candidate.originalFileName.trim()) return candidate.originalFileName.trim();
      if (typeof candidate.fileName === 'string' && candidate.fileName.trim()) return candidate.fileName.trim();
      const ss = typeof candidate.screenshotUrl === 'string' ? candidate.screenshotUrl : '';
      if (!ss) return undefined;
      try {
        if (ss.startsWith('data:image/')) {
          const ext = ss.startsWith('data:image/png') ? 'png' : 'jpg';
          return `capture_${Date.now()}.${ext}`;
        }
        const u = new URL(ss);
        const base = decodeURIComponent(u.pathname.split('/').pop() || 'file');
        return base || undefined;
      } catch {
        try { return String(ss).split('/').pop() || undefined; } catch { return undefined; }
      }
    })(),
    originalFileName: typeof candidate.originalFileName === 'string' ? candidate.originalFileName : undefined,
  };
  });
}

// Utility: count words in a string (used for wordCount fallback)
function countWords(value: string): number {
  if (!value || typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
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
      // DEBUG: log incoming fileName values for diagnosis
      try {
        console.debug('[api/reports] incoming POST report items fileNames:',
          Array.isArray((body as any).items) ? (body as any).items.map((it: any) => it?.fileName) : null,
        );
      } catch (e) {
        console.debug('[api/reports] failed to log incoming fileNames', e);
      }
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
        items: normalizeReportItems(body.items).map((it) => ({
          ...it,
          locationName: it.locationName ?? (typeof body.place === 'string' ? body.place : undefined),
        })),
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
      const existingItems = normalizeReportItems(existingJson.items);
      const appendItem = body.appendItem && typeof body.appendItem === 'object'
        ? normalizeReportItems([body.appendItem])[0]
        : undefined;
      const maybeAppend = appendItem
        ? existingItems.some((item) => item.id === appendItem.id)
          ? existingItems
          : [...existingItems, appendItem]
        : Array.isArray(body.items)
          ? normalizeReportItems(body.items)
          : existingItems;
      const items = maybeAppend.map((it) => ({
        ...it,
        locationName: it.locationName ?? (typeof body.place === 'string' ? body.place : undefined),
      }));
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
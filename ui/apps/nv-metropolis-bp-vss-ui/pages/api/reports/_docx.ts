import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

const PDF_FONT_CANDIDATES = {
  regular: [
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ],
  bold: [
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Bold.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ],
};

let cachedPdfFontBytes: { regular?: Uint8Array | null; bold?: Uint8Array | null } | null = null;

export type ReportSceneItem = {
  id: string;
  videoName: string;
  description: string;
  startTime: string;
  endTime: string;
  sensorId: string;
  similarity: number;
  screenshotUrl: string;
};

export type ReportPayload = {
  id: string;
  title: string;
  createdAt: string;
  author?: string;
  query?: string;
  description?: string;
  content?: string;
  wordCount?: number;
  items: ReportSceneItem[];
  pdfSource?: string;
  wordFileUrl?: string;
  wordFileName?: string;
  pdfFileUrl?: string;
  pdfFileName?: string;
  wordBase64?: string;
  pdfBase64?: string;
};

function safeText(value: string | undefined, fallback = '-'): string {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function formatClock(value: string | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR');
}

function buildReportQuestion(report: ReportPayload): string {
  return safeText(report.query || report.description || report.title, '검색어가 제공되지 않았습니다.');
}

function getImageExtension(url: string, contentType: string | null): 'jpg' | 'png' | null {
  const normalizedType = (contentType || '').toLowerCase();
  if (normalizedType.includes('png')) {
    return 'png';
  }
  if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) {
    return 'jpg';
  }

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.png')) {
    return 'png';
  }
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) {
    return 'jpg';
  }

  return null;
}

async function fetchRemoteImage(url: string | undefined): Promise<{ bytes: Uint8Array; extension: 'jpg' | 'png' } | null> {
  const target = String(url || '').trim();
  if (!target) {
    return null;
  }

  try {
    const response = await fetch(target);
    if (!response.ok) {
      return null;
    }

    const extension = getImageExtension(target, response.headers.get('content-type'));
    if (!extension) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, extension };
  } catch {
    return null;
  }
}

function paragraphDivider(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: 'AAB4C3',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { before: 120, after: 120 },
  });
}

function buildInfoTable(report: ReportPayload): Table {
  return new Table({
    width: { size: 42, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    rows: [
      ['작성자', safeText(report.author, 'VSS 시스템')],
      ['작성 일자', formatDateTime(report.createdAt)],
    ].map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          shading: { fill: 'E9EEF5' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: label, bold: true, size: 20 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: value, size: 20 })],
            }),
          ],
        }),
      ],
    })),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'C8D1DC' },
    },
  });
}

async function buildWordSceneBlocks(report: ReportPayload): Promise<Array<Paragraph>> {
  const blocks: Paragraph[] = [];

  for (const [index, item] of report.items.entries()) {
    blocks.push(
      new Paragraph({
        spacing: { before: index === 0 ? 120 : 200, after: 80 },
        indent: { left: 280 },
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: `[${index + 1}] `, bold: true, size: 24 }),
          new TextRun({ text: safeText(item.videoName, `clip_${index + 1}`), bold: true, size: 24 }),
          new TextRun({ text: ` (시간: ${formatClock(item.startTime)} - ${formatClock(item.endTime)})`, size: 22 }),
        ],
      }),
    );

    const image = await fetchRemoteImage(item.screenshotUrl);
    if (image) {
      blocks.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 80 },
          children: [
            new ImageRun({
              data: image.bytes,
              transformation: { width: 420, height: 236 },
              type: image.extension,
            }),
          ],
        }),
      );
    }

    blocks.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 80 },
        indent: { left: 420, right: 420 },
        children: [new TextRun({ text: safeText(item.description, safeText(report.content, '설명 없음')), size: 22 })],
      }),
    );

    if (index < report.items.length - 1) {
      blocks.push(paragraphDivider());
    }
  }

  return blocks;
}

export function createWordFileName(title: string, reportId: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s-가-힣]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50) || 'incident_report';

  return `${slug}_${reportId}.docx`;
}

export function createPdfFileName(title: string, reportId: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s-가-힣]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50) || 'incident_report';

  return `${slug}_${reportId}.pdf`;
}

export async function convertWordBufferToPdfBuffer(
  wordBuffer: Buffer,
  fileName: string,
): Promise<Buffer> {
  const safeBaseName = (fileName || 'report.docx')
    .replace(/[^\w\s.-가-힣]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'report.docx';
  const docxFileName = safeBaseName.toLowerCase().endsWith('.docx') ? safeBaseName : `${safeBaseName}.docx`;

  const workDir = await mkdtemp(path.join(tmpdir(), 'vss-report-'));
  const profileDir = path.join(workDir, 'libreoffice-profile');
  const inputPath = path.join(workDir, docxFileName);
  const outputPath = path.join(workDir, docxFileName.replace(/\.docx$/i, '.pdf'));

  try {
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, wordBuffer);

    await new Promise<void>((resolve, reject) => {
      const command = spawn(
        'soffice',
        [
          '--headless',
          '--nologo',
          '--nodefault',
          '--nofirststartwizard',
          `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
          '--convert-to',
          'pdf:writer_pdf_Export',
          '--outdir',
          workDir,
          inputPath,
        ],
        {
          env: {
            ...process.env,
            HOME: workDir,
          },
        },
      );

      let stderr = '';
      let stdout = '';

      command.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      command.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      command.on('error', (error) => {
        reject(error);
      });
      command.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error((stderr || stdout || `soffice exited with code ${code}`).trim()));
      });
    });

    return await readFile(outputPath);
  } catch (error) {
    throw new Error(`Failed to convert Word to PDF with local LibreOffice: ${String((error as Error)?.message || error)}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function buildAccidentReportWordBuffer(report: ReportPayload): Promise<Buffer> {
  const sceneBlocks = await buildWordSceneBlocks(report);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: safeText(report.title, 'VSS 분석 보고서'),
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
          }),
          paragraphDivider(),
          buildInfoTable(report),
          paragraphDivider(),
          new Paragraph({
            spacing: { before: 40, after: 80 },
            children: [
              new TextRun({ text: '사용자 질문: ', bold: true, color: '0066CC', size: 24 }),
              new TextRun({ text: buildReportQuestion(report), size: 22 }),
            ],
          }),
          paragraphDivider(),
          new Paragraph({
            spacing: { before: 40, after: 120 },
            children: [new TextRun({ text: '검색 결과', bold: true, color: '0066CC', size: 24 })],
          }),
          ...sceneBlocks,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function drawWrappedText(
  pdfDoc: PDFDocument,
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): { page: PDFPage; y: number } {
  const lines: string[] = [];

  for (const rawLine of text.split('\n')) {
    const tokens = rawLine.includes(' ')
      ? rawLine.split(/(\s+)/).filter((token) => token.length > 0)
      : Array.from(rawLine);
    if (tokens.length === 0) {
      lines.push('');
      continue;
    }

    let current = tokens[0];
    for (let index = 1; index < tokens.length; index += 1) {
      const candidate = `${current}${tokens[index]}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = tokens[index].trimStart();
      }
    }
    lines.push(current);
  }

  let currentPage = page;
  let currentY = y;
  for (const line of lines) {
    if (currentY < 60) {
      currentPage = pdfDoc.addPage([595.28, 841.89]);
      currentY = 790;
    }
    currentPage.drawText(line, {
      x,
      y: currentY,
      size,
      font,
      color: rgb(0.15, 0.18, 0.22),
    });
    currentY -= lineHeight;
  }

  return { page: currentPage, y: currentY };
}

function drawDivider(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: 48, y },
    end: { x: 547, y },
    thickness: 1,
    color: rgb(0.75, 0.79, 0.84),
  });
}

async function drawImageBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  imageUrl: string | undefined,
  y: number,
): Promise<{ page: PDFPage; y: number }> {
  const image = await fetchRemoteImage(imageUrl);
  if (!image) {
    return { page, y };
  }

  try {
    const embedded = image.extension === 'png'
      ? await pdfDoc.embedPng(image.bytes)
      : await pdfDoc.embedJpg(image.bytes);
    const scaled = embedded.scale(Math.min(1, 420 / embedded.width));

    let nextPage = page;
    let nextY = y;
    if (nextY - scaled.height < 70) {
      nextPage = pdfDoc.addPage([595.28, 841.89]);
      nextY = 790;
    }

    nextPage.drawImage(embedded, {
      x: (595.28 - scaled.width) / 2,
      y: nextY - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });

    return { page: nextPage, y: nextY - scaled.height - 16 };
  } catch {
    return { page, y };
  }
}

export async function buildAccidentReportPdfBuffer(report: ReportPayload): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const loadFontBytes = async (kind: 'regular' | 'bold'): Promise<Uint8Array | null> => {
    if (cachedPdfFontBytes?.[kind] !== undefined) {
      return cachedPdfFontBytes[kind] ?? null;
    }

    for (const candidate of PDF_FONT_CANDIDATES[kind]) {
      try {
        const bytes = await readFile(candidate);
        cachedPdfFontBytes = { ...(cachedPdfFontBytes || {}), [kind]: bytes };
        return bytes;
      } catch {
        continue;
      }
    }

    cachedPdfFontBytes = { ...(cachedPdfFontBytes || {}), [kind]: null };
    return null;
  };

  const regularFontBytes = await loadFontBytes('regular');
  const boldFontBytes = await loadFontBytes('bold');
  let regularFont: PDFFont;
  let boldFont: PDFFont;

  try {
    regularFont = regularFontBytes
      ? await pdfDoc.embedFont(regularFontBytes, { subset: true })
      : await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = boldFontBytes
      ? await pdfDoc.embedFont(boldFontBytes, { subset: true })
      : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  } catch {
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 790;
  const left = 48;
  const maxWidth = 500;
  page.drawText(safeText(report.title, 'VSS 분석 보고서'), {
    x: 160,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.07, 0.22, 0.44),
  });
  y -= 18;
  drawDivider(page, y);
  y -= 28;

  const infoRows = [
    `작성자: ${safeText(report.author, 'VSS 시스템')}`,
    `작성 일자: ${formatDateTime(report.createdAt)}`,
  ];
  for (const row of infoRows) {
    ({ page, y } = drawWrappedText(pdfDoc, page, row, regularFont, 10.5, 340, y, 200, 14));
  }

  y -= 10;
  drawDivider(page, y);
  y -= 28;

  ({ page, y } = drawWrappedText(pdfDoc, page, '사용자 질문:', boldFont, 12, left, y, maxWidth, 16));
  ({ page, y } = drawWrappedText(pdfDoc, page, buildReportQuestion(report), regularFont, 11, 120, y + 16, 420, 16));
  y -= 16;
  drawDivider(page, y);
  y -= 28;

  ({ page, y } = drawWrappedText(pdfDoc, page, '검색 결과', boldFont, 12, left, y, maxWidth, 16));
  y -= 8;

  for (const [index, item] of report.items.entries()) {
    const headerText = `[${index + 1}] ${safeText(item.videoName)} (시간: ${formatClock(item.startTime)} - ${formatClock(item.endTime)})`;
    ({ page, y } = drawWrappedText(pdfDoc, page, headerText, boldFont, 11, left + 10, y, maxWidth - 10, 15));
    y -= 6;
    ({ page, y } = await drawImageBlock(pdfDoc, page, item.screenshotUrl, y));
    ({ page, y } = drawWrappedText(pdfDoc, page, safeText(item.description, safeText(report.content, '설명 없음')), regularFont, 10.5, 80, y, 440, 15));
    y -= 10;
    if (index < report.items.length - 1) {
      drawDivider(page, y);
      y -= 18;
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
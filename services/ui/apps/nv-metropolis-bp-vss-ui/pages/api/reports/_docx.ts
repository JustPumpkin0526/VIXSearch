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
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

const PDF_FONT_CANDIDATES = {
  regular: [
    // standalone server 실행 위치가 /repo일 때
    path.join(
      process.cwd(),
      'apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf',
    ),

    // standalone app 내부에서 실행 위치가 app root일 때
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Regular.otf'),

    // Dockerfile에서 시스템 폰트 경로로 복사한 경우
    '/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf',

    // apt fonts-noto-cjk 설치 시 생성될 수 있는 경로
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ],

  bold: [
    path.join(
      process.cwd(),
      'apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Bold.otf',
    ),
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Bold.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',

    // Bold 폰트가 없을 경우 Regular라도 사용
    path.join(
      process.cwd(),
      'apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf',
    ),
    path.join(process.cwd(), 'assets/fonts/NotoSansCJKkr-Regular.otf'),
    '/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ],
};

let cachedPdfFontBytes: { regular?: Uint8Array | null; bold?: Uint8Array | null } | null = null;

export type ReportSceneItem = {
  id: string;
  videoName: string;
  description: string;
  startTime?: string;
  endTime?: string;
  sensorId?: string;
  similarity?: number;
  pauseTime?: number;
  screenshotUrl?: string;
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

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

function formatPlaybackTime(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatSimilarity(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return value <= 1 ? value.toFixed(3) : value.toFixed(1);
}

function buildDocumentNumber(report: ReportPayload): string {
  const date = new Date(report.createdAt);
  const datePart = Number.isNaN(date.getTime())
    ? 'UNKNOWN'
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `VIX-${datePart}-${safeText(report.id, 'REPORT').slice(0, 8)}`;
}

function buildSceneTime(item: ReportSceneItem): string {
  const formatVideoTimestamp = (value: string | undefined): string => {
    const normalized = String(value || '').trim();
    if (!normalized) return '-';
    const matched = normalized.match(/(?:T|\s)?(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    return matched?.[1] ?? normalized;
  };

  if (item.startTime || item.endTime) {
    return `${formatVideoTimestamp(item.startTime)} ~ ${formatVideoTimestamp(item.endTime)}`;
  }
  return formatPlaybackTime(item.pauseTime);
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

  if (target.startsWith('data:image/')) {
    const match = target.match(
      /^data:image\/(png|jpeg|jpg);base64,(.+)$/,
    );

    if (!match) {
      return null;
    }

    return {
      bytes: new Uint8Array(
        Buffer.from(match[2], 'base64'),
      ),
      extension:
        match[1] === 'png'
          ? 'png'
          : 'jpg',
    };
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
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ['문서번호', buildDocumentNumber(report), '작성자', safeText(report.author, 'VSS 시스템')],
      ['생성일시', formatDateTime(report.createdAt), '검색 결과', `${report.items.length}건`],
    ].map(([label1, value1, label2, value2]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: 'E8F5EF' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: label1, bold: true, size: 19, color: '176B52' })] })],
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: value1, size: 19 })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: 'E8F5EF' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: label2, bold: true, size: 19, color: '176B52' })] })],
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: value2, size: 19 })] })],
        }),
      ],
    })),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
    },
  });
}

function buildSearchOverviewTable(report: ReportPayload): Table {
  const videoNames = report.items
    .map((item) => safeText(item.videoName))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(', ') || '-';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ['검색어', buildReportQuestion(report)],
      ['검색 대상', videoNames],
    ].map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: 'E8F5EF' },
          margins: { top: 110, bottom: 110, left: 120, right: 120 },
          children: [new Paragraph({ children: [
            new TextRun({ text: label, bold: true, size: 20, color: '176B52' }),
          ] })],
        }),
        new TableCell({
          width: { size: 80, type: WidthType.PERCENTAGE },
          margins: { top: 110, bottom: 110, left: 140, right: 140 },
          children: [new Paragraph({ children: [
            new TextRun({ text: value, size: 20, color: '24313A' }),
          ] })],
        }),
      ],
    })),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D7E2DD' },
    },
  });
}

async function buildWordSceneTable(
  report: ReportPayload,
): Promise<Table> {
  const rows: TableRow[] = [];

  for (
    const [index, item]
    of report.items.entries()
  ) {
    const image =
      await fetchRemoteImage(
        item.screenshotUrl,
      );

    const imageChildren = image
      ? [
          new Paragraph({
            alignment:
              AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: image.bytes,
                transformation: {
                  width: 420,
                  height: 236,
                },
                type: image.extension,
              }),
            ],
          }),
        ]
      : [
          new Paragraph({
            alignment:
              AlignmentType.CENTER,
            children: [
              new TextRun({
                text:
                  '이미지를 불러올 수 없습니다.',
                size: 20,
              }),
            ],
          }),
        ];

    rows.push(new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        margins: { top: 140, bottom: 140, left: 160, right: 160 },
        children: [
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `결과 ${String(index + 1).padStart(2, '0')}`, bold: true, size: 23, color: '176B52' }),
              new TextRun({ text: `    ${safeText(item.videoName, '영상명 없음')}`, bold: true, size: 22, color: '24313A' }),
            ],
          }),
          ...imageChildren,
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({ text: '영상 구간  ', bold: true, size: 19, color: '176B52' }),
              new TextRun({ text: buildSceneTime(item), size: 19 }),
              new TextRun({ text: '    캡처 시점  ', bold: true, size: 19, color: '176B52' }),
              new TextRun({ text: formatPlaybackTime(item.pauseTime), size: 19 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 70 },
            children: [
              new TextRun({ text: '유사도  ', bold: true, size: 19, color: '176B52' }),
              new TextRun({ text: formatSimilarity(item.similarity), size: 19 }),
              new TextRun({ text: '    센서 ID  ', bold: true, size: 19, color: '176B52' }),
              new TextRun({ text: safeText(item.sensorId), size: 19 }),
            ],
          }),
        ],
      })],
    }));
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'C8D1DC',
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'C8D1DC',
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'C8D1DC',
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'C8D1DC',
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: 'C8D1DC',
      },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
  });
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
  const sceneTable = await buildWordSceneTable(report);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { before: 80, after: 40 },
            border: { bottom: { color: '176B52', space: 8, style: BorderStyle.SINGLE, size: 18 } },
            children: [
              new TextRun({ text: 'VIXSearch', bold: true, size: 34, color: '176B52' }),
              new TextRun({ text: '                                      SEARCH RESULT REPORT', bold: true, size: 18, color: '52616B' }),
            ],
          }),
        
          new Paragraph({
            children: [new TextRun({ text: safeText(report.title, '검색 결과 보고서'), bold: true, size: 30, color: '24313A' })],
            spacing: {
              before: 140,
              after: 140,
            },
          }),
        
          buildInfoTable(report),
        
          paragraphDivider(),
        
          new Paragraph({
            children: [
              new TextRun({
                text: '검색 개요',
                bold: true,
                size: 24,
                color: '176B52',
              }),
            ],
          }),
        
          new Paragraph({ spacing: { after: 70 } }),

          buildSearchOverviewTable(report),
        
          paragraphDivider(),
        
          new Paragraph({ children: [new TextRun({ text: '검색 결과 장면', bold: true, size: 24, color: '176B52' })], spacing: { after: 100 } }),

          sceneTable,
        
          paragraphDivider(),
        
          new Paragraph({
            children: [
              new TextRun({
                text: '분석 요약',
                bold: true,
                size: 24,
                color: '176B52',
              }),
            ],
          }),
        
          new Paragraph({
            spacing: {
              before: 80,
            },
            children: [
              new TextRun({
                text: safeText(
                  report.description ||
                    report.content,
                  '-',
                ),
                size: 22,
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 260 }, border: { top: { color: 'D7E2DD', style: BorderStyle.SINGLE, size: 6, space: 8 } }, children: [
            new TextRun({ text: '본 보고서는 VIXSearch 검색 결과를 기반으로 자동 생성되었습니다.', size: 17, color: '6B7780' }),
          ] }),
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
  x = 110,
  maxWidth = 420,
): Promise<{
  page: PDFPage;
  y: number;
}> {
  const image = await fetchRemoteImage(imageUrl);
  if (!image) {
    return { page, y };
  }

  try {
    const embedded = image.extension === 'png'
      ? await pdfDoc.embedPng(image.bytes)
      : await pdfDoc.embedJpg(image.bytes);
    const scaled = embedded.scale(
      Math.min(
        1,
        maxWidth / embedded.width,
      ),
    );

    let nextPage = page;
    let nextY = y;
    if (nextY - scaled.height < 70) {
      nextPage = pdfDoc.addPage([595.28, 841.89]);
      nextY = 790;
    }

    nextPage.drawImage(
      embedded,
      {
        x,
        y: nextY - scaled.height,
        width: scaled.width,
        height: scaled.height,
      },
    );

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
        console.info(`[api/reports] Loaded ${kind} PDF font: ${candidate}`);
        cachedPdfFontBytes = { ...(cachedPdfFontBytes || {}), [kind]: bytes };
        return bytes;
      } catch {
        continue;
      }
    }

    console.warn(
      `[api/reports] No ${kind} CJK PDF font found. Candidates: ${PDF_FONT_CANDIDATES[kind].join(', ')}`,
    );

    cachedPdfFontBytes = { ...(cachedPdfFontBytes || {}), [kind]: null };
    return null;
  };

  const regularFontBytes = await loadFontBytes('regular');
  const boldFontBytes = await loadFontBytes('bold');
  let regularFont: PDFFont;
  let boldFont: PDFFont;

  if (!regularFontBytes) {
    throw new Error(
      `No CJK regular font found for PDF generation. Checked: ${PDF_FONT_CANDIDATES.regular.join(', ')}`,
    );
  }
  
  try {
    regularFont = await pdfDoc.embedFont(regularFontBytes, { subset: true });
  
    // Bold 폰트가 없으면 Regular 폰트를 Bold 대체용으로 사용
    boldFont = boldFontBytes
      ? await pdfDoc.embedFont(boldFontBytes, { subset: true })
      : regularFont;
  } catch (error) {
    throw new Error(
      `Failed to embed CJK PDF font: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let page = pdfDoc.addPage([595.28, 841.89]);
  let y = 790;
  const left = 48;
  const maxWidth = 500;
  page.drawText('VIXSearch', {
    x: left,
    y,
    size: 22,
    font: boldFont,
    color: rgb(0.09, 0.42, 0.32),
  });
  page.drawText('SEARCH RESULT REPORT', {
    x: 400, y: y + 3, size: 9.5, font: boldFont, color: rgb(0.32, 0.38, 0.42),
  });
  y -= 18;
  page.drawLine({ start: { x: left, y }, end: { x: 547, y }, thickness: 2.5, color: rgb(0.09, 0.42, 0.32) });
  y -= 34;

  ({ page, y } = drawWrappedText(
    pdfDoc,
    page,
    safeText(
      report.title,
      '검색 보고서',
    ),
    boldFont,
    17,
    left,
    y,
    maxWidth,
    18,
  ));
  y -= 8;

  const infoRows = [
    `문서번호  ${buildDocumentNumber(report)}     작성자  ${safeText(report.author, 'VSS 시스템')}`,
    `생성일시  ${formatDateTime(report.createdAt)}     검색 결과  ${report.items.length}건`,
  ];
  for (const row of infoRows) {
    ({ page, y } = drawWrappedText(pdfDoc, page, row, regularFont, 9.5, left + 10, y, 480, 15));
  }

  y -= 10;
  drawDivider(page, y);
  y -= 28;

  ({ page, y } = drawWrappedText(pdfDoc, page, '검색 개요', boldFont, 12, left, y, maxWidth, 16));
  y -= 7;

  const overviewRows = [
    ['검색어', buildReportQuestion(report)],
    [
      '검색 대상',
      report.items
        .map((item) => safeText(item.videoName))
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(', ') || '-',
    ],
  ];

  for (const [label, value] of overviewRows) {
    const rowTop = y + 5;
    page.drawRectangle({
      x: left,
      y: rowTop - 19,
      width: 92,
      height: 22,
      color: rgb(0.91, 0.96, 0.94),
    });
    page.drawText(label, {
      x: left + 9,
      y: rowTop - 13,
      size: 9.5,
      font: boldFont,
      color: rgb(0.09, 0.42, 0.32),
    });
    ({ page, y } = drawWrappedText(
      pdfDoc,
      page,
      value,
      regularFont,
      9.5,
      left + 104,
      rowTop - 13,
      395,
      13,
    ));
    y = Math.min(y, rowTop - 22);
  }
  y -= 16;
  drawDivider(page, y);
  y -= 28;
  y -= 8;

  ({ page, y } = drawWrappedText(pdfDoc, page, '검색 결과 장면', boldFont, 12, left, y, maxWidth, 16));
  y -= 8;

  for (const [index, item] of report.items.entries()) {
    if (y < 390) {
      page =
        pdfDoc.addPage(
          [595.28, 841.89],
        );
      y = 790;
    }

    page.drawRectangle({ x: left, y: y - 4, width: 499, height: 24, color: rgb(0.91, 0.96, 0.94) });
    page.drawText(`결과 ${String(index + 1).padStart(2, '0')}   ${safeText(item.videoName, '영상명 없음')}`, {
      x: left + 10, y: y + 3, size: 10.5, font: boldFont, color: rgb(0.09, 0.42, 0.32),
    });
    y -= 34;

    const imageResult = await drawImageBlock(
      pdfDoc,
      page,
      item.screenshotUrl,
      y,
      left + 40,
      420,
    );

    page = imageResult.page;
    y = imageResult.y - 4;

    ({ page, y } = drawWrappedText(pdfDoc, page, `영상 구간  ${buildSceneTime(item)}     캡처 시점  ${formatPlaybackTime(item.pauseTime)}`, regularFont, 9.5, left + 10, y, 480, 14));
    ({ page, y } = drawWrappedText(pdfDoc, page, `유사도  ${formatSimilarity(item.similarity)}     센서 ID  ${safeText(item.sensorId)}`, regularFont, 9.5, left + 10, y, 480, 14));
    drawDivider(page, y);
    y -= 16;
  }

  y -= 12;

  ({ page, y } = drawWrappedText(
    pdfDoc,
    page,
    '분석 요약',
    boldFont,
    12,
    left,
    y,
    maxWidth,
    16,
  ));

  y -= 6;

  ({ page, y } = drawWrappedText(
    pdfDoc,
    page,
    safeText(
      report.description ||
        report.content,
      '-',
    ),
    regularFont,
    10.5,
    left,
    y,
    maxWidth,
    15,
  ));

  const pages = pdfDoc.getPages();
  pages.forEach((reportPage, index) => {
    reportPage.drawLine({
      start: { x: 48, y: 38 }, end: { x: 547, y: 38 }, thickness: 0.5,
      color: rgb(0.82, 0.87, 0.85),
    });
    reportPage.drawText('VIXSearch 검색 결과 기반 자동 생성 보고서', {
      x: 48, y: 23, size: 7.5, font: regularFont, color: rgb(0.42, 0.47, 0.50),
    });
    reportPage.drawText(`${index + 1} / ${pages.length}`, {
      x: 515, y: 23, size: 7.5, font: regularFont, color: rgb(0.42, 0.47, 0.50),
    });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { spawn } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

const PDF_FONT_CANDIDATES = {
  regular: [
    // standalone server 실행 위치가 /repo일 때
    path.join(
      process.cwd(),
      "apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf",
    ),

    // standalone app 내부에서 실행 위치가 app root일 때
    path.join(process.cwd(), "assets/fonts/NotoSansCJKkr-Regular.otf"),

    // Dockerfile에서 시스템 폰트 경로로 복사한 경우
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",

    // apt fonts-noto-cjk 설치 시 생성될 수 있는 경로
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  ],

  bold: [
    path.join(
      process.cwd(),
      "apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Bold.otf",
    ),
    path.join(process.cwd(), "assets/fonts/NotoSansCJKkr-Bold.otf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Bold.otf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",

    // Bold 폰트가 없을 경우 Regular라도 사용
    path.join(
      process.cwd(),
      "apps/nv-metropolis-bp-vss-ui/assets/fonts/NotoSansCJKkr-Regular.otf",
    ),
    path.join(process.cwd(), "assets/fonts/NotoSansCJKkr-Regular.otf"),
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  ],
};

let cachedPdfFontBytes: {
  regular?: Uint8Array | null;
  bold?: Uint8Array | null;
} | null = null;

export type ReportSceneItem = {
  id: string;
  videoName: string;
  locationName?: string;
  description: string;
  comment?: string;
  query?: string;
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

function safeText(value: string | undefined, fallback = "-"): string {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function buildDocumentNumber(report: ReportPayload): string {
  const date = new Date(report.createdAt);
  const datePart = Number.isNaN(date.getTime())
    ? "UNKNOWN"
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `VIX-${datePart}-${safeText(report.id, "REPORT").slice(0, 8)}`;
}

function buildReportQuestion(
  report: ReportPayload,
  item?: ReportSceneItem,
): string {
  return safeText(
    item?.query || report.query || report.description || report.title,
    "검색어가 제공되지 않았습니다.",
  );
}

function buildLocationName(item: ReportSceneItem): string {
  return safeText(item.locationName || item.videoName, "장소명 없음");
}

function buildAdditionalComment(item: ReportSceneItem): string {
  return safeText(item.comment || item.description);
}

function formatSceneTime(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.max(0, Math.floor(value));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const timeMatch = text.match(/T(\d{2}:\d{2}:\d{2})/);
  return timeMatch?.[1] || text;
}

function buildSceneTimestamp(item: ReportSceneItem): string {
  const startTime = formatSceneTime(item.startTime);
  const endTime = formatSceneTime(item.endTime);
  const pauseTime = formatSceneTime(item.pauseTime);
  const clipRange =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime || endTime;

  if (clipRange && pauseTime) {
    return `${clipRange} (${pauseTime})`;
  }

  if (clipRange) {
    return clipRange;
  }

  if (pauseTime) {
    return `(${pauseTime})`;
  }

  return "-";
}

const SCENE_LABEL_COLUMN_WIDTH_PERCENT = 20;
const SCENE_VALUE_COLUMN_WIDTH_PERCENT = 80;
const SCENE_TABLE_COLUMN_WIDTHS = [
  SCENE_LABEL_COLUMN_WIDTH_PERCENT * 100,
  SCENE_VALUE_COLUMN_WIDTH_PERCENT * 100,
];

function getImageExtension(
  url: string,
  contentType: string | null,
): "jpg" | "png" | null {
  const normalizedType = (contentType || "").toLowerCase();
  if (normalizedType.includes("png")) {
    return "png";
  }
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return "jpg";
  }

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith(".png")) {
    return "png";
  }
  if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) {
    return "jpg";
  }

  return null;
}

async function fetchRemoteImage(
  url: string | undefined,
): Promise<{ bytes: Uint8Array; extension: "jpg" | "png" } | null> {
  const target = String(url || "").trim();
  if (!target) {
    return null;
  }

  if (target.startsWith("data:image/")) {
    const match = target.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);

    if (!match) {
      return null;
    }

    return {
      bytes: new Uint8Array(Buffer.from(match[2], "base64")),
      extension: match[1] === "png" ? "png" : "jpg",
    };
  }

  try {
    const response = await fetch(target);
    if (!response.ok) {
      return null;
    }

    const extension = getImageExtension(
      target,
      response.headers.get("content-type"),
    );
    if (!extension) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, extension };
  } catch {
    return null;
  }
}

function buildInfoTable(report: ReportPayload): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      [
        "문서번호",
        buildDocumentNumber(report),
        "작성자",
        safeText(report.author, "VSS 시스템"),
      ],
      [
        "생성일시",
        formatDateTime(report.createdAt),
        "검색 결과",
        `${report.items.length}건`,
      ],
    ].map(
      ([label1, value1, label2, value2]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: "E8F5EF" },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: label1,
                      bold: true,
                      size: 19,
                      color: "176B52",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value1, size: 19 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              shading: { fill: "E8F5EF" },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: label2,
                      bold: true,
                      size: 19,
                      color: "176B52",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: value2, size: 19 })],
                }),
              ],
            }),
          ],
        }),
    ),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D7E2DD" },
    },
  });
}

async function buildWordSceneTable(report: ReportPayload): Promise<Table> {
  const rows: TableRow[] = [];

  for (const [index, item] of report.items.entries()) {
    const image = await fetchRemoteImage(item.screenshotUrl);

    const imageChildren = image
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
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
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "이미지를 불러올 수 없습니다.",
                size: 20,
              }),
            ],
          }),
        ];

    const labelCell = (label: string): TableCell =>
      new TableCell({
        width: {
          size: SCENE_LABEL_COLUMN_WIDTH_PERCENT,
          type: WidthType.PERCENTAGE,
        },
        shading: { fill: "E8F5EF" },
        margins: { top: 110, bottom: 110, left: 100, right: 100 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 20,
                color: "176B52",
              }),
            ],
          }),
        ],
      });

    const valueCell = (value: string): TableCell =>
      new TableCell({
        width: {
          size: SCENE_VALUE_COLUMN_WIDTH_PERCENT,
          type: WidthType.PERCENTAGE,
        },
        margins: { top: 110, bottom: 110, left: 140, right: 140 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value, size: 20, color: "24313A" })],
          }),
        ],
      });

    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: {
              size: SCENE_LABEL_COLUMN_WIDTH_PERCENT,
              type: WidthType.PERCENTAGE,
            },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "E8F5EF" },
            margins: { top: 120, bottom: 120, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: String(index + 1).padStart(2, "0"),
                    bold: true,
                    size: 30,
                    color: "176B52",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: {
              size: SCENE_VALUE_COLUMN_WIDTH_PERCENT,
              type: WidthType.PERCENTAGE,
            },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: imageChildren,
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [labelCell("발생 시각"), valueCell(buildSceneTimestamp(item))],
      }),
      new TableRow({
        cantSplit: true,
        children: [labelCell("발생 장소"), valueCell(buildLocationName(item))],
      }),
      new TableRow({
        cantSplit: true,
        children: [labelCell("질의 내용"), valueCell(buildReportQuestion(report, item))],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          labelCell("상세 내용"),
          valueCell(buildAdditionalComment(item)),
        ],
      }),
    );
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    columnWidths: SCENE_TABLE_COLUMN_WIDTHS,
    rows,
    borders: {
      top: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "C8D1DC",
      },
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "C8D1DC",
      },
      left: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "C8D1DC",
      },
      right: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "C8D1DC",
      },
      insideHorizontal: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "C8D1DC",
      },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "C8D1DC" },
    },
  });
}

function buildReportTitle(report: ReportPayload): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 0, after: 140 },
    children: [
      new TextRun({
        text: safeText(report.title, "검색 결과 보고서"),
        bold: true,
        size: 28,
        color: "52616B",
      }),
    ],
  });
}

function buildReportHeader(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            margins: { top: 20, bottom: 100, left: 0, right: 0 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "VIXSearch",
                    bold: true,
                    size: 34,
                    color: "176B52",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 18, color: "176B52" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  });
}

export function createWordFileName(title: string, reportId: string): string {
  const slug =
    title
      .trim()
      .replace(/[^\w\s-가-힣]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50) || "incident_report";

  return `${slug}_${reportId}.docx`;
}

export function createPdfFileName(title: string, reportId: string): string {
  const slug =
    title
      .trim()
      .replace(/[^\w\s-가-힣]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 50) || "incident_report";

  return `${slug}_${reportId}.pdf`;
}

export async function convertWordBufferToPdfBuffer(
  wordBuffer: Buffer,
  fileName: string,
): Promise<Buffer> {
  const safeBaseName =
    (fileName || "report.docx")
      .replace(/[^\w\s.-가-힣]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "report.docx";
  const docxFileName = safeBaseName.toLowerCase().endsWith(".docx")
    ? safeBaseName
    : `${safeBaseName}.docx`;

  const workDir = await mkdtemp(path.join(tmpdir(), "vss-report-"));
  const profileDir = path.join(workDir, "libreoffice-profile");
  const inputPath = path.join(workDir, docxFileName);
  const outputPath = path.join(
    workDir,
    docxFileName.replace(/\.docx$/i, ".pdf"),
  );

  try {
    await mkdir(profileDir, { recursive: true });
    await writeFile(inputPath, wordBuffer);

    await new Promise<void>((resolve, reject) => {
      const command = spawn(
        "soffice",
        [
          "--headless",
          "--nologo",
          "--nodefault",
          "--nofirststartwizard",
          `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
          "--convert-to",
          "pdf:writer_pdf_Export",
          "--outdir",
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

      let stderr = "";
      let stdout = "";

      command.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      command.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      command.on("error", (error) => {
        reject(error);
      });
      command.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            (stderr || stdout || `soffice exited with code ${code}`).trim(),
          ),
        );
      });
    });

    return await readFile(outputPath);
  } catch (error) {
    throw new Error(
      `Failed to convert Word to PDF with local LibreOffice: ${String((error as Error)?.message || error)}`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function buildAccidentReportWordBuffer(
  report: ReportPayload,
): Promise<Buffer> {
  const sceneTable = await buildWordSceneTable(report);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 360,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          buildReportTitle(report),

          buildReportHeader(),

          new Paragraph({ spacing: { after: 120 } }),

          buildInfoTable(report),

          new Paragraph({ spacing: { before: 160, after: 80 } }),

          sceneTable,

          new Paragraph({
            spacing: { before: 260 },
            border: {
              top: {
                color: "D7E2DD",
                style: BorderStyle.SINGLE,
                size: 6,
                space: 8,
              },
            },
            children: [
              new TextRun({
                text: "본 보고서는 VIXSearch 검색 결과를 기반으로 자동 생성되었습니다.",
                size: 17,
                color: "6B7780",
              }),
            ],
          }),
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
  const lines = wrapPdfText(text, font, size, maxWidth);

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

function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];

  for (const rawLine of text.split("\n")) {
    const tokens = rawLine.includes(" ")
      ? rawLine.split(/(\s+)/).filter((token) => token.length > 0)
      : Array.from(rawLine);
    if (tokens.length === 0) {
      lines.push("");
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

  return lines;
}

function drawDivider(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: 48, y },
    end: { x: 547, y },
    thickness: 1,
    color: rgb(0.75, 0.79, 0.84),
  });
}

export async function buildAccidentReportPdfBuffer(
  report: ReportPayload,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const loadFontBytes = async (
    kind: "regular" | "bold",
  ): Promise<Uint8Array | null> => {
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
      `[api/reports] No ${kind} CJK PDF font found. Candidates: ${PDF_FONT_CANDIDATES[kind].join(", ")}`,
    );

    cachedPdfFontBytes = { ...(cachedPdfFontBytes || {}), [kind]: null };
    return null;
  };

  const regularFontBytes = await loadFontBytes("regular");
  const boldFontBytes = await loadFontBytes("bold");
  let regularFont: PDFFont;
  let boldFont: PDFFont;

  if (!regularFontBytes) {
    throw new Error(
      `No CJK regular font found for PDF generation. Checked: ${PDF_FONT_CANDIDATES.regular.join(", ")}`,
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
  let y = 812;
  const left = 48;
  const headerTitle = safeText(report.title, "검색 결과 보고서");
  let headerTitleSize = 14;
  while (
    headerTitleSize > 9 &&
    boldFont.widthOfTextAtSize(headerTitle, headerTitleSize) > 499
  ) {
    headerTitleSize -= 0.5;
  }
  const headerTitleWidth = boldFont.widthOfTextAtSize(
    headerTitle,
    headerTitleSize,
  );
  page.drawText(headerTitle, {
    x: left + (499 - headerTitleWidth) / 2,
    y,
    size: headerTitleSize,
    font: boldFont,
    color: rgb(0.32, 0.38, 0.42),
  });
  y -= 34;
  page.drawText("VIXSearch", {
    x: left,
    y,
    size: 22,
    font: boldFont,
    color: rgb(0.09, 0.42, 0.32),
  });
  y -= 18;
  page.drawLine({
    start: { x: left, y },
    end: { x: 547, y },
    thickness: 2.5,
    color: rgb(0.09, 0.42, 0.32),
  });
  y -= 30;

  const infoRows = [
    `문서번호  ${buildDocumentNumber(report)}     작성자  ${safeText(report.author, "VSS 시스템")}`,
    `생성일시  ${formatDateTime(report.createdAt)}     검색 결과  ${report.items.length}건`,
  ];
  for (const row of infoRows) {
    ({ page, y } = drawWrappedText(
      pdfDoc,
      page,
      row,
      regularFont,
      9.5,
      left + 10,
      y,
      480,
      15,
    ));
  }

  y -= 10;
  drawDivider(page, y);
  y -= 24;

  for (const [index, item] of report.items.entries()) {
    const tableWidth = 499;
    const idWidth = tableWidth * (SCENE_LABEL_COLUMN_WIDTH_PERCENT / 100);
    const valueWidth = tableWidth - idWidth;
    const imageRowHeight = 220;
    const textSize = 9.5;
    const lineHeight = 13;
    const detailRows = [
      { label: "발생 시각", value: buildSceneTimestamp(item) },
      { label: "발생 장소", value: buildLocationName(item) },
      { label: "질의 내용", value: buildReportQuestion(report, item) },
      { label: "상세 내용", value: buildAdditionalComment(item) },
    ].map((detail) => {
      const lines = wrapPdfText(
        detail.value,
        regularFont,
        textSize,
        valueWidth - 20,
      );
      return {
        ...detail,
        lines,
        height: Math.max(30, lines.length * lineHeight + 12),
      };
    });
    const tableHeight =
      imageRowHeight + detailRows.reduce((sum, row) => sum + row.height, 0);

    if (y - tableHeight < 55) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 790;
    }

    const borderColor = rgb(0.78, 0.82, 0.86);
    const labelColor = rgb(0.91, 0.96, 0.94);
    page.drawRectangle({
      x: left,
      y: y - imageRowHeight,
      width: idWidth,
      height: imageRowHeight,
      color: labelColor,
      borderColor,
      borderWidth: 0.8,
    });
    page.drawRectangle({
      x: left + idWidth,
      y: y - imageRowHeight,
      width: valueWidth,
      height: imageRowHeight,
      borderColor,
      borderWidth: 0.8,
    });

    const numberText = String(index + 1).padStart(2, "0");
    const numberSize = 17;
    const numberWidth = boldFont.widthOfTextAtSize(numberText, numberSize);
    page.drawText(numberText, {
      x: left + (idWidth - numberWidth) / 2,
      y: y - imageRowHeight / 2 - numberSize / 3,
      size: numberSize,
      font: boldFont,
      color: rgb(0.09, 0.42, 0.32),
    });

    const image = await fetchRemoteImage(item.screenshotUrl);
    let imageDrawn = false;
    if (image) {
      try {
        const embedded =
          image.extension === "png"
            ? await pdfDoc.embedPng(image.bytes)
            : await pdfDoc.embedJpg(image.bytes);
        const scale = Math.min(
          (valueWidth - 20) / embedded.width,
          (imageRowHeight - 20) / embedded.height,
        );
        const imageWidth = embedded.width * scale;
        const imageHeight = embedded.height * scale;
        page.drawImage(embedded, {
          x: left + idWidth + (valueWidth - imageWidth) / 2,
          y: y - (imageRowHeight + imageHeight) / 2,
          width: imageWidth,
          height: imageHeight,
        });
        imageDrawn = true;
      } catch {
        imageDrawn = false;
      }
    }
    if (!imageDrawn) {
      const placeholder = "이미지를 불러올 수 없습니다.";
      const placeholderWidth = regularFont.widthOfTextAtSize(placeholder, 9.5);
      page.drawText(placeholder, {
        x: left + idWidth + (valueWidth - placeholderWidth) / 2,
        y: y - imageRowHeight / 2,
        size: 9.5,
        font: regularFont,
        color: rgb(0.42, 0.47, 0.5),
      });
    }

    let rowTop = y - imageRowHeight;
    for (const detail of detailRows) {
      page.drawRectangle({
        x: left,
        y: rowTop - detail.height,
        width: idWidth,
        height: detail.height,
        color: labelColor,
        borderColor,
        borderWidth: 0.8,
      });
      page.drawRectangle({
        x: left + idWidth,
        y: rowTop - detail.height,
        width: valueWidth,
        height: detail.height,
        borderColor,
        borderWidth: 0.8,
      });

      const labelWidth = boldFont.widthOfTextAtSize(detail.label, textSize);
      page.drawText(detail.label, {
        x: left + (idWidth - labelWidth) / 2,
        y: rowTop - detail.height / 2 - textSize / 3,
        size: textSize,
        font: boldFont,
        color: rgb(0.09, 0.42, 0.32),
      });
      detail.lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: left + idWidth + 10,
          y: rowTop - 12 - lineIndex * lineHeight,
          size: textSize,
          font: regularFont,
          color: rgb(0.15, 0.18, 0.22),
        });
      });
      rowTop -= detail.height;
    }

    y = rowTop - 16;
  }

  const pages = pdfDoc.getPages();
  pages.forEach((reportPage, index) => {
    reportPage.drawLine({
      start: { x: 48, y: 38 },
      end: { x: 547, y: 38 },
      thickness: 0.5,
      color: rgb(0.82, 0.87, 0.85),
    });
    reportPage.drawText("VIXSearch 검색 결과 기반 자동 생성 보고서", {
      x: 48,
      y: 23,
      size: 7.5,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.5),
    });
    reportPage.drawText(`${index + 1} / ${pages.length}`, {
      x: 515,
      y: 23,
      size: 7.5,
      font: regularFont,
      color: rgb(0.42, 0.47, 0.5),
    });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
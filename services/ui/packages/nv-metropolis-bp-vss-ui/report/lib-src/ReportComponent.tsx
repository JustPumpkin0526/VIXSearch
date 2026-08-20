import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

export type ReportListItem = {
  id: string;
  title: string;
  createdAt: string;
  author?: string;
  query?: string;
  description?: string;
  content?: string;
  wordCount?: number;
  wordFileUrl?: string;
  wordFileName?: string;
  pdfFileUrl?: string;
  pdfFileName?: string;
  items?: ReportSceneItem[];
};

export type ReportSceneItem = {
  id: string;
  videoName: string;
  description: string;
  startTime: string;
  endTime: string;
  sensorId: string;
  similarity: number;
  pauseTime?: number;
  screenshotUrl: string;
};

export interface ReportComponentProps {
  reports?: ReportListItem[];
}

const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';
const REPORTS_UPDATED_EVENT = 'vss:reports-updated';
const EMPTY_REPORTS: ReportListItem[] = [];

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

function buildCanonicalWordFileUrl(reportId: string): string {
  return `/api/reports/word/${encodeURIComponent(reportId)}`;
}

function buildCanonicalPdfFileUrl(reportId: string): string {
  return `/api/reports/pdf/${encodeURIComponent(reportId)}`;
}

function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR');
}

function normalizeStoredReports(input: unknown): ReportListItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((report): ReportListItem | null => {
      if (!report || typeof report !== 'object') {
        return null;
      }

      const candidate = report as {
        id?: unknown;
        title?: unknown;
        createdAt?: unknown;
        author?: unknown;
        query?: unknown;
        description?: unknown;
        content?: unknown;
        wordCount?: unknown;
        wordFileUrl?: unknown;
        wordFileName?: unknown;
        pdfFileUrl?: unknown;
        pdfFileName?: unknown;
        fileUrl?: unknown;
        fileName?: unknown;
        items?: Array<{
          id?: unknown;
          videoName?: unknown;
          description?: unknown;
          startTime?: unknown;
          endTime?: unknown;
          sensorId?: unknown;
          similarity?: unknown;
          pauseTime?: unknown;
          screenshotUrl?: unknown;
        }>;
      };

      const reportId = typeof candidate.id === 'string' ? candidate.id : `report-${Date.now()}`;

      return {
        id: reportId,
        title: typeof candidate.title === 'string' ? candidate.title : '보고서',
        createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
        author: typeof candidate.author === 'string' ? candidate.author : '',
        query: typeof candidate.query === 'string' ? candidate.query : '',
        description: typeof candidate.description === 'string' ? candidate.description : '',
        content: typeof candidate.content === 'string' ? candidate.content : '',
        wordCount: typeof candidate.wordCount === 'number' ? candidate.wordCount : 0,
        wordFileUrl: buildCanonicalWordFileUrl(reportId),
        wordFileName:
          typeof candidate.wordFileName === 'string'
            ? candidate.wordFileName
            : typeof candidate.fileName === 'string'
              ? candidate.fileName
              : '',
        pdfFileUrl: buildCanonicalPdfFileUrl(reportId),
        pdfFileName: typeof candidate.pdfFileName === 'string' ? candidate.pdfFileName : '',
        items: Array.isArray(candidate.items)
          ? candidate.items.map((item, index) => ({
              id: typeof item?.id === 'string' ? item.id : `${reportId}-${index}`,
              videoName: typeof item?.videoName === 'string' ? item.videoName : '검색 결과',
              description: typeof item?.description === 'string' ? item.description : '',
              startTime: typeof item?.startTime === 'string' ? item.startTime : '',
              endTime: typeof item?.endTime === 'string' ? item.endTime : '',
              sensorId: typeof item?.sensorId === 'string' ? item.sensorId : '',
              similarity: typeof item?.similarity === 'number' ? item.similarity : 0,
              screenshotUrl: typeof item?.screenshotUrl === 'string' ? item.screenshotUrl : '',
              pauseTime:
                typeof item?.pauseTime === 'number'
                  ? item.pauseTime
                  : undefined,
            }))
          : [],
          
      };
    })
    .filter((report): report is ReportListItem => report !== null);
}

async function loadReportsFromApi(): Promise<ReportListItem[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const token = window.localStorage.getItem('vss.auth.token');
  if (!token) {
    return [];
  }

  const response = await fetch('/api/reports', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load reports: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeStoredReports(payload?.reports);
}

async function deleteReportFromApi(reportId: string): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const token = window.localStorage.getItem('vss.auth.token');
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`/api/reports?id=${encodeURIComponent(reportId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete report: ${response.status}`);
  }
}

export const ReportComponent: React.FC<ReportComponentProps> = ({ reports }) => {
  const pendingSelectReportIdRef = React.useRef<string | null>(null);
  const initialReports = reports ?? EMPTY_REPORTS;
  const pdfCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pdfPreviewContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pdfDocumentRef = React.useRef<any>(null);
  const pdfRenderTaskRef = React.useRef<any>(null);
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [listPage, setListPage] = useState(1);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [storedReports, setStoredReports] = useState<ReportListItem[]>(initialReports);
  const [pdfPreviewData, setPdfPreviewData] = useState<Uint8Array | null>(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const [pdfDocumentVersion, setPdfDocumentVersion] = useState(0);
  const [isPdfPreviewLoading, setIsPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [openReportMenuId, setOpenReportMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (initialReports.length > 0) {
      setStoredReports(initialReports);
    }
  }, [initialReports]);

  useEffect(() => {
    if (initialReports.length > 0) {
      return undefined;
    }

    let cancelled = false;

    const syncReports = async () => {
      try {
        const nextReports = await loadReportsFromApi();

        if (!cancelled) {
          setStoredReports(nextReports);
        
          const pendingReportId = pendingSelectReportIdRef.current;
        
          if (
            pendingReportId &&
            nextReports.some((report) => report.id === pendingReportId)
          ) {
            setSelectedReportId(pendingReportId);
            pendingSelectReportIdRef.current = null;
            setReportSearchQuery('');
            setSortBy('date');
            setListPage(1);
          }
        }
      } catch (error) {
        console.warn('Failed to load reports from DB:', error);
      }
    };

    syncReports();

    if (typeof window === 'undefined') {
      return undefined;
    }

    window.addEventListener(REPORTS_UPDATED_EVENT, syncReports);
    window.addEventListener('storage', syncReports);
    return () => {
      cancelled = true;
      window.removeEventListener(REPORTS_UPDATED_EVENT, syncReports);
      window.removeEventListener('storage', syncReports);
    };
  }, [initialReports]);

  useEffect(() => {
    if (storedReports.length === 0) {
      setSelectedReportId(null);
      return;
    }
  
    const pendingReportId = pendingSelectReportIdRef.current;
  
    if (
      pendingReportId &&
      storedReports.some((report) => report.id === pendingReportId)
    ) {
      setSelectedReportId(pendingReportId);
      pendingSelectReportIdRef.current = null;
      return;
    }
  
    setSelectedReportId((current) => {
      if (current && storedReports.some((report) => report.id === current)) {
        return current;
      }
    
      return storedReports[0].id;
    });
  }, [storedReports]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleOpenReportTab = (event: Event) => {
      const customEvent = event as CustomEvent<{
        tabId?: string;
        reportId?: string;
      }>;

      const reportId =
        typeof customEvent.detail?.reportId === 'string'
          ? customEvent.detail.reportId
          : '';

      if (!reportId) {
        return;
      }

      pendingSelectReportIdRef.current = reportId;

      setReportSearchQuery('');
      setSortBy('date');
      setListPage(1);
      setSelectedReportId(reportId);
    };

    window.addEventListener(
      OPEN_REPORT_TAB_EVENT,
      handleOpenReportTab as EventListener,
    );

    return () => {
      window.removeEventListener(
        OPEN_REPORT_TAB_EVENT,
        handleOpenReportTab as EventListener,
      );
    };
  }, []);

  const normalizedQuery = reportSearchQuery.trim().toLowerCase();
  const filteredReports = useMemo(() => {
    const sourceReports = normalizedQuery
      ? storedReports.filter((report) => report.title.toLowerCase().includes(normalizedQuery))
      : [...storedReports];

    sourceReports.sort((left, right) => {
      if (sortBy === 'title') {
        return left.title.localeCompare(right.title, 'ko');
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return sourceReports;
  }, [normalizedQuery, sortBy, storedReports]);

  useEffect(() => {
    setListPage(1);
  }, [normalizedQuery, sortBy]);

  const reportsPerPage = 8;
  const totalListPages = Math.max(1, Math.ceil(filteredReports.length / reportsPerPage));

  const visibleReports = useMemo(() => {
    const startIndex = (listPage - 1) * reportsPerPage;
    return filteredReports.slice(startIndex, startIndex + reportsPerPage);
  }, [filteredReports, listPage]);
  const selectedReport = useMemo(
    () => storedReports.find((report) => report.id === selectedReportId) ?? null,
    [selectedReportId, storedReports],
  );

  useEffect(() => {
    setPdfCurrentPage(1);
    setPdfTotalPages(1);
    setPdfDocumentVersion(0);
    setPdfPreviewError(null);
    setOpenReportMenuId(null);
  }, [selectedReport?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || openReportMenuId === null) {
      return undefined;
    }

    const handleWindowClick = () => {
      setOpenReportMenuId(null);
    };

    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [openReportMenuId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !selectedReport?.pdfFileUrl) {
      setPdfPreviewData(null);
      setIsPdfPreviewLoading(false);
      setPdfPreviewError(null);
      return undefined;
    }

    let isActive = true;

    const loadPdfPreview = async () => {
      setIsPdfPreviewLoading(true);
      setPdfPreviewError(null);
      try {
        const token = window.localStorage.getItem('vss.auth.token');
        if (!token) {
          throw new Error('Missing auth token');
        }

        const response = await fetch(selectedReport.pdfFileUrl!, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load PDF preview: ${response.status}`);
        }

        const pdfBuffer = await response.arrayBuffer();
        if (isActive) {
          setPdfPreviewData(new Uint8Array(pdfBuffer));
        }
      } catch (error) {
        console.warn('Failed to load PDF preview:', error);
        if (isActive) {
          setPdfPreviewData(null);
          setPdfPreviewError('PDF 파일을 불러오지 못했습니다.');
        }
      } finally {
        if (isActive) {
          setIsPdfPreviewLoading(false);
        }
      }
    };

    loadPdfPreview();

    return () => {
      isActive = false;
    };
  }, [selectedReport]);

  useEffect(() => {
    if (!pdfPreviewData) {
      if (pdfDocumentRef.current && typeof pdfDocumentRef.current.destroy === 'function') {
        void pdfDocumentRef.current.destroy();
      }
      pdfDocumentRef.current = null;
      setPdfTotalPages(1);
      setPdfDocumentVersion(0);
      return undefined;
    }

    let isActive = true;
    let nextPdfDocument: any = null;
    const loadingTask = getDocument({
      data: pdfPreviewData,
    });

    const loadDocument = async () => {
      try {
        nextPdfDocument = await loadingTask.promise;
        if (!isActive) {
          if (typeof nextPdfDocument.destroy === 'function') {
            await nextPdfDocument.destroy();
          }
          return;
        }

        if (pdfDocumentRef.current && typeof pdfDocumentRef.current.destroy === 'function') {
          await pdfDocumentRef.current.destroy();
        }

        pdfDocumentRef.current = nextPdfDocument;
        const nextPageCount = Math.max(nextPdfDocument.numPages || 1, 1);
        setPdfTotalPages(nextPageCount);
        setPdfDocumentVersion((current) => current + 1);
        setPdfCurrentPage((current) => Math.min(Math.max(current, 1), nextPageCount));
        setPdfPreviewError(null);
      } catch (error) {
        console.warn('Failed to parse PDF preview:', error);
        if (isActive) {
          pdfDocumentRef.current = null;
          setPdfPreviewData(null);
          setPdfTotalPages(1);
          setPdfDocumentVersion(0);
          setPdfPreviewError('PDF 미리보기 데이터를 해석하지 못했습니다.');
        }
      }
    };

    void loadDocument();

    return () => {
      isActive = false;
      if (pdfRenderTaskRef.current && typeof pdfRenderTaskRef.current.cancel === 'function') {
        pdfRenderTaskRef.current.cancel();
        pdfRenderTaskRef.current = null;
      }
      void loadingTask.destroy();
      if (nextPdfDocument && pdfDocumentRef.current === nextPdfDocument) {
        pdfDocumentRef.current = null;
        if (typeof nextPdfDocument.destroy === 'function') {
          void nextPdfDocument.destroy();
        }
      }
    };
  }, [pdfPreviewData]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pdfPreviewData || !pdfDocumentRef.current) {
      return undefined;
    }

    let isActive = true;
    let resizeObserver: ResizeObserver | null = null;

    const renderCurrentPage = async () => {
      const pdfDocument = pdfDocumentRef.current;
      const canvas = pdfCanvasRef.current;
      const container = pdfPreviewContainerRef.current;
      if (!pdfDocument || !canvas || !container) {
        return;
      }

      if (pdfRenderTaskRef.current && typeof pdfRenderTaskRef.current.cancel === 'function') {
        pdfRenderTaskRef.current.cancel();
        pdfRenderTaskRef.current = null;
      }

      try {
        const page = await pdfDocument.getPage(pdfCurrentPage);
        if (!isActive) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.max(container.clientWidth - 32, 160);
        const maxHeight = Math.max(container.clientHeight - 32, 220);
        const scale = Math.max(Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height), 0.1);
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        const context = canvas.getContext('2d');
        if (!context) {
          return;
        }

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderTask = page.render({
          canvasContext: context,
          viewport,
        });
        pdfRenderTaskRef.current = renderTask;
        await renderTask.promise;
        if (isActive) {
          setPdfPreviewError(null);
        }
      } catch (error) {
        if ((error as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn('Failed to render PDF preview page:', error);
          if (isActive) {
            setPdfPreviewError('PDF 페이지를 렌더링하지 못했습니다.');
          }
        }
      } finally {
        if (pdfRenderTaskRef.current) {
          pdfRenderTaskRef.current = null;
        }
      }
    };

    const scheduleRender = () => {
      void renderCurrentPage();
    };

    scheduleRender();
    window.addEventListener('resize', scheduleRender);
    if (typeof ResizeObserver !== 'undefined' && pdfPreviewContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        scheduleRender();
      });
      resizeObserver.observe(pdfPreviewContainerRef.current);
    }

    return () => {
      isActive = false;
      window.removeEventListener('resize', scheduleRender);
      resizeObserver?.disconnect();
      if (pdfRenderTaskRef.current && typeof pdfRenderTaskRef.current.cancel === 'function') {
        pdfRenderTaskRef.current.cancel();
        pdfRenderTaskRef.current = null;
      }
    };
  }, [pdfCurrentPage, pdfPreviewData, pdfDocumentVersion]);

  const downloadReportFile = React.useCallback(async (report: ReportListItem, fileUrl?: string, fileName?: string, fallbackExtension?: string) => {
    if (typeof window === 'undefined' || !fileUrl) {
      return;
    }

    const token = window.localStorage.getItem('vss.auth.token');
    if (!token) {
      return;
    }

    const response = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || `${report.title.replace(/\s+/g, '_') || 'report'}.${fallbackExtension || 'bin'}`;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }, []);

  const handleDownloadWord = React.useCallback(async (report: ReportListItem) => {
    if (!report) {
      return;
    }

    await downloadReportFile(report, report.wordFileUrl, report.wordFileName, 'docx');
  }, [downloadReportFile]);

  const handleDownloadPdf = React.useCallback(async (report: ReportListItem) => {
    if (!report) {
      return;
    }

    await downloadReportFile(report, report.pdfFileUrl, report.pdfFileName, 'pdf');
  }, [downloadReportFile]);

  const handleDeleteReport = React.useCallback(async (report: ReportListItem) => {
    if (!report || typeof window === 'undefined' || isDeletingReport) {
      return;
    }

    const confirmed = window.confirm(`'${report.title}' 보고서를 삭제하시겠습니까?`);
    if (!confirmed) {
      return;
    }

    setIsDeletingReport(true);
    try {
      await deleteReportFromApi(report.id);
      setStoredReports((current) => current.filter((currentReport) => currentReport.id !== report.id));
      setOpenReportMenuId((current) => (current === report.id ? null : current));
      window.dispatchEvent(
        new CustomEvent(
          OPEN_REPORT_TAB_EVENT,
          {
            detail: {
              tabId: 'report',
              reportId: report.id,
            },
          },
        ),
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '보고서를 삭제하지 못했습니다.');
    } finally {
      setIsDeletingReport(false);
    }
  }, [isDeletingReport]);

  const handlePreviewPrevPage = React.useCallback(() => {
    setPdfCurrentPage((current) => Math.max(1, current - 1));
  }, []);

  const handlePreviewNextPage = React.useCallback(() => {
    setPdfCurrentPage((current) => Math.min(pdfTotalPages, current + 1));
  }, [pdfTotalPages]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="min-h-full p-6 lg:p-8">
        <div className="grid min-h-[calc(100vh-10rem)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80">
            <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-neutral-700">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-400/50 bg-green-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-green-700 dark:bg-green-900/20 dark:text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Report Viewer
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
                    {selectedReport?.title || '리포트를 선택하세요'}
                  </p>
                  {selectedReport ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                      <span>{formatCreatedAt(selectedReport.createdAt)}</span>

                      {selectedReport.author ? (
                        <>
                          <span>·</span>
                          <span>{selectedReport.author}</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 페이지 전환 버튼은 미리보기 섹션 하단 중앙으로 이동되었습니다. */}
            </header>

            {!selectedReport ? (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 dark:border-neutral-600 dark:bg-neutral-950/40">
                <div className="text-center">
                  <p className="text-base font-medium text-gray-500 dark:text-neutral-400">리포트를 선택하여 내용을 확인하세요</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-100/80 p-4 shadow-inner dark:border-neutral-700 dark:bg-neutral-950/60">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <div className="mx-auto flex h-full w-full max-w-[1040px] flex-col bg-transparent p-0 shadow-none">
                      {selectedReport.pdfFileUrl ? (
                        <div className="flex h-full min-h-0 flex-col">
                          <div className="mb-3 flex items-center justify-between">
                            {isPdfPreviewLoading ? <span className="text-xs text-gray-500">불러오는 중...</span> : null}
                          </div>
                          {pdfPreviewData && !pdfPreviewError ? (
                            <div
                                  ref={pdfPreviewContainerRef}
                                  className="relative flex h-[min(72vh,960px)] min-h-[540px] w-full items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(243,244,246,0.98))] p-4 dark:bg-neutral-950"
                                >
                                  <canvas
                                    ref={pdfCanvasRef}
                                    aria-label={`${selectedReport.title} PDF 미리보기 ${pdfCurrentPage} 페이지`}
                                    className="max-h-full max-w-full rounded-lg bg-white shadow-[0_18px_48px_rgba(15,23,42,0.16)] dark:bg-white"
                                  />

                                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/80 px-2 py-1 shadow-md dark:bg-neutral-900/80">
                                    <button
                                      type="button"
                                      disabled={!selectedReport?.pdfFileUrl || isPdfPreviewLoading || pdfCurrentPage <= 1}
                                      onClick={handlePreviewPrevPage}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
                                      aria-label="이전 페이지"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                      </svg>
                                    </button>

                                    <span className="min-w-[72px] text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                                      {selectedReport?.pdfFileUrl ? `${pdfCurrentPage} / ${pdfTotalPages}` : '- / -'}
                                    </span>

                                    <button
                                      type="button"
                                      disabled={!selectedReport?.pdfFileUrl || isPdfPreviewLoading || pdfCurrentPage >= pdfTotalPages}
                                      onClick={handlePreviewNextPage}
                                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
                                      aria-label="다음 페이지"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  </div>

                                </div>
                          ) : (
                            <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
                              {pdfPreviewError || 'PDF 미리보기를 불러오지 못했습니다.'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500">
                          미리볼 PDF가 없습니다.
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
                  <span>리포트 미리보기</span>
                  <span>{selectedReport.items?.length ?? 0}개 장면</span>
                </div>
              </>
            )}
          </section>

          <aside className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80">
            <header className="mb-4 border-b border-gray-200 pb-4 dark:border-neutral-700">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-400/50 bg-green-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-green-700 dark:bg-green-900/20 dark:text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Report Library
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-neutral-300">총 {storedReports.length}개의 리포트</p>
            </header>

            <div className="mb-4 space-y-3">
              <label className="sr-only" htmlFor="report-search-input">
                리포트 검색
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="report-search-input"
                  type="text"
                  value={reportSearchQuery}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReportSearchQuery(event.target.value)}
                  placeholder="리포트 검색..."
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pl-10 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-green-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-green-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSortBy('date')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortBy === 'date'
                      ? 'bg-green-600 text-white dark:bg-green-500 dark:text-neutral-950'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  최신순
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('title')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortBy === 'title'
                      ? 'bg-green-600 text-white dark:bg-green-500 dark:text-neutral-950'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  제목순
                </button>
              </div>
              {normalizedQuery ? (
                <p className={`text-xs font-medium ${filteredReports.length === 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {filteredReports.length === 0 ? '검색 결과가 없습니다.' : `${filteredReports.length}개의 보고서를 찾았습니다.`}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto space-y-3">
              {visibleReports.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-transparent px-6 py-8 text-center dark:border-neutral-600">
                  <span className="text-sm font-medium text-gray-500 dark:text-neutral-400">리포트가 없습니다</span>
                </div>
              ) : (
                visibleReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReportId(report.id)}
                    className={`group flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                      selectedReportId === report.id
                        ? 'border-green-400 bg-green-50/70 shadow-sm dark:border-green-400 dark:bg-green-900/10'
                        : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-800/60 dark:hover:border-green-500'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedReportId(report.id);
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-neutral-100">{report.title}</h4>
                      {report.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-neutral-400">{report.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-neutral-400">
                        <span>{formatCreatedAt(report.createdAt)}</span>
                        <span>{report.items?.length ?? 0}개 장면</span>
                      </div>
                    </div>
                    <div className="relative flex items-start">
                      <button
                        type="button"
                        aria-label={`${report.title} 메뉴 열기`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenReportMenuId((current) => (current === report.id ? null : report.id));
                        }}
                        onMouseDown={(event) => {
                          // Prevent parent selection on mousedown (avoid selecting report when opening menu)
                          event.stopPropagation();
                        }}
                        className="rounded-lg p-1.5 text-gray-500 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 focus:opacity-100 focus:outline-none dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-gray-200"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5A1.5 1.5 0 1110 8a1.5 1.5 0 010 3.5zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                        </svg>
                      </button>
                      {openReportMenuId === report.id ? (
                        <div
                          className="absolute right-0 top-9 z-10 min-w-[170px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={!report.wordFileUrl}
                            onClick={async (event) => {
                              event.stopPropagation();
                              await handleDownloadWord(report);
                              setOpenReportMenuId(null);
                            }}
                            className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            Word 다운로드
                          </button>
                          <button
                            type="button"
                            disabled={!report.pdfFileUrl}
                            onClick={async (event) => {
                              event.stopPropagation();
                              await handleDownloadPdf(report);
                              setOpenReportMenuId(null);
                            }}
                            className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            PDF 다운로드
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingReport}
                            onClick={async (event) => {
                              event.stopPropagation();
                              await handleDeleteReport(report);
                            }}
                            className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
                          >
                            {isDeletingReport && selectedReportId === report.id ? '삭제 중...' : '보고서 삭제'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-neutral-700">
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setListPage((current) => Math.max(1, current - 1))}
                  disabled={listPage <= 1}
                  className="rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  〈
                </button>
                <span className="text-sm text-gray-500 dark:text-neutral-400">Page {listPage} / {totalListPages}</span>
                <button
                  type="button"
                  onClick={() => setListPage((current) => Math.min(totalListPages, current + 1))}
                  disabled={listPage >= totalListPages}
                  className="rounded-lg bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  〉
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';

type ReportListItem = {
  id: string;
  title: string;
  createdAt: string;
};

const ReportPlaceholder: React.FC = () => {
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const reports: ReportListItem[] = [];
  const normalizedQuery = reportSearchQuery.trim().toLowerCase();
  const filteredReports = useMemo(() => {
    if (!normalizedQuery) return reports;

    return reports.filter((report) => {
      return report.title.toLowerCase().includes(normalizedQuery);
    });
  }, [normalizedQuery, reports]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex h-full min-h-full flex-col">
        <div className="flex min-h-[640px] flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900">
          <section className="flex min-w-0 basis-[80%] flex-col bg-gray-50 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">Report View</h3>
              </div>
            </div>

            <div className="flex min-h-[60px] items-center justify-end border-b border-gray-200 px-6 dark:border-gray-700">
              <div className="flex items-center justify-end gap-4">
                <button
                  type="button"
                  disabled={!selectedReportId}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white dark:text-gray-900 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300 dark:disabled:bg-gray-600 dark:disabled:text-gray-300 dark:disabled:hover:bg-gray-600">
                  Export Report
                </button>
              </div>
            </div>

            <div className="flex-1 px-6 py-5">
              <div className="h-full">
                {reports.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex min-h-[140px] w-full max-w-[320px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-transparent px-8 py-10 text-center dark:border-gray-600">
                      <span className="text-base font-medium text-gray-500 dark:text-gray-400">No report</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-full border-t border-gray-200 dark:border-gray-700" />
                )}
              </div>
            </div>
          </section>

          <aside className="flex basis-[20%] flex-col border-l border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">Report List</h3>
              </div>
            </div>

            <div className="flex min-h-[60px] flex-col justify-center border-b border-gray-200 px-6 dark:border-gray-700">
              <div className="flex flex-col items-end">
                <label className="sr-only" htmlFor="report-search-input">
                  Search reports
                </label>
                <input
                  id="report-search-input"
                  type="text"
                  value={reportSearchQuery}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReportSearchQuery(event.target.value)}
                  placeholder="Search reports"
                  className="w-[60%] rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500"
                />
                {normalizedQuery ? (
                  filteredReports.length === 0 ? (
                    <p className="mt-2 text-xs font-medium text-red-500 dark:text-red-400">
                      검색 결과가 없습니다.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                      {filteredReports.length}개의 보고서를 찾았습니다.
                    </p>
                  )
                ) : null}
              </div>
            </div>

            <div className="flex-1 px-6 py-5">
              {filteredReports.length === 0 ? (
                <div className="flex h-full min-h-[320px] items-center justify-center">
                  <div className="flex min-h-[120px] w-full max-w-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-transparent px-6 py-8 text-center dark:border-gray-600">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">No reports</span>
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto pt-3">
                  {filteredReports.map((report: ReportListItem) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedReportId(report.id)}
                      className={`flex w-full flex-col border-b px-2 py-3 text-left transition-colors ${
                        selectedReportId === report.id
                          ? 'border-green-500 bg-green-50/50 dark:border-green-400 dark:bg-green-900/10'
                          : 'border-gray-200 hover:bg-gray-100/70 dark:border-gray-700 dark:hover:bg-gray-800/60'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{report.title}</span>
                      <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{report.createdAt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ReportPlaceholder;

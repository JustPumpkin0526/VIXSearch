// SPDX-License-Identifier: MIT
import React from 'react';
import { IconInbox } from '@tabler/icons-react';
import { Whisper, Tooltip } from 'rsuite';
import { SearchData } from '../types';
import { formatTime, parseDateAsLocal } from '../utils/Formatter';

const REPORTS_UPDATED_EVENT = 'vss:reports-updated';
const OPEN_REPORT_TAB_EVENT = 'vss:open-report-tab';

type GeneratedReportItem = {
  id: string;
  title: string;
  createdAt: string;
  query?: string;
  items: Array<{
    id: string;
    videoName: string;
    description: string;
    startTime: string;
    endTime: string;
    sensorId: string;
    similarity: number;
    screenshotUrl: string;
  }>;
};

type ContextMenuState = {
  x: number;
  y: number;
  targetKey: string;
} | null;

type ClipAnalysisState = {
  loading?: boolean;
  description?: string;
  error?: string;
};

function getResultKey(item: SearchData): string {
  return [item.sensor_id, item.start_time, item.end_time, item.video_name].join('::');
}

function buildReportTitle(items: SearchData[]): string {
  if (items.length <= 1) {
    return `${items[0]?.video_name ?? '검색 결과'} 보고서`;
  }

  return `${items[0]?.video_name ?? '검색 결과'} 외 ${items.length - 1}건 보고서`;
}

function toReportItems(items: SearchData[]): GeneratedReportItem['items'] {
  return items.map((item) => ({
    id: getResultKey(item),
    videoName: item.video_name,
    description: item.description,
    startTime: item.start_time,
    endTime: item.end_time,
    sensorId: item.sensor_id,
    similarity: item.similarity,
    screenshotUrl: item.screenshot_url,
  }));
}

async function saveGeneratedReport(items: SearchData[], userQuery?: string): Promise<GeneratedReportItem | null> {
  if (typeof window === 'undefined' || items.length === 0) {
    return null;
  }

  const report: GeneratedReportItem = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: buildReportTitle(items),
    createdAt: new Date().toISOString(),
    query: userQuery?.trim() || undefined,
    items: toReportItems(items),
  };

  try {
    const token = window.localStorage.getItem('vss.auth.token');
    if (!token) {
      return null;
    }

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Failed to save report: ${response.status}`);
    }

    window.dispatchEvent(new CustomEvent(REPORTS_UPDATED_EVENT));
    window.dispatchEvent(new CustomEvent(OPEN_REPORT_TAB_EVENT, { detail: { tabId: 'dashboard' } }));
    return report;
  } catch (error) {
    console.warn('Failed to save generated report:', error);
    return null;
  }
}

interface VideoSearchListProps {
  data: SearchData[];
  loading: boolean;
  error: string | null;
  isDark: boolean;
  onRefresh: () => void;
  onPlayVideo: (data: SearchData, showObjectsBbox: boolean) => void;
  agentApiUrl?: string;
  showObjectsBbox?: boolean;
  userQuery?: string;
}

export const VideoSearchList: React.FC<VideoSearchListProps> = ({
    data,
    loading,
    error,
    isDark,
    onRefresh,
    onPlayVideo,
    agentApiUrl,
    showObjectsBbox = false,
    userQuery,
}) => {
    const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState>(null);
    const [clipAnalysisByKey, setClipAnalysisByKey] = React.useState<Record<string, ClipAnalysisState>>({});
    const [analyzingClips, setAnalyzingClips] = React.useState(false);
  const [creatingReport, setCreatingReport] = React.useState(false);

    React.useEffect(() => {
      setSelectedKeys((prev) => {
        const validKeys = new Set(data.map((item) => getResultKey(item)));
        const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)));
        return next.size === prev.size ? prev : next;
      });
    }, [data]);

    React.useEffect(() => {
      if (!contextMenu) {
        return undefined;
      }

      const handleOutside = () => setContextMenu(null);
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setContextMenu(null);
        }
      };

      window.addEventListener('click', handleOutside);
      window.addEventListener('contextmenu', handleOutside);
      window.addEventListener('keydown', handleEscape);

      return () => {
        window.removeEventListener('click', handleOutside);
        window.removeEventListener('contextmenu', handleOutside);
        window.removeEventListener('keydown', handleEscape);
      };
    }, [contextMenu]);

    const setItemSelection = React.useCallback((item: SearchData, selected: boolean) => {
      const key = getResultKey(item);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setContextMenu(null);
    }, []);

    const toggleSelection = React.useCallback((item: SearchData) => {
      const key = getResultKey(item);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setContextMenu(null);
    }, []);

    const handleContextMenu = React.useCallback((event: React.MouseEvent<HTMLDivElement>, item: SearchData) => {
      event.preventDefault();
      event.stopPropagation();

      const key = getResultKey(item);
      setSelectedKeys((prev) => {
        if (prev.has(key)) {
          return prev;
        }
        return new Set([key]);
      });

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        targetKey: key,
      });
    }, []);

    const selectedItems = React.useMemo(() => {
      if (selectedKeys.size === 0) {
        return [];
      }

      return data.filter((item) => selectedKeys.has(getResultKey(item)));
    }, [data, selectedKeys]);

    const allSelected = data.length > 0 && selectedKeys.size === data.length;

    const handleSelectAll = React.useCallback((selected: boolean) => {
      setSelectedKeys(selected ? new Set(data.map((item) => getResultKey(item))) : new Set());
      setContextMenu(null);
    }, [data]);

    const handleCreateReport = React.useCallback(async () => {
      if (creatingReport) {
        return;
      }

      const reportItems = selectedItems.length > 0 ? selectedItems : data.filter((item) => getResultKey(item) === contextMenu?.targetKey);
      if (reportItems.length === 0) {
        setContextMenu(null);
        return;
      }

      setCreatingReport(true);
      try {
        await saveGeneratedReport(reportItems, userQuery);
      } finally {
        setCreatingReport(false);
      }
      setContextMenu(null);
    }, [contextMenu?.targetKey, creatingReport, data, selectedItems, userQuery]);

    const analyzeSingleClip = React.useCallback(async (item: SearchData) => {
      const key = getResultKey(item);
      if (!agentApiUrl) {
        setClipAnalysisByKey((prev) => ({
          ...prev,
          [key]: { error: 'Agent API URL이 설정되지 않았습니다.' },
        }));
        return;
      }

      setClipAnalysisByKey((prev) => ({
        ...prev,
        [key]: { loading: true },
      }));

      try {
        const response = await fetch(`${agentApiUrl}/describe_clip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sensor_id: item.sensor_id,
            start_timestamp: item.start_time,
            end_timestamp: item.end_time,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP error ${response.status}`);
        }

        const result = await response.json();
        setClipAnalysisByKey((prev) => ({
          ...prev,
          [key]: { description: result.description || '' },
        }));
      } catch (analysisError) {
        setClipAnalysisByKey((prev) => ({
          ...prev,
          [key]: {
            error: analysisError instanceof Error ? analysisError.message : 'VLM 분석 요청에 실패했습니다.',
          },
        }));
      }
    }, [agentApiUrl]);

    const handleAnalyzeContextItems = React.useCallback(async () => {
      if (analyzingClips) {
        return;
      }

      const targetItems = selectedItems.length > 0
        ? selectedItems
        : data.filter((item) => getResultKey(item) === contextMenu?.targetKey);

      if (targetItems.length === 0) {
        setContextMenu(null);
        return;
      }

      setAnalyzingClips(true);
      setContextMenu(null);
      try {
        for (const item of targetItems) {
          await analyzeSingleClip(item);
        }
      } finally {
        setAnalyzingClips(false);
      }
    }, [analyzeSingleClip, analyzingClips, contextMenu?.targetKey, data, selectedItems]);

    if (loading) {
        return (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <IconInbox className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} stroke={1.5} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>검색 결과가 여기에 표시됩니다</p>
            </div>
          </div>
        );
      }

      if (error) {
        return (
          <div className="flex items-center justify-center h-full p-4">
            <div className={`w-full max-w-2xl p-6 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className={`font-bold text-lg ${isDark ? 'text-red-400' : 'text-red-700'}`}>항목을 불러오지 못했습니다</p>
              </div>
              <div 
                className={`text-sm mb-4 p-3 rounded max-h-48 overflow-y-auto ${isDark ? 'bg-gray-800/50 text-gray-300' : 'bg-white text-red-600 border border-red-100'}`}
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {error}
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={onRefresh}
                  className="px-5 py-2.5 rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        );
      }
    return (
      <div className="p-4">
      {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
              <IconInbox className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} stroke={1.5} />
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>검색 결과가 여기에 표시됩니다</p>
          </div>
      ) : (
          <>
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => handleSelectAll(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-2 border-gray-300 bg-white text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-green-500"
              />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {selectedKeys.size > 0 ? `${selectedKeys.size}개 선택됨` : '클립 선택'}
              </span>
              {data.length > 0 && selectedKeys.size < data.length && (
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className={`text-sm hover:underline ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  전체 선택
                </button>
              )}
              {selectedKeys.size > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className={`text-sm hover:underline ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  전체 해제
                </button>
              )}
            </div>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              썸네일에서 우클릭하면 보고서를 만들 수 있습니다
            </span>
          </div>
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,280px)] justify-start">
              {data.map((item, index) => (
                  (() => {
                    const itemKey = getResultKey(item);
                    const isSelected = selectedKeys.has(itemKey);
                    const clipAnalysis = clipAnalysisByKey[itemKey];

                    return (
                  <div 
                      key={`${item.video_name}-${index}`}
                      className={`rounded-2xl overflow-hidden rounded-lg shadow-sm w-[280px] min-w-[280px] max-w-[280px] box-border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-green-50 border-2 border-green-500 ring-2 ring-green-100 dark:bg-green-900/20 dark:border-green-400 dark:ring-green-900/30'
                          : 'bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                      }`}
                  >
                      {/* Video Thumbnail Container */}
                      <div className="p-4 pb-0 space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              event.stopPropagation();
                              setItemSelection(item, event.target.checked);
                            }}
                            className="h-4 w-4 cursor-pointer rounded border-2 border-gray-300 bg-white text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-green-500"
                          />
                          <div className="min-w-0 flex-1">
                            <Whisper
                              placement="top"
                              trigger="hover"
                              speaker={<Tooltip>{item.video_name}</Tooltip>}
                            >
                              <h3 className="font-medium text-sm truncate cursor-default">
                                  {item.video_name}
                              </h3>
                            </Whisper>
                          </div>
                        </div>
                        <div
                          className="rounded-2xl relative aspect-video group cursor-pointer"
                          onClick={() => toggleSelection(item)}
                          onContextMenu={(event) => handleContextMenu(event, item)}
                        >
                            <div className="rounded-2xl absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900">
                                <img src={item.screenshot_url} alt={item.video_name} className="rounded-2xl w-full h-full object-cover" />
                            </div>
                            <div className="absolute right-3 top-3 z-10">
                              <div className={`flex min-w-[32px] items-center justify-center rounded-full border px-2 py-1 text-[11px] font-semibold ${
                                isSelected
                                  ? 'border-green-200 bg-green-500 text-white'
                                  : 'border-white/60 bg-black/30 text-white'
                              }`}>
                                {isSelected ? '선택' : '미선택'}
                              </div>
                            </div>
                            
                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center" onClick={(event) => {
                              event.stopPropagation();
                              onPlayVideo(item, showObjectsBbox);
                            }}>
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[rgb(209_255_117_/_0.6)] flex items-center justify-center shadow-lg transition-transform hover:scale-110 border border-white/30">
                                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                            </div>
                            
                            {/* Time and Similarity Info Overlay */}
                            <div className="rounded-b-2xl absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
                                      <div className="text-white text-xs">
                                          <span className="font-medium">{formatTime(parseDateAsLocal(item.start_time))}</span>
                                          <span className="mx-1">/</span>
                                          <span className="font-medium">{formatTime(parseDateAsLocal(item.end_time))}</span>
                                      </div>
                                      {item.description && (
                                        <Whisper
                                          placement="top"
                                          trigger="hover"
                                          speaker={<Tooltip>{item.description}</Tooltip>}
                                        >
                                          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 cursor-default">
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                        </Whisper>
                                      )}
                                  </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="p-4 pt-0 space-y-3">
                          <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                              유사도:
                            </span>
                            <span className="bg-gray-200 dark:bg-gray-800 dark:text-white text-gray-900 font-semibold ml-1 px-3 py-1 rounded-md">
                                {item.similarity.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {(clipAnalysis?.description || clipAnalysis?.error) && (
                          <div
                            className={`max-h-28 overflow-y-auto rounded-md border p-2 text-xs leading-relaxed ${
                              clipAnalysis?.error
                                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                                : 'border-amber-200 bg-amber-50 text-gray-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-gray-200'
                            }`}
                          >
                            {clipAnalysis.error || clipAnalysis.description}
                          </div>
                        )}
                      </div>
                  </div>
                    );
                  })()
              ))}
          </div>
              </>
      )}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            {selectedItems.length > 0 ? `${selectedItems.length}개 항목 선택됨` : '선택된 항목으로 작업'}
          </div>
          <button
            type="button"
            onClick={handleCreateReport}
            disabled={creatingReport}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <span>{creatingReport ? '생성 중...' : '보고서 생성'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">선택 결과 사용</span>
          </button>
          <button
            type="button"
            onClick={handleAnalyzeContextItems}
            disabled={analyzingClips}
            className="flex w-full items-center justify-between border-t border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700 dark:disabled:text-gray-500"
          >
            <span>{analyzingClips ? '분석 중...' : 'VLM 분석'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">선택 결과 사용</span>
          </button>
        </div>
      )}
  </div>
    )
}
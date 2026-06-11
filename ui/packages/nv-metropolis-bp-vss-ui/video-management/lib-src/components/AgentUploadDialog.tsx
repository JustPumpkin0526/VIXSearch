// SPDX-License-Identifier: MIT
import React, { useEffect, useState } from 'react';
import { IconVideo, IconX } from '@tabler/icons-react';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900] dark:border-gray-600 dark:bg-[#343541] dark:text-gray-300';
const POPUP_OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
const POPUP_CONTAINER_CLASS = 'w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-[#343541]';
const MIN_UPLOAD_CHUNK_DURATION = 1;
const FORCED_UPLOAD_EMBEDDING_ENABLED = true;

interface AgentUploadFileItem {
  id: string;
  file: File;
  isExpanded: boolean;
  formData: Record<string, any>;
}

interface AgentUploadDialogProps {
  open: boolean;
  files: AgentUploadFileItem[];
  configTemplate: any;
  uploadChunkDuration: number;
  onUploadChunkDurationChange: (value: number) => void;
  onAddMore: () => void;
  onClose: () => void;
  onConfirmUpload: (settingsOverride?: {
    uploadChunkDuration?: number;
  }) => void;
  onToggleExpand: (fileId: string) => void;
  onRemoveFile: (fileId: string) => void;
  onFieldChange: (fileId: string, fieldName: string, value: any) => void;
}

export const AgentUploadDialog: React.FC<AgentUploadDialogProps> = ({
  open,
  files,
  configTemplate,
  uploadChunkDuration,
  onUploadChunkDurationChange,
  onAddMore,
  onClose,
  onConfirmUpload,
  onRemoveFile,
}) => {
  const uploadEmbeddingEnabled = FORCED_UPLOAD_EMBEDDING_ENABLED;
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const [showUnsavedSettingsConfirm, setShowUnsavedSettingsConfirm] = useState(false);
  const [draftUploadChunkDuration, setDraftUploadChunkDuration] = useState(uploadChunkDuration);
  const [chunkDurationInput, setChunkDurationInput] = useState(String(uploadChunkDuration));
  void uploadEmbeddingEnabled;

  const syncDraftSettings = () => {
    const normalizedChunkDuration = Math.max(MIN_UPLOAD_CHUNK_DURATION, uploadChunkDuration);
    setDraftUploadChunkDuration(normalizedChunkDuration);
    setChunkDurationInput(String(normalizedChunkDuration));
  };

  const closeSettingsPopup = () => {
    syncDraftSettings();
    setIsSettingsPopupOpen(false);
  };

  const normalizeChunkDurationInput = (rawValue: string) => {
    const trimmedValue = rawValue.trim();
    const nextValue = Number(trimmedValue);

    return Number.isFinite(nextValue)
      ? Math.max(MIN_UPLOAD_CHUNK_DURATION, Math.floor(nextValue))
      : MIN_UPLOAD_CHUNK_DURATION;
  };

  const commitChunkDurationInput = (rawValue: string) => {
    const normalizedValue = normalizeChunkDurationInput(rawValue);

    setChunkDurationInput(String(normalizedValue));
    setDraftUploadChunkDuration(normalizedValue);
  };

  const persistDraftSettings = () => {
    const normalizedValue = normalizeChunkDurationInput(chunkDurationInput);

    setDraftUploadChunkDuration(normalizedValue);
    setChunkDurationInput(String(normalizedValue));
    onUploadChunkDurationChange(normalizedValue);

    return {
      uploadChunkDuration: normalizedValue,
    };
  };

  const saveSettings = () => {
    persistDraftSettings();
    setIsSettingsPopupOpen(false);
  };

  const normalizedSavedChunkDuration = Math.max(MIN_UPLOAD_CHUNK_DURATION, uploadChunkDuration);
  const pendingChunkDuration = normalizeChunkDurationInput(chunkDurationInput);
  const hasUnsavedSettings = pendingChunkDuration !== normalizedSavedChunkDuration;

  const handleUploadClick = () => {
    if (files.length === 0) {
      return;
    }

    if (hasUnsavedSettings) {
      setShowUnsavedSettingsConfirm(true);
      return;
    }

    onConfirmUpload();
  };

  const handleUploadWithSavedSettings = () => {
    setShowUnsavedSettingsConfirm(false);
  };

  const handleSaveAndUpload = () => {
    persistDraftSettings();

    setShowUnsavedSettingsConfirm(false);
    setIsSettingsPopupOpen(false);
  };

  useEffect(() => {
    if (!open) {
      syncDraftSettings();
      setIsSettingsPopupOpen(false);
      setShowUnsavedSettingsConfirm(false);
      return;
    }

    syncDraftSettings();

    if (!isSettingsPopupOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettingsPopup();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsPopupOpen, open, uploadChunkDuration, uploadEmbeddingEnabled]);

  useEffect(() => {
    if (!isSettingsPopupOpen) {
      syncDraftSettings();
    }
  }, [uploadChunkDuration]);

  if (!open) return null;

  return (
    <div className={POPUP_OVERLAY_CLASS}>
      <div className="flex w-full max-w-6xl items-stretch justify-center gap-4">
        <div className={POPUP_CONTAINER_CLASS}>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="w-10" aria-hidden="true" />
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-white">
              파일 업로드
            </h3>
            <button
              type="button"
              onClick={() => {
                if (isSettingsPopupOpen) {
                  closeSettingsPopup();
                  return;
                }

                syncDraftSettings();
                setIsSettingsPopupOpen(true);
              }}
              aria-expanded={isSettingsPopupOpen}
              aria-haspopup="dialog"
              aria-label="동영상 업로드 설정 열기"
              title="설정"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:ring-gray-500 dark:focus:ring-offset-[#343541]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>

          {/* Files list */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                파일 <span className="text-red-500">*</span>
                {files.length > 0 && (
                  <span className="ml-2 rounded-full bg-[#76b900] px-2 py-0.5 text-xs text-white">
                    {files.length}
                  </span>
                )}
              </label>
              {files.length > 0 && (
                <button
                  onClick={onAddMore}
                  className="flex items-center gap-1 rounded-lg bg-[#76b900] px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-[#5a8f00]"
                >
                  + 더 추가
                </button>
              )}
            </div>

            {files.length > 0 ? (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {files.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between bg-white p-3 dark:bg-[#343541]">
                        <div className="flex flex-1 items-center gap-2 overflow-hidden">
                          <IconVideo size={18} className="flex-shrink-0 text-[#76b900]" />
                          <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                            {item.file.name}
                          </span>
                          <span className="flex-shrink-0 text-xs text-gray-400">
                            ({(item.file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <button
                          onClick={() => onRemoveFile(item.id)}
                          className="ml-2 flex-shrink-0 text-gray-500 hover:text-red-500"
                          aria-label="파일 제거"
                        >
                          <IconX size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                onClick={onAddMore}
                className="w-full cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors border-gray-300 hover:border-[#76b900] hover:bg-gray-50 dark:border-gray-600 dark:hover:border-[#76b900] dark:hover:bg-gray-800"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  파일을 클릭하거나 여기로 끌어오세요
                </span>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">동영상 파일 (mp4, mkv)</div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              취소
            </button>
            <button
              onClick={handleUploadClick}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                files.length > 0 ? 'bg-[#76b900] hover:bg-[#5a8f00]' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={files.length === 0}
            >
              업로드 {files.length > 0 ? `(${files.length})` : ''}
            </button>
          </div>
        </div>

        {isSettingsPopupOpen && (
          <div
            className="w-full max-w-sm flex-shrink-0 rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-[#343541]"
            role="dialog"
            aria-modal="false"
            aria-label="동영상 업로드 설정"
          >
            <div
              className="flex h-full flex-col"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">동영상 업로드 설정</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    새로 추가한 파일에 적용할 기본 업로드 동작을 설정합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSettingsPopup}
                  className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  aria-label="설정 패널 닫기"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">임베딩 청크 길이</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    임베딩을 진행할 때 동영상을 나눌 청크의 길이를 정하는 설정
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="number"
                    min={MIN_UPLOAD_CHUNK_DURATION}
                    step={1}
                    value={chunkDurationInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;

                      if (nextValue === '') {
                        setChunkDurationInput('');
                        return;
                      }

                      setChunkDurationInput(nextValue);
                    }}
                    onBlur={(event) => commitChunkDurationInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitChunkDurationInput(event.currentTarget.value);
                        event.currentTarget.blur();
                      }
                    }}
                    className="w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#76b900] focus:outline-none focus:ring-2 focus:ring-[#76b900] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">초</span>
                </div>
                <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  저장 예정 값: {draftUploadChunkDuration}초
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeSettingsPopup}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  className="flex-1 rounded-lg bg-[#76b900] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5a8f00]"
                >
                  설정 저장
                </button>
              </div>
            </div>
          </div>
        )}

        {showUnsavedSettingsConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-[#343541]">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">설정 저장 확인</h4>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                설정이 저장되지 않았습니다. 저장하시겠습니까?
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleUploadWithSavedSettings}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  저장 안 함
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndUpload}
                  className="flex-1 rounded-lg bg-[#76b900] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5a8f00]"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// SPDX-License-Identifier: MIT
import React, { useEffect, useRef, useState } from 'react';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onFilesSelected: (files: File[]) => void;
  uploadEmbeddingEnabled: boolean;
  onUploadEmbeddingChange: (value: boolean) => void;
  uploadChunkDuration: number;
  onUploadChunkDurationChange: (value: number) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  isDeleting?: boolean;
  enableVideoUpload?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  onFilesSelected,
  uploadEmbeddingEnabled,
  onUploadEmbeddingChange,
  uploadChunkDuration,
  onUploadChunkDurationChange,
  selectedCount,
  onDeleteSelected,
  isDeleting = false,
  enableVideoUpload = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);

  useEffect(() => {
    if (!isSettingsPopupOpen) {
      return undefined;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsPopupOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSettingsPopupOpen]);

  const inputClass = 'rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 focus:ring-blue-400 dark:focus:ring-cyan-500 hover:border-gray-400 dark:hover:border-gray-500';

  const buttonClass = 'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-300 dark:focus:ring-gray-500 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900';

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp4,.mkv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          {enableVideoUpload && (
            <button
              type="button"
              onClick={handleUploadClick}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white dark:text-gray-900 focus:ring-green-500 dark:focus:ring-green-400 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-900 cursor-pointer"
            >
              + Upload Video
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search Files"
              className={`w-56 pl-3 pr-8 ${inputClass}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onSearch}
            className={buttonClass}
          >
            Search
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0 || isDeleting}
            className={`ml-2 inline-flex items-center justify-center gap-2 rounded border px-4 py-2 text-sm font-medium ${
              selectedCount === 0 || isDeleting
                ? 'cursor-not-allowed border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-600'
                : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
            }`}
          >
            {isDeleting ? (
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      </div>

      <div className="flex justify-end px-6 py-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsPopupOpen((prev) => !prev)}
            aria-expanded={isSettingsPopupOpen}
            aria-haspopup="dialog"
            aria-label="Open video upload settings"
            title="Settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-900"
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
      </div>

      {isSettingsPopupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/45 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Video upload settings"
          onClick={() => setIsSettingsPopupOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Video Upload Settings</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure the default upload behavior for newly added files.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsPopupOpen(false)}
                className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Close settings popup"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Generate embeddings on upload</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Newly selected videos will use this setting as their default embedding option.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={uploadEmbeddingEnabled}
                  onClick={() => onUploadEmbeddingChange(!uploadEmbeddingEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#76b900] focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    uploadEmbeddingEnabled ? 'bg-[#76b900]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      uploadEmbeddingEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Current default: {uploadEmbeddingEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Embedding chunk duration</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Project docs confirm a minimum of 0 seconds. A documented maximum was not found.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={uploadChunkDuration}
                  onChange={(event) => onUploadChunkDurationChange(Math.max(0, Number(event.target.value) || 0))}
                  className="w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#76b900] focus:outline-none focus:ring-2 focus:ring-[#76b900] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">seconds</span>
              </div>
              <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                `0` disables chunking. Smaller values increase granularity but create more embedding work.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

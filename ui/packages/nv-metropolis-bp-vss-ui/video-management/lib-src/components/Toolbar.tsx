// SPDX-License-Identifier: MIT
import React, { useRef } from 'react';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onFilesSelected: (files: File[]) => void;
  enableVideoUpload?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  onFilesSelected,
  enableVideoUpload = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              + 동영상 업로드
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
              placeholder="파일 검색"
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
            검색
          </button>
        </div>
      </div>
    </div>
  );
};

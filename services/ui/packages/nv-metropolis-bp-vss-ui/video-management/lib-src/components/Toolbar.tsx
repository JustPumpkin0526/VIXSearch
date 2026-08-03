// SPDX-License-Identifier: MIT
import React, {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';
import { Button, TextInput } from '@nvidia/foundations-react-core';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onFilesSelected: (files: File[]) => void;
  enableVideoUpload?: boolean;
}

export const Toolbar:React.FC<ToolbarProps> = ({
    searchQuery,
    onSearchChange,
    onSearch,
    onFilesSelected,
    enableVideoUpload = true,
  }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filterTriggerRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const updateFilterMenuPosition = useCallback(() => {
    if (!filterTriggerRef.current) return;
    const rect = filterTriggerRef.current.getBoundingClientRect();
    setFilterMenuPosition({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useLayoutEffect(() => {
    if (!isFilterDropdownOpen) {
      setFilterMenuPosition(null);
      return;
    }
    updateFilterMenuPosition();
  }, [isFilterDropdownOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!isFilterDropdownOpen) return;
    const onScrollOrResize = () => updateFilterMenuPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isFilterDropdownOpen, updateFilterMenuPosition]);

  // Close dropdown when clicking outside (menu is portaled to document.body)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterTriggerRef.current?.contains(target)) return;
      if (filterMenuRef.current?.contains(target)) return;
      setIsFilterDropdownOpen(false);
    };

    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  const clearSearchSlot = searchQuery ? (
    <button
      type="button"
      aria-label="Clear search"
      onClick={() => onSearchChange('')}
      className="inline-flex rounded p-0.5 text-gray-400 transition-colors hover:bg-neutral-700 hover:text-white dark:text-gray-400 dark:hover:bg-neutral-700 dark:hover:text-white"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  ) : undefined;

  return (
    <div className="min-w-0 max-w-full overflow-x-auto overflow-y-clip border-b border-gray-200 dark:border-gray-800">
      {/* One wrapping flex row — no flex-1 + justify-end strip */}
      <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-6 pt-6 pb-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp4,.mkv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {enableVideoUpload && (
          <Button kind="primary" onClick={handleUploadClick}>
            + Upload Video
          </Button>
        )}

        <div className="flex min-w-0 max-w-full items-center gap-2">
          <div className="min-w-0 w-[min(100%,14rem)] max-w-sm sm:w-56">
            <TextInput
              data-testid="search-video-input"
              value={searchQuery}
              onValueChange={(val: string) => onSearchChange(val)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search Files"
              slotRight={clearSearchSlot}
            />
          </div>
          <Button
            data-testid="search-video-button"
            kind="secondary"
            onClick={onSearch}
            className="shrink-0"
          >
            Search
          </Button>
        </div>
      </div>
    </div>
  );
};

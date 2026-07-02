// SPDX-License-Identifier: MIT
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '@nvidia/foundations-react-core';
import type {
  StreamInfo,
  VideoGroup,
  ChatSidebarQueryContext,
} from '../types';
import { StreamCard } from './StreamCard';

// Grid constants
const CARD_MIN_WIDTH = 240; // minmax(240px, 1fr)
const GRID_GAP = 16; // gap: 16px
const TARGET_ROWS = 4; // Target number of rows per page (reduced by ~25% from 5)

interface StreamsGridProps {
  streams: StreamInfo[];
  groups?: VideoGroup[];
  selectedStreams: Set<string>;
  selectedGroups?: Set<string>;
  vstApiUrl?: string | null;
  onSelectionChange: (streamId: string, selected: boolean) => void;
  onGroupSelectionChange?: (groupId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  showVideos: boolean;
  showRtsps: boolean;
  getEndTimeForStream: (streamId: string) => string | null;
  onPlayStream?: (stream: StreamInfo) => void;
  loadingStreamId?: string | null;
  onAddChatQueryContext?: (ctx: ChatSidebarQueryContext) => void;

  onOpenGroup?: (groupId: string) => void;
  onCreateGroup?: () => void;
  onDeleteSelected?: () => void | Promise<void>;
  currentGroupName?: string | null;
  onBackToGroups?: () => void;
}

const FolderCard: React.FC<{
  group: VideoGroup;
  isSelected: boolean;
  onSelectionChange?: (groupId: string, selected: boolean) => void;
  onOpen?: () => void;
}> = ({ group, isSelected, onSelectionChange, onOpen }) => {
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleCardClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    clickTimeoutRef.current = setTimeout(() => {
      onSelectionChange?.(group.id, !isSelected);
      clickTimeoutRef.current = null;
    }, 180);
  };

  const handleDoubleClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    onOpen?.();
  };

  return (
    <div
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      className={[
        'rounded-lg border overflow-hidden cursor-pointer select-none',
        'bg-white dark:bg-neutral-900',
        'border-gray-200 dark:border-gray-700',
        'transition-all duration-150',
        'hover:border-cyan-500 hover:shadow-md',
        isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              onSelectionChange?.(group.id, event.target.checked);
            }}
            className="w-4 h-4 rounded border-2 cursor-pointer bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
            aria-label={`${group.name} 그룹 선택`}
          />

          <span
            className="text-sm font-semibold text-gray-900 dark:text-white truncate"
            title={group.name}
          >
            {group.name}
          </span>
        </div>

        <span className="shrink-0 rounded bg-cyan-900/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 border border-cyan-700/50">
          GROUP
        </span>
      </div>

      {/* Body */}
      <div className="relative aspect-video bg-neutral-950">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-950 to-slate-900" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/30">
            <svg
              className="h-8 w-8 text-cyan-300"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10 4l2 2h8a2 2 0 012 2v10.5A2.5 2.5 0 0119.5 21h-15A2.5 2.5 0 012 18.5v-13A1.5 1.5 0 013.5 4H10z" />
            </svg>
          </div>

          <div className="text-center">
            <div className="text-sm font-semibold text-white">
              Video Group
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {group.sensorIds.length} videos
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 text-xs bg-gray-50 dark:bg-neutral-950 border-t border-gray-200 dark:border-gray-800">
        <span className="text-gray-600 dark:text-gray-400">
          동영상 {group.sensorIds.length}개
        </span>

        <span className="text-gray-500 dark:text-gray-500">
          더블클릭하여 열기
        </span>
      </div>
    </div>
  );
};

export const StreamsGrid: React.FC<StreamsGridProps> = ({
  streams,
  groups = [],
  selectedStreams,
  selectedGroups = new Set<string>(),
  vstApiUrl,
  onSelectionChange,
  onGroupSelectionChange,
  onSelectAll,
  showVideos,
  showRtsps,
  getEndTimeForStream,
  onPlayStream,
  loadingStreamId,
  onAddChatQueryContext,
  onOpenGroup,
  onCreateGroup,
  onDeleteSelected,
  currentGroupName,
  onBackToGroups,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerRow, setItemsPerRow] = useState(0); // 0 means not yet calculated
  const gridRef = useRef<HTMLDivElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Calculate items per row based on the actual grid element width
  const calculateItemsPerRow = useCallback(() => {
    if (!gridRef.current) return;
    
    // Use clientWidth which excludes borders but includes padding (which we don't have on the grid itself)
    const gridWidth = gridRef.current.clientWidth;
    
    // CSS grid auto-fill formula: how many columns fit
    // Each column needs at least CARD_MIN_WIDTH, plus gaps between them
    // gridWidth >= n * CARD_MIN_WIDTH + (n-1) * GRID_GAP
    // gridWidth >= n * CARD_MIN_WIDTH + n * GRID_GAP - GRID_GAP
    // gridWidth + GRID_GAP >= n * (CARD_MIN_WIDTH + GRID_GAP)
    // n <= (gridWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)
    const calculatedItems = Math.floor((gridWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP));
    const newItemsPerRow = Math.max(1, calculatedItems);
    
    if (newItemsPerRow !== itemsPerRow) {
      setItemsPerRow(newItemsPerRow);
    }
  }, [itemsPerRow]);

  // Observe grid resize
  useEffect(() => {
    // Initial calculation after mount
    const timer = setTimeout(calculateItemsPerRow, 0);
    
    const resizeObserver = new ResizeObserver(() => {
      calculateItemsPerRow();
    });
    
    if (gridRef.current) {
      resizeObserver.observe(gridRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [calculateItemsPerRow]);

  // Calculate dynamic items per page (must be multiple of itemsPerRow for full rows)
  const itemsPerPage = useMemo(() => {
    if (itemsPerRow === 0) {
      // Not yet calculated, use a reasonable default
      return TARGET_ROWS * 4;
    }
    return itemsPerRow * TARGET_ROWS;
  }, [itemsPerRow]);
  
  // Get streams for current page only - these are the only ones that will fetch images
  const rootItems = useMemo(
    () => [
      ...groups.map((group) => ({ kind: 'group' as const, group })),
      ...streams.map((stream) => ({ kind: 'stream' as const, stream })),
    ],
    [groups, streams],
  );

  const totalPages = Math.ceil(rootItems.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return rootItems.slice(startIndex, startIndex + itemsPerPage);
  }, [rootItems, currentPage, itemsPerPage]);

  // Reset to page 1 when streams change significantly (e.g., filter applied)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const allSelected = streams.length > 0 && selectedStreams.size === streams.length;

  // Never show indeterminate (dash) — with separate Select All / Deselect All buttons it's confusing
  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el) el.indeterminate = false;
  }, [selectedStreams.size, streams.length]);

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll(e.target.checked);
  };

  const canSelectAll = streams.length > 0 && selectedStreams.size < streams.length;
  const canDeselectAll = selectedStreams.size > 0;

  // Get viewing label based on filter state
  const getViewingLabel = () => {
    if (showVideos && showRtsps) return 'All Videos and RTSPs';
    if (showVideos) return 'Videos only';
    if (showRtsps) return 'RTSPs only';
    return 'None';
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };

  // Generate page numbers to display
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center">
          {currentGroupName && onBackToGroups && (
            <>
              <Button
                kind="tertiary"
                onClick={onBackToGroups}
              >
                Back
              </Button>

              <span className="mx-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {currentGroupName}
              </span>

              <span className="mx-4 text-gray-300 dark:text-gray-600">|</span>
            </>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={selectAllCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAllChange}
              className="w-4 h-4 rounded border-2 cursor-pointer bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-500 focus:ring-green-500"
            />
            {canSelectAll && (
              <Button
                kind="tertiary"
                onClick={() => onSelectAll(true)}
              >
                Select All
              </Button>
            )}
            {canDeselectAll && (
              <Button
                kind="tertiary"
                onClick={() => onSelectAll(false)}
              >
                Deselect All
              </Button>
            )}
          </div>
          <span className="mx-4 text-gray-300 dark:text-gray-600">|</span>
          <span className="text-sm text-gray-500">
            Viewing: {getViewingLabel()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onCreateGroup && selectedStreams.size > 0 && !currentGroupName && (
            <Button
              kind="primary"
              onClick={onCreateGroup}
            >
              Create Group
            </Button>
          )}
        
          {onDeleteSelected && (selectedStreams.size > 0 || selectedGroups.size > 0) && (
            <Button
              kind="secondary"
              onClick={onDeleteSelected}
            >
              Delete Selected
            </Button>
          )}
        
          {totalPages > 1 && (
            <span className="text-sm text-gray-500">
              {rootItems.length} items
            </span>
          )}
        </div>
      </div>

      {/* Grid - scrollable */}
      <div className="flex-1 overflow-auto px-6 pt-1 pb-4">
        <div
          data-testid="video-streams-grid"
          ref={gridRef}
          className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
        >
          {paginatedItems.map((item) => {
            if (item.kind === 'group') {
              return (
                <FolderCard
                  key={`group-${item.group.id}`}
                  group={item.group}
                  isSelected={selectedGroups.has(item.group.id)}
                  onSelectionChange={onGroupSelectionChange}
                  onOpen={() => onOpenGroup?.(item.group.id)}
                />
              );
            }
          
            return (
              <StreamCard
                key={item.stream.streamId}
                stream={item.stream}
                isSelected={selectedStreams.has(item.stream.streamId)}
                vstApiUrl={vstApiUrl}
                onSelectionChange={onSelectionChange}
                getEndTimeForStream={getEndTimeForStream}
                onPlay={onPlayStream}
                isLoadingPlay={loadingStreamId === item.stream.streamId}
                onAddChatQueryContext={onAddChatQueryContext}
              />
            );
          })}
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {/* Previous button */}
          <Button
            kind="tertiary"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            Previous
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) =>
              page === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-gray-400 dark:text-gray-500"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  kind="tertiary"
                  onClick={() => handlePageClick(page)}
                >
                  {page}
                </Button>
              )
            )}
          </div>

          {/* Next button */}
          <Button
            kind="tertiary"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

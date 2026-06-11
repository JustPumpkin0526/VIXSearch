// SPDX-License-Identifier: MIT
import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { StreamInfo, VideoGroup } from '../types';
import { StreamCard } from './StreamCard';

// Grid constants
const CARD_MIN_WIDTH = 240; // minmax(240px, 1fr)
const GRID_GAP = 16; // gap: 16px
const TARGET_ROWS = 4; // Target number of rows per page (reduced by ~25% from 5)
const CONTEXT_MENU_MARGIN = 8;

interface StreamsGridProps {
  streams: StreamInfo[];
  groups?: VideoGroup[];
  streamsById?: Map<string, StreamInfo>;
  selectedStreams: Set<string>;
  selectedGroups?: Set<string>;
  vstApiUrl?: string | null;
  onSelectionChange: (streamId: string, selected: boolean) => void;
  onGroupSelectionChange?: (groupId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  getEndTimeForStream: (streamId: string) => string | null;
  onPlayVideo?: (stream: StreamInfo) => void;
  onOpenGroup?: (groupId: string) => void;
  onCreateGroup?: () => void;
  onDeleteSelected?: () => void | Promise<void>;
  onViewSelectedDetails?: () => void;
  currentGroupName?: string | null;
  onBackToGroups?: () => void;
}

const FolderCard: React.FC<{
  group: VideoGroup;
  isSelected: boolean;
  onSelectionChange?: (groupId: string, selected: boolean) => void;
  onOpen: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, group: VideoGroup) => void;
}> = ({ group, isSelected, onSelectionChange, onOpen, onContextMenu }) => {
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }

        clickTimeoutRef.current = setTimeout(() => {
          onSelectionChange?.(group.id, !isSelected);
          clickTimeoutRef.current = null;
        }, 180);
      }}
      onDoubleClick={() => {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        onOpen();
      }}
      onContextMenu={(event) => {
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        onContextMenu?.(event, group);
      }}
      className={`group relative flex min-h-[220px] flex-col items-center justify-between rounded-xl border bg-gradient-to-b p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md ${
        isSelected
          ? 'border-cyan-500 from-cyan-50 to-white shadow-md dark:border-cyan-400 dark:from-cyan-950/40 dark:to-gray-800'
          : 'border-amber-200/80 from-amber-50 to-white hover:border-amber-300 dark:border-amber-700/60 dark:from-gray-800 dark:to-gray-800 dark:hover:border-amber-600'
      }`}
    >
      <label
        className="absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow-sm dark:bg-gray-900/90"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => onSelectionChange?.(group.id, event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
          aria-label={`${group.name} 그룹 선택`}
        />
      </label>
      <div className="flex flex-1 items-center justify-center py-4">
        <div className="relative w-full max-w-[170px] text-amber-500 transition-transform duration-200 group-hover:scale-[1.03] dark:text-amber-400">
          <svg viewBox="0 0 220 160" fill="none" className="h-auto w-full drop-shadow-[0_10px_18px_rgba(217,119,6,0.18)] dark:drop-shadow-[0_10px_18px_rgba(251,191,36,0.12)]">
            <path
              d="M24 44C24 35.1634 31.1634 28 40 28H86L103 45H180C188.837 45 196 52.1634 196 61V116C196 127.046 187.046 136 176 136H44C32.9543 136 24 127.046 24 116V44Z"
              fill="currentColor"
              fillOpacity="0.18"
            />
            <path
              d="M24 55C24 46.1634 31.1634 39 40 39H82.5C86.743 39 90.8129 40.6857 93.8137 43.6863L100.314 50.1863C103.315 53.1871 107.385 54.8726 111.628 54.8726H180C188.837 54.8726 196 62.036 196 70.8726V116C196 127.046 187.046 136 176 136H44C32.9543 136 24 127.046 24 116V55Z"
              fill="currentColor"
            />
            <path
              d="M33 70C33 63.3726 38.3726 58 45 58H175C181.627 58 187 63.3726 187 70V114C187 120.627 181.627 126 175 126H45C38.3726 126 33 120.627 33 114V70Z"
              fill="white"
              fillOpacity="0.18"
            />
            <path
              d="M40 39H82.5C86.743 39 90.8129 40.6857 93.8137 43.6863L100.314 50.1863C103.315 53.1871 107.385 54.8726 111.628 54.8726H189"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M33 70C33 63.3726 38.3726 58 45 58H175C181.627 58 187 63.3726 187 70V114C187 120.627 181.627 126 175 126H45C38.3726 126 33 120.627 33 114V70Z"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="w-full border-t border-amber-200/70 pt-4 dark:border-amber-700/40">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{group.name}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">동영상 {group.sensorIds.length}개</p>
      </div>
    </button>
  );
};

export const StreamsGrid: React.FC<StreamsGridProps> = ({
  streams,
  groups = [],
  streamsById,
  selectedStreams,
  selectedGroups = new Set(),
  vstApiUrl,
  onSelectionChange,
  onGroupSelectionChange,
  onSelectAll,
  getEndTimeForStream,
  onPlayVideo,
  onOpenGroup,
  onCreateGroup,
  onDeleteSelected,
  onViewSelectedDetails,
  currentGroupName,
  onBackToGroups,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerRow, setItemsPerRow] = useState(0); // 0 means not yet calculated
  const gridRef = useRef<HTMLDivElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

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

  // Calculate pagination
  const rootItems = useMemo(
    () => [
      ...groups.map((group) => ({ kind: 'group' as const, group })),
      ...streams.map((stream) => ({ kind: 'stream' as const, stream })),
    ],
    [groups, streams]
  );

  const totalPages = Math.ceil(rootItems.length / itemsPerPage);
  
  // Get streams for current page only - these are the only ones that will fetch images
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

  const selectableItemCount = streams.length + groups.length;
  const selectedItemCount = selectedStreams.size + selectedGroups.size;
  const allSelected = selectableItemCount > 0 && selectedItemCount === selectableItemCount;

  // Never show indeterminate (dash) — with separate Select All / Deselect All buttons it's confusing
  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el) el.indeterminate = false;
  }, [selectedItemCount, selectableItemCount]);

  const handleSelectAllChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectAll(e.target.checked);
  };

  const openContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleCardContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>, stream: StreamInfo) => {
    if (!selectedStreams.has(stream.streamId) || selectedItemCount === 0) {
      return;
    }

    openContextMenu(event);
  }, [openContextMenu, selectedItemCount, selectedStreams]);

  const handleGroupContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>, group: VideoGroup) => {
    if (!selectedGroups.has(group.id) || selectedItemCount === 0) {
      return;
    }

    openContextMenu(event);
  }, [openContextMenu, selectedGroups, selectedItemCount]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setContextMenuPosition(null);
      return;
    }

    const menuElement = contextMenuRef.current;
    if (!menuElement) {
      setContextMenuPosition(contextMenu);
      return;
    }

    const { innerWidth, innerHeight } = window;
    const rect = menuElement.getBoundingClientRect();
    const maxX = Math.max(CONTEXT_MENU_MARGIN, innerWidth - rect.width - CONTEXT_MENU_MARGIN);
    const maxY = Math.max(CONTEXT_MENU_MARGIN, innerHeight - rect.height - CONTEXT_MENU_MARGIN);

    setContextMenuPosition({
      x: Math.min(Math.max(contextMenu.x, CONTEXT_MENU_MARGIN), maxX),
      y: Math.min(Math.max(contextMenu.y, CONTEXT_MENU_MARGIN), maxY),
    });
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [contextMenu]);

  const canSelectAll = selectableItemCount > 0 && selectedItemCount < selectableItemCount;
  const canDeselectAll = selectedItemCount > 0;

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

  const canCreateGroup = Boolean(onCreateGroup) && selectedStreams.size > 0 && selectedGroups.size === 0;
  const canDeleteSelection = Boolean(onDeleteSelected) && selectedItemCount > 0;
  const canViewSelectedDetails = Boolean(onViewSelectedDetails) && selectedStreams.size === 1 && selectedGroups.size === 0;
  const hasContextMenuActions = canCreateGroup || canDeleteSelection || canViewSelectedDetails;

  const contextMenuContent = contextMenu && hasContextMenuActions && typeof document !== 'undefined' ? createPortal(
    <div
      ref={contextMenuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
      style={{
        left: contextMenuPosition?.x ?? contextMenu.x,
        top: contextMenuPosition?.y ?? contextMenu.y,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {canViewSelectedDetails ? (
        <button
          type="button"
          onClick={() => {
            onViewSelectedDetails?.();
            setContextMenu(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          상세 보기
        </button>
      ) : null}
      {canCreateGroup ? (
        <button
          type="button"
          onClick={() => {
            onCreateGroup?.();
            setContextMenu(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          그룹 생성
        </button>
      ) : null}
      {canDeleteSelection ? (
        <button
          type="button"
          onClick={() => {
            onDeleteSelected?.();
            setContextMenu(null);
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          삭제
        </button>
      ) : null}
    </div>,
    document.body
  ) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <input
              ref={selectAllCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAllChange}
              className="w-4 h-4 rounded border-2 cursor-pointer bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-500 focus:ring-green-500"
            />
            {canSelectAll && (
              <button
                type="button"
                onClick={() => onSelectAll(true)}
                className="text-sm text-gray-700 dark:text-gray-300 hover:underline focus:outline-none focus:underline"
              >
                전체 선택
              </button>
            )}
            {canDeselectAll && (
              <button
                type="button"
                onClick={() => onSelectAll(false)}
                className="text-sm text-gray-700 dark:text-gray-300 hover:underline focus:outline-none focus:underline"
              >
                전체 해제
              </button>
            )}
          </div>
          {currentGroupName && onBackToGroups ? (
            <button
              type="button"
              onClick={onBackToGroups}
              className="ml-4 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              목록으로 돌아가기
            </button>
          ) : null}
        </div>

        {/* Page info */}
        {totalPages > 1 && (
          <span className="text-sm text-gray-500">
            총 {rootItems.length}개
          </span>
        )}
      </div>

      {/* Grid - scrollable */}
      <div className="flex-1 overflow-auto px-6 pt-1 pb-4">
        <div
          ref={gridRef}
          className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
        >
          {paginatedItems.map((item) => {
            if (item.kind === 'group') {
              return (
                <FolderCard
                  key={item.group.id}
                  group={item.group}
                  isSelected={selectedGroups.has(item.group.id)}
                  onSelectionChange={onGroupSelectionChange}
                  onOpen={() => onOpenGroup?.(item.group.id)}
                  onContextMenu={handleGroupContextMenu}
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
                onPlayVideo={onPlayVideo}
                onContextMenu={handleCardContextMenu}
              />
            );
          })}
        </div>
      </div>

      {contextMenuContent}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {/* Previous button */}
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 text-sm rounded ${
              currentPage === 1
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            이전
          </button>

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
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageClick(page)}
                  className={`min-w-[32px] px-2 py-1.5 text-sm rounded font-medium ${
                    currentPage === page
                      ? 'bg-cyan-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 text-sm rounded ${
              currentPage === totalPages
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

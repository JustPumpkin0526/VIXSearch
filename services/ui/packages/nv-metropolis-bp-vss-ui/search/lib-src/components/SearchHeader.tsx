// SPDX-License-Identifier: MIT
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CustomProvider, Whisper, Button, Tooltip } from 'rsuite';
import { Button as KaizenButton, TextInput, Tag as KaizenTag } from '@nvidia/foundations-react-core';
import { IconX } from '@tabler/icons-react';
import { Search as SearchIcon, Funnel as FunnelIcon, Close as CloseIcon, InfoRound as InfoRoundIcon } from '@rsuite/icons';
import { IconRefresh } from '@tabler/icons-react';
import { FilterDialog } from './FilterPopover';
import { SearchParams, StreamInfo, FilterTag } from '../types';
import { DEFAULT_TOP_K } from '../hooks/useFilter';

interface SearchHeaderProps {
    onUpdateSearchParams: (params: SearchParams) => void;
    theme: 'light' | 'dark';    
    streams: StreamInfo[];
    filterParams: any;
    setFilterParams: (params: any) => void;
    addFilter: (params?: any) => void;
    removeFilterTag: (tag: FilterTag | null) => void;
    filterTags: FilterTag[];
    isSearching?: boolean;
    onCancelSearch?: () => void;
    onGetPendingQuery?: (getPendingFn: () => string) => void;
    submitChatMessage?: (message: string) => void;
    /** When true, disables search input, source type, filters, and tags (e.g. when Chat sidebar is open or query is running). */
    contentDisabled?: boolean;
  }

const SEARCH_HEADER_SPIN_STYLE_ID = 'search-header-spin-keyframes';
let searchHeaderSpinRefCount = 0;

export const SearchHeader: React.FC<SearchHeaderProps> = ({ onUpdateSearchParams, theme, streams, filterParams, setFilterParams, addFilter, removeFilterTag, filterTags, isSearching = false, onCancelSearch, onGetPendingQuery, submitChatMessage, contentDisabled = false }) => {
    const [query, setQuery] = useState(filterParams.query || '');
    const [hasQueryError, setHasQueryError] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // Store videoSources separately for each sourceType (useRef to avoid re-renders)
    const popoverRef = useRef<HTMLDivElement>(null);
    const filterButtonRef = useRef<HTMLDivElement>(null);
    const filterParamsRef = useRef(filterParams);
    filterParamsRef.current = filterParams;

    // Inject keyframes once per document; remove when last instance unmounts (ref-count)
    useEffect(() => {
        searchHeaderSpinRefCount += 1;
        let style = document.getElementById(SEARCH_HEADER_SPIN_STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement('style');
            style.id = SEARCH_HEADER_SPIN_STYLE_ID;
            style.textContent = '@keyframes searchHeaderSpin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        return () => {
            searchHeaderSpinRefCount -= 1;
            if (searchHeaderSpinRefCount <= 0) {
                searchHeaderSpinRefCount = 0;
                document.getElementById(SEARCH_HEADER_SPIN_STYLE_ID)?.remove();
            }
        };
    }, []);

    useEffect(() => {
      const externalQuery = filterParams.query || '';
      if (externalQuery !== query) {
        setQuery(externalQuery);
      }
    }, [filterParams.query]);
    
    useEffect(() => {
      if (onGetPendingQuery) {
        onGetPendingQuery(() => query);
      }
    }, [query, onGetPendingQuery]);
    
    const open = useCallback(() => setIsPopoverOpen(true), []);
    const close = useCallback(() => setIsPopoverOpen(false), []);
    const togglePopover = useCallback(() => setIsPopoverOpen((prev) => !prev), []);

    // Close filter popover when content becomes disabled (e.g. chat mode turned on)
    useEffect(() => {
        if (contentDisabled) setIsPopoverOpen(false);
    }, [contentDisabled]);

    // Handle click outside to close popover
    useEffect(() => {
        if (!isPopoverOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            // Check if click is inside popover
            if (popoverRef.current && popoverRef.current.contains(target)) {
                return;
            }

            // Check if click is inside DatePicker calendar or CheckPicker dropdown
            const isDatePickerCalendar = target.closest('.rs-picker-menu, .rs-calendar, .rs-picker-popup');
            const isCheckPickerDropdown = target.closest('.rs-picker-menu, .rs-check-picker-menu');
            
            if (isDatePickerCalendar || isCheckPickerDropdown) {
                return;
            }

            // Check if click is on the filter button itself
            if (filterButtonRef.current && filterButtonRef.current.contains(target)) {
                return;
            }

            // If none of the above, close the popover
            close();
        };

        // Add delay to avoid closing immediately after opening
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPopoverOpen, close]);

    // Tag reset values lookup
    const tagResetValues: Record<string, any> = useMemo(() => ({
      startDate: { startDate: null },
      endDate: { endDate: null },
      videoSources: { videoSources: [] },
      similarity: { similarity: '' },
      topK: { topK: DEFAULT_TOP_K }
    }), []);
    
    const handleUpdateQuery = useCallback((value: string) => {
      setQuery(value);
      if (hasQueryError && value.trim()) {
        setHasQueryError(false);
      }
    }, [hasQueryError]);

    const handleSearch = useCallback(() => {
      if (!query.trim()) {
        setHasQueryError(true);
        return;
      }
      setHasQueryError(false);
      // Always use the search API path (agent or non-agent); do not send Search-submitted queries to the Chat sidebar.
      onUpdateSearchParams({ ...filterParams, query, sourceType: 'video_file' });
    }, [query, filterParams, onUpdateSearchParams]);

    const handleConfirm = useCallback((newParams?: any) => {
      const paramsToUse = newParams || filterParams;
      if (newParams) {
        setFilterParams(newParams);
      }
      addFilter(paramsToUse);
      close();
    }, [filterParams, setFilterParams, addFilter, close]);

    const removeTag = useCallback((tag: FilterTag) => {
      const resetValue = tagResetValues[tag.key] || {};
      const newParams = { ...filterParams, ...resetValue };
      
      setFilterParams(newParams);
      removeFilterTag(tag);
    }, [filterParams, tagResetValues, setFilterParams, removeFilterTag]);
      
    const onClearAll = useCallback(() => {
      const newParams = { ...filterParams, startDate: null, endDate: null, videoSources: [], similarity: 0 };
      removeFilterTag(null);
      setFilterParams(newParams);
    }, [filterParams, removeFilterTag, setFilterParams]);

    const visibleTags = useMemo(
      () => (contentDisabled ? filterTags.filter((tag: FilterTag) => tag.key !== 'topK') : filterTags),
      [contentDisabled, filterTags]
    );

    return (
        <CustomProvider theme={theme}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 400, ...(hasQueryError ? { borderColor: '#f44336', boxShadow: '0 0 0 1px #f44336', borderRadius: 6 } : {}) }}>
                  <TextInput
                    data-testid="search-input"
                    value={query}
                    onValueChange={handleUpdateQuery}
                    placeholder="Search Files"
                    disabled={contentDisabled}
                    status={hasQueryError ? 'error' : undefined}
                    slotLeft={<SearchIcon />}
                    slotRight={
                      (query || isSearching) ? (
                        <CloseIcon
                          style={{
                            cursor: isSearching ? 'not-allowed' : 'pointer',
                            fontSize: 18,
                            color: theme === 'dark' ? '#ef4444' : '#dc2626',
                            transition: 'opacity 0.2s',
                            opacity: isSearching ? 0.4 : 0.7,
                          }}
                          onMouseEnter={isSearching ? undefined : (e: any) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={isSearching ? undefined : (e: any) => (e.currentTarget.style.opacity = '0.7')}
                          onClick={isSearching ? undefined : () => handleUpdateQuery('')}
                        />
                      ) : contentDisabled ? undefined : (
                        <Whisper placement="bottom" speaker={<Tooltip>Ask a natural language query like "a person in green jacket carrying boxes"</Tooltip>}>
                          <InfoRoundIcon style={{ cursor: 'help', transition: 'opacity 0.2s' }} />
                        </Whisper>
                      )
                    }
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); }}
                  />
                </div>
                <KaizenButton
                  data-testid="search-button"
                  onClick={isSearching && onCancelSearch ? onCancelSearch : handleSearch}
                  disabled={isSearching && onCancelSearch ? false : contentDisabled}
                  kind={isSearching && onCancelSearch ? 'secondary' : 'primary'}
                >
                  {isSearching && onCancelSearch ? 'Cancel' : 'Search'}
                </KaizenButton>
                {isSearching && (
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <IconRefresh
                      style={{
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                        color: theme === 'dark' ? '#60a5fa' : '#3b82f6',
                        animation: 'searchHeaderSpin 0.8s linear infinite',
                      }}
                    />
                  </span>
                )}
                <div style={{ position: 'relative' }} ref={filterButtonRef}>
                    <KaizenButton data-testid="search-filter-button" onClick={togglePopover} disabled={contentDisabled}>Filter <FunnelIcon /></KaizenButton>
                    <FilterDialog
                      isOpen={isPopoverOpen}
                      isDark={theme === 'dark'}
                      disabled={contentDisabled}
                      handleConfirm={handleConfirm} 
                      close={close} 
                      streams={streams}
                      filterParams={filterParams}
                      setFilterParams={setFilterParams}
                      containerRef={popoverRef}
                      triggerRef={filterButtonRef}
                    />
                </div>
                {visibleTags.length > 0 && (
                  <div data-testid="search-filter-tags" style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 5, 
                    alignItems: 'center',
                    pointerEvents: contentDisabled ? 'none' : 'auto'
                  }}>
                    {visibleTags.map((tag: FilterTag, index: number) => (
                      <KaizenTag
                        key={tag.key ?? index}
                        kind="outline"
                        color="gray"
                        readOnly={tag.key === 'topK' || contentDisabled}
                        style={{ opacity: contentDisabled ? 0.5 : 1 }}
                        onClick={!contentDisabled && tag.key !== 'topK' ? () => removeTag(tag) : undefined}
                      >
                        {tag.title}: <span style={{ color: theme === 'dark' ? '#84E1BC' : 'green' }}>{tag.value}</span>
                        {!contentDisabled && tag.key !== 'topK' && <IconX size={14} />}
                      </KaizenTag>
                    ))}
                    {visibleTags.length > 1 && (
                      <Button data-testid="search-clear-all-filters" size="sm" appearance="primary" color="red" onClick={onClearAll} disabled={contentDisabled}>
                        Clear All
                      </Button>
                    )}
                  </div>
                )}
          </div>
        </CustomProvider>
    );
};
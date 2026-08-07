import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { createPortal } from 'react-dom';

import {
  Button as KaizenButton,
} from '@nvidia/foundations-react-core';

import {
  VideoModal,
  VideoModalTooltip,
} from '@aiqtoolkit-ui/common';


function formatPauseTime(
  seconds: number,
): string {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return '00:00';
  }

  const totalSeconds =
    Math.floor(seconds);

  const hours =
    Math.floor(
      totalSeconds / 3600,
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60,
    );

  const secs =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      hours,
      minutes
        .toString()
        .padStart(2, '0'),
      secs
        .toString()
        .padStart(2, '0'),
    ].join(':');
  }

  return [
    minutes
      .toString()
      .padStart(2, '0'),
    secs
      .toString()
      .padStart(2, '0'),
  ].join(':');
}


export interface SearchVideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  title: React.ReactNode | string;
  onClose: () => void;

  searchByImageEnabled?: boolean;

  onSearchByImageRequest?: (
    pauseOffsetSeconds: number,
  ) => void;

  searchByImageFooter?: React.ReactNode;

  searchByImageOverlay?: React.ReactNode;

  onCreateReport?: () => void;

  creatingReport?: boolean;
}


export const SearchVideoModal:
  React.FC<SearchVideoModalProps> = ({
    isOpen,
    videoUrl,
    title,
    onClose,

    searchByImageEnabled = false,
    onSearchByImageRequest,
    searchByImageFooter,
    searchByImageOverlay,

    onCreateReport,
    creatingReport = false,
  }) => {
    const [
      videoElement,
      setVideoElement,
    ] =
      useState<HTMLVideoElement | null>(
        null,
      );

    const [paused, setPaused] =
      useState(false);

    const [
      pauseTime,
      setPauseTime,
    ] =
      useState(0);

    const [
      reportPanelPosition,
      setReportPanelPosition,
    ] = useState<{
        top: number;
        left: number;
      } | null>(null);


    const handleVideoRef =
      useCallback(
        (
          node:
            HTMLVideoElement | null,
        ) => {
          setVideoElement(node);
        },
        [],
      );


    useEffect(() => {
      setPaused(false);
      setPauseTime(0);
    }, [
      isOpen,
      videoUrl,
    ]);


    useEffect(() => {
      if (!videoElement) {
        return;
      }

      videoElement.style.opacity =
        searchByImageOverlay
          ? '0'
          : '1';

      videoElement.style.pointerEvents =
        searchByImageOverlay
          ? 'none'
          : 'auto';

      return () => {
        videoElement.style.opacity = '1';
        videoElement.style.pointerEvents =
          'auto';
      };
    }, [
      videoElement,
      searchByImageOverlay,
    ]);


    const handleVideoPause =
      useCallback(
        (
          currentTime: number,
        ) => {
          setPaused(true);
          setPauseTime(
            currentTime,
          );
        },
        [],
      );


    const handleVideoPlay =
      useCallback(() => {
        setPaused(false);
      }, []);


    const handleSearchByImageClick =
      useCallback(() => {
        onSearchByImageRequest?.(
          pauseTime,
        );
      }, [
        onSearchByImageRequest,
        pauseTime,
      ]);


    const showSearchByImageButton =
      searchByImageEnabled &&
      paused &&
      !searchByImageOverlay &&
      !!onSearchByImageRequest;


    const videoOverlayHost =
      useMemo(
        () =>
          (
            videoElement?.parentElement as
            HTMLDivElement | null
          ) ?? null,
        [videoElement],
      );

    const modalHost = useMemo(() => {
      if (!videoElement) {
        return null;
      }
    
      return videoElement.closest(
        '[role="dialog"]',
      ) as HTMLElement | null;
    }, [videoElement]);

    const updateReportPanelPosition =
      useCallback(() => {
        if (!modalHost) {
          setReportPanelPosition(null);
          return;
        }
      
        const rect =
          modalHost.getBoundingClientRect();
      
        const PANEL_GAP = 12;
      
        setReportPanelPosition({
          top: rect.top,
          left: rect.right + PANEL_GAP,
        });
      }, [modalHost]);


    useEffect(() => {
      if (!isOpen || !paused || !modalHost) {
        setReportPanelPosition(null);
        return;
      }
    
      updateReportPanelPosition();
    
      const handleUpdate = () => {
        updateReportPanelPosition();
      };
    
      window.addEventListener(
        'resize',
        handleUpdate,
      );
    
      window.addEventListener(
        'scroll',
        handleUpdate,
        true,
      );
    
      const resizeObserver =
        new ResizeObserver(handleUpdate);
    
      resizeObserver.observe(modalHost);
    
      return () => {
        window.removeEventListener(
          'resize',
          handleUpdate,
        );
      
        window.removeEventListener(
          'scroll',
          handleUpdate,
          true,
        );
      
        resizeObserver.disconnect();
      };
    }, 
      [isOpen, paused, modalHost, updateReportPanelPosition]
    );


    const showReportPanel =
      paused &&
      !searchByImageOverlay &&
      !!onCreateReport &&
      !!reportPanelPosition;


    if (!isOpen) {
      return null;
    }


    return (
      <>
        <VideoModal
          isOpen={isOpen}
          videoUrl={videoUrl}
          title={title}
          onClose={onClose}
          onVideoPause={
            handleVideoPause
          }
          onVideoPlay={
            handleVideoPlay
          }
          videoRef={
            handleVideoRef
          }
          footer={
            searchByImageFooter
          }
        />

        {videoOverlayHost &&
          showSearchByImageButton &&
          createPortal(
            <div
              className="
              absolute
              inset-0
              z-10
              flex
              items-center
              justify-center
              pointer-events-none
            "
            >
              <VideoModalTooltip
                content="
                Click to perform
                Search by Image
                on the paused
                video frame
              "
                wrapperClassName="
                pointer-events-auto
              "
              >
                <KaizenButton
                  data-testid="image-search-perform-button"
                  onClick={
                    handleSearchByImageClick
                  }
                  kind="primary"
                  size="small"
                >
                  Search by Image
                </KaizenButton>
              </VideoModalTooltip>
            </div>,
            videoOverlayHost,
          )}

        {videoOverlayHost &&
          searchByImageOverlay &&
          createPortal(
            <div
              className="
              absolute
              inset-0
              z-20
              min-h-0
              min-w-0
            "
            >
              {searchByImageOverlay}
            </div>,
            videoOverlayHost,
          )}

        {showReportPanel &&
          reportPanelPosition &&
          typeof document !==
          'undefined' &&
          createPortal(
            <div
              data-testid="search-report-panel"
              className="
              fixed
              z-[10000]
              w-[260px]
              overflow-hidden
              rounded-xl
              border
              border-gray-300
              bg-white
              shadow-2xl

              dark:border-gray-700
              dark:bg-neutral-900
            "
              style={{
                top: reportPanelPosition.top,
                left: reportPanelPosition.left,
                minHeight: '220px',
              }}
            >
              <div
                className="
                border-b
                border-gray-200
                px-4
                py-3

                dark:border-gray-700
              "
              >
                <h3
                  className="
                  text-sm
                  font-semibold
                  text-gray-900

                  dark:text-gray-100
                "
                >
                  Report
                </h3>
              </div>

              <div
                className="
                flex
                flex-col
                gap-4
                p-4
              "
              >
                <div>
                  <div
                    className="
                    text-xs
                    text-gray-500

                    dark:text-gray-400
                  "
                  >
                    Paused At
                  </div>

                  <div
                    className="
                    mt-1
                    text-sm
                    font-medium
                    text-gray-900

                    dark:text-gray-100
                  "
                  >
                    {formatPauseTime(
                      pauseTime,
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    creatingReport
                  }
                  onClick={
                    onCreateReport
                  }
                  className="
                    w-full
                    rounded-md
                    bg-[#76b900]
                    px-4
                    py-2.5
                    text-sm
                    font-semibold
                    text-black
                    transition-colors
                    hover:bg-[#8bd000]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {creatingReport
                    ? '보고서 생성 중...'
                    : '보고서 생성'}
                </button>
              </div>
            </div>,
            document.body,
          )}
      </>
    );
  };
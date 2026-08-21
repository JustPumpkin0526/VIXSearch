import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  BboxCoords,
  SearchData,
} from '../types';

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

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return [
      hours,
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
    ].join(':');
  }

  return [
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

export interface NewReportFormValues {
  title: string;
  author: string;
  situationDescription: string;
  pauseTime: number;
  place?: string;
}

export interface AddToExistingReportFormValues {
  situationDescription: string;
  pauseTime: number;
  place?: string;
}


export type ExistingReportOption = {
  id: string;
  title: string;
};


export interface SearchVideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  title: React.ReactNode | string;
  onClose: () => void;

  defaultSituationDescription?: string;

  searchByImageEnabled?: boolean;
  onSearchByImageRequest?: (
    pauseOffsetSeconds: number,
  ) => void;
  searchByImageTargetOffsetSeconds?: number;
  searchByImageFooter?: React.ReactNode;
  searchByImageOverlay?: React.ReactNode;

  onCreateReport?: (
    values: NewReportFormValues,
  ) => void | Promise<void>;

  onAddToExistingReport?: (
    reportId: string,
    values: AddToExistingReportFormValues,
  ) => void | Promise<void>;

  onLoadExistingReports?:
    () => void | Promise<void>;

  existingReports?: ExistingReportOption[];
  loadingReports?: boolean;
  creatingReport?: boolean;

  defaultReportAuthor?: string;

  /** Face detector rectangle in source-video pixel coordinates. */
  faceMatchBbox?: BboxCoords;

  /** Exact face-match position relative to the beginning of this result clip. */
  faceMatchOffsetSeconds?: number;

  /** Duration requested from VST before keyframe alignment expands the MP4. */
  requestedClipDurationSeconds?: number;
}


export const SearchVideoModal: React.FC<SearchVideoModalProps> = ({
    isOpen,
    videoUrl,
    title,
    onClose,

    defaultSituationDescription = '',

    searchByImageEnabled = false,
    onSearchByImageRequest,
    searchByImageTargetOffsetSeconds,
    searchByImageFooter,
    searchByImageOverlay,

    onCreateReport,
    onAddToExistingReport,
    onLoadExistingReports,
    existingReports = [],
    loadingReports = false,
    creatingReport = false,
    defaultReportAuthor = '',

    faceMatchBbox,
    faceMatchOffsetSeconds,
    requestedClipDurationSeconds,
  }) => {
    const [
      videoElement,
      setVideoElement,
    ] = useState<HTMLVideoElement | null>(
      null,
    );

    const [paused, setPaused] = useState(false);
    const [faceFrameReady, setFaceFrameReady] = useState(false);
    const [videoLayoutVersion, setVideoLayoutVersion] = useState(0);

    const [
      pauseTime,
      setPauseTime,
    ] = useState(0);

    const [
      reportMenuPosition,
      setReportMenuPosition,
    ] = useState<{
      x: number;
      y: number;
    } | null>(null);

    const [
      showExistingReports,
      setShowExistingReports,
    ] = useState(false);

    const [
      reportTitle,
      setReportTitle,
    ] = useState('');
    const [
      reportAuthor,
      setReportAuthor,
    ] = useState('');

    const [
      reportSituationDescription,
      setReportSituationDescription,
    ] = useState('');

    const [
      reportSituationDescriptionTouched,
      setReportSituationDescriptionTouched,
    ] = useState(false);

    const [
      reportPlace,
      setReportPlace,
    ] = useState('');

    const resolvedFaceMatchOffsetSeconds = useMemo(() => {
      void videoLayoutVersion;
    
      if (faceMatchOffsetSeconds == null) {
        return undefined;
      }
    
      const mediaDuration =
        videoElement?.duration;
    
      if (
        requestedClipDurationSeconds == null ||
        mediaDuration == null ||
        !Number.isFinite(
          requestedClipDurationSeconds,
        ) ||
        !Number.isFinite(mediaDuration) ||
        requestedClipDurationSeconds <= 0 ||
        mediaDuration <= 0
      ) {
        return faceMatchOffsetSeconds;
      }
    
      /*
       * VST가 요청 시각보다 앞선 키프레임에서
       * MP4를 시작했을 경우 생기는 선행 구간입니다.
       */
      const keyframePrefixSeconds =
        Math.max(
          0,
          mediaDuration -
            requestedClipDurationSeconds,
        );
      
      return Math.min(
        mediaDuration,
        faceMatchOffsetSeconds +
          keyframePrefixSeconds,
      );
    }, [
      faceMatchOffsetSeconds,
      requestedClipDurationSeconds,
      videoElement,
      videoLayoutVersion,
    ]);

    const handleReportMenuOpen =
      useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();

          const menuWidth = 240;
          const menuHeight = 280;
          const padding = 8;

          const x = Math.min(
            event.clientX,
            window.innerWidth - menuWidth - padding,
          );

          const y = Math.min(
            event.clientY,
            window.innerHeight - menuHeight - padding,
          );

          setShowExistingReports(false);

          setReportMenuPosition({
            x: Math.max(padding, x),
            y: Math.max(padding, y),
          });
        },
        []
      );


    const closeReportMenu =
      useCallback(() => {
        setReportMenuPosition(null);
        setShowExistingReports(false);
      }, []);


    useEffect(() => {
      if (!reportMenuPosition) {
        return;
      }

      const handlePointerDown = () => {
        closeReportMenu();
      };

      const handleKeyDown = (
        event: KeyboardEvent,
      ) => {
        if (event.key === 'Escape') {
          closeReportMenu();
        }
      };

      window.addEventListener(
        'pointerdown',
        handlePointerDown,
      );

      window.addEventListener(
        'keydown',
        handleKeyDown,
      );

      return () => {
        window.removeEventListener(
          'pointerdown',
          handlePointerDown,
        );

        window.removeEventListener(
          'keydown',
          handleKeyDown,
        );
      };
    }, [
      reportMenuPosition,
      closeReportMenu,
    ]);


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

      setFaceFrameReady(false);
      setVideoLayoutVersion(0);

      setReportMenuPosition(null);
      setShowExistingReports(false);

      setReportTitle('');
      setReportAuthor('');

      setReportSituationDescription(
        defaultSituationDescription.trim(),
      );

      setReportSituationDescriptionTouched(
        false,
      );

      setReportPlace('');
    }, [
      isOpen,
      videoUrl,
    ]);

    useEffect(() => {
      if (
        !isOpen ||
        reportSituationDescriptionTouched
      ) {
        return;
      }
    
      setReportSituationDescription(
        defaultSituationDescription.trim(),
      );
    }, [
      isOpen,
      defaultSituationDescription,
      reportSituationDescriptionTouched,
    ]);

    useEffect(() => {
      if (
        !isOpen ||
        !onLoadExistingReports
      ) {
        return;
      }
    
      void onLoadExistingReports();
    }, [
      isOpen,
      onLoadExistingReports,
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

    useEffect(() => {
      if (!videoElement) {
        return;
      }
    
      const updateLayout = () => {
        setVideoLayoutVersion(
          (version) => version + 1,
        );
      };
    
      videoElement.addEventListener(
        'loadedmetadata',
        updateLayout,
      );
    
      const observer =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(updateLayout);
    
      observer?.observe(videoElement);
    
      return () => {
        videoElement.removeEventListener(
          'loadedmetadata',
          updateLayout,
        );
      
        observer?.disconnect();
      };
    }, [
      videoElement,
    ]);


    const handleVideoPause = useCallback(
      (
        currentTime: number,
      ) => {
        const targetOffset =
          faceMatchBbox
            ? resolvedFaceMatchOffsetSeconds
            : undefined;
      
        const effectiveTime =
          targetOffset != null
            ? targetOffset
            : currentTime;
      
        setPaused(true);
        setPauseTime(effectiveTime);
      
        /*
         * 얼굴 검색 결과라면 검색된 얼굴이
         * 실제로 검출된 시점으로 이동합니다.
         */
        if (
          targetOffset != null &&
          videoElement &&
          Math.abs(
            currentTime - targetOffset,
          ) > 0.04
        ) {
          setFaceFrameReady(false);
        
          videoElement.currentTime =
            targetOffset;
        } else {
          setFaceFrameReady(
            targetOffset != null,
          );
        }
      
        /*
         * 기존 보고서 생성용 초기화 로직은
         * 그대로 유지합니다.
         */
        if (!reportTitle.trim()) {
          setReportTitle(
            typeof title === 'string'
              ? `${title} 보고서`
              : '검색 결과 보고서',
          );
        }
      
        if (!reportAuthor.trim()) {
          setReportAuthor(
            defaultReportAuthor,
          );
        }
      },
      [
        title,
        reportTitle,
        reportAuthor,
        defaultReportAuthor,
      
        faceMatchBbox,
        resolvedFaceMatchOffsetSeconds,
        videoElement,
      ],
    );

    const handleVideoPlay =useCallback(() => {
      setPaused(false);
      setFaceFrameReady(false);
      closeReportMenu();
    }, [
      closeReportMenu,
    ]);


    const handleVideoSeeked = useCallback(
      (
        currentTime: number,
      ) => {
        setPauseTime(currentTime);

        if (
          resolvedFaceMatchOffsetSeconds ==
            null ||
          !videoElement?.paused
        ) {
          setFaceFrameReady(false);
          return;
        }

        const aligned =
          Math.abs(
            currentTime -
              resolvedFaceMatchOffsetSeconds,
          ) <= 0.04;

        setFaceFrameReady(aligned);
      },
      [
        resolvedFaceMatchOffsetSeconds,
        videoElement,
      ],
    );

    const handleShowExistingReports =
      useCallback(async () => {
        setShowExistingReports(true);

        try {
          await onLoadExistingReports?.();
        } catch (error) {
          console.error(
            '[SearchVideoModal] Failed to load reports:',
            error,
          );
        }
      }, [
        onLoadExistingReports,
      ]);

    const hasReportTitle =
      reportTitle.trim().length > 0;

    const hasReportAuthor =
      reportAuthor.trim().length > 0;

    const hasReportPlace =
      reportPlace.trim().length > 0;

    const hasSituationDescription =
      reportSituationDescription
        .trim()
        .length > 0;

    const canCreateNewReport =
      !creatingReport &&
      hasReportTitle &&
      hasReportAuthor &&
      hasReportPlace &&
      hasSituationDescription &&
      !!onCreateReport;

    const canAddToExistingReport =
      !creatingReport &&
      !loadingReports &&
      existingReports.length > 0 &&
      hasReportPlace &&
      hasSituationDescription &&
      !!onAddToExistingReport;

    const handleSubmitNewReport =
      useCallback(async () => {
        const normalizedTitle = reportTitle.trim();
        const normalizedAuthor = reportAuthor.trim();
        const normalizedPlace = reportPlace.trim();
        const normalizedSituationDescription = reportSituationDescription.trim();

        if (
          !normalizedTitle ||
          !normalizedAuthor ||
          !normalizedPlace ||
          !normalizedSituationDescription ||
          !onCreateReport
        ) {
          return;
        }
      
        try {
          await onCreateReport({
            title: normalizedTitle,
            author: normalizedAuthor,
            situationDescription:
              normalizedSituationDescription,
            pauseTime,
            place: normalizedPlace,
          });
        
          setReportSituationDescription('');
          setReportSituationDescriptionTouched(
            false,
          );
          setReportPlace('');
          closeReportMenu();
        } catch (error) {
          console.error(
            '[SearchVideoModal] Failed to create report:',
            error,
          );
        }
      }, [
        reportTitle,
        reportAuthor,
        reportSituationDescription,
        reportPlace,
        pauseTime,
        onCreateReport,
        closeReportMenu,
      ]);

    const handleSelectExistingReport = useCallback(
      async (
        reportId: string,
      ) => {
        const normalizedPlace = reportPlace.trim();

        const normalizedSituationDescription = reportSituationDescription.trim();

        if (
          !onAddToExistingReport ||
          existingReports.length === 0 ||
          !normalizedPlace ||
          !normalizedSituationDescription
        ) {
          return;
        }
        try {
          await onAddToExistingReport(
            reportId,
            {
              situationDescription:
                normalizedSituationDescription,
              pauseTime,
              place: normalizedPlace,
            },
          );
          setReportSituationDescription('');
          setReportSituationDescriptionTouched(
            false,
          );
          setReportPlace('');
          closeReportMenu();
        } catch (error) {
          console.error(
            '[SearchVideoModal] Failed to add item to report:',
            error,
          );
        }
      },
      [
        closeReportMenu,
        onAddToExistingReport,
        pauseTime,
        reportPlace,
        reportSituationDescription,
        existingReports.length,
      ]
    );


    const handleSearchByImageClick = useCallback(() => {
      const targetOffset = searchByImageTargetOffsetSeconds;
      const offset = targetOffset != null ? targetOffset : pauseTime;
      if (targetOffset != null && videoElement) {
        videoElement.pause();
        videoElement.currentTime = targetOffset;
        setPauseTime(targetOffset);
      }
      if (onSearchByImageRequest) onSearchByImageRequest(offset);
    }, [onSearchByImageRequest, pauseTime, searchByImageTargetOffsetSeconds, videoElement]);


    const showSearchByImageButton =
      searchByImageEnabled &&
      paused &&
      !faceMatchBbox &&
      !searchByImageOverlay &&
      !!onSearchByImageRequest;

    const videoOverlayHost = useMemo(
      () =>
        (
          videoElement?.parentElement as
            HTMLDivElement | null
        ) ?? null,
      [
        videoElement,
      ],
    );

    const faceOverlayStyle = useMemo<React.CSSProperties | undefined>(() => {
      void videoLayoutVersion;

      if (
        !videoElement ||
        !faceMatchBbox ||
        !videoElement.videoWidth ||
        !videoElement.videoHeight
      ) {
        return undefined;
      }

      const displayWidth =
        videoElement.clientWidth;

      const displayHeight =
        videoElement.clientHeight;

      /*
       * video의 object-fit: contain과 동일한
       * 배율을 계산 계산합니다.
       */
      const scale = Math.min(
        displayWidth /
          videoElement.videoWidth,
        displayHeight /
          videoElement.videoHeight,
      );

      if (
        !Number.isFinite(scale) ||
        scale <= 0
      ) {
        return undefined;
      }

      const renderedWidth =
        videoElement.videoWidth * scale;

      const renderedHeight =
        videoElement.videoHeight * scale;

      /*
       * 화면에 레터박스가 발생한 경우
       * 실제 영상 시작 위치를 계산합니다.
       */
      const offsetX =
        (
          displayWidth -
          renderedWidth
        ) / 2;

      const offsetY =
        (
          displayHeight -
          renderedHeight
        ) / 2;

      const width =
        (
          faceMatchBbox.rightX -
          faceMatchBbox.leftX
        ) * scale;

      const height =
        (
          faceMatchBbox.bottomY -
          faceMatchBbox.topY
        ) * scale;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return undefined;
      }

      return {
        left:
          offsetX +
          faceMatchBbox.leftX * scale,

        top:
          offsetY +
          faceMatchBbox.topY * scale,

        width,
        height,
      };
    }, [
      faceMatchBbox,
      videoElement,
      videoLayoutVersion,
    ]);

    const showReportPanel =
      paused &&
      !searchByImageOverlay &&
      (!!onCreateReport ||
        !!onAddToExistingReport);


    if (!isOpen) {
      return null;
    }


    const reportPanel =
      showReportPanel ? (
        <div
          data-testid="search-report-panel"
          className="
            flex
            h-full
            w-[320px]
            shrink-0
            flex-col
            overflow-hidden
            rounded-xl
            border
            border-gray-300
            bg-white
            shadow-2xl
            dark:border-gray-700
            dark:bg-neutral-900
          "
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
              min-h-0
              flex-1
              flex-col
              gap-4
              overflow-y-auto
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
              
            <div>
              <label
                className="
                  mb-1
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  dark:text-gray-300
                "
              >
                보고서 제목
              </label>
              
              <input
                type="text"
                value={reportTitle}
                onChange={event =>
                  setReportTitle(
                    event.target.value,
                  )
                }
                disabled={creatingReport}
                className="
                  w-full
                  rounded-md
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-2
                  text-sm
                  text-gray-900
                  outline-none
                  focus:border-[#76b900]
              
                  disabled:cursor-not-allowed
                  disabled:opacity-60
              
                  dark:border-gray-700
                  dark:bg-neutral-800
                  dark:text-gray-100
                "
              />
            </div>
              
            {/* 작성 일시는 사용자가 수정할 필요 없음 - 입력 필드 제거 */}
              
            <div>
              <label
                className="
                  mb-1
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  dark:text-gray-300
                "
              >
                작성자
              </label>
              
              <input
                type="text"
                value={reportAuthor}
                onChange={event =>
                  setReportAuthor(
                    event.target.value,
                  )
                }
                disabled={creatingReport}
                className="
                  w-full
                  rounded-md
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-2
                  text-sm
                  text-gray-900
                  outline-none
                  focus:border-[#76b900]
              
                  disabled:cursor-not-allowed
                  disabled:opacity-60
              
                  dark:border-gray-700
                  dark:bg-neutral-800
                  dark:text-gray-100
                "
              />
            </div>

            <div>
              <label
                htmlFor="report-place"
                className="
                  mb-1
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  dark:text-gray-300
                "
              >
                발생 장소
              </label>

              <input
                id="report-place"
                type="text"
                value={reportPlace}
                onChange={event =>
                  setReportPlace(
                    event.target.value,
                  )
                }
                placeholder="장소명을 입력하세요."
                maxLength={200}
                disabled={creatingReport}
                className="
                  w-full
                  rounded-md
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-2
                  text-sm
                  text-gray-900
                  outline-none
                  focus:border-[#76b900]

                  disabled:cursor-not-allowed
                  disabled:opacity-60

                  dark:border-gray-700
                  dark:bg-neutral-800
                  dark:text-gray-100
                "
              />
            </div>

            <div>
              <label
                htmlFor="report-situation-description"
                className="
                  mb-1
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  dark:text-gray-300
                "
              >
                상세 내용
              </label>

              <textarea
                id="report-situation-description"
                value={reportSituationDescription}
                onChange={event => {
                    setReportSituationDescriptionTouched(
                      true,
                    );
                  
                    setReportSituationDescription(
                      event.target.value,
                    );
                  }}
                placeholder="해당 장면의 상황을 입력하세요."
                rows={4}
                maxLength={2000}
                disabled={creatingReport}
                className="
                  min-h-[100px]
                  w-full
                  resize-y
                  rounded-md
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-2
                  text-sm
                  text-gray-900
                  outline-none
                  focus:border-[#76b900]
              
                  disabled:cursor-not-allowed
                  disabled:opacity-60
              
                  dark:border-gray-700
                  dark:bg-neutral-800
                  dark:text-gray-100
                "
              />

              <div
                className="
                  mt-1
                  text-right
                  text-xs
                  text-gray-500
                  dark:text-gray-400
                "
              >
                {reportSituationDescription.length}/2000
              </div>
            </div>
              
            <button
              type="button"
              disabled={
                !canCreateNewReport &&
                !canAddToExistingReport
              }
              onClick={handleReportMenuOpen}
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
                ? '보고서 처리 중...'
                : '보고서 생성'}
            </button>

            {reportMenuPosition && (
              <div
                data-testid="report-context-menu"
                className="
                  fixed
                  z-[200]
                  w-[240px]
                  overflow-hidden
                  rounded-lg
                  border
                  border-gray-300
                  bg-white
                  shadow-2xl

                  dark:border-gray-700
                  dark:bg-neutral-900
                "
                style={{
                  left:
                    reportMenuPosition.x,
                  top:
                    reportMenuPosition.y,
                }}
                onPointerDown={
                  event =>
                    event.stopPropagation()
                }
              >
                {showExistingReports ? (
                  <div
                    className="
                      max-h-[280px]
                      overflow-y-auto
                      py-1
                    "
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setShowExistingReports(
                          false,
                        )
                      }
                      className="
                        w-full
                        border-b
                        border-gray-200
                        px-4
                        py-2
                        text-left
                        text-xs
                        text-gray-500
                        hover:bg-gray-100
                    
                        dark:border-gray-700
                        dark:text-gray-400
                        dark:hover:bg-neutral-800
                      "
                    >
                      ← 뒤로
                    </button>
                    
                    {loadingReports ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        보고서 불러오는 중...
                      </div>
                    ) : existingReports.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        기존 보고서가 없습니다.
                      </div>
                    ) : (
                      existingReports.map(
                        report => (
                          <button
                            key={report.id}
                            type="button"
                            disabled={!canAddToExistingReport}
                            onClick={() =>
                              void handleSelectExistingReport(
                                report.id,
                              )
                            }
                            className="
                              w-full
                              truncate
                              px-4
                              py-2.5
                              text-left
                              text-sm
                              text-gray-900
                              hover:bg-gray-100
                              disabled:cursor-not-allowed
                              disabled:opacity-50
                          
                              dark:text-gray-100
                              dark:hover:bg-neutral-800
                            "
                            title={
                              report.title
                            }
                          >
                            {report.title}
                          </button>
                        ),
                      )
                    )}
                  </div>
                ) : (
                  <div className="py-1">
                    <button
                      type="button"
                      disabled={
                        !canCreateNewReport
                      }
                      onClick={() =>
                        void handleSubmitNewReport()
                      }
                      className="
                        w-full
                        px-4
                        py-2.5
                        text-left
                        text-sm
                        text-gray-900
                        hover:bg-gray-100
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                    
                        dark:text-gray-100
                        dark:hover:bg-neutral-800
                      "
                    >
                      새 보고서 생성
                    </button>
                    
                    <button
                      type="button"
                      disabled={
                        !canAddToExistingReport
                      }
                      onClick={() =>
                        void handleShowExistingReports()
                      }
                      className="
                        w-full
                        px-4
                        py-2.5
                        text-left
                        text-sm
                        text-gray-900
                        hover:bg-gray-100
                        disabled:cursor-not-allowed
                        disabled:opacity-50

                        dark:text-gray-100
                        dark:hover:bg-neutral-800
                      "
                    >
                      기존 보고서에 추가
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null;


    return (
      <>
        <VideoModal
          isOpen={isOpen}
          videoUrl={videoUrl}
          title={title}
          onClose={creatingReport ? (() => {}) : onClose}
          onVideoPause={
            handleVideoPause
          }
          onVideoPlay={
            handleVideoPlay
          }
          onVideoSeeked={
            handleVideoSeeked
          }
          videoRef={handleVideoRef}
          footer={
            searchByImageFooter
          }
          sidePanel={reportPanel}
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
        {videoOverlayHost && paused && faceFrameReady && faceOverlayStyle && !searchByImageOverlay && createPortal(
          <div
            data-testid="face-match-bbox"
            aria-label="Matched face bounding box"
            className="
              absolute
              z-20
              pointer-events-none
              border-2
              border-brand-green
              shadow-[0_0_0_1px_rgba(0,0,0,0.8)]
            "
            style={faceOverlayStyle}
          >
            <span
              className="
                absolute
                -top-6
                left-0
                rounded
                bg-brand-green
                px-1.5
                py-0.5
                text-xs
                font-semibold
                text-black
              "
            >
              Face
            </span>
          </div>,
          videoOverlayHost,
        )}

        {creatingReport &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              role="status"
              aria-live="polite"
            >
              <div className="absolute inset-0 bg-black opacity-40" />
              <div className="relative z-10 flex flex-col items-center gap-3 rounded-md bg-white/90 p-6 shadow-lg dark:bg-neutral-900/90">
                <div className="animate-spin h-8 w-8 border-4 border-t-transparent rounded-full border-white dark:border-gray-300" />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">보고서 처리 중... 잠시만 기다려주세요.</div>
              </div>
            </div>,
            document.body,
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
      </>
    );
  };
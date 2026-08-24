import VideoDetailsModal from './components/VideoDetailsModal';
// SPDX-License-Identifier: MIT
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  VideoManagementComponentProps,
  UploadProgress,
  StreamInfo,
  StreamsApiResponse,
  VideoGroup,
} from './types';
import { useStreams, useStorageTimelines } from './hooks';
import {
  filterVideoStreams,
  parseStreamsResponse,
} from './utils';
import {
  VideoModal,
  useVideoModal,
  useChatVideoUploadCompleteSubscription,
} from '@nemo-agent-toolkit/ui';
import { chunkedUpload, notifyUploadComplete } from './chunkedUpload';
import { createApiEndpoints } from './api';
import { deleteVideo } from './videoDelete';
import { NUM_PARALLEL_FILE_UPLOADS } from './constants';
import {
  DeleteConfirmDialog,
  EmptyState,
  LoadingState,
  StreamsGrid,
  Toolbar,
  UploadProgressPanel,
  VideoManagementSidebarControls,
  AgentUploadDialog,
} from './components';

async function computeChecksumSHA256(file: File): Promise<string | null> {
  if (!window.crypto || !window.crypto.subtle) return null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Failed to compute checksum:', err);
    return null;
  }
}

async function extractVideoMetadata(file: File): Promise<{
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  mimeType?: string | null;
  codec?: string | null;
  checksum?: string | null;
  extra?: Record<string, unknown> | null;
}> {
  const mimeType = typeof file.type === 'string' && file.type.trim() ? file.type.trim() : null;
  const checksum = await computeChecksumSHA256(file);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let resolved = false;

    const cleanup = () => {
      try {
        video.pause();
      } catch {}
      video.src = '';
      URL.revokeObjectURL(url);
    };

    const finish = (meta: any) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({
        width: Number.isFinite(meta.width) ? Math.floor(meta.width) : null,
        height: Number.isFinite(meta.height) ? Math.floor(meta.height) : null,
        duration: Number.isFinite(meta.duration) ? Number(meta.duration) : null,
        mimeType,
        codec: mimeType, // best-effort: use mime as codec when explicit codec unavailable
        checksum,
        extra: null,
      });
    };

    video.preload = 'metadata';
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      finish({
        width: (video as HTMLVideoElement).videoWidth,
        height: (video as HTMLVideoElement).videoHeight,
        duration: (video as HTMLVideoElement).duration,
      });
    });

    // Timeout fallback
    const timeoutId = window.setTimeout(() => {
      finish({ width: null, height: null, duration: null });
    }, 5000);

    // Ensure cleanup if document unloads
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        window.clearTimeout(timeoutId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility, { once: true });
  });
}

interface VideoGroupSearchScope {
  groupId: string;
  groupName: string;
  sensorIds: string[];
  videoCount: number;
  totalDurationSeconds: number;
}

const GROUP_SEARCH_STORAGE_KEY =
  'vixsearch:selected-video-group';

const OPEN_SEARCH_TAB_EVENT =
  'vss:open-search-tab';

const GROUP_SEARCH_CHANGED_EVENT =
  'vss:video-group-search-changed';

async function waitForCanonicalStream(
  vstApiUrl: string,
  streamId: string,
  abortSignal?: AbortSignal,
): Promise<StreamInfo> {
  const apiEndpoints = createApiEndpoints(vstApiUrl);

  const maxAttempts = 20;
  const retryDelayMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (abortSignal?.aborted) {
      throw new DOMException('Request was aborted', 'AbortError');
    }

    try {
      const response = await fetch(apiEndpoints.STREAMS, {
        method: 'GET',
        cache: 'no-store',
        signal: abortSignal,
      });

      if (response.ok) {
        const payload: StreamsApiResponse = await response.json();
        const currentStreams = parseStreamsResponse(payload);

        const matchedStream = currentStreams.find(
          (stream) => stream.streamId === streamId,
        );

        if (matchedStream?.sensorId) {
          return matchedStream;
        }
      } else {
        console.warn(
          '[VideoManagement] failed to fetch VST streams:',
          response.status,
        );
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error;
      }

      console.warn(
        '[VideoManagement] canonical stream lookup failed:',
        error,
      );
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve, reject) => {
        const handleAbort = () => {
          window.clearTimeout(timeoutId);

          reject(
            new DOMException(
              'Request was aborted',
              'AbortError',
            ),
          );
        };

        const timeoutId = window.setTimeout(() => {
          abortSignal?.removeEventListener(
            'abort',
            handleAbort,
          );

          resolve();
        }, retryDelayMs);

        abortSignal?.addEventListener(
          'abort',
          handleAbort,
          { once: true },
        );
      });
    }
  }

  throw new Error(
    `Failed to resolve sensorId for streamId=${streamId}`,
  );
}

export type { VideoManagementComponentProps, VideoManagementSidebarControlHandlers } from './types';

export const VideoManagementComponent: React.FC<VideoManagementComponentProps> = ({
  videoManagementData,
  renderControlsInLeftSidebar = false,
  onControlsReady,
  isActive = true,
  addChatQueryContext,
  registerChatVideoUploadComplete,
}) => {
  const vstApiUrl = videoManagementData?.vstApiUrl;
  const agentApiUrl = videoManagementData?.agentApiUrl;
  const chatUploadFileConfigTemplateJson = videoManagementData?.chatUploadFileConfigTemplateJson;
  const enableVideoUpload = videoManagementData?.enableVideoUpload ?? true;

  // Upload dialog state (chat-style upload with config fields)
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{
    id: string;
    file: File;
    isExpanded: boolean;
    formData: Record<string, any>;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMainDragOver, setIsMainDragOver] = useState(false);
  const mainDragDepthRef = useRef(0);

  // Parse config template from videoManagementData (same as Chat component)
  const configTemplate = useMemo(() => {
    if (chatUploadFileConfigTemplateJson) {
      try {
        return JSON.parse(chatUploadFileConfigTemplateJson);
      } catch (error) {
        console.warn('Failed to parse upload file config template:', error);
      }
    }
    return null;
  }, [chatUploadFileConfigTemplateJson]);

  // Generate default form data from config template (same as Chat component)
  const generateDefaultFormData = useCallback((): Record<string, any> => {
    if (!configTemplate || !Array.isArray(configTemplate.fields)) return {};
    return configTemplate.fields.reduce((acc: Record<string, any>, field: any) => {
      acc[field['field-name']] = field['field-default-value'];
      return acc;
    }, {} as Record<string, any>);
  }, [configTemplate]);

  const generateFileId = useCallback(() => {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchInputValueRef = useRef('');
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingStreamId, setLoadingStreamId] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [renameGroupError, setRenameGroupError] = useState<string | null>(null);

  const createGroupBackdropPressedRef = useRef(false);
  const renameGroupBackdropPressedRef = useRef(false);

  const isUploadingRef = useRef(false);
  const uploadSessionIdRef = useRef(0);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFilesQueueRef = useRef<Array<{ id: string; file: File }>>([]);

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  const { streams, isLoading, error, refetch } = useStreams({ vstApiUrl });
  const {timelines, getEndTimeForStream, getLastTimelineForStream, refetch: refetchTimelines, } = useStorageTimelines({
    vstApiUrl,
  });
  const { videoModal, openVideoModal, closeVideoModal } = useVideoModal(vstApiUrl ?? undefined);
  
  // Video details modal state
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsVideo, setDetailsVideo] = React.useState<Record<string, any> | null>(null);
  
  const handleShowDetails = React.useCallback(async (videoId: string) => {
    setDetailsOpen(true);
    setDetailsVideo(null);
  
    try {
      const token = window.localStorage.getItem('vss.auth.token');
      if (!token) throw new Error('Missing auth token');
      const url = `/api/videos/detail?video_id=${encodeURIComponent(videoId)}`;
      console.info('[VideoManagement] fetching video details', { url, tokenAvailable: !!token });

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.info('[VideoManagement] details response status', resp.status);

      const payload = await resp.json().catch(() => null);
      console.info('[VideoManagement] details response body', payload);

      if (!resp.ok) {
        throw new Error(payload?.error || `Failed to fetch details: ${resp.status}`);
      }

      if (!payload || !payload.video) {
        throw new Error('Video details not found');
      }

      setDetailsVideo(payload.video);
    } catch (err) {
      console.warn('[VideoManagement] failed to load video details', err, { videoId });
      setDetailsVideo({ error: String(err) });
    }
  }, []);


  const streamsById = useMemo(
    () => new Map(streams.map((stream) => [stream.streamId, stream])),
    [streams],
  );

  const streamsBySensorId = useMemo(
    () => new Map(streams.map((stream) => [stream.sensorId, stream])),
    [streams],
  );

  const currentGroup = useMemo(
    () => videoGroups.find((group) => group.id === currentGroupId) ?? null,
    [currentGroupId, videoGroups],
  );

  useEffect(() => {
    if (currentGroupId && !videoGroups.some((group) => group.id === currentGroupId)) {
      setCurrentGroupId(null);
    }
  }, [currentGroupId, videoGroups]);

  const groupedSensorIds = useMemo(() => {
    const ids = new Set<string>();

    videoGroups.forEach((group) => {
      group.sensorIds.forEach((sensorId) => ids.add(sensorId));
    });

    return ids;
  }, [videoGroups]);

  const visibleRootGroups = useMemo(() => {
    const normalizedQuery =
      appliedSearchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return videoGroups;
    }

    return videoGroups.filter((group) => {
      if (
        group.name
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return true;
      }

      return group.sensorIds.some((sensorId) => {
        const streamName =
          streamsBySensorId.get(sensorId)?.name ?? '';

        return streamName
          .toLowerCase()
          .includes(normalizedQuery);
      });
    });
  }, [
    appliedSearchQuery,
    streamsBySensorId,
    videoGroups,
  ]);

  const filteredStreams = useMemo(
    () =>
      filterVideoStreams(
        streams,
        appliedSearchQuery,
      ),
    [streams, appliedSearchQuery],
  );

  const visibleStreams = useMemo(() => {
    if (currentGroup) {
      const currentGroupSensorIds =
        new Set(currentGroup.sensorIds);

      return filteredStreams.filter((stream) =>
        currentGroupSensorIds.has(stream.sensorId),
      );
    }

    return filteredStreams.filter(
      (stream) =>
        !groupedSensorIds.has(stream.sensorId),
    );
  }, [
    currentGroup,
    filteredStreams,
    groupedSensorIds,
  ]);

  const refetchRef = useRef(refetch);
  const refetchTimelinesRef = useRef(refetchTimelines);
  const vstApiUrlRef = useRef(vstApiUrl);

  const fetchVideoGroups = useCallback(async () => {
    if (typeof window === 'undefined') {
      setVideoGroups([]);
      return [] as VideoGroup[];
    }

    const token = window.localStorage?.getItem('vss.auth.token');

    if (!token) {
      setVideoGroups([]);
      return [] as VideoGroup[];
    }

    const response = await fetch('/api/videos/groups', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch video groups: ${response.status}`);
    }

    const payload = await response.json();

    const nextGroups: VideoGroup[] = Array.isArray(payload?.groups)
      ? payload.groups
        .filter((item: any) => Boolean(item?.id) && Array.isArray(item?.sensorIds))
        .map((item: any) => ({
          id: String(item.id),
          name:
            typeof item.name === 'string' && item.name.trim()
              ? item.name.trim()
              : '새 그룹',
          sensorIds: item.sensorIds
            .map((sensorId: unknown) => String(sensorId))
            .filter(Boolean),
          createdAt:
            typeof item.createdAt === 'string'
              ? item.createdAt
              : new Date().toISOString(),
        }))
      : [];

    setVideoGroups(nextGroups);
    return nextGroups;
  }, []);

  useEffect(() => {
    refetchRef.current = refetch;
    refetchTimelinesRef.current = refetchTimelines;
  }, [refetch, refetchTimelines]);

  useEffect(() => {
    vstApiUrlRef.current = vstApiUrl;
  }, [vstApiUrl]);

  // Refetch streams when component becomes active
  useEffect(() => {
    if (isActive) {
      refetchRef.current();
      refetchTimelinesRef.current();

      fetchVideoGroups().catch((groupError) => {
        console.warn('Failed to fetch video groups:', groupError);
      });
    }
  }, [fetchVideoGroups, isActive]);

  const refreshStreamsAfterChatUpload = useCallback(() => {
    refetchRef.current();
    refetchTimelinesRef.current();
  }, []);

  useChatVideoUploadCompleteSubscription(
    registerChatVideoUploadComplete,
    refreshStreamsAfterChatUpload,
  );

  const processUploadQueue = useCallback(async (fileEntries: Array<{ id: string; file: File; formData?: Record<string, any> }>) => {
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;
    uploadSessionIdRef.current += 1;
    const currentSessionId = uploadSessionIdRef.current;

    setIsUploading(true);
    const isSessionValid = () => uploadSessionIdRef.current === currentSessionId;

    const uploadSingleFile = async (entry: { id: string; file: File; formData?: Record<string, any> }): Promise<void> => {
      const { id, file, formData } = entry;

      let uploadedStreamId: string | null = null;
      let ownershipPersisted = false;

      if (!isSessionValid() || abortController.signal.aborted) return;

      setUploadProgress((prev) =>
        prev.map((p) => (p.id === id && p.status === 'pending' ? { ...p, status: 'uploading' } : p))
      );

      try {
        if (!vstApiUrl) {
          throw new Error('VST API URL not configured');
        }
        if (!agentApiUrl) {
          throw new Error('Agent API URL not configured');
        }

        // Step 1: Chunked upload directly to the video storage service
        // (bypasses agent, avoids Cloudflare 100s timeout on large files)

        const uploadEndpoints = createApiEndpoints(vstApiUrl);
        const videoUploadApiResponse = await chunkedUpload({
          file,
          uploadUrl: uploadEndpoints.UPLOAD_FILE,
          onProgress: (progress: number) => {
            if (!isSessionValid() || abortController.signal.aborted) return;
            setUploadProgress((prev) =>
              prev.map((p) => (p.id === id && p.status === 'uploading' ? { ...p, progress } : p))
            );
          },
          abortSignal: abortController.signal,
        });

        uploadedStreamId = videoUploadApiResponse.streamId;

        if (!isSessionValid() || abortController.signal.aborted) {
          throw new DOMException('Upload was cancelled', 'AbortError');
        }

        // Step 2: Notify agent for post-processing (embeddings, RTVI registration, etc.).
        // We forward the upload response as-is so the agent picks out the fields
        // it cares about; keeps the UI decoupled from the storage API shape.
        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && p.status === 'uploading' ? { ...p, status: 'processing', progress: 100 } : p))
        );

        // Forward the per-upload custom params collected by the dialog
        // (from chatUploadFileConfigTemplateJson) so the agent can use them
        // downstream. Sent as `custom_params` on the /complete body.
        await notifyUploadComplete(
          agentApiUrl,
          file.name,
          videoUploadApiResponse,
          formData,
          abortController.signal,
        );

        try {
                const pad = (n: number) => String(n).padStart(2, '0');
                const formatFileDate = (ms: number) => {
                  const d = new Date(ms);
                  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                };

          const token =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('vss.auth.token')
              : null;

          if (!token) {
            throw new Error(
              'Missing auth token; cannot persist uploaded video ownership',
            );
          }

          const originalFilename = file.name;
          const normalizedFilename =
            originalFilename.replace(/\.[^.]+$/, '') ||
            originalFilename;

          /*
           * 업로드 응답의 sensorId는 실제 replay sensorId로
           * 보장되지 않으므로 streamId 기준으로 다시 조회한다.
           */
          const canonicalStream = await waitForCanonicalStream(
            vstApiUrl,
            videoUploadApiResponse.streamId,
            abortController.signal,
          );

          console.log(
            '[VideoManagement] resolved upload identifiers:',
            {
              filename:
                videoUploadApiResponse.filename,
            
              uploadResponseId:
                videoUploadApiResponse.id,
            
              uploadResponseStreamId:
                videoUploadApiResponse.streamId,
            
              uploadResponseSensorId:
                videoUploadApiResponse.sensorId,
            
              canonicalStreamId:
                canonicalStream.streamId,
            
              canonicalSensorId:
                canonicalStream.sensorId,
            },
          );

          // Extract metadata (width, height, duration, mime, checksum) from the original file
          let videoMeta: {
            width?: number | null;
            height?: number | null;
            duration?: number | null;
            mimeType?: string | null;
            codec?: string | null;
            checksum?: string | null;
            extra?: Record<string, unknown> | null;
          } | null = null;

          try {
            videoMeta = await extractVideoMetadata(file);
          } catch (metaErr) {
            console.warn('[VideoManagement] failed to extract video metadata:', metaErr);
            videoMeta = null;
          }

          const response = await fetch(
            '/api/videos/complete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                video_id: videoUploadApiResponse.id,
                stream_id: canonicalStream.streamId,
                sensor_id: canonicalStream.sensorId,
                filename: normalizedFilename,
                storage_filename: videoUploadApiResponse.filename,
                video_url: videoUploadApiResponse.filePath,
                file_path: videoUploadApiResponse.filePath,
                bytes: videoUploadApiResponse.bytes,
                // uploaded_at is set by server; send created_at as ISO so server can parse reliably
                  timestamp: undefined,
                  created_at: file && typeof file.lastModified === 'number' ? new Date(file.lastModified).toISOString() : videoUploadApiResponse.created_at,
                width: videoMeta?.width ?? null,
                height: videoMeta?.height ?? null,
                duration_seconds: videoMeta?.duration ?? null,
                codec: videoMeta?.codec ?? null,
                mime_type: videoMeta?.mimeType ?? null,
                checksum: videoMeta?.checksum ?? null,
                metadata: {
                  ...(formData || {}),
                  ...(videoMeta?.extra || {}),
                },
              }),
              signal: abortController.signal,
            },
          );

          const responsePayload =
            await response.json().catch(() => null);

          if (!response.ok) {
            throw new Error(
              responsePayload?.error ??
              `Failed to persist uploaded video ownership: ${response.status}`,
            );
          }

          if (responsePayload?.skipped) {
            console.warn('[VideoManagement] /complete skipped:', responsePayload?.reason || 'duplicate');
            // Treat skipped (duplicate) as non-fatal: existing record already present.
          }
        } catch (ownershipError) {
          console.error(
            '[VideoManagement] failed to persist uploaded video ownership record',
            ownershipError,
          );

          throw ownershipError;
        }

        if (!isSessionValid() || abortController.signal.aborted) {
          throw new DOMException('Upload was cancelled', 'AbortError');
        }

        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && (p.status === 'uploading' || p.status === 'processing') ? {
            ...p,
            status: 'success',
            progress: 100,
          } : p))
        );
      } catch (err) {
        if (!isSessionValid() || abortController.signal.aborted) {
          throw new DOMException('Upload was cancelled', 'AbortError');
        }

        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        const isCancelled = err instanceof Error && (err.name === 'AbortError' || err.message === 'Upload was cancelled');

        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && (p.status === 'uploading' || p.status === 'pending' || p.status === 'processing') ? {
            ...p,
            status: isCancelled ? 'cancelled' : 'error',
            error: isCancelled ? undefined : errorMessage
          } : p))
        );
      }
    };

    let entriesToProcess = fileEntries;

    while (entriesToProcess.length > 0) {
      for (let i = 0; i < entriesToProcess.length; i += NUM_PARALLEL_FILE_UPLOADS) {
        if (!isSessionValid()) break;

        const batch = entriesToProcess.slice(i, i + NUM_PARALLEL_FILE_UPLOADS);
        await Promise.allSettled(batch.map((entry) => uploadSingleFile(entry)));
      }

      if (!isSessionValid() || abortController.signal.aborted) {
        throw new DOMException('Upload was cancelled', 'AbortError');
      }

      // Check for any files queued during this batch
      if (pendingFilesQueueRef.current.length > 0) {
        entriesToProcess = [...pendingFilesQueueRef.current];
        pendingFilesQueueRef.current = [];
      } else {
        entriesToProcess = [];
      }
    }

    setIsUploading(false);
    await Promise.all([
      refetchRef.current(),
      refetchTimelinesRef.current(),
      fetchVideoGroups(),
    ]);
  }, [vstApiUrl, agentApiUrl, fetchVideoGroups,]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Open dialog for user input (chat-style upload with config fields)
    const newItems = Array.from(files).map((file) => ({
      id: generateFileId(),
      file,
      isExpanded: false,
      formData: generateDefaultFormData(),
    }));
    setSelectedFiles((prev) => [...prev, ...newItems]);
    setShowUploadDialog(true);
  }, [generateFileId, generateDefaultFormData]);

  const isFileDragEvent = useCallback(
  (event: React.DragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer.types).includes('Files'),
  [],
);

const handleMainDragEnter = useCallback(
  (event: React.DragEvent<HTMLDivElement>) => {
    if (!enableVideoUpload || !isFileDragEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    mainDragDepthRef.current += 1;
    setIsMainDragOver(true);
  },
  [enableVideoUpload, isFileDragEvent],
);

const handleMainDragOver = useCallback(
  (event: React.DragEvent<HTMLDivElement>) => {
    if (!enableVideoUpload || !isFileDragEvent(event)) {
      return;
    }

    // drop 이벤트가 발생하려면 dragOver에서 반드시 preventDefault가 필요합니다.
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = 'copy';
  },
  [enableVideoUpload, isFileDragEvent],
);

const handleMainDragLeave = useCallback(
  (event: React.DragEvent<HTMLDivElement>) => {
    if (!enableVideoUpload || !isFileDragEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    mainDragDepthRef.current = Math.max(
      0,
      mainDragDepthRef.current - 1,
    );

    if (mainDragDepthRef.current === 0) {
      setIsMainDragOver(false);
    }
  },
  [enableVideoUpload, isFileDragEvent],
);

const handleMainDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!enableVideoUpload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    mainDragDepthRef.current = 0;
    setIsMainDragOver(false);

    const droppedFiles = Array.from(event.dataTransfer.files);

    const supportedFiles = droppedFiles.filter((file) =>
      /\.(mp4|mkv)$/i.test(file.name),
    );

    if (supportedFiles.length === 0) {
      console.warn(
        '[VideoManagement] No supported video files were dropped',
      );
      return;
    }

    handleFilesSelected(supportedFiles);
  },
  [enableVideoUpload, handleFilesSelected],
);

  const uploadProgressRef = useRef<UploadProgress[]>([]);

  useEffect(() => {
    uploadProgressRef.current = uploadProgress;
  }, [uploadProgress]);

  const handleCancelUploads = useCallback(async () => {
    pendingFilesQueueRef.current = [];

    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }

    uploadSessionIdRef.current += 1;
    const successCount = uploadProgressRef.current.filter((p) => p.status === 'success').length;

    setUploadProgress((prev) =>
      prev.map((p) => (p.status === 'pending' || p.status === 'uploading' || p.status === 'processing' ? { ...p, status: 'cancelled' } : p))
    );
    setIsUploading(false);

    if (successCount > 0) {
      await Promise.all([
        refetchRef.current(),
        refetchTimelinesRef.current(),
        fetchVideoGroups(),
      ]);
    }
  }, []);

  const handleSearch = useCallback(() => {
    const currentValue = searchInputValueRef.current;
    setAppliedSearchQuery(currentValue);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    searchInputValueRef.current = value;
    setSearchQuery(value);
  }, []);

  // When user clears the search (clear button or deletes all text), apply empty filter so streams show again
  useEffect(() => {
    if (searchQuery === '') {
      searchInputValueRef.current = '';
      setAppliedSearchQuery('');
    }
  }, [searchQuery]);

  const handleClearUploadProgress = useCallback(() => {
    setUploadProgress([]);
  }, []);

  const handlePlayStream = useCallback(
    async (stream: StreamInfo) => {
      const range =
        getLastTimelineForStream(stream.streamId);

      if (!range) {
        return;
      }

      setLoadingStreamId(stream.streamId);

      try {
        await openVideoModal({
          video_name: stream.name,
          start_time: range.startTime,
          end_time: range.endTime,
          sensor_id: stream.sensorId,
        });
      } catch {
        // openVideoModal 내부에서 오류 처리
      } finally {
        setLoadingStreamId(null);
      }
    },
    [
      getLastTimelineForStream,
      openVideoModal,
    ],
  );

  const handleSelectionChange = useCallback((streamId: string, selected: boolean) => {
    setSelectedStreams((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(streamId);
      } else {
        next.delete(streamId);
      }
      return next;
    });
  }, []);

  const handleGroupSelectionChange = useCallback(
    (groupId: string, selected: boolean) => {
      setSelectedGroups((prev) => {
        const next = new Set(prev);

        if (selected) {
          next.add(groupId);
        } else {
          next.delete(groupId);
        }

        return next;
      });
    },
    [],
  );

  const handleOpenGroup = useCallback((groupId: string) => {
    setSelectedStreams(new Set());
    setSelectedGroups(new Set());
    setCurrentGroupId(groupId);
  }, []);

  const handleSearchGroup =
    useCallback(
      (groupId: string) => {
        const group =
          videoGroups.find(
            (item) =>
              item.id === groupId,
          );

        if (
          !group ||
          typeof window ===
            'undefined'
        ) {
          return;
        }

        const totalDurationSeconds =
          group.sensorIds.reduce(
            (
              groupTotal,
              sensorId,
            ) => {
              const stream =
                streamsBySensorId.get(
                  sensorId,
                );

              if (!stream) {
                return groupTotal;
              }

              const storageInfo =
                timelines.get(
                  stream.streamId,
                );

              if (
                !storageInfo ||
                !Array.isArray(
                  storageInfo.timelines,
                )
              ) {
                return groupTotal;
              }

              const streamDuration =
                storageInfo.timelines.reduce(
                  (
                    timelineTotal,
                    timeline,
                  ) => {
                    const startTime =
                      Date.parse(
                        timeline.startTime,
                      );

                    const endTime =
                      Date.parse(
                        timeline.endTime,
                      );

                    if (
                      !Number.isFinite(
                        startTime,
                      ) ||
                      !Number.isFinite(
                        endTime,
                      ) ||
                      endTime <= startTime
                    ) {
                      return timelineTotal;
                    }

                    return (
                      timelineTotal +
                      (endTime -
                        startTime) /
                        1000
                    );
                  },
                  0,
                );

              return (
                groupTotal +
                streamDuration
              );
            },
            0,
          );

        const searchScope:
          VideoGroupSearchScope = {
            groupId: group.id,
            groupName: group.name,
            sensorIds: [
              ...group.sensorIds,
            ],
            videoCount:
              group.sensorIds.length,
            totalDurationSeconds,
          };

        sessionStorage.setItem(
          GROUP_SEARCH_STORAGE_KEY,
          JSON.stringify(
            searchScope,
          ),
        );

        window.dispatchEvent(
          new CustomEvent(
            GROUP_SEARCH_CHANGED_EVENT,
            {
              detail: searchScope,
            },
          ),
        );

        window.dispatchEvent(
          new CustomEvent(
            OPEN_SEARCH_TAB_EVENT,
          ),
        );
      },
      [
        timelines,
        streamsBySensorId,
        videoGroups,
      ],
    );

  const getStreamDurationSeconds = useCallback(
    (stream: StreamInfo): number => {
      const storageInfo = timelines.get(stream.streamId);

      if (!storageInfo?.timelines?.length) {
        return 0;
      }

      return storageInfo.timelines.reduce((total, timeline) => {
        const startTime = Date.parse(timeline.startTime);
        const endTime = Date.parse(timeline.endTime);

        if (
          !Number.isFinite(startTime) ||
          !Number.isFinite(endTime) ||
          endTime <= startTime
        ) {
          return total;
        }

        return total + (endTime - startTime) / 1000;
      }, 0);
    },
    [timelines],
  );

  const summaryStreams = useMemo(() => {
    const hasSearchQuery =
      appliedSearchQuery.trim().length > 0;

    if (currentGroup) {
      const groupSensorIds = new Set(
        currentGroup.sensorIds,
      );

      const groupStreams = streams.filter(
        (stream) =>
          groupSensorIds.has(stream.sensorId),
      );

      if (!hasSearchQuery) {
        return groupStreams;
      }

      return filterVideoStreams(
        groupStreams,
        appliedSearchQuery,
      );
    }

    // 최상위 검색 결과에도 그룹 내부 동영상을 포함
    if (hasSearchQuery) {
      return filteredStreams;
    }

    // 검색하지 않은 최상위 화면은 전체 동영상 집계
    return streams;
  }, [
    appliedSearchQuery,
    currentGroup,
    filteredStreams,
    streams,
  ]);

  const videoSummary = useMemo(() => {
    const totalDurationSeconds = summaryStreams.reduce(
      (total, stream) =>
        total + getStreamDurationSeconds(stream),
      0,
    );

    return {
      count: summaryStreams.length,
      totalDurationSeconds,
    };
  }, [summaryStreams, getStreamDurationSeconds]);

  const formatTotalDuration = (totalSeconds: number) => {
    const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));

    const hours = Math.floor(normalizedSeconds / 3600);
    const minutes = Math.floor((normalizedSeconds % 3600) / 60);
    const seconds = normalizedSeconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${seconds}초`;
    }

    return `${minutes}분 ${seconds}초`
  };

  const isSearching = appliedSearchQuery.trim().length > 0;

  const summaryLabel = currentGroup
    ? currentGroup.name
    : isSearching
      ? '검색 결과'
      : '전체 동영상';

  const handleOpenRenameGroupModal = useCallback(
    (groupId: string) => {
      const targetGroup = videoGroups.find(
        (group) => group.id === groupId,
      );
      if (!targetGroup) {
        console.warn(
          '[VideoManagement] rename target group not found:',
          groupId,
        );
        return;
      }
      setRenameGroupId(targetGroup.id);
      setRenameGroupName(targetGroup.name);
      setRenameGroupError(null);
    },
    [videoGroups],
  );

  const handleCloseRenameGroupModal = useCallback(() => {
    if (isRenamingGroup) {
      return;
    }

    setRenameGroupId(null);
    setRenameGroupName('');
    setRenameGroupError(null);
  }, [isRenamingGroup]);

  const handleConfirmRenameGroup = useCallback(async () => {
    if (!renameGroupId || isRenamingGroup) {
      return;
    }

    const nextName = renameGroupName.trim();

    if (!nextName) {
      setRenameGroupError(
        '그룹 이름을 입력해주세요.',
      );

      return;
    }

    if (nextName.length > 100) {
      setRenameGroupError(
        '그룹 이름은 100자 이하로 입력해주세요.',
      );

      return;
    }

    const targetGroup = videoGroups.find(
      (group) => group.id === renameGroupId,
    );

    if (targetGroup?.name === nextName) {
      setRenameGroupId(null);
      setRenameGroupName('');
      setRenameGroupError(null);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const token =
      window.localStorage.getItem(
        'vss.auth.token',
      );

    if (!token) {
      setRenameGroupError(
        '인증 정보가 없습니다. 다시 로그인해주세요.',
      );

      return;
    }

    setIsRenamingGroup(true);
    setRenameGroupError(null);

    try {
      const response = await fetch(
        '/api/videos/groups',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            group_id: renameGroupId,
            group_name: nextName,
          }),
        },
      );

      const payload =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error ??
          `Failed to rename group: ${response.status}`,
        );
      }

      await fetchVideoGroups();

      setRenameGroupId(null);
      setRenameGroupName('');
      setRenameGroupError(null);
    } catch (error) {
      console.error(
        '[VideoManagement] failed to rename group:',
        error,
      );

      setRenameGroupError(
        error instanceof Error
          ? error.message
          : '그룹 이름 변경에 실패했습니다.',
      );
    } finally {
      setIsRenamingGroup(false);
    }
  }, [
    renameGroupId,
    renameGroupName,
    isRenamingGroup,
    videoGroups,
    fetchVideoGroups,
  ]);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedStreams(new Set(visibleStreams.map((stream) => stream.streamId)));

        setSelectedGroups(
          currentGroup
            ? new Set()
            : new Set(visibleRootGroups.map((group) => group.id)),
        );
      } else {
        setSelectedStreams(new Set());
        setSelectedGroups(new Set());
      }
    },
    [currentGroup, visibleRootGroups, visibleStreams],
  );

  const selectedGroupStreams = useMemo(
    () =>
      Array.from(selectedStreams)
        .map((streamId) =>
          streamsById.get(streamId),
        )
        .filter(
          (stream): stream is StreamInfo =>
            Boolean(stream),
        ),
    [selectedStreams, streamsById],
  );

  const handleCreateGroup = useCallback(() => {
    if (selectedGroupStreams.length === 0) {
      return;
    }

    setNewGroupName(`그룹 ${videoGroups.length + 1}`);
    setIsCreateGroupModalOpen(true);
  }, [selectedGroupStreams.length, videoGroups.length]);

  const handleCloseCreateGroupModal = useCallback(() => {
    if (isCreatingGroup) {
      return;
    }

    setIsCreateGroupModalOpen(false);
    setNewGroupName('');
  }, [isCreatingGroup]);

  const handleConfirmCreateGroup = useCallback(async () => {
    if (selectedGroupStreams.length === 0) {
      handleCloseCreateGroupModal();
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const token = window.localStorage?.getItem('vss.auth.token');

    if (!token) {
      console.warn('Missing auth token; cannot persist video group');
      return;
    }

    const suggestedName = `그룹 ${videoGroups.length + 1}`;
    const nextName = newGroupName.trim() || suggestedName;

    const selectedSensorIds = Array.from(
      new Set(selectedGroupStreams.map((stream) => stream.sensorId).filter(Boolean)),
    );

    if (selectedSensorIds.length === 0) {
      handleCloseCreateGroupModal();
      return;
    }

    setIsCreatingGroup(true);

    try {
      const response = await fetch('/api/videos/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: nextName,
          sensorIds: selectedSensorIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create video group: ${response.status}`);
      }

      const payload = await response.json();

      const nextGroups: VideoGroup[] = Array.isArray(payload?.groups)
        ? payload.groups
          .filter((item: any) => Boolean(item?.id) && Array.isArray(item?.sensorIds))
          .map((item: any) => ({
            id: String(item.id),
            name:
              typeof item.name === 'string' && item.name.trim()
                ? item.name.trim()
                : '새 그룹',
            sensorIds: item.sensorIds
              .map((sensorId: unknown) => String(sensorId))
              .filter(Boolean),
            createdAt:
              typeof item.createdAt === 'string'
                ? item.createdAt
                : new Date().toISOString(),
          }))
        : [];

      setVideoGroups(nextGroups);
      setSelectedStreams(new Set());
      setSelectedGroups(new Set());
      setCurrentGroupId(null);
      setIsCreateGroupModalOpen(false);
      setNewGroupName('');
    } catch (groupError) {
      console.error('Failed to create video group:', groupError);
    } finally {
      setIsCreatingGroup(false);
    }
  }, [
    handleCloseCreateGroupModal,
    newGroupName,
    selectedGroupStreams,
    videoGroups.length,
  ]);

  // Resolve selected stream IDs back to full StreamInfo objects so the confirm
  // dialog can show the user exactly which items are about to be deleted.
  const selectedStreamInfos = useMemo(
    () => streams.filter((s) => selectedStreams.has(s.streamId)),
    [streams, selectedStreams]
  );

  const selectedGroupInfos = useMemo(
    () => videoGroups.filter((group) => selectedGroups.has(group.id)),
    [videoGroups, selectedGroups],
  );

  // Step 1 of delete: just open the confirmation dialog. The Toolbar's "Delete
  // Selected" button is wired to this so a single click never destroys data.
  const handleDeleteSelected = useCallback(() => {
      if ((selectedStreams.size === 0 && selectedGroups.size === 0 ) || isDeleting) {
        return;
      }
    
      setDeleteError(null);
      setShowDeleteConfirm(true);
    }, [selectedGroups.size, selectedStreams.size, isDeleting]
  );

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setShowDeleteConfirm(false);
  }, [isDeleting]);

  async function deleteUploadedVideoOwnershipRecord(stream: StreamInfo,) {
    if (typeof window === 'undefined') {
      return;
    }

    const token =
      window.localStorage.getItem(
        'vss.auth.token',
      );

    if (!token) {
      console.warn(
        '[VideoManagement] Missing auth token; skipping uploaded_videos cleanup',
      );

      return;
    }

    const streamUrl =
      stream.vodUrl ??
      stream.url ??
      null;

    const response = await fetch(
      '/api/videos/delete',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          video_id:
            stream.databaseVideoId ?? null,

          stream_id:
            stream.databaseStreamId ??
            stream.streamId,

          sensor_id:
            stream.databaseSensorId ??
            stream.sensorId,

          filename:
            stream.originalFilename ??
            stream.name,

          video_url:
            stream.databaseVideoUrl ??
            streamUrl,

          file_path:
            stream.databaseVideoUrl ??
            streamUrl,
        }),
      },
    );

    const responsePayload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        responsePayload?.error ??
          `Failed to delete ownership record: ${response.status}`,
      );
    }

    if (
      typeof responsePayload?.deleted?.uploaded === 'number' &&
      responsePayload.deleted.uploaded < 1
    ) {
      throw new Error(
        'No uploaded_videos record was deleted',
      );
    }
  }

  // Step 2 of delete: invoked by the confirm button inside DeleteConfirmDialog.
  // This holds the actual destructive API calls that used to live in
  // handleDeleteSelected.
  const handleConfirmDelete = useCallback(async () => {
    if ((selectedStreams.size === 0 && selectedGroups.size === 0) || isDeleting) {
      return;
    }

    const selectedGroupIds = Array.from(selectedGroups);

    const selectedStreamIds = Array.from(selectedStreams);

    const videoIdToStreams = new Map<string, StreamInfo[]>();

    for (const selectedStreamId of selectedStreamIds) {
      const stream = streams.find((s) => s.streamId === selectedStreamId);
      if (!stream) continue;

      const deleteId = stream.streamId || stream.sensorId;

      if (!deleteId) continue;

      const existing = videoIdToStreams.get(deleteId) || [];
      existing.push(stream);
      videoIdToStreams.set(deleteId, existing);
    }

    const uniqueVideoIds = Array.from(videoIdToStreams.keys());
    setIsDeleting(true);

    try {
      if (selectedGroupIds.length > 0) {
        if (typeof window === 'undefined') {
          throw new Error('Window is unavailable; cannot delete groups');
        }

        const token = window.localStorage?.getItem('vss.auth.token');

        if (!token) {
          throw new Error('Missing auth token; cannot delete video groups');
        }

        const groupDeleteResponse = await fetch('/api/videos/groups', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            groupIds: selectedGroupIds,
          }),
        });

        if (!groupDeleteResponse.ok) {
          throw new Error(`Failed to delete video groups: ${groupDeleteResponse.status}`);
        }
      }

      const deletePromises = uniqueVideoIds.map(async (videoId) => {
        const videoStreams = videoIdToStreams.get(videoId) || [];
      
        const firstStream = videoStreams[0];
      
        if (!agentApiUrl) {
          throw new Error(
            'Agent API URL not configured for video deletion',
          );
        }
      
        let deletedOk = false;
        try {
          await deleteVideo(
            agentApiUrl,
            videoId,
          );
          deletedOk = true;
        } catch (error) {
          console.error(
            '[VideoManagement] deleteVideo failed for',
            videoId,
            error,
          );

          throw error;
        }

        // Only remove ownership record after successful agent-side deletion.
        if (deletedOk && firstStream) {
          await deleteUploadedVideoOwnershipRecord(
            firstStream,
          );
        }
      
        return videoId;
      });

      const results = await Promise.allSettled(deletePromises);

      const failedVideoIds: string[] = [];
      const successfulVideoIds: string[] = [];

      results.forEach((result, index) => {
        const videoId =
          uniqueVideoIds[index];
      
        if (result.status === 'fulfilled') {
          successfulVideoIds.push(videoId);
          return;
        }
      
        failedVideoIds.push(videoId);
      
        console.error(
          '[VideoManagement] delete failed for video',
          videoId,
          result.reason,
        );
      });

      setSelectedStreams((previous) => {
        const next =
          new Set(previous);
      
        for (const successfulVideoId of successfulVideoIds) {
          next.delete(successfulVideoId);
        }
      
        return next;
      });

      if (failedVideoIds.length > 0) {
        throw new Error(
          `${failedVideoIds.length}개 영상 삭제에 실패했습니다: ` +
            failedVideoIds.join(', '),
        );
      }
      
      // 삭제 성공 후 팝업과 선택 상태를 먼저 초기화
      setShowDeleteConfirm(false);
      setDeleteError(null);
      setSelectedStreams(new Set());
      setSelectedGroups(new Set());
      
      // 화면 데이터 갱신 실패는 삭제 실패와 분리
      const refreshResults = await Promise.allSettled([
        refetch(),
        refetchTimelines(),
        fetchVideoGroups(),
      ]);
      
      const refreshFailures = refreshResults.filter(
        (result) => result.status === 'rejected',
      );
      
      if (refreshFailures.length > 0) {
        console.warn(
          '[VideoManagement] deletion succeeded, but refresh failed:',
          refreshFailures,
        );
      }

      // 삭제 결과를 UI에 반영
      await Promise.all([
        refetch(),
        refetchTimelines(),
        fetchVideoGroups(),
      ]);
    } catch (error) {
      console.error('[VideoManagement] deletion failed:', error);
    
      setDeleteError(error instanceof Error ? error.message : '영상 삭제 중 오류가 발생했습니다.');
    
    } finally {
      setIsDeleting(false);
    }
  }, [
    selectedStreams,
    selectedGroups,
    streams,
    isDeleting,
    agentApiUrl,
    refetch,
    refetchTimelines,
    fetchVideoGroups,
  ]);

  const controlsComponent = useMemo(
    () => (
      <VideoManagementSidebarControls
        onFilesSelected={handleFilesSelected}
        enableVideoUpload={enableVideoUpload}
      />
    ),
    [handleFilesSelected, enableVideoUpload]
  );

  useEffect(() => {
    if (onControlsReady && renderControlsInLeftSidebar) {
      onControlsReady({ controlsComponent });
    }
  }, [onControlsReady, renderControlsInLeftSidebar, controlsComponent]);

  const renderMainContent = () => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error || streams.length === 0) {
      return <EmptyState onFilesSelected={handleFilesSelected} enableVideoUpload={enableVideoUpload} />;
    }

    if (
      visibleStreams.length === 0 &&
      (!currentGroup ? visibleRootGroups.length === 0 : true)
    ) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-300">
              {currentGroup ? '그룹 안에 동영상이 없습니다' : '스트림을 찾을 수 없습니다'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {currentGroup
                ? '다른 그룹을 선택하거나 그룹을 다시 구성해 보세요'
                : '검색어나 필터 조건을 조정해 보세요'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <StreamsGrid
        streams={visibleStreams}
        groups={currentGroup ? [] : visibleRootGroups}
        selectedStreams={selectedStreams}
        selectedGroups={selectedGroups}
        vstApiUrl={vstApiUrl}
        onSelectionChange={handleSelectionChange}
        onGroupSelectionChange={handleGroupSelectionChange}
        onSelectAll={handleSelectAll}
        getEndTimeForStream={getEndTimeForStream}
        onPlayStream={handlePlayStream}
        loadingStreamId={loadingStreamId}
        onAddChatQueryContext={addChatQueryContext}
        onOpenGroup={handleOpenGroup}
        onRenameGroup={handleOpenRenameGroupModal}
        onCreateGroup={handleCreateGroup}
        onDeleteSelected={handleDeleteSelected}
        currentGroupName={currentGroup?.name ?? null}
        onBackToGroups={() => {
          setSelectedStreams(new Set());
          setSelectedGroups(new Set());
          setCurrentGroupId(null);
        }}
        onSearchGroup={
          handleSearchGroup
        }
        onShowDetails={handleShowDetails}
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-1 flex-col bg-gray-50 text-gray-900 dark:bg-black dark:text-gray-100">
      {/* Hidden input for upload dialog add-more */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mkv"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const newItems = Array.from(files).map((file) => ({
              id: generateFileId(),
              file,
              isExpanded: false,
              formData: generateDefaultFormData(),
            }));
            setSelectedFiles((prev) => [...prev, ...newItems]);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {/* Toolbar */}
      <Toolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearch={handleSearch}
        onFilesSelected={handleFilesSelected}
        enableVideoUpload={enableVideoUpload}
      />

      {!isLoading && streams.length > 0 && (
        <div
          className={[
            'flex min-h-11 items-center gap-2',
            'border-b border-gray-200 bg-white px-6',
            'text-sm text-gray-500',
            'dark:border-neutral-800 dark:bg-neutral-950',
            'dark:text-gray-400',
          ].join(' ')}
        >
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {summaryLabel}
          </span>
        
          <span aria-hidden="true">·</span>
        
          {currentGroup && isSearching && (
            <span>검색 결과</span>
          )}

          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            {videoSummary.count.toLocaleString()}개
          </strong>
        
          <span aria-hidden="true">·</span>
        
          <span>총 재생시간</span>
        
          <strong className="font-semibold text-gray-900 dark:text-gray-100">
            {formatTotalDuration(
              videoSummary.totalDurationSeconds,
            )}
          </strong>
        </div>
      )}
      
      {/* Main pane: scrollable grid + upload/progress overlays confined to this tab (not full viewport) */}
      <div className="flex flex-1 min-h-0 flex-col relative">
        <div
          className="flex flex-1 min-h-0 flex-col overflow-auto"
          onDragEnter={handleMainDragEnter}
          onDragOver={handleMainDragOver}
          onDragLeave={handleMainDragLeave}
          onDrop={handleMainDrop}
        >
          {renderMainContent()}
        </div>

        {isMainDragOver && enableVideoUpload ? (
          <div
            className={[
              'pointer-events-none absolute inset-0 z-30',
              'flex items-center justify-center',
              'border-2 border-dashed border-green-500',
              'bg-green-500/10 backdrop-blur-[1px]',
            ].join(' ')}
          >
            <div
              className={[
                'rounded-lg border border-green-500',
                'bg-white px-8 py-5 shadow-lg',
                'text-center dark:bg-neutral-900',
              ].join(' ')}
            >
              <p className="text-base font-semibold text-green-500">
                Drop files to upload
              </p>
            
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Movie Files (mp4, mkv)
              </p>
            </div>
          </div>
        ) : null}

        <AgentUploadDialog
          overlay="contained"
          open={showUploadDialog}
          files={selectedFiles}
          configTemplate={configTemplate}
          onAddMore={() => fileInputRef.current?.click()}
          onFilesDropped={(droppedFiles: File[]) => {
            const newItems = droppedFiles.map((file) => ({
              id: generateFileId(),
              file,
              isExpanded: false,
              formData: generateDefaultFormData(),
            }));
          
            setSelectedFiles((prev) => [...prev, ...newItems]);
          }}
          onClose={() => {
            setShowUploadDialog(false);
            setSelectedFiles([]);
          }}
          onConfirmUpload={() => {
            if (selectedFiles.length === 0) return;

            const entries = selectedFiles.map((f) => ({
              id: f.id,
              file: f.file,
              formData: f.formData,
            }));

            if (isUploadingRef.current) {
              pendingFilesQueueRef.current.push(...entries);
              const queuedProgress: UploadProgress[] = entries.map((entry) => ({
                id: entry.id,
                fileName: entry.file.name,
                progress: 0,
                status: 'pending' as const,
              }));
              setUploadProgress((prev) => [...prev, ...queuedProgress]);
            } else {
              const initialProgress: UploadProgress[] = entries.map((entry) => ({
                id: entry.id,
                fileName: entry.file.name,
                progress: 0,
                status: 'pending' as const,
              }));
              setUploadProgress(initialProgress);
              processUploadQueue(entries);
            }

            setShowUploadDialog(false);
            setSelectedFiles([]);
          }}
          onToggleExpand={(id: string) =>
            setSelectedFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f))
            )
          }
          onRemoveFile={(id: string) => setSelectedFiles((prev) => prev.filter((f) => f.id !== id))}
          onFieldChange={(fileId: string, fieldName: string, value: any) =>
            setSelectedFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, formData: { ...f.formData, [fieldName]: value } } : f
              )
            )
          }
        />

        {isCreateGroupModalOpen ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/50"
            onMouseDown={(event) => {
              createGroupBackdropPressedRef.current = event.target === event.currentTarget;
            }}
            onClick={(event) => {
              const shouldClose =
                createGroupBackdropPressedRef.current &&
                event.target === event.currentTarget;

              createGroupBackdropPressedRef.current = false;

              if (shouldClose) {
                handleCloseCreateGroupModal();
              }
            }}
          >
            <div
              className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="mb-2 text-lg font-semibold">그룹 생성</h2>

              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                선택한 동영상을 새 그룹으로 묶습니다.
              </p>

              <label className="mb-1 block text-sm font-medium">그룹명</label>
              <input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="그룹 이름을 입력하세요"
                className="mb-4 w-full rounded border px-3 py-2 text-sm dark:bg-neutral-800"
                autoFocus
              />

              <div className="mb-4 rounded border p-3 text-sm dark:border-neutral-700">
                <div className="mb-2 font-medium">
                  선택한 동영상 목록: 총 {selectedGroupStreams.length}개
                </div>

                <ul className="max-h-40 overflow-auto text-gray-600 dark:text-gray-300">
                  {selectedGroupStreams.map((stream) => (
                    <li key={stream.streamId}>- {stream.name}</li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isCreatingGroup}
                  onClick={handleCloseCreateGroupModal}
                  className="rounded border px-4 py-2 text-sm"
                >
                  닫기
                </button>

                <button
                  type="button"
                  disabled={isCreatingGroup || selectedGroupStreams.length === 0}
                  onClick={handleConfirmCreateGroup}
                  className="rounded bg-cyan-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isCreatingGroup ? '생성 중...' : '생성'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {renameGroupId !== null ? (
          <div
            className={[
              'absolute inset-0 z-50',
              'flex items-center justify-center',
              'bg-black/60 backdrop-blur-sm',
              'px-4',
            ].join(' ')}
            onMouseDown={(event) => {
              renameGroupBackdropPressedRef.current =
                event.target === event.currentTarget;
            }}
            onClick={(event) => {
              const shouldClose =
                renameGroupBackdropPressedRef.current &&
                event.target === event.currentTarget;
            
              renameGroupBackdropPressedRef.current =
                false;
            
              if (shouldClose) {
                handleCloseRenameGroupModal();
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rename-group-title"
              className={[
                'w-full max-w-md overflow-hidden',
                'rounded-2xl',
                'border border-gray-200 dark:border-neutral-700',
                'bg-white dark:bg-neutral-900',
                'shadow-2xl',
              ].join(' ')}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-6 pt-6">
                <div
                  className={[
                    'flex h-10 w-10 shrink-0',
                    'items-center justify-center',
                    'rounded-xl',
                    'bg-cyan-50 text-cyan-600',
                    'dark:bg-cyan-950/50 dark:text-cyan-300',
                  ].join(' ')}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                
                <div className="min-w-0 flex-1">
                  <h2
                    id="rename-group-title"
                    className="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    Rename Group
                  </h2>
                
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    그룹에 사용할 새로운 이름을 입력하세요.
                  </p>
                </div>
                
                <button
                  type="button"
                  aria-label="Close rename group dialog"
                  disabled={isRenamingGroup}
                  onClick={handleCloseRenameGroupModal}
                  className={[
                    'rounded-lg p-1.5',
                    'text-gray-400',
                    'hover:bg-gray-100 hover:text-gray-700',
                    'dark:hover:bg-neutral-800 dark:hover:text-white',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
                
              {/* Body */}
              <div className="px-6 py-5">
                <label
                  htmlFor="rename-group-name"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  Group name
                </label>
                
                <input
                  id="rename-group-name"
                  value={renameGroupName}
                  disabled={isRenamingGroup}
                  maxLength={100}
                  autoFocus
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  onChange={(event) => {
                    setRenameGroupName(
                      event.target.value,
                    );
                  
                    if (renameGroupError) {
                      setRenameGroupError(null);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleConfirmRenameGroup();
                    }
                  
                    if (event.key === 'Escape') {
                      handleCloseRenameGroupModal();
                    }
                  }}
                  placeholder="그룹 이름을 입력하세요"
                  className={[
                    'w-full rounded-xl border px-3.5 py-2.5',
                    'text-sm outline-none transition',
                    'bg-white text-gray-900',
                    'dark:bg-neutral-800 dark:text-white',
                    renameGroupError
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : [
                          'border-gray-300 dark:border-neutral-600',
                          'focus:border-cyan-500',
                          'focus:ring-2 focus:ring-cyan-500/20',
                        ].join(' '),
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  ].join(' ')}
                />

                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    {renameGroupError && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {renameGroupError}
                      </p>
                    )}
                  </div>
                  
                  <span className="shrink-0 text-xs text-gray-400">
                    {renameGroupName.length}/100
                  </span>
                </div>
              </div>
                  
              {/* Footer */}
              <div
                className={[
                  'flex justify-end gap-2',
                  'border-t border-gray-200',
                  'bg-gray-50 px-6 py-4',
                  'dark:border-neutral-700',
                  'dark:bg-neutral-950/60',
                ].join(' ')}
              >
                <button
                  type="button"
                  disabled={isRenamingGroup}
                  onClick={handleCloseRenameGroupModal}
                  className={[
                    'rounded-lg border px-4 py-2',
                    'text-sm font-medium',
                    'border-gray-300 bg-white',
                    'text-gray-700 hover:bg-gray-100',
                    'dark:border-neutral-600',
                    'dark:bg-neutral-800',
                    'dark:text-gray-200',
                    'dark:hover:bg-neutral-700',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  Cancel
                </button>
                
                <button
                  type="button"
                  disabled={
                    isRenamingGroup ||
                    renameGroupName.trim().length === 0
                  }
                  onClick={() => {
                    void handleConfirmRenameGroup();
                  }}
                  className={[
                    'inline-flex min-w-[116px]',
                    'items-center justify-center gap-2',
                    'rounded-lg px-4 py-2',
                    'text-sm font-semibold text-white',
                    'bg-cyan-600 hover:bg-cyan-700',
                    'disabled:cursor-not-allowed',
                    'disabled:opacity-50',
                  ].join(' ')}
                >
                  {isRenamingGroup && (
                    <svg
                      className="animate-spin"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        strokeOpacity="0.25"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        strokeOpacity="1"
                      />
                    </svg>
                  )}

                  {isRenamingGroup
                    ? 'Renaming...'
                    : 'Rename Group'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <UploadProgressPanel
          uploads={uploadProgress}
          onClose={handleClearUploadProgress}
          onCancel={handleCancelUploads}
        />

        <DeleteConfirmDialog
          overlay="contained"
          isOpen={showDeleteConfirm}
          streams={selectedStreamInfos}
          groups={selectedGroupInfos}
          isDeleting={isDeleting}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </div>

      {/* Video Playback Modal */}
      <VideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={videoModal.title}
        onClose={closeVideoModal}
      />
      <VideoDetailsModal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} video={detailsVideo} />
    </div>
  );
};

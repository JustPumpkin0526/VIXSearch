// SPDX-License-Identifier: MIT
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  VideoManagementComponentProps,
  UploadProgress,
  StreamInfo,
  VideoGroup,
} from './types';
import { useStreams, useStorageTimelines } from './hooks';
import { filterStreams, isRtspStream } from './utils';
import {
  UploadFilesDialog,
  VideoModal,
  useVideoModal,
  useChatVideoUploadCompleteSubscription,
} from '@nemo-agent-toolkit/ui';
import { chunkedUpload, notifyUploadComplete } from './chunkedUpload';
import { createApiEndpoints } from './api';
import { deleteRtspStream } from './rtspStream';
import { deleteVideo } from './videoDelete';
import { NUM_PARALLEL_FILE_UPLOADS } from './constants';
import {
  AddRtspDialog,
  DeleteConfirmDialog,
  EmptyState,
  LoadingState,
  StreamsGrid,
  Toolbar,
  UploadProgressPanel,
  VideoManagementSidebarControls,
  AgentUploadDialog,
} from './components';

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
  const enableAddRtspButton = videoManagementData?.enableAddRtspButton ?? true;
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

  const [isRtspModalOpen, setIsRtspModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchInputValueRef = useRef('');
  const [showVideos, setShowVideos] = useState(true);
  const [showRtsps, setShowRtsps] = useState(true);
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
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

  const createGroupBackdropPressedRef = useRef(false);

  const isUploadingRef = useRef(false);
  const uploadSessionIdRef = useRef(0);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFilesQueueRef = useRef<Array<{ id: string; file: File }>>([]);

  function pickNonEmptyString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }

      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return null;
  }

  function getUploadVideoId(uploadResponse: any): string | null {
    // VST 응답에서 stream/video ID로 쓰일 수 있는 값
    return pickNonEmptyString(
      uploadResponse?.streamId,
      uploadResponse?.stream_id,
      uploadResponse?.video_id,
      uploadResponse?.videoId,
      uploadResponse?.id,
    );
  }

  function getUploadSensorId(uploadResponse: any): string | null {
    // VST 응답에서 sensor ID/name으로 쓰일 수 있는 값
    return pickNonEmptyString(
      uploadResponse?.sensorId,
      uploadResponse?.sensor_id,
      uploadResponse?.sensor,
    );
  }

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  // Sync display filter state with enabled features so label and filter stay correct
  useEffect(() => {
    if (!enableAddRtspButton) setShowRtsps(false);
  }, [enableAddRtspButton]);
  useEffect(() => {
    if (!enableVideoUpload) setShowVideos(false);
  }, [enableVideoUpload]);

  const { streams, isLoading, error, refetch } = useStreams({ vstApiUrl });
  const { getEndTimeForStream, getLastTimelineForStream, refetch: refetchTimelines } = useStorageTimelines({ vstApiUrl });
  const { videoModal, openVideoModal, closeVideoModal } = useVideoModal(vstApiUrl ?? undefined);

  
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
    if (!showVideos) {
      return [];
    }
  
    const normalizedQuery = appliedSearchQuery.trim().toLowerCase();
  
    if (!normalizedQuery) {
      return videoGroups;
    }
  
    return videoGroups.filter((group) => {
      if (group.name.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
    
      return group.sensorIds.some((sensorId) => {
        const streamName = streamsBySensorId.get(sensorId)?.name ?? '';
        return streamName.toLowerCase().includes(normalizedQuery);
      });
    });
  }, [appliedSearchQuery, showVideos, streamsBySensorId, videoGroups]);

  const filteredStreams = useMemo(
    () => filterStreams(streams, showVideos, showRtsps, appliedSearchQuery),
    [streams, showVideos, showRtsps, appliedSearchQuery]
  );

  const visibleStreams = useMemo(() => {
    if (currentGroup) {
      const currentGroupSensorIds = new Set(currentGroup.sensorIds);

      return filteredStreams.filter(
        (stream) =>
          !isRtspStream(stream) && currentGroupSensorIds.has(stream.sensorId),
      );
    }

    return filteredStreams.filter((stream) => {
      if (isRtspStream(stream)) {
        return true;
      }

      return !groupedSensorIds.has(stream.sensorId);
    });
  }, [currentGroup, filteredStreams, groupedSensorIds]);

  const { hasVideoStreams, hasRtspStreams } = useMemo(() => {
    const hasVideo = streams.some((stream) => !isRtspStream(stream));
    const hasRtsp = streams.some(isRtspStream);
    return { hasVideoStreams: hasVideo, hasRtspStreams: hasRtsp };
  }, [streams]);

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

        if (!isSessionValid()) return;

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
          const token =
            typeof window !== 'undefined'
              ? window.localStorage.getItem('vss.auth.token')
              : null;
                
          if (token) {
            const originalFilename = file.name || '';
            const normalizedFilename =
              originalFilename.replace(/\.[^.]+$/, '') || originalFilename;
                      
            const uploadVideoId = getUploadVideoId(videoUploadApiResponse);
            const uploadSensorId = getUploadSensorId(videoUploadApiResponse);

            const response = await fetch('/api/videos/complete', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                video_id: uploadVideoId,
                sensor_id: uploadSensorId,
              
                filename: normalizedFilename,
                storage_filename: (videoUploadApiResponse as any).filename ?? originalFilename,
                video_url:
                  (videoUploadApiResponse as any).filePath ??
                  (videoUploadApiResponse as any).url ??
                  (videoUploadApiResponse as any).video_url ??
                  null,
                uploaded_at: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                bytes: (videoUploadApiResponse as any).bytes ?? file.size ?? null,
              }),
              signal: abortController.signal,
            });
          
            if (!response.ok) {
              const message = await response.text();
              console.warn(
                '[VideoManagement] failed to persist uploaded video ownership:',
                response.status,
                message,
              );
            }
          }
        } catch (ownershipError) {
          console.warn(
            '[VideoManagement] failed to persist uploaded video ownership record',
            ownershipError,
          );
        }

        if (!isSessionValid()) return;

        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && (p.status === 'uploading' || p.status === 'processing') ? {
            ...p,
            status: 'success',
            progress: 100,
          } : p))
        );
      } catch (err) {
        if (!isSessionValid()) return;

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

      if (!isSessionValid()) return;

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
  }, [vstApiUrl, agentApiUrl]);

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

  const handleAddRtspClick = () => {
    setIsRtspModalOpen(true);
  };

  const handleRtspDialogClose = () => {
    setIsRtspModalOpen(false);
  };

  const handleRtspSuccess = useCallback(() => {
    refetchRef.current();
    refetchTimelinesRef.current();
  }, []);

  const handlePlayStream = useCallback(async (stream: StreamInfo) => {
    let startTime: string;
    let endTime: string;

    if (isRtspStream(stream)) {
      const now = new Date();
      endTime = new Date(now.getTime() - 5000).toISOString();
      startTime = new Date(now.getTime() - 35000).toISOString();
    } else {
      const range = getLastTimelineForStream(stream.streamId);
      if (!range) return;
      startTime = range.startTime;
      endTime = range.endTime;
    }

    setLoadingStreamId(stream.streamId);
    try {
      await openVideoModal({
        video_name: stream.name,
        start_time: startTime,
        end_time: endTime,
        sensor_id: stream.sensorId,
      });
    } catch {
      // openVideoModal handles errors internally; catch to prevent unhandled rejection
    } finally {
      setLoadingStreamId(null);
    }
  }, [getLastTimelineForStream, openVideoModal]);

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
        .map((streamId) => streamsById.get(streamId))
        .filter(
          (stream): stream is StreamInfo =>
            Boolean(stream) && !isRtspStream(stream as StreamInfo),
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
    if ((selectedStreams.size === 0 && selectedGroups.size === 0) || isDeleting) {
      return;
    }

    setShowDeleteConfirm(true);
  }, [selectedGroups.size, selectedStreams.size, isDeleting]);

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setShowDeleteConfirm(false);
  }, [isDeleting]);

  async function deleteUploadedVideoOwnershipRecord(stream: StreamInfo) {
    if (typeof window === 'undefined') return;

    const token = window.localStorage.getItem('vss.auth.token');

    if (!token) {
      console.warn('[VideoManagement] Missing auth token; skipping uploaded_videos cleanup');
      return;
    }

    const response = await fetch('/api/videos/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        video_id: stream.streamId || stream.sensorId,
        videoId: stream.streamId || stream.sensorId,
            
        sensor_id: stream.sensorId,
        sensorId: stream.sensorId,
            
        filename: stream.name,
        video_url: stream.vodUrl ?? stream.url ?? null,
        filePath: stream.vodUrl ?? stream.url ?? null,
      }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      console.warn(
        '[VideoManagement] failed to delete uploaded_videos ownership record:',
        response.status,
        message,
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
    
      const deleteId = isRtspStream(stream)
        ? stream.sensorId
        : stream.streamId || stream.sensorId;
    
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

        if (firstStream && isRtspStream(firstStream)) {
          if (!agentApiUrl) {
            throw new Error('Agent API URL not configured for RTSP stream deletion');
          }
        
          await deleteRtspStream(agentApiUrl, firstStream.name);
          return videoId;
        }
      
        if (!agentApiUrl) {
          throw new Error('Agent API URL not configured for video deletion');
        }
      
        // 핵심 수정: uploaded video 삭제는 streamId/videoId 기준
        await deleteVideo(agentApiUrl, videoId);
      
        if (firstStream) {
          await deleteUploadedVideoOwnershipRecord(firstStream);
        }
      
        return videoId;
      });

      const results = await Promise.allSettled(deletePromises);
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.error('[VideoManagement] delete failed for video', uniqueVideoIds[idx], r.reason);
        }
      });
      setSelectedStreams(new Set());
      setSelectedGroups(new Set());

      await Promise.all([
        refetch(),
        refetchTimelines(),
        fetchVideoGroups(),
      ]);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
        showVideos={showVideos}
        showRtsps={showRtsps}
        getEndTimeForStream={getEndTimeForStream}
        onPlayStream={handlePlayStream}
        loadingStreamId={loadingStreamId}
        onAddChatQueryContext={addChatQueryContext}
        onOpenGroup={handleOpenGroup}
        onCreateGroup={handleCreateGroup}
        onDeleteSelected={handleDeleteSelected}
        currentGroupName={currentGroup?.name ?? null}
        onBackToGroups={() => {
          setSelectedStreams(new Set());
          setSelectedGroups(new Set());
          setCurrentGroupId(null);
        }}
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
        showVideos={showVideos}
        showRtsps={showRtsps}
        onShowVideosChange={setShowVideos}
        onShowRtspsChange={setShowRtsps}
        onFilesSelected={handleFilesSelected}
        onAddRtspClick={handleAddRtspClick}
        selectedCount={selectedStreams.size + selectedGroups.size}
        onDeleteSelected={handleDeleteSelected}
        isDeleting={isDeleting}
        enableAddRtspButton={enableAddRtspButton}
        enableVideoUpload={enableVideoUpload}
        hasVideoStreams={hasVideoStreams}
        hasRtspStreams={hasRtspStreams}
      />

      {/* Main pane: scrollable grid + upload/progress overlays confined to this tab (not full viewport) */}
      <div className="flex flex-1 min-h-0 flex-col relative">
        <div className="flex flex-1 min-h-0 flex-col overflow-auto">{renderMainContent()}</div>

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

        <UploadProgressPanel
          uploads={uploadProgress}
          onClose={handleClearUploadProgress}
          onCancel={handleCancelUploads}
        />

        <AddRtspDialog
          overlay="contained"
          isOpen={isRtspModalOpen}
          agentApiUrl={agentApiUrl}
          onClose={handleRtspDialogClose}
          onSuccess={handleRtspSuccess}
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
    </div>
  );
};

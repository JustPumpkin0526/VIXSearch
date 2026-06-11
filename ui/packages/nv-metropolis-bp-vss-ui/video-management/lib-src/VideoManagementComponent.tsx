// SPDX-License-Identifier: MIT
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { VideoModal } from '@nemo-agent-toolkit/ui';
import type { VideoManagementComponentProps, UploadProgress, StreamInfo, VideoGroup } from './types';
import { useStreams, useStorageTimelines } from './hooks';
import { filterStreams, isRtspStream } from './utils';
import { uploadFile } from '@nemo-agent-toolkit/ui';
import { deleteRtspStream } from './rtspStream';
import { deleteVideo } from './videoDelete';
import { useVideoModal } from './hooks/useVideoModal';
import { NUM_PARALLEL_FILE_UPLOADS } from './constants';
import {
  EmptyState,
  LoadingState,
  StreamsGrid,
  Toolbar,
  UploadProgressPanel,
  VideoManagementSidebarControls,
  AgentUploadDialog,
} from './components';

const UPLOAD_CHUNK_DURATION_STORAGE_KEY = 'vss.videoManagement.upload.chunkDuration';
const DEFAULT_UPLOAD_CHUNK_DURATION = 5;
const FORCED_UPLOAD_EMBEDDING_ENABLED = true;

export type { VideoManagementComponentProps, VideoManagementSidebarControlHandlers } from './types';

export const VideoManagementComponent: React.FC<VideoManagementComponentProps> = ({
  videoManagementData,
  renderControlsInLeftSidebar = false,
  onControlsReady,
  isActive = true,
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

  const [uploadChunkDuration, setUploadChunkDuration] = useState(DEFAULT_UPLOAD_CHUNK_DURATION);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedValue = window.localStorage.getItem(UPLOAD_CHUNK_DURATION_STORAGE_KEY);
    if (savedValue == null) {
      setUploadChunkDuration(DEFAULT_UPLOAD_CHUNK_DURATION);
      return;
    }

    const parsedValue = Number(savedValue);
    setUploadChunkDuration(Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_UPLOAD_CHUNK_DURATION);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(UPLOAD_CHUNK_DURATION_STORAGE_KEY, String(uploadChunkDuration));
  }, [uploadChunkDuration]);

  // Generate default form data from config template (same as Chat component)
  const generateDefaultFormData = useCallback(
    (
      embeddingEnabled: boolean = FORCED_UPLOAD_EMBEDDING_ENABLED,
      chunkDuration: number = uploadChunkDuration
    ): Record<string, any> => {
      const baseFormData = !configTemplate || !Array.isArray(configTemplate.fields)
        ? {}
        : configTemplate.fields.reduce((acc: Record<string, any>, field: any) => {
            acc[field['field-name']] = field['field-default-value'];
            return acc;
          }, {} as Record<string, any>);

      return {
        ...baseFormData,
        embedding: embeddingEnabled,
        chunk_duration: Math.max(0, chunkDuration),
      };
    },
    [configTemplate, uploadChunkDuration]
  );

  const generateFileId = useCallback(() => {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchInputValueRef = useRef('');
  const [showVideos, setShowVideos] = useState(true);
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [detailStream, setDetailStream] = useState<StreamInfo | null>(null);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const isUploadingRef = useRef(false);
  const createGroupBackdropPressedRef = useRef(false);
  const detailBackdropPressedRef = useRef(false);
  const uploadSessionIdRef = useRef(0);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFilesQueueRef = useRef<Array<{ id: string; file: File }>>([]);

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  useEffect(() => {
    if (!enableVideoUpload) setShowVideos(false);
  }, [enableVideoUpload]);

  const { streams, isLoading, error, refetch } = useStreams({ vstApiUrl });
  const { getEndTimeForStream, getTimelineRangeForStream, refetch: refetchTimelines } = useStorageTimelines({ vstApiUrl });
  const { videoModal, openVideoModal, closeVideoModal } = useVideoModal(vstApiUrl, getTimelineRangeForStream);

  useEffect(() => {
    if (currentGroupId && !videoGroups.some((group) => group.id === currentGroupId)) {
      setCurrentGroupId(null);
    }
  }, [currentGroupId, videoGroups]);

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
    const nextGroups = Array.isArray(payload?.groups)
      ? payload.groups
          .filter((item: any) => Boolean(item?.id) && Array.isArray(item?.sensorIds))
          .map((item: any) => ({
            id: String(item.id),
            name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '새 그룹',
            sensorIds: item.sensorIds.map((sensorId: unknown) => String(sensorId)).filter(Boolean),
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          }))
      : [];

    setVideoGroups(nextGroups);
    return nextGroups;
  }, []);

  const filteredStreams = useMemo(
    () => filterStreams(streams, showVideos, false, appliedSearchQuery),
    [streams, showVideos, appliedSearchQuery]
  );

  const streamsById = useMemo(
    () => new Map(streams.map((stream) => [stream.streamId, stream])),
    [streams]
  );

  const streamsBySensorId = useMemo(
    () => new Map(streams.map((stream) => [stream.sensorId, stream])),
    [streams]
  );

  const currentGroup = useMemo(
    () => videoGroups.find((group) => group.id === currentGroupId) ?? null,
    [currentGroupId, videoGroups]
  );

  const groupedSensorIds = useMemo(() => {
    const ids = new Set<string>();
    videoGroups.forEach((group) => {
      group.sensorIds.forEach((sensorId) => ids.add(sensorId));
    });
    return ids;
  }, [videoGroups]);

  const visibleRootGroups = useMemo(() => {
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
  }, [appliedSearchQuery, streamsBySensorId, videoGroups]);

  const visibleStreams = useMemo(() => {
    if (currentGroup) {
      const currentGroupSensorIds = new Set(currentGroup.sensorIds);
      return filteredStreams.filter((stream) => currentGroupSensorIds.has(stream.sensorId));
    }

    return filteredStreams.filter((stream) => !groupedSensorIds.has(stream.sensorId));
  }, [currentGroup, filteredStreams, groupedSensorIds]);

  const selectedGroupStreams = useMemo(
    () => Array.from(selectedStreams)
      .map((streamId) => streamsById.get(streamId))
      .filter((stream): stream is StreamInfo => Boolean(stream)),
    [selectedStreams, streamsById]
  );

  const detailTimelineRange = useMemo(
    () => (detailStream ? getTimelineRangeForStream(detailStream.streamId) : null),
    [detailStream, getTimelineRangeForStream]
  );

  const refetchRef = useRef(refetch);
  const refetchTimelinesRef = useRef(refetchTimelines);
  const vstApiUrlRef = useRef(vstApiUrl);

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

      const uploadStartedAtMs = Date.now();

      setUploadProgress((prev) =>
        prev.map((p) =>
          p.id === id && p.status === 'pending'
            ? {
                ...p,
                status: 'uploading',
                uploadStartedAtMs,
              }
            : p
        )
      );

      try {
        // Use agent API upload (get URL then PUT)
        if (!agentApiUrl) {
          throw new Error('Agent API URL not configured');
        }
        
        const agentResponse = await uploadFile(
          file, 
          agentApiUrl, 
          formData ?? generateDefaultFormData(),
          (progress) => {
            if (!isSessionValid() || abortController.signal.aborted) return;
            setUploadProgress((prev) =>
              prev.map((p) => (p.id === id && p.status === 'uploading' ? { ...p, progress } : p))
            );
          }, 
          abortController.signal,
          () => {
            if (!isSessionValid() || abortController.signal.aborted || formData?.embedding === false) {
              return;
            }

            const uploadCompletedAtMs = Date.now();

            setUploadProgress((prev) =>
              prev.map((p) =>
                p.id === id && p.status === 'uploading'
                  ? {
                      ...p,
                      status: 'embedding',
                      progress: 100,
                      uploadDurationMs: uploadCompletedAtMs - uploadStartedAtMs,
                      embeddingStartedAtMs: uploadCompletedAtMs,
                      embeddingEnabled: true,
                    }
                  : p
              )
            );
          }
        );

        if (!isSessionValid()) return;

        const shouldRunEmbedding = formData?.embedding !== false;
        const uploadCompletedAtMs = Date.now();
        const uploadDurationMs = uploadCompletedAtMs - uploadStartedAtMs;
        const embeddingDurationMs =
          shouldRunEmbedding
            ? Math.max(
                0,
                uploadCompletedAtMs
                  - (uploadProgressRef.current.find((entry) => entry.id === id)?.embeddingStartedAtMs ?? uploadCompletedAtMs)
              )
            : undefined;

        setUploadProgress((prev) =>
          prev.map((p) =>
            p.id === id && (p.status === 'uploading' || p.status === 'embedding')
              ? {
                  ...p,
                  status: 'success',
                  progress: 100,
                  streamId: agentResponse?.streamId ?? p.streamId,
                  sensorId: agentResponse?.sensorId ?? p.sensorId,
                  embeddingEnabled: shouldRunEmbedding,
                  uploadDurationMs,
                  embeddingDurationMs,
                }
              : p
          )
        );
        // Notify server about completed upload so it can persist a user_videos record
        try {
          if (shouldRunEmbedding) {
            return;
          }

          const token = typeof window !== 'undefined' ? window.localStorage.getItem('vss.auth.token') : null;
          const originalFilename = file?.name ?? null;
          const normalizedFilename = originalFilename?.replace(/\.[^.]+$/, '') ?? originalFilename;
          const payload = {
            video_id: agentResponse?.streamId ?? null,
            filename: normalizedFilename,
            storage_filename: agentResponse?.filename ?? null,
            video_url: agentResponse?.filePath ?? null,
            uploaded_at: new Date().toISOString(),
            bytes: agentResponse.bytes ?? null,
            sensor_id: agentResponse?.sensorId ?? null,
            timestamp: agentResponse?.timestamp ?? null,
          } as any;

          if (!payload.video_id) {
            // eslint-disable-next-line no-console
            console.warn('Upload completed but no video identifier available in agent response', agentResponse);
          }

          await fetch('/api/videos/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          // Non-fatal: log and continue
          // eslint-disable-next-line no-console
          console.warn('Failed to notify server of completed upload', err);
        }
      } catch (err) {
        if (!isSessionValid()) return;

        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        const isCancelled = err instanceof Error && (err.name === 'AbortError' || err.message === 'Upload was cancelled');

        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && (p.status === 'uploading' || p.status === 'pending') ? { 
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
    await Promise.all([refetchRef.current(), refetchTimelinesRef.current()]);
  }, [agentApiUrl, generateDefaultFormData]);

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
  }, [generateDefaultFormData, generateFileId]);

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
      prev.map((p) => (p.status === 'pending' || p.status === 'uploading' ? { ...p, status: 'cancelled' } : p))
    );
    setIsUploading(false);

    if (successCount > 0) {
      await Promise.all([refetchRef.current(), refetchTimelinesRef.current()]);
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

  const handleGroupSelectionChange = useCallback((groupId: string, selected: boolean) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(groupId);
      } else {
        next.delete(groupId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedStreams(new Set(visibleStreams.map((stream) => stream.streamId)));
      setSelectedGroups(currentGroup ? new Set() : new Set(visibleRootGroups.map((group) => group.id)));
    } else {
      setSelectedStreams(new Set());
      setSelectedGroups(new Set());
    }
  }, [currentGroup, visibleRootGroups, visibleStreams]);

  const handleOpenGroup = useCallback((groupId: string) => {
    setSelectedStreams(new Set());
    setSelectedGroups(new Set());
    setCurrentGroupId(groupId);
  }, []);

  const handleBackToGroups = useCallback(() => {
    setSelectedStreams(new Set());
    setSelectedGroups(new Set());
    setCurrentGroupId(null);
  }, []);

  const handleOpenSelectedDetails = useCallback(() => {
    if (selectedStreams.size !== 1 || selectedGroups.size !== 0) {
      return;
    }

    const selectedStreamId = Array.from(selectedStreams)[0];
    const stream = streamsById.get(selectedStreamId);
    if (!stream) {
      return;
    }

    setDetailStream(stream);
  }, [selectedGroups.size, selectedStreams, streamsById]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailStream(null);
  }, []);

  const handleDetailBackdropMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    detailBackdropPressedRef.current = event.target === event.currentTarget;
  }, []);

  const handleDetailBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose = detailBackdropPressedRef.current && event.target === event.currentTarget;
    detailBackdropPressedRef.current = false;

    if (shouldClose) {
      handleCloseDetailModal();
    }
  }, [handleCloseDetailModal]);

  const handleCreateGroup = useCallback(() => {
    if (selectedStreams.size === 0) {
      return;
    }

    setNewGroupName(`그룹 ${videoGroups.length + 1}`);
    setIsCreateGroupModalOpen(true);
  }, [selectedStreams.size, videoGroups.length]);

  const handleCloseCreateGroupModal = useCallback(() => {
    if (isCreatingGroup) {
      return;
    }

    setIsCreateGroupModalOpen(false);
    setNewGroupName('');
  }, [isCreatingGroup]);

  const handleCreateGroupBackdropMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    createGroupBackdropPressedRef.current = event.target === event.currentTarget;
  }, []);

  const handleCreateGroupBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose = createGroupBackdropPressedRef.current && event.target === event.currentTarget;
    createGroupBackdropPressedRef.current = false;

    if (shouldClose) {
      handleCloseCreateGroupModal();
    }
  }, [handleCloseCreateGroupModal]);

  const handleConfirmCreateGroup = useCallback(async () => {
    if (selectedStreams.size === 0) {
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
      new Set(
        Array.from(selectedStreams)
          .map((streamId) => streamsById.get(streamId)?.sensorId)
          .filter((sensorId): sensorId is string => Boolean(sensorId))
      )
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
      const nextGroups = Array.isArray(payload?.groups)
        ? payload.groups
            .filter((item: any) => Boolean(item?.id) && Array.isArray(item?.sensorIds))
            .map((item: any) => ({
              id: String(item.id),
              name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '새 그룹',
              sensorIds: item.sensorIds.map((sensorId: unknown) => String(sensorId)).filter(Boolean),
              createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
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
  }, [handleCloseCreateGroupModal, newGroupName, selectedStreams, streamsById, videoGroups.length]);

  const handleDeleteSelected = useCallback(async () => {
    if ((selectedStreams.size === 0 && selectedGroups.size === 0) || isDeleting) return;

    const selectedStreamIds = Array.from(selectedStreams);
    const selectedGroupIds = Array.from(selectedGroups);

    // Group streams by sensorId and track their info
    const sensorToStreams = new Map<string, StreamInfo[]>();
    for (const streamId of selectedStreamIds) {
      const stream = streams.find(s => s.streamId === streamId);
      if (stream) {
        const existing = sensorToStreams.get(stream.sensorId) || [];
        existing.push(stream);
        sensorToStreams.set(stream.sensorId, existing);
      }
    }

    const uniqueSensorIds = Array.from(sensorToStreams.keys());
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
          body: JSON.stringify({ groupIds: selectedGroupIds }),
        });

        if (!groupDeleteResponse.ok) {
          throw new Error(`Failed to delete video groups: ${groupDeleteResponse.status}`);
        }
      }

      const deletePromises = uniqueSensorIds.map(async (sensorId) => {
        const sensorStreams = sensorToStreams.get(sensorId) || [];
        const firstStream = sensorStreams[0];
        
        // Check if this is an RTSP stream - must use agent API (by sensor name)
        if (firstStream && isRtspStream(firstStream)) {
          if (!agentApiUrl) {
            throw new Error('Agent API URL not configured for RTSP stream deletion');
          }
          await deleteRtspStream(agentApiUrl, firstStream.name);
          return sensorId;
        }

        // Uploaded videos: use agent delete video API only (same as RTSP - no VST fallback)
        if (!agentApiUrl) {
          throw new Error('Agent API URL not configured for video deletion');
        }
        await deleteVideo(agentApiUrl, sensorId);
        return sensorId;
      });

      await Promise.allSettled(deletePromises);
      setSelectedStreams(new Set());
      setSelectedGroups(new Set());
      setDetailStream(null);
      await Promise.all([refetch(), refetchTimelines(), fetchVideoGroups()]);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedStreams, selectedGroups, streams, isDeleting, agentApiUrl, refetch, refetchTimelines, fetchVideoGroups]);

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

    if (visibleStreams.length === 0 && (!currentGroup ? visibleRootGroups.length === 0 : true)) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-300">
              {currentGroup ? '그룹 안에 동영상이 없습니다' : '스트림을 찾을 수 없습니다'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {currentGroup ? '다른 그룹을 선택하거나 그룹을 다시 구성해 보세요' : '검색어나 필터 조건을 조정해 보세요'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <StreamsGrid
        streams={visibleStreams}
        groups={currentGroup ? [] : visibleRootGroups}
        streamsById={streamsById}
        selectedStreams={selectedStreams}
        selectedGroups={selectedGroups}
        vstApiUrl={vstApiUrl}
        onSelectionChange={handleSelectionChange}
        onGroupSelectionChange={handleGroupSelectionChange}
        onSelectAll={handleSelectAll}
        getEndTimeForStream={getEndTimeForStream}
        onPlayVideo={openVideoModal}
        onOpenGroup={handleOpenGroup}
        onCreateGroup={handleCreateGroup}
        onDeleteSelected={handleDeleteSelected}
        onViewSelectedDetails={handleOpenSelectedDetails}
        currentGroupName={currentGroup?.name ?? null}
        onBackToGroups={currentGroup ? handleBackToGroups : undefined}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
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

      {/* Upload dialog */}
      <AgentUploadDialog
          open={showUploadDialog}
          files={selectedFiles}
          configTemplate={configTemplate}
          uploadChunkDuration={uploadChunkDuration}
          onUploadChunkDurationChange={setUploadChunkDuration}
          onAddMore={() => fileInputRef.current?.click()}
          onClose={() => {
            setShowUploadDialog(false);
            setSelectedFiles([]);
          }}
          onConfirmUpload={(settingsOverride) => {
            if (selectedFiles.length === 0) return;
            const effectiveChunkDuration = settingsOverride?.uploadChunkDuration ?? uploadChunkDuration;
            
            const entries = selectedFiles.map((f) => ({
              id: f.id,
              file: f.file,
              formData: {
                ...generateDefaultFormData(FORCED_UPLOAD_EMBEDDING_ENABLED, effectiveChunkDuration),
                ...f.formData,
                embedding: FORCED_UPLOAD_EMBEDDING_ENABLED,
                chunk_duration: effectiveChunkDuration,
              },
            }));
            
            // If already uploading, add to queue
            if (isUploadingRef.current) {
              pendingFilesQueueRef.current.push(...entries);
              const queuedProgress: UploadProgress[] = entries.map((entry) => ({
                id: entry.id,
                fileName: entry.file.name,
                progress: 0,
                embeddingEnabled: true,
                status: 'pending' as const,
              }));
              setUploadProgress((prev) => [...prev, ...queuedProgress]);
            } else {
              // Start new upload session
              const initialProgress: UploadProgress[] = entries.map((entry) => ({
                id: entry.id,
                fileName: entry.file.name,
                progress: 0,
                embeddingEnabled: true,
                status: 'pending' as const,
              }));
              setUploadProgress(initialProgress);
              processUploadQueue(entries);
            }
            
            setShowUploadDialog(false);
            setSelectedFiles([]);
          }}
          onToggleExpand={(id) =>
            setSelectedFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f))
            )
          }
          onRemoveFile={(id) => setSelectedFiles((prev) => prev.filter((f) => f.id !== id))}
          onFieldChange={(fileId, fieldName, value) =>
            setSelectedFiles((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, formData: { ...f.formData, [fieldName]: value } } : f
              )
            )
          }
        />

      {isCreateGroupModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={handleCreateGroupBackdropMouseDown}
          onClick={handleCreateGroupBackdropClick}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">그룹 생성</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  선택한 동영상을 새 그룹으로 묶습니다.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="video-group-name"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  그룹명
                </label>
                <input
                  id="video-group-name"
                  type="text"
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="그룹 이름을 입력하세요"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">선택한 동영상 목록</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">총 {selectedGroupStreams.length}개</span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60">
                  {selectedGroupStreams.length > 0 ? (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {selectedGroupStreams.map((stream) => (
                        <li
                          key={stream.streamId}
                          className="px-4 py-3"
                        >
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{stream.name}</p>
                          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{stream.streamId}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      선택된 동영상이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseCreateGroupModal}
                disabled={isCreatingGroup}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateGroup}
                disabled={selectedGroupStreams.length === 0 || isCreatingGroup}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300 dark:disabled:bg-cyan-800"
              >
                {isCreatingGroup ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      

      {/* Main content area */}
      {renderMainContent()}
      {detailStream ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={handleDetailBackdropMouseDown}
          onClick={handleDetailBackdropClick}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">동영상 상세 보기</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">선택한 동영상의 기본 정보를 확인합니다.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">기본 정보</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">이름</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailStream.name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">스트림 ID</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailStream.streamId}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">센서 ID</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailStream.sensorId}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">유형</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{isRtspStream(detailStream) ? 'RTSP' : '업로드 동영상'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">미디어 정보</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">해상도</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{detailStream.metadata.resolution || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">코덱</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{detailStream.metadata.codec || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">프레임레이트</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{detailStream.metadata.framerate || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">비트레이트</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{detailStream.metadata.bitrate || '-'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">재생 구간</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">시작 시간</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailTimelineRange?.startTime ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">종료 시간</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailTimelineRange?.endTime ?? '-'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">소스 경로</p>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">원본 URL</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailStream.url || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">VOD URL</dt>
                    <dd className="mt-1 break-all text-gray-900 dark:text-gray-100">{detailStream.vodUrl || '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <VideoModal
        isOpen={videoModal.isOpen}
        videoUrl={videoModal.videoUrl}
        title={videoModal.title}
        onClose={closeVideoModal}
      />
      {/* Upload Progress Panel */}
      <UploadProgressPanel
        uploads={uploadProgress}
        onClose={handleClearUploadProgress}
        onCancel={handleCancelUploads}
      />
    </div>
  );
};

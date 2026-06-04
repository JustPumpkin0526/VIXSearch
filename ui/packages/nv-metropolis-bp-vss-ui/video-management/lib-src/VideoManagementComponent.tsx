// SPDX-License-Identifier: MIT
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { VideoManagementComponentProps, UploadProgress, StreamInfo } from './types';
import { useStreams, useStorageTimelines } from './hooks';
import { filterStreams, isRtspStream } from './utils';
import { uploadFile } from '@nemo-agent-toolkit/ui';
import { deleteRtspStream } from './rtspStream';
import { deleteVideo } from './videoDelete';
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

const UPLOAD_EMBEDDING_STORAGE_KEY = 'vss.videoManagement.upload.embedding';
const UPLOAD_CHUNK_DURATION_STORAGE_KEY = 'vss.videoManagement.upload.chunkDuration';
const DEFAULT_UPLOAD_CHUNK_DURATION = 5;

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

  const defaultEmbeddingEnabled = useMemo(() => {
    if (!configTemplate || !Array.isArray(configTemplate.fields)) {
      return false;
    }

    const embeddingField = configTemplate.fields.find(
      (field: any) => field?.['field-name'] === 'embedding'
    );

    return embeddingField?.['field-default-value'] === true;
  }, [configTemplate]);

  const [uploadEmbeddingEnabled, setUploadEmbeddingEnabled] = useState(defaultEmbeddingEnabled);
  const [uploadChunkDuration, setUploadChunkDuration] = useState(DEFAULT_UPLOAD_CHUNK_DURATION);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const savedValue = window.localStorage.getItem(UPLOAD_EMBEDDING_STORAGE_KEY);
    if (savedValue == null) {
      setUploadEmbeddingEnabled(defaultEmbeddingEnabled);
      return;
    }

    setUploadEmbeddingEnabled(savedValue === 'true');
  }, [defaultEmbeddingEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(UPLOAD_EMBEDDING_STORAGE_KEY, String(uploadEmbeddingEnabled));
  }, [uploadEmbeddingEnabled]);

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
      embeddingEnabled: boolean = uploadEmbeddingEnabled,
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
    [configTemplate, uploadChunkDuration, uploadEmbeddingEnabled]
  );

  const generateFileId = useCallback(() => {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchInputValueRef = useRef('');
  const [showVideos, setShowVideos] = useState(true);
  const [selectedStreams, setSelectedStreams] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const isUploadingRef = useRef(false);
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

  const filteredStreams = useMemo(
    () => filterStreams(streams, showVideos, false, appliedSearchQuery),
    [streams, showVideos, appliedSearchQuery]
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
    }
  }, [isActive]);

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
          abortController.signal
        );

        if (!isSessionValid()) return;

        setUploadProgress((prev) =>
          prev.map((p) => (p.id === id && p.status === 'uploading' ? { 
            ...p, 
            status: 'success', 
            progress: 100,
          } : p))
        );
        // Notify server about completed upload so it can persist a user_videos record
        try {
          if (formData?.embedding !== false) {
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
      formData: generateDefaultFormData(uploadEmbeddingEnabled),
    }));
    setSelectedFiles((prev) => [...prev, ...newItems]);
    setShowUploadDialog(true);
  }, [generateDefaultFormData, generateFileId, uploadEmbeddingEnabled]);

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

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedStreams(new Set(filteredStreams.map((s) => s.streamId)));
    } else {
      setSelectedStreams(new Set());
    }
  }, [filteredStreams]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedStreams.size === 0 || isDeleting) return;

    const selectedStreamIds = Array.from(selectedStreams);

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
      await Promise.all([refetch(), refetchTimelines()]);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedStreams, streams, isDeleting, agentApiUrl, refetch, refetchTimelines]);

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

    if (filteredStreams.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-300">
              No streams found
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        </div>
      );
    }

    return (
      <StreamsGrid
        streams={filteredStreams}
        selectedStreams={selectedStreams}
        vstApiUrl={vstApiUrl}
        onSelectionChange={handleSelectionChange}
        onSelectAll={handleSelectAll}
        getEndTimeForStream={getEndTimeForStream}
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
              formData: generateDefaultFormData(uploadEmbeddingEnabled),
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
        uploadEmbeddingEnabled={uploadEmbeddingEnabled}
        onUploadEmbeddingChange={setUploadEmbeddingEnabled}
        uploadChunkDuration={uploadChunkDuration}
        onUploadChunkDurationChange={setUploadChunkDuration}
        selectedCount={selectedStreams.size}
        onDeleteSelected={handleDeleteSelected}
        isDeleting={isDeleting}
        enableVideoUpload={enableVideoUpload}
      />

      {/* Upload dialog */}
      <AgentUploadDialog
          open={showUploadDialog}
          files={selectedFiles}
          configTemplate={configTemplate}
          onAddMore={() => fileInputRef.current?.click()}
          onClose={() => {
            setShowUploadDialog(false);
            setSelectedFiles([]);
          }}
          onConfirmUpload={() => {
            if (selectedFiles.length === 0) return;
            
            const entries = selectedFiles.map((f) => ({
              id: f.id,
              file: f.file,
              formData: {
                ...generateDefaultFormData(uploadEmbeddingEnabled, uploadChunkDuration),
                ...f.formData,
                embedding: uploadEmbeddingEnabled,
                chunk_duration: uploadChunkDuration,
              },
            }));
            
            // If already uploading, add to queue
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
              // Start new upload session
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
      

      {/* Main content area */}
      {renderMainContent()}
      {/* Upload Progress Panel */}
      <UploadProgressPanel
        uploads={uploadProgress}
        onClose={handleClearUploadProgress}
        onCancel={handleCancelUploads}
      />
    </div>
  );
};

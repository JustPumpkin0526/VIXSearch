import {
  IconArrowDown,
  IconFile,
  IconFolder,
  IconPaperclip,
  IconPhoto,
  IconPlayerStop,
  IconRefresh,
  IconRepeat,
  IconSend,
  IconTrash,
  IconMicrophone,
  IconPlayerStopFilled,
  IconBrain,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import {
  KeyboardEvent,
  MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { useWorkflowName } from '@/contexts/RuntimeConfigContext';
import { appConfig } from '@/utils/app/const';
import { compressImage } from '@/utils/app/helper';

import { Message, QueryDataContext } from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';
import { isQueryProcessing } from '@/utils/app/queryProcessing';
// Chat file upload UI removed per product request
import {
  CustomAgentParams,
  CustomAgentParamsValues,
  useInitialParamFields,
  fieldsToParams,
} from './CustomAgentParams';

const QUERY_CONTEXT_ICON_SIZE = 12;

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: SpeechRecognitionEventLike) => void)
    | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/** Leading icon for context chips; driven by UI-only `contextType` (not sent to the backend). */
function QueryContextChipIcon({ contextType }: { contextType: string }) {
  const cn = 'flex-shrink-0 opacity-90';
  switch (contextType) {
    case 'media/video':
      return <IconVideo size={QUERY_CONTEXT_ICON_SIZE} className={cn} aria-hidden />;
    case 'media/image':
      return <IconPhoto size={QUERY_CONTEXT_ICON_SIZE} className={cn} aria-hidden />;
    case 'network-file':
      // Tabler has no single "cloud + file" glyph; IconFile fits remote/network file chips. Alternatives: IconCloudDownload, IconFileImport.
      return <IconFile size={QUERY_CONTEXT_ICON_SIZE} className={cn} aria-hidden />;
    default:
      return <IconPaperclip size={QUERY_CONTEXT_ICON_SIZE} className={cn} aria-hidden />;
  }
}

function extractDataUriContentType(
  dataUri: string,
  fallback: string,
): string {
  const match = dataUri.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,/,
  );

  return (
    match?.[1]?.toLowerCase() ||
    fallback
  );
}

export interface VideoGroupSearchScope {
  groupId: string;
  groupName: string;
  sensorIds: string[];
  videoCount: number;
  totalDurationSeconds: number;
}

interface VideoGroupApiItem {
  id: string;
  name: string;
  sensorIds: string[];
  createdAt?: string;
}

interface VideoGroupsApiResponse {
  groups?: unknown[];
  error?: unknown;
}

interface Props {
  onSend: (
    message: Message,
    customParams?: CustomAgentParamsValues,
  ) => void | Promise<void>;
  onRegenerate: () => void;
  onScrollDownClick: () => void;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  showScrollDownButton: boolean;
  onStopConversation: () => void;
  queryContextItems?: QueryDataContext[];
  onRemoveQueryContext?: (itemId: string) => void;
  selectedVideoGroup?: VideoGroupSearchScope | null;
  onClearSelectedVideoGroup?: () => void;
  showVideoGroupSelector?: boolean;
  onSelectVideoGroup?: (group: VideoGroupSearchScope) => void;
  chatBlocked?: boolean;
  getActiveConversationId?: () => string | undefined;
  onUploadFlowActiveChange?: (sourceId: string, active: boolean) => void;
}

export const ChatInput = ({
  onSend,
  onRegenerate,
  onScrollDownClick,
  textareaRef,
  showScrollDownButton,
  onStopConversation,
  queryContextItems = [],
  onRemoveQueryContext,
  selectedVideoGroup = null,
  onClearSelectedVideoGroup,
  showVideoGroupSelector = false,
  onSelectVideoGroup,
  chatBlocked = false,
}: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: { selectedConversation, messageIsStreaming, loading, customAgentParamsJson, chatUploadFileEnabled, chatInputMicEnabled }
  } = useContext(HomeContext);

  const sendingRef = useRef(false);

  const workflow = useWorkflowName();
  const uploadDisabled = chatBlocked || isQueryProcessing(loading, messageIsStreaming);
  const paramsChangeDisabled = uploadDisabled;

  useEffect(() => {
    if (paramsChangeDisabled) {
      setShowCustomParams(false);
    }
  }, [paramsChangeDisabled]);

  // Create audio only when the file is present
  const [recordingStartSound, setRecordingStartSound] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const checkAudioFile = async () => {
      try {
        const response = await fetch('audio/recording.wav', { method: 'HEAD' });
        if (response.ok) {
          setRecordingStartSound(new Audio('audio/recording.wav'));
        }
      } catch (error) {
        console.log('Recording audio file not found, proceeding without sound');
      }
    };

    checkAudioFile();
  }, []);

  const [content, setContent] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [inputFile, setInputFile] =
    useState<string | null>(null);

  const [
    inputFileContent,
    setInputFileContent,
  ] = useState('');

  const [
    inputFileContentCompressed,
    setInputFileContentCompressed,
  ] = useState('');

  const [
    inputFileContentType,
    setInputFileContentType,
  ] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(
      null,
    );
  const [showCustomParams, setShowCustomParams] = useState(false);
  const [paramFields, setParamFields] = useInitialParamFields(customAgentParamsJson);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const groupSelectorRef = useRef<HTMLDivElement>(null);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [videoGroups, setVideoGroups] = useState<VideoGroupApiItem[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [imageSearchMode, setImageSearchMode] = useState<'object' | 'face'>('object');

  const loadVideoGroups = useCallback(async () => {
    const token = window.localStorage.getItem('vss.auth.token');

    if (!token) {
      setVideoGroups([]);
      setGroupLoading(false);
      setGroupError('로그인 토큰을 찾을 수 없습니다.');
      return;
    }

    setGroupLoading(true);
    setGroupError('');

    try {
      const response = await fetch('/api/videos/groups', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const payload = (await response.json().catch(() => ({}))) as VideoGroupsApiResponse;

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : '그룹 목록을 불러오지 못했습니다.',
        );
      }

      const groups = (
        Array.isArray(payload?.groups)
          ? payload.groups
          : []
      )
        .filter(
          (group: unknown): group is Record<string, unknown> =>
            typeof group === 'object' && group !== null,
        )
        .map(group => ({
          id: typeof group.id === 'string' ? group.id : '',
          name: typeof group.name === 'string' ? group.name : '',
          sensorIds: Array.isArray(group.sensorIds)
            ? Array.from(new Set(
                group.sensorIds
                  .filter(
                    (sensorId: unknown): sensorId is string =>
                      typeof sensorId === 'string' &&
                      sensorId.trim().length > 0,
                  )
                  .map(sensorId => sensorId.trim()),
              ))
            : [],
          createdAt:
            typeof group.createdAt === 'string'
              ? group.createdAt
              : undefined,
        }))
        .filter(group => group.id && group.name);

      setVideoGroups(groups);
    } catch (error) {
      setVideoGroups([]);
      setGroupError(
        error instanceof Error
          ? error.message
          : '그룹 목록을 불러오지 못했습니다.',
      );
    } finally {
      setGroupLoading(false);
    }
  }, []);

  const handleToggleGroupSelector = () => {
    if (uploadDisabled) {
      return;
    }

    const nextOpen = !showGroupSelector;
    setShowGroupSelector(nextOpen);

    if (nextOpen) {
      void loadVideoGroups();
    }
  };

  const handleSelectGroup = (group: VideoGroupApiItem) => {
    onSelectVideoGroup?.({
      groupId: group.id,
      groupName: group.name,
      sensorIds: group.sensorIds,
      videoCount: group.sensorIds.length,
      totalDurationSeconds: 0,
    });

    setShowGroupSelector(false);
  };

  useEffect(() => {
    if (!showGroupSelector) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (
        groupSelectorRef.current &&
        !groupSelectorRef.current.contains(event.target as Node)
      ) {
        setShowGroupSelector(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowGroupSelector(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showGroupSelector]);

  useEffect(() => {
    if (!showVideoGroupSelector) {
      setShowGroupSelector(false);
    }
  }, [showVideoGroupSelector]);

  useEffect(() => {
    if (uploadDisabled) {
      setShowGroupSelector(false);
    }
  }, [uploadDisabled]);

  const triggerFileUpload = () => {
    if (
      chatBlocked ||
      messageIsStreaming
    ) {
      return;
    }

    fileInputRef.current?.click();
  };

  const handleInputFileDelete = () => {
    setInputFile(null);
    setInputFileContent('');
    setInputFileContentCompressed('');
    setInputFileContentType('');
    setImageSearchMode('object');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    e.target.value = '';

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
      const fullBase64String =
        loadEvent.target?.result;

      if (
        typeof fullBase64String !== 'string'
      ) {
        toast.error(
          '이미지 파일을 읽지 못했습니다.',
        );
        return;
      }

      processFile({
        fullBase64String,
        file,
      });
    };

    reader.onerror = () => {
      toast.error(
        '이미지 파일을 읽는 중 오류가 발생했습니다.',
      );
    };

    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    setContent(value);
  };

  const handleSend = async () => {
  if (
    chatBlocked ||
    messageIsStreaming ||
    sendingRef.current
  ) {
    return;
  }

  if (
    isRecording &&
    recognitionRef.current
  ) {
    recognitionRef.current.stop();
    setIsRecording(false);
  }

  const imageContentToSend =
    inputFileContentCompressed ||
    inputFileContent;

  const imageContentTypeToSend =
    extractDataUriContentType(
      imageContentToSend,
      inputFileContentType,
    );

  const trimmedContent =
    content.trim();

  const hasImage =
    Boolean(
      inputFile &&
      (
        inputFileContentCompressed ||
        inputFileContent
      ),
    );

  const hasContext =
    queryContextItems.length > 0;

  if (
    !trimmedContent &&
    !hasImage &&
    !hasContext
  ) {
    toast.error(
      t('Please enter a message'),
    );
    return;
  }

  const customParams =
    fieldsToParams(paramFields);

  /*
   * 요청에 사용할 값을 먼저 저장합니다.
   */
  const submittedContent = content;

  /*
   * 서버 응답을 기다리기 전에 입력창을 즉시 비웁니다.
   */
  setContent('');
  sendingRef.current = true;

  try {
    if (hasImage) {
      await onSend(
        {
          role: 'user',
          content:
            trimmedContent ||
            '',
          attachments: [
            {
              content: imageContentToSend,
              type: 'image',
              searchMode: imageSearchMode,
              contentType:
                imageContentTypeToSend,
              mimeType:
                imageContentTypeToSend,
              name:
                inputFile || undefined,
            },
          ],
        } as Message,
        customParams,
      );
    } else {
      await onSend(
        {
          role: 'user',
          content: trimmedContent,
        },
        customParams,
      );
    }

    setInputFile(null);
    setInputFileContent('');
    setInputFileContentCompressed('');
    setInputFileContentType('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  } catch (error) {
    console.error(
      'Failed to send chat message:',
      error,
    );

    /*
     * 사용자가 검색 중 새 문장을 작성했다면 덮어쓰지 않습니다.
     */
    setContent(currentContent =>
      currentContent
        ? currentContent
        : submittedContent,
    );

    toast.error(
      '메시지를 전송하지 못했습니다.',
    );
  } finally {
    sendingRef.current = false;

    if (
      window.innerWidth < 640 &&
      textareaRef.current
    ) {
      textareaRef.current.blur();
    }
  }
};

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (chatBlocked) return;
    if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    } else if (e.key === '/' && e.metaKey) {
      e.preventDefault();
    }
  };

  // Use the passed callback for stop conversation
  const handleStopConversation = onStopConversation;

  const isMobile = () => {
    const userAgent =
      typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
    return mobileRegex.test(userAgent);
  };

  const SUPPORTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  const MAX_IMAGE_SIZE_BYTES =
    10 * 1024 * 1024;

  const processFile = ({
    fullBase64String,
    file,
  }: {
    fullBase64String: string;
    file: File;
  }) => {
    setImageSearchMode('object');
    const normalizedContentType =
      file.type.toLowerCase();

    if (
      !SUPPORTED_IMAGE_TYPES.has(
        normalizedContentType,
      )
    ) {
      toast.error(
        'JPEG, PNG, WEBP 이미지만 첨부할 수 있습니다.',
      );
      return;
    }

    if (
      file.size <= 0
    ) {
      toast.error(
        '비어 있는 이미지 파일입니다.',
      );
      return;
    }

    if (
      file.size > MAX_IMAGE_SIZE_BYTES
    ) {
      toast.error(
        '이미지 크기는 10MB 이하여야 합니다.',
      );
      return;
    }

    if (
      !fullBase64String.startsWith(
        `data:${normalizedContentType};base64,`,
      )
    ) {
      toast.error(
        '이미지 데이터 형식이 올바르지 않습니다.',
      );
      return;
    }

    const commaIndex =
      fullBase64String.indexOf(',');

    const base64WithoutPrefix =
      commaIndex >= 0
        ? fullBase64String.slice(
          commaIndex + 1,
        )
        : fullBase64String;

    const sizeInKB =
      (
        base64WithoutPrefix.length *
        3
      ) /
      4 /
      1024;

    setInputFile(file.name);
    setInputFileContentType(
      normalizedContentType,
    );

    const shouldCompress =
      sizeInKB > 200;

    if (!shouldCompress) {
      setInputFileContent(
        fullBase64String,
      );

      setInputFileContentCompressed(
        fullBase64String,
      );

      return;
    }

    compressImage(
      fullBase64String,
      normalizedContentType,
      true,
      (
        compressedBase64: string,
      ) => {
        if (
          typeof compressedBase64 !==
          'string' ||
          !compressedBase64
        ) {
          toast.error(
            '이미지 압축에 실패했습니다.',
          );

          setInputFileContent(
            fullBase64String,
          );

          setInputFileContentCompressed(
            fullBase64String,
          );

          return;
        }

        setInputFileContent(
          fullBase64String,
        );

        setInputFileContentCompressed(
          compressedBase64,
        );
      },
    );
  };

  // Additional handlers for drag and drop
  const handleDragOver = (
    e: React.DragEvent<
      HTMLTextAreaElement
    >,
  ) => {
    if (
      chatBlocked ||
      messageIsStreaming
    ) {
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (
    e: React.DragEvent<HTMLTextAreaElement>,
  ) => {
    e.preventDefault();

    if (
      chatBlocked ||
      messageIsStreaming
    ) {
      return;
    }

    const file =
      e.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
      const fullBase64String =
        loadEvent.target?.result;

      if (
        typeof fullBase64String !==
        'string'
      ) {
        toast.error(
          '드롭한 이미지를 읽지 못했습니다.',
        );
        return;
      }

      processFile({
        fullBase64String,
        file,
      });
    };

    reader.readAsDataURL(file);
  };

  const handlePaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      chatBlocked ||
      messageIsStreaming
    ) {
      return;
    }

    const items =
      event.clipboardData.items;

    for (const item of items) {
      if (
        !item.type.startsWith('image/')
      ) {
        continue;
      }

      const file = item.getAsFile();

      if (!file) {
        toast.error(
          '붙여넣은 이미지를 읽지 못했습니다.',
        );
        return;
      }

      event.preventDefault();

      const reader = new FileReader();

      reader.onload = loadEvent => {
        const fullBase64String =
          loadEvent.target?.result;

        if (
          typeof fullBase64String !== 'string'
        ) {
          toast.error(
            '붙여넣은 이미지를 읽지 못했습니다.',
          );
          return;
        }

        processFile({
          fullBase64String,
          file,
        });
      };

      reader.onerror = () => {
        toast.error(
          '붙여넣은 이미지를 읽는 중 오류가 발생했습니다.',
        );
      };

      reader.readAsDataURL(file);
      return;
    }

    // 이미지가 없으면 브라우저의 기본 텍스트 붙여넣기를 유지합니다.
  };

  useEffect(() => {
    if (textareaRef && textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
      textareaRef.current.style.overflow = `${textareaRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'
        }`;
    }
  }, [content, textareaRef]);

  const handleSpeechToText =
    useCallback(() => {
      if (!recognitionRef.current) {
        const SpeechRecognition =
          window.SpeechRecognition ||
          window.webkitSpeechRecognition;
      
        if (!SpeechRecognition) {
          toast.error(
            '이 브라우저에서는 음성 입력을 지원하지 않습니다.',
          );
          return;
        }
      
        const recognition =
          new SpeechRecognition();
      
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.continuous = true;
      
        recognition.onresult = (
          event: SpeechRecognitionEventLike,
        ) => {
          let currentTranscript = '';
        
          for (
            let i = 0;
            i < event.results.length;
            i++
          ) {
            const result =
              event.results[i];
          
            currentTranscript +=
              result?.[0]?.transcript ?? '';
          }
        
          setContent(currentTranscript);
        };
      
        recognition.onend = () => {
          if (isRecording) {
            recognition.start();
          }
        };
      
        recognitionRef.current =
          recognition;
      }
    
      if (!isRecording) {
        if (recordingStartSound) {
          recordingStartSound
          .play()
          .catch((error: unknown) => {
            const errorMessage =
              error instanceof Error
                ? error.message
                : String(error);
          
            console.log(
              'Could not play recording sound:',
              errorMessage,
            );
          });
        }
      
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    }, [
      isRecording,
      recordingStartSound,
    ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const leftButtonCount =
    (chatInputMicEnabled ? 1 : 0) +
    (chatUploadFileEnabled ? 1 : 0) +
    (showVideoGroupSelector ? 1 : 0);

  const hasLeftButtons = leftButtonCount > 0;

  const leftPaddingClass =
    leftButtonCount === 0
      ? 'pl-3 sm:pl-4'
      : leftButtonCount === 1
        ? 'pl-11'
        : leftButtonCount === 2
          ? 'pl-[76px]'
          : 'pl-[108px]';

  return (
    <div
      className={`absolute bottom-0 left-0 w-full border-transparent bg-gradient-to-b from-transparent via-white to-white pt-6 dark:border-white/20 dark:via-black dark:to-black pointer-events-none ${isMobile() ? 'pb-14' : 'pb-4'
        }`}
    >
      <div className="stretch mx-auto mt-4 flex flex-col gap-2 last:mb-2 md:mt-[52px] w-full max-w-[95%] pointer-events-auto">
        {selectedVideoGroup && (
          <div className="mx-2 flex items-center sm:mx-4">
            <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Search scope
              </span>

              <IconFolder
                size={16}
                className="shrink-0 text-[#76b900]"
              />

              <span
                className="max-w-[220px] truncate text-base font-semibold"
                title={selectedVideoGroup.groupName}
              >
                {selectedVideoGroup.groupName}
              </span>

              <span className="whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400">
                {selectedVideoGroup.videoCount} videos
              </span>
              
              {onClearSelectedVideoGroup && (
                <button
                  type="button"
                  onClick={onClearSelectedVideoGroup}
                  className="ml-1 flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                  aria-label="그룹 검색 해제"
                  title="그룹 검색 해제"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>
        )}
        {messageIsStreaming && !chatBlocked && (
          <button
            className="absolute top-0 left-0 right-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-black dark:text-white md:mb-0 md:mt-2"
            onClick={handleStopConversation}
          >
            <IconPlayerStop size={16} /> {t('Stop Generating')}
          </button>
        )}

        {!messageIsStreaming &&
          !chatBlocked &&
          selectedConversation &&
          selectedConversation.messages.length > 1 && (
            // selectedConversation.messages[selectedConversation.messages.length - 1].role === 'assistant' &&
            <button
              className="absolute top-0 left-0 right-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-black dark:text-white md:mb-0 md:mt-2"
              onClick={onRegenerate}
            >
              <IconRepeat size={16} /> {t('Regenerate response')}
            </button>
          )}

        <div className="relative mx-2 flex w-full flex-grow flex-col rounded-md border border-black/10 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:border-neutral-700 dark:bg-black dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4">
          {!content &&
            !inputFile &&
            !isRecording &&
            queryContextItems.length === 0 && (
              <div
                data-testid="chat-input-placeholder"
                className={`pointer-events-none absolute inset-0 flex items-center py-2 text-gray-500 dark:text-gray-400 md:py-3 ${leftPaddingClass} ${paramFields.length > 0 ? 'pr-20' : 'pr-12'}`}
                aria-hidden
              >
                <span className="min-w-0 truncate">
                  Unlock {workflow} knowledge and expertise
                </span>
              </div>
            )}
          {queryContextItems.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 pt-2 pr-12 ${leftPaddingClass}`}>
              {queryContextItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-600 text-xs text-gray-700 dark:text-gray-200 pl-1.5 pr-1 py-1 max-w-[200px]"
                  title={`${item.label} (${item.contextType})`}
                >
                  <QueryContextChipIcon contextType={item.contextType} />
                  <span className="truncate">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveQueryContext?.(item.id)}
                    className="flex-shrink-0 rounded hover:bg-gray-300 dark:hover:bg-gray-500 p-0.5"
                    aria-label={`Remove ${item.label}`}
                  >
                    <IconX size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            data-testid="chat-textarea"
            ref={textareaRef}
            className={`m-0 w-full resize-none border-0 bg-transparent p-0 py-2 text-black dark:bg-transparent dark:text-white md:py-3 outline-none ${leftPaddingClass} ${paramFields.length > 0 ? 'pr-20' : 'pr-12'}`}
            style={{
              resize: 'none',
              bottom: `${textareaRef?.current?.scrollHeight}px`,
              minHeight: '44px',
              maxHeight: '400px',
              overflow: `${textareaRef.current && textareaRef.current.scrollHeight > 400
                  ? 'auto'
                  : 'hidden'
                }`,
            }}
            placeholder={isRecording ? 'Listening...' : ''}
            aria-label={isRecording ? 'Listening...' : `Unlock ${workflow} knowledge and expertise`}
            value={content}
            rows={1}
            onCompositionStart={() => setIsTyping(true)}
            onCompositionEnd={() => setIsTyping(false)}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={chatBlocked}
            readOnly={chatBlocked}
            {...(appConfig?.fileUploadEnabled && {
              onDragOver: handleDragOver,
              onDrop: handleDrop,
              onPaste: handlePaste,
            })}
          />
          {inputFile && inputFileContent && (
            <div className="px-3 pb-2 pt-1">
              <div className="relative flex items-center justify-start gap-2 rounded-md bg-[#f0f7e6] p-2 text-black dark:bg-green-700 dark:text-white">
                <img
                  src={
                    inputFileContentCompressed || inputFileContent
                  }
                  alt={inputFile || '검색할 이미지 미리보기'}
                  className="h-16 w-16 rounded object-cover border border-black/20 bg-white"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <IconPhoto size={16} />
                    <span>검색 기준 이미지</span>
                  </div>
                  <div className="mt-2 flex gap-1" role="group" aria-label="이미지 검색 방식">
                    <button
                      type="button"
                      onClick={() => setImageSearchMode('object')}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        imageSearchMode === 'object'
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'bg-white/60 text-black hover:bg-white dark:bg-black/30 dark:text-white'
                      }`}
                    >
                      일반 이미지 검색
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSearchMode('face')}
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        imageSearchMode === 'face'
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'bg-white/60 text-black hover:bg-white dark:bg-black/30 dark:text-white'
                      }`}
                      title="정면 얼굴을 여백 적게 크롭한 이미지에 적합합니다"
                    >
                      얼굴 검색
                    </button>
                  </div>
                  <span className="block truncate text-xs opacity-80">{inputFile}</span>
                </div>

                <button
                  type="button"
                  onClick={handleInputFileDelete}
                  aria-label="Remove attached image"
                  className="ml-2 p-1"
                >
                  <IconTrash
                    className="hover:text-[#ff1717] cursor-pointer"
                    size={16}
                  />
                </button>
              </div>
            </div>
          )}
          {hasLeftButtons && (
            <div className="absolute left-2 top-2 flex gap-1">
              {chatInputMicEnabled && (
                <button
                  onClick={handleSpeechToText}
                  className={`rounded-sm p-[5px] text-neutral-800 opacity-60 dark:bg-opacity-50 dark:text-neutral-100 ${chatBlocked || messageIsStreaming
                      ? 'text-neutral-400' // Disable hover and change color when streaming
                      : 'hover:text-[#76b900] dark:hover:text-neutral-200' // Normal hover effect
                    }`}
                  disabled={chatBlocked || messageIsStreaming}
                >
                  {isRecording ? (
                    <IconPlayerStopFilled
                      size={18}
                      className="text-red-500 animate-blink"
                    />
                  ) : (
                    <IconMicrophone size={18} />
                  )}
                </button>
              )}
              {chatUploadFileEnabled && (
                <>
                  <button
                    type="button"
                    className={`rounded-sm p-[5px] text-neutral-800 opacity-60 dark:bg-opacity-50 dark:text-neutral-100 ${uploadDisabled
                        ? 'text-neutral-400'
                        : 'hover:text-[#76b900] dark:hover:text-neutral-200'
                      }`}
                    onClick={triggerFileUpload}
                    disabled={
                      chatBlocked ||
                      messageIsStreaming
                    }
                    aria-label="Attach search image"
                    title="이미지 기반 유사도 검색"
                  >
                    {!messageIsStreaming && (
                      <IconPhoto size={18} />
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    disabled={
                      chatBlocked ||
                      messageIsStreaming
                    }
                  />
                </>
              )}

              {showVideoGroupSelector && (
                <div ref={groupSelectorRef} className="relative">
                  <button
                    type="button"
                    onClick={handleToggleGroupSelector}
                    disabled={uploadDisabled}
                    className={`rounded-sm p-[5px] text-neutral-800 opacity-60 dark:text-neutral-100 ${
                      uploadDisabled
                        ? 'text-neutral-400'
                        : selectedVideoGroup || showGroupSelector
                          ? 'text-[#76b900] opacity-100'
                          : 'hover:text-[#76b900] dark:hover:text-neutral-200'
                    }`}
                    aria-label="검색 그룹 선택"
                    title={
                      selectedVideoGroup
                        ? `검색 그룹: ${selectedVideoGroup.groupName}`
                        : '검색 그룹 선택'
                    }
                  >
                    <IconFolder size={18} />
                  </button>
                  
                  {showGroupSelector && (
                    <div className="absolute bottom-9 left-0 z-50 w-72 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:w-80">                      
                      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
                        <span className="text-sm font-semibold">검색 그룹 선택</span>
                        <button
                          type="button"
                          onClick={() => void loadVideoGroups()}
                          disabled={groupLoading}
                          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-[#76b900] disabled:opacity-40 dark:hover:bg-neutral-800"
                          title="그룹 목록 새로고침"
                        >
                          <IconRefresh
                            size={16}
                            className={groupLoading ? 'animate-spin' : ''}
                          />
                        </button>
                      </div>
                  
                      <div className="max-h-72 overflow-y-auto p-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClearSelectedVideoGroup?.();
                            setShowGroupSelector(false);
                          }}
                          className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm ${
                            !selectedVideoGroup
                              ? 'bg-[#76b900]/10 font-semibold text-[#5d9200]'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <div>전체 영상</div>
                          <div className="text-xs font-normal text-neutral-500">
                            그룹 제한 없이 검색
                          </div>
                        </button>
                        
                        {groupLoading && (
                          <div className="px-3 py-6 text-center text-sm text-neutral-500">
                            그룹 목록을 불러오는 중입니다.
                          </div>
                        )}

                        {!groupLoading && groupError && (
                          <div className="px-3 py-4 text-sm text-red-500">
                            {groupError}
                          </div>
                        )}

                        {!groupLoading &&
                          !groupError &&
                          videoGroups.length === 0 && (
                            <div className="px-3 py-6 text-center text-sm text-neutral-500">
                              선택할 수 있는 그룹이 없습니다.
                            </div>
                          )}

                        {!groupLoading &&
                          !groupError &&
                          videoGroups.map(group => {
                            const selected = selectedVideoGroup?.groupId === group.id;
                          
                            return (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => handleSelectGroup(group)}
                                className={`mb-1 w-full rounded-md px-3 py-2 text-left ${
                                  selected
                                    ? 'bg-[#76b900]/10 font-semibold text-[#5d9200] ring-1 ring-inset ring-[#76b900]/30'
                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                }`}
                              >
                                <div className="truncate text-sm font-medium">
                                  {group.name}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  영상 {group.sensorIds.length}개
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
          {/* Settings Button - only show when there are enabled params */}
          {paramFields.length > 0 && (
            <div className="absolute right-10 top-2">
              <button
                ref={settingsButtonRef}
                className={`rounded-sm p-1 text-neutral-800 opacity-60 dark:bg-opacity-50 dark:text-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${showCustomParams ? 'text-[#76b900] dark:text-[#76b900]' : ''
                  } ${paramsChangeDisabled
                    ? 'text-neutral-400'
                    : 'hover:text-[#76b900] dark:hover:text-neutral-200'
                  }`}
                onClick={() => {
                  if (paramsChangeDisabled) return;
                  setShowCustomParams(!showCustomParams);
                }}
                disabled={paramsChangeDisabled}
                title="Agent Parameters"
              >
                <IconBrain size={18} />
              </button>
              <CustomAgentParams
                isOpen={showCustomParams}
                onClose={() => setShowCustomParams(false)}
                fields={paramFields}
                onFieldsChange={setParamFields}
                anchorRef={settingsButtonRef}
                valuesChangeDisabled={paramsChangeDisabled}
              />
            </div>
          )}
          {/* Send Button */}
          <button
            className="absolute right-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={chatBlocked || messageIsStreaming}
          >
            {messageIsStreaming ? (
              <div data-testid="chat-loading-spinner" className="h-4 w-4 animate-spin rounded-full border-t-2 border-neutral-800 opacity-60 dark:border-neutral-100"></div>
            ) : (
              <IconSend size={18} />
            )}
          </button>

          {showScrollDownButton && (
            <div className="absolute bottom-12 right-0 lg:bottom-2 lg:-right-10">
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-neutral-200"
                onClick={onScrollDownClick}
              >
                <IconArrowDown size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

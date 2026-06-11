import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useTranslation } from 'next-i18next';
import Head from 'next/head';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import {
  cleanConversationHistory,
  cleanSelectedConversation,
} from '@/utils/app/clean';
import {
  saveConversation,
  saveConversations,
  updateConversation,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
// import { getSettings } from '@/utils/app/settings';

import { APPLICATION_NAME } from '@/constants/constants';

import { Conversation } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';

import { getStorageKey, useRuntimeConfig } from '@/contexts/RuntimeConfigContext';

import HomeContext from './home.context';
import { HomeInitialState, initialState } from './home.state';

import { v4 as uuidv4 } from 'uuid';

type PersistedChatState = {
  folders?: FolderInterface[];
  conversations?: Conversation[];
  selectedConversation?: Conversation | null;
  showChatbar?: boolean;
};

function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem('vss.auth.token') || '';
}

function buildChatStateSnapshot(params: PersistedChatState): PersistedChatState {
  return {
    folders: Array.isArray(params.folders) ? params.folders : [],
    conversations: Array.isArray(params.conversations) ? params.conversations : [],
    selectedConversation: params.selectedConversation ?? null,
    showChatbar: typeof params.showChatbar === 'boolean' ? params.showChatbar : true,
  };
}

function persistStateToSessionStorage(snapshot: PersistedChatState, storageKeyPrefix: string | null) {
  sessionStorage.setItem(getStorageKey('folders', storageKeyPrefix), JSON.stringify(snapshot.folders || []));
  sessionStorage.setItem(getStorageKey('conversationHistory', storageKeyPrefix), JSON.stringify(snapshot.conversations || []));
  sessionStorage.setItem(getStorageKey('showChatbar', storageKeyPrefix), JSON.stringify(snapshot.showChatbar ?? true));

  if (snapshot.selectedConversation) {
    sessionStorage.setItem(getStorageKey('selectedConversation', storageKeyPrefix), JSON.stringify(snapshot.selectedConversation));
  } else {
    sessionStorage.removeItem(getStorageKey('selectedConversation', storageKeyPrefix));
  }
}

async function loadPersistedChatState(storageKeyPrefix: string | null): Promise<PersistedChatState | null> {
  const token = getAuthToken();
  if (!token) {
    return null;
  }

  const query = new URLSearchParams({
    storageKeyPrefix: storageKeyPrefix || 'default',
  });
  const response = await fetch(`/api/chat/state?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load chat state: ${response.status}`);
  }

  const payload = await response.json();
  return payload?.state ?? null;
}

async function savePersistedChatState(storageKeyPrefix: string | null, snapshot: PersistedChatState): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    return;
  }

  const response = await fetch('/api/chat/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      storageKeyPrefix: storageKeyPrefix || 'default',
      ...buildChatStateSnapshot(snapshot),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save chat state: ${response.status}`);
  }
}

export interface ChatSidebarControlHandlers {
  conversations: any[];
  filteredConversations: any[];
  lightMode: 'light' | 'dark';
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  onNewConversation: () => void;
  onCreateFolder: () => void;
  onClearConversations: () => void;
  onImportConversations: (data: any) => void;
  onExportData: () => void;
  // Context values for internal rendering (enables reactivity)
  homeContext?: any;
  chatbarContext?: any;
}

export interface NemoAgentToolkitAppProps {
  // Theme control props
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  
  // Optional override for initial state (e.g. when imported for multiple instantiations in an app)
  initialStateOverride?: Partial<HomeInitialState>;
  
  // Controls rendering props
  renderControlsInLeftSidebar?: boolean; // Default: false - set true to render controls in external left sidebar instead of chatbar footer
  onControlsReady?: (handlers: ChatSidebarControlHandlers) => void; // Callback to provide control handlers externally
  
  // Document head rendering
  renderApplicationHead?: boolean; // Default: true - set false when embedded to prevent setting document title/meta tags
  
  /**
   * Optional storage key prefix (e.g. "searchTab", "alertsTab") so this instance uses
   * separate sessionStorage keys (conversationHistory, selectedConversation, folders).
   * Pass at instantiation for reusability when embedding multiple chat instances.
   */
  storageKeyPrefix?: string;

  /**
   * Optional: called when a new assistant answer has finished.
   */
  onAnswerComplete?: () => void;

  /**
   * Optional: called when an answer finishes, with the full assistant message text.
   * The embedder can use this for any custom logic (e.g. update UI, trigger actions).
   */
  onAnswerCompleteWithContent?: (answer: string) => void;

  /**
   * Optional: called when the chat is ready; receives a function the embedder can call
   * to submit a message to the agent programmatically (without the user typing in the chat).
   */
  onSubmitMessageReady?: (submitMessage: (message: string) => void) => void;

  /**
   * Optional: called when a message is submitted programmatically (via the function from onSubmitMessageReady).
   * The embedder can use this to e.g. show an attention/highlight signal (new activity expected in chat).
   */
  onMessageSubmitted?: () => void;
  
  // Other optional props for future extensibility
  className?: string;
  style?: React.CSSProperties;
}

const Home = (props: NemoAgentToolkitAppProps = {}) => {
  const { 
    theme: externalTheme, 
    onThemeChange,
    initialStateOverride,
    renderControlsInLeftSidebar = false,
    onControlsReady,
    renderApplicationHead = true,
    storageKeyPrefix: storageKeyPrefixProp,
    onAnswerComplete,
    onAnswerCompleteWithContent,
    onSubmitMessageReady,
    onMessageSubmitted,
    className = '', 
    style = {} 
  } = props;
  
  const { t } = useTranslation('chat');

  // Initialize state: base from env, then optional override (e.g. Search tab chat env), then external theme
  const contextValue = useCreateReducer<HomeInitialState>({
    initialState: {
      ...initialState,
      ...(initialStateOverride || {}),
      ...(externalTheme ? { lightMode: externalTheme } : {}),
    },
  });

  const {
    state: { lightMode, folders, conversations, selectedConversation },
    dispatch,
  } = contextValue;

  const runtimeConfig = useRuntimeConfig();
  // Prop takes precedence so embedder can pass prefix at instantiation; otherwise use provider config
  const storageKeyPrefix = storageKeyPrefixProp ?? runtimeConfig?.storageKeyPrefix ?? null;

  const stopConversationRef = useRef<boolean>(false);
  const chatStateHydratedRef = useRef(false);
  const lastPersistedChatSnapshotRef = useRef('');
  
  // Track if we're in the middle of an external theme update to prevent loops
  const isExternalThemeUpdateRef = useRef(false);
  // Track the last external theme to detect changes
  const lastExternalThemeRef = useRef(externalTheme);
  
  // Apply theme to document root synchronously before paint to avoid flash
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (lightMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [lightMode]);

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    // Clear any streaming states before switching conversations
    dispatch({ field: 'messageIsStreaming', value: false });
    dispatch({ field: 'loading', value: false });

    dispatch({
      field: 'selectedConversation',
      value: conversation,
    });

    saveConversation(conversation, storageKeyPrefix);
  }, [dispatch, storageKeyPrefix]);

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = useCallback((name: string, type: FolderType) => {
    const newFolder: FolderInterface = {
      id: uuidv4(),
      name,
      type,
    };

    const updatedFolders = [...folders, newFolder];

    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders, storageKeyPrefix);
  }, [folders, dispatch, storageKeyPrefix]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders, storageKeyPrefix);

    // Remove all conversations that were inside this folder
    const updatedConversations: Conversation[] = conversations.filter(
      (c) => c.folderId !== folderId,
    );

    dispatch({ field: 'conversations', value: updatedConversations });
    saveConversations(updatedConversations, storageKeyPrefix);

    // If the selected conversation was in the deleted folder, select another or create new
    if (selectedConversation?.folderId === folderId) {
      if (updatedConversations.length > 0) {
        const nextConversation =
          updatedConversations[updatedConversations.length - 1];
        dispatch({ field: 'selectedConversation', value: nextConversation });
        saveConversation(nextConversation, storageKeyPrefix);
      } else {
        const newConversation: Conversation = {
          id: uuidv4(),
          name: t('New Conversation'),
          messages: [],
          folderId: null,
          isHomepageConversation: true,
        };
        const updatedWithNew = [...updatedConversations, newConversation];
        dispatch({ field: 'conversations', value: updatedWithNew });
        dispatch({ field: 'selectedConversation', value: newConversation });
        saveConversation(newConversation, storageKeyPrefix);
        saveConversations(updatedWithNew, storageKeyPrefix);
      }
    }
  }, [
    folders,
    conversations,
    selectedConversation,
    dispatch,
    storageKeyPrefix,
    t,
  ]);

  const handleUpdateFolder = useCallback((folderId: string, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
        };
      }

      return f;
    });

    dispatch({ field: 'folders', value: updatedFolders });

    saveFolders(updatedFolders, storageKeyPrefix);
  }, [folders, dispatch, storageKeyPrefix]);

  // CONVERSATION OPERATIONS  --------------------------------------------

  const handleNewConversation = useCallback((folderId?: string | null) => {
    // When creating in a folder, always create a new conversation. Otherwise reuse empty homepage conversation when applicable.
    const createInFolder = folderId != null && folderId !== '';

    if (
      !createInFolder &&
      selectedConversation?.isHomepageConversation &&
      selectedConversation.messages.length === 0
    ) {
      // Just remove the homepage flag to make it visible in sidebar, don't create a new conversation
      const updatedConversation = {
        ...selectedConversation,
        isHomepageConversation: undefined,
      };

      const updatedConversations = conversations.map(c =>
        c.id === selectedConversation.id ? updatedConversation : c
      );

      dispatch({ field: 'selectedConversation', value: updatedConversation });
      dispatch({ field: 'conversations', value: updatedConversations });

      saveConversation(updatedConversation, storageKeyPrefix);
      saveConversations(updatedConversations, storageKeyPrefix);

      return;
    }

    const newConversation: Conversation = {
      id: uuidv4(),
      name: t('New Conversation'),
      messages: [],
      folderId: createInFolder ? (folderId as string) : null,
    };

    const updatedConversations = [...conversations, newConversation];

    dispatch({ field: 'selectedConversation', value: newConversation });
    dispatch({ field: 'conversations', value: updatedConversations });
    if (createInFolder) {
      dispatch({ field: 'folderIdToExpand', value: folderId });
    }

    saveConversation(newConversation, storageKeyPrefix);
    saveConversations(updatedConversations, storageKeyPrefix);

    dispatch({ field: 'loading', value: false });
  }, [selectedConversation, conversations, dispatch, t, storageKeyPrefix]);

  const handleUpdateConversation = useCallback((
    conversation: Conversation,
    data: KeyValuePair,
  ) => {
    const updatedConversation = {
      ...conversation,
      [data.key]: data.value,
    };

    const { single, all } = updateConversation(
      updatedConversation,
      conversations,
      storageKeyPrefix,
    );

    dispatch({ field: 'selectedConversation', value: single });
    dispatch({ field: 'conversations', value: all });
  }, [conversations, dispatch, storageKeyPrefix]);

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const hydrateState = async () => {
      chatStateHydratedRef.current = false;
      let loadedFromDb = false;

      if (!externalTheme) {
        const savedLightMode = sessionStorage.getItem('lightMode');
        if (savedLightMode && (savedLightMode === 'light' || savedLightMode === 'dark')) {
          dispatch({
            field: 'lightMode',
            value: savedLightMode,
          });
        }
      }

      const showChatbarKey = getStorageKey('showChatbar', storageKeyPrefix);
      const foldersKey = getStorageKey('folders', storageKeyPrefix);
      const conversationHistoryKey = getStorageKey('conversationHistory', storageKeyPrefix);
      const selectedConversationKey = getStorageKey('selectedConversation', storageKeyPrefix);

      let nextShowChatbar = initialState.showChatbar;
      const showChatbarValue = sessionStorage.getItem(showChatbarKey);
      if (showChatbarValue) {
        nextShowChatbar = showChatbarValue === 'true';
      }

      let nextFolders: FolderInterface[] = [];
      const foldersValue = sessionStorage.getItem(foldersKey);
      if (foldersValue) {
        nextFolders = JSON.parse(foldersValue);
      }

      let nextConversations: Conversation[] = [];
      const conversationHistoryValue = sessionStorage.getItem(conversationHistoryKey);
      if (conversationHistoryValue) {
        nextConversations = cleanConversationHistory(JSON.parse(conversationHistoryValue));
      }

      let nextSelectedConversation: Conversation | undefined;
      const selectedConversationValue = sessionStorage.getItem(selectedConversationKey);
      if (selectedConversationValue) {
        nextSelectedConversation = cleanSelectedConversation(JSON.parse(selectedConversationValue));
      }

      try {
        const persistedState = await loadPersistedChatState(storageKeyPrefix);
        if (persistedState) {
          loadedFromDb = true;
          nextFolders = Array.isArray(persistedState.folders) ? persistedState.folders : [];
          nextConversations = cleanConversationHistory(
            Array.isArray(persistedState.conversations) ? persistedState.conversations : [],
          );
          nextSelectedConversation = persistedState.selectedConversation
            ? cleanSelectedConversation(persistedState.selectedConversation)
            : undefined;
          if (typeof persistedState.showChatbar === 'boolean') {
            nextShowChatbar = persistedState.showChatbar;
          }
        }
      } catch (error) {
        console.warn('Failed to hydrate chat state from DB:', error);
      }

      if (!nextSelectedConversation) {
        const homepageConversation: Conversation = {
          id: uuidv4(),
          name: t('New Conversation'),
          messages: [],
          folderId: null,
          isHomepageConversation: true,
        };

        nextSelectedConversation = homepageConversation;
        nextConversations = [...nextConversations, homepageConversation];
      }

      if (cancelled) {
        return;
      }

      dispatch({ field: 'showChatbar', value: nextShowChatbar });
      dispatch({ field: 'folders', value: nextFolders });
      dispatch({ field: 'conversations', value: nextConversations });
      dispatch({ field: 'selectedConversation', value: nextSelectedConversation });

      const snapshot = buildChatStateSnapshot({
        folders: nextFolders,
        conversations: nextConversations,
        selectedConversation: nextSelectedConversation,
        showChatbar: nextShowChatbar,
      });
      persistStateToSessionStorage(snapshot, storageKeyPrefix);
      lastPersistedChatSnapshotRef.current = loadedFromDb ? JSON.stringify(snapshot) : '';
      chatStateHydratedRef.current = true;
    };

    hydrateState();

    return () => {
      cancelled = true;
    };
  }, [storageKeyPrefix]); // Run when instance prefix is set (e.g. main vs search tab)

  useEffect(() => {
    if (!chatStateHydratedRef.current) {
      return undefined;
    }

    const snapshot = buildChatStateSnapshot({
      folders,
      conversations,
      selectedConversation,
      showChatbar: contextValue.state.showChatbar,
    });

    persistStateToSessionStorage(snapshot, storageKeyPrefix);
    const serializedSnapshot = JSON.stringify(snapshot);
    if (serializedSnapshot === lastPersistedChatSnapshotRef.current) {
      return undefined;
    }

    const persistTimer = window.setTimeout(() => {
      savePersistedChatState(storageKeyPrefix, snapshot)
        .then(() => {
          lastPersistedChatSnapshotRef.current = serializedSnapshot;
        })
        .catch((error) => {
          console.warn('Failed to persist chat state to DB:', error);
        });
    }, 500);

    return () => {
      window.clearTimeout(persistTimer);
    };
  }, [folders, conversations, selectedConversation, contextValue.state.showChatbar, storageKeyPrefix]);

  // Handle external theme prop changes separately
  useEffect(() => {
    // Handle external theme prop changes
    if (externalTheme && externalTheme !== lastExternalThemeRef.current) {
      lastExternalThemeRef.current = externalTheme;
      isExternalThemeUpdateRef.current = true;
      dispatch({
        field: 'lightMode',
        value: externalTheme,
      });
    }
  }, [externalTheme]);

  // Handle theme changes - prevent internal changes from propagating to consumer app
  useEffect(() => {
    // If this is an external theme update, don't notify parent
    if (isExternalThemeUpdateRef.current) {
      isExternalThemeUpdateRef.current = false;
      return;
    }
    
    // REMOVED: Don't call onThemeChange for internal theme changes to prevent conflicts
    // This ensures one-way data binding - external theme prop controls internal state,
    // but internal changes don't propagate back to consumer app via onThemeChange
    
    // Only save to sessionStorage if not externally controlled (lightMode stays global; no prefix)
    if (!externalTheme) {
      sessionStorage.setItem('lightMode', lightMode);
    }
  }, [lightMode, externalTheme]);

  // Memoize context value to prevent unnecessary re-renders of consumers
  const homeContextValue = useMemo(() => ({
    ...contextValue,
    storageKeyPrefix,
    handleNewConversation,
    handleCreateFolder,
    handleDeleteFolder,
    handleUpdateFolder,
    handleSelectConversation,
    handleUpdateConversation,
    onAnswerComplete,
    onAnswerCompleteWithContent,
    onSubmitMessageReady,
    onMessageSubmitted,
  }), [
    contextValue,
    storageKeyPrefix,
    handleNewConversation,
    handleCreateFolder,
    handleDeleteFolder,
    handleUpdateFolder,
    handleSelectConversation,
    handleUpdateConversation,
    onAnswerComplete,
    onAnswerCompleteWithContent,
    onSubmitMessageReady,
    onMessageSubmitted,
  ]);

  return (
    <HomeContext.Provider value={homeContextValue}>
      {/* Only set document head when running standalone (not embedded) */}
      {renderApplicationHead && (
        <Head>
          <title>{APPLICATION_NAME}</title>
          <meta name="description" content="ChatGPT but better." />
          <meta
            name="viewport"
            content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
          />
          <link rel="icon" href="/favicon.ico" />
        </Head>
      )}
      {selectedConversation && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode} ${className}`}
          style={style}
        >
          <div className="fixed top-0 w-full sm:hidden">
            <Navbar
              selectedConversation={selectedConversation}
              onNewConversation={handleNewConversation}
            />
          </div>

          <div className="flex h-full w-full sm:pt-0">
            <Chatbar renderControlsInLeftSidebar={renderControlsInLeftSidebar} onControlsReady={onControlsReady} />

            <div className="flex flex-1">
              <Chat />
            </div>
          </div>
        </main>
      )}
    </HomeContext.Provider>
  );
};

export default Home;

'use client';

import React, {
  useContext,
} from 'react';

import { useWorkflowName} from '@/contexts/RuntimeConfigContext';

import HomeContext from '@/pages/api/home/home.context';

export const ChatHeader = () => {

  const workflow = useWorkflowName();

  const {
    state: {
      selectedConversation,
    },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const hasMessages = (selectedConversation?.messages?.length ?? 0) > 0;

  // Shared content for the header
  const renderHeaderContent = () => (
    <div
      className={hasMessages ? 'relative' : 'relative min-h-full'}
    >
      <div
      className={`top-0 z-10 flex justify-center items-center h-12 ${
        hasMessages
          ? 'bg-white border-b border-gray-200'
          : 'bg-none'
      }  py-2 px-4 text-sm text-black dark:border-none dark:bg-black dark:text-neutral-200`}
    >
      {hasMessages ? (
        <div
          className={`absolute top-6 left-1/2 transform -translate-x-1/2 -translate-y-1/2`}
        >
          <span className="text-lg font-semibold text-black dark:text-white">{workflow}</span>
        </div>
      ) : (
        /* Welcome screen */
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mx-auto flex flex-col items-center px-3 pt-5 md:pt-12 sm:max-w-[600px] text-center"
        >
          <div className="text-3xl font-semibold text-gray-800 dark:text-white mb-4">
            Hi, I'm {workflow}
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            How can I assist you today?
          </div>
          
          {/* Upload UI removed */}
        </div>
      )}
      </div>
    </div>
  );

  return renderHeaderContent();
};

import {
  FC,
  useEffect,
  useState,
} from 'react';

import { BotAvatar } from
  '@/components/Avatar/BotAvatar';

interface Props {
  statusUpdateText: string;
}

export const ChatLoader: FC<Props> = ({
  statusUpdateText,
}) => {
  const [
    currentMessage,
    setCurrentMessage,
  ] = useState(statusUpdateText);

  useEffect(() => {
    setCurrentMessage(statusUpdateText);
  }, [statusUpdateText]);

  return (
    <div
      className="
        group border-b border-black/10
        bg-gray-50 text-gray-800
        dark:border-gray-900/50
        dark:bg-black dark:text-gray-100
      "
      style={{
        overflowWrap: 'anywhere',
      }}
    >
      <div
        className="
          relative m-auto flex p-4
          text-base w-full max-w-[95%]
          md:gap-6 md:py-6 lg:px-0
        "
      >
        <div className="min-w-[40px] items-end">
          <BotAvatar
            src="nvidia.jpg"
            size={30}
          />
        </div>

        <div className="flex items-center">
          <span className="cursor-default">
            {currentMessage}
            <span
              className="
                text-[#76b900]
                animate-blink
              "
            >
              ▍
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
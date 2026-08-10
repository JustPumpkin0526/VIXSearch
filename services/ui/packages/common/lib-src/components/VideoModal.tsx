import React, { useEffect, useRef } from 'react';

export interface VideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  title: React.ReactNode | string;
  onClose: () => void;
  onVideoPause?: (currentTime: number) => void;
  onVideoPlay?: (currentTime: number) => void;
  videoRef?: React.Ref<HTMLVideoElement>;
  footer?: React.ReactNode;
  sidePanel?: React.ReactNode;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  videoUrl,
  title,
  onClose,
  onVideoPause,
  onVideoPlay,
  videoRef,
  footer,
  sidePanel,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    try {
      if (!dialog.open) {
        dialog.showModal();
      }
    } catch {
      dialog.setAttribute('open', '');
    }

    return () => {
      try {
        if (dialog.open) {
          dialog.close();
        }
      } catch {
        // Dialog may already be detached during unmount.
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="video-modal-title"
      data-testid="video-modal"
      id="video-modal-id"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
      }}
      className="z-50 grid place-items-center overflow-hidden backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div
        className={`flex min-h-0 min-w-0 items-stretch gap-3 ${
          sidePanel
            ? 'h-[80vh] w-[95vw] max-w-[1500px]'
            : 'h-[80vh] w-[80vw] max-w-[1200px]'
        }`}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 text-black dark:border-gray-700 dark:bg-neutral-900 dark:text-white">
            <div
              id="video-modal-title"
              className="min-w-0 truncate text-sm font-semibold"
            >
              {title}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="ml-4 shrink-0 rounded-md px-2 py-1 text-lg leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              controls
              autoPlay
              className="h-full w-full bg-black object-contain"
              onPause={(event) => {
                onVideoPause?.(event.currentTarget.currentTime);
              }}
              onPlay={(event) => {
                onVideoPlay?.(event.currentTarget.currentTime);
              }}
              onError={() => {
                console.error('Video failed to load:', videoUrl);
              }}
            >
              <source src={videoUrl} type="video/mp4" />
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          </div>

          {footer && (
            <div className="shrink-0 border-t-2 border-brand-green bg-white text-black dark:bg-neutral-900 dark:text-white">
              {footer}
            </div>
          )}
        </div>

        {sidePanel && (
          <div
            data-testid="video-modal-side-panel"
            className="w-[260px] min-h-0 shrink-0 self-start"
          >
            {sidePanel}
          </div>
        )}
      </div>
    </dialog>
  );
};
import {
  ChangeEvent,
  useRef,
} from 'react';

import type {
  SelectedSearchImage,
} from '../types/imageSearch';

import {
  createSelectedSearchImage,
} from '../utils/selectedSearchImage';

type ImageSearchAttachmentProps = {
  image: SelectedSearchImage | null;
  disabled?: boolean;
  onChange: (
    image: SelectedSearchImage | null,
  ) => void;
  onError?: (message: string) => void;
};

export function ImageSearchAttachment({
  image,
  disabled = false,
  onChange,
  onError,
}: ImageSearchAttachmentProps) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  };

  const handleChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const selected =
        await createSelectedSearchImage(file);

      onChange(selected);
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : '이미지를 불러오지 못했습니다.',
      );
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={[
          'rounded-md border px-3 py-2 text-sm',
          'hover:bg-gray-100',
          'disabled:cursor-not-allowed',
          'disabled:opacity-50',
        ].join(' ')}
      >
        이미지 첨부
      </button>

      {image && (
        <div className="flex items-center gap-2">
          <img
            src={image.previewUrl}
            alt="검색 이미지 미리보기"
            className="h-14 w-20 rounded border object-cover"
          />

          <div className="max-w-[180px]">
            <div
              className="truncate text-xs"
              title={image.file.name}
            >
              {image.file.name}
            </div>

            <div className="text-xs text-gray-500">
              {(
                image.file.size /
                1024 /
                1024
              ).toFixed(2)}
              MB
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleRemove}
            className="rounded px-2 py-1 text-xs hover:bg-gray-100"
          >
            제거
          </button>
        </div>
      )}
    </div>
  );
}
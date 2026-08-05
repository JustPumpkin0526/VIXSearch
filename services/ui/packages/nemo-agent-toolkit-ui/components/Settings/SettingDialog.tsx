import {
  FC,
  useEffect,
  useRef,
  useState,
} from 'react';

import toast from 'react-hot-toast';

import {
  DEFAULT_SEARCH_SETTINGS,
  loadSearchSettings,
  saveSearchSettings,
  SearchSettings,
} from '@/utils/app/searchSettings';

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputClass = [
  'mt-1 w-full rounded-lg border',
  'border-gray-300 bg-gray-50 px-3 py-2',
  'text-gray-900 outline-none',
  'focus:border-[#76b900]',
  'dark:border-neutral-700',
  'dark:bg-neutral-900',
  'dark:text-white',
].join(' ');

export const SettingDialog: FC<Props> = ({
  open,
  onClose,
}) => {
  const modalRef =
    useRef<HTMLDivElement>(null);

  const [settings, setSettings] =
    useState<SearchSettings>(
      DEFAULT_SEARCH_SETTINGS,
    );

  useEffect(() => {
    if (open) {
      setSettings(loadSearchSettings());
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (
      event: MouseEvent,
    ) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(
          event.target as Node,
        )
      ) {
        onClose();
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener(
      'mousedown',
      handleMouseDown,
    );

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'mousedown',
        handleMouseDown,
      );

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    open,
    onClose,
  ]);

  const updateNumber = (
    key:
      | 'maxResults'
      | 'minSimilarity'
      | 'criticMaxResults',
    value: string,
  ) => {
    const parsed = Number(value);

    setSettings(current => ({
      ...current,
      [key]:
        Number.isFinite(parsed)
          ? parsed
          : 0,
    }));
  };

  const handleSave = () => {
    if (
      settings.maxResults < 1 ||
      settings.maxResults > 100
    ) {
      toast.error(
        '결과 클립 개수는 1~100 사이여야 합니다.',
      );
      return;
    }

    if (
      settings.minSimilarity < 0 ||
      settings.minSimilarity > 1
    ) {
      toast.error(
        '유사도 임계값은 0~1 사이여야 합니다.',
      );
      return;
    }

    if (
      settings.criticMaxResults < 1 ||
      settings.criticMaxResults > 100
    ) {
      toast.error(
        'Critic Agent 분석 개수는 1~100 사이여야 합니다.',
      );
      return;
    }

    saveSearchSettings(settings);

    toast.success(
      '검색 설정을 저장했습니다.',
    );

    onClose();
  };

  const handleReset = () => {
    setSettings(
      DEFAULT_SEARCH_SETTINGS,
    );
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-black"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          검색 설정
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Search 메뉴에서 실행되는 영상 검색에 적용됩니다.
        </p>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            최대 결과 클립 개수
          </label>

          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={settings.maxResults}
            onChange={event =>
              updateNumber(
                'maxResults',
                event.target.value,
              )
            }
            className={inputClass}
          />

          <p className="mt-1 text-xs text-gray-500">
            최종 검색 결과에 표시할 최대 클립 개수입니다.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            결과 유사도 임계값
          </label>

          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={settings.minSimilarity}
            onChange={event =>
              updateNumber(
                'minSimilarity',
                event.target.value,
              )
            }
            className={inputClass}
          />

          <p className="mt-1 text-xs text-gray-500">
            이 값보다 유사도가 낮은 결과 클립은 표시하지 않습니다.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 dark:border-neutral-700">
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Critic Agent 사용
            </div>

            <div className="text-xs text-gray-500">
              검색 결과를 VLM으로 재검증합니다.
            </div>
          </div>

          <input
            type="checkbox"
            checked={settings.useCritic}
            onChange={event =>
              setSettings(current => ({
                ...current,
                useCritic:
                  event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#76b900]"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Critic Agent 최대 분석 개수
          </label>

          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={settings.criticMaxResults}
            disabled={!settings.useCritic}
            onChange={event =>
              updateNumber(
                'criticMaxResults',
                event.target.value,
              )
            }
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
          />

          <p className="mt-1 text-xs text-gray-500">
            유사도가 높은 결과부터 지정한 개수까지만 검증합니다.
          </p>
        </div>

        <div className="mt-6 flex justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-300 dark:hover:bg-neutral-800"
          >
            기본값
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-300 px-4 py-2 text-sm text-gray-900 hover:bg-gray-400 dark:bg-gray-700 dark:text-white"
            >
              취소
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-[#76b900] px-4 py-2 text-sm text-white hover:bg-[#5a9100]"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
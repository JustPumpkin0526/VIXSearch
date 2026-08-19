import React from 'react';
import { Button } from '@nvidia/foundations-react-core';

const FIELD_LABELS: Record<string, string> = {
    filename: '파일명',
    bytes: '파일 크기',
    uploaded_at: '업로드 일시',
    created_at: '생성 일시',
    width: '가로 해상도',
    height: '세로 해상도',
    duration_seconds: '영상 길이',
    codec: '코덱',
    username: '업로드 사용자',
    group_id: '그룹 ID',
};

const LABEL_CLASS =
    'text-xs font-semibold uppercase tracking-[0.08em] ' +
    'text-gray-500 dark:text-gray-400';

const VALUE_CLASS =
    'text-sm font-medium leading-6 text-gray-900 ' +
    'dark:text-gray-100 break-words whitespace-pre-wrap';

export const VideoDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    video?: Record<string, any> | null;
}> = ({ isOpen, onClose, video }) => {
    if (!isOpen) {
        return null;
    }

    const excluded = new Set([
        'video_id',
        'stream_id',
        'timestamp',
        'sensor_id',
        'show_filename',
        'storage_filename',
        'video_url',
        'file_path',
        'mime_type',
        'checksum',
        'metadata',
    ]);

    const prioritizedKeys = [
        'filename',
        'bytes',
        'uploaded_at',
        'created_at',
        'width',
        'height',
        'duration_seconds',
        'codec',
    ];

    const formatFieldLabel = (key: string) => {
        return FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
    };

    const tryFormatTimestamp = (value: unknown) => {
        if (typeof value !== 'string') {
            return null;
        }

        const isoMatch = value.match(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );

        if (!isoMatch) {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        const parts = new Intl.DateTimeFormat('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date);

        const getPart = (type: Intl.DateTimeFormatPartTypes) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return (
            `${getPart('year')}/` +
            `${getPart('month')}/` +
            `${getPart('day')} · ` +
            `${getPart('hour')}:` +
            `${getPart('minute')}:` +
            `${getPart('second')}`
        );
    };

    const formatFileSize = (value: unknown) => {
        const bytes = Number(value);

        if (!Number.isFinite(bytes) || bytes < 0) {
            return null;
        }

        if (bytes === 0) {
            return '0 B';
        }

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const unitIndex = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1,
        );

        const formattedValue = bytes / 1024 ** unitIndex;

        return `${formattedValue.toFixed(
            unitIndex === 0 ? 0 : 2,
        )} ${units[unitIndex]}`;
    };

    const formatDuration = (value: unknown) => {
        const totalSeconds = Number(value);

        if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
            return null;
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const pad = (number: number) =>
            String(number).padStart(2, '0');

        return hours > 0
            ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
            : `${pad(minutes)}:${pad(seconds)}`;
    };

    const renderValue = (key: string, raw: unknown) => {
        if (key === 'bytes') {
            const formattedSize = formatFileSize(raw);

            if (formattedSize) {
                return formattedSize;
            }
        }

        if (key === 'duration_seconds') {
            const formattedDuration = formatDuration(raw);

            if (formattedDuration) {
                return formattedDuration;
            }
        }

        const formattedTimestamp = tryFormatTimestamp(raw);

        if (formattedTimestamp) {
            return (
                <span className="whitespace-nowrap">
                    {formattedTimestamp}
                </span>
            );
        }

        if (typeof raw === 'object' && raw !== null) {
            return (
                <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700 dark:bg-neutral-950 dark:text-gray-300">
                    {JSON.stringify(raw, null, 2)}
                </pre>
            );
        }

        return String(raw ?? '-');
    };

    const renderRows = () => {
        if (!video) {
            return (
                <div className="flex min-h-56 items-center justify-center">
                    <div className="text-center">
                        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-green-500 dark:border-neutral-700 dark:border-t-green-400" />

                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            동영상 정보를 불러오는 중입니다.
                        </p>
                    </div>
                </div>
            );
        }

        const keys = Object.keys(video).filter(
            (key) => !excluded.has(key),
        );

        const rest = keys
            .filter((key) => !prioritizedKeys.includes(key))
            .sort();

        const ordered = [
            ...prioritizedKeys.filter((key) => keys.includes(key)),
            ...rest,
        ];

        if (ordered.length === 0) {
            return (
                <div className="flex min-h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    표시할 상세 정보가 없습니다.
                </div>
            );
        }

        return (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                {ordered.map((key, index) => (
                    <div
                        key={key}
                        className={[
                            'group grid grid-cols-1 gap-2 px-5 py-4',
                            'transition-colors duration-150',
                            'hover:bg-gray-50/80 dark:hover:bg-neutral-800/60',
                            'sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6',
                            index < ordered.length - 1
                                ? 'border-b border-gray-100 dark:border-neutral-800'
                                : '',
                        ].join(' ')}
                    >
                        <div className="flex min-w-0 items-center">
                            <div className="mr-3 hidden h-8 w-1 rounded-full bg-gray-200 transition-colors group-hover:bg-green-500 dark:bg-neutral-700 dark:group-hover:bg-green-400 sm:block" />

                            <div className={LABEL_CLASS}>
                                {formatFieldLabel(key)}
                            </div>
                        </div>

                        <div className={VALUE_CLASS}>
                            {renderValue(key, video[key])}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-details-title"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative z-[1201] flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] dark:border-neutral-700 dark:bg-neutral-900">
                <div className="h-1 w-full bg-gradient-to-r from-green-600 via-green-400 to-emerald-600" />

                <header className="relative flex flex-shrink-0 items-start justify-between gap-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-5 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-800 sm:px-7">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-green-700 shadow-sm dark:border-green-900/70 dark:bg-green-950/50 dark:text-green-400">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                className="h-6 w-6"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 10.5 19.5 8.25v7.5l-3.75-2.25m-9 4.5h7.5A1.5 1.5 0 0 0 15.75 16.5v-9A1.5 1.5 0 0 0 14.25 6h-7.5A1.5 1.5 0 0 0 5.25 7.5v9A1.5 1.5 0 0 0 6.75 18Z"
                                />
                            </svg>
                        </div>

                        <div className="min-w-0">
                            <h3
                                id="video-details-title"
                                className="truncate text-lg font-semibold tracking-tight text-gray-950 dark:text-white"
                            >
                                동영상 상세 정보
                            </h3>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                선택한 동영상의 파일 및 메타데이터 정보입니다.
                            </p>
                        </div>
                    </div>

                    <Button kind="tertiary" onClick={onClose}>
                        닫기
                    </Button>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50/70 px-4 py-5 dark:bg-neutral-950/40 sm:px-7 sm:py-6">
                    {renderRows()}
                </main>

                <footer className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-7">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        Video metadata
                    </p>

                    {video?.filename && (
                        <p
                            className="max-w-[60%] truncate text-xs font-medium text-gray-500 dark:text-gray-400"
                            title={String(video.filename)}
                        >
                            {String(video.filename)}
                        </p>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default VideoDetailsModal;
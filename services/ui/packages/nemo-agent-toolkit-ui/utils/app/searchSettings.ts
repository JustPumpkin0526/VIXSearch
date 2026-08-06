export type SearchUserMode =
  | 'search'
  | 'debug';

export interface SearchSettings {
  userMode: SearchUserMode;
  maxResults: number;
  minSimilarity: number;
  useCritic: boolean;
  criticMaxResults: number;
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  userMode: 'search',
  maxResults: 10,
  minSimilarity: 0.1,
  useCritic: true,
  criticMaxResults: 5,
};

export const SEARCH_SETTINGS_STORAGE_KEY = 'vixsearch:search-settings';

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

export function normalizeSearchSettings(
  value?: Partial<SearchSettings> | null,
): SearchSettings {
  return {
    userMode:
      value?.userMode === 'debug'
        ? 'debug'
        : 'search',

    maxResults: Math.round(
      clamp(
        Number(value?.maxResults) ||
          DEFAULT_SEARCH_SETTINGS.maxResults,
        1,
        100,
      ),
    ),

    minSimilarity: clamp(
      Number(value?.minSimilarity) ||
        DEFAULT_SEARCH_SETTINGS.minSimilarity,
      0,
      1,
    ),

    useCritic:
      typeof value?.useCritic === 'boolean'
        ? value.useCritic
        : DEFAULT_SEARCH_SETTINGS.useCritic,

    criticMaxResults: Math.round(
      clamp(
        Number(value?.criticMaxResults) ||
          DEFAULT_SEARCH_SETTINGS.criticMaxResults,
        1,
        100,
      ),
    ),
  };
}

export function loadSearchSettings(): SearchSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SEARCH_SETTINGS;
  }

  try {
    const stored =
      window.localStorage.getItem(
        SEARCH_SETTINGS_STORAGE_KEY,
      );

    if (!stored) {
      return DEFAULT_SEARCH_SETTINGS;
    }

    return normalizeSearchSettings(
      JSON.parse(stored),
    );
  } catch {
    return DEFAULT_SEARCH_SETTINGS;
  }
}

export function saveSearchSettings(
  settings: SearchSettings,
): SearchSettings {
  const normalized =
    normalizeSearchSettings(settings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      SEARCH_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    );

    window.dispatchEvent(
      new CustomEvent(
        'vixsearch:search-settings-changed',
        {
          detail: normalized,
        },
      ),
    );
  }

  return normalized;
}
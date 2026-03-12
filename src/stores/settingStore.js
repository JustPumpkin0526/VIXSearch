// src/stores/settingStore.js
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// localStorage에서 테마 불러오기
const getStoredTheme = () => {
  const stored = localStorage.getItem('vss_theme');
  if (stored) return stored;
  
  // 시스템 설정 확인
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'auto';
  }
  return 'light';
};

// localStorage에서 언어 불러오기
const getStoredLanguage = () => {
  const stored = localStorage.getItem('vss_language');
  return stored || 'ko'; // 기본값은 한국어
};

export const useSettingStore = defineStore('setting', () => {
  const captionPrompt = ref("You will be given captions from sequential clips of a video. Aggregate captions in the format start_time:end_time:caption based on whether captions are related to one another or create a continuous scene.");
  const aggregationPrompt = ref("Based on the available information, generate a summary that captures the important events in the video. The summary should be organized chronologically and in logical sections. This should be a concise, yet descriptive summary of all the important events. The format should be intuitive and easy for a user to read and understand what happened. Format the output in Markdown so it can be displayed nicely. Timestamps are in seconds so please format them as SS.SSS");
  
  // 이미지용 프롬프트 (이미지 업로드 시 사용)
  const imageCaptionPrompt = ref("You will be given multiple captions produced from a multi-image comparison task, and your job is to merge them into a single clean comparison summary without using any timestamps or chronological language. Combine overlapping statements, remove any timeline-like phrasing, and preserve only information that directly supports the physique comparison between Image 1 and Image 2. Output exactly three labeled paragraphs in complete English sentences: “Image 1”, “Image 2”, and “Key Differences”, where “Key Differences” contains at least three clear contrast statements and does not introduce any new information not present in the captions.");
  const imageAggregationPrompt = ref("Based on the available comparison information, produce a short, user-friendly summary that explains how the people in Image 1 and Image 2 differ in body build and visible proportions, without referencing time, clips, or traffic reports. Format the result in Markdown with a clear heading and two sections: one bullet list summarizing “Image 1” and “Image 2” observations, and one bullet list titled “Differences” that contains at least three direct contrasts. Use complete English sentences, avoid sensitive inferences (age, identity, ethnicity, health), and keep the summary concise and focused on the comparison.");
  const chunk = ref(-1); // 자동 지정 기본값
  const nfmc = ref(0);
  const frameWidth = ref(0);
  const frameHeight = ref(0);
  const topk = ref(100);
  const topp = ref(1.0);
  const temp = ref(0.4);
  const maxTokens = ref(512);
  const seed = ref(1);
  const batch = ref(6);
  const RAG_batch = ref(1);
  const RAG_topk = ref(5);
  const S_TopP = ref(0.7);
  const S_TEMPERATURE = ref(0.2);
  const SMAX_TOKENS = ref(2048);
  const C_TopP = ref(0.7);
  const C_TEMPERATURE = ref(0.2);
  const C_MAX_TOKENS = ref(2048);
  const A_TopP = ref(0.7);
  const A_TEMPERATURE = ref(0.2);
  const A_MAX_TOKENS = ref(2048);
  const enableAudio = ref(false);
  
  // 공통 파라미터 (query와 summarize 구분 없이 통일)
  // -1: 자동 지정, 0: Chunk 없음, 그 외: 명시적 값
  const searchChunk = ref(-1);
  const searchTopK = ref(80);
  const searchTopP = ref(1.0);
  const searchTemperature = ref(0.3);
  const searchMaxTokens = ref(1024);
  const searchSeed = ref(42);
  
  // Summarize 전용 파라미터 (검색 설정에서 사용)
  const summarizeNumFramesPerChunk = ref(0);
  const summarizeFrameWidth = ref(1920);
  const summarizeFrameHeight = ref(1080);
  const summarizeBatchSize = ref(6);
  const summarizeRagBatchSize = ref(1);
  const summarizeRagTopK = ref(5);
  const summarizeSummarizeTopP = ref(0.7);
  const summarizeSummarizeTemperature = ref(0.2);
  const summarizeSummarizeMaxTokens = ref(2048);
  const summarizeChatTopP = ref(0.7);
  const summarizeChatTemperature = ref(0.2);
  const summarizeChatMaxTokens = ref(2048);
  const summarizeNotificationTopP = ref(0.7);
  const summarizeNotificationTemperature = ref(0.2);
  const summarizeNotificationMaxTokens = ref(2048);
  const summarizeEnableAudio = ref(false);
  
  // 테마 상태 (light, dark, auto)
  const theme = ref(getStoredTheme());
  
  // 언어 상태 (ko, en)
  const language = ref(getStoredLanguage());

  // 테마 적용 함수 (watch보다 먼저 정의)
  const applyTheme = (themeValue) => {
    const root = document.documentElement;
    let isDark = false;

    if (themeValue === 'dark') {
      isDark = true;
    } else if (themeValue === 'auto') {
      // 시스템 설정 확인
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        isDark = true;
      }
    }

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  // 테마 변경 감지 및 localStorage 저장
  watch(theme, (newTheme) => {
    localStorage.setItem('vss_theme', newTheme);
    applyTheme(newTheme);
  }, { immediate: true });

  // 언어 변경 감지 및 localStorage 저장
  watch(language, (newLanguage) => {
    localStorage.setItem('vss_language', newLanguage);
  }, { immediate: true });

  // 시스템 테마 변경 감지 (auto 모드일 때)
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'auto') {
        applyTheme('auto');
      }
    });
  }

  return {
    captionPrompt, aggregationPrompt, imageCaptionPrompt, imageAggregationPrompt, chunk, nfmc, frameWidth, frameHeight,
    topk, topp, temp, maxTokens, seed, batch, RAG_batch, RAG_topk,
    S_TopP, S_TEMPERATURE, SMAX_TOKENS, C_TopP, C_TEMPERATURE, C_MAX_TOKENS,
    A_TopP, A_TEMPERATURE, A_MAX_TOKENS, enableAudio, theme, language,
    searchChunk, searchTopK, searchTopP, searchTemperature, searchMaxTokens, searchSeed,
    summarizeNumFramesPerChunk, summarizeFrameWidth, summarizeFrameHeight,
    summarizeBatchSize, summarizeRagBatchSize, summarizeRagTopK,
    summarizeSummarizeTopP, summarizeSummarizeTemperature, summarizeSummarizeMaxTokens,
    summarizeChatTopP, summarizeChatTemperature, summarizeChatMaxTokens,
    summarizeNotificationTopP, summarizeNotificationTemperature, summarizeNotificationMaxTokens,
    summarizeEnableAudio
  };
});
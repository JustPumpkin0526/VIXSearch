<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-950 p-10">
    <div class="grid lg:grid-cols-[1fr_400px] gap-6 h-full">
      <!-- 좌측: 리포트 뷰어 -->
      <section
        class="h-[calc(100vh-10rem)] rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col relative"
        >
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-400/40 dark:border-emerald-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400 uppercase">
                {{ tReport.reportViewer }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ selectedReport?.title || tReport.selectReport }}
              <span v-if="selectedReport?.createdAt" class="text-gray-500 dark:text-gray-400 ml-2">
                · {{ formatDate(selectedReport.createdAt) }}
              </span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="selectedReport && !isEditing"
              @click="prevPage"
              :disabled="currentPage <= 1"
              class="w-9 h-9 flex items-center justify-center bg-slate-200/70 dark:bg-gray-700 hover:bg-slate-400/80 dark:hover:bg-gray-600 border border-slate-500/60 dark:border-gray-600 text-slate-700 dark:text-gray-200 rounded-lg shadow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              :title="tReport.prevPage">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              v-if="selectedReport && !isEditing"
              @click="nextPage"
              :disabled="currentPage >= totalPages"
              class="w-9 h-9 flex items-center justify-center bg-slate-200/70 dark:bg-gray-700 hover:bg-slate-400/80 dark:hover:bg-gray-600 border border-slate-500/60 dark:border-gray-600 text-slate-700 dark:text-gray-200 rounded-lg shadow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              :title="tReport.nextPage">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              v-if="selectedReport && !isEditing"
              @click="toggleEditMode"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/90 dark:bg-blue-600 hover:bg-blue-400 dark:hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-600/30 transition-all duration-200 transform hover:scale-[1.03] active:scale-[0.97]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span class="text-sm font-medium">{{ settingStore.language === 'ko' ? '편집' : 'Edit' }}</span>
            </button>
            <button
              v-if="selectedReport && isEditing"
              @click="saveReport"
              :disabled="isSaving"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/90 dark:bg-green-600 hover:bg-green-400 dark:hover:bg-green-500 text-white shadow-lg shadow-green-500/30 dark:shadow-green-600/30 transition-all duration-200 transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="!isSaving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm font-medium">{{ settingStore.language === 'ko' ? '저장' : 'Save' }}</span>
            </button>
            <button
              v-if="selectedReport && isEditing"
              @click="cancelEdit"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/90 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-white shadow-lg transition-all duration-200 transform hover:scale-[1.03] active:scale-[0.97]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span class="text-sm font-medium">{{ settingStore.language === 'ko' ? '취소' : 'Cancel' }}</span>
            </button>
            <button
              v-if="selectedReport && !isEditing"
              @click="exportFile"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/90 dark:bg-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 dark:shadow-emerald-600/30 transition-all duration-200 transform hover:scale-[1.03] active:scale-[0.97]">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span class="text-sm font-medium">{{ tReport.export }}</span>
            </button>
          </div>
        </header>

        <!-- 리포트 내용 -->
        <div
          v-if="selectedReport"
          class="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-gray-100 dark:bg-gray-950 overflow-hidden shadow-inner"
          :style="{ maxHeight: '100%', overflowY: 'auto' }">
          <!-- 편집 모드: 마크다운 편집기 -->
          <div v-if="isEditing" class="h-full flex flex-col">
            <div class="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 overflow-auto">
              <div class="p-4 prose prose-sm max-w-none dark:prose-invert markdown-editing-preview" v-html="formattedEditingContent"></div>
            </div>
            <div class="mt-2 border-t border-gray-300 dark:border-gray-600 pt-2">
              <textarea
                :value="editingContentForDisplay"
                @input="handleEditingContentInput"
                @keydown="handleTextareaKeydown"
                class="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none font-mono text-xs"
                :placeholder="settingStore.language === 'ko' ? '마크다운 형식으로 편집하세요... (이미지는 수정할 수 없습니다)' : 'Edit in markdown format... (Images cannot be edited)'"
              ></textarea>
            </div>
          </div>
          <!-- 읽기 모드: Word 문서 스타일 컨테이너 -->
          <div v-else class="relative">
            <!-- 로딩 화면 -->
            <div v-if="!isWordPreviewReady" 
                 class="word-document-preview bg-white dark:bg-white shadow-lg mx-auto flex items-center justify-center" 
                 style="min-height: 1056px;">
              <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">
                  {{ selectedReport?.file_url 
                    ? (settingStore.language === 'ko' ? 'Word 파일을 불러오는 중...' : 'Loading Word file...')
                    : (settingStore.language === 'ko' ? '미리보기를 준비하는 중...' : 'Preparing preview...')
                  }}
                </p>
              </div>
            </div>
            <!-- Word 문서 미리보기 -->
            <div v-else-if="selectedReport?.file_url && wordPreviewHtml" 
                 class="word-document-preview bg-white dark:bg-white shadow-lg mx-auto" 
                 v-html="formattedReport"></div>
            <!-- Markdown 미리보기 -->
            <div v-else-if="!selectedReport?.file_url && report" 
                 class="markdown-preview bg-white dark:bg-white shadow-lg mx-auto prose prose-sm max-w-none dark:prose-invert" 
                 v-html="formattedReport"></div>
          </div>
        </div>

        <!-- 빈 상태 -->
        <div v-else class="flex-1 flex items-center justify-center border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900">
          <div class="text-center">
            <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-gray-500 dark:text-gray-400 text-sm">{{ tReport.selectToView }}</p>
          </div>
        </div>

        <!-- 페이지 정보 -->
        <div v-if="selectedReport" class="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ tReport.page }} {{ currentPage }} / {{ totalPages }}</span>
          <span>{{ selectedReport.wordCount || 0 }} {{ tReport.words }}</span>
        </div>

      </section>

      <!-- 우측: 리포트 리스트 -->
      <aside
        class="rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/40 dark:border-blue-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-blue-600 dark:text-blue-400 uppercase">
                {{ tReport.reportLibrary }}
              </span>
            </div>
            <p class="text-xs text-black dark:text-gray-200 mt-1">{{ tReport.total }} {{ totalReports }} {{ tReport.totalReports }}</p>
          </div>
        </header>

        <!-- 검색 및 필터 -->
        <div class="mb-4 space-y-2">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="tReport.searchPlaceholder"
              class="w-full rounded-xl border border-slate-300 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500 px-4 py-2.5 pl-10 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm transition-all"
              @input="handleSearch" />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div class="flex gap-2">
            <button
              @click="sortBy = 'date'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                sortBy === 'date'
                  ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]">
              {{ tReport.sortByDate }}
            </button>
            <button
              @click="sortBy = 'title'"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                sortBy === 'title'
                  ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              ]">
              {{ tReport.sortByTitle }}
            </button>
          </div>
        </div>

        <!-- 리포트 리스트 -->
        <div class="flex-1 overflow-y-auto space-y-3">
          <div v-if="filteredList.length === 0" class="text-center py-12">
            <svg class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-gray-500 dark:text-gray-400 text-sm">{{ tReport.noReports }}</p>
          </div>

          <div
            v-for="r in filteredList"
            :key="r.id"
            @click="open(r)"
            :class="[
              'group p-4 border rounded-xl cursor-pointer transition-all duration-200 relative',
              selectedReport?.id === r.id
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-600 shadow-md'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md'
            ]">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {{ r.title || tReport.noTitle }}
                </h4>
                <p v-if="r.description" class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {{ r.description }}
                </p>
                <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="r.createdAt" class="flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ formatDate(r.createdAt) }}
                  </span>
                  <span v-if="r.wordCount" class="flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {{ r.wordCount }} {{ tReport.words }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  @click.stop="open(r)"
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-emerald-500/10 dark:bg-emerald-500/20 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <!-- 햄버거 메뉴 버튼 -->
                <button
                  @click.stop="openContextMenu(r, $event)"
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 페이지네이션 -->
        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-center gap-2">
            <button 
              class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all" 
              :disabled="page <= 1" 
              @click="handlePageChange(page - 1)">
              〈
            </button>
            <span class="text-sm text-gray-600 dark:text-gray-400">Page {{ page }} / {{ pages }}</span>
            <button 
              class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all" 
              :disabled="page >= pages" 
              @click="handlePageChange(page + 1)">
              〉
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="fixed z-[200]"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[160px]">
          <button 
            class="w-full text-left px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            @click.stop="handleDeleteReport">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{{ tReport.delete }}</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 삭제 확인 다이얼로그 -->
    <Transition name="modal">
      <div v-if="showDeleteConfirm" class="fixed inset-0 flex items-center justify-center z-[100] bg-black/50 backdrop-blur-sm">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 min-w-[350px] max-w-[90vw] relative transform transition-all duration-300">
          <div class="text-lg font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
            <p class="mb-2">{{ tReport.deleteConfirm }}</p>
            <p class="text-sm font-normal text-gray-600 dark:text-gray-400">{{ tReport.deleteConfirmDetail }}</p>
          </div>
          <div class="flex justify-end gap-3 mt-8">
            <button
              class="px-6 py-2.5 rounded-xl bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-sm"
              @click="confirmDeleteReport">{{ tReport.delete }}</button>
            <button
              class="px-6 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-sm"
              @click="showDeleteConfirm = false">{{ tReport.cancel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { marked } from 'marked';
import mammoth from 'mammoth';
import { useSettingStore } from '@/stores/settingStore';
import { getApiBaseUrl } from '@/utils/apiConfig';

const settingStore = useSettingStore();

// ==================== 상수 정의 ====================
const API_BASE_URL = getApiBaseUrl();

// Word 문서 스타일 상수
const WORD_STYLES = {
  FONT_FAMILY: "'Calibri', 'Arial', 'Malgun Gothic', sans-serif",
  FONT_SIZE: {
    TITLE: '28pt',
    HEADING1: '16pt',
    HEADING2: '13pt',
    HEADING3: '11pt',
    PARAGRAPH: '11pt',
    SMALL: '10pt'
  },
  COLOR: {
    TEXT: '#000000',
    LINK: '#0000EE',
    LINK_HOVER: '#0000CC',
    BACKGROUND_LIGHT: '#f0f0f0'
  },
  SPACING: {
    TITLE_MARGIN: '12pt 0',
    HEADING1_MARGIN: '12pt 0 6pt 0',
    HEADING2_MARGIN: '10pt 0 4pt 0',
    HEADING3_MARGIN: '8pt 0 4pt 0',
    PARAGRAPH_MARGIN: '0 0 6pt 0',
    LIST_MARGIN: '6pt 0',
    LIST_ITEM_MARGIN: '3pt 0',
    HORIZONTAL_LINE_MARGIN: '12pt 0'
  },
  LINE_HEIGHT: '1.15',
  PAGE: {
    CONTENT_HEIGHT: 864,
    A4_HEIGHT: 1056,
    A4_WIDTH: 816,
    MARGIN: 96,
    WORDS_PER_PAGE: 500
  },
  IMAGE: {
    MAX_WIDTH: '6in',
    MARGIN: '6pt auto'
  },
  LIST: {
    PADDING_LEFT: '36pt',
    TEXT_INDENT: '-18pt'
  }
};

// 정규식 패턴 상수
const REGEX_PATTERNS = {
  BASE64_IMAGE: /!\[([^\]]*)\]\(data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)\)/g,
  BASE64_IMAGE_SHORT: /!\[([^\]]*)\]\(data:image\/([^;]+);base64,[^)]+\)/g,
  FULL_PLACEHOLDER: /!\[([^\]]*)\]\(이미지\)/g,
  INCOMPLETE_PLACEHOLDER: /!\[([^\]]*)\]\(이미지(?!\))/g,
  INCOMPLETE_WITH_OPEN_PAREN: /!\[([^\]]*)\]\(이미지[^)]*$/g,
  INCOMPLETE_NO_PAREN: /!\[([^\]]*)\](?!\()/g
};

// ==================== 다국어 지원 ====================
const reportTranslations = {
  ko: {
    reportViewer: "Report Viewer",
    selectReport: "리포트를 선택하세요",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    export: "내보내기",
    reportLibrary: "Report Library",
    total: "총",
    totalReports: "개의 리포트",
    searchPlaceholder: "리포트 검색...",
    sortByDate: "최신순",
    sortByTitle: "제목순",
    noReports: "리포트가 없습니다",
    noTitle: "제목 없음",
    selectToView: "리포트를 선택하여 내용을 확인하세요",
    page: "페이지",
    word: "단어",
    words: "단어",
    delete: "삭제",
    deleteConfirm: "이 보고서를 삭제하시겠습니까?",
    deleteConfirmDetail: "이 작업은 되돌릴 수 없습니다.",
    cancel: "취소",
  },
  en: {
    reportViewer: "Report Viewer",
    selectReport: "Select a report",
    prevPage: "Previous Page",
    nextPage: "Next Page",
    export: "Export",
    reportLibrary: "Report Library",
    total: "Total",
    totalReports: "reports",
    searchPlaceholder: "Search reports...",
    sortByDate: "Latest",
    sortByTitle: "Title",
    noReports: "No reports",
    noTitle: "No Title",
    selectToView: "Select a report to view its content",
    page: "Page",
    word: "word",
    words: "words",
    delete: "Delete",
    deleteConfirm: "Are you sure you want to delete this report?",
    deleteConfirmDetail: "This action cannot be undone.",
    cancel: "Cancel",
  }
};

const tReport = computed(() => reportTranslations[settingStore.language] || reportTranslations.ko);

const report = ref("");
const selectedReport = ref(null);
const isEditing = ref(false);
const editingContent = ref("");
const isSaving = ref(false);
const list = ref([]);
const page = ref(1);
const pages = ref(0);
const searchQuery = ref("");
const sortBy = ref("date");
const currentPage = ref(1);
const totalPages = ref(1);
const contextMenu = ref({ visible: false, x: 0, y: 0, report: null });
const showDeleteConfirm = ref(false);
const reportToDelete = ref(null);
const wordPreviewHtml = ref(""); // Word 파일 HTML 미리보기
const wordPages = ref([]); // 페이지 단위로 분할된 Word 내용
const isLoadingWordPreview = ref(false);
const isWordPreviewReady = ref(false); // Word 미리보기 변환 완료 여부

// 필터링 및 정렬된 리스트
const filteredList = computed(() => {
  let filtered = [...list.value];

  // 검색 필터
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(r =>
      (r.title || '').toLowerCase().includes(query) ||
      (r.description || '').toLowerCase().includes(query) ||
      (r.content || '').toLowerCase().includes(query)
    );
  }

  // 정렬
  if (sortBy.value === 'date') {
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // 최신순
    });
  } else if (sortBy.value === 'title') {
    filtered.sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });
  }

  return filtered;
});

// 총 리포트 수
const totalReports = computed(() => list.value.length);

// 포맷된 리포트 내용 (Word 파일이 있으면 Word HTML, 없으면 Markdown)
const formattedReport = computed(() => {
  // Word 파일 미리보기가 준비되었으면 페이지 단위로 나누어서 표시
  if (isWordPreviewReady.value && wordPreviewHtml.value && selectedReport.value?.file_url) {
    return paginatedWordContent.value;
  }
  
  // Word 파일이 없으면 Markdown 표시
  if (!selectedReport.value?.file_url && report.value) {
    try {
      const parsed = marked.parse(report.value);
      return parsed || report.value; // 파싱 결과가 없으면 원본 반환
    } catch (e) {
      console.error('마크다운 파싱 실패:', e);
      return report.value;
    }
  }
  
  return "";
});

// Word 내용을 페이지 단위로 나누기
const paginatedWordContent = computed(() => {
  if (!wordPreviewHtml.value) return "";
  
  // 페이지가 분할된 경우 현재 페이지만 표시
  if (wordPages.value.length > 0) {
    const pageIndex = currentPage.value - 1;
    if (pageIndex >= 0 && pageIndex < wordPages.value.length) {
      return wordPages.value[pageIndex];
    }
    return wordPages.value[0] || wordPreviewHtml.value;
  }
  
  // 아직 페이지가 분할되지 않은 경우 전체 내용 표시
  return wordPreviewHtml.value;
});

// 이미지 변환 유틸리티 함수
function convertBase64ImagesToHtml(content) {
  return content.replace(REGEX_PATTERNS.BASE64_IMAGE, (match, alt, type, base64) => {
    return `<img src="data:image/${type};base64,${base64}" alt="${alt}" class="max-w-full h-auto my-2 rounded" style="max-width: 400px;" />`;
  });
}

// 편집 모드용 포맷된 콘텐츠 (이미지 처리)
const formattedEditingContent = computed(() => {
  if (!editingContent.value) return "";
  
  try {
    const content = convertBase64ImagesToHtml(editingContent.value);
    return marked.parse(content);
  } catch (e) {
    return editingContent.value;
  }
});

// 편집 모드 텍스트 영역에 표시할 내용 (base64 이미지 제거)
const editingContentForDisplay = computed(() => {
  if (!editingContent.value) return "";
  
  return editingContent.value.replace(REGEX_PATTERNS.BASE64_IMAGE_SHORT, (match, alt) => {
    return `![${alt || '이미지'}](이미지)`;
  });
});

// 원본 이미지 추출 유틸리티
function extractOriginalImages(content) {
  const originalImages = [];
  let match;
  const pattern = new RegExp(REGEX_PATTERNS.BASE64_IMAGE);
  
  while ((match = pattern.exec(content)) !== null) {
    originalImages.push({
      fullMatch: match[0],
      alt: match[1] || '',
      position: match.index
    });
  }
  
  return originalImages;
}

// 이미지 맵 생성 유틸리티
function createImageMapByAlt(originalImages) {
  const imageMap = new Map();
  originalImages.forEach(({ fullMatch, alt }) => {
    const altKey = alt || '';
    if (!imageMap.has(altKey)) {
      imageMap.set(altKey, []);
    }
    imageMap.get(altKey).push(fullMatch);
  });
  return imageMap;
}

// 플레이스홀더를 base64 이미지로 복원
function restorePlaceholdersToImages(content, imageMapByAlt) {
  const usedImages = new Set();
  return content.replace(REGEX_PATTERNS.FULL_PLACEHOLDER, (match, alt) => {
    const altKey = alt || '';
    
    // alt로 매칭되는 이미지 찾기
    if (imageMapByAlt.has(altKey)) {
      const availableImages = imageMapByAlt.get(altKey);
      for (const img of availableImages) {
        if (!usedImages.has(img)) {
          usedImages.add(img);
          return img;
        }
      }
      if (availableImages.length > 0) {
        return availableImages[0];
      }
    }
    
    // 빈 alt로 매칭 시도
    if (altKey && imageMapByAlt.has('')) {
      const emptyAltImages = imageMapByAlt.get('');
      for (const img of emptyAltImages) {
        if (!usedImages.has(img)) {
          usedImages.add(img);
          return img;
        }
      }
      if (emptyAltImages.length > 0) {
        return emptyAltImages[0];
      }
    }
    
    return match;
  });
}

// 텍스트 영역 입력 처리 (base64 이미지 플레이스홀더를 원래대로 복원)
// 이미지는 수정 불가능하도록 보호
function handleEditingContentInput(event) {
  const inputValue = event.target.value;
  const originalContent = editingContent.value;
  
  // 원본 이미지 추출
  const originalImages = extractOriginalImages(originalContent);
  
  // 불완전한 플레이스홀더를 완전한 플레이스홀더로 복원
  let newContent = inputValue.replace(REGEX_PATTERNS.INCOMPLETE_PLACEHOLDER, (match, alt) => {
    const matchingImage = originalImages.find(img => img.alt === alt);
    return matchingImage ? `![${alt}](이미지)` : match;
  });
  
  // 완전한 플레이스홀더를 base64 이미지로 복원
  const imageMapByAlt = createImageMapByAlt(originalImages);
  newContent = restorePlaceholdersToImages(newContent, imageMapByAlt);
  
  // 삭제된 이미지 복원
  const originalImageCount = originalImages.length;
  const currentImageCount = (newContent.match(REGEX_PATTERNS.BASE64_IMAGE) || []).length;
  
  if (currentImageCount < originalImageCount) {
    const missingImages = originalImages.filter(img => !newContent.includes(img.fullMatch));
    if (missingImages.length > 0) {
      const restoredImages = missingImages.map(img => img.fullMatch).join('\n\n');
      newContent = newContent.trim() + '\n\n' + restoredImages;
    }
  }
  
  editingContent.value = newContent;
}

// 플레이스홀더와 삭제 범위가 겹치는지 확인
function isPlaceholderOverlapping(placeholderStart, placeholderEnd, deleteStart, deleteEnd) {
  return deleteStart < placeholderEnd && deleteEnd > placeholderStart;
}

// 플레이스홀더 삭제 방지 체크
function checkPlaceholderDeletion(textarea, start, end, checkRange = 200) {
  const value = textarea.value;
  const checkStart = Math.max(0, start - checkRange);
  const checkEnd = Math.min(value.length, end + checkRange);
  const checkText = value.substring(checkStart, checkEnd);
  
  const incompletePatterns = [
    { pattern: REGEX_PATTERNS.INCOMPLETE_WITH_OPEN_PAREN },
    { pattern: REGEX_PATTERNS.INCOMPLETE_NO_PAREN }
  ];
  
  // 완전한 플레이스홀더 확인
  let match;
  const fullPattern = new RegExp(REGEX_PATTERNS.FULL_PLACEHOLDER);
  while ((match = fullPattern.exec(checkText)) !== null) {
    const placeholderStart = checkStart + match.index;
    const placeholderEnd = placeholderStart + match[0].length;
    
    if (isPlaceholderOverlapping(placeholderStart, placeholderEnd, start, end)) {
      return {
        prevent: true,
        message: settingStore.language === 'ko' 
          ? '이미지는 삭제할 수 없습니다.' 
          : 'Images cannot be deleted.'
      };
    }
  }
  
  // 불완전한 플레이스홀더 확인
  for (const { pattern } of incompletePatterns) {
    const regex = new RegExp(pattern);
    regex.lastIndex = 0;
    while ((match = regex.exec(checkText)) !== null) {
      const placeholderStart = checkStart + match.index;
      const placeholderEnd = placeholderStart + match[0].length;
      
      if (isPlaceholderOverlapping(placeholderStart, placeholderEnd, start, end)) {
        return {
          prevent: true,
          message: settingStore.language === 'ko' 
            ? '이미지 플레이스홀더의 일부를 삭제할 수 없습니다.' 
            : 'Cannot delete part of image placeholder.'
        };
      }
    }
  }
  
  return { prevent: false };
}

// 텍스트 영역 키보드 이벤트 처리 (이미지 삭제 방지)
function handleTextareaKeydown(event) {
  const textarea = event.target;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  
  // 삭제 키 처리
  if (event.key === 'Delete' || event.key === 'Backspace' || (event.ctrlKey && event.key === 'x')) {
    const checkResult = checkPlaceholderDeletion(textarea, start, end);
    
    if (checkResult.prevent) {
      event.preventDefault();
      event.stopPropagation();
      alert(checkResult.message);
      return false;
    }
    
    // 삭제 후 예상 텍스트 확인
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    const expectedText = beforeText + afterText;
    const checkRange2 = 150;
    const checkStart2 = Math.max(0, start - checkRange2);
    const checkEnd2 = Math.min(expectedText.length, end + checkRange2);
    const expectedCheckText = expectedText.substring(checkStart2, checkEnd2);
    
    // 불완전한 플레이스홀더 생성 방지
    const incompletePatterns = [
      REGEX_PATTERNS.INCOMPLETE_WITH_OPEN_PAREN,
      REGEX_PATTERNS.INCOMPLETE_NO_PAREN
    ];
    
    for (const pattern of incompletePatterns) {
      if (new RegExp(pattern).test(expectedCheckText)) {
        event.preventDefault();
        event.stopPropagation();
        alert(settingStore.language === 'ko' 
          ? '이미지 플레이스홀더의 일부를 삭제할 수 없습니다.' 
          : 'Cannot delete part of image placeholder.');
        return false;
      }
    }
  }
  
  // 붙여넣기 처리
  if (event.ctrlKey && event.key === 'v') {
    setTimeout(() => {
      const newValue = textarea.value;
      const newStart = textarea.selectionStart;
      const newEnd = textarea.selectionEnd;
      const pastedText = newValue.substring(
        Math.max(0, newStart - 100),
        Math.min(newValue.length, newEnd + 100)
      );
      
      if (REGEX_PATTERNS.FULL_PLACEHOLDER.test(pastedText)) {
        handleEditingContentInput({ target: textarea });
      }
    }, 0);
  }
}

// 타이머 변수들 (컴포넌트 스코프) - ref로 선언하여 반응성 유지
const wordPreviewTimeout = ref(null);
const markdownStyleTimeout = ref(null);
const editingStyleTimeout = ref(null);

// Word HTML이 업데이트될 때마다 스타일 적용 및 페이지 계산
watch(wordPreviewHtml, async () => {
  if (wordPreviewHtml.value && !isWordPreviewReady.value) {
    // 이전 타이머 취소
    if (wordPreviewTimeout.value) {
      clearTimeout(wordPreviewTimeout.value);
    }
    
    // DOM 업데이트 후 스타일 적용
    await nextTick();
    wordPreviewTimeout.value = setTimeout(async () => {
      applyWordStyles();
      // 페이지 수 계산 및 페이지 분할
      await calculateWordPages();
      await splitWordIntoPages();
    }, 400);
  }
});

// 마크다운 미리보기가 업데이트될 때마다 스타일 적용 (디바운싱)
watch(formattedReport, async () => {
  // Word 파일이 없고, report 내용이 있을 때 마크다운 스타일 적용
  if (!selectedReport.value?.file_url && report.value && formattedReport.value) {
    // 이전 타이머 취소
    if (markdownStyleTimeout.value) {
      clearTimeout(markdownStyleTimeout.value);
    }
    
    await nextTick();
    markdownStyleTimeout.value = setTimeout(() => {
      applyMarkdownStyles();
    }, 150);
  }
});

// report 값이 변경될 때도 마크다운 스타일 적용
watch(report, async () => {
  if (!selectedReport.value?.file_url && report.value) {
    // 이전 타이머 취소
    if (markdownStyleTimeout.value) {
      clearTimeout(markdownStyleTimeout.value);
    }
    
    await nextTick();
    markdownStyleTimeout.value = setTimeout(() => {
      applyMarkdownStyles();
    }, 200);
  }
});

// 편집 모드 마크다운 미리보기 스타일 적용 (디바운싱)
watch(formattedEditingContent, async () => {
  if (isEditing.value) {
    // 이전 타이머 취소
    if (editingStyleTimeout.value) {
      clearTimeout(editingStyleTimeout.value);
    }
    
    await nextTick();
    editingStyleTimeout.value = setTimeout(() => {
      applyMarkdownStyles('.markdown-editing-preview');
    }, 150);
  }
});

// 편집 모드 종료 시 읽기 모드로 전환할 때 마크다운 스타일 다시 적용
watch(isEditing, async (newValue, oldValue) => {
  // 편집 모드에서 읽기 모드로 전환할 때만 실행
  if (oldValue === true && newValue === false) {
    // Word 파일이 없고, report 내용이 있을 때 마크다운 스타일 적용
    if (!selectedReport.value?.file_url && report.value) {
      // 이전 타이머 취소
      if (markdownStyleTimeout.value) {
        clearTimeout(markdownStyleTimeout.value);
      }
      
      // DOM이 완전히 업데이트될 때까지 여러 번 nextTick을 기다림
      await nextTick();
      await nextTick();
      
      // 즉시 한 번 적용
      applyMarkdownStyles();
      
      markdownStyleTimeout.value = setTimeout(() => {
        applyMarkdownStyles();
      }, 100);
      
      // 추가로 한 번 더 적용 (이미지 로드 등을 고려)
      setTimeout(() => {
        applyMarkdownStyles();
      }, 300);
      
      // 최종 확인 (더 긴 지연)
      setTimeout(() => {
        applyMarkdownStyles();
      }, 600);
    }
  }
});

// 페이지가 변경될 때마다 스타일 다시 적용
watch(currentPage, async () => {
  if (selectedReport.value?.file_url && wordPages.value.length > 0) {
    await nextTick();
    setTimeout(() => {
      applyWordStyles();
    }, 100);
  }
});

// 페이지 분할된 내용이 업데이트될 때마다 스타일 적용
watch(paginatedWordContent, async () => {
  if (selectedReport.value?.file_url && wordPages.value.length > 0) {
    await nextTick();
    setTimeout(() => {
      applyWordStyles();
    }, 100);
  }
});

// 페이지 div 생성 유틸리티
function createPageDiv(content, hasImage) {
  const pageDiv = document.createElement('div');
  pageDiv.className = hasImage ? 'word-content word-content-with-image' : 'word-content';
  
  if (hasImage) {
    pageDiv.style.height = 'auto';
    pageDiv.style.minHeight = `${WORD_STYLES.PAGE.CONTENT_HEIGHT}px`;
    pageDiv.style.overflow = 'visible';
    pageDiv.style.maxHeight = 'none';
  } else {
    pageDiv.style.height = `${WORD_STYLES.PAGE.CONTENT_HEIGHT}px`;
    pageDiv.style.overflow = 'hidden';
  }
  
  content.forEach(el => pageDiv.appendChild(el.cloneNode(true)));
  return pageDiv;
}

// 요소가 이미지를 포함하는지 확인
function containsImage(element) {
  return element.tagName === 'IMG' || element.querySelector('img') !== null;
}

// 이미지의 실제 높이를 정확히 측정
function getImageElementHeight(element) {
  const img = element.tagName === 'IMG' ? element : element.querySelector('img');
  if (!img) return element.offsetHeight || element.scrollHeight || 0;
  
  if (img.complete && img.naturalHeight > 0) {
    const imgHeight = img.offsetHeight || img.naturalHeight;
    const computedStyle = window.getComputedStyle(element);
    const elementPadding = parseFloat(computedStyle.paddingTop || '0') + 
                          parseFloat(computedStyle.paddingBottom || '0');
    const elementMargin = parseFloat(computedStyle.marginTop || '0') + 
                         parseFloat(computedStyle.marginBottom || '0');
    const imgComputedStyle = window.getComputedStyle(img);
    const imgMargin = parseFloat(imgComputedStyle.marginTop || '0') + 
                     parseFloat(imgComputedStyle.marginBottom || '0');
    
    return imgHeight + elementPadding + elementMargin + imgMargin;
  }
  
  const fallbackHeight = element.offsetHeight || element.scrollHeight || 0;
  return Math.max(fallbackHeight, 200);
}

// ==================== 페이지 분할 유틸리티 ====================

// 큰 이미지 처리 (페이지 높이보다 큰 이미지)
function handleLargeImage(child, pageContentHeight, currentPageContent, pages) {
  // 현재 페이지에 내용이 있으면 먼저 저장
  if (currentPageContent.length > 0) {
    const pageDiv = createPageDiv(currentPageContent, false);
    pages.push(pageDiv.outerHTML);
  }
  // 큰 이미지는 별도 페이지에 배치
  const pageDiv = createPageDiv([child], true);
  pages.push(pageDiv.outerHTML);
  return { currentPageContent: [], currentPageHeight: 0 };
}

// 이미지 요소를 페이지에 배치
function placeImageElement(child, childHeight, pageContentHeight, currentPageContent, currentPageHeight, pages) {
  const availableSpace = pageContentHeight - currentPageHeight;
  
  // 이미지가 현재 페이지에 완전히 들어갈 수 있는지 확인
  if (childHeight > availableSpace - 20 && currentPageContent.length > 0) {
    // 현재 페이지 저장
    const pageDiv = createPageDiv(currentPageContent, false);
    pages.push(pageDiv.outerHTML);
    // 새 페이지에 이미지 배치
    return { currentPageContent: [child.cloneNode(true)], currentPageHeight: childHeight };
  } else if (currentPageHeight + childHeight > pageContentHeight && currentPageContent.length > 0) {
    // 현재 페이지에 이미지가 들어가지 않으면 새 페이지로
    const pageDiv = createPageDiv(currentPageContent, false);
    pages.push(pageDiv.outerHTML);
    // 새 페이지에 이미지 배치
    return { currentPageContent: [child.cloneNode(true)], currentPageHeight: childHeight };
  } else {
    // 현재 페이지에 이미지 추가 가능
    currentPageContent.push(child.cloneNode(true));
    return { currentPageContent, currentPageHeight: currentPageHeight + childHeight };
  }
}

// 텍스트 요소를 페이지에 배치
function placeTextElement(child, childHeight, pageContentHeight, currentPageContent, currentPageHeight, pages) {
  // 텍스트가 잘리지 않도록 여유 공간을 두되, 너무 보수적이지 않게
  //const SAFETY_MARGIN = 5; // 5px 여유 공간 (줄임)
  
  // 현재 페이지에 남은 공간
  const availableSpace = pageContentHeight - currentPageHeight;
  
  // 텍스트 요소가 현재 페이지에 완전히 들어갈 수 있는지 확인
  // availableSpace가 childHeight보다 충분히 크면 현재 페이지에 추가
  if (availableSpace >= childHeight) { // + SAFETY_MARGIN) {
    // 현재 페이지에 텍스트 요소 추가 가능
    currentPageContent.push(child.cloneNode(true));
    return { currentPageContent, currentPageHeight: currentPageHeight + childHeight };
  } else if (currentPageContent.length > 0) {
    // 현재 페이지에 공간이 부족하면 다음 페이지로 이동
    const pageDiv = createPageDiv(currentPageContent, false);
    pages.push(pageDiv.outerHTML);
    // 새 페이지 시작
    return { currentPageContent: [child.cloneNode(true)], currentPageHeight: childHeight };
  } else {
    // 현재 페이지가 비어있으면 무조건 추가 (첫 요소)
    currentPageContent.push(child.cloneNode(true));
    return { currentPageContent, currentPageHeight: childHeight };
  }
}

// 이미지가 포함된 페이지의 스타일 조정
function adjustImagePageStyles(pages) {
  for (let i = 0; i < pages.length; i++) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pages[i];
    const hasImageInPage = tempDiv.querySelector('img') !== null;
    
    if (hasImageInPage) {
      const wordContent = tempDiv.querySelector('.word-content');
      if (wordContent) {
        wordContent.classList.add('word-content-with-image');
        wordContent.style.overflow = 'visible';
        wordContent.style.maxHeight = 'none';
        if (wordContent.style.height === '864px' || wordContent.style.height === '') {
          wordContent.style.height = 'auto';
          wordContent.style.minHeight = '864px';
        }
        pages[i] = tempDiv.innerHTML;
      }
    }
  }
}

// Word 내용을 실제 페이지 단위로 분할
async function splitWordIntoPages() {
  if (!wordPreviewHtml.value) {
    wordPages.value = [];
    return;
  }
  
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const wordContentElement = document.querySelector('.word-document-preview .word-content');
  if (!wordContentElement) {
    wordPages.value = [wordPreviewHtml.value];
    return;
  }
  
  const pageContentHeight = WORD_STYLES.PAGE.CONTENT_HEIGHT;
  const pages = [];
  const children = Array.from(wordContentElement.children);
  
  let currentPageContent = [];
  let currentPageHeight = 0;
  
  for (const child of children) {
    const isImageElement = containsImage(child);
    
    // 텍스트 요소의 높이를 더 정확하게 측정
    let childHeight;
    if (isImageElement) {
      childHeight = getImageElementHeight(child);
    } else {
      // 텍스트 요소의 실제 높이 측정
      // offsetHeight는 padding을 포함하지만 margin은 포함하지 않음
      const computedStyle = window.getComputedStyle(child);
      const marginTop = parseFloat(computedStyle.marginTop) || 0;
      const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
      // offsetHeight는 이미 padding을 포함하므로 padding은 추가하지 않음
      const elementHeight = child.offsetHeight || child.scrollHeight || 0;
      // margin만 추가 (offsetHeight에 padding은 이미 포함됨)
      childHeight = elementHeight + marginTop + marginBottom;
    }
    
    if (isImageElement) {
      // 큰 이미지 처리
      if (childHeight > pageContentHeight) {
        const result = handleLargeImage(child, pageContentHeight, currentPageContent, pages);
        currentPageContent = result.currentPageContent;
        currentPageHeight = result.currentPageHeight;
        continue;
      }
      
      // 일반 이미지 처리
      const result = placeImageElement(child, childHeight, pageContentHeight, currentPageContent, currentPageHeight, pages);
      currentPageContent = result.currentPageContent;
      currentPageHeight = result.currentPageHeight;
    } else {
      // 텍스트 요소 처리
      const result = placeTextElement(child, childHeight, pageContentHeight, currentPageContent, currentPageHeight, pages);
      currentPageContent = result.currentPageContent;
      currentPageHeight = result.currentPageHeight;
    }
  }
  
  // 마지막 페이지 추가
  if (currentPageContent.length > 0) {
    const hasImage = currentPageContent.some(el => containsImage(el));
    const pageDiv = createPageDiv(currentPageContent, hasImage);
    pages.push(pageDiv.outerHTML);
  }
  
  // 이미지가 포함된 페이지의 스타일 조정
  adjustImagePageStyles(pages);
  
  wordPages.value = pages.length > 0 ? pages : [wordPreviewHtml.value];
  totalPages.value = wordPages.value.length;
  
  // 페이지 분할 후 스타일 다시 적용
  await nextTick();
  setTimeout(() => {
    applyWordStyles();
  }, 200);
}

// 페이지 오버플로우 조정 함수 제거
// adjustPageOverflow 함수는 너무 공격적으로 페이지를 재분할하여
// 과도하게 많은 텍스트를 다음 페이지로 넘기는 문제가 있었습니다.
// 대신 placeTextElement에서 더 정확한 높이 측정을 사용합니다.

// ==================== API 호출 유틸리티 ====================

// API 에러 처리 헬퍼
async function handleApiResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// 보고서 데이터 정규화
function normalizeReportData(report) {
  return {
    id: report.id || report.report_id,
    title: report.title,
    description: report.description || '',
    content: report.content || report.report_content || '',
    createdAt: report.created_at || report.createdAt,
    wordCount: report.word_count || report.wordCount || 0,
    file_url: report.file_url
  };
}

// 보고서 목록 조회
async function fetchReportsList(userId, pageNum = 1) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports?user_id=${userId}&page=${pageNum}&page_size=10`);
    const data = await handleApiResponse(response);
    
    if (data.success && data.reports) {
      return {
        reports: data.reports.map(normalizeReportData),
        pages: data.pages || Math.max(1, Math.ceil(data.total / 10))
      };
    }
  } catch (error) {
    console.warn('보고서 API 로드 실패:', error);
    throw error;
  }
  return null;
}

// 보고서 상세 조회
async function fetchReportDetail(reportId, userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}?user_id=${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.report) {
        return normalizeReportData(data.report);
      }
    }
  } catch (error) {
    console.warn('보고서 상세 로드 실패:', error);
  }
  return null;
}

async function loadList() {
  const userId = localStorage.getItem("vss_user_id");
  
  // API에서 보고서 목록 로드 시도
  if (userId) {
    try {
      const result = await fetchReportsList(userId, page.value);
      if (result) {
        list.value = result.reports;
        pages.value = result.pages;
        return;
      }
    } catch (error) {
      console.warn('보고서 API 로드 실패, localStorage에서 로드:', error);
    }
  }
  
  // API 실패 시 localStorage에서 로드 (폴백)
  const reportsKey = `vss_reports_${userId || 'guest'}`;
  const storedReports = JSON.parse(localStorage.getItem(reportsKey) || '[]');
  
  // 페이지네이션 적용
  const itemsPerPage = 10;
  const startIndex = (page.value - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  list.value = storedReports.slice(startIndex, endIndex);
  pages.value = Math.max(1, Math.ceil(storedReports.length / itemsPerPage));
  
  // 보고서가 없으면 빈 배열
  if (storedReports.length === 0) {
    list.value = [];
    pages.value = 1;
  }
}
loadList();

async function open(r) {
  selectedReport.value = r;
  wordPreviewHtml.value = ""; // Word 미리보기 초기화
  wordPages.value = []; // 페이지 분할 초기화
  isWordPreviewReady.value = false; // 미리보기 준비 상태 초기화
  isEditing.value = false; // 편집 모드 초기화
  
  // 보고서 내용이 없으면 API에서 로드 시도
  if (!r.content || !r.file_url) {
    const userId = localStorage.getItem("vss_user_id");
    if (userId && r.id) {
      const reportDetail = await fetchReportDetail(r.id, userId);
      if (reportDetail) {
        r.content = reportDetail.content;
        r.wordCount = reportDetail.wordCount;
        r.file_url = reportDetail.file_url || r.file_url;
      }
    }
  }
  
  report.value = r.content || "";
  editingContent.value = r.content || "";
  currentPage.value = 1;
  
  // Word 파일이 있으면 Word 파일을 미리보기로 표시
  if (r.file_url) {
    await loadWordPreview(r.file_url);
  } else {
    // Word 파일이 없으면 마크다운 표시
    // 다음 틱까지 대기하여 DOM 업데이트 보장
    await nextTick();
    
    // 마크다운 표시 준비 완료 (즉시 표시 가능)
    isWordPreviewReady.value = true;
    
    // 마크다운 스타일 적용 (여러 번 호출하여 확실히 적용)
    await nextTick();
    setTimeout(() => {
      applyMarkdownStyles();
    }, 100);
    
    // 추가로 한 번 더 스타일 적용 (이미지 로드 등을 고려)
    setTimeout(() => {
      applyMarkdownStyles();
    }, 500);
    
    // 텍스트 내용을 페이지로 나누기
    const words = (r.content || '').split(/\s+/);
    totalPages.value = Math.max(1, Math.ceil(words.length / 500)); // 페이지당 500단어
  }
}

function toggleEditMode() {
  if (!selectedReport.value) return;
  
  isEditing.value = true;
  editingContent.value = selectedReport.value.content || report.value || "";
  
  // 편집 모드 진입 시 스타일 적용
  nextTick(() => {
    setTimeout(() => {
      applyMarkdownStyles('.markdown-editing-preview');
    }, 200);
  });
}

async function cancelEdit() {
  isEditing.value = false;
  editingContent.value = selectedReport.value?.content || report.value || "";
  
  // 편집 모드 종료 후 읽기 모드로 전환 시 마크다운 스타일 다시 적용
  await nextTick();
  if (!selectedReport.value?.file_url && report.value) {
    // Word 파일이 없으면 마크다운 스타일 적용
    setTimeout(() => {
      applyMarkdownStyles();
    }, 200);
    // 추가로 한 번 더 적용 (이미지 로드 등을 고려)
    setTimeout(() => {
      applyMarkdownStyles();
    }, 500);
  }
}

// 보고서 업데이트
async function updateReportAPI(reportId, userId, content) {
  const response = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: userId,
      content: content
    })
  });
  
  const data = await handleApiResponse(response);
  
  if (!data.success) {
    throw new Error(data.message || '보고서 수정 실패');
  }
  
  return data;
}

// 보고서 삭제
async function deleteReportAPI(reportId, userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}?user_id=${userId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return { success: true };
      }
    } else if (response.status === 404) {
      // 404는 이미 삭제된 것으로 간주
      return { success: true, alreadyDeleted: true };
    } else {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || response.statusText);
    }
  } catch (error) {
    // 네트워크 오류는 무시하고 localStorage에서 삭제 계속 진행
    console.warn('보고서 API 삭제 중 오류:', error);
    return { success: false, error };
  }
}

async function saveReport() {
  if (!selectedReport.value) return;
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  isSaving.value = true;
  
  try {
    const data = await updateReportAPI(selectedReport.value.id, userId, editingContent.value);
    
    // 로컬 상태 업데이트
    selectedReport.value.content = editingContent.value;
    // report.value를 강제로 업데이트하여 formattedReport가 다시 계산되도록 함
    // 임시로 값을 변경했다가 다시 설정하여 Vue의 반응성을 확실히 트리거
    report.value = '';
    await nextTick();
    report.value = editingContent.value;
    selectedReport.value.wordCount = editingContent.value.split(/\s+/).length;
    
    // Word 파일 URL 업데이트 (재생성된 경우)
    if (data.file_url) {
      selectedReport.value.file_url = data.file_url;
    }
    
    // Word 미리보기 초기화 (내용이 변경되었으므로)
    wordPreviewHtml.value = "";
    wordPages.value = [];
    isWordPreviewReady.value = false;
    
    // Word 파일이 있으면 다시 로드, 없으면 마크다운 표시
    if (data.file_url) {
      await loadWordPreview(data.file_url);
    } else {
      isWordPreviewReady.value = true; // Word 파일이 없으면 즉시 준비 완료
    }
    
    // 페이지 재계산
    const words = editingContent.value.split(/\s+/);
    totalPages.value = Math.max(1, Math.ceil(words.length / WORD_STYLES.PAGE.WORDS_PER_PAGE));
    currentPage.value = 1;
    
    isEditing.value = false;
    
    // 편집 모드 종료 후 읽기 모드로 전환 시 마크다운 스타일 다시 적용
    // DOM이 완전히 업데이트될 때까지 여러 번 nextTick을 기다림
    await nextTick();
    await nextTick(); // 추가 nextTick으로 DOM 업데이트 보장
    
    if (!data.file_url && report.value) {
      // Word 파일이 없으면 마크다운 스타일 적용
      // 즉시 한 번 적용
      applyMarkdownStyles();
      
      // DOM 업데이트 후 다시 적용
      setTimeout(() => {
        applyMarkdownStyles();
      }, 100);
      
      // 추가로 한 번 더 적용 (이미지 로드 등을 고려)
      setTimeout(() => {
        applyMarkdownStyles();
      }, 300);
      
      // 최종 확인 (더 긴 지연)
      setTimeout(() => {
        applyMarkdownStyles();
      }, 600);
    }
    
    alert(settingStore.language === 'ko' 
      ? '보고서가 성공적으로 수정되었습니다.' 
      : 'Report has been successfully updated.');
    
    // 목록 새로고침
    await loadList();
  } catch (error) {
    console.error('보고서 수정 중 오류:', error);
    alert(settingStore.language === 'ko' 
      ? `보고서 수정 중 오류가 발생했습니다: ${error.message}` 
      : `An error occurred while updating the report: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
}

// Word 파일을 HTML로 변환하여 미리보기
async function loadWordPreview(fileUrl) {
  if (!fileUrl) return;
  
  isLoadingWordPreview.value = true;
  isWordPreviewReady.value = false;
  wordPreviewHtml.value = "";
  wordPages.value = [];
  
  const loadStartTime = Date.now(); // 로딩 시작 시간 기록
  
  try {
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
    const response = await fetch(fullUrl);
    
    if (!response.ok) {
      throw new Error('Word 파일을 불러올 수 없습니다.');
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Word 스타일을 보존하는 styleMap 정의
    const styleMap = [
      // 제목 스타일 매핑
      "p[style-name='Title'] => h1.word-title:fresh",
      "p[style-name='Heading 1'] => h1.word-heading1:fresh",
      "p[style-name='Heading 2'] => h2.word-heading2:fresh",
      "p[style-name='Heading 3'] => h3.word-heading3:fresh",
      // 정렬 보존
      "p[style-name='Normal'] => p.word-paragraph:fresh",
      // 리스트 스타일
      "p[style-name='List Bullet'] => p.word-list-bullet:fresh",
      "p[style-name='List Number'] => p.word-list-number:fresh",
    ];
    
    // Word 문서를 HTML로 변환 (스타일 보존 옵션 포함)
    const result = await mammoth.convertToHtml(
      { arrayBuffer: arrayBuffer },
      { 
        styleMap: styleMap,
        includeDefaultStyleMap: true,
        convertImage: mammoth.images.imgElement(function(image) {
          return image.readAsBase64String().then(function(imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        })
      }
    );
    
    // HTML을 파싱하여 정렬 및 스타일 정보 추가
    // Vue의 nextTick을 사용하여 DOM이 준비된 후 처리
    await new Promise(resolve => setTimeout(resolve, 0));
    let processedHtml = processWordHtml(result.value);
    
    // Word 문서 스타일을 적용한 HTML 래퍼
    wordPreviewHtml.value = `<div class="word-content">${processedHtml}</div>`;
    
    // DOM이 업데이트된 후 추가 스타일 적용
    await new Promise(resolve => setTimeout(resolve, 100));
    applyWordStyles();
    
    // 페이지 수 계산 (실제 높이 기반)
    await nextTick();
    await calculateWordPages();
    
    // 페이지 분할 완료 대기
    await splitWordIntoPages();
    
    // 경고 메시지가 있으면 로그
    if (result.messages && result.messages.length > 0) {
      console.warn('Word 변환 경고:', result.messages);
    }
    
    // 최소 로딩 시간 보장 (1초) 또는 변환 완료 후 즉시 표시
    const loadElapsedTime = Date.now() - loadStartTime;
    const minLoadTime = 1000; // 최소 1초
    
    if (loadElapsedTime < minLoadTime) {
      await new Promise(resolve => setTimeout(resolve, minLoadTime - loadElapsedTime));
    }
    
    // 미리보기 준비 완료
    isWordPreviewReady.value = true;
  } catch (error) {
    console.error('Word 파일 미리보기 로드 실패:', error);
    wordPreviewHtml.value = `<div class="text-center py-8 text-red-500"><p>Word 파일을 불러올 수 없습니다: ${error.message}</p><p class="text-sm text-gray-500 mt-2">텍스트 내용을 표시합니다.</p></div>`;
    // Word 파일 로드 실패 시 텍스트 내용으로 폴백
    const words = (report.value || '').split(/\s+/);
    totalPages.value = Math.max(1, Math.ceil(words.length / WORD_STYLES.PAGE.WORDS_PER_PAGE));
    isWordPreviewReady.value = true;
  } finally {
    isLoadingWordPreview.value = false;
  }
}

// ==================== Word HTML 처리 유틸리티 ====================

// 이미지 크기 처리
function processWordImages(container) {
  container.querySelectorAll('img').forEach(img => {
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.style.maxWidth = WORD_STYLES.IMAGE.MAX_WIDTH;
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = WORD_STYLES.IMAGE.MARGIN;
  });
}

// 요소에 정렬 클래스 추가
function applyAlignmentClasses(element, style) {
  if (style.includes('text-align:center') || style.includes('text-align: center')) {
    element.classList.add('word-align-center');
  } else if (style.includes('text-align:right') || style.includes('text-align: right')) {
    element.classList.add('word-align-right');
  } else if (style.includes('text-align:left') || style.includes('text-align: left')) {
    element.classList.add('word-align-left');
  }
}

// 빈 단락이 구분선인지 확인
function isHorizontalLineCandidate(element, index, prevElement, nextElement) {
  if (element.tagName !== 'P') return false;
  
  const textContent = element.textContent.trim();
  const isEmpty = textContent === '' || textContent === '\u00A0' || textContent === '\u200B';
  const hasNoImage = !element.querySelector('img');
  
  if (!isEmpty || !hasNoImage || index === 0) return false;
  
  // 이전 요소가 제목이나 단락이고, 다음 요소도 제목이나 단락인 경우
  if (prevElement && nextElement) {
    const prevIsHeading = ['H1', 'P', 'H3'].includes(prevElement.tagName);
    const nextIsHeading = ['H1', 'P', 'H3'].includes(nextElement.tagName);
    if (prevIsHeading && nextIsHeading) return true;
  }
  
  // 작성자 정보 다음의 빈 단락
  if (prevElement && (prevElement.textContent.includes('작성자:') || prevElement.textContent.includes('Author:'))) {
    return true;
  }
  
  // 클립 사이의 빈 단락
  if (prevElement && prevElement.tagName === 'H1' && nextElement) {
    return true;
  }
  
  return false;
}

// 요소에 특수 클래스 추가 (제목, 작성자, 리스트 등)
function applySpecialClasses(element, textContent, isFirstH1) {
  if (element.tagName === 'H1' && isFirstH1) {
    element.classList.add('word-title', 'word-align-center', 'is-document-title');
    return false; // isFirstH1 업데이트
  }
  
  if (textContent.includes('작성자:') || textContent.includes('Author:')) {
    element.classList.add('word-align-right');
  }
  
  if ((element.tagName === 'H3' || textContent.includes('장면 설명:')) && textContent.includes('장면 설명:')) {
    element.classList.add('word-heading3');
  }
  
  // "시간:", "소스:"로 시작하는 단락은 리스트 스타일 적용하지 않음 (들여쓰기 방지)
  // if (textContent.startsWith('시간:') || textContent.startsWith('소스:') ||
  //     textContent.startsWith('Time:') || textContent.startsWith('Source:')) {
  //   element.classList.add('word-list-bullet');
  // }
  
  return isFirstH1;
}

// Word HTML을 후처리하여 정렬, 구분선 등 스타일 적용
function processWordHtml(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // 이미지 크기 처리
  processWordImages(tempDiv);
  
  // 모든 단락과 제목 요소 처리
  const elements = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
  let isFirstH1 = true;
  
  elements.forEach((element, index) => {
    const textContent = element.textContent.trim();
    const style = element.getAttribute('style') || '';
    
    // 특수 클래스 적용
    isFirstH1 = applySpecialClasses(element, textContent, isFirstH1);
    
    // 정렬 클래스 적용
    applyAlignmentClasses(element, style);
    
    // 구분선 감지
    if (style.includes('border-bottom') || style.includes('border:')) {
      element.classList.add('word-horizontal-line');
    }
    
    // 빈 단락 구분선 확인
    const prevElement = element.previousElementSibling;
    const nextElement = element.nextElementSibling;
    if (isHorizontalLineCandidate(element, index, prevElement, nextElement)) {
      element.classList.add('word-horizontal-line');
    }
  });
  
  // 추가: 구분선 스타일이 있는 요소에 클래스 추가
  tempDiv.querySelectorAll('*').forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (style.includes('border-bottom') && el.tagName === 'P') {
      el.classList.add('word-horizontal-line');
    }
  });
  
  // 모든 빈 단락을 다시 확인하여 구분선 추가
  tempDiv.querySelectorAll('p').forEach((p, idx) => {
    const text = p.textContent.trim();
    if ((text === '' || text === '\u00A0' || text === '\u200B') && 
        !p.querySelector('img') && 
        !p.classList.contains('word-horizontal-line') &&
        idx > 0 &&
        p.previousElementSibling && 
        p.nextElementSibling) {
      p.classList.add('word-horizontal-line');
    }
  });
  
  return tempDiv.innerHTML;
}

// 스타일 적용 유틸리티 함수들
function applyBaseTextStyle(element) {
  if (!element.style.fontFamily || element.style.fontFamily === '') {
    element.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  }
  if (!element.style.color || element.style.color === '') {
    element.style.color = WORD_STYLES.COLOR.TEXT;
  }
  if (['P', 'LI', 'TD', 'TH'].includes(element.tagName)) {
    if (!element.style.lineHeight || element.style.lineHeight === '') {
      element.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
    }
  }
}

function applyHeadingStyle(heading, level) {
  const styles = {
    1: { fontSize: WORD_STYLES.FONT_SIZE.HEADING1, margin: WORD_STYLES.SPACING.HEADING1_MARGIN },
    2: { fontSize: WORD_STYLES.FONT_SIZE.HEADING2, margin: WORD_STYLES.SPACING.HEADING2_MARGIN },
    3: { fontSize: WORD_STYLES.FONT_SIZE.HEADING3, margin: WORD_STYLES.SPACING.HEADING3_MARGIN }
  };
  
  const style = styles[level] || { fontSize: WORD_STYLES.FONT_SIZE.PARAGRAPH, margin: WORD_STYLES.SPACING.PARAGRAPH_MARGIN };
  
  heading.style.fontSize = style.fontSize;
  heading.style.fontWeight = 'bold';
  heading.style.color = WORD_STYLES.COLOR.TEXT;
  heading.style.margin = style.margin;
  heading.style.textAlign = 'left';
  heading.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  heading.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
}

function applyParagraphStyle(paragraph, text) {
  if (!paragraph.classList.contains('word-horizontal-line')) {
    paragraph.style.margin = WORD_STYLES.SPACING.PARAGRAPH_MARGIN;
    paragraph.style.textAlign = 'left';
    paragraph.style.color = WORD_STYLES.COLOR.TEXT;
    paragraph.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
    paragraph.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
    paragraph.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  }
  
  if (text.includes('작성자:') || text.includes('Author:')) {
    paragraph.classList.add('word-align-right');
    paragraph.style.textAlign = 'right';
    paragraph.style.color = WORD_STYLES.COLOR.TEXT;
  }
  
  // "시간:", "소스:"로 시작하는 단락은 리스트 스타일 적용하지 않음 (들여쓰기 방지)
  // if (text.startsWith('시간:') || text.startsWith('소스:') || 
  //     text.startsWith('Time:') || text.startsWith('Source:')) {
  //   paragraph.classList.add('word-list-bullet');
  //   paragraph.style.paddingLeft = WORD_STYLES.LIST.PADDING_LEFT;
  //   paragraph.style.textIndent = WORD_STYLES.LIST.TEXT_INDENT;
  //   paragraph.style.color = WORD_STYLES.COLOR.TEXT;
  //   paragraph.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
  //   paragraph.style.margin = WORD_STYLES.SPACING.PARAGRAPH_MARGIN;
  //   paragraph.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  //   paragraph.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
  // }
}

function applyImageStyle(img) {
  img.removeAttribute('width');
  img.removeAttribute('height');
  img.style.maxWidth = WORD_STYLES.IMAGE.MAX_WIDTH;
  img.style.width = 'auto';
  img.style.height = 'auto';
  img.style.display = 'block';
  img.style.margin = WORD_STYLES.IMAGE.MARGIN;
  img.style.textAlign = 'center';
  img.setAttribute('style', img.style.cssText);
}

function applyHorizontalLineStyle(element) {
  element.style.border = 'none';
  element.style.borderBottom = '1px solid #000000';
  element.style.margin = WORD_STYLES.SPACING.HORIZONTAL_LINE_MARGIN;
  element.style.padding = '0';
  element.style.width = '100%';
  element.style.height = '0';
  element.style.minHeight = '0';
  element.style.background = 'none';
  element.style.display = 'block';
  element.innerHTML = '';
}

// ==================== Word 스타일 적용 유틸리티 ====================

// 제목 스타일 적용
function applyHeadingStyles(wordContent) {
  // h1 요소 처리
  wordContent.querySelectorAll('h1').forEach(h1 => {
    if (h1.classList.contains('is-document-title')) {
      h1.classList.add('word-title', 'word-align-center');
      h1.style.textAlign = 'center';
      h1.style.fontSize = WORD_STYLES.FONT_SIZE.TITLE;
      h1.style.fontWeight = 'bold';
      h1.style.color = WORD_STYLES.COLOR.TEXT;
      h1.style.margin = WORD_STYLES.SPACING.TITLE_MARGIN;
      h1.style.fontFamily = WORD_STYLES.FONT_FAMILY;
      h1.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
    } else {
      h1.classList.add('word-heading1');
      h1.classList.remove('word-title', 'word-align-center');
      applyHeadingStyle(h1, 1);
    }
  });
  
  // h2, h3 스타일 적용
  wordContent.querySelectorAll('h2').forEach(h2 => applyHeadingStyle(h2, 2));
  wordContent.querySelectorAll('h3').forEach(h3 => {
    h3.classList.add('word-heading3');
    applyHeadingStyle(h3, 3);
  });
  
  // h4, h5, h6 스타일 적용
  wordContent.querySelectorAll('h4, h5, h6').forEach(heading => {
    heading.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
    heading.style.fontWeight = 'bold';
    heading.style.color = WORD_STYLES.COLOR.TEXT;
    heading.style.margin = '6pt 0 3pt 0';
    heading.style.textAlign = 'left';
    heading.style.fontFamily = WORD_STYLES.FONT_FAMILY;
    heading.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
  });
}

// 리스트 스타일 적용
function applyListStyles(wordContent) {
  wordContent.querySelectorAll('ul, ol').forEach(list => {
    list.style.margin = WORD_STYLES.SPACING.LIST_MARGIN;
    list.style.paddingLeft = WORD_STYLES.LIST.PADDING_LEFT;
    list.style.color = WORD_STYLES.COLOR.TEXT;
    list.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  });
  
  wordContent.querySelectorAll('ul li, ol li').forEach(li => {
    li.style.color = WORD_STYLES.COLOR.TEXT;
    li.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
    li.style.margin = WORD_STYLES.SPACING.LIST_ITEM_MARGIN;
    li.style.fontFamily = WORD_STYLES.FONT_FAMILY;
    li.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
  });
}

// 테이블 스타일 적용
function applyTableStyles(wordContent) {
  wordContent.querySelectorAll('table').forEach(table => {
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.margin = WORD_STYLES.SPACING.LIST_MARGIN;
    table.style.fontFamily = WORD_STYLES.FONT_FAMILY;
  });
  
  wordContent.querySelectorAll('table td, table th').forEach(cell => {
    cell.style.border = '0.75pt solid #000000';
    cell.style.padding = '3pt';
    cell.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
    cell.style.color = WORD_STYLES.COLOR.TEXT;
    cell.style.fontFamily = WORD_STYLES.FONT_FAMILY;
    cell.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
  });
  
  wordContent.querySelectorAll('table th').forEach(th => {
    th.style.fontWeight = 'bold';
    th.style.backgroundColor = WORD_STYLES.COLOR.BACKGROUND_LIGHT;
  });
}

// 빈 단락 구분선 처리
function applyEmptyParagraphLines(wordContent) {
  wordContent.querySelectorAll('p').forEach((p, index) => {
    const text = p.textContent.trim();
    if ((text === '' || text === '\u00A0' || text === '\u200B') && 
        !p.querySelector('img') && 
        !p.classList.contains('word-horizontal-line')) {
      const prevSibling = p.previousElementSibling;
      const nextSibling = p.nextElementSibling;
      
      if ((prevSibling && nextSibling && index > 0) ||
          (prevSibling && (prevSibling.textContent.includes('작성자:') || prevSibling.textContent.includes('Author:'))) ||
          (prevSibling && prevSibling.tagName === 'H1' && nextSibling)) {
        p.classList.add('word-horizontal-line');
        applyHorizontalLineStyle(p);
      }
    }
  });
}

// DOM이 업데이트된 후 Word 스타일을 추가로 적용
function applyWordStyles() {
  setTimeout(() => {
    const wordContentElements = document.querySelectorAll('.word-document-preview .word-content');
    
    wordContentElements.forEach(wordContent => {
      if (!wordContent) return;
      
      // 모든 텍스트 요소에 기본 스타일 적용
      const allTextElements = wordContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div, a, strong, b, em, i');
      allTextElements.forEach(applyBaseTextStyle);
      
      // 제목 스타일 적용
      applyHeadingStyles(wordContent);
      
      // 단락 스타일 적용
      wordContent.querySelectorAll('p').forEach(p => {
        applyParagraphStyle(p, p.textContent.trim());
      });
      
      // 리스트 스타일 적용
      applyListStyles(wordContent);
      
      // 강조 텍스트 스타일
      wordContent.querySelectorAll('strong, b').forEach(el => {
        el.style.fontWeight = 'bold';
        el.style.color = WORD_STYLES.COLOR.TEXT;
        applyBaseTextStyle(el);
      });
      
      wordContent.querySelectorAll('em, i').forEach(el => {
        el.style.fontStyle = 'italic';
        el.style.color = WORD_STYLES.COLOR.TEXT;
        applyBaseTextStyle(el);
      });
      
      // 링크 스타일
      wordContent.querySelectorAll('a').forEach(a => {
        a.style.color = WORD_STYLES.COLOR.LINK;
        a.style.textDecoration = 'underline';
        applyBaseTextStyle(a);
      });
      
      // 구분선 스타일
      wordContent.querySelectorAll('.word-horizontal-line, p.word-horizontal-line').forEach(applyHorizontalLineStyle);
      
      // 빈 단락 중 구분선 처리
      applyEmptyParagraphLines(wordContent);
      
      // 이미지 스타일
      wordContent.querySelectorAll('img').forEach(applyImageStyle);
      
      // 테이블 스타일 적용
      applyTableStyles(wordContent);
    });
  }, 300);
}

// 마크다운 미리보기에 Word 문서와 동일한 스타일 적용 (공통 함수)
function applyMarkdownStyles(containerSelector = '.markdown-preview') {
  setTimeout(() => {
    const markdownPreview = document.querySelector(containerSelector);
    if (!markdownPreview) return;
    
    // 편집 모드인지 확인 (이미지 크기 조정)
    const isEditingMode = containerSelector === '.markdown-editing-preview';
    
    // 첫 번째 h1은 제목 (중앙 정렬)
    const h1Elements = markdownPreview.querySelectorAll('h1');
    if (h1Elements.length > 0) {
      const firstH1 = h1Elements[0];
      firstH1.style.textAlign = 'center';
      firstH1.style.fontSize = '28pt';
      firstH1.style.fontWeight = 'bold';
      firstH1.style.color = '#000000';
      firstH1.style.margin = '12pt 0';
      firstH1.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    }
    
    // 나머지 h1은 Heading 1 (클립 제목)
    Array.from(h1Elements).slice(1).forEach(h1 => {
      h1.style.fontSize = '16pt';
      h1.style.fontWeight = 'bold';
      h1.style.color = '#000000';
      h1.style.margin = '12pt 0 6pt 0';
      h1.style.textAlign = 'left';
      h1.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    // h2 스타일
    markdownPreview.querySelectorAll('h2').forEach(h2 => {
      h2.style.fontSize = '13pt';
      h2.style.fontWeight = 'bold';
      h2.style.margin = '10pt 0 4pt 0';
      h2.style.color = '#000000';
      h2.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    // h3 스타일
    markdownPreview.querySelectorAll('h3').forEach(h3 => {
      h3.style.fontSize = '11pt';
      h3.style.fontWeight = 'bold';
      h3.style.margin = '8pt 0 4pt 0';
      h3.style.color = '#000000';
      h3.style.textAlign = 'left';
      h3.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    // 단락 스타일
    markdownPreview.querySelectorAll('p').forEach(p => {
      const text = p.textContent.trim();
      
      // 작성자 정보는 오른쪽 정렬
      if (text.includes('작성자:') || text.includes('Author:')) {
        p.style.textAlign = 'right';
        p.classList.add('word-align-right');
      }
      
      // "시간:", "소스:"로 시작하는 단락은 들여쓰기 제거
      if (text.startsWith('시간:') || text.startsWith('소스:') ||
          text.startsWith('Time:') || text.startsWith('Source:')) {
        p.style.paddingLeft = '0';
        p.style.textIndent = '0';
        p.style.marginLeft = '0';
      }
      
      // 기본 단락 스타일
      p.style.margin = '0 0 6pt 0';
      p.style.textAlign = 'left';
      p.style.color = '#000000';
      p.style.fontSize = '11pt';
      p.style.lineHeight = '1.15';
      p.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    // 리스트 스타일
    markdownPreview.querySelectorAll('ul, ol').forEach(list => {
      // "시간:", "소스:"로 시작하는 항목이 있는 리스트는 들여쓰기 제거
      const hasTimeSourceItem = Array.from(list.querySelectorAll('li')).some(li => {
        const text = li.textContent.trim();
        return text.startsWith('시간:') || text.startsWith('소스:') ||
               text.startsWith('Time:') || text.startsWith('Source:');
      });
      
      if (hasTimeSourceItem) {
        list.classList.add('no-indent');
        list.style.paddingLeft = '0';
        list.style.marginLeft = '0';
      } else {
        list.style.paddingLeft = '36pt';
      }
      
      list.style.margin = '6pt 0';
      list.style.color = '#000000';
    });
    
    markdownPreview.querySelectorAll('li').forEach(li => {
      const text = li.textContent.trim();
      
      // "시간:", "소스:"로 시작하는 리스트 항목은 들여쓰기 제거
      if (text.startsWith('시간:') || text.startsWith('소스:') ||
          text.startsWith('Time:') || text.startsWith('Source:')) {
        li.classList.add('no-indent');
        li.style.paddingLeft = '0';
        li.style.marginLeft = '0';
        li.style.textIndent = '0';
        li.style.listStyleType = 'none';
      }
      
      li.style.margin = '3pt 0';
      li.style.color = '#000000';
      li.style.fontSize = '11pt';
      li.style.lineHeight = '1.15';
      li.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    // 이미지 스타일
    markdownPreview.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = isEditingMode ? '400px' : '6in';
      img.style.width = 'auto';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = isEditingMode ? '6pt 0' : '6pt auto';
    });
    
    // 강조 텍스트
    markdownPreview.querySelectorAll('strong, b').forEach(el => {
      el.style.fontWeight = 'bold';
      el.style.color = '#000000';
    });
    
    markdownPreview.querySelectorAll('em, i').forEach(el => {
      el.style.fontStyle = 'italic';
      el.style.color = '#000000';
    });
    
    // 링크 스타일
    markdownPreview.querySelectorAll('a').forEach(a => {
      a.style.color = '#0000EE';
      a.style.textDecoration = 'underline';
    });
    
    // 구분선 스타일
    markdownPreview.querySelectorAll('hr').forEach(hr => {
      hr.style.border = 'none';
      hr.style.borderBottom = '1px solid #000000';
      hr.style.margin = '12pt 0';
      hr.style.padding = '0';
      hr.style.width = '100%';
      hr.style.height = '0';
    });
    
    // 코드 블록 스타일
    markdownPreview.querySelectorAll('code').forEach(code => {
      if (code.parentElement?.tagName !== 'PRE') {
        code.style.backgroundColor = '#f0f0f0';
        code.style.padding = '2pt 4pt';
        code.style.borderRadius = '3pt';
        code.style.fontFamily = "'Courier New', monospace";
        code.style.fontSize = '10pt';
        code.style.color = '#000000';
      }
    });
    
    markdownPreview.querySelectorAll('pre').forEach(pre => {
      pre.style.backgroundColor = '#f0f0f0';
      pre.style.padding = '12pt';
      pre.style.borderRadius = '3pt';
      pre.style.overflowX = 'auto';
      pre.style.margin = '6pt 0';
    });
    
    // 테이블 스타일
    markdownPreview.querySelectorAll('table').forEach(table => {
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.margin = '6pt 0';
    });
    
    markdownPreview.querySelectorAll('table td, table th').forEach(cell => {
      cell.style.border = '0.75pt solid #000000';
      cell.style.padding = '3pt';
      cell.style.fontSize = '11pt';
      cell.style.color = '#000000';
      cell.style.fontFamily = "'Calibri', 'Arial', 'Malgun Gothic', sans-serif";
    });
    
    markdownPreview.querySelectorAll('table th').forEach(th => {
      th.style.fontWeight = 'bold';
      th.style.backgroundColor = '#f0f0f0';
    });
  }, 100);
}

// Word 내용의 페이지 수 계산
async function calculateWordPages() {
  if (!wordPreviewHtml.value) {
    totalPages.value = 1;
    return;
  }
  
  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const wordContentElement = document.querySelector('.word-document-preview .word-content');
  const pageContentHeight = WORD_STYLES.PAGE.CONTENT_HEIGHT;
  
  if (!wordContentElement) {
    // 임시 요소 생성
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = wordPreviewHtml.value;
    tempDiv.className = 'word-content';
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.width = `${WORD_STYLES.PAGE.A4_WIDTH - (WORD_STYLES.PAGE.MARGIN * 2)}px`;
    tempDiv.style.top = '0';
    tempDiv.style.left = '0';
    tempDiv.style.fontFamily = WORD_STYLES.FONT_FAMILY;
    tempDiv.style.fontSize = WORD_STYLES.FONT_SIZE.PARAGRAPH;
    tempDiv.style.lineHeight = WORD_STYLES.LINE_HEIGHT;
    document.body.appendChild(tempDiv);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const contentHeight = tempDiv.offsetHeight || tempDiv.scrollHeight;
    totalPages.value = Math.max(1, Math.ceil(contentHeight / pageContentHeight));
    
    document.body.removeChild(tempDiv);
  } else {
    await new Promise(resolve => setTimeout(resolve, 200));
    const contentHeight = wordContentElement.offsetHeight || wordContentElement.scrollHeight;
    totalPages.value = Math.max(1, Math.ceil(contentHeight / pageContentHeight));
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
    scrollToPage();
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    scrollToPage();
  }
}

function scrollToPage() {
  // Word 문서 미리보기 컨테이너 찾기
  const container = document.querySelector('.word-document-preview-container');
  if (container) {
    // 현재 페이지 위치로 스크롤
    const pageHeight = 1056; // A4 높이
    const pageIndex = currentPage.value - 1;
    const scrollPosition = pageIndex * pageHeight;
    container.scrollTo({ top: scrollPosition, behavior: 'smooth' });
  } else {
    // 폴백: 일반 스크롤
    const viewer = document.querySelector('.overflow-auto');
    if (viewer) {
      viewer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

// 파일 다운로드 유틸리티 함수
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportFile() {
  if (!selectedReport.value) return;
  
  // Word 파일이 있으면 Word 파일을 다운로드
  if (selectedReport.value.file_url) {
    try {
      const fullUrl = selectedReport.value.file_url.startsWith('http') 
        ? selectedReport.value.file_url 
        : `${API_BASE_URL}${selectedReport.value.file_url}`;
      
      const response = await fetch(fullUrl);
      if (response.ok) {
        const blob = await response.blob();
        const filename = `${selectedReport.value.title || 'report'}.docx`;
        downloadFile(blob, filename);
        return;
      } else {
        console.warn('Word 파일 다운로드 실패:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Word 파일 다운로드 중 오류:', error);
    }
  }
  
  // Word 파일이 없거나 다운로드 실패 시 텍스트 파일로 내보내기
  const content = selectedReport.value.content || report.value;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const filename = `${selectedReport.value.title || 'report'}.txt`;
  downloadFile(blob, filename);
}

function handlePageChange(newPage) {
  if (newPage >= 1 && newPage <= pages.value) {
    page.value = newPage;
    loadList();
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const locale = settingStore.language === 'ko' ? 'ko-KR' : 'en-US';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ==================== 컨텍스트 메뉴 ====================
function openContextMenu(report, event) {
  event.stopPropagation();
  
  // 메뉴 위치 계산 (화면 경계 고려)
  const x = Math.min(event.clientX, window.innerWidth - 180);
  const y = Math.min(event.clientY, window.innerHeight - 100);
  
  contextMenu.value = {
    visible: true,
    x: x,
    y: y,
    report: report
  };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.report = null;
}

function handleDeleteReport() {
  if (!contextMenu.value.report) return;
  
  reportToDelete.value = contextMenu.value.report;
  closeContextMenu();
  showDeleteConfirm.value = true;
}


async function confirmDeleteReport() {
  if (!reportToDelete.value) return;
  
  const reportId = reportToDelete.value.id;
  const userId = localStorage.getItem("vss_user_id");
  
  try {
    // API에서 삭제 시도
    if (userId && reportId) {
      await deleteReportAPI(reportId, userId);
    }
    
    // localStorage에서 삭제
    const reportsKey = `vss_reports_${userId || 'guest'}`;
    const storedReports = JSON.parse(localStorage.getItem(reportsKey) || '[]');
    const updatedReports = storedReports.filter(r => r.id !== reportId);
    localStorage.setItem(reportsKey, JSON.stringify(updatedReports));
    
    // 현재 선택된 보고서가 삭제된 경우 선택 해제
    if (selectedReport.value && selectedReport.value.id === reportId) {
      selectedReport.value = null;
      report.value = "";
      wordPreviewHtml.value = "";
      wordPages.value = [];
      isWordPreviewReady.value = false;
    }
    
    // 목록 새로고침
    await loadList();
    
    showDeleteConfirm.value = false;
    reportToDelete.value = null;
  } catch (error) {
    console.error('보고서 삭제 중 오류:', error);
    alert(settingStore.language === 'ko' 
      ? `보고서 삭제 중 오류가 발생했습니다: ${error.message}` 
      : `An error occurred while deleting the report: ${error.message}`);
  }
}

// 전역 클릭 이벤트로 컨텍스트 메뉴 닫기
function handleGlobalClick(e) {
  if (!contextMenu.value.visible) return;
  closeContextMenu();
}

// 컴포넌트 마운트 시 전역 클릭 리스너 추가
onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
  
  // 타이머 정리
  if (wordPreviewTimeout.value) {
    clearTimeout(wordPreviewTimeout.value);
  }
  if (markdownStyleTimeout.value) {
    clearTimeout(markdownStyleTimeout.value);
  }
  if (editingStyleTimeout.value) {
    clearTimeout(editingStyleTimeout.value);
  }
});
</script>

<style scoped>
/* Word 문서 미리보기 스타일 */
.word-document-preview {
  width: 100%;
  max-width: 816px; /* A4 너비 (8.5인치 * 96 DPI) */
  height: 1056px; /* A4 높이 (11인치 * 96 DPI) - 고정 높이 */
  padding: 96px; /* 1인치 여백 (96px) */
  margin: 20px auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  color: #000;
  text-align: left;
  overflow: visible; /* 이미지가 잘리지 않도록 visible로 변경 */
  position: relative;
  page-break-after: always; /* 인쇄 시 페이지 나누기 */
  break-after: page;
}

/* 이미지가 포함된 페이지는 높이 제한 완화 */
.word-document-preview:has(.word-content img) {
  overflow: visible !important;
  height: auto !important;
  min-height: 1056px;
}

/* Word 콘텐츠 컨테이너 */
.word-content {
  width: 100%;
  position: relative;
  /* 높이와 overflow는 동적으로 설정됨 (페이지 분할 로직에서) */
}

/* 이미지가 포함된 페이지는 overflow를 visible로 설정 (강제) */
.word-content:has(img),
.word-content-with-image,
.word-content img {
  overflow: visible !important;
}

/* 이미지가 포함된 word-content는 높이 제한 완화 */
.word-content:has(img),
.word-content-with-image {
  max-height: none !important;
  overflow: visible !important;
  height: auto !important;
  min-height: 864px;
}

/* 다크 모드에서도 Word 문서는 흰색 배경 유지 */
.dark .word-document-preview {
  background-color: #ffffff;
  color: #000000;
}

/* Markdown 미리보기 스타일 (prose 스타일 적용) */
.markdown-preview {
  width: 100%;
  max-width: 816px; /* A4 너비 (8.5인치 * 96 DPI) */
  min-height: 1056px; /* A4 높이 (11인치 * 96 DPI) - 최소 높이 */
  padding: 96px; /* 1인치 여백 (96px) */
  margin: 20px auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: visible;
  position: relative;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  color: #000000;
}

/* 다크 모드에서도 Markdown 미리보기는 흰색 배경 유지 */
.dark .markdown-preview {
  background-color: #ffffff;
  color: #000000;
}

/* 편집 모드 마크다운 미리보기 스타일 */
.markdown-editing-preview {
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  color: #000000;
}

.markdown-editing-preview :deep(h1) {
  font-size: 28pt !important;
  font-weight: bold !important;
  text-align: center !important;
  margin: 12pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-editing-preview :deep(h1:not(:first-of-type)) {
  font-size: 16pt !important;
  font-weight: bold !important;
  text-align: left !important;
  margin: 12pt 0 6pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-editing-preview :deep(h2) {
  font-size: 13pt !important;
  font-weight: bold !important;
  margin: 10pt 0 4pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-editing-preview :deep(h3) {
  font-size: 11pt !important;
  font-weight: bold !important;
  margin: 8pt 0 4pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-editing-preview :deep(p) {
  margin: 0 0 6pt 0 !important;
  color: #000000 !important;
  font-size: 11pt !important;
  line-height: 1.15 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-editing-preview :deep(img) {
  max-width: 400px !important;
  height: auto !important;
  margin: 6pt 0 !important;
  display: block !important;
}

/* Markdown 미리보기 내부 요소 스타일 - Word 문서와 일치 */
.markdown-preview :deep(h1) {
  font-size: 28pt !important;
  font-weight: bold !important;
  text-align: center !important;
  margin: 12pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

/* 첫 번째 h1 이후의 h1은 Heading 1 스타일 */
.markdown-preview :deep(h1:not(:first-of-type)) {
  font-size: 16pt !important;
  font-weight: bold !important;
  text-align: left !important;
  margin: 12pt 0 6pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-preview :deep(h2) {
  font-size: 13pt !important;
  font-weight: bold !important;
  margin: 10pt 0 4pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-preview :deep(h3) {
  font-size: 11pt !important;
  font-weight: bold !important;
  margin: 8pt 0 4pt 0 !important;
  color: #000000 !important;
  text-align: left !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  font-weight: bold !important;
  margin: 6pt 0 3pt 0 !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-preview :deep(p) {
  margin: 0 0 6pt 0 !important;
  text-align: left !important;
  color: #000000 !important;
  font-size: 11pt !important;
  line-height: 1.15 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

/* 작성자 정보 오른쪽 정렬 - JavaScript로 처리됨 */
.markdown-preview :deep(p.word-align-right) {
  text-align: right !important;
}

/* 리스트 스타일 */
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 6pt 0 !important;
  padding-left: 36pt !important;
  color: #000000 !important;
}

.markdown-preview :deep(li) {
  margin: 3pt 0 !important;
  color: #000000 !important;
  font-size: 11pt !important;
  line-height: 1.15 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

/* "시간:", "소스:"로 시작하는 리스트 항목은 들여쓰기 제거 (JavaScript로 클래스 추가) */
.markdown-preview :deep(li.no-indent),
.markdown-preview :deep(ul.no-indent) {
  padding-left: 0 !important;
  margin-left: 0 !important;
  text-indent: 0 !important;
  list-style-type: none !important;
}

/* 강조 텍스트 */
.markdown-preview :deep(strong),
.markdown-preview :deep(b) {
  font-weight: bold !important;
  color: #000000 !important;
}

.markdown-preview :deep(em),
.markdown-preview :deep(i) {
  font-style: italic !important;
  color: #000000 !important;
}

/* 이미지 스타일 */
.markdown-preview :deep(img) {
  max-width: 6in !important;
  width: auto !important;
  height: auto !important;
  margin: 6pt auto !important;
  display: block !important;
}

/* 링크 스타일 */
.markdown-preview :deep(a) {
  color: #0000EE !important;
  text-decoration: underline !important;
}

.markdown-preview :deep(a:hover) {
  color: #0000CC !important;
}

/* 구분선 스타일 */
.markdown-preview :deep(hr) {
  border: none !important;
  border-bottom: 1px solid #000000 !important;
  margin: 12pt 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 0 !important;
}

/* 인용문 스타일 */
.markdown-preview :deep(blockquote) {
  margin: 6pt 0 !important;
  padding-left: 18pt !important;
  border-left: 3pt solid #000000 !important;
  color: #000000 !important;
  font-size: 11pt !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

/* 코드 스타일 */
.markdown-preview :deep(code) {
  background-color: #f0f0f0 !important;
  padding: 2pt 4pt !important;
  border-radius: 3pt !important;
  font-family: 'Courier New', monospace !important;
  font-size: 10pt !important;
  color: #000000 !important;
}

.markdown-preview :deep(pre) {
  background-color: #f0f0f0 !important;
  padding: 12pt !important;
  border-radius: 3pt !important;
  overflow-x: auto !important;
  margin: 6pt 0 !important;
}

.markdown-preview :deep(pre code) {
  background-color: transparent !important;
  padding: 0 !important;
}

/* 테이블 스타일 */
.markdown-preview :deep(table) {
  border-collapse: collapse !important;
  width: 100% !important;
  margin: 6pt 0 !important;
}

.markdown-preview :deep(table td),
.markdown-preview :deep(table th) {
  border: 0.75pt solid #000000 !important;
  padding: 3pt !important;
  font-size: 11pt !important;
  color: #000000 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
}

.markdown-preview :deep(table th) {
  font-weight: bold !important;
  background-color: #f0f0f0 !important;
}

/* Word 콘텐츠 스타일 */
.word-content {
  width: 100%;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  font-size: 11pt;
  line-height: 1.15;
  color: #000;
}

/* Word 문서 미리보기 내부 모든 요소에 기본 스타일 적용 */
.word-document-preview :deep(*) {
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  color: #000000;
}

.word-document-preview :deep(p) {
  margin: 0 0 6pt 0;
  text-align: left;
  color: #000000;
  font-size: 11pt;
  line-height: 1.15;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(h1) {
  font-size: 16pt;
  font-weight: bold;
  margin: 12pt 0 6pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(h1.is-document-title),
.word-document-preview :deep(h1.word-title.is-document-title) {
  font-size: 28pt;
  font-weight: bold;
  text-align: center;
  margin: 12pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(h2) {
  font-size: 13pt;
  font-weight: bold;
  margin: 10pt 0 4pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(h3) {
  font-size: 11pt;
  font-weight: bold;
  margin: 8pt 0 4pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(h4),
.word-document-preview :deep(h5),
.word-document-preview :deep(h6) {
  font-size: 11pt;
  font-weight: bold;
  margin: 6pt 0 3pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(ul),
.word-document-preview :deep(ol) {
  margin: 6pt 0;
  padding-left: 36pt;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(li) {
  margin: 3pt 0;
  color: #000000;
  font-size: 11pt;
  line-height: 1.15;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(strong),
.word-document-preview :deep(b) {
  font-weight: bold;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(em),
.word-document-preview :deep(i) {
  font-style: italic;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(a) {
  color: #0000EE;
  text-decoration: underline;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 6pt 0;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-document-preview :deep(table td),
.word-document-preview :deep(table th) {
  border: 0.75pt solid #000000;
  padding: 3pt;
  font-size: 11pt;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
  line-height: 1.15;
}

.word-document-preview :deep(table th) {
  font-weight: bold;
  background-color: #f0f0f0;
}

/* 제목 스타일 - Word의 add_heading(title, 0) - 중앙 정렬 */
.word-content h1.word-title,
.word-content h1:first-of-type {
  font-size: 28pt;
  font-weight: bold;
  text-align: center !important;
  margin: 12pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

/* Heading 1 - 클립 제목 (doc.add_heading(..., level=1)) */
.word-content h1.word-heading1,
.word-content h1:not(.word-title):not(:first-of-type) {
  font-size: 16pt;
  font-weight: bold;
  margin: 12pt 0 6pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content h2.word-heading2 {
  font-size: 13pt;
  font-weight: bold;
  margin: 10pt 0 4pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

/* Heading 3 - 장면 설명 (sentence_para.style = 'Heading 3') */
.word-content h3.word-heading3,
.word-content h3 {
  font-size: 11pt;
  font-weight: bold;
  margin: 8pt 0 4pt 0;
  color: #000000;
  text-align: left;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

/* 단락 스타일 - Normal 스타일 */
.word-content p.word-paragraph,
.word-content p:not(.word-list-bullet):not(.word-list-number):not(.word-horizontal-line) {
  margin: 0 0 6pt 0;
  text-align: left;
  color: #000000;
  font-size: 11pt;
  line-height: 1.15;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

/* 리스트 스타일 - List Bullet (시간, 소스 정보) */
.word-content p.word-list-bullet,
.word-content p[style-name='List Bullet'] {
  margin: 0 0 6pt 0 !important;
  padding-left: 36pt !important;
  text-indent: -18pt !important;
  color: #000000 !important;
  font-size: 11pt !important;
  line-height: 1.15 !important;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif !important;
  position: relative;
}

.word-content p.word-list-bullet::before {
  content: "• " !important;
  margin-right: 6pt;
  font-weight: normal;
  display: inline-block;
  width: 18pt;
  text-align: left;
}

/* ul/li 리스트도 Word 스타일로 */
.word-content ul {
  list-style-type: disc;
  margin: 6pt 0;
  padding-left: 36pt;
  color: #000000;
}

.word-content ul li {
  margin: 3pt 0;
  color: #000000;
  font-size: 11pt;
  line-height: 1.15;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content p.word-list-number {
  margin: 0 0 6pt 0;
  padding-left: 36pt;
  text-indent: -18pt;
  color: #000000;
  font-size: 11pt;
  line-height: 1.15;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

/* 이미지 스타일 - 가운데 정렬, 더 큰 크기 */
.word-content img {
  max-width: 8in !important;
  width: 800px !important;
  height: auto !important;
  margin: 6pt auto !important;
  display: block !important;
  text-align: center !important;
}

/* 정렬 스타일 - 클래스 기반 */
.word-content .word-align-center,
.word-content p.word-align-center,
.word-content h1.word-align-center {
  text-align: center !important;
}

.word-content .word-align-right,
.word-content p.word-align-right {
  text-align: right !important;
}

.word-content .word-align-left,
.word-content p.word-align-left {
  text-align: left !important;
}

/* 인라인 스타일 정렬도 지원 */
.word-content p[style*="text-align: center"],
.word-content h1[style*="text-align: center"],
.word-content h2[style*="text-align: center"],
.word-content h3[style*="text-align: center"] {
  text-align: center !important;
}

.word-content p[style*="text-align: right"],
.word-content h1[style*="text-align: right"],
.word-content h2[style*="text-align: right"],
.word-content h3[style*="text-align: right"] {
  text-align: right !important;
}

.word-content p[style*="text-align: left"],
.word-content h1[style*="text-align: left"],
.word-content h2[style*="text-align: left"],
.word-content h3[style*="text-align: left"] {
  text-align: left !important;
}

/* 구분선 스타일 - Word의 add_horizontal_line() (하단 테두리) */
.word-content .word-horizontal-line,
.word-content p.word-horizontal-line,
.word-content hr,
.word-content p[style*="border-bottom"] {
  border: none !important;
  border-bottom: 1px solid #000000 !important;
  margin: 12pt 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 0 !important;
  min-height: 0 !important;
  background: none !important;
  text-indent: 0 !important;
  display: block !important;
  overflow: hidden !important;
}

/* 빈 단락이면서 구분선일 수 있는 경우 */
.word-content p:empty.word-horizontal-line,
.word-content p.word-horizontal-line:empty,
.word-content p:has(br:only-child).word-horizontal-line {
  border: none !important;
  border-bottom: 1px solid #000000 !important;
  margin: 12pt 0 !important;
  padding: 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  display: block !important;
  overflow: hidden !important;
}

/* 빈 단락 중 구분선 후보 */
.word-content p:empty:not(:has(img)):not(:has(br)) {
  border-bottom: 1px solid #000000;
  margin: 12pt 0;
  padding: 0;
  height: 0;
  min-height: 0;
  display: block;
  overflow: hidden;
}

/* 기본 HTML 요소 스타일 (mammoth.js가 생성한 요소들) - Word 기본값과 일치 */
.word-content p:not(.word-title):not(.word-heading1):not(.word-heading2):not(.word-heading3):not(.word-list-bullet):not(.word-list-number):not(.word-horizontal-line) {
  margin: 0 0 6pt 0;
  font-size: 11pt;
  line-height: 1.15;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content h1:not(.word-title) {
  font-size: 16pt;
  font-weight: bold;
  margin: 12pt 0 6pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content h2 {
  font-size: 13pt;
  font-weight: bold;
  margin: 10pt 0 4pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content h3 {
  font-size: 11pt;
  font-weight: bold;
  margin: 8pt 0 4pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content h4,
.word-content h5,
.word-content h6 {
  font-weight: bold;
  margin: 6pt 0 3pt 0;
  color: #000000;
  font-family: 'Calibri', 'Arial', 'Malgun Gothic', sans-serif;
}

.word-content ul,
.word-content ol {
  margin: 6pt 0;
  padding-left: 36pt;
  color: #000;
}

.word-content li {
  margin: 3pt 0;
  color: #000;
}

.word-content strong,
.word-content b {
  font-weight: bold;
}

.word-content em,
.word-content i {
  font-style: italic;
}

/* 테이블 스타일 */
.word-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 6pt 0;
}

.word-content table td,
.word-content table th {
  border: 0.75pt solid #000;
  padding: 3pt;
  font-size: 11pt;
  color: #000;
}

.word-content table th {
  font-weight: bold;
  background-color: #f0f0f0;
}
</style>

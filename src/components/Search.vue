<template>
  <!-- 메뉴 틀 -->
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-925 p-4 sm:p-6 md:p-8 lg:p-10">
    <div class="w-full h-[calc(100vh-5rem)] bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-inner p-4 sm:p-6 md:p-8 lg:p-10">
      <!-- 헤더 -->
      <header class="flex items-center justify-between py-3 px-1 border-b border-gray-800/70 dark:border-gray-200/30">
        <div class="flex flex-col gap-1">
          <div
            class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/40 dark:border-blue-400/60 w-fit">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span class="text-[11px] font-semibold tracking-wide text-blue-600 dark:text-blue-400 uppercase">
              Search
            </span>
          </div>
          <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
            동영상 리스트와 검색 채팅을 함께 사용하는 메뉴입니다.
          </p>
        </div>
      </header>

      <div class="mt-4 h-[calc(100vh-16rem)] flex gap-4 relative">
        <!-- 좌측: 비디오 리스트 -->
        <section 
          :style="{ width: leftSectionWidth + '%' }"
          class="min-w-[240px] sm:min-w-[280px] md:min-w-[320px] bg-white dark:bg-gray-800 rounded-l-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div class="px-3 sm:px-4 md:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <h2 class="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">Video List</h2>
              <div class="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                <span>(</span>
                <div class="flex items-center gap-1">
                  <img :src="videoIcon" alt="동영상" class="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
                  <span>{{ videoListCount }}{{ settingStore.language === 'ko' ? '개' : '' }}</span>
                </div>
                <span>/</span>
                <div class="flex items-center gap-1">
                  <img :src="timeIcon" alt="시간" class="w-3.5 h-3.5 object-contain dark:brightness-0 dark:invert" />
                  <span>{{ videoListTotalDuration }}</span>
                </div>
                <span>)</span>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- 전체 선택 버튼 -->
              <!-- Select All (데스크톱용 텍스트 버튼) -->
              <button
                class="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-500/60 dark:border-gray-600 text-[13px] text-slate-100 dark:text-gray-200 bg-slate-900/70 dark:bg-gray-800 hover:bg-slate-800/80 dark:hover:bg-gray-700 hover:border-blue-400/70 dark:hover:border-blue-500 hover:text-blue-50 dark:hover:text-blue-300 shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-default"
                :disabled="items.length === 0" @click="allselect()">
                <span
                  class="inline-flex items-center justify-center w-5 h-5 rounded-md bg-slate-950/80 text-[11px] font-semibold text-slate-50">
                  {{ selectedIds.length === items.length && items.length > 0 ? '✓' : ' ' }}
                </span>
                <span class="font-medium">
                  {{ selectedIds.length === items.length && items.length > 0 ? t.clearSelection : t.selectAll }}
                </span>
              </button>

              <!-- Select All (모바일 아이콘 버튼) -->
              <button
                class="md:hidden flex items-center justify-center w-9 h-9 rounded-2xl border border-slate-500/60 dark:border-gray-600 bg-slate-900/70 dark:bg-gray-800 text-slate-100 dark:text-gray-200 hover:bg-slate-800/90 dark:hover:bg-gray-700 hover:border-blue-400/70 dark:hover:border-blue-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-default"
                :disabled="items.length === 0" @click="allselect()" :title="t.selectAll">
                <svg class="w-4 h-4 text-slate-100 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              
              <!-- 설정 버튼 -->
              <button @click="showSearchSettingModal = true" :title="settingStore.language === 'ko' ? '설정' : 'Settings'"
                class="w-9 h-9 flex items-center justify-center bg-slate-200/70 dark:bg-gray-700 hover:bg-slate-400/80 dark:hover:bg-gray-600 border border-slate-500/60 dark:border-gray-600 text-slate-100 dark:text-gray-200 backdrop-blur-md rounded-full shadow transition-all duration-200">
                <img :src="settingIcon" alt="설정" class="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
              </button>
            </div>
          </div>
          <div 
            ref="videoListContainerRef"
            class="flex-1 overflow-y-auto p-5 relative">
            <div v-if="items.length === 0" class="flex items-center justify-center h-full">
              <div class="text-sm text-gray-500 dark:text-gray-400 text-center">
                동영상이 없습니다.<br />
                Management 메뉴에서 동영상을 선택하고 검색 버튼을 클릭하세요.
            </div>
            </div>
            <div v-else 
              ref="videoListGridRef"
              class="relative w-full [column-fill:balance]"
              :key="`video-list-${videoListKey}`" 
              :style="{
                columnCount: videoListColumns,
                columnGap: '1rem'
              }">
              <!-- 드래그 선택 영역 표시 -->
              <div 
                v-if="isDragSelecting && dragSelectBox"
                class="fixed border-2 border-blue-500 bg-blue-500/20 pointer-events-none z-50"
                :style="dragSelectBox"></div>
              <div v-for="video in paginatedVideoListItems" :key="`video-${video.id || video.dbId || Math.random()}`"
                class="video-list-thumb-card relative w-full break-inside-avoid mb-4 inline-block align-top rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group bg-gray-100 dark:bg-gray-900/40 transition-all hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600"
                :style="getVideoListThumbAspectStyle(video)"
                :class="{ 'ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-800': selectedIds.includes(video.id) }"
                :ref="el => { if (el) videoCardRefs[video.id] = el }"
                @click="toggleVideoSelection(video.id)"
                @contextmenu.prevent.stop="openVideoListContextMenu(video, $event)">
                <!-- 삭제 버튼 (hover 시 표시) -->
                <button
                  @click.stop="removeVideoFromList(video.id)"
                  class="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md z-10"
                  :title="settingStore.language === 'ko' ? '리스트에서 제거' : 'Remove from list'">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <!-- 선택 표시 -->
                <div class="absolute bottom-1.5 right-1.5 z-[5] pointer-events-none">
                  <div v-if="selectedIds.includes(video.id)"
                    class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div v-else class="w-6 h-6 rounded-full border-2 border-white/90 dark:border-gray-700 bg-black/25 dark:bg-black/40 backdrop-blur-[2px]"></div>
                </div>
                <!-- 이미지 파일인 경우 (최적화: 지연 로딩) -->
                <img 
                  v-if="isImageFile(video) && video.displayUrl"
                  :src="encodeVideoUrl(video.displayUrl)"
                  class="absolute inset-0 w-full h-full object-cover"
                  crossorigin="anonymous"
                  loading="lazy"
                  draggable="false"
                  alt=""
                  @load="onVideoListImageLoad($event, video)"
                  @error="(e) => { console.warn('이미지 로드 실패:', video.title, video.displayUrl); e.target.style.display = 'none'; }"
                />
                <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))"
                  class="absolute inset-0 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700">
                  <div v-if="video._isConverting" class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400 mb-1"></div>
                  <svg v-else class="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <!-- 동영상인 경우 (최적화: 화면에 보이는 것만 metadata 로드) -->
                <video 
                  v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                  :src="encodeVideoUrl(video.displayUrl)" 
                  class="absolute inset-0 w-full h-full object-cover"
                  crossorigin="anonymous"
                  :preload="video.duration ? 'none' : 'metadata'"
                  draggable="false"
                  muted
                  playsinline
                  @loadedmetadata="onVideoListVideoMetadata($event, video)"
                ></video>
                <div v-else class="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                  <svg class="w-10 h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 페이지네이션 -->
          <!-- 예시 이미지 촬영용: ENABLE_DEMO_MODE가 true일 때 항상 표시 -->
          <div v-if="ENABLE_DEMO_MODE || videoListTotalPages > 1" class="px-[clamp(1rem,2vw,1.25rem)] py-[clamp(0.75rem,1.5vw,1rem)] border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)]">
            <button
              @click="videoListCurrentPage = Math.max(1, videoListCurrentPage - 1)"
              :disabled="videoListCurrentPage === 1"
              class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '이전 페이지' : 'Previous Page'">
              <svg class="w-[clamp(1rem,2vw,1.25rem)] h-[clamp(1rem,2vw,1.25rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div class="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">
              <button
                v-for="page in videoListTotalPages"
                :key="page"
                @click="videoListCurrentPage = page"
                :class="{
                  'bg-blue-500 text-white': videoListCurrentPage === page,
                  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700': videoListCurrentPage !== page
                }"
                class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 transition-colors min-w-[clamp(2rem,4vw,2.5rem)] text-[clamp(0.75rem,1.2vw,0.875rem)]">
                {{ page }}
              </button>
            </div>
            
            <button
              @click="videoListCurrentPage = Math.min(videoListTotalPages, videoListCurrentPage + 1)"
              :disabled="videoListCurrentPage === videoListTotalPages"
              class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '다음 페이지' : 'Next Page'">
              <svg class="w-[clamp(1rem,2vw,1.25rem)] h-[clamp(1rem,2vw,1.25rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <!-- 동영상 추가 버튼 -->
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button 
              @click="handleAddVideo"
              class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>{{ settingStore.language === 'ko' ? '동영상 추가' : 'Add Video' }}</span>
            </button>
          </div>
        </section>

        <!-- 드래그 가능한 구분선 -->
        <div 
          @mousedown="startResize"
          class="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-col-resize transition-colors flex items-center justify-center group relative z-10"
          :class="{ 'bg-blue-500 dark:bg-blue-500': isResizing }">
          <div class="w-0.5 h-12 bg-gray-400 dark:bg-gray-500 rounded-full group-hover:bg-gray-500 dark:group-hover:bg-gray-400"></div>
        </div>

        <!-- 우측: 검색 채팅 -->
        <section 
          :style="{ width: (100 - leftSectionWidth) + '%', height: 'calc(90vh - 13rem)' }"
          class="bg-white dark:bg-gray-800 rounded-r-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <!-- 사이드바 헤더 -->
          <div class="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
            <div class="flex items-center justify-between p-4">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
                  </svg>
                </div>
                <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ t.videoSearch }}</h2>
              </div>
              <div class="flex items-center gap-2">
                <!-- 채팅창 초기화 버튼 -->
                <button 
                  @click="handleClearChat"
                  :disabled="!currentChatMessages || currentChatMessages.length === 0"
                  class="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors group disabled:opacity-40 disabled:cursor-not-allowed" 
                  :title="t.clearChat">
                  <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                  <!-- 툴팍 -->
                  <div
                    class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {{ t.clearChat }}
                    <div
                      class="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800 dark:border-b-gray-700">
                    </div>
                  </div>
                </button>
                <!-- 신규 채팅창 추가 버튼 -->
                <button @click="handleNewChatButtonClick"
                  class="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors group" :title="t.newChat">
                  <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  <!-- 툴팍 -->
                  <div
                    class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {{ t.newChat }}
                    <div
                      class="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-800 dark:border-b-gray-700">
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <!-- 채팅창 탭 -->
            <div v-if="chatSessions.length > 0" class="flex gap-2 px-4 pb-2 overflow-x-auto">
              <div v-for="(chat, index) in chatSessions" :key="chat.id"
                @click="editingChatIndex !== index && switchChat(index)"
                @contextmenu.prevent.stop="openChatTabContextMenu(index, $event)" :class="{
                  'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md': currentChatIndex === index,
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600': currentChatIndex !== index
                }"
                class="px-2 sm:px-3 py-1.5 rounded-t-xl text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1 sm:gap-2 cursor-pointer transform hover:scale-105 min-w-0">
                <!-- 편집 모드 -->
                <input v-if="editingChatIndex === index" v-model="editingChatName" @blur="saveChatName(index)"
                  @keydown.enter="saveChatName(index)" @keydown.esc="cancelEditChatName"
                  class="bg-transparent border-b border-current outline-none min-w-[60px] max-w-[120px] text-sm"
                  ref="chatNameInput" />
                <!-- 일반 모드 -->
                <span v-else @dblclick.stop="startEditChatName(index)" class="select-none truncate max-w-[100px] sm:max-w-[150px]">
                  {{ chat.name || `채팅 ${index + 1}` }}
                  </span>
                <button v-if="chatSessions.length > 1 && editingChatIndex !== index" @click.stop="deleteChat(index)"
                  class="hover:bg-black hover:bg-opacity-20 rounded-full p-0.5">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                    </path>
                  </svg>
                </button>
                </div>
            </div>
          </div>

          <!-- 채팅 메시지 영역 -->
          <div ref="chatContainer" class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
            <!-- 채팅 메시지들 -->
            <div v-for="(message, index) in currentChatMessages" :key="index" class="flex items-start gap-3"
              :class="{ 'flex-row-reverse': message.role === 'user' }">
              <!-- AI 메시지 -->
              <div v-if="message.role === 'assistant'"
                class="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
                </svg>
              </div>
              <!-- 사용자 메시지 -->
              <div v-else class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z">
                  </path>
                </svg>
              </div>

              <div class="flex-1" :class="{ 'flex flex-col items-end': message.role === 'user' }">
                <div :class="{
                  'bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md border border-gray-200 dark:border-gray-700 max-w-[85%] sm:max-w-[80%] relative break-words': message.role === 'assistant',
                  'bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl rounded-tr-sm px-3 sm:px-4 py-2 sm:py-3 shadow-md text-white max-w-[85%] sm:max-w-[80%] relative break-words': message.role === 'user'
                }">
                  <!-- 업로드된 이미지 미리보기 (사용자 메시지에만) -->
                  <div v-if="message.role === 'user' && message.uploadedImage && message.uploadedImage.preview" 
                    class="mb-2 rounded-lg overflow-hidden border border-white/20">
                    <img 
                      :src="message.uploadedImage.preview" 
                      :alt="message.uploadedImage.name"
                      class="max-w-full max-h-48 object-contain"
                    />
                  </div>
                  <p :class="{
                    'text-gray-800 dark:text-gray-200 text-sm leading-relaxed': message.role === 'assistant',
                    'text-white text-sm leading-relaxed': message.role === 'user'
                  }" v-html="message.content"></p>
                  <!-- 초기 메시지의 선택된 동영상 목록 -->
                  <div v-if="message.isInitial && message.selectedVideos && message.selectedVideos.length > 0"
                    class="mt-3 space-y-2">
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">{{ t.selectedVideos }}</p>
                    <div v-for="video in message.selectedVideos" :key="video.id"
                      class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <!-- 이미지인 경우 -->
                      <img 
                        v-if="video.displayUrl && isImageFile(video)"
                        :src="encodeVideoUrl(video.displayUrl)" 
                        class="w-[clamp(5rem,15vw,8rem)] h-[clamp(3.5rem,10vw,5rem)] object-cover rounded flex-shrink-0"
                        loading="lazy"
                        @error="(e) => handleChatVideoError(video, e)"
                        crossorigin="anonymous"
                        draggable="false"
                        alt=""
                      />
                      <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                      <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))"
                        class="w-32 h-20 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex flex-col items-center justify-center">
                        <div v-if="video._isConverting" class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400 mb-1"></div>
                        <svg v-else class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <!-- 동영상인 경우 (최적화: metadata만 로드) -->
                      <video 
                        v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                        :src="encodeVideoUrl(video.displayUrl)" 
                        class="w-32 h-20 object-cover rounded flex-shrink-0"
                        @error="(e) => handleChatVideoError(video, e)"
                        @loadedmetadata="(e) => { if (e.target && isFinite(e.target.duration) && e.target.duration > 0) video.duration = e.target.duration; }"
                        crossorigin="anonymous"
                        preload="metadata"
                        draggable="false"
                      ></video>
                      <div v-else class="w-32 h-20 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
                        <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 dark:text-gray-200 break-words line-clamp-2">{{ video.title }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ video.date }}</p>
                      </div>
                    </div>
                  </div>
                  <!-- 검색 결과(클립) 표시 -->
                  <div v-if="message.clips && message.clips.length > 0" class="mt-3 space-y-2">
                    <p
                      :class="message.role === 'assistant' ? 'text-xs text-gray-500 dark:text-gray-400 font-medium mb-2' : 'text-xs text-green-100 font-medium mb-2'">
                      {{ t.searchResults }} ({{ message.clips.length }}{{ settingStore.language === 'ko' ? '개' : ' ' + t.clips }}):
                    </p>
                    <div v-for="clip in message.clips" :key="clip.id"
                      :class="message.role === 'assistant' ? 'flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600' : 'flex items-center gap-3 p-3 bg-green-600/80 rounded-xl transition-all duration-200 hover:bg-green-600'">
                      <video 
                        :src="getClipThumbnailUrl(clip)" 
                        class="w-[clamp(5rem,15vw,8rem)] h-[clamp(3.5rem,10vw,5rem)] object-cover rounded cursor-pointer flex-shrink-0" 
                        preload="metadata"
                        @click.stop="zoomClip(clip)"
                        @error="(e) => console.warn('clip thumbnail error', e, clip)"
                        @loadedmetadata="(e) => { if (e.target && clip.start_time !== undefined) e.target.currentTime = Math.max(0.1, clip.start_time || 0.1); else if (e.target) e.target.currentTime = 0.1; }"
                        crossorigin="anonymous"></video>
                      <div class="flex-1 min-w-0">
                        <p
                          :class="message.role === 'assistant' ? 'text-sm font-medium text-gray-800 dark:text-gray-200 break-words line-clamp-2' : 'text-sm font-medium text-white break-words line-clamp-2'">
                          {{ clip.title }}</p>
                        <p
                          :class="message.role === 'assistant' ? 'text-xs text-gray-500 dark:text-gray-400 mt-1' : 'text-xs text-green-100 mt-1'">
                          <span v-if="clip.start_time !== undefined && clip.end_time !== undefined">
                            {{ formatTime(clip.start_time) }} - {{ formatTime(clip.end_time) }}
                          </span>
                          <span v-else>
                            {{ clip.sourceVideo || clip.date }}
                          </span>
                        </p>
                        <p v-if="clip.sentence"
                          :class="message.role === 'assistant' ? 'text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2' : 'text-xs text-green-50 mt-2 line-clamp-2'">
                          {{ clip.sentence }}
                </p>
              </div>
                    </div>
                  </div>
                  <!-- 설정 버튼 (assistant 메시지에만 표시, 메시지 블록 내부 우측 상단) -->
                  <button
                    v-if="message.role === 'assistant'"
                    @click.stop="openChatMessageContextMenu(index, $event)"
                    class="absolute top-1.5 right-1 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="설정">
                    <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                    </svg>
                  </button>
                </div>
                <p
                  :class="message.role === 'assistant' ? 'text-xs text-gray-400 dark:text-gray-500 mt-1 ml-2' : 'text-xs text-gray-400 dark:text-gray-500 mt-1 mr-2'">
                  {{ message.timestamp }}</p>
            </div>
          </div>

            <!-- 로딩 인디케이터 -->
            <div v-if="isSearching" class="flex items-start gap-3">
              <div
                class="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div class="flex gap-1">
                    <div class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                    <div class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.2s">
                    </div>
                    <div class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.4s">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 입력 영역 (하단 고정) -->
          <div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 pt-2 pb-4">
            <!-- 검색 타입 선택 드롭박스 -->
            <div class="mb-2 flex items-center gap-2">
              <!-- 별 아이콘 (초록색 바탕) -->
              <div class="relative" ref="starTooltipRef" @click.stop>
                <button
                  type="button"
                  @click="showStarTooltip = !showStarTooltip"
                  class="w-8 h-8 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                  aria-label="Star"
                >
                  <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </button>
                <!-- 말풍선 (샘플 검색어 리스트) -->
                <Transition name="fade-slide">
                  <div
                    v-if="showStarTooltip"
                    class="absolute bottom-full left-[130px] transform -translate-x-1/2 mb-2 w-64 rounded-lg shadow-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 z-50 max-h-80 overflow-y-auto"
                    @click.stop
                  >
                    <div class="relative p-2">
                      <!-- 화살표 -->
                      <div class="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200 dark:border-t-gray-600"></div>
                      <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-700" style="margin-top: -1px;"></div>
                      
                      <!-- 헤더 -->
                      <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-600 mb-2">
                        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {{ settingStore.language === 'ko' ? '샘플 검색어' : 'Sample Search Queries' }}
                        </h3>
                      </div>
                      
                      <!-- 샘플 검색어 리스트 -->
                      <div class="space-y-1">
                        <button
                          v-for="(query, index) in sampleSearchQueries"
                          :key="index"
                          @click="selectSampleQuery(query)"
                          class="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 transition-colors"
                        >
                          {{ query }}
                        </button>
                        <div v-if="sampleSearchQueries.length === 0" class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          {{ settingStore.language === 'ko' ? '샘플 검색어가 없습니다' : 'No sample search queries' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
            <div class="flex items-end gap-2">
              <div class="flex-1 relative">
                <!-- textarea를 flex 컨테이너로 변경하여 이미지와 텍스트 입력을 함께 표시 -->
                <div 
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-green-500 dark:focus-within:ring-green-400 focus-within:border-transparent overflow-hidden flex flex-col max-w-full"
                  :class="{
                    'disabled:bg-gray-100 dark:disabled:bg-gray-900': searchType === 'fast'
                  }"
                  :style="uploadedImage ? 'min-height: 180px;' : 'min-height: 44px;'"
                >
                  <!-- 이미지 미리보기 (textarea 내부 상단 좌측) -->
                  <div v-if="uploadedImage" class="relative p-2 flex-shrink-0 flex justify-start">
                    <div class="relative">
                      <img 
                        :src="uploadedImagePreview" 
                        alt="Uploaded image"
                        class="max-w-[120px] max-h-[120px] rounded-lg object-contain"
                      />
                      <button
                        @click.stop="removeUploadedImage"
                        class="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                        :title="settingStore.language === 'ko' ? '이미지 제거' : 'Remove Image'"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <!-- 텍스트 입력 영역 -->
                  <div class="relative flex-1 flex items-end min-h-[44px]">
                    <textarea 
                      v-model="searchInput" 
                      @keydown.enter.exact.prevent="handleSearch"
                      @keydown.shift.enter.exact="searchInput += '\n'" 
                      :placeholder="searchType === 'fast' ? (settingStore.language === 'ko' ? '고속 검색은 검색 객체 설정에서 지정한 객체를 검색합니다.' : 'Fast search searches for objects specified in the search object settings.') : t.searchPlaceholder" 
                      :disabled="searchType === 'fast'"
                      rows="1"
                      class="w-full px-4 py-3 pr-12 border-0 bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none resize-none max-h-32 overflow-y-auto text-sm disabled:bg-transparent disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
                      style="min-height: 44px;"></textarea>
                    <button 
                      @click="handleSearch" 
                      :disabled="(searchType === 'fast' ? selectedVideos.length === 0 : !searchInput.trim()) || isSearching"
                      class="absolute right-1 bottom-[4.5px] p-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-md">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8">
                        </path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-left">{{ t.enterToSearch }}</p>
            
            <!-- 이미지 업로드 영역 -->
            <div class="mt-2">
              <div class="flex items-center gap-2">
                <label 
                  for="image-upload"
                  class="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors text-sm"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span>{{ settingStore.language === 'ko' ? '이미지 업로드' : 'Upload Image' }}</span>
                </label>
                <input 
                  id="image-upload"
                  type="file" 
                  accept="image/*" 
                  @change="handleImageUpload"
                  class="hidden"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 채팅 메시지 컨텍스트 메뉴 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="chatMessageContextMenu.visible"
          class="context-menu-container fixed z-[200] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
          :style="{ left: chatMessageContextMenu.x + 'px', top: chatMessageContextMenu.y + 'px' }"
          @click.stop>
          <button
            @click.stop="copyChatMessage(chatMessageContextMenu.messageIndex)"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {{ settingStore.language === 'ko' ? '복사' : 'Copy' }}
          </button>
          <!-- 초기 메시지가 아닐 때만 보고서 생성 버튼 표시 -->
          <div v-if="chatMessageContextMenu.messageIndex !== null && currentChatMessages[chatMessageContextMenu.messageIndex] && !currentChatMessages[chatMessageContextMenu.messageIndex].isInitial" 
            class="relative"
            @mouseenter.stop="showReportSubmenu(chatMessageContextMenu.messageIndex, chatMessageContextMenu.x, chatMessageContextMenu.y)"
            @mouseleave.stop="hideReportSubmenu">
            <button class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
              @click.stop>
              <span>{{ settingStore.language === 'ko' ? '보고서 생성' : 'Create Report' }}</span>
              <span class="ml-2">›</span>
            </button>
          </div>
          <!-- 초기 메시지가 아닐 때만 메시지 삭제 버튼 표시 -->
          <div v-if="chatMessageContextMenu.messageIndex !== null && currentChatMessages[chatMessageContextMenu.messageIndex] && !currentChatMessages[chatMessageContextMenu.messageIndex].isInitial" 
            class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button
            v-if="chatMessageContextMenu.messageIndex !== null && currentChatMessages[chatMessageContextMenu.messageIndex] && !currentChatMessages[chatMessageContextMenu.messageIndex].isInitial"
            @click.stop="deleteChatMessage(chatMessageContextMenu.messageIndex)"
            class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
            {{ settingStore.language === 'ko' ? '메시지 삭제' : 'Delete Message' }}
          </button>
        </div>
      </Transition>
      
      <!-- 보고서 생성 서브메뉴 -->
      <div v-if="reportSubmenu.visible" class="context-menu-container fixed z-[201]"
        :style="{ left: `${reportSubmenu.x}px`, top: `${reportSubmenu.y}px` }" 
        @click.stop
        @mouseenter.stop="keepReportSubmenuVisible"
        @mouseleave.stop="hideReportSubmenu">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[180px]">
          <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm flex items-center justify-between"
            @click.stop="showReportListSubmenu(reportSubmenu.messageIndex, reportSubmenu.x, reportSubmenu.y)">
            <span>{{ settingStore.language === 'ko' ? '기존 보고서에 추가' : 'Add to Existing Report' }}</span>
            <span class="ml-2">›</span>
          </button>
          <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
            @click.stop="createNewReport(reportSubmenu.messageIndex)">
            {{ settingStore.language === 'ko' ? '새 보고서 생성' : 'Create New Report' }}
          </button>
        </div>
      </div>
      
      <!-- 보고서 목록 서브메뉴 -->
      <div v-if="reportListSubmenu.visible" class="context-menu-container fixed z-[202]"
        :style="{ left: `${reportListSubmenu.x}px`, top: `${reportListSubmenu.y}px` }" 
        @click.stop
        @mouseenter.stop="keepReportListSubmenuVisible"
        @mouseleave.stop="hideReportListSubmenu">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[250px] max-h-[400px] overflow-y-auto">
          <div v-if="reportListSubmenu.reports.length === 0" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
            {{ settingStore.language === 'ko' ? '보고서가 없습니다' : 'No reports available' }}
          </div>
          <button 
            v-for="report in reportListSubmenu.reports" 
            :key="report.id"
            class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            @click.stop="addClipsToSelectedReport(report.id, reportListSubmenu.messageIndex)">
            <div class="font-medium truncate">{{ report.title }}</div>
            <div v-if="report.description" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
              {{ report.description }}
            </div>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 보고서 제목 입력 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showReportTitleModal" 
             class="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeReportTitleModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeReportTitleModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
               @click.stop
               @mousedown.stop
               @mouseup.stop>
            <div class="flex flex-col">
              <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                {{ settingStore.language === 'ko' ? '보고서 정보 입력' : 'Enter Report Information' }}
              </h3>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ settingStore.language === 'ko' ? '보고서 제목' : 'Report Title' }}
              </label>
              <input
                v-model="reportTitleInput"
                type="text"
                :placeholder="settingStore.language === 'ko' ? '보고서 제목을 입력하세요' : 'Enter report title'"
                :class="[
                  'w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 mb-3',
                  reportTitleError 
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-green-500 dark:focus:ring-green-400'
                ]"
                @input="checkReportTitle"
                @keyup.enter="confirmReportTitle"
                autofocus
              />
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ settingStore.language === 'ko' ? '작성자' : 'Author' }}
              </label>
              <input
                v-model="reportAuthorInput"
                type="text"
                :placeholder="settingStore.language === 'ko' ? '작성자를 입력하세요' : 'Enter author name'"
                class="w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 mb-1 border-gray-300 dark:border-gray-600 focus:ring-green-500 dark:focus:ring-green-400"
                @keyup.enter="confirmReportTitle"
              />
              <p v-if="reportTitleError" class="text-red-500 dark:text-red-400 text-sm mb-4">
                {{ reportTitleError }}
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  @click="closeReportTitleModal"
                  class="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  {{ settingStore.language === 'ko' ? '취소' : 'Cancel' }}
                </button>
                <button
                  @click="confirmReportTitle"
                  :disabled="!reportTitleInput.trim() || !!reportTitleError || isCheckingTitle"
                  class="px-6 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ settingStore.language === 'ko' ? '확인' : 'Confirm' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 보고서 생성 로딩 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isCreatingReport" 
             class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeReportModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeReportModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
               @click.stop
               @mousedown.stop
               @mouseup.stop>
            <div class="flex flex-col items-center justify-center">
              <!-- 로딩 중: 스피너 -->
              <div v-if="!reportSuccess" class="animate-spin rounded-full h-16 w-16 border-b-4 border-green-500 dark:border-green-400 mb-4"></div>
              <!-- 완료: 체크 표시 -->
              <div v-else class="mb-4">
                <div class="w-16 h-16 rounded-full bg-green-500 dark:bg-green-400 flex items-center justify-center animate-scale-in">
                  <svg class="w-10 h-10 text-white animate-check-draw" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" class="check-path"></path>
                  </svg>
                </div>
              </div>
              <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
                <span v-if="!reportSuccess">
                  {{ settingStore.language === 'ko' ? '보고서 생성 중...' : 'Creating Report...' }}
                </span>
                <span v-else class="text-green-600 dark:text-green-400">
                  {{ settingStore.language === 'ko' ? '완료!' : 'Success!' }}
                </span>
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
                <span v-if="!reportSuccess">
                  {{ reportLoadingMessage || (settingStore.language === 'ko' ? '잠시만 기다려주세요.' : 'Please wait...') }}
                </span>
                <span v-else class="text-gray-800 dark:text-gray-200">
                  {{ reportSuccessMessage }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 동영상 로딩 모달 (Management와 동일한 디자인) -->
    <Teleport to="body">
      <div v-if="showVideosLoadingModal" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="w-[20vw] h-[15vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 animate-fade-in">
          <svg class="w-14 h-14 text-emerald-500 animate-spin-slow" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <div class="text-lg font-semibold text-gray-700 dark:text-gray-200 mt-2">
            {{ settingStore.language === 'ko' ? '로딩 중...' : 'Loading...' }}
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 채팅 탭 컨텍스트 메뉴 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="chatTabContextMenu.visible"
          class="fixed z-[200] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
          :style="{ left: chatTabContextMenu.x + 'px', top: chatTabContextMenu.y + 'px' }"
          @click="closeChatTabContextMenu">
          <button
            @click.stop="closeChatTab(chatTabContextMenu.chatIndex)"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {{ settingStore.language === 'ko' ? '닫기' : 'Close' }}
          </button>
          <button
            v-if="chatSessions.length > 1"
            @click.stop="closeOtherChatTabs(chatTabContextMenu.chatIndex)"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            {{ settingStore.language === 'ko' ? '다른 탭 닫기' : 'Close Other Tabs' }}
          </button>
          <button
            v-if="chatSessions.length > 1"
            @click.stop="closeAllChatTabs"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700">
            {{ settingStore.language === 'ko' ? '모든 탭 닫기' : 'Close All Tabs' }}
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Video list: 우클릭 컨텍스트 메뉴 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="videoListContextMenu.visible"
          class="video-list-context-menu fixed z-[200] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
          :style="{ left: videoListContextMenu.x + 'px', top: videoListContextMenu.y + 'px' }"
          @click.stop>
          <button
            type="button"
            @click="openVideoDetailFromContextMenu"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {{ t.viewDetails }}
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- 동영상 상세 정보 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showVideoDetailModal && videoDetailTarget"
             class="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeVideoDetailModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeVideoDetailModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
               @mousedown.stop
               @mouseup.stop>
            <div class="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-bold text-gray-800 dark:text-gray-200 truncate pr-4">{{ t.videoDetails }}</h2>
              <button type="button" @click="closeVideoDetailModal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" :aria-label="settingStore.language === 'ko' ? '닫기' : 'Close'">
                <svg viewBox="0 0 24 24" class="w-6 h-6">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <div class="p-5 space-y-4 text-sm">
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t.fileName }}</p>
                <p class="text-gray-900 dark:text-gray-100 break-words">{{ videoDetailTarget.title || videoDetailTarget.name || '—' }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t.uploadDate }}</p>
                <p class="text-gray-900 dark:text-gray-100">{{ videoDetailTarget.date || '—' }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t.durationLabel }}</p>
                <p class="text-gray-900 dark:text-gray-100">{{ formatVideoDetailDuration(videoDetailTarget) }}</p>
              </div>
            </div>
            <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button type="button" @click="closeVideoDetailModal"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
                {{ settingStore.language === 'ko' ? '닫기' : 'Close' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 동영상 목록 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showVideoListModal" 
             class="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeVideoListModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeVideoListModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl mx-2 sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col"
               @mousedown.stop
               @mouseup.stop>
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 truncate pr-4">
                {{ settingStore.language === 'ko' ? '동영상 목록' : 'Video List' }}
              </h2>
              <button 
                @click="closeVideoListModal"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg viewBox="0 0 24 24" class="w-6 h-6">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            
            <!-- 동영상 목록 -->
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="isLoadingVideos" class="flex items-center justify-center h-64">
                <div class="text-gray-500 dark:text-gray-400">{{ settingStore.language === 'ko' ? '로딩 중...' : 'Loading...' }}</div>
              </div>
              <div v-else-if="availableVideos.length === 0" class="flex items-center justify-center h-64">
                <div class="text-gray-500 dark:text-gray-400 text-center">
                  {{ settingStore.language === 'ko' ? '추가할 수 있는 동영상이 없습니다.' : 'No videos available to add.' }}
                </div>
              </div>
              <div v-else class="grid grid-cols-1 gap-3">
                <div v-for="video in availableVideos" :key="video.id"
                  class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
                  :class="{ 'ring-2 ring-green-400 dark:ring-green-500 bg-green-50 dark:bg-green-900/30': selectedVideoIds.includes(video.id) }"
                  @click="toggleVideoSelectionInModal(video.id)">
                  <!-- 이미지 파일인 경우 (최적화: 지연 로딩) -->
                  <img 
                    v-if="isImageFile(video) && video.displayUrl"
                    :src="encodeVideoUrl(video.displayUrl)"
                    class="w-[clamp(4rem,12vw,6rem)] h-[clamp(3rem,9vw,4rem)] object-cover rounded flex-shrink-0"
                    crossorigin="anonymous"
                    loading="lazy"
                    draggable="false"
                    alt=""
                  />
                  <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                  <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))"
                    class="w-[clamp(4rem,12vw,6rem)] h-[clamp(3rem,9vw,4rem)] bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex flex-col items-center justify-center">
                    <div v-if="video._isConverting" class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400 mb-1"></div>
                    <svg v-else class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <!-- 동영상인 경우 (최적화: metadata만 로드) -->
                  <video 
                    v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                    :src="encodeVideoUrl(video.displayUrl)" 
                    class="w-[clamp(4rem,12vw,6rem)] h-[clamp(3rem,9vw,4rem)] object-cover rounded flex-shrink-0"
                    crossorigin="anonymous"
                    :preload="video.duration ? 'none' : 'metadata'"
                    draggable="false"
                    @loadedmetadata="(e) => { if (e.target && isFinite(e.target.duration) && e.target.duration > 0 && !video.duration) video.duration = e.target.duration; }"
                  ></video>
                  <div v-else class="w-[clamp(4rem,12vw,6rem)] h-[clamp(3rem,9vw,4rem)] bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-200 break-words line-clamp-2">{{ video.title }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ video.date }}</p>
                  </div>
                  <div class="flex-shrink-0">
                    <div v-if="selectedVideoIds.includes(video.id)"
                      class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div v-else class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 하단 버튼 -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ settingStore.language === 'ko' ? `선택됨: ${selectedVideoIds.length}개` : `Selected: ${selectedVideoIds.length}` }}
              </div>
              <div class="flex items-center gap-3">
              <button
                  @click="closeVideoListModal"
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {{ settingStore.language === 'ko' ? '취소' : 'Cancel' }}
                </button>
                <button 
                  @click="addSelectedVideos"
                  :disabled="selectedVideoIds.length === 0"
                  class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg">
                  {{ settingStore.language === 'ko' ? '추가' : 'Add' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 클립 확대 모달 팝업 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="isZoomed" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          @mousedown="(e) => handleModalBackgroundClick(e, unzoomVideo)"
          @mouseup="(e) => handleModalBackgroundClick(e, unzoomVideo)">
          <div class="flex items-stretch gap-4 w-full max-w-6xl"
               @mousedown.stop
               @mouseup.stop>
            <!-- 비디오 모달 -->
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex-1 relative" @click.stop>
              <!-- 비디오 영역 (확대 전용 - 하얀 프레임 + 하단 진행 바/타이틀) -->
              <div class="relative w-full p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-inner flex flex-col">
                <!-- 닫기 버튼: 프레임 우측 상단 -->
                <button @click="unzoomVideo"
                  class="ml-auto mb-3 z-10 w-6 h-6 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200">
                  <!-- 닫기 아이콘 -->
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                    </path>
                  </svg>
                </button>

                <div
                  class="relative w-full aspect-video flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl overflow-hidden group zoom-group"
                  @mouseenter="hoveredVideoId = zoomedVideo?.id" @mouseleave="hoveredVideoId = null">
                  <!-- 동영상인 경우 -->
                  <video v-if="zoomedVideo" ref="zoomVideoRef" :src="encodeVideoUrl(zoomedVideo.displayUrl)"
                    class="object-cover w-full h-full" preload="metadata" crossorigin="anonymous"
                    @timeupdate="onZoomTimeUpdate($event)"
                    @error="(e) => handleZoomVideoError(zoomedVideo.id, e)"
                    draggable="false"></video>
                  <div v-if="zoomedVideo" class="absolute inset-0 pointer-events-none transition-colors duration-300"
                    :class="zoomPlaying ? 'bg-transparent' : 'bg-black/30'"></div>
                  <button v-if="zoomedVideo" @click.stop="togglePlay(zoomedVideo.id)" :class="[
                    !zoomPlaying
                      ? 'opacity-100 scale-100 pointer-events-auto'
                      : (hoveredVideoId === zoomedVideo.id
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-90 pointer-events-none'),
                    'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm text-white rounded-full w-16 h-16 m-auto transition-all duration-300 hover:scale-110 active:scale-95 z-20'
                  ]">
                    <svg v-if="!zoomPlaying" xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                      viewBox="0.4 -0.7 16 16" class="w-10 h-10">
                      <path
                        d="M6.271 4.055a.5.5 0 0 1 .759-.429l4.592 3.11a.5.5 0 0 1 0 .828l-4.592 3.11a.5.5 0 0 1-.759-.429V4.055z" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0.4 -0.1 16 16"
                      class="w-10 h-10">
                      <path
                        d="M5.5 3.5A.5.5 0 0 1 6 3h1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-9zM9.5 3.5A.5.5 0 0 1 10 3h1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-9z" />
                    </svg>
                  </button>
                </div>
                <!-- 하단 진행 바 + 타이틀 영역 -->
                <div v-if="zoomedVideo" class="mt-4 w-full flex flex-col gap-2">
                  <div ref="zoomProgressBarRef"
                    class="relative w-full h-3 bg-gray-200 rounded-full cursor-pointer zoom-progress-bar overflow-visible"
                    :class="{ 'dragging': isDragging && draggedVideoId === zoomedVideo.id }"
                    @click.stop="seekVideo(zoomedVideo.id, $event)"
                    @mousedown.stop
                    @mouseup.stop="stopDragging">
                    <div
                      class="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm overflow-hidden"
                      :class="{ 'transition-all duration-300': !(isDragging && draggedVideoId === zoomedVideo.id) }"
                      :style="{ width: `${zoomProgress}%` }"></div>
                    <div
                      class="absolute top-1/2 h-5 w-5 bg-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 border-2 border-blue-500 z-[20] cursor-grab active:cursor-grabbing"
                      :class="{ 'transition-none': isDragging && draggedVideoId === zoomedVideo.id }"
                      :style="{ left: `${zoomProgress}%` }" 
                      @mousedown.stop="startDragging(zoomedVideo.id, $event)"
                      @mouseup.stop="stopDragging"></div>
                  </div>
                  <div class="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
                    <div class="flex items-center gap-2">
                      <span v-if="zoomedVideo.title"
                        class="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words max-w-[90vw] sm:max-w-[70vw] md:max-w-[50vw]">{{ zoomedVideo.title
                        }}</span>
                      <!-- 장면 설명 다시 열기 버튼 (클립 재생 중이고 sentence가 있지만 팝업이 닫혀있을 때) -->
                      <button 
                        v-if="zoomedClip && zoomedClip.sentence && !showSentencePopup"
                        @click.stop="showSentencePopup = true"
                        class="ml-2 p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 transition-colors"
                        :title="settingStore.language === 'ko' ? '장면 설명 보기' : 'Show Scene Description'">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                      <span>{{ formatTime(zoomCurrentTime) }}</span>
                      <span>/</span>
                      <span>{{ formatTime(zoomDuration) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 우측 장면 설명 결과 팝업 -->
            <Transition name="slide-left">
              <div v-if="zoomedClip && zoomedClip.sentence && showSentencePopup" 
                class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-80 flex-shrink-0 flex flex-col" 
                @click.stop
                @mousedown.stop
                @mouseup.stop>
                <div class="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                  <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {{ settingStore.language === 'ko' ? '장면 설명' : 'Scene Description' }}
                  </h3>
                  <button @click="showSentencePopup = false" 
                    class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {{ zoomedClip.sentence }}
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 검색 설정 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSearchSettingModal" 
             class="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeSearchSettingModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeSearchSettingModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-[80vw] md:max-w-[60vw] mx-2 sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col"
               @mousedown.stop
               @mouseup.stop>
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200 truncate pr-4">
                {{ settingStore.language === 'ko' ? '설정' : 'Settings' }}
              </h2>
              <button 
                @click="closeSearchSettingModal"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg viewBox="0 0 24 24" class="w-6 h-6">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            
            <!-- 설정 내용 -->
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <!-- Summarize Parameters -->
                <div class="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 shadow-lg overflow-hidden">
                  <button 
                    class="w-full text-left flex items-center gap-3 px-5 py-4 transition-colors"
                    :class="searchType === 'fast' 
                      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' 
                      : 'bg-emerald-100/80 dark:bg-emerald-900/30 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/40'"
                    @click="searchType === 'fast' ? null : (showSummarizeVlmParams = !showSummarizeVlmParams)"
                    :disabled="searchType === 'fast'"
                  >
                    <div class="flex items-center gap-3 flex-1">
                      <div class="w-8 h-8 rounded-lg bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h2 class="text-lg font-bold text-emerald-900 dark:text-emerald-100">{{ settingStore.language === 'ko' ? '상세 검색 파라미터' : 'detailed search Parameters' }}</h2>
                    </div>
                    <span class="text-emerald-600 dark:text-emerald-300 text-xl font-bold">{{ showSummarizeVlmParams ? '▲' : '▼' }}</span>
                  </button>
                  <Transition name="fade-slide">
                    <div v-show="showSummarizeVlmParams" class="p-5 space-y-5">
                      <!-- Enable Audio -->
                      <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                        <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? '오디오 설정' : 'Audio Settings' }}</h3>
                        <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                          <div class="flex items-center justify-between">
                            <label class="text-base font-semibold text-gray-800 dark:text-gray-200 cursor-pointer" @click="settingStore.summarizeEnableAudio = !settingStore.summarizeEnableAudio">
                              {{ settingStore.language === 'ko' ? 'Enable Audio' : 'Enable Audio' }}
                            </label>
                            <button
                              type="button"
                              role="switch"
                              :aria-checked="settingStore.summarizeEnableAudio"
                              @click="settingStore.summarizeEnableAudio = !settingStore.summarizeEnableAudio"
                              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                              :class="settingStore.summarizeEnableAudio ? 'bg-blue-600 dark:bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'"
                            >
                              <span
                                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                :class="settingStore.summarizeEnableAudio ? 'translate-x-6' : 'translate-x-1'"
                              ></span>
                            </button>
                          </div>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ settingStore.language === 'ko' ? '오디오 기능 활성화' : 'Enable audio functionality' }}</p>
                        </section>
                      </div>

                      <!-- Chunk 설정 -->
                      <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                        <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Chunk 설정' : 'Chunk Settings' }}</h3>
                          <div class="grid lg:grid-cols-1 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Chunk Size' : 'Chunk Size' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '동영상 추론에서 분할 단위를 설정합니다.' : 'Set the chunking unit for video inference.' }}</p>
                              <select v-model.number="settingStore.searchChunk" class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all">
                                <option value=-1>{{ settingStore.language === 'ko' ? '자동 지정' : 'Auto' }}</option>
                                <option value=0>{{ settingStore.language === 'ko' ? 'Chunk 없음' : 'No chunking' }}</option>
                                <option value=5>5 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
                                <option value=10>10 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
                                <option value=20>20 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
                                <option value=30>30 {{ settingStore.language === 'ko' ? '초' : 'sec' }}</option>
                                <option value=60>1 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                                <option value=120>2 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                                <option value=300>5 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                                <option value=600>10 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                                <option value=1200>20 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                                <option value=1800>30 {{ settingStore.language === 'ko' ? '분' : 'min' }}</option>
                              </select>
                            </section>
                          </div>
                        </div>

                        <!-- LLM 기본 파라미터 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                          <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'LLM 기본 파라미터' : 'Basic LLM Parameters' }}</h3>
                          <div class="grid lg:grid-cols-3 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Top-k</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '최고 확률 어휘 토큰을 유지할 개수' : 'The number of highest probability vocabulary tokens to keep for top-k-filtering' }}</p>
                              <input v-model.number="settingStore.searchTopK" type="number" min="1" max="1000" step="1"
                                @input="clampSearchValue('searchTopK', 1000, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Top-p</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 top-p 샘플링 질량' : 'The top-p sampling mass used for text generation' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.searchTopP" type="number" min="0" max="1" step="0.1"
                                  @input="clampSearchValue('searchTopP', 1, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSearchTopP">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.searchTopP" type="range" min="0" max="1" step="0.05"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Temperature</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 샘플링 온도' : 'The sampling temperature to use for text generation' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.searchTemperature" type="number" min="0" max="1" step="0.1"
                                  @input="clampSearchValue('searchTemperature', 1, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSearchTemperature">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.searchTemperature" type="range" min="0" max="1" step="0.1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              </div>
                            </section>
                          </div>
                        </div>

                        <!-- 기타 파라미터 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                          <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? '기타 파라미터' : 'Other Parameters' }}</h3>
                          <div class="grid lg:grid-cols-2 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <div class="flex items-center justify-between mb-2">
                                <div>
                                  <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">Max Tokens</h2>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '생성할 최대 토큰 수' : 'The maximum number of tokens to generate' }}</p>
                                </div>
            <div class="flex items-center gap-2">
                                  <input v-model.number="settingStore.searchMaxTokens" type="number" min="1" max="2048" step="1"
                                    @input="clampSearchValue('searchMaxTokens', 2048, 1)"
                                    class="border-2 border-emerald-300 dark:border-emerald-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                  <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSearchMaxTokens">↺</button>
                                </div>
                              </div>
                              <div class="flex items-center gap-2 h-8 mt-3">
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                <input v-model.number="settingStore.searchMaxTokens" type="range" min="1" max="2048" step="1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-12 text-center">2048</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Seed</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '샘플링에 사용할 시드 값' : 'Seed value to use for sampling' }}</p>
                              <input v-model.number="settingStore.searchSeed" type="number" min="1" max="4294967295" step="1"
                                @input="clampSearchValue('searchSeed', 4294967295, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>
                          </div>
                        </div>
                        
                        <!-- 프레임 및 배치 설정 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                          <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? '프레임 및 배치 설정' : 'Frame & Batch Settings' }}</h3>
                          <div class="grid lg:grid-cols-3 gap-4 mb-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Num Frames Per Chunk' : 'Num Frames Per Chunk' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '청크당 프레임 수' : 'Number of frames per chunk' }}</p>
                              <input v-model.number="settingStore.summarizeNumFramesPerChunk" type="number" min="0" max="100" step="1"
                                @input="clampSummarizeValue('summarizeNumFramesPerChunk', 100, 0)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Frame Width' : 'Frame Width' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '프레임 너비 (0이면 자동)' : 'Frame width (0 for auto)' }}</p>
                              <input v-model.number="settingStore.summarizeFrameWidth" type="number" min="0" max="4096" step="1"
                                @input="clampSummarizeValue('summarizeFrameWidth', 4096, 0)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Frame Height' : 'Frame Height' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '프레임 높이 (0이면 자동)' : 'Frame height (0 for auto)' }}</p>
                              <input v-model.number="settingStore.summarizeFrameHeight" type="number" min="0" max="4096" step="1"
                                @input="clampSummarizeValue('summarizeFrameHeight', 4096, 0)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>
                          </div>
                          
                          <div class="grid lg:grid-cols-3 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Batch Size' : 'Batch Size' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '배치 크기' : 'Batch size' }}</p>
                              <input v-model.number="settingStore.summarizeBatchSize" type="number" min="1" max="100" step="1"
                                @input="clampSummarizeValue('summarizeBatchSize', 100, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'RAG Batch Size' : 'RAG Batch Size' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? 'RAG 배치 크기' : 'RAG batch size' }}</p>
                              <input v-model.number="settingStore.summarizeRagBatchSize" type="number" min="1" max="100" step="1"
                                @input="clampSummarizeValue('summarizeRagBatchSize', 100, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'RAG Top-k' : 'RAG Top-k' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? 'RAG Top-k 값' : 'RAG Top-k value' }}</p>
                              <input v-model.number="settingStore.summarizeRagTopK" type="number" min="1" max="100" step="1"
                                @input="clampSummarizeValue('summarizeRagTopK', 100, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>
                          </div>
                        </div>

                        <!-- Summarize 전용 파라미터 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg border border-emerald-200 dark:border-emerald-700 overflow-hidden">
                          <button @click="showSummarizeSpecificParams = !showSummarizeSpecificParams" class="w-full flex items-center justify-between px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Summarize 전용 파라미터' : 'Summarize-Specific Parameters' }}</h3>
                            <span class="text-emerald-600 dark:text-emerald-300 text-sm font-bold">{{ showSummarizeSpecificParams ? '▲' : '▼' }}</span>
                          </button>
                          <Transition name="fade-slide">
                            <div v-show="showSummarizeSpecificParams" class="p-4">
                              <div class="grid lg:grid-cols-3 gap-4">
                                <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                  <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Summarize Top-p' : 'Summarize Top-p' }}</h2>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '요약용 Top-p' : 'Top-p for summarization' }}</p>
                                  <div class="flex items-center gap-2 mb-2">
                                    <input v-model.number="settingStore.summarizeSummarizeTopP" type="number" min="0" max="1" step="0.1"
                                      @input="clampSummarizeValue('summarizeSummarizeTopP', 1, 0)"
                                      class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                    <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeSummarizeTopP">↺</button>
                                  </div>
                                  <div class="flex items-center gap-2 h-8">
                                    <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                    <input v-model.number="settingStore.summarizeSummarizeTopP" type="range" min="0" max="1" step="0.05"
                                      class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                    <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                  </div>
                                </section>

                                <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                  <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Summarize Temperature' : 'Summarize Temperature' }}</h2>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '요약용 Temperature' : 'Temperature for summarization' }}</p>
                                  <div class="flex items-center gap-2 mb-2">
                                    <input v-model.number="settingStore.summarizeSummarizeTemperature" type="number" min="0" max="2" step="0.1"
                                      @input="clampSummarizeValue('summarizeSummarizeTemperature', 2, 0)"
                                      class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                    <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeSummarizeTemperature">↺</button>
                                  </div>
                                  <div class="flex items-center gap-2 h-8">
                                    <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                    <input v-model.number="settingStore.summarizeSummarizeTemperature" type="range" min="0" max="2" step="0.1"
                                      class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                    <span class="text-xs text-gray-400 w-8 text-center">2</span>
                                  </div>
                                </section>

                                <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                  <div class="flex items-center justify-between mb-2">
                                    <div>
                                      <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Summarize Max Tokens' : 'Summarize Max Tokens' }}</h2>
                                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '요약용 최대 토큰 수' : 'Max tokens for summarization' }}</p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                      <input v-model.number="settingStore.summarizeSummarizeMaxTokens" type="number" min="1" max="4096" step="1"
                                        @input="clampSummarizeValue('summarizeSummarizeMaxTokens', 4096, 1)"
                                        class="border-2 border-emerald-300 dark:border-emerald-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                      <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeSummarizeMaxTokens">↺</button>
                                    </div>
                                  </div>
                                  <div class="flex items-center gap-2 h-8 mt-3">
                                    <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                    <input v-model.number="settingStore.summarizeSummarizeMaxTokens" type="range" min="1" max="4096" step="1"
                                      class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                    <span class="text-xs text-gray-400 w-12 text-center">4096</span>
                                  </div>
                                </section>
                              </div>
                            </div>
                          </Transition>
                        </div>

                        <!-- Chat 파라미터 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg border border-emerald-200 dark:border-emerald-700 overflow-hidden">
                          <button @click="showChatParams = !showChatParams" class="w-full flex items-center justify-between px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Chat 파라미터' : 'Chat Parameters' }}</h3>
                            <span class="text-emerald-600 dark:text-emerald-300 text-sm font-bold">{{ showChatParams ? '▲' : '▼' }}</span>
                          </button>
                          <Transition name="fade-slide">
                            <div v-show="showChatParams" class="p-4">
                              <div class="grid lg:grid-cols-3 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Chat Top-p' : 'Chat Top-p' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '채팅용 Top-p' : 'Top-p for chat' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeChatTopP" type="number" min="0" max="1" step="0.1"
                                  @input="clampSummarizeValue('summarizeChatTopP', 1, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeChatTopP">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeChatTopP" type="range" min="0" max="1" step="0.05"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Chat Temperature' : 'Chat Temperature' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '채팅용 Temperature' : 'Temperature for chat' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeChatTemperature" type="number" min="0" max="2" step="0.1"
                                  @input="clampSummarizeValue('summarizeChatTemperature', 2, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeChatTemperature">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeChatTemperature" type="range" min="0" max="2" step="0.1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">2</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <div class="flex items-center justify-between mb-2">
                                <div>
                                  <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Chat Max Tokens' : 'Chat Max Tokens' }}</h2>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '채팅용 최대 토큰 수' : 'Max tokens for chat' }}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                  <input v-model.number="settingStore.summarizeChatMaxTokens" type="number" min="1" max="4096" step="1"
                                    @input="clampSummarizeValue('summarizeChatMaxTokens', 4096, 1)"
                                    class="border-2 border-emerald-300 dark:border-emerald-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                  <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeChatMaxTokens">↺</button>
                                </div>
                              </div>
                              <div class="flex items-center gap-2 h-8 mt-3">
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                <input v-model.number="settingStore.summarizeChatMaxTokens" type="range" min="1" max="4096" step="1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-12 text-center">4096</span>
                              </div>
                            </section>
                              </div>
                            </div>
                          </Transition>
                        </div>

                        <!-- Notification 파라미터 -->
                        <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg border border-emerald-200 dark:border-emerald-700 overflow-hidden">
                          <button @click="showNotificationParams = !showNotificationParams" class="w-full flex items-center justify-between px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Notification 파라미터' : 'Notification Parameters' }}</h3>
                            <span class="text-emerald-600 dark:text-emerald-300 text-sm font-bold">{{ showNotificationParams ? '▲' : '▼' }}</span>
                          </button>
                          <Transition name="fade-slide">
                            <div v-show="showNotificationParams" class="p-4">
                              <div class="grid lg:grid-cols-3 gap-4">
                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Notification Top-p' : 'Notification Top-p' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '알림용 Top-p' : 'Top-p for notification' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeNotificationTopP" type="number" min="0" max="1" step="0.1"
                                  @input="clampSummarizeValue('summarizeNotificationTopP', 1, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeNotificationTopP">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeNotificationTopP" type="range" min="0" max="1" step="0.05"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Notification Temperature' : 'Notification Temperature' }}</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '알림용 Temperature' : 'Temperature for notification' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeNotificationTemperature" type="number" min="0" max="2" step="0.1"
                                  @input="clampSummarizeValue('summarizeNotificationTemperature', 2, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeNotificationTemperature">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeNotificationTemperature" type="range" min="0" max="2" step="0.1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">2</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <div class="flex items-center justify-between mb-2">
                                <div>
                                  <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Notification Max Tokens' : 'Notification Max Tokens' }}</h2>
                                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '알림용 최대 토큰 수' : 'Max tokens for notification' }}</p>
                                </div>
                                <div class="flex items-center gap-2">
                                  <input v-model.number="settingStore.summarizeNotificationMaxTokens" type="number" min="1" max="4096" step="1"
                                    @input="clampSummarizeValue('summarizeNotificationMaxTokens', 4096, 1)"
                                    class="border-2 border-emerald-300 dark:border-emerald-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                  <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeNotificationMaxTokens">↺</button>
                                </div>
                              </div>
                              <div class="flex items-center gap-2 h-8 mt-3">
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                <input v-model.number="settingStore.summarizeNotificationMaxTokens" type="range" min="1" max="4096" step="1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-12 text-center">4096</span>
                              </div>
                            </section>
                              </div>
                            </div>
                          </Transition>
                        </div>
                    </div>
                  </Transition>
                </div>
                
                <!-- Query Parameters -->
                <div class="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 shadow-lg overflow-hidden">
                  <button 
                    class="w-full text-left flex items-center gap-3 px-5 py-4 transition-colors"
                    :class="searchType === 'detailed' 
                      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' 
                      : 'bg-blue-100/80 dark:bg-blue-900/30 hover:bg-blue-200/80 dark:hover:bg-blue-900/40'"
                    @click="searchType === 'detailed' ? null : (showQueryVlmParams = !showQueryVlmParams)"
                    :disabled="searchType === 'detailed'"
                  >
                    <div class="flex items-center gap-3 flex-1">
                      <div class="w-8 h-8 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <h2 class="text-lg font-bold text-blue-900 dark:text-blue-100">{{ settingStore.language === 'ko' ? '고속 검색 파라미터' : 'Fast search Parameters' }}</h2>
                    </div>
                    <span class="text-blue-600 dark:text-blue-300 text-xl font-bold">{{ showQueryVlmParams ? '▲' : '▼' }}</span>
                  </button>
                  <Transition name="fade-slide">
                    <div v-show="showQueryVlmParams" class="p-5 space-y-5">
                      <!-- 검색 객체 및 Box Threshold 파라미터 -->
                      <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                        <div class="grid lg:grid-cols-2 gap-4">
                          <!-- 검색 객체 -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? '검색 객체' : 'Search Object' }}</h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '검색할 객체를 입력하세요. (객체는 한 줄에 하나씩 입력해주세요.)' : 'Enter the object to search for. (Enter one object per line.)' }}</p>
                            <textarea 
                              v-model="searchObject"
                              rows="4"
                              :placeholder="settingStore.language === 'ko' ? '검색 객체를 입력하세요...' : 'Enter search object...'"
                              class="border-2 border-blue-300 dark:border-blue-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                            ></textarea>
                          </section>
                          
                          <!-- Box Threshold -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                              <div>
                                <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Box Threshold' : 'Box Threshold' }}</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '값이 높을수록 더 정확한 박스를 검출하지만 그만큼 검출되는 박스의 수량이 줄어듭니다.' : 'Box detection sensitivity, the higher the more accurate box detection, but the number of boxes detected decreases.' }}</p>
                              </div>
                              <div class="flex items-center gap-2">
                                <input 
                                  v-model.number="boxThreshold" 
                                  type="number" 
                                  min="0.1" 
                                  max="0.9" 
                                  step="0.05"
                                  @input="clampBoxThreshold"
                                  class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                />
                                <button 
                                  class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" 
                                  @click="resetBoxThreshold"
                                >↺</button>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 h-8 mt-3">
                              <span class="text-xs text-gray-400 w-8 text-center">0.1</span>
                              <input 
                                v-model.number="boxThreshold" 
                                type="range" 
                                min="0.1" 
                                max="0.9" 
                                step="0.05"
                                class="flex-1 border-blue-300 dark:border-blue-600" 
                              />
                              <span class="text-xs text-gray-400 w-12 text-center">0.9</span>
                            </div>
                          </section>
                        </div>
                        
                        <!-- Frame Skip 및 Object Detection Threshold -->
                        <div class="grid lg:grid-cols-2 gap-4 mt-4">
                          <!-- Frame Skip -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                              <div>
                                <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Frame Skip' : 'Frame Skip' }}</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '확인할 프레임의 간격을 지정할 수 있습니다.' : 'Frame skip value' }}</p>
                              </div>
                              <div class="flex items-center gap-2">
                                <input 
                                  v-model.number="frameSkip" 
                                  type="number" 
                                  min="1" 
                                  max="60" 
                                  step="1"
                                  @input="clampFrameSkip"
                                  class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                />
                                <button 
                                  class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" 
                                  @click="resetFrameSkip"
                                >↺</button>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 h-8 mt-3">
                              <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              <input 
                                v-model.number="frameSkip" 
                                type="range" 
                                min="1" 
                                max="60" 
                                step="1"
                                class="flex-1 border-blue-300 dark:border-blue-600" 
                              />
                              <span class="text-xs text-gray-400 w-12 text-center">60</span>
                            </div>
                          </section>
                          
                          <!-- Object Detection Threshold -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                              <div>
                                <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Object Detection Threshold' : 'Object Detection Threshold' }}</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '클립을 생성할 때 확인할 객체의 수를 지정할 수 있습니다.' : 'Object detection threshold value' }}</p>
                              </div>
                              <div class="flex items-center gap-2">
                                <input 
                                  v-model.number="objectDetectionThreshold" 
                                  type="number" 
                                  min="1" 
                                  max="100" 
                                  step="1"
                                  @input="clampObjectDetectionThreshold"
                                  class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                />
                                <button 
                                  class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" 
                                  @click="resetObjectDetectionThreshold"
                                >↺</button>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 h-8 mt-3">
                              <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              <input 
                                v-model.number="objectDetectionThreshold" 
                                type="range" 
                                min="1" 
                                max="100" 
                                step="1"
                                class="flex-1 border-blue-300 dark:border-blue-600" 
                              />
                              <span class="text-xs text-gray-400 w-12 text-center">100</span>
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onActivated, computed, nextTick, watch } from "vue";
import { useSettingStore } from '@/stores/settingStore';
import { useVideoFileStore } from '@/stores/videoFileStore';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { marked } from 'marked';
import { formatTime, getCurrentTime } from '@/utils/formatUtils';
import { isImageFile, isUnsupportedFormat, isVideoDeleted, createVideoObject } from '@/utils/videoUtils';
import { useVideoSync } from '@/composables/useVideoSync';
import settingIcon from '@/assets/icons/setting.png';
import videoIcon from '@/assets/icons/video.png';
import timeIcon from '@/assets/icons/time.png';

// ==================== 상수 정의 ====================
const API_BASE_URL = getApiBaseUrl();
const STORAGE_KEY = 'vss_search_state';
const VIDEO_LIST_ROWS_PER_PAGE = 8;

// ==================== 스토어 및 라우터 ====================
const settingStore = useSettingStore();
const videoFileStore = useVideoFileStore();

// ==================== 다국어 지원 ====================
const translations = {
  ko: {
    workspace: "Video Search Workspace",
    description: "동영상 업로드 후 동영상을 우클릭하여 요약 혹은 검색을 진행할 수 있습니다.",
    descriptionDetail: "검색 메뉴에서 원하는 장면을 검색하고 해당 장면의 클립을 확인할 수 있습니다.",
    selectAll: "전체 선택",
    clearSelection: "선택 해제",
    uploadVideo: "동영상 업로드",
    pleaseUpload: "동영상을 업로드해주세요",
    dropHere: "여기에 파일을 놓으세요",
    noThumbnail: "썸네일 없음",
    expand: "확대",
    summary: "요약 진행",
    search: "검색",
    removeSummary: "요약 결과 제거",
    delete: "삭제",
    deleteSelected: "선택된 항목 삭제",
    deleteConfirm: "개의 동영상이 삭제됩니다.",
    deleteConfirmDetail: "진행하시겠습니까?",
    videoSearch: "Video Search",
    newChat: "신규 채팅창 추가",
    clearChat: "채팅창 초기화",
    searchPlaceholder: "검색할 장면에 대한 정보를 입력해주세요...",
    enterToSearch: "Enter를 눌러 검색하거나 Shift+Enter로 줄바꿈",
    uploading: "동영상 업로드 중...",
    complete: "완료",
    selectedVideos: "선택된 동영상:",
    searchResults: "검색 결과",
    clips: "개",
    noMessages: "아직 메시지가 없습니다.",
    noScenes: "해당하는 장면이 없습니다.",
    foundScenes: "개의 동영상에서",
    foundClips: "개의 장면을 찾았습니다.",
    searchError: "검색 중 오류가 발생했습니다.",
    viewDetails: "상세보기",
    videoDetails: "동영상 정보",
    fileName: "파일명",
    uploadDate: "업로드 날짜",
    durationLabel: "영상 길이",
    durationUnknown: "알 수 없음"
  },
  en: {
    workspace: "Video Search Workspace",
    description: "Upload a video and right-click on the video to summarize or search.",
    descriptionDetail: "Search for the desired scene in the search menu and view the clips of the scene.",
    selectAll: "Select All",
    clearSelection: "Clear Selection",
    uploadVideo: "Upload Video",
    pleaseUpload: "Please upload a video",
    dropHere: "Drop files here",
    noThumbnail: "No Thumbnail",
    expand: "Expand",
    summary: "Summary",
    search: "Search",
    removeSummary: "Remove Summary",
    delete: "Delete",
    deleteSelected: "Delete Selected",
    deleteConfirm: "videos will be deleted.",
    deleteConfirmDetail: "Do you want to proceed?",
    videoSearch: "Video Search",
    newChat: "New Chat",
    clearChat: "Clear Chat",
    searchPlaceholder: "Enter information about the scene to search...",
    enterToSearch: "Press Enter to search or Shift+Enter for new line",
    uploading: "Uploading videos...",
    complete: "Complete",
    selectedVideos: "Selected Videos:",
    searchResults: "Search Results",
    clips: "clips",
    noMessages: "No messages yet.",
    noScenes: "No matching scenes found.",
    foundScenes: "videos,",
    foundClips: "scenes found.",
    searchError: "An error occurred during search.",
    viewDetails: "View details",
    videoDetails: "Video details",
    fileName: "File name",
    uploadDate: "Upload date",
    durationLabel: "Duration",
    durationUnknown: "Unknown"
  }
};

const t = computed(() => translations[settingStore.language] || translations.ko);

// 전역 동영상 리스트 (모든 채팅창에서 공유)
const globalVideoList = ref([]);
// 비디오 리스트 관련 (전역 리스트를 참조)
const items = computed({
  get: () => globalVideoList.value,
  set: (value) => { globalVideoList.value = value; }
});
const selectedIds = ref([]);
const selectedVideos = computed(() => items.value.filter(v => selectedIds.value.includes(v.id)));

// 섹션 너비 조정 관련
const leftSectionWidth = ref(33.33); // 기본값 1/3 (33.33%)
const isResizing = ref(false);

// 동영상 리스트 그리드 열 수 계산 (섹션 너비에 따라)
const videoListColumns = computed(() => {
  // 섹션 너비가 40% 이상이면 3열, 그 외에는 2열
  return leftSectionWidth.value >= 40 ? 3 : 2;
});

// 페이지네이션 관련
const videoListCurrentPage = ref(1);
const videoListKey = ref(0); // 리스트 강제 리렌더링을 위한 키
// 드래그 선택 관련
const videoListContainerRef = ref(null);
const videoListGridRef = ref(null);
const videoCardRefs = ref({});
const isDragSelecting = ref(false);
const dragSelectStart = ref({ x: 0, y: 0 });
const dragSelectEnd = ref({ x: 0, y: 0 });
const dragSelectBox = ref(null);
const dragSelectInitialSelection = ref([]); // 드래그 시작 시점의 선택 상태 저장

// 페이지당 아이템 수 계산 (8줄 × 열 수)
const videoListItemsPerPage = computed(() => VIDEO_LIST_ROWS_PER_PAGE * videoListColumns.value);

// 총 페이지 수 계산
// const videoListTotalPages = computed(() => {
//   if (items.value.length <= videoListItemsPerPage.value) return 1;
//   return Math.ceil(items.value.length / videoListItemsPerPage.value);
// });

// 예시 이미지 촬영용 고정값
const videoListTotalPages = computed(() => {
  if (ENABLE_DEMO_MODE) {
    return 7; // 고정값: 7페이지
  }
  if (items.value.length <= videoListItemsPerPage.value) return 1;
  return Math.ceil(items.value.length / videoListItemsPerPage.value);
});

// 현재 페이지의 아이템만 필터링
const paginatedVideoListItems = computed(() => {
  if (items.value.length <= videoListItemsPerPage.value) {
    return items.value;
  }
  const startIndex = (videoListCurrentPage.value - 1) * videoListItemsPerPage.value;
  const endIndex = startIndex + videoListItemsPerPage.value;
  return items.value.slice(startIndex, endIndex);
});

function startResize(e) {
  isResizing.value = true;
  const container = e.currentTarget.parentElement;
  const containerRect = container.getBoundingClientRect();
  const minLeftWidth = 20; // 최소 너비 20%
  const maxLeftWidth = 80; // 최대 너비 80%

  function handleMouseMove(e) {
    if (!isResizing.value) return;
    const mouseX = e.clientX - containerRect.left;
    const newWidth = (mouseX / containerRect.width) * 100;
    
    if (newWidth >= minLeftWidth && newWidth <= maxLeftWidth) {
      leftSectionWidth.value = newWidth;
    }
  }

  function handleMouseUp() {
    isResizing.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// 동영상 duration을 지연 로딩으로 미리 로드하는 함수 (최적화: 배치 처리)
let durationLoadQueue = [];
let isProcessingDurationQueue = false;
const DURATION_BATCH_SIZE = 2; // 한 번에 처리할 동영상 수 (크롬 멈춤 방지를 위해 줄임)
const DURATION_BATCH_DELAY = 500; // 배치 간 지연 시간 (ms, 브라우저 부하 감소)
const DURATION_LOAD_TIMEOUT = 10000; // duration 로드 타임아웃 (10초)
const loadingDurationUrls = new Set(); // 로드 중인 URL 추적 (중복 요청 방지)
const loadingDurationVideoIds = new Set(); // 로드 중인 video ID 추적

function processDurationQueue() {
  if (isProcessingDurationQueue || durationLoadQueue.length === 0) return;
  
  isProcessingDurationQueue = true;
  // 화면에 보이는 비디오 우선 처리 (paginatedVideoListItems에 있는 것)
  const visibleVideoIds = new Set(paginatedVideoListItems.value.map(v => v.id));
  const visibleVideos = durationLoadQueue.filter(v => visibleVideoIds.has(v.id));
  const hiddenVideos = durationLoadQueue.filter(v => !visibleVideoIds.has(v.id));
  
  // 화면에 보이는 비디오를 먼저 큐 앞에 배치
  durationLoadQueue = [...visibleVideos, ...hiddenVideos];
  
  const batch = durationLoadQueue.splice(0, DURATION_BATCH_SIZE);
  
  // 순차적으로 처리하여 브라우저 부하 감소
  batch.forEach((video, index) => {
    // 각 동영상 사이에 짧은 지연 추가 (브라우저가 다른 작업을 처리할 시간 제공)
    if (index > 0) {
      setTimeout(() => {
        processSingleVideoDuration(video);
      }, index * 100); // 100ms 간격으로 처리
    } else {
      processSingleVideoDuration(video);
    }
  });
  
  isProcessingDurationQueue = false;
  
  // 다음 배치 처리 (requestIdleCallback 사용하여 브라우저 유휴 상태일 때만 처리)
  if (durationLoadQueue.length > 0) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        setTimeout(processDurationQueue, DURATION_BATCH_DELAY);
      }, { timeout: 1000 });
    } else {
      setTimeout(processDurationQueue, DURATION_BATCH_DELAY);
    }
  }
}

function processSingleVideoDuration(video) {
  // 이미지 파일이면 스킵
  if (isImageFile(video)) return;
  
  // 이미 로드 중인 video ID면 스킵
  if (loadingDurationVideoIds.has(video.id)) return;
  
  // 백엔드 API에서 받은 duration이 있으면 먼저 사용
  if (video.duration && isFinite(video.duration) && video.duration > 0) {
    return;
  }
  
  // displayUrl이 없으면 스킵
  if (!video.displayUrl) return;
  
  // blob URL은 duration 로드 시도하지 않음 (반복 요청 방지)
  if (video.displayUrl.startsWith('blob:')) return;
  
  // 이미 로드 중인 URL이면 스킵 (중복 요청 방지)
  if (loadingDurationUrls.has(video.displayUrl)) {
    return;
  }
  
  // 큰 파일 체크 (1GB 이상이면 duration 로드 스킵)
  const fileSizeGB = video.fileSize ? video.fileSize / (1024 * 1024 * 1024) : 0;
  if (fileSizeGB > 1.0) {
    console.log(`[Duration 로드 스킵] 큰 파일 (${fileSizeGB.toFixed(2)}GB): ${video.title}`);
    return;
  }
  
  // 로드 중인 URL 및 video ID로 표시
  loadingDurationUrls.add(video.displayUrl);
  loadingDurationVideoIds.add(video.id);
  
  // 숨겨진 video 요소를 만들어서 메타데이터 로드 (백엔드 duration이 없는 경우에만)
  const videoElement = document.createElement('video');
  videoElement.preload = 'metadata';
  videoElement.crossOrigin = 'anonymous';
  videoElement.style.display = 'none';
  videoElement.muted = true; // 음소거하여 자동 재생 방지
  
  // 정리 함수
  const cleanup = () => {
    loadingDurationUrls.delete(video.displayUrl);
    loadingDurationVideoIds.delete(video.id);
    if (videoElement.parentNode) {
      try {
        document.body.removeChild(videoElement);
      } catch (_e) {
        // 이미 제거되었을 수 있음
      }
    }
    // src 제거하여 추가 요청 방지
    try {
      videoElement.src = '';
      videoElement.load();
    } catch (_e) {
      // 에러 무시
    }
  };
  
  // 타임아웃 설정 (일정 시간 후 강제 정리)
  const timeoutId = setTimeout(() => {
    console.warn(`[Duration 로드 타임아웃] ${video.title} (${video.displayUrl})`);
    cleanup();
  }, DURATION_LOAD_TIMEOUT);
  
  videoElement.addEventListener('loadedmetadata', () => {
    clearTimeout(timeoutId);
    const duration = videoElement.duration;
    if (duration && isFinite(duration) && duration > 0) {
      video.duration = duration;
    }
    cleanup();
  }, { once: true });
  
  videoElement.addEventListener('error', () => {
    clearTimeout(timeoutId);
    cleanup();
  }, { once: true });
  
  // abort 이벤트도 처리
  videoElement.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    cleanup();
  }, { once: true });
  
  videoElement.src = encodeVideoUrl(video.displayUrl);
  document.body.appendChild(videoElement);
}

function preloadAllVideoDurations() {
  // 큐에 추가 (중복 제거: 이미 로드 중인 URL은 제외)
  durationLoadQueue = items.value.filter(video => {
    if (isImageFile(video)) return false;
    if (video.duration && isFinite(video.duration) && video.duration > 0) return false;
    if (!video.displayUrl) return false;
    // blob URL은 duration 로드 시도하지 않음
    if (video.displayUrl.startsWith('blob:')) return false;
    // 이미 로드 중인 URL은 제외
    if (loadingDurationUrls.has(video.displayUrl)) return false;
    // 이미 로드 중인 video ID는 제외
    if (loadingDurationVideoIds.has(video.id)) return false;
    return true;
  });
  
  // 큐가 비어있지 않으면 처리 시작 (requestIdleCallback 사용하여 브라우저 유휴 상태일 때만)
  if (durationLoadQueue.length > 0) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        processDurationQueue();
      }, { timeout: 2000 });
    } else {
      // requestIdleCallback이 없으면 짧은 지연 후 처리
      setTimeout(() => {
        processDurationQueue();
      }, 500);
    }
  }
}

// ==================== 예시 이미지 촬영용 고정값 (비활성화하려면 ENABLE_DEMO_MODE를 false로 설정) ====================
const ENABLE_DEMO_MODE = false; // 예시 이미지 촬영 모드 활성화/비활성화 플래그

// 동영상 리스트 통계
// const videoListCount = computed(() => items.value.length);
// const videoListTotalDuration = computed(() => {
//   const totalSeconds = items.value.reduce((sum, video) => {
//     // duration 속성이 있으면 사용, 없으면 0
//     const duration = video.duration || 0;
//     return sum + (isFinite(duration) && duration > 0 ? duration : 0);
//   }, 0);
//   return formatDuration(totalSeconds);
// });

// 예시 이미지 촬영용 고정값
const videoListCount = computed(() => {
  if (ENABLE_DEMO_MODE) {
    return 100; // 고정값: 100개
  }
  return items.value.length;
});

const videoListTotalDuration = computed(() => {
  if (ENABLE_DEMO_MODE) {
    return '48시간 29분 12초'; // 고정값: 48시간 29분 12초
  }
  const totalSeconds = items.value.reduce((sum, video) => {
    // duration 속성이 있으면 사용, 없으면 0
    const duration = video.duration || 0;
    return sum + (isFinite(duration) && duration > 0 ? duration : 0);
  }, 0);
  return formatDuration(totalSeconds);
});

// 검색 채팅 관련
// 채팅 세션 제한 설정
const MAX_CHAT_SESSIONS = 50; // 최대 채팅 세션 개수
const MAX_MESSAGES_PER_CHAT = 100; // 채팅당 최대 메시지 개수
const MESSAGE_CLEANUP_THRESHOLD = 80; // 메시지 정리 임계값 (이 개수 이상이면 정리)

const chatSessions = ref([]);
const currentChatIndex = ref(0);
const searchInput = ref('');
const isSearching = ref(false);

// 메시지 정리 함수: 메시지 개수가 임계값을 초과하면 오래된 메시지 삭제
function cleanupOldMessages(chatIndex) {
  const chat = chatSessions.value[chatIndex];
  if (!chat || !chat.messages || chat.messages.length < MESSAGE_CLEANUP_THRESHOLD) {
    return;
  }
  
  // 초기 메시지는 보존
  const initialMessages = chat.messages.filter(msg => msg.isInitial);
  const regularMessages = chat.messages.filter(msg => !msg.isInitial);
  
  // 일반 메시지가 MAX_MESSAGES_PER_CHAT을 초과하면 오래된 메시지 삭제
  if (regularMessages.length > MAX_MESSAGES_PER_CHAT) {
    const messagesToKeep = regularMessages.slice(-MAX_MESSAGES_PER_CHAT);
    chat.messages = [...initialMessages, ...messagesToKeep];
    
    // 삭제된 메시지의 클립 URL 수집 및 삭제
    const deletedMessages = regularMessages.slice(0, regularMessages.length - MAX_MESSAGES_PER_CHAT);
    const clipUrls = new Set();
    
    deletedMessages.forEach(message => {
      if (message.clips && Array.isArray(message.clips)) {
        message.clips.forEach(clip => {
          if (clip.url && !clip.via_response) {
            clipUrls.add(clip.url);
          }
        });
      }
      if (message.groupedClips && Array.isArray(message.groupedClips)) {
        message.groupedClips.forEach(group => {
          if (group.clips && Array.isArray(group.clips)) {
            group.clips.forEach(clip => {
              if (clip.url && !clip.via_response) {
                clipUrls.add(clip.url);
              }
            });
          }
        });
      }
    });
    
    // 클립 삭제 요청 (비동기, 블로킹하지 않음)
    if (clipUrls.size > 0) {
      fetch(`${API_BASE_URL}/delete-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_urls: Array.from(clipUrls) })
      }).catch(err => console.warn('오래된 메시지 클립 삭제 실패:', err));
    }
    
    console.log(`[Search] 채팅 ${chatIndex}의 오래된 메시지 ${deletedMessages.length}개 정리 완료`);
  }
}
const searchType = ref('detailed'); // 'fast', 'fast_vlm', 'detailed'
const chatContainer = ref(null);
const editingChatIndex = ref(null);
const editingChatName = ref('');
const chatNameInput = ref(null);
// ==================== AbortController 관리 ====================
const abortControllers = ref([]);

/**
 * AbortController를 생성하고 추적 목록에 추가
 * @returns {AbortController} 생성된 AbortController
 */
function createAbortController() {
  const abortController = new AbortController();
  abortControllers.value.push(abortController);
  return abortController;
}

/**
 * AbortController를 추적 목록에서 제거
 * @param {AbortController} abortController - 제거할 AbortController
 */
function removeAbortController(abortController) {
  const index = abortControllers.value.indexOf(abortController);
  if (index > -1) {
    abortControllers.value.splice(index, 1);
  }
}

/**
 * AbortError인지 확인
 * @param {Error} error - 확인할 에러
 * @returns {boolean} AbortError 여부
 */
function isAbortError(error) {
  return error.name === 'AbortError';
}

// ==================== 컨텍스트 메뉴 상태 ====================
const chatMessageContextMenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
const chatTabContextMenu = ref({ visible: false, chatIndex: null, x: 0, y: 0 });
const videoListContextMenu = ref({ visible: false, x: 0, y: 0, video: null });
const showVideoDetailModal = ref(false);
const videoDetailTarget = ref(null);
// 보고서 생성 서브메뉴 상태
const reportSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
// 보고서 목록 서브메뉴 상태
const reportListSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0, reports: [] });
// 보고서 생성 관련 상태
const isCreatingReport = ref(false);

// ==================== 로딩 모달 상태 ====================
const showVideosLoadingModal = ref(false);
const reportSuccess = ref(false);
const reportLoadingMessage = ref('');
const reportSuccessMessage = ref('');
const showReportTitleModal = ref(false);
const reportTitleInput = ref('');
const reportAuthorInput = ref('');
const reportTitleError = ref('');
const isCheckingTitle = ref(false);
const pendingReportData = ref(null);
const titleCheckDebounceTimer = ref(null);
// 설정 모달 상태
const showSearchSettingModal = ref(false);
const showQueryVlmParams = ref(true);
const showSummarizeVlmParams = ref(true);
const showStarTooltip = ref(false);
const starTooltipRef = ref(null);
// 샘플 검색어 리스트
const sampleSearchQueries = ref([
  "창문 안에 들어간 사람을 찾아주세요.",
  "강도가 여성의 소지품을 빼앗는 장면을 찾아주세요."

]);
let modalMouseDownPos = null;
// Summarize 하위 섹션 접기/펼치기 상태 (기본값: 접힘)
const showSummarizeSpecificParams = ref(false);
const showChatParams = ref(false);
const showNotificationParams = ref(false);
// 고속 검색 파라미터
const searchObject = ref('person');
const boxThreshold = ref(0.5);
const frameSkip = ref(5);
const objectDetectionThreshold = ref(1);
// 이미지 업로드 관련
const uploadedImage = ref(null);
const uploadedImagePreview = ref(null);
// 동영상 목록 모달 상태
const showVideoListModal = ref(false);
const availableVideos = ref([]);
const selectedVideoIds = ref([]);
const isLoadingVideos = ref(false);

// 확대 모달 관련
const zoomedVideo = ref(null);
const zoomedClip = ref(null);
const showSentencePopup = ref(true);
const isZoomed = ref(false);
const zoomPlaying = ref(false);
const zoomProgress = ref(0);
const zoomVideoRef = ref(null);
const zoomProgressBarRef = ref(null);
const hoveredVideoId = ref(null);
const zoomCurrentTime = ref(0);
const zoomDuration = ref(0);
const isDragging = ref(false);
const draggedVideoId = ref(null);
const dragMoveHandler = ref(null);
const dragEndHandler = ref(null);

// 현재 채팅 메시지
const currentChatMessages = computed(() => {
  if (chatSessions.value.length === 0) return [];
  const messages = chatSessions.value[currentChatIndex.value]?.messages || [];
  
  // selectedVideos의 displayUrl을 최신 정보로 업데이트
  return messages.map(message => {
    if (message.isInitial && message.selectedVideos) {
      const updatedVideos = message.selectedVideos.map(savedVideo => {
        // items.value에서 최신 동영상 정보 찾기
        const currentVideo = items.value.find(v => 
          v.id === savedVideo.id || v.dbId === savedVideo.dbId || v.id === savedVideo.dbId
        );
        
        if (currentVideo) {
          // 최신 정보로 업데이트
          return {
            id: savedVideo.id,
            dbId: savedVideo.dbId || savedVideo.id,
            title: currentVideo.title || savedVideo.title,
            displayUrl: currentVideo.displayUrl || currentVideo.originUrl || '',
            date: currentVideo.date || savedVideo.date
          };
        } else {
          // items.value에 없으면 저장된 정보 유지 (서버에서 조회 필요)
          return {
            ...savedVideo,
            displayUrl: savedVideo.displayUrl || ''
          };
        }
      });
      
      return {
        ...message,
        selectedVideos: updatedVideos
      };
    }
    return message;
  });
});

// formatDuration은 settingStore.language를 사용하는 커스텀 버전 필요
function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec === 0) {
    return settingStore.language === 'ko' ? '0초' : '0sec';
  }
  
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  
  const parts = [];
  
  if (hours > 0) {
    parts.push(`${hours+10}${settingStore.language === 'ko' ? '시간' : 'h'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}${settingStore.language === 'ko' ? '분' : 'm'}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}${settingStore.language === 'ko' ? '초' : 's'}`);
  }
  
  return parts.join(' ');
}

function constrainContextMenuPosition(x, y) {
  const width = 160;
  const height = 200;
  const margin = 10;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 경계 확인 및 조정
  if (x + width > windowWidth) x = windowWidth - width - margin;
  if (y + height > windowHeight) y = windowHeight - height - margin;
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  return { x, y };
}

// 채팅 관련 함수
function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

function getSelectionSignature(videos) {
  if (!videos || videos.length === 0) return 'none';
  const ids = videos
    .map(video => video?.id)
    .filter(id => id !== undefined && id !== null)
    .map(id => id.toString())
    .sort();
  return ids.length > 0 ? ids.join('|') : 'none';
}

function snapshotVideosForChat(videos) {
  // 동영상 ID만 저장 (서버에서 최신 정보를 가져오기 위해)
  return (videos || []).map(video => ({
    id: video.id,
    dbId: video.dbId || video.id, // DB ID 저장 (서버에서 조회용)
    title: video.title,
    date: video.date
    // displayUrl은 저장하지 않음 - 표시할 때 items.value에서 최신 정보 가져오기
  }));
}

function handleChatVideoError(video, event) {
  console.warn('채팅창 동영상 로드 실패:', video.title, video.displayUrl, event);
  // 에러 발생 시 displayUrl을 null로 설정하여 대체 UI 표시
  if (video) {
    video.displayUrl = null;
  }
}

// 동영상을 MP4로 변환하는 함수
async function convertVideoToMp4(videoId, userId, videoObject) {
  
  // 변환 중 상태 표시
  if (videoObject) {
    videoObject._isConverting = true;
  }
  
  const abortController = createAbortController();
  
  try {
    const response = await fetch(`${API_BASE_URL}/convert-video/${videoId}?user_id=${userId}`, {
      signal: abortController.signal
    });
    if (!response.ok) {
      console.warn('동영상 변환 요청 실패:', response.status);
      if (videoObject) {
        videoObject._isConverting = false;
      }
      return null;
    }
    const data = await response.json();
    if (data.success && data.converted_url) {
      videoObject.displayUrl = data.converted_url;
      videoObject.originUrl = data.converted_url;
      videoObject._isConverting = false;
      console.log('동영상 변환 완료:', {
        title: videoObject.title,
        convertedUrl: data.converted_url
      });
      return data.converted_url;
    }
    if (videoObject) {
      videoObject._isConverting = false;
    }
    return null;
  } catch (error) {
    if (isAbortError(error)) {
      if (videoObject) {
        videoObject._isConverting = false;
      }
      return null;
    }
    console.error('동영상 변환 중 오류:', error);
    if (videoObject) {
      videoObject._isConverting = false;
    }
    return null;
  } finally {
    removeAbortController(abortController);
  }
}

function createNewChat(videos = selectedVideos.value, signature) {
  const effectiveVideos = videos || [];
  const selectionSnapshot = snapshotVideosForChat(effectiveVideos);
  const resolvedSignature = signature ?? getSelectionSignature(effectiveVideos);

  // 전역 동영상 리스트에 없는 동영상 추가
  if (effectiveVideos.length > 0) {
    effectiveVideos.forEach(video => {
      const exists = globalVideoList.value.some(v => (v.dbId || v.id) === (video.dbId || video.id));
      if (!exists) {
        globalVideoList.value.push({ ...video });
      }
    });
  }

  // 기본적으로 선택 해제 상태로 설정
  const selectedVideoIds = [];

  const newChat = {
    id: Date.now(),
    name: null, // 사용자가 수정할 수 있는 이름
    messages: [],
    selectionSignature: resolvedSignature,
    selectedVideos: selectionSnapshot, // 선택된 동영상 정보 저장 (초기 메시지 없이)
    selectedVideoIds: selectedVideoIds // 채팅창별 선택된 동영상 ID 리스트 (기본적으로 빈 배열)
    // videoList 제거: 전역 리스트 사용
  };

  // 채팅 세션 개수 제한: 최대 개수를 초과하면 가장 오래된 채팅 삭제
  if (chatSessions.value.length >= MAX_CHAT_SESSIONS) {
    console.log(`[Search] 채팅 세션 개수 제한 (${MAX_CHAT_SESSIONS}개) 초과, 가장 오래된 채팅 삭제`);
    const oldestChat = chatSessions.value[0];
    
    // 삭제할 채팅의 클립 URL 수집 및 삭제
    if (oldestChat && oldestChat.messages) {
      const clipUrls = new Set();
      oldestChat.messages.forEach(message => {
        if (message.clips && Array.isArray(message.clips)) {
          message.clips.forEach(clip => {
            if (clip.url && !clip.via_response) {
              clipUrls.add(clip.url);
            }
          });
        }
        if (message.groupedClips && Array.isArray(message.groupedClips)) {
          message.groupedClips.forEach(group => {
            if (group.clips && Array.isArray(group.clips)) {
              group.clips.forEach(clip => {
                if (clip.url && !clip.via_response) {
                  clipUrls.add(clip.url);
                }
              });
            }
          });
        }
      });
      
      // 클립 삭제 요청 (비동기, 블로킹하지 않음)
      if (clipUrls.size > 0) {
        fetch(`${API_BASE_URL}/delete-clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clip_urls: Array.from(clipUrls) })
        }).catch(err => console.warn('오래된 채팅 클립 삭제 실패:', err));
      }
    }
    
    // 가장 오래된 채팅 삭제
    chatSessions.value.shift();
    
    // 현재 인덱스 조정
    if (currentChatIndex.value > 0) {
      currentChatIndex.value--;
    }
  }
  
  chatSessions.value.push(newChat);
  currentChatIndex.value = chatSessions.value.length - 1;

  // 전역 리스트는 유지하고, 선택 상태만 초기화
  selectedIds.value = [];

  // 최적화: 선택된 동영상만 파일 객체를 미리 로드 (검색 실행 시 지연 방지)
  // 모든 동영상을 로드하지 않고 선택된 동영상만 로드하여 성능 개선
  if (videoList.length > 0 && selectedVideos.value.length > 0) {
    const preloadSelectedVideoFiles = () => {
      const videosToPreload = selectedVideos.value.filter(video => {
        // File 객체가 없고 displayUrl이 있는 동영상만 로드
        return !(video.file instanceof File) && video.displayUrl && !video.displayUrl.startsWith('blob:');
      });
      
      if (videosToPreload.length > 0) {
        console.log(`[Search] 선택된 ${videosToPreload.length}개 동영상 파일 객체 미리 로드 시작`);
        // 배치 처리로 파일 객체 로드 (동시 요청 수 제한)
        processBatch(videosToPreload, ensureVideoFile, 3).then(results => {
          const successCount = results.filter(r => r !== null).length;
          console.log(`[Search] 선택된 동영상 파일 객체 미리 로드 완료: ${successCount}/${videosToPreload.length}개 성공`);
        }).catch(err => {
          console.warn('[Search] 선택된 동영상 파일 객체 미리 로드 중 오류:', err);
        });
      }
    };
    
    // nextTick을 사용하여 items.value가 업데이트된 후 파일 객체 로드
    nextTick(() => {
      preloadSelectedVideoFiles();
    });
  }

  nextTick(() => {
    scrollToBottom();
  });
}


function handleNewChatButtonClick() {
  // 현재 채팅의 동영상 리스트를 먼저 저장
  updateCurrentChatVideoList();
  
  // 새 채팅은 항상 빈 동영상 리스트로 시작
  const selectionSignature = 'none';
  
  // 입력창 초기화
  searchInput.value = '';
  
  // 빈 동영상 리스트로 새 채팅방 생성
  createNewChat([], selectionSignature);
  
  nextTick(() => {
    scrollToBottom();
  });
}

function handleClearChat() {
  // 현재 채팅 세션이 없으면 리턴
  if (chatSessions.value.length === 0) return;
  
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (!currentChat) return;
  
  // 메시지가 없으면 리턴
  if (!currentChat.messages || currentChat.messages.length === 0) return;
  
  // 확인 다이얼로그 표시
  const confirmMessage = settingStore.language === 'ko' 
    ? '채팅창의 모든 메시지를 삭제하시겠습니까?'
    : 'Are you sure you want to clear all messages in this chat?';
  
  if (!confirm(confirmMessage)) return;
  
  // 현재 채팅의 메시지만 초기화 (동영상 리스트와 선택 상태는 유지)
  currentChat.messages = [];
  
  // 상태 저장
  updateCurrentChatVideoList();
  autoSaveSearchState();
  
  // 스크롤을 맨 위로 이동
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = 0;
    }
  });
}

function startEditChatName(index) {
  editingChatIndex.value = index;
  editingChatName.value = chatSessions.value[index].name || `채팅 ${index + 1}`;
  nextTick(() => {
    const input = Array.isArray(chatNameInput.value) ? chatNameInput.value[0] : chatNameInput.value;
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function saveChatName(index) {
  if (editingChatIndex.value === index) {
    const trimmedName = editingChatName.value.trim();
    if (trimmedName) {
      chatSessions.value[index].name = trimmedName;
    } else {
      chatSessions.value[index].name = null;
    }
    editingChatIndex.value = null;
    editingChatName.value = '';
  }
}

function cancelEditChatName() {
  editingChatIndex.value = null;
  editingChatName.value = '';
}

async function switchChat(index) {
  if (index >= 0 && index < chatSessions.value.length) {
    // 현재 채팅의 선택 상태만 저장
    const currentChat = chatSessions.value[currentChatIndex.value];
    if (currentChat) {
      currentChat.selectedVideoIds = [...selectedIds.value];
    }

    // 전환할 채팅의 선택 상태만 복원
    const targetChat = chatSessions.value[index];
    if (targetChat) {
      // selectedVideoIds가 없으면 빈 배열로 초기화
      if (!targetChat.selectedVideoIds) {
        targetChat.selectedVideoIds = [];
      }
      // 전역 리스트는 유지하고, 선택 상태만 업데이트
      selectedIds.value = [...targetChat.selectedVideoIds];
    } else {
      selectedIds.value = [];
    }

    currentChatIndex.value = index;
    
    // 동영상이 있는 경우 썸네일 로딩만 대기 (File 객체는 필요할 때만 로드)
    if (items.value.length > 0) {
      // 로딩 모달 표시
      showVideosLoadingModal.value = true;
      
      try {
        await nextTick();
        
        // 썸네일 로딩 완료 대기 (이미지가 모두 로드될 때까지)
        // 타임아웃을 줄여서 빠르게 진행
        if (videoListGridRef.value) {
          const imageElements = videoListGridRef.value.querySelectorAll('img, video');
          if (imageElements.length > 0) {
            const imageLoadPromises = Array.from(imageElements).map(img => {
              return new Promise((resolve) => {
                if (img.complete || (img.tagName === 'VIDEO' && img.readyState >= 2)) {
                  resolve();
                } else {
                  img.onload = resolve;
                  img.onerror = resolve; // 에러가 나도 진행
                  // 타임아웃 설정 (1초 후 강제 진행 - 성능 개선)
                  setTimeout(resolve, 1000);
                }
              });
            });
            // 일부만 로드되어도 진행 (전체 대기하지 않음)
            await Promise.race([
              Promise.all(imageLoadPromises),
              new Promise(resolve => setTimeout(resolve, 1500))
            ]);
          }
        }
      } catch (error) {
        console.error('[Search] switchChat 중 오류:', error);
      } finally {
        // 로딩 모달 숨김
        showVideosLoadingModal.value = false;
      }
    }
    
    nextTick(() => {
      scrollToBottom();
    });
  }
}

async function deleteChat(index) {
  if (chatSessions.value.length <= 1) return; // 마지막 채팅창은 삭제 불가

  const chatToDelete = chatSessions.value[index];
  
  // 삭제할 채팅방의 모든 클립 URL 수집 (clips와 groupedClips 모두 포함)
  const clipUrls = new Set(); // 중복 제거를 위해 Set 사용
  if (chatToDelete.messages) {
    chatToDelete.messages.forEach(message => {
      // message.clips에서 클립 URL 수집
      if (message.clips && Array.isArray(message.clips)) {
        message.clips.forEach(clip => {
          if (clip.url && !clip.via_response) {
            clipUrls.add(clip.url);
          }
        });
      }
      
      // message.groupedClips에서 클립 URL 수집
      if (message.groupedClips && Array.isArray(message.groupedClips)) {
        message.groupedClips.forEach(group => {
          if (group.clips && Array.isArray(group.clips)) {
            group.clips.forEach(clip => {
              if (clip.url && !clip.via_response) {
                clipUrls.add(clip.url);
              }
            });
          }
        });
      }
    });
  }
  
  // 클립이 있으면 삭제 요청
  if (clipUrls.size > 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clip_urls: Array.from(clipUrls) })
      });
      
      if (!response.ok) {
        console.warn('클립 삭제 실패:', response.status);
      }
    } catch (error) {
      console.warn('클립 삭제 중 오류:', error);
    }
  }
  
  // 채팅 세션 삭제
  chatSessions.value.splice(index, 1);
  
  // 현재 인덱스 조정
  if (currentChatIndex.value >= index) {
    currentChatIndex.value = Math.max(0, currentChatIndex.value - 1);
  }
  
  // 마지막 채팅이 삭제되면 인덱스 조정
  if (currentChatIndex.value >= chatSessions.value.length) {
    currentChatIndex.value = chatSessions.value.length - 1;
  }
  
  // 삭제 후 현재 채팅의 선택 상태만 복원
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (currentChat) {
    // 전역 리스트는 유지하고, 선택 상태만 복원
    selectedIds.value = currentChat.selectedVideoIds ? [...currentChat.selectedVideoIds] : [];
  } else {
    selectedIds.value = [];
  }
  
}

// 컨텍스트 메뉴 함수
function openChatMessageContextMenu(messageIndex, e) {
  e.preventDefault();
  e.stopPropagation();
  closeVideoListContextMenu();
  
  // 같은 메시지의 컨텍스트 메뉴가 이미 열려있으면 닫기
  if (chatMessageContextMenu.value.visible && chatMessageContextMenu.value.messageIndex === messageIndex) {
    closeChatMessageContextMenu();
    return;
  }
  
  // 다른 메뉴들에게 채팅 메시지 컨텍스트 메뉴가 열릴 예정임을 알림
  window.dispatchEvent(new CustomEvent('chat-message-context-menu-opened'));
  
  const { x, y } = constrainContextMenuPosition(e.clientX, e.clientY);
  chatMessageContextMenu.value = { visible: true, messageIndex, x, y };
}

function closeChatMessageContextMenu() {
  chatMessageContextMenu.value.visible = false;
  chatMessageContextMenu.value.messageIndex = null;
  reportSubmenu.value.visible = false;
  reportSubmenu.value.messageIndex = null;
  reportListSubmenu.value.visible = false;
  reportListSubmenu.value.messageIndex = null;
  reportListSubmenu.value.reports = [];
}

function copyChatMessage(messageIndex) {
  if (messageIndex === null || messageIndex === undefined) return;
  
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (!currentChat || !currentChat.messages || !currentChat.messages[messageIndex]) return;
  
  const message = currentChat.messages[messageIndex];
  // HTML 태그 제거하고 텍스트만 추출
  const textContent = message.content.replace(/<[^>]*>/g, '').trim();
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(textContent).then(() => {
      // 복사 성공 알림 (선택사항)
      console.log('메시지가 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    });
  } else {
    // 클립보드 API를 사용할 수 없는 경우 대체 방법
    const textArea = document.createElement('textarea');
    textArea.value = textContent;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      console.log('메시지가 클립보드에 복사되었습니다.');
    } catch (err) {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    }
    document.body.removeChild(textArea);
  }
  
  closeChatMessageContextMenu();
}

function deleteChatMessage(messageIndex) {
  if (messageIndex === null || messageIndex === undefined) return;
  
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (!currentChat || !currentChat.messages || !currentChat.messages[messageIndex]) return;
  
  // 초기 메시지는 삭제하지 않음
  if (currentChat.messages[messageIndex].isInitial) {
    alert(settingStore.language === 'ko' ? '초기 메시지는 삭제할 수 없습니다.' : 'Initial message cannot be deleted.');
    closeChatMessageContextMenu();
    return;
  }
  
  // 삭제 확인
  if (confirm(settingStore.language === 'ko' ? '이 메시지를 삭제하시겠습니까?' : 'Do you want to delete this message?')) {
    currentChat.messages.splice(messageIndex, 1);
    closeChatMessageContextMenu();
    // 상태 저장
    updateCurrentChatVideoList();
    autoSaveSearchState();
  }
}

function closeVideoListContextMenu() {
  videoListContextMenu.value = { visible: false, x: 0, y: 0, video: null };
}

function openVideoListContextMenu(video, event) {
  event.preventDefault();
  event.stopPropagation();
  closeChatTabContextMenu();
  closeChatMessageContextMenu();
  window.dispatchEvent(new CustomEvent('video-context-menu-opened'));
  const { x, y } = constrainContextMenuPosition(event.clientX, event.clientY);
  videoListContextMenu.value = { visible: true, x, y, video };
}

function openVideoDetailFromContextMenu() {
  const v = videoListContextMenu.value.video;
  closeVideoListContextMenu();
  if (v) {
    videoDetailTarget.value = v;
    showVideoDetailModal.value = true;
  }
}

function closeVideoDetailModal() {
  showVideoDetailModal.value = false;
  videoDetailTarget.value = null;
}

/** Video list 썸네일: 실제 해상도 비율(메타데이터 로드 후). 로드 전에는 16:9 플레이스홀더 */
function getVideoListThumbAspectStyle(video) {
  const w = video._thumbWidth;
  const h = video._thumbHeight;
  if (w && h && w > 0 && h > 0) {
    return { aspectRatio: `${w} / ${h}` };
  }
  return { aspectRatio: '16 / 9' };
}

function onVideoListVideoMetadata(e, video) {
  const el = e.target;
  if (!el) return;
  if (isFinite(el.duration) && el.duration > 0 && !video.duration) {
    video.duration = el.duration;
  }
  if (el.videoWidth > 0 && el.videoHeight > 0) {
    video._thumbWidth = el.videoWidth;
    video._thumbHeight = el.videoHeight;
  }
}

function onVideoListImageLoad(e, video) {
  const img = e.target;
  if (!img?.naturalWidth || !img.naturalHeight) return;
  video._thumbWidth = img.naturalWidth;
  video._thumbHeight = img.naturalHeight;
}

function formatVideoDetailDuration(video) {
  if (!video) return '—';
  if (video.duration && isFinite(video.duration) && video.duration > 0) {
    return formatDuration(video.duration);
  }
  return (translations[settingStore.language] || translations.ko).durationUnknown;
}

// 컨텍스트 메뉴 밖 클릭 시 닫기
function handleClickOutsideContextMenu(event) {
  // 우클릭 이벤트는 무시
  if (event.button === 2 || event.which === 3) return;
  
  const clickedElement = event.target;
  
  if (videoListContextMenu.value.visible) {
    if (!clickedElement.closest('.video-list-context-menu')) {
      closeVideoListContextMenu();
    }
  }
  
  if (!chatMessageContextMenu.value.visible) return;
  
  const contextMenuElement = clickedElement.closest('.context-menu-container');
  if (!contextMenuElement) {
    closeChatMessageContextMenu();
  }
}

// ==================== 보고서 생성 관련 함수 ====================
let submenuTimeout = null;

function showReportSubmenu(messageIndex, parentX, parentY) {
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
  
  const buttonHeight = 40;
  const submenuWidth = 180;
  const margin = 10;
  
  let submenuX = parentX + 160 + 4;
  let submenuY = parentY + buttonHeight;
  
  if (submenuX + submenuWidth + margin > window.innerWidth) {
    submenuX = parentX - submenuWidth - 4;
    if (submenuX < margin) {
      submenuX = (window.innerWidth - submenuWidth) / 2;
    }
  }
  
  const submenuHeight = 80;
  const availableHeight = window.innerHeight - submenuY - margin;
  if (availableHeight < submenuHeight) {
    submenuY = Math.max(margin, window.innerHeight - submenuHeight - margin);
  }
  
  reportSubmenu.value = {
    visible: true,
    messageIndex: messageIndex,
    x: submenuX,
    y: submenuY
  };
}

function keepReportSubmenuVisible() {
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
}

function hideReportSubmenu() {
  submenuTimeout = setTimeout(() => {
    reportSubmenu.value.visible = false;
    submenuTimeout = null;
  }, 200);
}

let reportListSubmenuTimeout = null;

async function showReportListSubmenu(messageIndex, parentX, parentY) {
  if (reportListSubmenuTimeout) {
    clearTimeout(reportListSubmenuTimeout);
    reportListSubmenuTimeout = null;
  }
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/reports?user_id=${userId}&page=1&page_size=50`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.reports && data.reports.length > 0) {
        const reportListWidth = 250;
        const reportListMaxHeight = 400;
        const margin = 10;
        
        let submenuX = parentX + 180 + 4;
        let submenuY = parentY;
        
        if (submenuX + reportListWidth + margin > window.innerWidth) {
          submenuX = parentX - reportListWidth - 4;
          if (submenuX < margin) {
            submenuX = (window.innerWidth - reportListWidth) / 2;
          }
        }
        
        const availableHeight = window.innerHeight - submenuY - margin;
        if (availableHeight < reportListMaxHeight) {
          submenuY = Math.max(margin, window.innerHeight - reportListMaxHeight - margin);
        }
        
        reportListSubmenu.value = {
          visible: true,
          messageIndex: messageIndex,
          x: submenuX,
          y: submenuY,
          reports: data.reports.map(r => ({
            id: r.id || r.report_id,
            title: r.title,
            description: r.description || ''
          }))
        };
      } else {
        alert(settingStore.language === 'ko'
          ? '추가할 기존 보고서가 없습니다. 새 보고서를 생성해주세요.'
          : 'No existing reports found. Please create a new report.');
      }
    } else {
      throw new Error('보고서 목록을 가져올 수 없습니다.');
    }
  } catch (error) {
    console.error('보고서 목록 로드 실패:', error);
    alert(settingStore.language === 'ko'
      ? '보고서 목록을 불러오는 중 오류가 발생했습니다.'
      : 'An error occurred while loading the report list.');
  }
}

function keepReportListSubmenuVisible() {
  if (reportListSubmenuTimeout) {
    clearTimeout(reportListSubmenuTimeout);
    reportListSubmenuTimeout = null;
  }
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
}

function hideReportListSubmenu() {
  reportListSubmenuTimeout = setTimeout(() => {
    reportListSubmenu.value.visible = false;
    reportListSubmenuTimeout = null;
    hideReportSubmenu();
  }, 200);
}

function collectClipsData(messageIndex) {
  if (messageIndex === null || messageIndex === undefined) return null;
  
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (!currentChat || !currentChat.messages || !currentChat.messages[messageIndex]) return null;
  
  const message = currentChat.messages[messageIndex];
  
  if (message.role !== 'assistant' || !message.clips || message.clips.length === 0) {
    alert(settingStore.language === 'ko' 
      ? '보고서를 생성할 수 있는 클립이 없습니다.' 
      : 'No clips available to create a report.');
    return null;
  }
  
  let userQuery = '';
  for (let i = messageIndex - 1; i >= 0; i--) {
    const prevMessage = currentChat.messages[i];
    if (prevMessage && prevMessage.role === 'user') {
      userQuery = prevMessage.content.replace(/<[^>]*>/g, '').trim();
      break;
    }
  }
  
  return {
    clips: message.clips.map(clip => ({
      id: clip.id,
      title: clip.title || '',
      url: clip.url || '',
      sentence: clip.sentence || '',
      start_time: clip.start_time,
      end_time: clip.end_time,
      sourceVideo: clip.sourceVideo || clip.date || ''
    })),
    query: userQuery
  };
}

function generateReportTitle() {
  const now = new Date();
  const dateStr = now.toLocaleDateString(settingStore.language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return settingStore.language === 'ko' 
    ? `검색 결과 보고서 - ${dateStr}`
    : `Search Results Report - ${dateStr}`;
}

async function addClipsToSelectedReport(reportId, messageIndex) {
  closeChatMessageContextMenu();
  
  const reportData = collectClipsData(messageIndex);
  if (!reportData) return;
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  isCreatingReport.value = true;
  reportSuccess.value = false;
  reportLoadingMessage.value = settingStore.language === 'ko' 
    ? '보고서에 클립을 추가하는 중입니다...' 
    : 'Adding clips to report...';
  reportSuccessMessage.value = '';
  
  try {
    const response = await fetch(`${API_BASE_URL}/reports/${reportId}/add-clips`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        clips: reportData.clips
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        let message = settingStore.language === 'ko' 
          ? `${data.added_count || reportData.clips.length}개의 클립이 보고서에 추가되었습니다.` 
          : `${data.added_count || reportData.clips.length} clips have been added to the report.`;
        
        if (data.duplicate_count && data.duplicate_count > 0) {
          message += settingStore.language === 'ko'
            ? ` (${data.duplicate_count}개의 중복 클립은 제외되었습니다)`
            : ` (${data.duplicate_count} duplicate clips were excluded)`;
        }
        
        message += settingStore.language === 'ko'
          ? ' 리포트 메뉴에서 확인할 수 있습니다.'
          : ' You can view it in the Report menu.';
        
        reportSuccess.value = true;
        reportSuccessMessage.value = message;
        
        setTimeout(() => {
          isCreatingReport.value = false;
          reportSuccess.value = false;
          reportLoadingMessage.value = '';
          reportSuccessMessage.value = '';
        }, 3000);
      } else {
        if (data.message && data.message.includes('추가할 수 있는 새로운 클립이 없습니다')) {
          reportSuccess.value = true;
          reportSuccessMessage.value = settingStore.language === 'ko'
            ? '모든 클립이 이미 보고서에 포함되어 있습니다.'
            : 'All clips are already included in the report.';
          
          setTimeout(() => {
            isCreatingReport.value = false;
            reportSuccess.value = false;
            reportLoadingMessage.value = '';
            reportSuccessMessage.value = '';
          }, 3000);
          return;
        }
        throw new Error(data.message || '보고서에 클립 추가 실패');
      }
    } else {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || '보고서에 클립 추가 실패');
    }
  } catch (error) {
    console.error('보고서에 클립 추가 중 오류:', error);
    reportSuccess.value = false;
    reportLoadingMessage.value = settingStore.language === 'ko' 
      ? `오류: ${error.message}` 
      : `Error: ${error.message}`;
    
    setTimeout(() => {
      isCreatingReport.value = false;
      reportSuccess.value = false;
      reportLoadingMessage.value = '';
      reportSuccessMessage.value = '';
    }, 3000);
  }
}

function createNewReport(messageIndex) {
  closeChatMessageContextMenu();
  
  const reportData = collectClipsData(messageIndex);
  if (!reportData) return;
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  pendingReportData.value = { reportData, userId };
  reportTitleInput.value = generateReportTitle();
  showReportTitleModal.value = true;
}

// 디바운스된 제목 확인 함수
function checkReportTitle() {
  // 이전 타이머가 있으면 취소
  if (titleCheckDebounceTimer.value) {
    clearTimeout(titleCheckDebounceTimer.value);
  }
  
  // 500ms 후에 실제 API 호출
  titleCheckDebounceTimer.value = setTimeout(async () => {
    const title = reportTitleInput.value.trim();
    reportTitleError.value = '';
    
    if (!title) {
      return;
    }
    
    if (!pendingReportData.value) return;
    
    const { userId } = pendingReportData.value;
    
    isCheckingTitle.value = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/reports/check-title?user_id=${encodeURIComponent(userId)}&title=${encodeURIComponent(title)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          reportTitleError.value = settingStore.language === 'ko' 
            ? '이미 존재하는 보고서 제목입니다.' 
            : 'This report title already exists.';
        }
      }
    } catch (error) {
      console.error('보고서 제목 확인 중 오류:', error);
    } finally {
      isCheckingTitle.value = false;
    }
  }, 500); // 500ms 디바운스
}

async function confirmReportTitle() {
  if (!reportTitleInput.value.trim()) return;
  
  if (reportTitleError.value) return;
  
  if (!pendingReportData.value) return;
  
  const { reportData, userId } = pendingReportData.value;
  const reportTitle = reportTitleInput.value.trim();
  const reportAuthor = reportAuthorInput.value.trim() || userId; // 작성자가 없으면 user_id 사용
  
  showReportTitleModal.value = false;
  reportTitleError.value = '';
  reportAuthorInput.value = '';
  pendingReportData.value = null;
  
  isCreatingReport.value = true;
  reportSuccess.value = false;
  reportLoadingMessage.value = settingStore.language === 'ko' 
    ? '보고서를 생성하는 중입니다...' 
    : 'Creating report...';
  reportSuccessMessage.value = '';
  
  try {
    const response = await fetch(`${API_BASE_URL}/reports/create-word`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        title: reportTitle,
        author: reportAuthor,
        description: settingStore.language === 'ko' 
          ? `${reportData.clips.length}개의 클립 검색 결과`
          : `Search results for ${reportData.clips.length} clips`,
        query: reportData.query,
        clips: reportData.clips
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        const message = settingStore.language === 'ko' 
          ? '보고서가 성공적으로 생성되었습니다. 리포트 메뉴에서 확인할 수 있습니다.' 
          : 'Report created successfully. You can view it in the Report menu.';
        
        reportSuccess.value = true;
        reportSuccessMessage.value = message;
        
        setTimeout(() => {
          isCreatingReport.value = false;
          reportSuccess.value = false;
          reportLoadingMessage.value = '';
          reportSuccessMessage.value = '';
        }, 3000);
      } else {
        throw new Error(data.message || '보고서 생성 실패');
      }
    } else {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || '보고서 생성 실패');
    }
  } catch (error) {
    console.error('보고서 생성 중 오류:', error);
    reportSuccess.value = false;
    reportLoadingMessage.value = settingStore.language === 'ko' 
      ? `오류: ${error.message}` 
      : `Error: ${error.message}`;
    
    setTimeout(() => {
      isCreatingReport.value = false;
      reportSuccess.value = false;
      reportLoadingMessage.value = '';
      reportSuccessMessage.value = '';
    }, 3000);
  }
}

function closeReportTitleModal() {
  showReportTitleModal.value = false;
  reportTitleInput.value = '';
  reportAuthorInput.value = '';
  reportTitleError.value = '';
  pendingReportData.value = null;
}

function closeReportModal() {
  if (reportSuccess.value) {
    isCreatingReport.value = false;
    reportSuccess.value = false;
    reportLoadingMessage.value = '';
    reportSuccessMessage.value = '';
  }
}

function openChatTabContextMenu(chatIndex, event) {
  event.preventDefault();
  event.stopPropagation();
  closeVideoListContextMenu();
  chatTabContextMenu.value = {
    visible: true,
    chatIndex: chatIndex,
    x: event.clientX,
    y: event.clientY
  };
}

function closeChatTabContextMenu() {
  chatTabContextMenu.value = {
    visible: false,
    chatIndex: null,
    x: 0,
    y: 0
  };
}

async function closeChatTab(chatIndex) {
  closeChatTabContextMenu();
  if (chatIndex !== null && chatIndex >= 0 && chatIndex < chatSessions.value.length) {
    await deleteChat(chatIndex);
  }
}

// 다른 탭 닫기 (현재 선택된 탭 제외)
async function closeOtherChatTabs(currentIndex) {
  closeChatTabContextMenu();
  
  if (chatSessions.value.length <= 1) return;
  
  // 현재 탭을 제외한 모든 탭의 인덱스를 역순으로 수집 (뒤에서부터 삭제하여 인덱스 변경 문제 방지)
  const indicesToDelete = [];
  for (let i = chatSessions.value.length - 1; i >= 0; i--) {
    if (i !== currentIndex) {
      indicesToDelete.push(i);
    }
  }
  
  // 각 탭을 삭제
  for (const index of indicesToDelete) {
    await deleteChat(index);
  }
  
  // 현재 탭으로 전환
  if (currentIndex >= 0 && currentIndex < chatSessions.value.length) {
    switchChat(currentIndex);
  }
}

// 모든 탭 닫기 (빈 채팅 하나만 남기기)
async function closeAllChatTabs() {
  closeChatTabContextMenu();
  
  if (chatSessions.value.length === 0) return;
  
  // 모든 탭의 클립 URL 수집
  const allClipUrls = new Set();
  chatSessions.value.forEach(chat => {
    if (chat.messages) {
      chat.messages.forEach(message => {
        if (message.clips && Array.isArray(message.clips)) {
          message.clips.forEach(clip => {
            if (clip.url && !clip.via_response) {
              allClipUrls.add(clip.url);
            }
          });
        }
        if (message.groupedClips && Array.isArray(message.groupedClips)) {
          message.groupedClips.forEach(group => {
            if (group.clips && Array.isArray(group.clips)) {
              group.clips.forEach(clip => {
                if (clip.url && !clip.via_response) {
                  allClipUrls.add(clip.url);
                }
              });
            }
          });
        }
      });
    }
  });
  
  // 클립 삭제 요청
  if (allClipUrls.size > 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clip_urls: Array.from(allClipUrls) })
      });
      
      if (!response.ok) {
        console.warn('클립 삭제 실패:', response.status);
      }
    } catch (error) {
      console.warn('클립 삭제 중 오류:', error);
    }
  }
  
  // 모든 채팅 세션 삭제
  chatSessions.value = [];
  
  // 빈 채팅 하나 생성
  createNewChat([], 'none');
  
  // 입력창 초기화
  searchInput.value = '';
}

function closeSearchSettingModal() {
  showSearchSettingModal.value = false;
}

function handleModalBackgroundClick(event, closeFunction) {
  // 배경이 아닌 내부 컨텐츠를 클릭한 경우 무시
  if (event.target !== event.currentTarget) {
    return;
  }
  
  // mousedown 위치 저장
  if (event.type === 'mousedown') {
    modalMouseDownPos = { x: event.clientX, y: event.clientY };
    return;
  }
  
  // mouseup에서 위치 비교
  if (event.type === 'mouseup' && modalMouseDownPos) {
    const distance = Math.sqrt(
      Math.pow(event.clientX - modalMouseDownPos.x, 2) + 
      Math.pow(event.clientY - modalMouseDownPos.y, 2)
    );
    // 5픽셀 이내에서만 클릭으로 간주 (드래그가 아닌 경우)
    if (distance < 5) {
      closeFunction();
    }
    modalMouseDownPos = null;
  }
}

// 공통 검색 파라미터 값 범위 제한 함수
function clampSearchValue(paramName, maxValue, minValue = null) {
  const currentValue = settingStore[paramName];
  if (currentValue > maxValue) {
    settingStore[paramName] = maxValue;
  } else if (minValue !== null && currentValue < minValue) {
    settingStore[paramName] = minValue;
  }
}

// 공통 검색 파라미터 리셋 함수들
function resetSearchTopP() {
  settingStore.searchTopP = 1.0;
}

function resetSearchTemperature() {
  settingStore.searchTemperature = 0.3;
}

function resetSearchMaxTokens() {
  settingStore.searchMaxTokens = 1024;
}

function clampBoxThreshold() {
  if (boxThreshold.value > 0.9) {
    boxThreshold.value = 0.9;
  } else if (boxThreshold.value < 0.1) {
    boxThreshold.value = 0.1;
  }
}

function resetBoxThreshold() {
  boxThreshold.value = 0.5;
}

function clampFrameSkip() {
  if (frameSkip.value > 60) {
    frameSkip.value = 60;
  } else if (frameSkip.value < 1) {
    frameSkip.value = 1;
  }
}

function resetFrameSkip() {
  frameSkip.value = 5;
}

function clampObjectDetectionThreshold() {
  if (objectDetectionThreshold.value > 100) {
    objectDetectionThreshold.value = 100;
  } else if (objectDetectionThreshold.value < 1) {
    objectDetectionThreshold.value = 1;
  }
}

function resetObjectDetectionThreshold() {
  objectDetectionThreshold.value = 1;
}


// Summarize 전용 파라미터 값 범위 제한 함수
function clampSummarizeValue(paramName, maxValue, minValue = null) {
  const currentValue = settingStore[paramName];
  if (currentValue > maxValue) {
    settingStore[paramName] = maxValue;
  } else if (minValue !== null && currentValue < minValue) {
    settingStore[paramName] = minValue;
  }
}

function resetSummarizeSummarizeTopP() {
  settingStore.summarizeSummarizeTopP = 0.7;
}

function resetSummarizeSummarizeTemperature() {
  settingStore.summarizeSummarizeTemperature = 0.2;
}

function resetSummarizeSummarizeMaxTokens() {
  settingStore.summarizeSummarizeMaxTokens = 2048;
}

function resetSummarizeChatTopP() {
  settingStore.summarizeChatTopP = 0.7;
}

function resetSummarizeChatTemperature() {
  settingStore.summarizeChatTemperature = 0.2;
}

function resetSummarizeChatMaxTokens() {
  settingStore.summarizeChatMaxTokens = 2048;
}

function resetSummarizeNotificationTopP() {
  settingStore.summarizeNotificationTopP = 0.7;
}

function resetSummarizeNotificationTemperature() {
  settingStore.summarizeNotificationTemperature = 0.2;
}

function resetSummarizeNotificationMaxTokens() {
  settingStore.summarizeNotificationMaxTokens = 2048;
}

// 이미지 업로드 핸들러
function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // 이미지 파일인지 확인
  if (!file.type.startsWith('image/')) {
    alert(settingStore.language === 'ko' 
      ? '이미지 파일만 업로드할 수 있습니다.' 
      : 'Only image files can be uploaded.');
    return;
  }
  
  // 파일 크기 제한 (10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    alert(settingStore.language === 'ko' 
      ? '이미지 크기는 10MB를 초과할 수 없습니다.' 
      : 'Image size cannot exceed 10MB.');
    return;
  }
  
  // 이미지 파일 저장
  uploadedImage.value = file;
  
  // 미리보기 생성
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImagePreview.value = e.target?.result;
  };
  reader.readAsDataURL(file);
  
  // input 초기화 (같은 파일을 다시 선택할 수 있도록)
  event.target.value = '';
}

// 업로드된 이미지 제거
function removeUploadedImage() {
  uploadedImage.value = null;
  uploadedImagePreview.value = null;
}

// 동영상 파일 수집 함수
// ==================== 파일 관리 ====================

/**
 * 비디오 URL에서 File 객체 생성
 * @param {Object} video - 비디오 객체
 * @returns {Promise<File|null>} File 객체 또는 null
 */
/**
 * 동시 요청 수를 제한하여 배치로 처리하는 함수
 * @param {Array} items - 처리할 항목 배열
 * @param {Function} processor - 각 항목을 처리하는 함수
 * @param {number} batchSize - 한 번에 처리할 항목 수 (기본값: 3)
 * @returns {Promise<Array>} 처리 결과 배열
 */
async function processBatch(items, processor, batchSize = 3) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(item => processor(item)));
    results.push(...batchResults);
    // 배치 간 짧은 지연 (네트워크 부하 분산)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  return results;
}

async function ensureVideoFile(video) {
  // 최적화: 이미 File 객체가 있으면 fetch를 건너뛰기
  if (video.file instanceof File) {
    // Store에도 저장 (다른 메뉴에서 재사용)
    videoFileStore.setFileByVideo(video, video.file);
    return video.file;
  }

  if (!video || !video.displayUrl) {
    return null;
  }

  // Store에서 먼저 확인 (다른 메뉴에서 이미 로드한 경우)
  const cachedFile = videoFileStore.getFileByVideo(video);
  if (cachedFile instanceof File) {
    video.file = cachedFile;
    return cachedFile;
  }

  // blob URL의 경우 fetch를 수행하지 않음 (반복 요청 방지)
  if (video.displayUrl.startsWith('blob:')) {
    // blob URL인 경우 이미 file 객체가 있어야 하므로 null 반환
    return null;
  }

  const abortController = createAbortController();
  
  try {
    const encodedUrl = encodeVideoUrl(video.displayUrl);
    const response = await fetch(encodedUrl, {
      signal: abortController.signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch video blob (${response.status})`);
    }
    const blob = await response.blob();
    const filename = video.title || `video-${video.id}.mp4`;
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    video.file = file;
    // Store에 저장 (다른 메뉴에서 재사용)
    videoFileStore.setFileByVideo(video, file);
    return file;
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }
    console.error('Failed to reconstruct File from video URL:', error);
    return null;
  } finally {
    removeAbortController(abortController);
  }
}

/**
 * 선택된 비디오들의 File 객체 수집
 * 최적화: 이미 File 객체가 있는 경우만 수집 (fetch 최소화)
 * @param {Array} videos - 수집할 비디오 배열 (기본값: selectedVideos.value)
 * @returns {Promise<Array>} { file, video } 배열
 */
async function collectSelectedFiles(videos = null) {
  const targetVideos = videos || selectedVideos.value;
  const results = [];
  
  const videosWithoutFile = [];
  
  for (const video of targetVideos) {
    if (video.file instanceof File) {
      // 이미 File 객체가 있으면 즉시 추가
      results.push({ file: video.file, video });
    } else {
      // File 객체가 없는 비디오는 별도로 수집
      videosWithoutFile.push(video);
    }
  }
  
  // 최적화: File 객체가 없는 비디오들을 병렬로 fetch (순차 처리 → 병렬 처리)
  if (videosWithoutFile.length > 0) {
    const filePromises = videosWithoutFile.map(async (video) => {
      const file = await ensureVideoFile(video);
      return file ? { file, video } : null;
    });
    
    const fetchedFiles = await Promise.all(filePromises);
    fetchedFiles.forEach(item => {
      if (item) {
        results.push(item);
      }
    });
  }
  
  return results;
}

// ==================== 검색 기능 ====================

/**
 * 검색 실행
 */
async function handleSearch() {
  // 검색 실행 시마다 현재 검색 파라미터 값 로그 출력
  const safeNum = (val, fallback) => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };
  
  const currentSearchParams = {
    searchChunk: safeNum(settingStore.searchChunk, 10),
    searchTopK: safeNum(settingStore.searchTopK, 50),
    searchTopP: safeNum(settingStore.searchTopP, 1.0),
    searchTemperature: safeNum(settingStore.searchTemperature, 0.4),
    searchMaxTokens: safeNum(settingStore.searchMaxTokens, 1024),
    searchSeed: safeNum(settingStore.searchSeed, 1),
    searchType: searchType.value
  };
  
  console.log('[Search] 검색 실행 - 현재 검색 파라미터:', currentSearchParams);
  console.log('[Search] settingStore 원본 값:', {
    searchChunk: settingStore.searchChunk,
    searchTopK: settingStore.searchTopK,
    searchTopP: settingStore.searchTopP,
    searchTemperature: settingStore.searchTemperature,
    searchMaxTokens: settingStore.searchMaxTokens,
    searchSeed: settingStore.searchSeed
  });
  
  // 고속 검색이 아닐 때만 query 체크
  if (searchType.value !== 'fast') {
    const query = searchInput.value.trim();
    if (!query || isSearching.value) return;
  } else {
    // 고속 검색일 때는 검색 중이거나 채팅 세션이 없으면 return
    if (isSearching.value) return;
  }
  
  if (chatSessions.value.length === 0) return;
  
  // 동영상이 선택되지 않은 경우 차단
  if (selectedVideos.value.length === 0) {
    const currentChat = chatSessions.value[currentChatIndex.value];
    if (currentChat) {
      currentChat.messages.push({
        role: 'assistant',
        content: settingStore.language === 'ko' 
          ? '검색하려면 먼저 동영상을 선택해주세요.' 
          : 'Please select at least one video to search.',
        timestamp: getCurrentTime()
      });
      scrollToBottom();
    }
    return;
  }

  const currentChat = chatSessions.value[currentChatIndex.value];

  // 검색어를 미리 저장 (searchInput.value를 비우기 전에)
  const savedQuery = searchType.value !== 'fast' ? searchInput.value.trim() : '';

  // 성능 최적화: 검색 시작 플래그를 먼저 설정하여 watch가 트리거되지 않도록 함
  // 이렇게 하면 메시지 추가 시 save-search-state 요청이 발생하지 않음
  isSearching.value = true;

  // 고속 검색이 아닐 때만 사용자 메시지 추가
  if (searchType.value !== 'fast') {
    let messageContent = savedQuery;
    
    // 이미지가 업로드된 경우 메시지에 이미지 정보 추가
    if (uploadedImage.value) {
      messageContent += settingStore.language === 'ko' 
        ? `\n[이미지 업로드됨: ${uploadedImage.value.name}]` 
        : `\n[Image uploaded: ${uploadedImage.value.name}]`;
    }
    
    currentChat.messages.push({
      content: messageContent,
      role: "user",
      timestamp: getCurrentTime(),
      uploadedImage: uploadedImage.value ? {
        name: uploadedImage.value.name,
        preview: uploadedImagePreview.value
      } : null
    });
    // 메시지 추가 후 오래된 메시지 정리
    cleanupOldMessages(currentChatIndex.value);
    searchInput.value = '';
  } else {
    // 고속 검색일 때는 검색 시작 메시지 추가
    currentChat.messages.push({
      content: settingStore.language === 'ko' 
        ? `고속 검색 시작: ${searchObject.value.trim()}` 
        : `Fast search started: ${searchObject.value.trim()}`,
      role: "user",
      timestamp: getCurrentTime()
    });
    // 메시지 추가 후 오래된 메시지 정리
    cleanupOldMessages(currentChatIndex.value);
  }

  scrollToBottom();

  try {
    // 최적화: 파일 객체가 이미 모두 로드되어 있는지 확인
    // 모두 로드되어 있으면 동기적으로 처리 (collectSelectedFiles 호출 불필요)
    const allFilesLoaded = selectedVideos.value.every(v => v.file instanceof File);
    let fileEntries;
    
    if (allFilesLoaded) {
      // 모든 파일 객체가 이미 로드되어 있으면 동기적으로 변환
      console.log('[Search] 모든 파일 객체가 이미 로드됨, 동기 처리');
      fileEntries = selectedVideos.value.map(video => ({
        file: video.file,
        video: video
      }));
    } else {
      // 일부 파일 객체가 없으면 collectSelectedFiles 호출 (비동기)
      // 하지만 이미 로드 중인 파일이 있으면 기다리지 않고 진행
      console.log('[Search] 일부 파일 객체가 없음, 비동기 로드');
      
      // 빠른 타임아웃으로 일부만 로드되어도 진행 (성능 개선)
      const loadPromise = collectSelectedFiles();
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          // 타임아웃 시 현재까지 로드된 파일만 사용
          const loadedFiles = selectedVideos.value
            .filter(v => v.file instanceof File)
            .map(video => ({ file: video.file, video }));
          resolve(loadedFiles);
        }, 2000); // 2초 타임아웃
      });
      
      fileEntries = await Promise.race([loadPromise, timeoutPromise]);
      
      if (fileEntries.length === 0) {
        currentChat.messages.push({
          role: 'assistant',
          content: settingStore.language === 'ko' ? '선택된 동영상을 가져오지 못했습니다. 다시 시도해주세요.' : 'Failed to load selected videos. Please try again.',
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        scrollToBottom();
        return;
      }
    }

    const userId = localStorage.getItem("vss_user_id");

    const abortController = createAbortController();

    // 상세 검색: 요약 상태 확인 후 Summarize와 Query 분리 처리
    if (searchType.value === 'detailed') {
      // 저장된 검색어 사용 (searchInput.value는 이미 비워졌을 수 있음)
      const query = savedQuery || searchInput.value.trim();
      
      // 검색어에 "찾아"가 없으면 일반 Query만 사용 (클립 생성 없음)
      const hasFindKeyword = query.includes('찾아') || query.includes('찾아주세요') || query.includes('찾아줘');
      
      if (!hasFindKeyword) {
        console.log('[Search] "찾아" 키워드 없음 - 일반 Query만 사용 (클립 생성 없음)');
        
        // 일반 Query만 실행 (vss-query 엔드포인트 사용)
        const firstVideo = fileEntries[0]?.video;
        if (!firstVideo) {
          currentChat.messages.push({
            role: 'assistant',
            content: settingStore.language === 'ko' 
              ? '동영상을 선택해주세요.' 
              : 'Please select a video.',
            timestamp: getCurrentTime()
          });
          isSearching.value = false;
          scrollToBottom();
          return;
        }

        // DB에서 VIA 서버의 video_id 조회 (최적화: video_id가 이미 있으면 서버 조회 생략)
        let serverVideoIdForQuery = firstVideo.videoId || null;
        if (!serverVideoIdForQuery && userId && firstVideo.dbId) {
          try {
            const videosResponse = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
            if (videosResponse.ok) {
              const videosData = await videosResponse.json();
              if (videosData.success && videosData.videos) {
                const video = videosData.videos.find(v => v.id === firstVideo.dbId);
                if (video && video.video_id) {
                  serverVideoIdForQuery = video.video_id;
                  // 다음 검색을 위해 video 객체에 저장
                  firstVideo.videoId = video.video_id;
                }
              }
            }
          } catch (error) {
            console.warn('VIA video_id 조회 실패:', error);
          }
        }

        // query용 FormData 생성
        const queryFormData = new FormData();
        
        if (serverVideoIdForQuery) {
          queryFormData.append('video_id', serverVideoIdForQuery);
        } else {
          const firstFile = fileEntries[0]?.file;
          if (!firstFile) {
            currentChat.messages.push({
              role: 'assistant',
              content: settingStore.language === 'ko' 
                ? '동영상 파일을 찾을 수 없습니다. 다시 업로드해주세요.' 
                : 'Video file not found. Please upload again.',
              timestamp: getCurrentTime()
            });
            isSearching.value = false;
            scrollToBottom();
            return;
          }
          queryFormData.append('file', firstFile);
        }

        queryFormData.append('query', query);
        
        // 검색 파라미터를 settingStore에서 직접 가져오기
        // safeNum은 함수 시작 부분에서 정의되었지만, 스코프 문제를 방지하기 위해 여기서도 정의
        const safeNumLocal = (val, fallback) => {
          const n = Number(val);
          return Number.isFinite(n) ? n : fallback;
        };
        
        const chunkSize = safeNumLocal(settingStore.searchChunk, 10);
        const topK = safeNumLocal(settingStore.searchTopK, 80);
        const topP = safeNumLocal(settingStore.searchTopP, 1.0);
        const temperature = safeNumLocal(settingStore.searchTemperature, 0.3);
        const maxNewTokens = safeNumLocal(settingStore.searchMaxTokens, 1024);
        const seed = safeNumLocal(settingStore.searchSeed, 42);
        
        console.log('[Search] 일반 Query 검색 파라미터:', { chunkSize, topK, topP, temperature, maxNewTokens, seed });
        
        queryFormData.append('chunk_size', chunkSize);
        queryFormData.append('top_k', topK);
        queryFormData.append('top_p', topP);
        queryFormData.append('temperature', temperature);
        queryFormData.append('max_new_tokens', maxNewTokens);
        queryFormData.append('seed', seed);
        
        // 이미지가 업로드된 경우 FormData에 추가
        if (uploadedImage.value) {
          queryFormData.append('image', uploadedImage.value, uploadedImage.value.name);
          removeUploadedImage();
        }

        try {
          const response = await fetch(`${API_BASE_URL}/vss-query`, {
            method: 'POST',
            body: queryFormData,
            signal: abortController.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const data = await response.json();
          const resultText = data.summary || data.result || '';
          
          // 결과 텍스트만 UI에 출력 (클립 없음)
          const markedanswer = marked.parse(resultText || '');
          const answerHtml = `<div class='font-semibold'>✅ ${settingStore.language === 'ko' ? '질의 응답' : 'Query Answered'}</div><br>${markedanswer}`;
          
          currentChat.messages.push({
            role: 'assistant',
            content: answerHtml,
            timestamp: getCurrentTime()
          });
          
          scrollToBottom();
          isSearching.value = false;
          return;
        } catch (error) {
          console.error('일반 Query 검색 실패:', error);
          currentChat.messages.push({
            role: 'assistant',
            content: settingStore.language === 'ko' 
              ? `검색 중 오류가 발생했습니다: ${error.message}` 
              : `An error occurred during search: ${error.message}`,
            timestamp: getCurrentTime()
          });
          scrollToBottom();
          isSearching.value = false;
          return;
        }
      }
      
      console.log('[Search] 상세 검색: 요약 상태 확인 후 Summarize와 Query 분리 처리');
      
      // safeNum 함수는 이미 함수 시작 부분에서 정의됨
      
      // 1단계: 요약 상태 확인 (배치 처리로 최적화)
      const videosToSummarize = []; // 요약이 필요한 동영상 목록
      const videosToQuery = []; // Query만 필요한 동영상 목록 (video_id 포함)
      
      if (userId) {
        try {
          // 모든 선택된 동영상의 VIA 서버 video_id 조회
          const videosResponse = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            if (videosData.success && videosData.videos) {
              // video_id 목록 수집
              const videoIdList = [];
              const videoIdToEntryMap = {}; // video_id -> {file, video} 매핑
              
              for (const { file, video } of fileEntries) {
                const dbId = video.dbId || video.id;
                if (dbId) {
                  const videoInfo = videosData.videos.find(v => v.id === dbId);
                  if (videoInfo && videoInfo.video_id) {
                    videoIdList.push(videoInfo.video_id);
                    videoIdToEntryMap[videoInfo.video_id] = { file, video };
                  } else {
                    // video_id가 없으면 저장된 요약 결과가 없는 것으로 간주하여 검색에서 제외
                    console.log(`[Search] 동영상 ${video.title || video.name}의 VIDEO_ID를 찾을 수 없음, 저장된 요약 결과가 없어 검색에서 제외됨`);
                    // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                  }
                } else {
                  // dbId가 없으면 저장된 요약 결과가 없는 것으로 간주하여 검색에서 제외
                  console.log(`[Search] 동영상 ${video.title || video.name}의 DB ID가 없음, 저장된 요약 결과가 없어 검색에서 제외됨`);
                  // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                }
              }
              
              // 배치로 요약 상태 확인 (한 번의 API 호출)
              if (videoIdList.length > 0) {
                try {
                  console.log(`[Search] 배치 요약 상태 확인 시작: ${videoIdList.length}개 동영상`);
                  const batchSummaryResponse = await fetch(
                    `${API_BASE_URL}/summaries/batch?video_ids=${encodeURIComponent(JSON.stringify(videoIdList))}&user_id=${userId}`
                  );
                  
                  if (batchSummaryResponse.ok) {
                    const batchSummaryData = await batchSummaryResponse.json();
                    console.log('[Search] 배치 요약 상태 조회 결과:', batchSummaryData);
                    
                    if (batchSummaryData.success && batchSummaryData.results) {
                      // 각 video_id에 대해 요약 상태 확인
                      for (const video_id of videoIdList) {
                        const entry = videoIdToEntryMap[video_id];
                        if (!entry) continue;
                        
                        const { file, video } = entry;
                        const result = batchSummaryData.results[video_id];
                        
                        // result가 있고 success가 true이고 summary가 있으면 요약됨
                        if (result && result.success === true && result.summary && result.summary.video_id) {
                          // 이미 요약된 동영상
                          console.log(`[Search] ✅ 동영상 ${video.title || video.name}은 이미 요약됨 (VIDEO_ID: ${video_id})`);
                          videosToQuery.push({ file, video, video_id });
                        } else {
                          // 저장된 요약 결과가 없는 동영상은 검색에서 제외
                          console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨 (VIDEO_ID: ${video_id}, result:`, result, ')');
                          // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                        }
                      }
                    } else {
                      // 배치 조회 결과가 없으면 모든 동영상을 검색에서 제외
                      console.warn('[Search] 배치 요약 상태 조회 결과가 없음, 모든 동영상을 검색에서 제외');
                      for (const video_id of videoIdList) {
                        const entry = videoIdToEntryMap[video_id];
                        if (entry) {
                          const { video } = entry;
                          console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨 (VIDEO_ID: ${video_id})`);
                          // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                        }
                      }
                    }
                  } else {
                    // 배치 조회 실패 시 모든 동영상을 검색에서 제외
                    const errorText = await batchSummaryResponse.text();
                    console.warn(`[Search] 배치 요약 상태 조회 실패 (${batchSummaryResponse.status}):`, errorText);
                    for (const video_id of videoIdList) {
                      const entry = videoIdToEntryMap[video_id];
                      if (entry) {
                        const { video } = entry;
                        console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨 (VIDEO_ID: ${video_id})`);
                        // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                      }
                    }
                  }
                } catch (error) {
                  console.error('[Search] 배치 요약 상태 확인 중 오류:', error);
                  // 오류 발생 시 모든 동영상을 검색에서 제외
                  for (const video_id of videoIdList) {
                    const entry = videoIdToEntryMap[video_id];
                    if (entry) {
                      const { video } = entry;
                      console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨 (VIDEO_ID: ${video_id})`);
                      // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('[Search] 요약 상태 확인 중 오류:', error);
          // 오류 발생 시 모든 동영상을 검색에서 제외
          fileEntries.forEach(({ video }) => {
            console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨`);
            // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
          });
        }
      } else {
        // userId가 없으면 모든 동영상을 검색에서 제외
        fileEntries.forEach(({ video }) => {
          console.log(`[Search] ⚠️ 동영상 ${video.title || video.name}은 저장된 요약 결과가 없어 검색에서 제외됨 (userId 없음)`);
          // videosToSummarize에 추가하지 않음 (검색 대상에서 제외)
        });
      }
      
      // 2단계: 요약되지 않은 동영상에 대해 Summarize 수행 (병렬 처리)
      // 최적화: 이미 요약된 동영상은 바로 Query 목록에 추가되어 있으므로, 요약이 필요한 동영상만 처리
      const summarizePromise = videosToSummarize.length > 0 ? (async () => {
        console.log(`[Search] ${videosToSummarize.length}개 동영상 요약 시작 (병렬 처리)`);
        
        // 요약용 프롬프트 생성 (기본 프롬프트 사용)
        const summarizePrompt = settingStore.language === 'ko' 
          ? '동영상의 주요 내용을 요약해주세요.'
          : 'Please summarize the main content of the video.';
        
        // 각 동영상에 대해 요약 수행 (병렬 처리)
        const summarizePromises = videosToSummarize.map(async ({ file, video, video_id }) => {
          try {
            const summarizeFormData = new FormData();
            
            // video_id가 있으면 video_id만 전달, 없으면 파일 전달
            if (video_id) {
              summarizeFormData.append('video_id', video_id);
            } else {
              summarizeFormData.append('file', file, file.name);
            }
            
            summarizeFormData.append('prompt', summarizePrompt);
            summarizeFormData.append('csprompt', '');
            summarizeFormData.append('saprompt', '');
            summarizeFormData.append('chunk_duration', safeNum(settingStore.summarizeChunk, -1));
            summarizeFormData.append('num_frames_per_chunk', safeNum(settingStore.summarizeNumFramesPerChunk, 0));
            summarizeFormData.append('frame_width', safeNum(settingStore.summarizeFrameWidth, 1920));
            summarizeFormData.append('frame_height', safeNum(settingStore.summarizeFrameHeight, 1080));
            summarizeFormData.append('top_k', safeNum(settingStore.summarizeTopk, 80));
            summarizeFormData.append('top_p', safeNum(settingStore.summarizeTopp, 1.0));
            summarizeFormData.append('temperature', safeNum(settingStore.summarizeTemp, 0.3));
            // VIA 서버 제약사항: max_tokens는 최대 1024까지만 허용
            const maxTokensValue = safeNum(settingStore.summarizeMaxTokens, 2048);
            summarizeFormData.append('max_tokens', Math.min(maxTokensValue, 1024));
            summarizeFormData.append('seed', safeNum(settingStore.summarizeSeed, 42));
            summarizeFormData.append('batch_size', safeNum(settingStore.summarizeBatchSize, 6));
            summarizeFormData.append('rag_batch_size', safeNum(settingStore.summarizeRagBatchSize, 1));
            summarizeFormData.append('rag_top_k', safeNum(settingStore.summarizeRagTopK, 5));
            summarizeFormData.append('summary_top_p', safeNum(settingStore.summarizeSummarizeTopP, 0.7));
            summarizeFormData.append('summary_temperature', safeNum(settingStore.summarizeSummarizeTemperature, 0.2));
            summarizeFormData.append('summary_max_tokens', safeNum(settingStore.summarizeSummarizeMaxTokens, 2048));
            summarizeFormData.append('chat_top_p', safeNum(settingStore.summarizeChatTopP, 0.7));
            summarizeFormData.append('chat_temperature', safeNum(settingStore.summarizeChatTemperature, 0.2));
            summarizeFormData.append('chat_max_tokens', safeNum(settingStore.summarizeChatMaxTokens, 2048));
            summarizeFormData.append('alert_top_p', safeNum(settingStore.summarizeNotificationTopP, 0.7));
            summarizeFormData.append('alert_temperature', safeNum(settingStore.summarizeNotificationTemperature, 0.2));
            summarizeFormData.append('alert_max_tokens', safeNum(settingStore.summarizeNotificationMaxTokens, 2048));
            summarizeFormData.append('enable_audio', settingStore.summarizeEnableAudio);
            summarizeFormData.append('enable_chat_history', 'false');
            summarizeFormData.append('user_id', userId);
            
            const summarizeResponse = await fetch(`${API_BASE_URL}/vss-summarize`, {
              method: 'POST',
              body: summarizeFormData,
              signal: abortController.signal
            });
            
            if (!summarizeResponse.ok) {
              const errorText = await summarizeResponse.text();
              console.error(`[Search] 동영상 ${video.title || video.name} 요약 실패 (${summarizeResponse.status}):`, errorText);
              throw new Error(`Summarize HTTP error ${summarizeResponse.status}: ${errorText}`);
            }
            
            const summarizeData = await summarizeResponse.json();
            const summarizedVideoId = summarizeData.video_id || video_id;
            
            console.log(`[Search] ✅ 동영상 ${video.title || video.name} 요약 완료 (VIDEO_ID: ${summarizedVideoId})`);
            
            // 요약 완료 후 Query 목록에 추가
            return { file, video, video_id: summarizedVideoId };
          } catch (error) {
            console.error(`[Search] ❌ 동영상 ${video.title || video.name} 요약 실패:`, error);
            // 요약 실패 시 검색에서 제외 (저장된 요약 결과가 없으므로)
            console.log(`[Search] ⚠️ 요약 실패로 인해 검색에서 제외: ${video.title || video.name}`);
            return null;
          }
        });
        
        // 모든 요약 작업 완료 대기 (병렬 처리)
        const summarizeResults = await Promise.all(summarizePromises);
        
        // 성공한 요약 결과를 Query 목록에 추가
        const successfulSummaries = summarizeResults.filter(r => r && r.video_id);
        successfulSummaries.forEach(result => {
          videosToQuery.push(result);
        });
        
        console.log(`[Search] 요약 완료: ${successfulSummaries.length}/${videosToSummarize.length}개 성공`);
        return successfulSummaries;
      })() : Promise.resolve([]);
      
      // 3단계: 모든 동영상에 대해 Query 수행 (클립 생성 포함)
      // 최적화: 이미 요약된 동영상은 바로 Query 시작, 요약이 필요한 동영상은 요약 완료 후 Query 시작
      
      // groupedClipItems와 clips_extracted를 상위 스코프에 선언
      let groupedClipItems = [];
      let clips_extracted = false;
      
      // 이미 요약된 동영상이 있으면 바로 Query 시작 (요약 완료를 기다리지 않음)
      if (videosToQuery.length > 0) {
        console.log(`[Search] ${videosToQuery.length}개 동영상 Query 시작 (이미 요약된 동영상)`);
        
        // 이미 요약된 동영상에 대한 Query를 먼저 시작 (요약 작업과 병렬 처리)
        const queryForSummarizedVideos = async () => {
          const queryFormData = new FormData();
          const videoIdMap = {};
          
          const videoDurationMap = {}; // filename -> duration 매핑
          videosToQuery.forEach(({ file, video, video_id: _video_id }) => {
            const dbId = video.dbId || video.id;
            if (dbId) {
              videoIdMap[file.name] = dbId;
            }
            // duration 값 추가 (프론트엔드에서 가져온 값)
            if (video.duration && isFinite(video.duration) && video.duration > 0) {
              videoDurationMap[file.name] = video.duration;
            }
            queryFormData.append('files', file, file.name);
          });
          
          queryFormData.append('prompt', query);
          
          if (uploadedImage.value) {
            queryFormData.append('image', uploadedImage.value, uploadedImage.value.name);
            removeUploadedImage();
          }
          
          if (userId) {
            queryFormData.append('user_id', userId);
          }
          if (Object.keys(videoIdMap).length > 0) {
            queryFormData.append('video_ids', JSON.stringify(videoIdMap));
          }
          if (Object.keys(videoDurationMap).length > 0) {
            queryFormData.append('video_durations', JSON.stringify(videoDurationMap));
          }
          
          // 검색 파라미터를 settingStore에서 직접 가져오기 (반응형 값 사용)
          // Pinia store의 ref 값은 자동으로 unwrap되므로 직접 접근 가능
          const chunkSize = safeNum(settingStore.searchChunk, 10);
          const topK = safeNum(settingStore.searchTopK, 50);
          const topP = safeNum(settingStore.searchTopP, 1.0);
          const temperature = safeNum(settingStore.searchTemperature, 0.4);
          const maxNewTokens = safeNum(settingStore.searchMaxTokens, 1024);
          const seed = safeNum(settingStore.searchSeed, 1);
          
          console.log('[Search] 검색 파라미터 (이미 요약된 동영상):', { 
            chunkSize, topK, topP, temperature, maxNewTokens, seed,
            'settingStore 값': {
              searchChunk: settingStore.searchChunk,
              searchTopK: settingStore.searchTopK,
              searchTopP: settingStore.searchTopP,
              searchTemperature: settingStore.searchTemperature,
              searchMaxTokens: settingStore.searchMaxTokens,
              searchSeed: settingStore.searchSeed
            }
          });
          
          queryFormData.append('chunk_size', chunkSize);
          queryFormData.append('top_k', topK);
          queryFormData.append('top_p', topP);
          queryFormData.append('temperature', temperature);
          queryFormData.append('max_new_tokens', maxNewTokens);
          queryFormData.append('seed', seed);
          queryFormData.append('skip_summarize', 'true');

          const response = await fetch(`${API_BASE_URL}/query-and-generate-clips`, {
            method: 'POST',
            body: queryFormData,
            signal: abortController.signal
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          
          return await response.json();
        };
        
        // 요약 작업과 Query 작업을 병렬로 실행
        const [summarizeResults, queryResults] = await Promise.all([
          summarizePromise,
          queryForSummarizedVideos()
        ]);
        
        // 요약 완료된 동영상도 Query에 추가
        if (summarizeResults && summarizeResults.length > 0) {
          console.log(`[Search] ${summarizeResults.length}개 동영상 요약 완료, 추가 Query 시작`);
          
          // 요약 완료된 동영상에 대한 Query 수행
          const queryFormDataForNewSummaries = new FormData();
          const videoIdMapForNewSummaries = {};
          
          summarizeResults.forEach(({ file, video, video_id: _video_id }) => {
            const dbId = video.dbId || video.id;
            if (dbId) {
              videoIdMapForNewSummaries[file.name] = dbId;
            }
            queryFormDataForNewSummaries.append('files', file, file.name);
          });
          
          queryFormDataForNewSummaries.append('prompt', query);
          
          if (userId) {
            queryFormDataForNewSummaries.append('user_id', userId);
          }
          if (Object.keys(videoIdMapForNewSummaries).length > 0) {
            queryFormDataForNewSummaries.append('video_ids', JSON.stringify(videoIdMapForNewSummaries));
          }
          
          // 검색 파라미터를 settingStore에서 직접 가져오기 (반응형 값 사용)
          const chunkSize = safeNum(settingStore.searchChunk, 10);
          const topK = safeNum(settingStore.searchTopK, 80);
          const topP = safeNum(settingStore.searchTopP, 1.0);
          const temperature = safeNum(settingStore.searchTemperature, 0.3);
          const maxNewTokens = safeNum(settingStore.searchMaxTokens, 1024);
          const seed = safeNum(settingStore.searchSeed, 42);
          
          console.log('[Search] 검색 파라미터 (요약 완료 후):', { chunkSize, topK, topP, temperature, maxNewTokens, seed });
          
          queryFormDataForNewSummaries.append('chunk_size', chunkSize);
          queryFormDataForNewSummaries.append('top_k', topK);
          queryFormDataForNewSummaries.append('top_p', topP);
          queryFormDataForNewSummaries.append('temperature', temperature);
          queryFormDataForNewSummaries.append('max_new_tokens', maxNewTokens);
          queryFormDataForNewSummaries.append('seed', seed);
          queryFormDataForNewSummaries.append('skip_summarize', 'true');
          
          const responseForNewSummaries = await fetch(`${API_BASE_URL}/query-and-generate-clips`, {
            method: 'POST',
            body: queryFormDataForNewSummaries,
            signal: abortController.signal
          });
          
          if (responseForNewSummaries.ok) {
            const dataForNewSummaries = await responseForNewSummaries.json();
            // 두 결과를 병합
            queryResults.clips = [...(queryResults.clips || []), ...(dataForNewSummaries.clips || [])];
            queryResults.clips_extracted = queryResults.clips_extracted || dataForNewSummaries.clips_extracted;
          }
        }
        
        const data = queryResults;
        clips_extracted = data.clips_extracted || false;
        groupedClipItems = (data.clips || []).map(group => ({
          video: group.video,
          clips: Array.isArray(group.clips) ? group.clips : []
        }));
      } else if (videosToSummarize.length > 0) {
        // 요약이 필요한 동영상만 있는 경우: 요약 완료 후 Query 시작
        console.log(`[Search] 요약이 필요한 동영상만 있음. 요약 완료 후 Query 시작`);
        
        const summarizeResults = await summarizePromise;
        
        if (summarizeResults && summarizeResults.length > 0) {
          // 요약 완료된 동영상에 대한 Query 수행
          const queryFormData = new FormData();
          const videoIdMap = {};
          const videoDurationMap = {}; // filename -> duration 매핑
          
          summarizeResults.forEach(({ file, video, video_id: _video_id }) => {
            const dbId = video.dbId || video.id;
            if (dbId) {
              videoIdMap[file.name] = dbId;
            }
            // duration 값 추가 (프론트엔드에서 가져온 값)
            if (video.duration && isFinite(video.duration) && video.duration > 0) {
              videoDurationMap[file.name] = video.duration;
            }
            queryFormData.append('files', file, file.name);
          });
          
          queryFormData.append('prompt', query);
          
          if (uploadedImage.value) {
            queryFormData.append('image', uploadedImage.value, uploadedImage.value.name);
            removeUploadedImage();
          }
          
          if (userId) {
            queryFormData.append('user_id', userId);
          }
          if (Object.keys(videoIdMap).length > 0) {
            queryFormData.append('video_ids', JSON.stringify(videoIdMap));
          }
          if (Object.keys(videoDurationMap).length > 0) {
            queryFormData.append('video_durations', JSON.stringify(videoDurationMap));
          }
          
          // 검색 파라미터를 settingStore에서 직접 가져오기 (반응형 값 사용)
          const chunkSize = safeNum(settingStore.searchChunk, 10);
          const topK = safeNum(settingStore.searchTopK, 80);
          const topP = safeNum(settingStore.searchTopP, 1.0);
          const temperature = safeNum(settingStore.searchTemperature, 0.3);
          const maxNewTokens = safeNum(settingStore.searchMaxTokens, 1024);
          const seed = safeNum(settingStore.searchSeed, 42);
          
          console.log('[Search] 검색 파라미터 (요약 후 Query):', { chunkSize, topK, topP, temperature, maxNewTokens, seed });
          
          queryFormData.append('chunk_size', chunkSize);
          queryFormData.append('top_k', topK);
          queryFormData.append('top_p', topP);
          queryFormData.append('temperature', temperature);
          queryFormData.append('max_new_tokens', maxNewTokens);
          queryFormData.append('seed', seed);
          queryFormData.append('skip_summarize', 'true');
          
          const response = await fetch(`${API_BASE_URL}/query-and-generate-clips`, {
            method: 'POST',
            body: queryFormData,
            signal: abortController.signal
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const data = await response.json();
          clips_extracted = data.clips_extracted || false;
          groupedClipItems = (data.clips || []).map(group => ({
            video: group.video,
            clips: Array.isArray(group.clips) ? group.clips : []
          }));
        } else {
          // 요약 실패
          currentChat.messages.push({
            role: 'assistant',
            content: settingStore.language === 'ko' 
              ? '동영상 요약에 실패했습니다. 다시 시도해주세요.' 
              : 'Failed to summarize videos. Please try again.',
            timestamp: getCurrentTime()
          });
          isSearching.value = false;
          scrollToBottom();
          return;
        }
      } else {
        // Query할 동영상이 없음 (저장된 요약 결과가 있는 동영상이 없음)
        const excludedCount = selectedVideos.value.length - videosToQuery.length;
        const message = settingStore.language === 'ko'
          ? excludedCount > 0
            ? `저장된 요약 결과가 있는 동영상이 없습니다. ${excludedCount}개 동영상이 검색에서 제외되었습니다. 먼저 Summarize 메뉴에서 동영상을 요약해주세요.`
            : '검색할 동영상이 없습니다. 저장된 요약 결과가 있는 동영상을 선택해주세요.'
          : excludedCount > 0
            ? `No videos with saved summary results. ${excludedCount} video(s) were excluded from search. Please summarize videos in the Summarize menu first.`
            : 'No videos to search. Please select videos with saved summary results.';
        currentChat.messages.push({
          role: 'assistant',
          content: message,
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        scrollToBottom();
        return;
      }

      // 타임스탬프가 있는 클립 필터링 (url이 없어도 타임스탬프가 있으면 유효)
      // via_response만 있는 것은 제외, 타임스탬프 간격이 0초인 클립도 제외
      const validClips = groupedClipItems.flatMap(group =>
        group.clips
          .filter(clip => {
            // via_response만 있는 것은 제외
            if (clip.via_response && !clip.start_time && !clip.end_time) return false;
            
            // 타임스탬프가 있는 경우 (url이 없어도 타임스탬프가 있으면 유효)
            if (clip.start_time !== undefined && clip.end_time !== undefined) {
              // 타임스탬프 간격이 0초 이하인 클립 제외
              if (clip.end_time - clip.start_time <= 0) return false;
              return true; // 타임스탬프가 유효하면 통과
            }
            
            // 타임스탬프가 없으면 url이 있어야 함 (기존 로직)
            if (!clip.url) return false;
            return true;
          })
          .map(clip => ({
            ...clip,
            sourceVideo: clip.source_video_filename || group.video || clip.sourceVideo
          }))
      );

      // 최적화: 검색 결과가 있는 영상만 식별
      const videosWithResults = new Set();
      groupedClipItems.forEach(group => {
        const hasValidClips = group.clips.some(clip => {
          // via_response만 있는 것은 제외
          if (clip.via_response && !clip.start_time && !clip.end_time) return false;
          
          // 타임스탬프가 있는 경우 (url이 없어도 타임스탬프가 있으면 유효)
          if (clip.start_time !== undefined && clip.end_time !== undefined) {
            if (clip.end_time - clip.start_time <= 0) return false;
            return true; // 타임스탬프가 유효하면 통과
          }
          
          // 타임스탬프가 없으면 url이 있어야 함
          if (!clip.url) return false;
          return true;
        });
        if (hasValidClips) {
          // video 경로에서 파일명 추출
          const videoPath = group.video || '';
          const videoFilename = videoPath.split('/').pop() || videoPath;
          videosWithResults.add(videoFilename);
        }
      });

      if (!clips_extracted || validClips.length === 0) {
        // 클립이 추출되지 않았을 경우
        currentChat.messages.push({
          role: 'assistant',
          content: t.value.noScenes,
          timestamp: getCurrentTime()
        });
        return;
      }

      // 최적화: 검색 결과가 있는 영상의 파일만 미리 로드 (나중에 클립 재생을 위해)
      // 검색 결과가 없는 영상의 파일은 로드하지 않음
      const videosToPreload = selectedVideos.value.filter(video => {
        const videoFilename = video.title || video.name || '';
        return videosWithResults.has(videoFilename);
      });
      
      // 백그라운드에서 검색 결과가 있는 영상의 파일만 로드 (비동기, 블로킹하지 않음)
      if (videosToPreload.length > 0) {
        processBatch(videosToPreload, ensureVideoFile, 3).catch(err => {
          console.warn('검색 결과 영상 파일 미리 로드 중 오류:', err);
        });
      }

      // 클립이 추출되었을 경우: 클립 동영상과 타임스탬프 표시
      const foundMessage = settingStore.language === 'ko' 
        ? `${groupedClipItems.length}${t.value.foundScenes} ${validClips.length}${t.value.foundClips}`
        : `${validClips.length} ${t.value.foundClips} from ${groupedClipItems.length} ${t.value.foundScenes}`;
      currentChat.messages.push({
        role: 'assistant',
        content: foundMessage,
        clips: validClips,
        groupedClips: groupedClipItems,
        timestamp: getCurrentTime()
      });
    } 
    // 고속 검색: CV Event Detector를 사용한 객체 검출
    else if (searchType.value === 'fast') {
      // 검출 클래스 확인
      if (!searchObject.value || !searchObject.value.trim()) {
        currentChat.messages.push({
          role: 'assistant',
          content: settingStore.language === 'ko' 
            ? '검색 객체를 설정해주세요. 고속 검색 파라미터에서 검출할 객체를 지정해야 합니다.' 
            : 'Please set the search object. You need to specify the objects to detect in the fast search parameters.',
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        return;
      }

      // 모든 선택된 동영상의 VIA 서버 video_id 조회
      const videoIds = [];
      if (userId) {
        try {
          const videosResponse = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            if (videosData.success && videosData.videos) {
              fileEntries.forEach(({ video }) => {
                const dbId = video.dbId || video.id;
                if (dbId) {
                  const videoInfo = videosData.videos.find(v => v.id === dbId);
                  if (videoInfo && videoInfo.video_id) {
                    videoIds.push(videoInfo.video_id); // VIA 서버의 video_id
                  }
                }
              });
            }
          }
        } catch (error) {
          console.warn('VIA video_id 조회 실패:', error);
        }
      }

      if (videoIds.length === 0) {
        currentChat.messages.push({
          role: 'assistant',
          content: settingStore.language === 'ko' 
            ? '동영상의 VIA 서버 ID를 찾을 수 없습니다. 동영상을 다시 업로드해주세요.' 
            : 'Cannot find VIA server ID for videos. Please upload videos again.',
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        return;
      }

      // NaN 방지 헬퍼
      const safeNum = (val, fallback) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : fallback;
      };

      // 고속 검색 요청
      const fastSearchRequest = {
        user_id: userId || '',
        video_ids: videoIds,
        detection_classes: searchObject.value.trim(),
        box_threshold: safeNum(boxThreshold.value, 0.5),
        min_clip_duration: 1.0, // 기본값 사용
        max_clip_duration: 30.0, // 기본값 사용
        frame_skip_interval: safeNum(frameSkip.value, 5),
        minimum_detection_threshold: safeNum(objectDetectionThreshold.value, 1),
        gdino_rois: [[]] // ROI 기본값
      };

      const response = await fetch(`${API_BASE_URL}/fast-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fastSearchRequest),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const clips_extracted = data.clips_extracted || false;
      const groupedClipItems = (data.clips || []).map(group => ({
        video: group.video,
        clips: Array.isArray(group.clips) ? group.clips : []
      }));

      // 타임스탬프가 있는 클립 필터링 (url이 없어도 타임스탬프가 있으면 유효)
      const validClips = groupedClipItems.flatMap(group =>
        group.clips
          .filter(clip => {
            // 타임스탬프가 있는 경우 (url이 없어도 타임스탬프가 있으면 유효)
            if (clip.start_time !== undefined && clip.end_time !== undefined) {
              // 타임스탬프 간격이 0초 이하인 클립 제외
              if (clip.end_time - clip.start_time <= 0) return false;
              return true; // 타임스탬프가 유효하면 통과
            }
            
            // 타임스탬프가 없으면 url이 있어야 함 (기존 로직)
            if (!clip.url) return false;
            return true;
          })
          .map(clip => ({
            ...clip,
            sourceVideo: clip.source_video_filename || group.video || clip.sourceVideo
          }))
      );

      if (!clips_extracted || validClips.length === 0) {
        currentChat.messages.push({
          role: 'assistant',
          content: settingStore.language === 'ko' 
            ? '검출된 객체가 없습니다. 검색 객체 설정을 확인하거나 다른 동영상을 선택해주세요.' 
            : 'No objects detected. Please check the search object settings or select different videos.',
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        scrollToBottom();
        return;
      }

      // 클립이 추출되었을 경우: 클립 동영상과 타임스탬프 표시
      const foundMessage = settingStore.language === 'ko' 
        ? `${groupedClipItems.length}개 동영상에서 ${validClips.length}개 클립 검출`
        : `${validClips.length} clips detected from ${groupedClipItems.length} videos`;
      currentChat.messages.push({
        role: 'assistant',
        content: foundMessage,
        clips: validClips,
        groupedClips: groupedClipItems,
        timestamp: getCurrentTime()
      });
    }
    // 고속 검색 (VLM 분석): vss-query 엔드포인트 사용
    else {
      // 저장된 검색어 사용 (searchInput.value는 이미 비워졌을 수 있음)
      const query = savedQuery || searchInput.value.trim();
      
      // NaN 방지 헬퍼
      const safeNum = (val, fallback) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : fallback;
      };

      // 첫 번째 선택된 동영상 사용
      const firstVideo = fileEntries[0]?.video;
      if (!firstVideo) {
        currentChat.messages.push({
          role: 'assistant',
          content: settingStore.language === 'ko' 
            ? '동영상을 선택해주세요.' 
            : 'Please select a video.',
          timestamp: getCurrentTime()
        });
        isSearching.value = false;
        scrollToBottom();
        return;
      }

      // DB에서 VIA 서버의 video_id 조회
      let serverVideoIdForQuery = null;
      if (userId && firstVideo.dbId) {
        try {
          const videosResponse = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            if (videosData.success && videosData.videos) {
              const video = videosData.videos.find(v => v.id === firstVideo.dbId);
              if (video && video.video_id) {
                serverVideoIdForQuery = video.video_id; // VIA 서버의 video_id
              }
            }
          }
        } catch (error) {
          console.warn('VIA video_id 조회 실패:', error);
        }
      }

      // query용 FormData 생성
      const queryFormData = new FormData();
      
      if (serverVideoIdForQuery) {
        queryFormData.append('video_id', serverVideoIdForQuery);
      } else {
        // video_id가 없으면 첫 번째 파일 사용
        const firstFile = fileEntries[0]?.file;
        if (!firstFile) {
          currentChat.messages.push({
            role: 'assistant',
            content: settingStore.language === 'ko' 
              ? '동영상 파일을 찾을 수 없습니다. 다시 업로드해주세요.' 
              : 'Video file not found. Please upload again.',
            timestamp: getCurrentTime()
          });
          isSearching.value = false;
          scrollToBottom();
          return;
        }
        queryFormData.append('file', firstFile);
      }

      queryFormData.append('query', query);
      
      // 검색 파라미터를 settingStore에서 직접 가져오기 (반응형 값 사용)
      const chunkSize = safeNum(settingStore.searchChunk, 10);
      const topK = safeNum(settingStore.searchTopK, 80);
      const topP = safeNum(settingStore.searchTopP, 1.0);
      const temperature = safeNum(settingStore.searchTemperature, 0.3);
      const maxNewTokens = safeNum(settingStore.searchMaxTokens, 1024);
      const seed = safeNum(settingStore.searchSeed, 42);
      
      console.log('[Search] 검색 파라미터 (고속 검색):', { chunkSize, topK, topP, temperature, maxNewTokens, seed });
      
      queryFormData.append('chunk_size', chunkSize);
      queryFormData.append('top_k', topK);
      queryFormData.append('top_p', topP);
      queryFormData.append('temperature', temperature);
      queryFormData.append('max_new_tokens', maxNewTokens);
      queryFormData.append('seed', seed);
      
      // 이미지가 업로드된 경우 FormData에 추가
      if (uploadedImage.value) {
        queryFormData.append('image', uploadedImage.value, uploadedImage.value.name);
        // 검색 후 이미지 초기화
        removeUploadedImage();
      }

      const response = await fetch(`${API_BASE_URL}/vss-query`, {
        method: 'POST',
        body: queryFormData,
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      const markedanswer = marked.parse(data.summary || '');
      const answerHtml = `<div class='font-semibold'>✅ ${settingStore.language === 'ko' ? '질의 응답' : 'Query Answered'}</div><br>${markedanswer}`;
      
      currentChat.messages.push({
        role: 'assistant',
        content: answerHtml,
        timestamp: getCurrentTime()
      });
      // 메시지 추가 후 오래된 메시지 정리
      cleanupOldMessages(currentChatIndex.value);
    }
  } catch (error) {
    // AbortError는 정상적인 취소이므로 무시
    if (error.name === 'AbortError') {
      isSearching.value = false;
      return;
    }
    console.error('Search request failed:', error);
    currentChat.messages.push({
      role: 'assistant',
      content: `${t.value.searchError} (${error.message})`,
      timestamp: getCurrentTime()
    });
    // 메시지 추가 후 오래된 메시지 정리
    cleanupOldMessages(currentChatIndex.value);
  } finally {
    isSearching.value = false;
    scrollToBottom();
    if (typeof abortController !== 'undefined') {
      removeAbortController(abortController);
    }
    
    // 검색 완료 후 상태 저장 (지연 저장으로 성능 개선)
    nextTick(() => {
      setTimeout(() => {
        autoSaveSearchState();
      }, 500);
    });
  }
}

// 채팅 클립 확대용(그리드 비디오와 구분되는 최소 필드 구성)
// 클립 URL을 정규화하는 함수 (상대 경로인 경우 API_BASE_URL 추가)
// 클립 썸네일 URL 가져오기 (url이 없으면 원본 동영상 URL 사용)
function getClipThumbnailUrl(clip) {
  // url이 있으면 기존 로직 사용
  if (clip.url) {
    return getClipUrl(clip.url);
  }
  
  // url이 없으면 원본 동영상 URL 찾기
  const sourceVideoFilename = clip.source_video_filename || clip.sourceVideo || '';
  if (sourceVideoFilename) {
    // items에서 원본 동영상 찾기 (파일명으로 매칭)
    const originalVideo = items.value.find(video => {
      const videoFilename = video.title || video.name || '';
      return videoFilename === sourceVideoFilename || 
             videoFilename.includes(sourceVideoFilename) ||
             sourceVideoFilename.includes(videoFilename);
    });
    
    if (originalVideo && originalVideo.displayUrl) {
      return encodeVideoUrl(originalVideo.displayUrl);
    }
  }
  
  // 찾지 못하면 빈 문자열 반환
  return '';
}

/**
 * URL의 파일명 부분을 인코딩하여 특수 문자(#, [, ] 등) 문제 해결
 * @param {string} url - 인코딩할 URL
 * @returns {string} 인코딩된 URL
 */
function encodeVideoUrl(url) {
  if (!url) return '';
  
  // blob URL은 그대로 반환
  if (url.startsWith('blob:')) {
    return url;
  }
  
  // localhost나 127.0.0.1을 최신 API_BASE_URL로 교체
  let processedUrl = url;
  if (url.includes('localhost:8001') || url.includes('127.0.0.1:8001')) {
    const currentApiBaseUrl = getApiBaseUrl();
    // localhost를 현재 API_BASE_URL로 교체
    processedUrl = url.replace(/https?:\/\/localhost:8001/g, currentApiBaseUrl)
                      .replace(/https?:\/\/127\.0\.0\.1:8001/g, currentApiBaseUrl);
  }
  
  // 상대 경로인 경우 최신 API_BASE_URL 가져오기
  let absoluteUrl = processedUrl;
  if (processedUrl.startsWith('/')) {
    const currentApiBaseUrl = getApiBaseUrl();
    absoluteUrl = `${currentApiBaseUrl}${processedUrl}`;
  }
  
  try {
    // URL 객체로 파싱
    const urlObj = new URL(absoluteUrl);
    // 경로를 분리하여 파일명 부분만 인코딩
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    if (filename) {
      // 파일명 부분만 인코딩 (특수 문자 처리)
      pathParts[pathParts.length - 1] = encodeURIComponent(filename);
      urlObj.pathname = pathParts.join('/');
    }
    return urlObj.toString();
  } catch (e) {
    // URL 파싱 실패 시 원본 반환
    console.warn('[encodeVideoUrl] URL 파싱 실패:', url, e);
    return url;
  }
}

function getClipUrl(url) {
  if (!url) return '';
  // 이미 전체 URL인 경우 (http:// 또는 https://로 시작)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return encodeVideoUrl(url);
  }
  // 상대 경로인 경우 최신 API_BASE_URL 가져오기
  if (url.startsWith('/')) {
    const currentApiBaseUrl = getApiBaseUrl();
    return encodeVideoUrl(`${currentApiBaseUrl}${url}`);
  }
  // 그 외의 경우 그대로 반환
  return url;
}

function zoomClip(clip) {
  // 원본 동영상 URL 찾기 (클립 생성 없이 원본 동영상 사용)
  let originalVideoUrl = null;
  const sourceVideoFilename = clip.sourceVideo || '';
  
  if (sourceVideoFilename) {
    // items에서 원본 동영상 찾기 (파일명으로 매칭)
    const originalVideo = items.value.find(video => {
      const videoFilename = video.title || video.name || '';
      return videoFilename === sourceVideoFilename || 
             videoFilename.includes(sourceVideoFilename) ||
             sourceVideoFilename.includes(videoFilename);
    });
    
    if (originalVideo && originalVideo.displayUrl) {
      originalVideoUrl = originalVideo.displayUrl;
    }
  }
  
  // 원본 동영상 URL이 없으면 기존 클립 URL 사용 (폴백)
  const videoUrl = originalVideoUrl || getClipUrl(clip.url);
  
  // clip 객체를 확대 모달이 사용하는 형태로 매핑
  zoomedVideo.value = {
    id: `clip-${clip.id}`,
    title: clip.title || '클립',
    displayUrl: videoUrl,
    progress: 0
  };
  // 클립 정보 저장 (sentence, start_time, end_time 포함)
  zoomedClip.value = clip;
  showSentencePopup.value = true; // 팝업 표시
  isZoomed.value = true;
  zoomPlaying.value = false;
  zoomProgress.value = 0;
  zoomCurrentTime.value = 0;
  // 클립 길이 계산 (타임스탬프가 있으면 클립 길이, 없으면 전체 동영상 길이)
  const clipDuration = (clip.start_time !== undefined && clip.end_time !== undefined) 
    ? (clip.end_time - clip.start_time) 
    : 0;
  zoomDuration.value = clipDuration;
  
  nextTick(() => {
    const el = zoomVideoRef.value;
    if (!el) return;
    
    // 타임스탬프 범위 재생을 위한 설정
    const startTime = clip.start_time !== undefined ? clip.start_time : 0;
    const endTime = clip.end_time !== undefined ? clip.end_time : null;
    
    // 메타데이터가 준비될 때까지 기다린 뒤 재생
    const setupPlayback = () => {
      if (endTime !== null && startTime < endTime) {
        // 타임스탬프 범위가 있으면 클립 길이로 duration 설정
        zoomDuration.value = endTime - startTime;
        // 시작 시간으로 이동
        el.currentTime = startTime;
      } else {
        // 타임스탬프가 없으면 전체 동영상 길이 사용
        zoomDuration.value = el.duration || 0;
        el.currentTime = 0;
      }
      
      try {
        el.play();
        zoomPlaying.value = true;
      } catch (e) {
        console.warn('클립 모달 재생 실패:', e);
      }
    };
    
    if (!isFinite(el.duration) || el.duration === 0) {
      el.addEventListener('loadedmetadata', () => {
        setupPlayback();
      }, { once: true });
    } else {
      setupPlayback();
    }
  });
}

// 모달 닫기
function unzoomVideo() {
  // 드래그 중이면 중지
  if (isDragging.value) {
    stopDragging();
  }
  
  if (zoomVideoRef.value) {
    try {
      zoomVideoRef.value.pause();
    } catch (e) {
      console.warn('비디오 일시정지 실패:', e);
    }
  }
  isZoomed.value = false;
  zoomPlaying.value = false;
  zoomProgress.value = 0;
  zoomCurrentTime.value = 0;
  zoomDuration.value = 0;
  zoomedVideo.value = null;
  zoomedClip.value = null;
  showSentencePopup.value = true;
  hoveredVideoId.value = null;
}

// 확대 모달 재생/일시정지 토글
function togglePlay(_videoId) {
  if (!zoomVideoRef.value || !zoomVideoRef.value.src) {
    console.warn('togglePlay: video has no src');
    return;
  }
  
  // 클립의 타임스탬프 범위가 있으면 범위 내에서만 재생
  if (zoomedClip.value && 
      zoomedClip.value.start_time !== undefined && 
      zoomedClip.value.end_time !== undefined) {
    const startTime = zoomedClip.value.start_time;
    const endTime = zoomedClip.value.end_time;
    
    if (!zoomPlaying.value) {
      // 재생 시작: 현재 시간이 범위 밖이면 start_time으로 이동
      if (zoomVideoRef.value.currentTime < startTime || zoomVideoRef.value.currentTime >= endTime) {
        zoomVideoRef.value.currentTime = startTime;
      }
      zoomVideoRef.value.play().then(() => {
        zoomPlaying.value = true;
      }).catch(e => {
        console.warn('video play failed:', e);
      });
    } else {
      try {
        zoomVideoRef.value.pause();
        zoomPlaying.value = false;
      } catch (e) {
        console.warn('video pause failed:', e);
      }
    }
  } else {
    // 타임스탬프가 없으면 전체 동영상 재생
    if (!zoomPlaying.value) {
      zoomVideoRef.value.play().then(() => {
        zoomPlaying.value = true;
      }).catch(e => {
        console.warn('video play failed:', e);
      });
    } else {
      try {
        zoomVideoRef.value.pause();
        zoomPlaying.value = false;
      } catch (e) {
        console.warn('video pause failed:', e);
      }
    }
  }
}

// 확대 모달 시간 업데이트
function onZoomTimeUpdate(event) {
  if (!event.target) return;
  const video = event.target;
  
  // 클립의 타임스탬프 범위가 있으면 해당 범위만 재생
  if (zoomedClip.value && 
      zoomedClip.value.start_time !== undefined && 
      zoomedClip.value.end_time !== undefined) {
    const startTime = zoomedClip.value.start_time;
    const endTime = zoomedClip.value.end_time;
    const clipDuration = endTime - startTime;
    
    // 현재 재생 시간이 end_time을 초과하면 정지하고 start_time으로 돌아가기
    if (video.currentTime >= endTime) {
      video.pause();
      video.currentTime = startTime;
      zoomPlaying.value = false;
      return;
    }
    
    // 클립 범위 내의 상대 시간 계산 (0부터 clipDuration까지)
    const relativeTime = Math.max(0, video.currentTime - startTime);
    zoomCurrentTime.value = relativeTime;
    zoomDuration.value = clipDuration;
    zoomProgress.value = clipDuration > 0 ? (relativeTime / clipDuration) * 100 : 0;
  } else {
    // 타임스탬프가 없으면 전체 동영상 재생
    if (isFinite(video.duration) && video.duration > 0) {
      zoomCurrentTime.value = video.currentTime || 0;
      zoomDuration.value = video.duration || 0;
      zoomProgress.value = (zoomCurrentTime.value / zoomDuration.value) * 100;
    }
  }
}

// 확대 모달 비디오 에러 처리
function handleZoomVideoError(videoId, event) {
  console.warn('확대 모달 비디오 로드 실패:', videoId, event);
  if (zoomedVideo.value) {
    zoomedVideo.value.displayUrl = null;
  }
}

// 진행 바 드래그 시작
function startDragging(videoId, event) {
  if (!zoomVideoRef.value) return;
  
  // 이미 드래그 중이면 중복 등록 방지
  if (isDragging.value) {
    return;
  }
  
  isDragging.value = true;
  draggedVideoId.value = videoId;
  
  // 드래그 중 currentTime 업데이트를 쓰로틀링하기 위한 변수
  let lastSeekTime = 0;
  const SEEK_THROTTLE_MS = 100; // 100ms마다만 실제 시크 수행
  
  const updateProgress = (e) => {
    if (!zoomProgressBarRef.value || !isDragging.value) return;
    const rect = zoomProgressBarRef.value.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    zoomProgress.value = percent;
    
    if (!zoomVideoRef.value) return;
    
    // 드래그 중에는 UI만 업데이트하고, 실제 currentTime 변경은 쓰로틀링
    const now = Date.now();
    const shouldSeek = (now - lastSeekTime) >= SEEK_THROTTLE_MS;
    
    // 클립의 타임스탬프 범위가 있으면 범위 내에서만 시크
    if (zoomedClip.value && 
        zoomedClip.value.start_time !== undefined && 
        zoomedClip.value.end_time !== undefined) {
      const startTime = zoomedClip.value.start_time;
      const endTime = zoomedClip.value.end_time;
      const clipDuration = endTime - startTime;
      
      if (clipDuration > 0) {
        // 클립 범위 내의 상대 시간 계산
        const relativeTime = (percent / 100) * clipDuration;
        // 실제 동영상의 절대 시간으로 변환
        const absoluteTime = startTime + relativeTime;
        
        // UI 업데이트는 항상 수행
        zoomCurrentTime.value = relativeTime;
        
        // 실제 currentTime 변경은 쓰로틀링 (HTTP 요청 방지)
        if (shouldSeek) {
          zoomVideoRef.value.currentTime = Math.max(startTime, Math.min(endTime, absoluteTime));
          lastSeekTime = now;
        }
      }
    } else {
      // 타임스탬프가 없으면 전체 동영상 시크
      if (isFinite(zoomDuration.value) && zoomDuration.value > 0) {
        const seekTime = (percent / 100) * zoomDuration.value;
        
        // UI 업데이트는 항상 수행
        zoomCurrentTime.value = seekTime;
        
        // 실제 currentTime 변경은 쓰로틀링 (HTTP 요청 방지)
        if (shouldSeek) {
          zoomVideoRef.value.currentTime = seekTime;
          lastSeekTime = now;
        }
      }
    }
  };
  
  updateProgress(event);
  
  const onMove = (e) => {
    if (isDragging.value) {
      updateProgress(e);
    }
  };
  
  const onEnd = (e) => {
    // 이벤트 전파를 막지 않고 드래그 중지
    stopDragging();
    if (e) {
      e.preventDefault();
    }
  };
  
  // 이벤트 리스너 함수 저장 (나중에 제거하기 위해)
  dragMoveHandler.value = onMove;
  dragEndHandler.value = onEnd;
  
  // capture: true 옵션을 사용하여 이벤트 전파가 막혀도 감지 가능하도록 함
  // 마우스 버튼을 놓을 때만 드래그 중지 (재생 바를 벗어나도 드래그 상태 유지)
  document.addEventListener('mousemove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd, { capture: true, passive: false });
  window.addEventListener('mouseup', onEnd, { capture: true, passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd, { capture: true, passive: false });
  window.addEventListener('touchend', onEnd, { capture: true, passive: false });
  
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
}

// 진행 바 드래그 중지
function stopDragging() {
  if (!isDragging.value) return;
  
  // 드래그 종료 시 최종 위치로 정확히 시크 (마지막 HTTP 요청 한 번만)
  if (zoomVideoRef.value && zoomProgressBarRef.value) {
    const percent = zoomProgress.value;
    
    if (zoomedClip.value && 
        zoomedClip.value.start_time !== undefined && 
        zoomedClip.value.end_time !== undefined) {
      const startTime = zoomedClip.value.start_time;
      const endTime = zoomedClip.value.end_time;
      const clipDuration = endTime - startTime;
      
      if (clipDuration > 0) {
        const relativeTime = (percent / 100) * clipDuration;
        const absoluteTime = startTime + relativeTime;
        zoomVideoRef.value.currentTime = Math.max(startTime, Math.min(endTime, absoluteTime));
        zoomCurrentTime.value = relativeTime;
      }
    } else {
      if (isFinite(zoomDuration.value) && zoomDuration.value > 0) {
        zoomVideoRef.value.currentTime = (percent / 100) * zoomDuration.value;
        zoomCurrentTime.value = zoomVideoRef.value.currentTime;
      }
    }
  }
  
  isDragging.value = false;
  draggedVideoId.value = null;
  
  // 이벤트 리스너 제거 (등록할 때 사용한 옵션과 동일하게)
  if (dragMoveHandler.value) {
    document.removeEventListener('mousemove', dragMoveHandler.value);
    document.removeEventListener('touchmove', dragMoveHandler.value);
    dragMoveHandler.value = null;
  }
  
  if (dragEndHandler.value) {
    document.removeEventListener('mouseup', dragEndHandler.value, { capture: true });
    window.removeEventListener('mouseup', dragEndHandler.value, { capture: true });
    document.removeEventListener('touchend', dragEndHandler.value, { capture: true });
    window.removeEventListener('touchend', dragEndHandler.value, { capture: true });
    dragEndHandler.value = null;
  }
}

// 진행 바 클릭으로 시크
function seekVideo(videoId, event) {
  if (!zoomProgressBarRef.value || !zoomVideoRef.value) return;
  const rect = zoomProgressBarRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
  zoomProgress.value = percent;
  
  // 클립의 타임스탬프 범위가 있으면 범위 내에서만 시크
  if (zoomedClip.value && 
      zoomedClip.value.start_time !== undefined && 
      zoomedClip.value.end_time !== undefined) {
    const startTime = zoomedClip.value.start_time;
    const endTime = zoomedClip.value.end_time;
    const clipDuration = endTime - startTime;
    
    if (clipDuration > 0) {
      // 클립 범위 내의 상대 시간 계산
      const relativeTime = (percent / 100) * clipDuration;
      // 실제 동영상의 절대 시간으로 변환
      const absoluteTime = startTime + relativeTime;
      zoomVideoRef.value.currentTime = Math.max(startTime, Math.min(endTime, absoluteTime));
      zoomCurrentTime.value = relativeTime;
    }
  } else {
    // 타임스탬프가 없으면 전체 동영상 시크
    if (isFinite(zoomDuration.value) && zoomDuration.value > 0) {
      zoomVideoRef.value.currentTime = (percent / 100) * zoomDuration.value;
      zoomCurrentTime.value = zoomVideoRef.value.currentTime;
    }
  }
}

// 동영상 선택 토글 함수
function allselect() {
  selectedIds.value = selectedIds.value.length === items.value.length 
    ? [] 
    : items.value.map(v => v.id);
}

function toggleVideoSelection(videoId) {
  // 드래그 선택 중이면 클릭 무시
  if (isDragSelecting.value) return;
  
  const index = selectedIds.value.indexOf(videoId);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(videoId);
  }
  
  // 현재 채팅 세션 업데이트 및 상태 저장
  updateCurrentChatVideoList();
}

// 비디오를 리스트에서 제거 (globalVideoList에서 완전히 제거)
function removeVideoFromList(videoId) {
  const video = globalVideoList.value.find(v => v.id === videoId || v.dbId === videoId);
  if (!video) {
    console.warn(`[Search] 제거할 동영상을 찾을 수 없습니다: ${videoId}`);
    return;
  }
  
  console.log(`[Search] 동영상을 리스트에서 제거: ${video.title} (id: ${videoId})`);
  
  // globalVideoList에서 제거
  const index = globalVideoList.value.findIndex(v => v.id === videoId || v.dbId === videoId);
  if (index > -1) {
    // objectUrl이 있으면 해제
    if (globalVideoList.value[index].objectUrl) {
      try {
        URL.revokeObjectURL(globalVideoList.value[index].objectUrl);
      } catch (error) {
        console.error("Failed to revoke object URL:", error);
      }
    }
    globalVideoList.value.splice(index, 1);
  }
  
  // selectedIds에서도 제거
  const selectedIndex = selectedIds.value.indexOf(videoId);
  if (selectedIndex > -1) {
    selectedIds.value.splice(selectedIndex, 1);
  }
  
  // 모든 채팅 세션의 videoList와 selectedVideoIds에서도 제거
  chatSessions.value.forEach(chat => {
    if (chat.videoList && Array.isArray(chat.videoList)) {
      chat.videoList = chat.videoList.filter(v => v.id !== videoId && v.dbId !== videoId);
    }
    if (chat.selectedVideoIds && Array.isArray(chat.selectedVideoIds)) {
      chat.selectedVideoIds = chat.selectedVideoIds.filter(id => id !== videoId);
    }
    // messages의 selectedVideos에서도 제거
    if (chat.messages && Array.isArray(chat.messages)) {
      chat.messages.forEach(message => {
        if (message.selectedVideos && Array.isArray(message.selectedVideos)) {
          message.selectedVideos = message.selectedVideos.filter(v => v.id !== videoId && v.dbId !== videoId);
        }
      });
    }
  });
  
  // 리스트 강제 리렌더링
  videoListKey.value += 1;
  
  // 페이지네이션 조정
  nextTick(() => {
    if (videoListTotalPages.value > 0 && videoListCurrentPage.value > videoListTotalPages.value) {
      videoListCurrentPage.value = videoListTotalPages.value;
    }
    if (paginatedVideoListItems.value.length === 0 && videoListCurrentPage.value > 1) {
      videoListCurrentPage.value = Math.max(1, videoListCurrentPage.value - 1);
    }
    videoListKey.value += 1;
    
    // 상태 저장
    updateCurrentChatVideoList();
    autoSaveSearchState();
  });
}

// ==================== 드래그 선택 ====================
function startDragSelect(event) {
  // 우클릭이면 무시
  if (event.button !== 0) return;
  
  // 특정 요소에서 시작된 드래그는 무시 (버튼, 링크, 입력 필드, 비디오 컨트롤 등)
  const target = event.target;
  if (
    target.closest('button') || 
    target.closest('a') || 
    target.closest('input') || 
    target.closest('textarea') || 
    target.closest('select') ||
    target.closest('.flex.items-center') && target.closest('video') ||
    target.closest('[role="button"]') ||
    target.closest('.cursor-pointer') && target.closest('.flex.items-center')
  ) {
    return;
  }
  
  // 채팅 영역에서 시작된 드래그는 무시 (텍스트 선택을 위해)
  if (chatContainer.value && chatContainer.value.contains(target)) {
    return;
  }
  
  // 텍스트 선택이 가능한 요소에서 시작된 드래그는 무시 (동영상 리스트 영역이 아닌 경우)
  // 동영상 리스트 영역이 아닌 텍스트 요소에서 시작된 드래그는 무시
  const isInVideoList = target.closest('.flex.items-center') && target.closest('video') ||
                        target.closest('[class*="video"]') ||
                        videoListGridRef.value && videoListGridRef.value.contains(target);
  
  if (!isInVideoList) {
    // 텍스트 요소에서 시작된 드래그는 무시 (텍스트 선택을 위해)
    if (target.tagName === 'P' || 
        target.tagName === 'SPAN' || 
        target.tagName === 'DIV' && !target.closest('.flex.items-center') ||
        target.tagName === 'LI' ||
        target.closest('p') ||
        target.closest('span') ||
        target.closest('pre') ||
        target.closest('code') ||
        target.closest('h1') ||
        target.closest('h2') ||
        target.closest('h3') ||
        target.closest('h4') ||
        target.closest('h5') ||
        target.closest('h6')) {
      // 텍스트 선택을 시도하는 경우 무시
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }
      // 텍스트 요소에서 시작된 드래그는 무시 (텍스트 선택을 위해)
      return;
    }
  }
  
  isDragSelecting.value = true;
  // 드래그 시작 시점의 선택 상태 저장 (파일 탐색기처럼)
  dragSelectInitialSelection.value = [...selectedIds.value];
  
  // 화면 기준 좌표 사용 (fixed positioning)
  dragSelectStart.value = {
    x: event.clientX,
    y: event.clientY
  };
  dragSelectEnd.value = { ...dragSelectStart.value };
  updateDragSelectBox();
  
  // document 레벨 이벤트 리스너 추가
  document.addEventListener('mousemove', handleDragSelectMove);
  document.addEventListener('mouseup', handleDragSelectEnd);
  
  event.preventDefault();
  event.stopPropagation();
}

function handleDragSelectMove(event) {
  if (!isDragSelecting.value) return;
  
  // 화면 기준 좌표 사용 (fixed positioning)
  dragSelectEnd.value = {
    x: event.clientX,
    y: event.clientY
  };
  updateDragSelectBox();
  // 드래그 중에는 선택 영역만 표시 (실제 선택은 하지 않음)
  
  event.preventDefault();
}

function handleDragSelectEnd(event) {
  if (!isDragSelecting.value) return;
  
  // document 레벨 이벤트 리스너 제거
  document.removeEventListener('mousemove', handleDragSelectMove);
  document.removeEventListener('mouseup', handleDragSelectEnd);
  
  // 드래그가 충분히 움직였는지 확인 (클릭과 구분)
  const moved = Math.abs(dragSelectEnd.value.x - dragSelectStart.value.x) > 3 || 
                Math.abs(dragSelectEnd.value.y - dragSelectStart.value.y) > 3;
  
  if (moved && dragSelectBox.value) {
    // 드래그 종료 시에만 선택 적용 (파일 탐색기처럼)
    applyDragSelection();
  }
  
  isDragSelecting.value = false;
  dragSelectBox.value = null;
  dragSelectInitialSelection.value = [];
  
  // 현재 채팅 세션 업데이트 및 상태 저장
  updateCurrentChatVideoList();
  
  event.preventDefault();
}

// 드래그 선택 적용 (토글 방식)
function applyDragSelection() {
  if (!dragSelectBox.value || !videoListGridRef.value) return;
  
  // 화면 기준 선택 박스
  const box = {
    left: parseFloat(dragSelectBox.value.left),
    top: parseFloat(dragSelectBox.value.top),
    right: parseFloat(dragSelectBox.value.left) + parseFloat(dragSelectBox.value.width),
    bottom: parseFloat(dragSelectBox.value.top) + parseFloat(dragSelectBox.value.height)
  };
  
  // 선택 박스와 교차하는 동영상 찾기
  paginatedVideoListItems.value.forEach(video => {
    const cardEl = videoCardRefs.value[video.id];
    if (!cardEl) return;
    
    const cardRect = cardEl.getBoundingClientRect();
    const cardBox = {
      left: cardRect.left,
      top: cardRect.top,
      right: cardRect.right,
      bottom: cardRect.bottom
    };
    
    // 카드가 선택 박스와 교차하는지 확인
    const isIntersecting = !(
      box.right < cardBox.left ||
      box.left > cardBox.right ||
      box.bottom < cardBox.top ||
      box.top > cardBox.bottom
    );
    
    // 드래그 범위에 들어간 동영상만 토글
    if (isIntersecting) {
      const index = selectedIds.value.indexOf(video.id);
      if (index > -1) {
        // 이미 선택된 동영상 → 선택 해제
        selectedIds.value.splice(index, 1);
      } else {
        // 선택되지 않은 동영상 → 선택
        selectedIds.value.push(video.id);
      }
    }
    // 드래그 범위에 들어가지 않은 동영상은 변화 없음
  });
}

function updateDragSelectBox() {
  const start = dragSelectStart.value;
  const end = dragSelectEnd.value;
  
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  
  if (width < 5 || height < 5) {
    dragSelectBox.value = null;
    return;
  }
  
  dragSelectBox.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  };
}

// 동영상 추가 버튼 핸들러
async function handleAddVideo() {
  showVideoListModal.value = true;
  selectedVideoIds.value = [];
  await loadAvailableVideos();
}

// 사용 가능한 동영상 목록 로드
async function loadAvailableVideos() {
  isLoadingVideos.value = true;
  const userId = localStorage.getItem("vss_user_id");
  
  if (!userId) {
    availableVideos.value = [];
    isLoadingVideos.value = false;
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
    if (!response.ok) throw new Error('동영상 목록 조회 실패');
    
    const data = await response.json();
    
    if (!data || !data.success || !Array.isArray(data.videos)) {
      availableVideos.value = [];
      return;
    }
    
    // file_url이 유효한 동영상만 필터링하고 현재 items에 없는 동영상만 표시
    const currentVideoIds = new Set(items.value.map(v => v.dbId || v.id));
    const validVideos = data.videos
      .filter(v => v && v.file_url && v.file_url.trim() !== '')
      .filter(v => !currentVideoIds.has(v.id))
      .map(v => {
        // ISO 형식(2026-02-23T11:12:59)에서 날짜만 추출 (2026-02-23)
        const dateValue = v.created_at || v.date || '';
        const dateOnly = dateValue ? (dateValue.includes('T') ? dateValue.split('T')[0] : dateValue) : '';
        
        return createVideoObject({
          id: v.id,
          dbId: v.id,
          title: v.title || '제목 없음',
          originUrl: v.file_url,
          displayUrl: v.file_url,
          date: dateOnly,
          fileSize: v.file_size || v.fileSize || null,
          width: v.width || null,
          height: v.height || null,
          duration: v.duration || null,
          videoId: v.video_id || null
        });
      });
    
    availableVideos.value = validVideos;
    
    // 지연 로딩: 지원하지 않는 형식의 동영상만 백그라운드에서 변환 체크
    const checkUnsupportedVideos = () => {
      validVideos.forEach((v) => {
        if (isUnsupportedFormat(v.title || '')) {
          const videoObj = availableVideos.value.find(av => av.id === v.id);
          if (videoObj) {
            // _isConverting 속성 추가
            videoObj._isConverting = false;
            // 비동기로 변환 요청 (완료를 기다리지 않음)
            convertVideoToMp4(v.id, userId, videoObj).catch(err => {
              console.warn(`동영상 변환 실패 (${v.title}):`, err);
            });
          }
        }
      });
    };
    
    // 브라우저가 유휴 상태일 때 실행
    if ('requestIdleCallback' in window) {
      requestIdleCallback(checkUnsupportedVideos, { timeout: 2000 });
    } else {
      setTimeout(checkUnsupportedVideos, 500);
    }
  } catch (error) {
    console.error('동영상 목록 로드 실패:', error);
    availableVideos.value = [];
  } finally {
    isLoadingVideos.value = false;
  }
}

// 동영상 선택 토글 (모달 내)
function toggleVideoSelectionInModal(videoId) {
  const index = selectedVideoIds.value.indexOf(videoId);
  if (index > -1) {
    selectedVideoIds.value.splice(index, 1);
  } else {
    selectedVideoIds.value.push(videoId);
  }
}

// 선택한 동영상 추가
async function addSelectedVideos() {
  const videosToAdd = availableVideos.value.filter(v => selectedVideoIds.value.includes(v.id));
  
  if (videosToAdd.length === 0) {
    closeVideoListModal();
    return;
  }
  
  // 로딩 모달 표시
  showVideosLoadingModal.value = true;
  
  try {
    const userId = localStorage.getItem("vss_user_id");
    
      videosToAdd.forEach(video => {
        // 전역 리스트에 이미 있는지 확인
        const exists = globalVideoList.value.some(v => (v.dbId || v.id) === video.id);
        if (!exists) {
          const newVideo = createVideoObject({
            id: video.id || Date.now() + Math.random(),
            dbId: video.dbId || video.id,
            title: video.title,
            originUrl: video.originUrl || video.displayUrl,
            displayUrl: video.displayUrl || video.originUrl,
            date: video.date,
            fileSize: video.fileSize,
            width: video.width,
            height: video.height,
            duration: video.duration,
            videoId: video.videoId
          });
          globalVideoList.value.push(newVideo);
        
        // 지원하지 않는 형식의 동영상 변환 체크
        if (userId && isUnsupportedFormat(video.title || '')) {
          convertVideoToMp4(video.dbId || video.id, userId, newVideo).catch(err => {
            console.warn(`동영상 변환 실패 (${video.title}):`, err);
          });
        }
      }
    });
    
    // 동영상 추가 시 기본적으로 선택 해제 상태 (선택된 동영상들을 selectedIds에 추가하지 않음)
    
    // 현재 채팅 세션 업데이트 및 상태 저장
    updateCurrentChatVideoList();
    
    // 썸네일은 백그라운드에서 로드되도록 하고, 로딩 대기 제거 (성능 개선)
    // 모달 닫기
    closeVideoListModal();
  } catch (error) {
    console.error('[Search] addSelectedVideos 오류:', error);
  } finally {
    // 로딩 모달 숨김
    showVideosLoadingModal.value = false;
    // 동영상 로드 완료 후 상태 저장 (지연 저장으로 성능 개선)
    nextTick(() => {
      setTimeout(() => {
        autoSaveSearchState();
      }, 500);
    });
  }
}

// 동영상 목록 모달 닫기
function closeVideoListModal() {
  showVideoListModal.value = false;
  selectedVideoIds.value = [];
}

// searchType 변경 시 파라미터 섹션 상태 관리
watch(searchType, (newType) => {
  if (newType === 'fast') {
    // 고속 검색: 상세 검색 파라미터 접기
    showSummarizeVlmParams.value = false;
  } else if (newType === 'detailed') {
    // 상세 검색: 고속 검색 파라미터 접기, 상세 검색 파라미터 열기
    showQueryVlmParams.value = false;
    showSummarizeVlmParams.value = true;
  } else if (newType === 'fast_vlm') {
    // 고속 검색 (VLM 분석): 상세 검색 파라미터 열기
    showSummarizeVlmParams.value = true;
  }
}, { immediate: true });

// 현재 채팅 세션의 선택 상태만 업데이트 헬퍼 함수
function updateCurrentChatVideoList() {
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (currentChat) {
    // 전역 리스트는 유지하고, 선택 상태만 저장
    currentChat.selectedVideoIds = [...selectedIds.value];
  }
}

// 상태를 저장 가능한 형태로 준비
function prepareStateForSave() {
  const serializableChatSessions = chatSessions.value.map((chat) => {
    try {
      const serializedChat = {
        id: chat.id,
        name: chat.name,
        messages: [],
        selectionSignature: chat.selectionSignature,
        selectedVideos: chat.selectedVideos || [],
        // videoList 제거: 전역 리스트 사용
        selectedVideoIds: chat.selectedVideoIds || []
      };
      
      if (chat.messages && Array.isArray(chat.messages)) {
        serializedChat.messages = chat.messages.map(msg => {
          const serializedMsg = {
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            isInitial: msg.isInitial || false
          };
          
          if (msg.clips && Array.isArray(msg.clips)) {
            serializedMsg.clips = msg.clips.map(clip => ({
              id: clip.id,
              url: clip.url || '',
              title: clip.title || '',
              start_time: clip.start_time,
              end_time: clip.end_time,
              sentence: clip.sentence || '',
              sourceVideo: clip.sourceVideo || '',
              via_response: clip.via_response || false
            }));
          }
          
          if (msg.groupedClips && Array.isArray(msg.groupedClips)) {
            serializedMsg.groupedClips = msg.groupedClips.map(group => ({
              video: group.video || '',
              clips: (group.clips || []).map(clip => ({
                id: clip.id,
                url: clip.url || '',
                title: clip.title || '',
                start_time: clip.start_time,
                end_time: clip.end_time,
                sentence: clip.sentence || '',
                via_response: clip.via_response || false
              }))
            }));
          }
          
          if (msg.selectedVideos && Array.isArray(msg.selectedVideos)) {
            serializedMsg.selectedVideos = msg.selectedVideos.map(video => ({
              id: video.id,
              dbId: video.dbId || video.id,
              title: video.title || '',
              displayUrl: video.displayUrl || '',
              date: video.date || ''
            }));
          }
          
          return serializedMsg;
        });
      }
      
      // videoList 직렬화 제거: 전역 리스트 사용
      
      return serializedChat;
    } catch (error) {
      console.error(`채팅 직렬화 실패:`, error);
      return null;
    }
  }).filter(chat => chat !== null);

  // 전역 리스트 직렬화
  const serializableItems = globalVideoList.value.map(video => ({
    id: video.id,
    dbId: video.dbId || video.id,
    title: video.title || '',
    originUrl: video.originUrl || '',
    displayUrl: video.displayUrl || '',
    date: video.date || '',
    fileSize: video.fileSize || null,
    width: video.width || null,
    height: video.height || null,
    videoId: video.videoId || null
  }));

  return {
    chatSessions: serializableChatSessions,
    currentChatIndex: currentChatIndex.value,
    searchType: searchType.value,
    items: serializableItems, // 전역 리스트
    selectedIds: selectedIds.value
  };
}

// 상태 데이터로부터 복원
function restoreStateFromData(state) {
  try {
    if (state.searchType && ['fast', 'fast_vlm', 'detailed'].includes(state.searchType)) {
      searchType.value = state.searchType;
    }
    
    if (state.chatSessions && Array.isArray(state.chatSessions)) {
      chatSessions.value = state.chatSessions;
      
      if (typeof state.currentChatIndex === 'number' && state.currentChatIndex >= 0) {
        if (state.currentChatIndex < chatSessions.value.length) {
          currentChatIndex.value = state.currentChatIndex;
        } else if (chatSessions.value.length > 0) {
          currentChatIndex.value = 0;
        } else {
          currentChatIndex.value = 0;
        }
      } else {
        currentChatIndex.value = 0;
      }
      
      // 전역 리스트 복원
      if (state.items && Array.isArray(state.items)) {
        globalVideoList.value = [...state.items];
      } else {
        globalVideoList.value = [];
      }
      
      // 현재 채팅의 선택 상태 복원
      if (chatSessions.value.length > 0) {
        const currentChat = chatSessions.value[currentChatIndex.value];
        if (currentChat) {
          if (currentChat.selectedVideoIds && Array.isArray(currentChat.selectedVideoIds)) {
            selectedIds.value = [...currentChat.selectedVideoIds];
          } else {
            selectedIds.value = [];
          }
        } else {
          selectedIds.value = [];
        }
      } else {
        if (state.selectedIds && Array.isArray(state.selectedIds)) {
          selectedIds.value = [...state.selectedIds];
        } else {
          selectedIds.value = [];
        }
      }
      
      return true;
    } else {
      // 전역 리스트 복원
      if (state.items && Array.isArray(state.items)) {
        globalVideoList.value = [...state.items];
      } else {
        globalVideoList.value = [];
      }
      if (state.selectedIds && Array.isArray(state.selectedIds)) {
        selectedIds.value = [...state.selectedIds];
      } else {
        selectedIds.value = [];
      }
      return false;
    }
  } catch (error) {
    console.error('상태 복원 실패:', error);
    return false;
  }
}

// Search 상태를 DB에 저장
async function saveSearchStateToDB() {
  try {
    const userId = localStorage.getItem("vss_user_id");
    if (!userId) return;

    const state = prepareStateForSave();
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('state_data', JSON.stringify(state));

    const response = await fetch(`${API_BASE_URL}/save-search-state`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      console.log('Search 상태 DB 저장 완료');
    }
  } catch (error) {
    console.warn('Search 상태 DB 저장 중 오류:', error);
  }
}

// Search 상태를 DB에서 불러오기
async function loadSearchStateFromDB() {
  try {
    const userId = localStorage.getItem("vss_user_id");
    if (!userId) return false;

    const response = await fetch(`${API_BASE_URL}/load-search-state?user_id=${userId}`);
    if (!response.ok) return false;

    const data = await response.json();
    if (data.success && data.state) {
      return restoreStateFromData(data.state);
    }
    return false;
  } catch (error) {
    console.warn('Search 상태 DB 불러오기 중 오류:', error);
    return false;
  }
}

// Search 상태를 localStorage에 저장
function saveSearchState() {
  try {
    const state = prepareStateForSave();
    const stateString = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, stateString);
    saveSearchStateToDB().catch(() => {});
  } catch (error) {
    console.error('Search 상태 저장 실패:', error);
  }
}

// Search 상태를 localStorage에서 복원
function loadSearchState() {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      const state = JSON.parse(savedState);
      return restoreStateFromData(state);
    }
  } catch (error) {
    console.error('Search 상태 복원 실패:', error);
  }
  return false;
}

// 상태 자동 저장 (debounce)
let autoSaveTimeout = null;
let isSaving = false;
function autoSaveSearchState() {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (isSaving || showVideosLoadingModal.value || isLoadingVideos.value || isSearching.value) return;
  
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    // 타임아웃 후에도 동영상 로드 중이거나 검색 중이면 저장하지 않음
    if (showVideosLoadingModal.value || isLoadingVideos.value || isSearching.value) return;
    
    isSaving = true;
    try {
      updateCurrentChatVideoList();
      saveSearchState();
    } finally {
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
  }, 1000); // debounce 시간을 500ms에서 1000ms로 증가 (동영상 로드 중 빈번한 저장 방지)
}

// 페이지를 떠날 때 상태 저장
function handleBeforeUnload() {
  try {
    updateCurrentChatVideoList();
    const state = prepareStateForSave();
    const stateString = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, stateString);
    saveSearchStateToDB().catch(() => {});
  } catch (error) {
    console.error('beforeunload 상태 저장 실패:', error);
  }
}

// 탭이 숨겨질 때 상태 저장
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    updateCurrentChatVideoList();
    saveSearchState();
  }
}

// history.state에서 선택된 동영상 처리 함수
async function processSelectedVideosFromHistory(ignoreIfStateRestored = false) {
  console.log('[Search] processSelectedVideosFromHistory 호출, history.state:', history.state);
  
  // 라우터 state에서 선택된 동영상 데이터 받기 (우선순위 최고)
  // ignoreIfStateRestored가 true이고 상태가 복원된 경우에는 새로고침으로 인한 중복 생성을 방지하기 위해 무시
  // 하지만 management.vue에서 검색 버튼을 클릭한 경우에는 항상 처리해야 함
  if (history.state && history.state.selectedVideos && Array.isArray(history.state.selectedVideos) && history.state.selectedVideos.length > 0) {
    console.log('[Search] history.state.selectedVideos 발견:', history.state.selectedVideos.length, '개 동영상');
    
    // 로딩 모달 표시
    showVideosLoadingModal.value = true;
    
    try {
      // ignoreIfStateRestored가 true이고 상태가 복원된 경우 스킵
    if (ignoreIfStateRestored) {
      const stateRestored = loadSearchState();
      if (stateRestored) {
        return false;
      }
    }
    const receivedVideos = history.state.selectedVideos;
    
    // history.state에 이미 동영상 정보가 있으므로 서버 재조회 제거 (성능 개선)
    // displayUrl이 없는 경우에만 서버에서 조회하도록 최적화
    const videosNeedingUrl = receivedVideos.filter(v => !v.displayUrl && !v.originUrl);
    let serverVideosMap = new Map();
    
    // displayUrl이 없는 동영상만 서버에서 조회
    if (videosNeedingUrl.length > 0) {
      const currentUserId = localStorage.getItem("vss_user_id");
      if (currentUserId) {
        try {
          const videosResponse = await fetch(`${API_BASE_URL}/videos?user_id=${currentUserId}`);
          if (videosResponse.ok) {
            const videosData = await videosResponse.json();
            if (videosData.success && videosData.videos) {
              videosData.videos.forEach(v => {
                if (v.id && v.file_url) {
                  serverVideosMap.set(v.id, v);
                }
              });
            }
          }
        } catch (error) {
          console.warn('[Search] 서버에서 동영상 정보 조회 실패:', error);
        }
      }
    }
    
    // 동영상 정보 매핑 (서버 조회는 displayUrl이 없는 경우에만)
    const mappedVideos = receivedVideos.map(video => {
      const dbId = video.dbId || video.id;
      const hasUrl = video.displayUrl || video.originUrl;
      const serverVideo = !hasUrl ? serverVideosMap.get(dbId) : null;
      
      // displayUrl이 없고 서버에서 정보를 가져온 경우에만 업데이트
      const displayUrl = serverVideo && serverVideo.file_url 
        ? serverVideo.file_url 
        : (video.displayUrl || video.originUrl || '');
      const originUrl = serverVideo && serverVideo.file_url 
        ? serverVideo.file_url 
        : (video.originUrl || video.displayUrl || '');
      
      const dateValue = serverVideo ? (serverVideo.created_at || video.date) : video.date;
      const dateOnly = dateValue ? (dateValue.includes('T') ? dateValue.split('T')[0] : dateValue) : '';
      
      return createVideoObject({
        id: video.id || video.dbId,
        dbId: dbId,
        displayUrl: displayUrl,
        originUrl: originUrl,
        title: serverVideo ? (serverVideo.title || video.title) : video.title,
        date: dateOnly,
        fileSize: serverVideo ? (serverVideo.file_size || video.fileSize) : video.fileSize,
        width: serverVideo ? (serverVideo.width || video.width) : video.width,
        height: serverVideo ? (serverVideo.height || video.height) : video.height,
        duration: serverVideo ? (serverVideo.duration || video.duration) : video.duration,
        videoId: serverVideo ? (serverVideo.video_id || video.videoId) : video.videoId
      });
    });
    
    // 동일한 동영상 리스트를 가진 채팅이 있는지 확인
    const selectionSignature = getSelectionSignature(mappedVideos);
    const existingChatIndex = chatSessions.value.findIndex(chat => 
      chat.selectionSignature === selectionSignature
    );
    
    // 전역 리스트에 동영상 추가
    mappedVideos.forEach(video => {
      const exists = globalVideoList.value.some(v => (v.dbId || v.id) === (video.dbId || video.id));
      if (!exists) {
        globalVideoList.value.push(video);
      }
    });

    if (existingChatIndex !== -1) {
      // 동일한 동영상 리스트를 가진 채팅이 있으면 해당 채팅으로 이동 (새 채팅 생성하지 않음)
      console.log('[Search] 동일한 동영상 리스트를 가진 채팅 발견, 해당 채팅으로 이동');
      currentChatIndex.value = existingChatIndex;
      const existingChat = chatSessions.value[existingChatIndex];
      // 전역 리스트는 이미 업데이트되었으므로, 선택 상태만 복원
      if (existingChat.selectedVideoIds && Array.isArray(existingChat.selectedVideoIds)) {
        selectedIds.value = [...existingChat.selectedVideoIds];
      } else {
        selectedIds.value = [];
      }
    } else {
      // 동일한 동영상 리스트를 가진 채팅이 없으면 새 채팅 생성
      console.log('[Search] 동일한 동영상 리스트를 가진 채팅이 없음, 새 채팅 생성');
      createNewChat(mappedVideos, selectionSignature);
    }
    
    // 최적화: 선택된 동영상만 파일 객체를 백그라운드에서 미리 로드 (검색 실행 시 지연 방지)
    // 모든 동영상을 로드하지 않고 선택된 동영상만 로드하여 성능 개선
    // 썸네일과 파일 객체 로드는 백그라운드에서 비동기로만 실행 (대기하지 않음)
    nextTick(() => {
      // 선택된 동영상만 파일 객체 로드 (비동기, 대기하지 않음)
      const selectedVideosToPreload = selectedVideos.value.filter(video => {
        // File 객체가 없고 displayUrl이 있는 동영상만 로드
        return !(video.file instanceof File) && video.displayUrl && !video.displayUrl.startsWith('blob:');
      });
      
      if (selectedVideosToPreload.length > 0) {
        console.log(`[Search] 선택된 ${selectedVideosToPreload.length}개 동영상 파일 객체 백그라운드 로드 시작`);
        // 배치 처리로 파일 객체 로드 (동시 요청 수 제한, 완료를 기다리지 않음)
        processBatch(selectedVideosToPreload, ensureVideoFile, 3).then(results => {
          const successCount = results.filter(r => r !== null).length;
          console.log(`[Search] 선택된 동영상 파일 객체 미리 로드 완료: ${successCount}/${selectedVideosToPreload.length}개 성공`);
        }).catch(err => {
          console.warn('[Search] 선택된 동영상 파일 객체 미리 로드 중 오류:', err);
        });
      }
    });
    
      // 지원하지 않는 형식의 동영상 변환 체크
    if (currentUserId) {
      const checkUnsupportedVideos = () => {
        mappedVideos.forEach((video) => {
          if (isUnsupportedFormat(video.title || '')) {
            const videoObj = items.value.find(v => v.id === video.id);
            if (videoObj) {
              convertVideoToMp4(video.dbId || video.id, currentUserId, videoObj).catch(err => {
                console.warn(`동영상 변환 실패 (${video.title}):`, err);
              });
            }
          }
        });
      };
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(checkUnsupportedVideos, { timeout: 2000 });
      } else {
        setTimeout(checkUnsupportedVideos, 500);
      }
    }
    
      // history.state에서 selectedVideos 제거 (중복 처리 방지)
      const currentState = history.state || {};
      if (currentState.selectedVideos) {
        const newState = { ...currentState };
        delete newState.selectedVideos;
        history.replaceState(newState, '');
      }
      
      // 로딩 모달 숨김
      showVideosLoadingModal.value = false;
      
      // 동영상 로드 완료 후 상태 저장 (지연 저장으로 성능 개선)
      nextTick(() => {
        setTimeout(() => {
          autoSaveSearchState();
        }, 500);
      });
      
      return true; // 동영상이 처리되었음을 반환
    } catch (error) {
      console.error('[Search] processSelectedVideosFromHistory 오류:', error);
      // 에러가 발생해도 로딩 모달 숨김
      showVideosLoadingModal.value = false;
      return false;
    }
  }
  return false; // 동영상이 처리되지 않았음을 반환
}

// 샘플 검색어 선택 함수
const selectSampleQuery = (query) => {
  searchInput.value = query;
  showStarTooltip.value = false;
};

// 외부 클릭 시 별 아이콘 말풍선 닫기
const handleClickOutside = (event) => {
  if (starTooltipRef.value && !starTooltipRef.value.contains(event.target)) {
    showStarTooltip.value = false;
  }
};

onMounted(async () => {
  console.log('[Search] onMounted 호출, history.state:', history.state);
  
  // 전체 화면에서 드래그 선택 시작 가능하도록 document 레벨 이벤트 리스너 추가
  document.addEventListener('mousedown', startDragSelect);
  // 외부 클릭 감지를 위한 이벤트 리스너 추가
  document.addEventListener('click', handleClickOutside);
  
  // history.state.selectedVideos 확인 함수
  const checkHistoryState = async () => {
    const hasHistoryVideos = history.state && history.state.selectedVideos && Array.isArray(history.state.selectedVideos) && history.state.selectedVideos.length > 0;
    console.log('[Search] checkHistoryState - hasHistoryVideos:', hasHistoryVideos);
    return hasHistoryVideos;
  };
  
  // 먼저 즉시 확인
  let hasHistoryVideos = await checkHistoryState();
  
  // state가 아직 설정되지 않았을 수 있으므로 약간의 지연 후 다시 확인
  if (!hasHistoryVideos) {
    await new Promise(resolve => setTimeout(resolve, 300));
    hasHistoryVideos = await checkHistoryState();
  }
  
  // 먼저 기존 저장된 상태를 복원 (history.state.selectedVideos가 있어도 먼저 복원)
  // 이렇게 하면 기존 채팅 세션이 먼저 복원되고, 그 후에 새 동영상이 적절히 처리됨
  if (chatSessions.value.length === 0) {
    console.log('[Search] onMounted: 채팅 세션이 없음, 상태 복원 시도');
    
    // 상태 복원 전에 동영상이 있는지 확인하여 로딩 모달 표시
    const tempState = localStorage.getItem(STORAGE_KEY);
    let hasVideosToLoad = false;
    if (tempState) {
      try {
        const parsedState = JSON.parse(tempState);
        if (parsedState.items && Array.isArray(parsedState.items) && parsedState.items.length > 0) {
          hasVideosToLoad = true;
        }
      } catch (_e) {
        // 파싱 실패 시 무시
      }
    }
    
    if (hasVideosToLoad) {
      showVideosLoadingModal.value = true;
    }
    
    try {
      // 성능 개선: localStorage를 먼저 시도 (더 빠름), 실패 시 DB에서 로드
      const stateRestored = loadSearchState() || await loadSearchStateFromDB();
      
      if (stateRestored) {
        console.log('[Search] onMounted: 상태 복원 성공, 채팅 세션 수:', chatSessions.value.length);
        
        // 썸네일은 백그라운드에서 로드되도록 하고, 로딩 대기 제거 (성능 개선)
      } else {
        console.log('[Search] onMounted: 상태 복원 실패');
      }
    } finally {
      if (hasVideosToLoad) {
        showVideosLoadingModal.value = false;
        // 동영상 로드 완료 후 상태 저장 (지연 저장으로 성능 개선)
        nextTick(() => {
          setTimeout(() => {
            autoSaveSearchState();
          }, 500);
        });
      }
    }
  } else {
    console.log('[Search] onMounted: 기존 채팅 세션 존재, 채팅 세션 수:', chatSessions.value.length);
  }
  
  // history.state.selectedVideos가 있으면 처리 (management.vue에서 검색 버튼 클릭 시)
  // 이 경우 기존 상태를 덮어쓰지 않고, 기존 채팅에 추가하거나 동일한 채팅으로 전환
  let videosProcessed = false;
  if (hasHistoryVideos) {
    console.log('[Search] onMounted: history.state.selectedVideos 처리 시작, 현재 채팅 세션 수:', chatSessions.value.length);
    videosProcessed = await processSelectedVideosFromHistory(false);
    console.log('[Search] onMounted: videosProcessed:', videosProcessed, ', 현재 채팅 세션 수:', chatSessions.value.length);
  } else {
    console.log('[Search] onMounted: history.state.selectedVideos가 없습니다');
  }
  
  // history.state.selectedVideos가 없거나 처리되지 않은 경우, 그리고 채팅 세션이 여전히 없는 경우 초기 채팅 세션 생성
  if (!videosProcessed && chatSessions.value.length === 0) {
    console.log('[Search] onMounted: 채팅 세션이 없고 videosProcessed도 false, 초기 채팅 세션 생성');
    if (items.value.length > 0) {
      const selectionSignature = getSelectionSignature(items.value);
      createNewChat(items.value, selectionSignature);
    } else {
      createNewChat([], 'none');
    }
  } else if (!videosProcessed && chatSessions.value.length > 0) {
    // 채팅 세션이 있으면 현재 채팅의 선택 상태만 복원
    // 전역 리스트는 이미 복원되었으므로 선택 상태만 업데이트
    const currentChat = chatSessions.value[currentChatIndex.value];
    if (currentChat) {
      if (currentChat.selectedVideoIds && Array.isArray(currentChat.selectedVideoIds)) {
        selectedIds.value = [...currentChat.selectedVideoIds];
      } else {
        selectedIds.value = [];
      }
    }
  }
  
  // 다른 메뉴가 열렸을 때 컨텍스트 메뉴 닫기
  window.addEventListener('profile-menu-opened', closeChatMessageContextMenu);
  window.addEventListener('profile-menu-opened', closeVideoListContextMenu);
  window.addEventListener('video-context-menu-opened', closeChatMessageContextMenu);
  window.addEventListener('chat-message-context-menu-opened', closeChatMessageContextMenu);
  
  // 컨텍스트 메뉴 밖 클릭 시 닫기
  document.addEventListener('click', handleClickOutsideContextMenu);
  
  // 페이지를 떠날 때 상태 저장
  window.addEventListener('beforeunload', handleBeforeUnload);
  // 탭이 숨겨질 때 상태 저장
  window.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 주기적 메모리 정리 시작
  startPeriodicMemoryCleanup();
  
  nextTick(() => {
    scrollToBottom();
    // 모든 동영상의 duration 미리 로드
    if (items.value.length > 0) {
      preloadAllVideoDurations();
    }
  });
});

// 컴포넌트가 활성화될 때마다 history.state.selectedVideos 확인
onActivated(async () => {
  console.log('[Search] onActivated 호출, history.state:', history.state);
  
  const hasHistoryVideos = history.state && history.state.selectedVideos && Array.isArray(history.state.selectedVideos) && history.state.selectedVideos.length > 0;
  
  // 먼저 기존 저장된 상태를 복원 (history.state.selectedVideos가 있어도 먼저 복원)
  // 이렇게 하면 기존 채팅 세션이 먼저 복원되고, 그 후에 새 동영상이 적절히 처리됨
  // 채팅 세션이 없거나 비어있으면 기존 상태 복원 시도
  if (chatSessions.value.length === 0) {
    console.log('[Search] onActivated: 채팅 세션이 없음, 상태 복원 시도');
    
    // 상태 복원 전에 동영상이 있는지 확인하여 로딩 모달 표시
    const tempState = localStorage.getItem(STORAGE_KEY);
    let hasVideosToLoad = false;
    if (tempState) {
      try {
        const parsedState = JSON.parse(tempState);
        if (parsedState.items && Array.isArray(parsedState.items) && parsedState.items.length > 0) {
          hasVideosToLoad = true;
        }
      } catch (_e) {
        // 파싱 실패 시 무시
      }
    }
    
    if (hasVideosToLoad) {
      showVideosLoadingModal.value = true;
    }
    
    try {
      // 성능 개선: localStorage를 먼저 시도 (더 빠름), 실패 시 DB에서 로드
      const stateRestored = loadSearchState() || await loadSearchStateFromDB();
      
      if (stateRestored) {
        console.log('[Search] onActivated: 상태 복원 성공, 채팅 세션 수:', chatSessions.value.length);
        
        // 썸네일은 백그라운드에서 로드되도록 하고, 로딩 대기 제거 (성능 개선)
      } else {
        console.log('[Search] onActivated: 상태 복원 실패');
      }
      
      if (!stateRestored && !hasHistoryVideos) {
        // 상태가 복원되지 않았고 history.state.selectedVideos도 없으면 초기 채팅 세션 생성
        if (items.value.length > 0) {
          const selectionSignature = getSelectionSignature(items.value);
          createNewChat(items.value, selectionSignature);
        } else {
          createNewChat([], 'none');
        }
      }
    } finally {
      if (hasVideosToLoad) {
        showVideosLoadingModal.value = false;
        // 동영상 로드 완료 후 상태 저장 (지연 저장으로 성능 개선)
        nextTick(() => {
          setTimeout(() => {
            autoSaveSearchState();
          }, 500);
        });
      }
    }
  } else {
    console.log('[Search] onActivated: 기존 채팅 세션 존재, 채팅 세션 수:', chatSessions.value.length);
  }
  
  // history.state.selectedVideos가 있으면 처리 (management.vue에서 검색 버튼 클릭 시)
  // 이 경우 기존 상태를 덮어쓰지 않고, 기존 채팅에 추가하거나 동일한 채팅으로 전환
  if (hasHistoryVideos) {
    console.log('[Search] onActivated: history.state.selectedVideos 처리 시작, 현재 채팅 세션 수:', chatSessions.value.length);
    await processSelectedVideosFromHistory(false);
    console.log('[Search] onActivated: history.state.selectedVideos 처리 완료, 현재 채팅 세션 수:', chatSessions.value.length);
  }
});

// Management 메뉴에서 동영상 삭제 시 동기화 (useVideoSync 사용)
// composable은 setup 스크립트 최상위에서 호출해야 함
// items는 globalVideoList의 computed이므로, globalVideoList를 직접 업데이트해야 함
useVideoSync(globalVideoList, selectedIds, chatSessions, {
  updateVideoList: () => {
    // globalVideoList가 이미 useVideoSync에서 업데이트되었으므로 리렌더링만 수행
    videoListKey.value += 1;
    nextTick(() => {
      videoListKey.value += 1;
    });
  },
  updateChatSessions: (deletedIds, deletedDbIds) => {
    // 채팅 세션에서 삭제된 비디오 제거
    chatSessions.value.forEach(chat => {
      if (chat.videoList && Array.isArray(chat.videoList)) {
        chat.videoList = chat.videoList.filter(video => {
          const videoId = video.id;
          const videoDbId = video.dbId;
          return !isVideoDeleted(videoId, videoDbId, deletedIds, deletedDbIds);
        });
      }
      
      if (chat.selectedVideoIds && Array.isArray(chat.selectedVideoIds)) {
        chat.selectedVideoIds = chat.selectedVideoIds.filter(id => {
          if (id == null) return true;
          const idStr = String(id);
          const idNum = !isNaN(Number(id)) ? Number(id) : null;
          return !deletedIds.has(id) && 
                 !deletedIds.has(idStr) && 
                 !deletedIds.has(idNum) &&
                 !deletedDbIds.has(id) && 
                 !deletedDbIds.has(idStr) && 
                 !deletedDbIds.has(idNum);
        });
      }
      
      if (chat.messages && Array.isArray(chat.messages)) {
        chat.messages.forEach(message => {
          if (message.selectedVideos && Array.isArray(message.selectedVideos)) {
            message.selectedVideos = message.selectedVideos.filter(video => {
              const videoId = video.id;
              const videoDbId = video.dbId;
              return !isVideoDeleted(videoId, videoDbId, deletedIds, deletedDbIds);
            });
          }
        });
      }
    });
    updateCurrentChatVideoList();
  },
  onVideoDeleted: (_deletedIds, _deletedDbIds) => {
    // 페이지네이션 조정
    nextTick(() => {
      if (videoListTotalPages.value > 0 && videoListCurrentPage.value > videoListTotalPages.value) {
        videoListCurrentPage.value = videoListTotalPages.value;
      }
      if (paginatedVideoListItems.value.length === 0 && videoListCurrentPage.value > 1) {
        videoListCurrentPage.value = Math.max(1, videoListCurrentPage.value - 1);
      }
      autoSaveSearchState();
    });
  }
});

// 상태 변경 감지하여 자동 저장
watch(chatSessions, () => {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (!isSaving && !showVideosLoadingModal.value && !isLoadingVideos.value && !isSearching.value) {
    autoSaveSearchState();
  }
}, { deep: true });

watch(currentChatIndex, () => {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (!isSaving && !showVideosLoadingModal.value && !isLoadingVideos.value && !isSearching.value) {
    autoSaveSearchState();
  }
});

watch(items, () => {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (!isSaving && !showVideosLoadingModal.value && !isLoadingVideos.value && !isSearching.value) {
    autoSaveSearchState();
  }
  // items가 변경될 때 화면에 보이는 동영상의 duration 우선 로드
  if (items.value.length > 0) {
    nextTick(() => {
      // 화면에 보이는 비디오만 우선 로드 (나머지는 백그라운드에서 처리)
      preloadAllVideoDurations();
    });
  }
}, { deep: true });

watch(selectedIds, () => {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (!isSaving && !showVideosLoadingModal.value && !isLoadingVideos.value && !isSearching.value) {
    autoSaveSearchState();
  }
  
  // 최적화: 선택된 동영상의 파일 객체를 미리 로드 (검색 실행 시 지연 방지)
  // 배치 처리로 동시 요청 수 제한하여 성능 개선
  const selectedVideosList = selectedVideos.value;
  if (selectedVideosList.length > 0) {
    const videosToPreload = selectedVideosList.filter(video => {
      // File 객체가 없고 displayUrl이 있는 동영상만 로드
      return !(video.file instanceof File) && video.displayUrl && !video.displayUrl.startsWith('blob:');
    });
    
    if (videosToPreload.length > 0) {
      console.log(`[Search] 선택된 ${videosToPreload.length}개 동영상 파일 객체 미리 로드 시작`);
      // 배치 처리로 파일 객체 로드 (동시 요청 수 제한)
      processBatch(videosToPreload, ensureVideoFile, 3).then(results => {
        const successCount = results.filter(r => r !== null).length;
        console.log(`[Search] 선택된 동영상 파일 객체 미리 로드 완료: ${successCount}/${videosToPreload.length}개 성공`);
      }).catch(err => {
        console.warn('[Search] 선택된 동영상 파일 객체 미리 로드 중 오류:', err);
      });
    }
  }
}, { deep: true });

watch(searchType, () => {
  // 동영상 로드 중이거나 검색 중이면 저장하지 않음 (성능 개선)
  if (!isSaving && !showVideosLoadingModal.value && !isLoadingVideos.value && !isSearching.value) {
    autoSaveSearchState();
  }
});

// 페이지네이션: items나 videoListItemsPerPage 변경 시 현재 페이지 조정
watch([items, videoListItemsPerPage, videoListTotalPages], () => {
  if (videoListCurrentPage.value > videoListTotalPages.value && videoListTotalPages.value > 0) {
    videoListCurrentPage.value = videoListTotalPages.value;
  }
});

// Management 메뉴에서 동영상 삭제 시 동기화는 useVideoSync composable이 처리합니다.
// 중복된 handleVideosDeletedFromManagement 함수는 제거되었습니다.

// 컴포넌트 언마운트 전 상태 저장
// Blob URL 정리 함수
function cleanupBlobUrls() {
  let cleanedCount = 0;
  
  // 전역 동영상 리스트의 Blob URL 정리
  globalVideoList.value.forEach(video => {
    if (video.objectUrl) {
      try {
        URL.revokeObjectURL(video.objectUrl);
        video.objectUrl = null;
        cleanedCount++;
      } catch (e) {
        console.warn('Blob URL 정리 실패:', e);
      }
    }
    // displayUrl이 blob:으로 시작하는 경우도 정리
    if (video.displayUrl && video.displayUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(video.displayUrl);
        if (video.originUrl && !video.originUrl.startsWith('blob:')) {
          video.displayUrl = video.originUrl;
        } else {
          video.displayUrl = null;
        }
        cleanedCount++;
      } catch (e) {
        console.warn('Blob URL 정리 실패:', e);
      }
    }
  });
  
  if (cleanedCount > 0) {
    console.log(`[Search] Blob URL ${cleanedCount}개 정리 완료`);
  }
}

// 주기적 메모리 정리 함수 (1시간마다)
let memoryCleanupInterval = null;

function startPeriodicMemoryCleanup() {
  // 이미 실행 중이면 중복 방지
  if (memoryCleanupInterval) {
    return;
  }
  
  // 1시간마다 메모리 정리 (3600000ms = 1시간)
  memoryCleanupInterval = setInterval(() => {
    console.log('[Search] 주기적 메모리 정리 시작');
    
    // 1. Blob URL 정리
    cleanupBlobUrls();
    
    // 2. 모든 채팅 세션의 오래된 메시지 정리
    chatSessions.value.forEach((chat, index) => {
      cleanupOldMessages(index);
    });
    
    // 3. 채팅 세션 개수 제한 확인 (최대 개수 초과 시 오래된 채팅 삭제)
    if (chatSessions.value.length > MAX_CHAT_SESSIONS) {
      const excessCount = chatSessions.value.length - MAX_CHAT_SESSIONS;
      for (let i = 0; i < excessCount; i++) {
        const oldestChat = chatSessions.value[0];
        
        // 클립 URL 수집 및 삭제
        if (oldestChat && oldestChat.messages) {
          const clipUrls = new Set();
          oldestChat.messages.forEach(message => {
            if (message.clips && Array.isArray(message.clips)) {
              message.clips.forEach(clip => {
                if (clip.url && !clip.via_response) {
                  clipUrls.add(clip.url);
                }
              });
            }
            if (message.groupedClips && Array.isArray(message.groupedClips)) {
              message.groupedClips.forEach(group => {
                if (group.clips && Array.isArray(group.clips)) {
                  group.clips.forEach(clip => {
                    if (clip.url && !clip.via_response) {
                      clipUrls.add(clip.url);
                    }
                  });
                }
              });
            }
          });
          
          if (clipUrls.size > 0) {
            fetch(`${API_BASE_URL}/delete-clips`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clip_urls: Array.from(clipUrls) })
            }).catch(err => console.warn('주기적 정리: 오래된 채팅 클립 삭제 실패:', err));
          }
        }
        
        chatSessions.value.shift();
      }
      
      // 현재 인덱스 조정
      if (currentChatIndex.value >= chatSessions.value.length) {
        currentChatIndex.value = Math.max(0, chatSessions.value.length - 1);
      }
      
      console.log(`[Search] 주기적 정리: ${excessCount}개 오래된 채팅 세션 삭제`);
    }
    
    // 4. 강제 가비지 컬렉션 힌트 (브라우저가 지원하는 경우)
    if (window.gc) {
      try {
        window.gc();
      } catch (_e) {
        // 무시
      }
    }
    
    console.log('[Search] 주기적 메모리 정리 완료');
  }, 3600000); // 1시간 = 3600000ms
  
  console.log('[Search] 주기적 메모리 정리 시작 (1시간마다 실행)');
}

function stopPeriodicMemoryCleanup() {
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = null;
    console.log('[Search] 주기적 메모리 정리 중지');
  }
}

onBeforeUnmount(() => {
  // 주기적 메모리 정리 중지
  stopPeriodicMemoryCleanup();
  
  // Blob URL 정리
  cleanupBlobUrls();
  
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  if (titleCheckDebounceTimer.value) {
    clearTimeout(titleCheckDebounceTimer.value);
  }
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('visibilitychange', handleVisibilityChange);
  // 별 아이콘 말풍선 외부 클릭 이벤트 리스너 제거
  document.removeEventListener('click', handleClickOutside);
  // useVideoSync가 이벤트 리스너를 관리하므로 별도 제거 불필요
  document.removeEventListener('click', handleClickOutsideContextMenu);
  
  // document 레벨 이벤트 리스너 제거
  document.removeEventListener('mousedown', startDragSelect);
  document.removeEventListener('mousemove', handleDragSelectMove);
  document.removeEventListener('mouseup', handleDragSelectEnd);
  
  // 드래그 이벤트 리스너 정리
  if (dragMoveHandler.value) {
    document.removeEventListener('mousemove', dragMoveHandler.value);
    document.removeEventListener('touchmove', dragMoveHandler.value);
  }
  if (dragEndHandler.value) {
    document.removeEventListener('mouseup', dragEndHandler.value, { capture: true });
    window.removeEventListener('mouseup', dragEndHandler.value, { capture: true });
    document.removeEventListener('touchend', dragEndHandler.value, { capture: true });
    window.removeEventListener('touchend', dragEndHandler.value, { capture: true });
  }
  
  updateCurrentChatVideoList();
  saveSearchState();
});


</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
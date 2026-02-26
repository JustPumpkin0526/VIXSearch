<template>
  <!-- 메뉴 틀 -->
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-925 p-10">
    <div class="w-full h-[calc(100vh-5rem)] bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-inner p-10">
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
          class="min-w-[320px] bg-white dark:bg-gray-800 rounded-l-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Video List</h2>
              <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
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
            <!-- 설정 버튼 -->
            <button @click="showSearchSettingModal = true" :title="settingStore.language === 'ko' ? '설정' : 'Settings'"
              class="w-9 h-9 flex items-center justify-center bg-slate-200/70 dark:bg-gray-700 hover:bg-slate-400/80 dark:hover:bg-gray-600 border border-slate-500/60 dark:border-gray-600 text-slate-100 dark:text-gray-200 backdrop-blur-md rounded-full shadow transition-all duration-200">
              <img :src="settingIcon" alt="설정" class="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <div v-if="items.length === 0" class="flex items-center justify-center h-full">
              <div class="text-sm text-gray-500 dark:text-gray-400 text-center">
                동영상이 없습니다.<br />
                Management 메뉴에서 동영상을 선택하고 검색 버튼을 클릭하세요.
            </div>
            </div>
            <div v-else class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${videoListColumns}, minmax(0, 1fr))` }">
              <div v-for="video in paginatedVideoListItems" :key="video.id"
                class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
                :class="{ 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50 dark:bg-blue-900/30': selectedIds.includes(video.id) }"
                @click="toggleVideoSelection(video.id)">
                <!-- 이미지 파일인 경우 -->
                <img 
                  v-if="isImageFile(video) && video.displayUrl"
                  :src="video.displayUrl"
                  class="w-24 h-16 object-cover rounded flex-shrink-0"
                  crossorigin="anonymous"
                  draggable="false"
                  alt=""
                />
                <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))"
                  class="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex flex-col items-center justify-center">
                  <div v-if="video._isConverting" class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400 mb-1"></div>
                  <svg v-else class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <!-- 동영상인 경우 -->
                <video 
                  v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                  :src="video.displayUrl" 
                  class="w-24 h-16 object-cover rounded flex-shrink-0"
                  crossorigin="anonymous"
                  preload="metadata"
                  draggable="false"
                  @loadedmetadata="(e) => { if (e.target && isFinite(e.target.duration) && e.target.duration > 0) video.duration = e.target.duration; }"
                ></video>
                <div v-else class="w-24 h-16 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
                  <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ video.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ video.date }}</p>
                </div>
                <div class="flex-shrink-0">
                  <div v-if="selectedIds.includes(video.id)"
                    class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div v-else class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 페이지네이션 -->
          <!-- 예시 이미지 촬영용: ENABLE_DEMO_MODE가 true일 때 항상 표시 -->
          <div v-if="ENABLE_DEMO_MODE || videoListTotalPages > 1" class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2">
            <button
              @click="videoListCurrentPage = Math.max(1, videoListCurrentPage - 1)"
              :disabled="videoListCurrentPage === 1"
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '이전 페이지' : 'Previous Page'">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div class="flex items-center gap-1">
              <button
                v-for="page in videoListTotalPages"
                :key="page"
                @click="videoListCurrentPage = page"
                :class="{
                  'bg-blue-500 text-white': videoListCurrentPage === page,
                  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700': videoListCurrentPage !== page
                }"
                class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors min-w-[40px]">
                {{ page }}
              </button>
            </div>
            
            <button
              @click="videoListCurrentPage = Math.min(videoListTotalPages, videoListCurrentPage + 1)"
              :disabled="videoListCurrentPage === videoListTotalPages"
              class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '다음 페이지' : 'Next Page'">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                class="px-3 py-1.5 rounded-t-xl text-sm font-medium transition-all duration-300 whitespace-nowrap flex items-center gap-2 cursor-pointer transform hover:scale-105">
                <!-- 편집 모드 -->
                <input v-if="editingChatIndex === index" v-model="editingChatName" @blur="saveChatName(index)"
                  @keydown.enter="saveChatName(index)" @keydown.esc="cancelEditChatName"
                  class="bg-transparent border-b border-current outline-none min-w-[60px] max-w-[120px] text-sm"
                  ref="chatNameInput" />
                <!-- 일반 모드 -->
                <span v-else @dblclick.stop="startEditChatName(index)" class="select-none">
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
                  'bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-gray-200 dark:border-gray-700 max-w-[80%] relative': message.role === 'assistant',
                  'bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md': message.role === 'user'
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
                        :src="video.displayUrl" 
                        class="w-32 h-20 object-cover rounded flex-shrink-0"
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
                      <!-- 동영상인 경우 -->
                      <video 
                        v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                        :src="video.displayUrl" 
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
                        <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ video.title }}</p>
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
                      <video :src="clip.url" class="w-32 h-20 object-cover rounded cursor-pointer flex-shrink-0" preload="metadata"
                        @click.stop="zoomClip(clip)"
                        @error="(e) => console.warn('clip thumbnail error', e, clip.url)"
                        crossorigin="anonymous"></video>
                      <div class="flex-1 min-w-0">
                        <p
                          :class="message.role === 'assistant' ? 'text-sm font-medium text-gray-800 dark:text-gray-200 truncate' : 'text-sm font-medium text-white truncate'">
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
            <div class="mb-2">
              <span>
                {{ settingStore.language === 'ko' ? '검색 타입' : 'Search Type' }} :
              </span>
              <select 
                v-model="searchType"
                class="w-50 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent text-sm"
              >
                <option value="fast">{{ settingStore.language === 'ko' ? '고속 검색' : 'Fast Search' }}</option>
                <option value="fast_vlm">{{ settingStore.language === 'ko' ? '고속 검색 (VLM 분석)' : 'Fast Search (VLM Analysis)' }}</option>
                <option value="detailed">{{ settingStore.language === 'ko' ? '상세 검색' : 'Detailed Search' }}</option>
              </select>
            </div>
            <div class="flex items-end gap-2">
              <div class="flex-1 relative">
                <!-- textarea를 flex 컨테이너로 변경하여 이미지와 텍스트 입력을 함께 표시 -->
                <div 
                  class="w-full border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-green-500 dark:focus-within:ring-green-400 focus-within:border-transparent overflow-hidden flex flex-col"
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
                      class="absolute right-2 bottom-2 p-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-md">
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
                {{ settingStore.language === 'ko' ? '보고서 제목 입력' : 'Enter Report Title' }}
              </h3>
              <input
                v-model="reportTitleInput"
                type="text"
                :placeholder="settingStore.language === 'ko' ? '보고서 제목을 입력하세요' : 'Enter report title'"
                :class="[
                  'w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 mb-1',
                  reportTitleError 
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-green-500 dark:focus:ring-green-400'
                ]"
                @input="checkReportTitle"
                @keyup.enter="confirmReportTitle"
                autofocus
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

    <!-- 동영상 목록 모달 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showVideoListModal" 
             class="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm"
             @mousedown="(e) => handleModalBackgroundClick(e, closeVideoListModal)"
             @mouseup="(e) => handleModalBackgroundClick(e, closeVideoListModal)">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
               @mousedown.stop
               @mouseup.stop>
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200 overflow-hidden whitespace-nowrap">
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
                  <!-- 이미지 파일인 경우 -->
                  <img 
                    v-if="isImageFile(video) && video.displayUrl"
                    :src="video.displayUrl"
                    class="w-24 h-16 object-cover rounded flex-shrink-0"
                    crossorigin="anonymous"
                    draggable="false"
                    alt=""
                  />
                  <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                  <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))"
                    class="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex flex-col items-center justify-center">
                    <div v-if="video._isConverting" class="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400 mb-1"></div>
                    <svg v-else class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <!-- 동영상인 경우 -->
                  <video 
                    v-else-if="video.displayUrl && !isImageFile(video) && (!isUnsupportedFormat(video.title || '') || video.displayUrl?.includes('converted-videos'))" 
                    :src="video.displayUrl" 
                    class="w-24 h-16 object-cover rounded flex-shrink-0"
                    crossorigin="anonymous"
                    preload="metadata"
                    draggable="false"
                    @loadedmetadata="(e) => { if (e.target && isFinite(e.target.duration) && e.target.duration > 0) video.duration = e.target.duration; }"
                  ></video>
                  <div v-else class="w-24 h-16 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ video.title }}</p>
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
                  <video v-if="zoomedVideo" ref="zoomVideoRef" :src="zoomedVideo.displayUrl"
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
                        class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[50vw]">{{ zoomedVideo.title
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
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[60vw] mx-4 max-h-[90vh] overflow-hidden flex flex-col"
               @mousedown.stop
               @mouseup.stop>
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-bold text-gray-800 dark:text-gray-200 overflow-hidden whitespace-nowrap">
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
                              <select v-model.number="settingStore.summarizeChunk" class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all">
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
                              <input v-model.number="settingStore.summarizeTopk" type="number" min="1" max="1000" step="1"
                                @input="clampSummarizeValue('summarizeTopk', 1000, 1)"
                                class="border-2 border-emerald-300 dark:border-emerald-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Top-p</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 top-p 샘플링 질량' : 'The top-p sampling mass used for text generation' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeTopp" type="number" min="0" max="1" step="0.1"
                                  @input="clampSummarizeValue('summarizeTopp', 1, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeTopP">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeTopp" type="range" min="0" max="1" step="0.05"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Temperature</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 샘플링 온도' : 'The sampling temperature to use for text generation' }}</p>
                              <div class="flex items-center gap-2 mb-2">
                                <input v-model.number="settingStore.summarizeTemp" type="number" min="0" max="2" step="0.1"
                                  @input="clampSummarizeValue('summarizeTemp', 2, 0)"
                                  class="border-2 border-emerald-300 dark:border-emerald-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeTemperature">↺</button>
                              </div>
                              <div class="flex items-center gap-2 h-8">
                                <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.summarizeTemp" type="range" min="0" max="2" step="0.1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-8 text-center">2</span>
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
                                  <input v-model.number="settingStore.summarizeMaxTokens" type="number" min="1" max="2048" step="1"
                                    @input="clampSummarizeValue('summarizeMaxTokens', 2048, 1)"
                                    class="border-2 border-emerald-300 dark:border-emerald-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                  <button class="border-2 border-emerald-300 dark:border-emerald-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center" @click="resetSummarizeMaxTokens">↺</button>
                                </div>
                              </div>
                              <div class="flex items-center gap-2 h-8 mt-3">
                                <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                <input v-model.number="settingStore.summarizeMaxTokens" type="range" min="1" max="2048" step="1"
                                  class="flex-1 border-emerald-300 dark:border-emerald-600" />
                                <span class="text-xs text-gray-400 w-12 text-center">2048</span>
                              </div>
                            </section>

                            <section class="rounded-lg border border-emerald-200 dark:border-emerald-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                              <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Seed</h2>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '샘플링에 사용할 시드 값' : 'Seed value to use for sampling' }}</p>
                              <input v-model.number="settingStore.summarizeSeed" type="number" min="1" max="4294967295" step="1"
                                @input="clampSummarizeValue('summarizeSeed', 4294967295, 1)"
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
                        
                        <!-- Clip Duration 설정 -->
                        <div class="grid lg:grid-cols-2 gap-4 mt-4">
                          <!-- Min Clip Duration -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                              <div>
                                <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Min Clip Duration' : 'Min Clip Duration' }}</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '최소 클립 길이 (초)' : 'Minimum clip duration (seconds)' }}</p>
                              </div>
                              <div class="flex items-center gap-2">
                                <input 
                                  v-model.number="minClipDuration" 
                                  type="number" 
                                  min="0.1" 
                                  max="60" 
                                  step="0.1"
                                  @input="clampMinClipDuration"
                                  class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                />
                                <button 
                                  class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" 
                                  @click="resetMinClipDuration"
                                >↺</button>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 h-8 mt-3">
                              <span class="text-xs text-gray-400 w-8 text-center">0.1</span>
                              <input 
                                v-model.number="minClipDuration" 
                                type="range" 
                                min="0.1" 
                                max="60" 
                                step="0.1"
                                class="flex-1 border-blue-300 dark:border-blue-600" 
                              />
                              <span class="text-xs text-gray-400 w-12 text-center">60</span>
                            </div>
                          </section>
                          
                          <!-- Max Clip Duration -->
                          <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                              <div>
                                <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Max Clip Duration' : 'Max Clip Duration' }}</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '최대 클립 길이 (초)' : 'Maximum clip duration (seconds)' }}</p>
                              </div>
                              <div class="flex items-center gap-2">
                                <input 
                                  v-model.number="maxClipDuration" 
                                  type="number" 
                                  min="1" 
                                  max="300" 
                                  step="1"
                                  @input="clampMaxClipDuration"
                                  class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" 
                                />
                                <button 
                                  class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" 
                                  @click="resetMaxClipDuration"
                                >↺</button>
                              </div>
                            </div>
                            <div class="flex items-center gap-2 h-8 mt-3">
                              <span class="text-xs text-gray-400 w-8 text-center">1</span>
                              <input 
                                v-model.number="maxClipDuration" 
                                type="range" 
                                min="1" 
                                max="300" 
                                step="1"
                                class="flex-1 border-blue-300 dark:border-blue-600" 
                              />
                              <span class="text-xs text-gray-400 w-12 text-center">300</span>
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
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from "vue";
import { useRoute } from 'vue-router';
import { useSettingStore } from '@/stores/settingStore';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { marked } from 'marked';
import settingIcon from '@/assets/icons/setting.png';
import videoIcon from '@/assets/icons/video.png';
import timeIcon from '@/assets/icons/time.png';

const API_BASE_URL = getApiBaseUrl();
const settingStore = useSettingStore();
const route = useRoute();

// 번역
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
    searchError: "검색 중 오류가 발생했습니다."
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
    searchError: "An error occurred during search."
  }
};

const t = computed(() => translations[settingStore.language] || translations.ko);

// localStorage 키
const STORAGE_KEY = 'vss_search_state';

// 비디오 리스트 관련 (나중에 추가될 수 있음)
const items = ref([]);
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
const VIDEO_LIST_ROWS_PER_PAGE = 8; // 페이지당 8줄

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

// 모든 동영상의 duration을 미리 로드하는 함수
function preloadAllVideoDurations() {
  items.value.forEach(video => {
    // 이미지 파일이면 스킵
    if (isImageFile(video)) return;
    
    // 백엔드 API에서 받은 duration이 있으면 먼저 사용 (원본 파일에서 추출한 정보)
    // .avi 파일의 경우 변환 전 원본 파일에서 추출한 duration을 사용
    if (video.duration && isFinite(video.duration) && video.duration > 0) {
      // video.duration은 이미 설정되어 있으므로 그대로 사용
      return;
    }
    
    // displayUrl이 없으면 스킵
    if (!video.displayUrl) return;
    
    // 숨겨진 video 요소를 만들어서 메타데이터 로드 (백엔드 duration이 없는 경우에만)
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.crossOrigin = 'anonymous';
    videoElement.style.display = 'none';
    
    videoElement.addEventListener('loadedmetadata', () => {
      const duration = videoElement.duration;
      if (duration && isFinite(duration) && duration > 0) {
        video.duration = duration;
      }
      document.body.removeChild(videoElement);
    }, { once: true });
    
    videoElement.addEventListener('error', () => {
      document.body.removeChild(videoElement);
    }, { once: true });
    
    videoElement.src = video.displayUrl;
    document.body.appendChild(videoElement);
  });
}

// ==================== 예시 이미지 촬영용 고정값 (비활성화하려면 ENABLE_DEMO_MODE를 false로 설정) ====================
const ENABLE_DEMO_MODE = true; // 예시 이미지 촬영 모드 활성화/비활성화 플래그

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
const chatSessions = ref([]);
const currentChatIndex = ref(0);
const searchInput = ref('');
const isSearching = ref(false);
const searchType = ref('fast'); // 'fast', 'fast_vlm', 'detailed'
const chatContainer = ref(null);
const editingChatIndex = ref(null);
const editingChatName = ref('');
const chatNameInput = ref(null);
const abortControllers = ref([]);

// 컨텍스트 메뉴 상태
const chatMessageContextMenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
const chatTabContextMenu = ref({ visible: false, chatIndex: null, x: 0, y: 0 });
// 보고서 생성 서브메뉴 상태
const reportSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
// 보고서 목록 서브메뉴 상태
const reportListSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0, reports: [] });
// 보고서 생성 관련 상태
const isCreatingReport = ref(false);
const reportSuccess = ref(false);
const reportLoadingMessage = ref('');
const reportSuccessMessage = ref('');
const showReportTitleModal = ref(false);
const reportTitleInput = ref('');
const reportTitleError = ref('');
const isCheckingTitle = ref(false);
const pendingReportData = ref(null);
// 설정 모달 상태
const showSearchSettingModal = ref(false);
const showQueryVlmParams = ref(true);
const showSummarizeVlmParams = ref(true);
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
const minClipDuration = ref(1.0);
const maxClipDuration = ref(30.0);
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

// 유틸리티 함수
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec === 0) {
    return settingStore.language === 'ko' ? '0초' : '0sec';
  }
  
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  
  const parts = [];
  
  if (hours > 0) {
    parts.push(`${hours}${settingStore.language === 'ko' ? '시간' : 'h'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}${settingStore.language === 'ko' ? '분' : 'm'}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}${settingStore.language === 'ko' ? '초' : 's'}`);
  }
  
  return parts.join(' ');
}

function getCurrentTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function getVideoFileExtension(filename) {
  return filename.toLowerCase().split('.').pop();
}

const UNSUPPORTED_VIDEO_FORMATS = ['avi', 'mkv', 'flv', 'wmv']; // 브라우저가 직접 재생하지 못하는 형식

function isUnsupportedFormat(filename) {
  return UNSUPPORTED_VIDEO_FORMATS.includes(getVideoFileExtension(filename));
}

function isImageFile(video) {
  if (!video) return false;
  // file 객체가 있으면 type으로 확인
  if (video.file && video.file.type) {
    return video.file.type.startsWith('image/');
  }
  // 파일명으로 확인
  const filename = video.title || video.name || '';
  if (!filename) return false;
  const ext = getVideoFileExtension(filename);
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
  return imageExtensions.includes(ext.toLowerCase());
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
  
  // AbortController 생성 및 추적
  const abortController = new AbortController();
  abortControllers.value.push(abortController);
  
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
      // 변환된 MP4 URL을 displayUrl로 업데이트
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
    // AbortError는 정상적인 취소이므로 무시
    if (error.name === 'AbortError') {
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
    // 완료된 AbortController 제거
    const index = abortControllers.value.indexOf(abortController);
    if (index > -1) {
      abortControllers.value.splice(index, 1);
    }
  }
}

function createNewChat(videos = selectedVideos.value, signature) {
  const effectiveVideos = videos || [];
  const selectionSnapshot = snapshotVideosForChat(effectiveVideos);
  const resolvedSignature = signature ?? getSelectionSignature(effectiveVideos);

  // 동영상 리스트를 현재 items에서 복사 (깊은 복사)
  const videoList = effectiveVideos.length > 0 
    ? effectiveVideos.map(v => ({ ...v }))
    : [];
  // 기본적으로 선택 해제 상태로 설정
  const selectedVideoIds = [];

  const newChat = {
    id: Date.now(),
    name: null, // 사용자가 수정할 수 있는 이름
    messages: [],
    selectionSignature: resolvedSignature,
    selectedVideos: selectionSnapshot, // 선택된 동영상 정보 저장 (초기 메시지 없이)
    videoList: videoList, // 채팅창별 동영상 리스트
    selectedVideoIds: selectedVideoIds // 채팅창별 선택된 동영상 ID 리스트 (기본적으로 빈 배열)
  };

  chatSessions.value.push(newChat);
  currentChatIndex.value = chatSessions.value.length - 1;

  // 현재 items와 selectedIds를 새 채팅의 동영상 리스트로 업데이트 (기본적으로 선택 해제 상태)
  items.value = videoList.length > 0 ? [...videoList] : [];
  selectedIds.value = [];


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

function switchChat(index) {
  if (index >= 0 && index < chatSessions.value.length) {
    // 현재 채팅의 동영상 리스트를 저장
    const currentChat = chatSessions.value[currentChatIndex.value];
    if (currentChat) {
      currentChat.videoList = [...items.value];
      currentChat.selectedVideoIds = [...selectedIds.value];
    }

    // 전환할 채팅의 동영상 리스트 복원
    const targetChat = chatSessions.value[index];
    if (targetChat) {
      // videoList가 없으면 빈 배열로 초기화
      if (!targetChat.videoList) {
        targetChat.videoList = [];
      }
      if (!targetChat.selectedVideoIds) {
        targetChat.selectedVideoIds = [];
      }
      items.value = [...targetChat.videoList];
      selectedIds.value = [...targetChat.selectedVideoIds];
    } else {
      items.value = [];
      selectedIds.value = [];
    }

    currentChatIndex.value = index;
    
    
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
  
  // 삭제 후 현재 채팅의 동영상 리스트 복원
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (currentChat) {
    items.value = currentChat.videoList ? [...currentChat.videoList] : [];
    selectedIds.value = currentChat.selectedVideoIds ? [...currentChat.selectedVideoIds] : [];
  } else {
    items.value = [];
    selectedIds.value = [];
  }
  
}

// 컨텍스트 메뉴 함수
function openChatMessageContextMenu(messageIndex, e) {
  e.preventDefault();
  e.stopPropagation();
  
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

// 컨텍스트 메뉴 밖 클릭 시 닫기
function handleClickOutsideContextMenu(event) {
  // 우클릭 이벤트는 무시
  if (event.button === 2 || event.which === 3) return;
  
  // 컨텍스트 메뉴가 열려있을 때만 처리
  if (!chatMessageContextMenu.value.visible) return;
  
  // 클릭한 요소가 컨텍스트 메뉴나 서브메뉴 내부인지 확인
  const clickedElement = event.target;
  const contextMenuElement = clickedElement.closest('.context-menu-container');
  
  // 메뉴 밖을 클릭한 경우에만 닫기
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

async function checkReportTitle() {
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
}

async function confirmReportTitle() {
  if (!reportTitleInput.value.trim()) return;
  
  if (reportTitleError.value) return;
  
  if (!pendingReportData.value) return;
  
  const { reportData, userId } = pendingReportData.value;
  const reportTitle = reportTitleInput.value.trim();
  
  showReportTitleModal.value = false;
  reportTitleError.value = '';
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

// Query 파라미터 값 범위 제한 함수
function clampQueryValue(paramName, maxValue, minValue = null) {
  const currentValue = settingStore[paramName];
  if (currentValue > maxValue) {
    settingStore[paramName] = maxValue;
  } else if (minValue !== null && currentValue < minValue) {
    settingStore[paramName] = minValue;
  }
}

// Query 파라미터 리셋 함수들
function resetQueryTopP() {
  settingStore.queryTopp = 1.0;
}

function resetQueryTemperature() {
  settingStore.queryTemp = 0.3;
}

function resetQueryMaxTokens() {
  settingStore.queryMaxTokens = 1024;
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

// Min Clip Duration 값 범위 제한 함수
function clampMinClipDuration() {
  if (minClipDuration.value > 60) {
    minClipDuration.value = 60;
  } else if (minClipDuration.value < 0.1) {
    minClipDuration.value = 0.1;
  }
  // max_clip_duration보다 크면 조정
  if (minClipDuration.value > maxClipDuration.value) {
    minClipDuration.value = maxClipDuration.value;
  }
}

function resetMinClipDuration() {
  minClipDuration.value = 1.0;
}

// Max Clip Duration 값 범위 제한 함수
function clampMaxClipDuration() {
  if (maxClipDuration.value > 300) {
    maxClipDuration.value = 300;
  } else if (maxClipDuration.value < 1) {
    maxClipDuration.value = 1;
  }
  // min_clip_duration보다 작으면 조정
  if (maxClipDuration.value < minClipDuration.value) {
    maxClipDuration.value = minClipDuration.value;
  }
}

function resetMaxClipDuration() {
  maxClipDuration.value = 30.0;
}

// Summarize 파라미터 값 범위 제한 함수
function clampSummarizeValue(paramName, maxValue, minValue = null) {
  const currentValue = settingStore[paramName];
  if (currentValue > maxValue) {
    settingStore[paramName] = maxValue;
  } else if (minValue !== null && currentValue < minValue) {
    settingStore[paramName] = minValue;
  }
}

// Summarize 파라미터 리셋 함수들
function resetSummarizeTopP() {
  settingStore.summarizeTopp = 1.0;
}

function resetSummarizeTemperature() {
  settingStore.summarizeTemp = 0.4;
}

function resetSummarizeMaxTokens() {
  settingStore.summarizeMaxTokens = 512;
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
async function ensureVideoFile(video) {
  if (!video || !video.displayUrl) {
    return null;
  }

  // AbortController 생성 및 추적
  const abortController = new AbortController();
  abortControllers.value.push(abortController);
  
  try {
    const response = await fetch(video.displayUrl, {
      signal: abortController.signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch video blob (${response.status})`);
    }
    const blob = await response.blob();
    const filename = video.title || `video-${video.id}.mp4`;
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
    video.file = file;
    return file;
  } catch (error) {
    // AbortError는 정상적인 취소이므로 무시
    if (error.name === 'AbortError') {
      return null;
    }
    console.error('Failed to reconstruct File from video URL:', error);
    return null;
  } finally {
    // 완료된 AbortController 제거
    const index = abortControllers.value.indexOf(abortController);
    if (index > -1) {
      abortControllers.value.splice(index, 1);
    }
  }
}

async function collectSelectedFiles() {
  const results = [];
  for (const video of selectedVideos.value) {
    const file = await ensureVideoFile(video);
    if (file) {
      results.push({ file, video });
    }
  }
  return results;
}

// 검색 함수
async function handleSearch() {
  // 고속 검색이 아닐 때만 query 체크
  if (searchType.value !== 'fast') {
    const query = searchInput.value.trim();
    if (!query || isSearching.value) return;
  } else {
    // 고속 검색일 때는 검색 중이거나 채팅 세션이 없으면 return
    if (isSearching.value) return;
  }
  
  if (chatSessions.value.length === 0) return;

  const currentChat = chatSessions.value[currentChatIndex.value];

  // 검색어를 미리 저장 (searchInput.value를 비우기 전에)
  const savedQuery = searchType.value !== 'fast' ? searchInput.value.trim() : '';

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
  }

  scrollToBottom();

  isSearching.value = true;

  try {
    const fileEntries = await collectSelectedFiles();
    if (fileEntries.length === 0) {
      currentChat.messages.push({
        role: 'assistant',
        content: settingStore.language === 'ko' ? '선택된 동영상을 가져오지 못했습니다. 다시 시도해주세요.' : 'Failed to load selected videos. Please try again.',
        timestamp: getCurrentTime()
      });
      return;
    }

    const userId = localStorage.getItem("vss_user_id");

    // AbortController 생성 및 추적
    const abortController = new AbortController();
    abortControllers.value.push(abortController);

    // 상세 검색: 검색어에 "찾아"가 있으면 generate-clips, 없으면 vss-query 사용
    if (searchType.value === 'detailed') {
      // 저장된 검색어 사용 (searchInput.value는 이미 비워졌을 수 있음)
      const query = savedQuery || searchInput.value.trim();
      
      // 검색어에 "찾아"가 있는지 확인 (대소문자 구분 없이)
      const hasFindKeyword = query.includes('찾아') || query.toLowerCase().includes('찾아');
      
      console.log('[Search] 상세 검색 조건 확인:', {
        query: query,
        savedQuery: savedQuery,
        searchInputValue: searchInput.value,
        hasFindKeyword: hasFindKeyword,
        searchType: searchType.value
      });
      
      // "찾아"가 있으면 기존 상세 검색 (generate-clips) 사용
      if (hasFindKeyword) {
        console.log('[Search] generate-clips 엔드포인트 사용');
        // 파일명과 video_id 매핑 생성
        const videoIdMap = {};
        fileEntries.forEach(({ file, video }) => {
          const dbId = video.dbId || video.id;
          if (dbId) {
            videoIdMap[file.name] = dbId;
          }
        });
      const formData = new FormData();
      fileEntries.forEach(({ file }) => {
        formData.append('files', file, file.name);
        formData.append('prompt', query);
      });
      
      // 이미지가 업로드된 경우 FormData에 추가
      if (uploadedImage.value) {
        formData.append('image', uploadedImage.value, uploadedImage.value.name);
        // 검색 후 이미지 초기화
        removeUploadedImage();
      }
      
      // user_id와 video_ids 전달 (요약 결과 확인용)
      if (userId) {
        formData.append('user_id', userId);
      }
      if (Object.keys(videoIdMap).length > 0) {
        formData.append('video_ids', JSON.stringify(videoIdMap));
      }
      
      // NaN 방지 헬퍼
      const safeNum = (val, fallback) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : fallback;
      };
      
      // Query 설정값 전달
      formData.append('chunk_size', safeNum(settingStore.queryChunk, 10));
      formData.append('top_k', safeNum(settingStore.queryTopk, 80));
      formData.append('top_p', safeNum(settingStore.queryTopp, 1.0));
      formData.append('temperature', safeNum(settingStore.queryTemp, 0.3));
      formData.append('max_new_tokens', safeNum(settingStore.queryMaxTokens, 1024));
      formData.append('seed', safeNum(settingStore.querySeed, 42));
      
      // Summarize 설정값 전달
      formData.append('summarize_chunk_duration', safeNum(settingStore.summarizeChunk, 0));
      formData.append('summarize_top_k', safeNum(settingStore.summarizeTopk, 80));
      formData.append('summarize_top_p', safeNum(settingStore.summarizeTopp, 1.0));
      formData.append('summarize_temperature', safeNum(settingStore.summarizeTemp, 0.4));
      formData.append('summarize_max_new_tokens', safeNum(settingStore.summarizeMaxTokens, 512));
      formData.append('summarize_seed', safeNum(settingStore.summarizeSeed, 1));
      formData.append('summarize_num_frames_per_chunk', safeNum(settingStore.summarizeNumFramesPerChunk, 0));
      formData.append('summarize_frame_width', safeNum(settingStore.summarizeFrameWidth, 1920));
      formData.append('summarize_frame_height', safeNum(settingStore.summarizeFrameHeight, 1080));
      formData.append('summarize_batch_size', safeNum(settingStore.summarizeBatchSize, 6));
      formData.append('summarize_rag_batch_size', safeNum(settingStore.summarizeRagBatchSize, 1));
      formData.append('summarize_rag_top_k', safeNum(settingStore.summarizeRagTopK, 5));
      formData.append('summarize_summarize_top_p', safeNum(settingStore.summarizeSummarizeTopP, 0.7));
      formData.append('summarize_summarize_temperature', safeNum(settingStore.summarizeSummarizeTemperature, 0.2));
      formData.append('summarize_summarize_max_tokens', safeNum(settingStore.summarizeSummarizeMaxTokens, 2048));
      formData.append('summarize_chat_top_p', safeNum(settingStore.summarizeChatTopP, 0.7));
      formData.append('summarize_chat_temperature', safeNum(settingStore.summarizeChatTemperature, 0.2));
      formData.append('summarize_chat_max_tokens', safeNum(settingStore.summarizeChatMaxTokens, 2048));
      formData.append('summarize_notification_top_p', safeNum(settingStore.summarizeNotificationTopP, 0.7));
      formData.append('summarize_notification_temperature', safeNum(settingStore.summarizeNotificationTemperature, 0.2));
      formData.append('summarize_notification_max_tokens', safeNum(settingStore.summarizeNotificationMaxTokens, 2048));
      formData.append('summarize_enable_audio', settingStore.summarizeEnableAudio ? 'true' : 'false');
      const response = await fetch(`${API_BASE_URL}/generate-clips`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      const clips_extracted = data.clips_extracted || false; // 클립 추출 여부
      const groupedClipItems = (data.clips || []).map(group => ({
        video: group.video,
        clips: Array.isArray(group.clips) ? group.clips : []
      }));

      // 실제 URL이 있는 클립만 필터링 (via_response만 있는 것은 제외)
      // 타임스탬프 간격이 0초인 클립도 제외
      const validClips = groupedClipItems.flatMap(group =>
        group.clips
          .filter(clip => {
            // url이 있고 via_response가 없는 것만
            if (!clip.url || clip.via_response) return false;
            // 타임스탬프 간격이 0초 이하인 클립 제외
            if (clip.start_time !== undefined && clip.end_time !== undefined) {
              if (clip.end_time - clip.start_time <= 0) return false;
            }
            return true;
          })
          .map(clip => ({
            ...clip,
            sourceVideo: group.video
          }))
      );

      if (!clips_extracted || validClips.length === 0) {
        // 클립이 추출되지 않았을 경우
        currentChat.messages.push({
          role: 'assistant',
          content: t.value.noScenes,
          timestamp: getCurrentTime()
        });
        return;
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
      // "찾아"가 없으면 VSS query 기능 사용
      else {
        console.log('[Search] vss-query 엔드포인트 사용 (검색어에 "찾아" 없음)');
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
            return;
          }
          queryFormData.append('file', firstFile);
        }

        queryFormData.append('query', query);
        // 상세 검색 설정의 파라미터 사용
        queryFormData.append('chunk_size', safeNum(settingStore.summarizeChunk, 10));
        queryFormData.append('top_k', safeNum(settingStore.summarizeTopk, 80));
        queryFormData.append('top_p', safeNum(settingStore.summarizeTopp, 1.0));
        queryFormData.append('temperature', safeNum(settingStore.summarizeTemp, 0.4));
        queryFormData.append('max_new_tokens', safeNum(settingStore.summarizeMaxTokens, 512));
        queryFormData.append('seed', safeNum(settingStore.summarizeSeed, 1));
        
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
      }
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
        min_clip_duration: safeNum(minClipDuration.value, 1.0),
        max_clip_duration: safeNum(maxClipDuration.value, 30.0),
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

      // 실제 URL이 있는 클립만 필터링
      const validClips = groupedClipItems.flatMap(group =>
        group.clips
          .filter(clip => {
            if (!clip.url) return false;
            // 타임스탬프 간격이 0초 이하인 클립 제외
            if (clip.start_time !== undefined && clip.end_time !== undefined) {
              if (clip.end_time - clip.start_time <= 0) return false;
            }
            return true;
          })
          .map(clip => ({
            ...clip,
            sourceVideo: group.video
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
          return;
        }
        queryFormData.append('file', firstFile);
      }

      queryFormData.append('query', query);
      // 상세 검색 설정의 파라미터 사용
      queryFormData.append('chunk_size', safeNum(settingStore.summarizeChunk, 10));
      queryFormData.append('top_k', safeNum(settingStore.summarizeTopk, 80));
      queryFormData.append('top_p', safeNum(settingStore.summarizeTopp, 1.0));
      queryFormData.append('temperature', safeNum(settingStore.summarizeTemp, 0.4));
      queryFormData.append('max_new_tokens', safeNum(settingStore.summarizeMaxTokens, 512));
      queryFormData.append('seed', safeNum(settingStore.summarizeSeed, 1));
      
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
  } finally {
    isSearching.value = false;
    scrollToBottom();
    // 완료된 AbortController 제거
    if (typeof abortController !== 'undefined') {
      const index = abortControllers.value.indexOf(abortController);
      if (index > -1) {
        abortControllers.value.splice(index, 1);
      }
    }
  }
}

// 채팅 클립 확대용(그리드 비디오와 구분되는 최소 필드 구성)
function zoomClip(clip) {
  // clip 객체를 확대 모달이 사용하는 형태로 매핑
  zoomedVideo.value = {
    id: `clip-${clip.id}`,
    title: clip.title || '클립',
    displayUrl: clip.url,
    progress: 0
  };
  // 클립 정보 저장 (sentence 포함)
  zoomedClip.value = clip;
  showSentencePopup.value = true; // 팝업 표시
  isZoomed.value = true;
  zoomPlaying.value = false;
  zoomProgress.value = 0;
  zoomCurrentTime.value = 0;
  zoomDuration.value = 0;
  nextTick(() => {
    const el = zoomVideoRef.value;
    if (!el) return;
    // 메타데이터가 준비될 때까지 기다린 뒤 재생
    if (!isFinite(el.duration)) {
      el.addEventListener('loadedmetadata', () => {
        zoomDuration.value = el.duration || 0;
        try { el.currentTime = 0; el.play(); zoomPlaying.value = true; } catch (e) { console.warn('클립 모달 재생 실패:', e); }
      }, { once: true });
    } else {
      zoomDuration.value = el.duration || 0;
      try { el.currentTime = 0; el.play(); zoomPlaying.value = true; } catch (e) { console.warn('클립 모달 재생 실패:', e); }
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
function togglePlay(videoId) {
  if (!zoomVideoRef.value || !zoomVideoRef.value.src) {
    console.warn('togglePlay: video has no src');
    return;
  }
  
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

// 확대 모달 시간 업데이트
function onZoomTimeUpdate(event) {
  if (!event.target) return;
  const video = event.target;
  if (isFinite(video.duration) && video.duration > 0) {
    zoomCurrentTime.value = video.currentTime || 0;
    zoomDuration.value = video.duration || 0;
    zoomProgress.value = (zoomCurrentTime.value / zoomDuration.value) * 100;
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
  
  const updateProgress = (e) => {
    if (!zoomProgressBarRef.value || !isDragging.value) return;
    const rect = zoomProgressBarRef.value.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    zoomProgress.value = percent;
    
    if (zoomVideoRef.value && isFinite(zoomDuration.value) && zoomDuration.value > 0) {
      zoomVideoRef.value.currentTime = (percent / 100) * zoomDuration.value;
      zoomCurrentTime.value = zoomVideoRef.value.currentTime;
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
  
  if (isFinite(zoomDuration.value) && zoomDuration.value > 0) {
    zoomVideoRef.value.currentTime = (percent / 100) * zoomDuration.value;
    zoomCurrentTime.value = zoomVideoRef.value.currentTime;
  }
}

// 동영상 선택 토글 함수
function toggleVideoSelection(videoId) {
  const index = selectedIds.value.indexOf(videoId);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(videoId);
  }
  
  // 현재 채팅 세션 업데이트 및 상태 저장
  updateCurrentChatVideoList();
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
        
        return {
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
          videoId: v.video_id || null,
          _isConverting: false // 변환 중 상태 추적
        };
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
function addSelectedVideos() {
  const videosToAdd = availableVideos.value.filter(v => selectedVideoIds.value.includes(v.id));
  
  const userId = localStorage.getItem("vss_user_id");
  
  videosToAdd.forEach(video => {
    // items에 이미 있는지 확인
    const exists = items.value.some(v => (v.dbId || v.id) === video.id);
    if (!exists) {
      const newVideo = {
        ...video,
        id: video.id || Date.now() + Math.random(),
        _isConverting: false // 변환 중 상태 추적
      };
      items.value.push(newVideo);
      
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
  
  // 모달 닫기
  closeVideoListModal();
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

// 현재 채팅 세션의 동영상 리스트 업데이트 헬퍼 함수
function updateCurrentChatVideoList() {
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (currentChat) {
    currentChat.videoList = [...items.value];
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
        videoList: [],
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
      
      if (chat.videoList && Array.isArray(chat.videoList)) {
        serializedChat.videoList = chat.videoList.map(video => ({
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
      }
      
      return serializedChat;
    } catch (error) {
      console.error(`채팅 직렬화 실패:`, error);
      return null;
    }
  }).filter(chat => chat !== null);

  const serializableItems = items.value.map(video => ({
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
    items: serializableItems,
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
      
      if (chatSessions.value.length > 0) {
        const currentChat = chatSessions.value[currentChatIndex.value];
        if (currentChat) {
          if (currentChat.videoList && Array.isArray(currentChat.videoList)) {
            items.value = [...currentChat.videoList];
          } else {
            items.value = [];
          }
          if (currentChat.selectedVideoIds && Array.isArray(currentChat.selectedVideoIds)) {
            selectedIds.value = [...currentChat.selectedVideoIds];
          } else {
            selectedIds.value = [];
          }
        } else {
          items.value = [];
          selectedIds.value = [];
        }
      } else {
        if (state.items && Array.isArray(state.items)) {
          items.value = [...state.items];
        } else {
          items.value = [];
        }
        if (state.selectedIds && Array.isArray(state.selectedIds)) {
          selectedIds.value = [...state.selectedIds];
        } else {
          selectedIds.value = [];
        }
      }
      
      return true;
    } else {
      if (state.items && Array.isArray(state.items)) {
        items.value = [...state.items];
      } else {
        items.value = [];
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
  if (isSaving) return;
  
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    isSaving = true;
    try {
      updateCurrentChatVideoList();
      saveSearchState();
    } finally {
      setTimeout(() => {
        isSaving = false;
      }, 100);
    }
  }, 500);
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

onMounted(async () => {
  // 먼저 DB에서 상태 복원 시도
  const dbStateRestored = await loadSearchStateFromDB();
  
  // DB에서 복원되지 않았으면 localStorage에서 복원 시도
  const stateRestored = dbStateRestored || loadSearchState();
  
  // 라우터 state에서 선택된 동영상 데이터 받기 (우선순위 최고)
  if (history.state && history.state.selectedVideos && Array.isArray(history.state.selectedVideos) && history.state.selectedVideos.length > 0) {
    const receivedVideos = history.state.selectedVideos;
    const mappedVideos = receivedVideos.map(video => ({
      ...video,
      id: video.id || video.dbId,
      dbId: video.dbId || video.id,
      _isConverting: false // 변환 중 상태 추적
    }));
    
    // 동영상 리스트가 비어있는 채팅창 찾기
    const emptyChatIndex = chatSessions.value.findIndex(chat => 
      (!chat.videoList || chat.videoList.length === 0) && 
      (!chat.messages || chat.messages.length === 0)
    );
    
    if (emptyChatIndex !== -1) {
      // 빈 채팅창이 있으면 해당 채팅창에 동영상 추가
      const emptyChat = chatSessions.value[emptyChatIndex];
      
      // 동영상 리스트 업데이트
      emptyChat.videoList = mappedVideos.map(v => ({ ...v }));
      emptyChat.selectedVideoIds = []; // 기본적으로 선택 해제 상태
      
      // 현재 채팅창으로 전환
      currentChatIndex.value = emptyChatIndex;
      
      // items와 selectedIds 업데이트 (기본적으로 선택 해제 상태)
      items.value = mappedVideos;
      selectedIds.value = [];
      
      // 상태 저장
      await nextTick();
      saveSearchState();
    } else {
      // 빈 채팅창이 없으면 새 채팅 생성 (현재 채팅창에는 추가하지 않음)
      const selectionSignature = getSelectionSignature(mappedVideos);
      createNewChat(mappedVideos, selectionSignature);
    }
    
    // 지원하지 않는 형식의 동영상 변환 체크
    const userId = localStorage.getItem("vss_user_id");
    if (userId) {
      const checkUnsupportedVideos = () => {
        mappedVideos.forEach((video) => {
          if (isUnsupportedFormat(video.title || '')) {
            const videoObj = items.value.find(v => v.id === video.id);
            if (videoObj) {
              convertVideoToMp4(video.dbId || video.id, userId, videoObj).catch(err => {
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
  } else if (!stateRestored) {
    // 상태가 복원되지 않았고 라우터 state도 없으면 초기 채팅 세션 생성
    if (chatSessions.value.length === 0) {
      if (items.value.length > 0) {
        const selectionSignature = getSelectionSignature(items.value);
        createNewChat(items.value, selectionSignature);
      } else {
        createNewChat([], 'none');
      }
    } else {
      const currentChat = chatSessions.value[currentChatIndex.value];
      if (currentChat) {
        if (currentChat.videoList && Array.isArray(currentChat.videoList)) {
          items.value = [...currentChat.videoList];
        } else {
          items.value = [];
        }
        if (currentChat.selectedVideoIds && Array.isArray(currentChat.selectedVideoIds)) {
          selectedIds.value = [...currentChat.selectedVideoIds];
        } else {
          selectedIds.value = [];
        }
      }
    }
  }
  
  // 다른 메뉴가 열렸을 때 컨텍스트 메뉴 닫기
  window.addEventListener('profile-menu-opened', closeChatMessageContextMenu);
  window.addEventListener('video-context-menu-opened', closeChatMessageContextMenu);
  window.addEventListener('chat-message-context-menu-opened', closeChatMessageContextMenu);
  
  // Management 메뉴에서 동영상 삭제 시 동기화
  window.addEventListener('videos-deleted-from-management', handleVideosDeletedFromManagement);
  
  // 컨텍스트 메뉴 밖 클릭 시 닫기
  document.addEventListener('click', handleClickOutsideContextMenu);
  
  // 페이지를 떠날 때 상태 저장
  window.addEventListener('beforeunload', handleBeforeUnload);
  // 탭이 숨겨질 때 상태 저장
  window.addEventListener('visibilitychange', handleVisibilityChange);
  
  nextTick(() => {
    scrollToBottom();
    // 모든 동영상의 duration 미리 로드
    if (items.value.length > 0) {
      preloadAllVideoDurations();
    }
  });
});

// 상태 변경 감지하여 자동 저장
watch(chatSessions, () => {
  if (!isSaving) {
    autoSaveSearchState();
  }
}, { deep: true });

watch(currentChatIndex, () => {
  if (!isSaving) {
    autoSaveSearchState();
  }
});

watch(items, () => {
  if (!isSaving) {
    autoSaveSearchState();
  }
  // items가 변경될 때 모든 동영상의 duration 미리 로드
  if (items.value.length > 0) {
    nextTick(() => {
      preloadAllVideoDurations();
    });
  }
}, { deep: true });

watch(selectedIds, () => {
  if (!isSaving) {
    autoSaveSearchState();
  }
}, { deep: true });

watch(searchType, () => {
  if (!isSaving) {
    autoSaveSearchState();
  }
});

// 페이지네이션: items나 videoListItemsPerPage 변경 시 현재 페이지 조정
watch([items, videoListItemsPerPage, videoListTotalPages], () => {
  if (videoListCurrentPage.value > videoListTotalPages.value && videoListTotalPages.value > 0) {
    videoListCurrentPage.value = videoListTotalPages.value;
  }
});

// Management 메뉴에서 동영상 삭제 시 처리
function handleVideosDeletedFromManagement(event) {
  const { ids, dbIds } = event.detail;
  
  if (!ids || !dbIds || (ids.length === 0 && dbIds.length === 0)) {
    return;
  }
  
  // 삭제된 동영상 ID와 dbId를 Set으로 변환 (빠른 조회를 위해)
  const deletedIds = new Set(ids);
  const deletedDbIds = new Set(dbIds);
  
  // items.value에서 삭제된 동영상 제거
  const beforeCount = items.value.length;
  items.value = items.value.filter(video => {
    const videoId = video.id;
    const videoDbId = video.dbId || video.id;
    
    // id 또는 dbId가 삭제 목록에 있으면 제거
    const shouldRemove = deletedIds.has(videoId) || 
                        deletedDbIds.has(videoDbId) ||
                        (videoId && deletedDbIds.has(videoId)) ||
                        (videoDbId && deletedIds.has(videoDbId));
    
    return !shouldRemove;
  });
  
  // selectedIds에서도 삭제된 동영상 제거
  selectedIds.value = selectedIds.value.filter(id => {
    return !deletedIds.has(id) && !deletedDbIds.has(id);
  });
  
  // 모든 채팅 세션의 videoList에서도 삭제된 동영상 제거
  chatSessions.value.forEach(chat => {
    if (chat.videoList && Array.isArray(chat.videoList)) {
      chat.videoList = chat.videoList.filter(video => {
        const videoId = video.id;
        const videoDbId = video.dbId || video.id;
        
        const shouldRemove = deletedIds.has(videoId) || 
                            deletedDbIds.has(videoDbId) ||
                            (videoId && deletedDbIds.has(videoId)) ||
                            (videoDbId && deletedIds.has(videoDbId));
        
        return !shouldRemove;
      });
    }
    
    // selectedVideoIds에서도 삭제된 동영상 제거
    if (chat.selectedVideoIds && Array.isArray(chat.selectedVideoIds)) {
      chat.selectedVideoIds = chat.selectedVideoIds.filter(id => {
        return !deletedIds.has(id) && !deletedDbIds.has(id);
      });
    }
  });
  
  // 상태 저장
  updateCurrentChatVideoList();
  autoSaveSearchState();
  
  const afterCount = items.value.length;
  if (beforeCount !== afterCount) {
    console.log(`[Search] Management 메뉴에서 삭제된 동영상 동기화: ${beforeCount - afterCount}개 동영상 제거됨`);
  }
}

// 컴포넌트 언마운트 전 상태 저장
onBeforeUnmount(() => {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('videos-deleted-from-management', handleVideosDeletedFromManagement);
  document.removeEventListener('click', handleClickOutsideContextMenu);
  
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
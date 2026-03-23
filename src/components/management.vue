<template>
  <!-- 메뉴 틀 -->
  <div id="video_list" class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-925 p-[2%]">
    <div class="w-full h-[calc(100vh-5rem)] bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-inner p-[1%]">
      <!-- 헤더 -->
      <header id="header" class="flex items-center justify-between px-[0.3%] pb-[1%] border-b border-gray-800/70 dark:border-gray-200/30">
        <!-- 좌측: 타이틀 / 설명 + 설정 버튼 -->
        <div class="flex items-center gap-[1%]">
          <div class="flex flex-col gap-[0.3%]">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-400/40 dark:border-emerald-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[0.720rem] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400 uppercase">
                {{ t.workspace }}
              </span>
            </div>
            <p class="text-[12px] text-black dark:text-gray-200 mt-1">
              {{ t.description }}
              <span class="hidden md:inline">{{ t.descriptionDetail }}</span>
            </p>
          </div>
        </div>

        <!-- 우측: 전체 선택 + 업로드 버튼 -->
        <div class="flex items-center gap-3">
          <!-- Select All (데스크톱용 텍스트 버튼) -->
          <button
            class="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-500/60 dark:border-gray-600 text-[13px] text-slate-100 dark:text-gray-200 bg-slate-900/70 dark:bg-gray-800 hover:bg-slate-800/80 dark:hover:bg-gray-700 hover:border-emerald-400/70 dark:hover:border-emerald-500 hover:text-emerald-50 dark:hover:text-emerald-300 shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-default"
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
            class="md:hidden flex items-center justify-center w-9 h-9 rounded-2xl border border-slate-500/60 dark:border-gray-600 bg-slate-900/70 dark:bg-gray-800 text-slate-100 dark:text-gray-200 hover:bg-slate-800/90 dark:hover:bg-gray-700 hover:border-emerald-400/70 dark:hover:border-emerald-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-default"
            :disabled="items.length === 0" @click="allselect()" :title="t.selectAll">
            <svg class="w-4 h-4 text-slate-100 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <!-- 업로드 버튼 -->
          <div class="flex items-center h-12">
            <label
              class="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/90 dark:bg-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-500 text-white px-5 py-2.5 shadow-lg shadow-emerald-500/30 dark:shadow-emerald-600/30 cursor-pointer transform transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v7m0-7l-3 3m3-3l3 3"></path>
              </svg>
              <span class="font-medium text-sm">{{ t.uploadVideo }}</span>
              <input type="file" accept="video/*,image/*" multiple class="hidden" @change="handleUpload" />
            </label>
          </div>
        </div>
      </header>
      
      <!-- 동영상 통계 (동영상 리스트 위) -->
      <!-- 예시 이미지 촬영용: ENABLE_DEMO_MODE가 true일 때 항상 표시 -->
      <div v-if="ENABLE_DEMO_MODE || items.length > 0" class="mt-4 mb-2 flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <img :src="videoIcon" alt="동영상" class="w-4 h-4 object-contain dark:brightness-0 dark:invert" />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ videoListCount }}{{ settingStore.language === 'ko' ? '개' : '' }}
          </span>
        </div>
        <span class="text-gray-400 dark:text-gray-500">/</span>
        <div class="flex items-center gap-1.5">
          <img :src="timeIcon" alt="시간" class="w-4 h-4 object-contain dark:brightness-0 dark:invert" />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ videoListTotalDuration }}
          </span>
        </div>
      </div>
      
        <!-- 동영상 출력 영역 -->
        <div 
          ref="videoContainerRef"
          class="relative w-full h-[calc(100vh-15rem)] border border-slate-200/80 dark:border-gray-700 rounded-2xl shadow-inner mt-4 transition-all duration-300 flex flex-col overflow-hidden"
          :class="isDragOverUpload ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 ring-2 ring-blue-300 dark:ring-blue-600' : 'bg-gray-50 dark:bg-gray-700'"
          @dragover.prevent="onDragOverUpload"
          @dragleave.prevent="onDragLeaveUpload"
          @drop.prevent="onDropUpload">
          <div v-if="items.length === 0" class="flex items-center justify-center w-full h-full absolute inset-0">
            <div
              class="flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-center text-[24px] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm backdrop-blur-sm transition-all duration-300 px-8 py-4"
              :class="isDragOverUpload ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-500 text-blue-600 dark:text-blue-400' : ''">
              <p v-if="!isDragOverUpload" class="font-light">{{ t.pleaseUpload }}</p>
              <p v-else class="font-bold">{{ t.dropHere }}</p>
            </div>
          </div>

          <!-- 드래그 & 드롭 오버레이 (동영상이 있을 때) -->
          <div 
            v-if="isDragOverUpload && items.length > 0"
            class="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm border-4 border-dashed border-blue-400 rounded-2xl pointer-events-none">
            <div class="bg-white/90 dark:bg-gray-800/90 rounded-2xl px-8 py-6 shadow-xl">
              <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 text-center">{{ t.dropHere }}</p>
            </div>
          </div>

          <!-- 경로 표시 (Breadcrumb) -->
          <div v-if="currentGroupPath.length > 0" class="px-6 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-2 text-sm">
              <button 
                @click="navigateToGroup([])"
                class="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                {{ settingStore.language === 'ko' ? '홈' : 'Home' }}
              </button>
              <span class="text-gray-400 dark:text-gray-500">/</span>
              <template v-for="(groupId, index) in currentGroupPath" :key="groupId">
                <button 
                  @click="navigateToGroup(currentGroupPath.slice(0, index + 1))"
                  class="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                  {{ getGroupName(groupId) }}
                </button>
                <span v-if="index < currentGroupPath.length - 1" class="text-gray-400 dark:text-gray-500">/</span>
              </template>
            </div>
          </div>

          <!-- 동영상 출력 그리드(행열 구조) -->
          <div 
            ref="videoGridRef"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-[clamp(1rem,2vw,1.5rem)] p-[clamp(1rem,2vw,1.5rem)] flex-1 transition-opacity duration-300 min-h-0 content-start overflow-y-auto relative"
            :class="{ 'opacity-50': isDragOverUpload && items.length > 0 }"
            @contextmenu.prevent="onEmptySpaceContextMenu">
            <!-- 드래그 선택 영역 표시 -->
            <div 
              v-if="isDragSelecting && dragSelectBox"
              class="fixed border-2 border-blue-500 bg-blue-500/20 pointer-events-none z-50"
              :style="dragSelectBox"></div>
            
            <!-- 그룹 렌더링 -->
            <div v-for="group in filteredGroups" :key="group.id"
              class="flex flex-col items-center justify-center rounded-2xl shadow-md hover:shadow-xl cursor-pointer p-3 border-2 border-dashed h-auto self-start transform transition-all duration-300 hover:scale-105 hover:-translate-y-1"
              :class="dragOverGroupId === group.id 
                ? 'border-blue-600 dark:border-blue-400 bg-blue-100 dark:bg-blue-800 ring-2 ring-blue-400 dark:ring-blue-500' 
                : 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'"
              :style="getGroupGridPosition(group)"
              @dblclick="enterGroup(group.id)"
              @contextmenu.prevent.stop="onGroupContextMenu(group, $event)"
              @dragover.prevent="onGroupDragOver(group.id, $event)"
              @dragleave="onGroupDragLeave(group.id, $event)"
              @drop.prevent="onGroupDrop(group.id, $event)">
              <div class="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-900 rounded-xl mb-2">
                <!-- 폴더 아이콘 -->
                <svg class="w-16 h-16 text-blue-500 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </div>
              <div class="w-full text-center">
                <!-- 그룹 이름 편집 모드 -->
                <div v-if="editingGroupId === group.id" class="px-2">
                  <input
                    ref="groupNameInput"
                    v-model="editingGroupName"
                    type="text"
                    class="w-full text-sm font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-blue-400 dark:border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    @keydown.enter="saveGroupName(group.id)"
                    @keydown.esc="cancelGroupNameEdit"
                    @blur="saveGroupName(group.id)"
                    @click.stop
                  />
                </div>
                <!-- 그룹 이름 표시 모드 -->
                <div v-else 
                  class="text-sm font-medium text-gray-800 dark:text-gray-200 break-words line-clamp-2 px-2 cursor-text"
                  @dblclick.stop="startEditGroupName(group.id, group.name)">
                  {{ group.name }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ group.videoIds.length }} {{ settingStore.language === 'ko' ? '개 동영상' : 'videos' }}
                </div>
              </div>
            </div>
            
            <div v-for="video in paginatedItems" :key="video.id"
              class="flex flex-col items-center justify-center rounded-2xl shadow-md hover:shadow-xl cursor-pointer p-3 border border-gray-200 dark:border-gray-700 relative transform transition-all duration-300 hover:scale-105 hover:-translate-y-1 group bg-white dark:bg-gray-800 h-auto self-start"
              :class="{ 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-100 dark:bg-blue-900/30': selectedIds.includes(video.id), 'opacity-50': draggedVideoId === video.id }"
              :ref="el => { if (el) videoCardRefs[video.id] = el }"
              draggable="true"
              @dragstart="onVideoDragStart(video.id, $event)"
              @dragend="onVideoDragEnd"
              @click="onCardClick(video.id, $event)" @contextmenu.prevent.stop="onVideoContextMenu(video, $event)">
              <div
                class="w-[100%] h-[100%] flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl mb-2 overflow-hidden relative group-hover:from-gray-200 group-hover:to-gray-300 dark:group-hover:from-gray-600 dark:group-hover:to-gray-500 transition-all duration-300 aspect-video"
                @mouseenter="hoveredVideoId = video.id" @mouseleave="hoveredVideoId = null">
                <!-- 이미지 파일인 경우 (최적화: 지연 로딩) -->
                <img 
                  v-if="isImageFile(video) && video.displayUrl"
                  :src="video.displayUrl"
                  class="object-contain w-full h-full rounded-xl transition-transform duration-300 group-hover:scale-105"
                  :crossorigin="video.displayUrl && !video.displayUrl.startsWith('blob:') ? 'anonymous' : null"
                  loading="lazy"
                  @error="(e) => handleImageError(video.id, e)"
                  draggable="false"
                  alt=""
                />
                <!-- 지원하지 않는 형식이고 변환 중이거나 변환되지 않은 경우 -->
                <div v-else-if="!isImageFile(video) && isUnsupportedFormat(video.title || video.name || '') && (video._isConverting || !video.displayUrl?.includes('converted-videos'))" 
                  class="w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-xl">
                  <div v-if="video._isConverting" class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 dark:border-gray-400 mb-2"></div>
                  <svg v-else class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span class="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                    {{ video._isConverting 
                      ? (settingStore.language === 'ko' ? '변환 중...' : 'Converting...')
                      : (settingStore.language === 'ko' ? '변환 대기 중...' : 'Waiting for conversion...')
                    }}
                  </span>
                </div>
                <!-- 비디오 엘리먼트 표시 (변환된 MP4 또는 지원하는 형식) (최적화: metadata만 로드) -->
                <video 
                  v-else-if="!isImageFile(video) && video.displayUrl && (!isUnsupportedFormat(video.title || video.name || '') || video.displayUrl?.includes('converted-videos'))"
                  :ref="el => (videoRefs[video.id] = el)" 
                  :src="video.displayUrl"
                  class="object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                  preload="metadata"
                  :crossorigin="video.displayUrl && !video.displayUrl.startsWith('blob:') ? 'anonymous' : null"
                  playsinline
                  @timeupdate="updateProgress(video.id, $event)"
                  @loadedmetadata="onVideoMetadataLoaded(video.id, $event)"
                  @error="(e) => handleVideoError(video.id, e, false)"
                  draggable="false"
                ></video>
                <span v-else class="text-gray-400 dark:text-gray-500 text-sm">{{ t.noThumbnail }}</span>
                <!-- 그리드: 재생 중이 아닐 때 어두워지는 오버레이 (동영상만) -->
                <div v-if="!isImageFile(video) && video.displayUrl" class="absolute inset-0 pointer-events-none transition-colors duration-300"
                  :class="playingVideoIds.includes(video.id) ? 'bg-transparent' : 'bg-black/20'"></div>
                <!-- 재생하지 않은 동영상의 영상 길이 표시 (우측 하단, 동영상만) -->
                <div v-if="!isImageFile(video) && video.displayUrl && !playingVideoIds.includes(video.id) && durationMap[video.id]"
                  class="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-medium rounded pointer-events-none">
                  {{ formatTime(durationMap[video.id]) }}
                </div>
                <!-- 재생 버튼 (동영상만) -->
                <button v-if="!isImageFile(video)" @click.stop="togglePlay(video.id)" :class="{
                  'opacity-100 scale-100': hoveredVideoId === video.id || !playingVideoIds.includes(video.id),
                  'opacity-0 scale-90': hoveredVideoId !== video.id && playingVideoIds.includes(video.id),
                }"
                  class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-sm text-white rounded-full w-14 h-14 m-auto transition-all duration-300 hover:scale-110 active:scale-95">
                  <!-- 재생 시작 아이콘 -->
                  <svg v-if="!playingVideoIds.includes(video.id)" xmlns="http://www.w3.org/2000/svg" fill="currentColor"
                    viewBox="0.4 -0.7 16 16" class="w-8 h-8">
                    <path
                      d="M6.271 4.055a.5.5 0 0 1 .759-.429l4.592 3.11a.5.5 0 0 1 0 .828l-4.592 3.11a.5.5 0 0 1-.759-.429V4.055z" />
                  </svg>

                  <!-- 재생 중단 아이콘 -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0.4 -0.1 16 16"
                    class="w-8 h-8">
                    <path
                      d="M5.5 3.5A.5.5 0 0 1 6 3h1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-9zM9.5 3.5A.5.5 0 0 1 10 3h1a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-9z" />
                  </svg>
                </button>

                <!-- 재생 프로그레스 바 (재생 중일 때만 표시, 마우스 hover 시 표시, 동영상만) -->
                <div
                  v-if="!isImageFile(video) && playingVideoIds.includes(video.id)"
                  class="absolute bottom-0 left-0 right-0 p-2 bg-black/30 backdrop-blur-sm rounded-b-xl transition-all duration-300 pointer-events-none"
                  :class="{
                    'opacity-100 translate-y-0': hoveredVideoId === video.id || !playingVideoIds.includes(video.id),
                    'opacity-0 translate-y-full': hoveredVideoId !== video.id && playingVideoIds.includes(video.id)
                  }">
                  <div class="flex flex-col gap-1">
                    <!-- 재생 프로그레스 바 백그라운드 -->
                    <div
                      class="relative w-full h-2 bg-gray-300/70 rounded-full cursor-pointer pointer-events-auto overflow-visible"
                      :class="{ 'dragging': isDragging && draggedVideoId === video.id }"
                      :ref="el => { if (el) progressBarRefs[video.id] = el }"
                      @click.stop="seekVideo(video.id, $event)">
                      <!-- 재생 프로그레스 바 진행 상태 -->
                      <div
                        class="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm overflow-hidden"
                        :class="{ 'transition-all duration-300': !(isDragging && draggedVideoId === video.id) }"
                        :style="{ width: `${video.progress || 0}%` }"></div>
                      <!-- 재생 프로그레스 바 핸들 -->
                      <div
                        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border border-blue-500 cursor-pointer shadow hover:shadow-md hover:scale-110 transition-all pointer-events-auto z-10"
                        :class="{ 'transition-none': isDragging && draggedVideoId === video.id }"
                        :style="{ left: `calc(${video.progress || 0}% - 8px)` }"
                        @mousedown="startDragging(video.id, $event)" @click.stop></div>
                    </div>

                    <!-- 재생 시간 표시 -->
                    <div
                      class="flex justify-between text-[10px] font-medium text-gray-200 tracking-wide px-1 pointer-events-auto">
                      <span>{{ formatTime(currentTimeMap[video.id] || 0) }}</span>
                      <span>{{ formatTime(durationMap[video.id] || 0) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 동영상 타이틀 및 정보 -->
              <div class="ml-4 w-full text-left">
                <div v-if="video.title" class="text-sm font-medium text-gray-800 dark:text-gray-200 break-words line-clamp-2">
                  {{ video.title }}
                </div>
                <!-- 영상 정보: 길이(동영상만), 해상도, 용량 (가로 나열) -->
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span v-if="!isImageFile(video) && durationMap[video.id]">
                    {{ formatTime(durationMap[video.id]) }}
                  </span>
                  <span v-if="!isImageFile(video) && durationMap[video.id] && (video.width && video.height || video.fileSize)" class="text-gray-400">•</span>
                  <span v-if="isImageFile(video) && (video.width && video.height || video.fileSize)" class="text-gray-400">•</span>
                  <span v-if="video.width && video.height">
                    {{ video.width }} × {{ video.height }}
                  </span>
                  <span v-if="video.width && video.height && video.fileSize" class="text-gray-400">•</span>
                  <span v-if="video.fileSize">
                    {{ formatFileSize(video.fileSize) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 페이지네이션 (항상 최하단에 고정) -->
          <!-- 예시 이미지 촬영용: ENABLE_DEMO_MODE가 true일 때 항상 표시 -->
          <div v-if="ENABLE_DEMO_MODE || totalPages > 1" class="flex-shrink-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)] px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.75rem,1.5vw,1rem)]">
            <button
              @click="currentPage = Math.max(1, currentPage - 1)"
              :disabled="currentPage === 1"
              class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '이전 페이지' : 'Previous Page'">
              <svg class="w-[clamp(1rem,2vw,1.25rem)] h-[clamp(1rem,2vw,1.25rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div class="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">
              <button
                v-for="page in totalPages"
                :key="page"
                @click="currentPage = page"
                :class="{
                  'bg-emerald-500 text-white': currentPage === page,
                  'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700': currentPage !== page
                }"
                class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 transition-colors min-w-[clamp(2rem,4vw,2.5rem)] text-[clamp(0.75rem,1.2vw,0.875rem)]">
                {{ page }}
              </button>
            </div>
            
            <button
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="px-[clamp(0.75rem,1.5vw,1rem)] py-[clamp(0.5rem,1vw,0.75rem)] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              :title="settingStore.language === 'ko' ? '다음 페이지' : 'Next Page'">
              <svg class="w-[clamp(1rem,2vw,1.25rem)] h-[clamp(1rem,2vw,1.25rem)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <!-- 확대 모달 팝업 - Teleport로 body에 렌더링 -->
        <Teleport to="body">
          <Transition name="modal">
            <div v-if="isZoomed" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
              @mousedown="(e) => { handleModalBackgroundClick(e, unzoomVideo); hideZoomedClipReportSubmenu(); hideZoomedClipReportListSubmenu(); }"
              @mouseup="(e) => { handleModalBackgroundClick(e, unzoomVideo); hideZoomedClipReportSubmenu(); hideZoomedClipReportListSubmenu(); }">
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
                    <!-- 이미지인 경우 -->
                    <img 
                      v-if="zoomedVideo && isImageFile(zoomedVideo)"
                      :src="zoomedVideo.displayUrl"
                      class="object-contain w-full h-full rounded-xl"
                      crossorigin="anonymous"
                      @error="(e) => handleImageError(zoomedVideo.id, e)"
                      draggable="false"
                      alt=""
                    />
                    <!-- 동영상인 경우 -->
                    <video v-else-if="zoomedVideo" ref="zoomVideoRef" :src="zoomedVideo.displayUrl"
                      class="object-cover w-full h-full" preload="metadata" crossorigin="anonymous"
                      @timeupdate="onZoomTimeUpdate($event)"
                      @error="(e) => handleZoomVideoError(zoomedVideo.id, e)"
                      draggable="false"></video>
                    <div v-if="zoomedVideo && !isImageFile(zoomedVideo)" class="absolute inset-0 pointer-events-none transition-colors duration-300"
                      :class="zoomPlaying ? 'bg-transparent' : 'bg-black/30'"></div>
                    <button v-if="zoomedVideo && !isImageFile(zoomedVideo)" @click.stop="togglePlay(zoomedVideo.id)" :class="[
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
                  <!-- 하단 진행 바 + 타이틀 영역 (동영상만) -->
                  <div v-if="zoomedVideo && !isImageFile(zoomedVideo)" class="mt-4 w-full flex flex-col gap-2">
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
                  <!-- 이미지인 경우 타이틀만 표시 -->
                  <div v-else-if="zoomedVideo && isImageFile(zoomedVideo)" class="mt-4 w-full">
                    <div class="flex items-center gap-2">
                      <span v-if="zoomedVideo.title"
                        class="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words max-w-[90vw] sm:max-w-[70vw] md:max-w-[50vw]">{{ zoomedVideo.title
                        }}</span>
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
                    <!-- 보고서 생성 버튼 -->
                    <div class="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                      <button 
                        @click.stop="showZoomedClipReportSubmenu"
                        class="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-medium transition-colors flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{{ settingStore.language === 'ko' ? '보고서 생성' : 'Create Report' }}</span>
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </Transition>
        </Teleport>
        <!-- 우클릭 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
        <Teleport to="body">
          <div v-if="contextMenu.visible" class="fixed z-[200]"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[200px]">
              <button v-if="selectedIds.length < 2" class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                @click.stop="contextZoom">{{ t.expand }}</button>
              <button class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" @click.stop="contextSummary">{{ t.summary }}</button>
              <button class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" @click.stop="contextSearch" :disabled="selectedIds.length === 0">{{ t.search }}</button>
              <button class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200" @click.stop="contextRemoveSummary" :disabled="selectedIds.length === 0">{{ t.removeSummary }}</button>
              <div class="h-px bg-gray-100 dark:bg-gray-700"></div>
              <button class="w-full text-left px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700" @click.stop="contextDelete">{{
                selectedIds.length > 1 ? `${t.deleteSelected} (${selectedIds.length})` : t.delete }}</button>
            </div>
          </div>
        </Teleport>

        <!-- 빈 공간 우클릭 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
        <Teleport to="body">
          <div v-if="emptySpaceContextMenu.visible" class="fixed z-[200]"
            :style="{ left: `${emptySpaceContextMenu.x}px`, top: `${emptySpaceContextMenu.y}px` }" @click.stop>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[200px]">
              <button class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                @click.stop="createGroup">{{ t.createGroup }}</button>
            </div>
          </div>
        </Teleport>

        <!-- 그룹 우클릭 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
        <Teleport to="body">
          <div v-if="groupContextMenu.visible" class="fixed z-[200]"
            :style="{ left: `${groupContextMenu.x}px`, top: `${groupContextMenu.y}px` }" @click.stop>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[200px]">
              <button class="w-full text-left px-4 py-3 text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                @click.stop="deleteGroup">{{ settingStore.language === 'ko' ? '그룹 삭제' : 'Delete Group' }}</button>
            </div>
          </div>
        </Teleport>

        <!-- 채팅 메시지 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
        <Teleport to="body">
          <!-- 배경 오버레이 (외부 클릭 시 메뉴 닫기) -->
          <Transition name="overlay">
            <div v-if="chatMessageContextMenu.visible" 
              class="fixed inset-0 z-[199]"
              @click="closeChatMessageContextMenu">
            </div>
          </Transition>
          <!-- 컨텍스트 메뉴 -->
          <div v-if="chatMessageContextMenu.visible" class="fixed z-[200]"
            :style="{ left: `${chatMessageContextMenu.x}px`, top: `${chatMessageContextMenu.y}px` }" @click.stop>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[160px]">
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="copyChatMessage(chatMessageContextMenu.messageIndex)">
                {{ settingStore.language === 'ko' ? '복사' : 'Copy' }}
              </button>
              <!-- 초기 메시지가 아닐 때만 보고서 생성 버튼 표시 -->
              <div v-if="chatMessageContextMenu.messageIndex !== null && currentChatMessages[chatMessageContextMenu.messageIndex] && !currentChatMessages[chatMessageContextMenu.messageIndex].isInitial" 
                class="relative"
                @mouseenter.stop="showReportSubmenu(chatMessageContextMenu.messageIndex, chatMessageContextMenu.x, chatMessageContextMenu.y)"
                @mouseleave.stop="hideReportSubmenu">
                <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm flex items-center justify-between"
                  @click.stop>
                  <span>{{ settingStore.language === 'ko' ? '보고서 생성' : 'Create Report' }}</span>
                  <span class="ml-2">›</span>
                </button>
              </div>
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="openSettingsFromContextMenu">
                {{ settingStore.language === 'ko' ? '설정' : 'Settings' }}
              </button>
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="deleteChatMessage(chatMessageContextMenu.messageIndex)">
                {{ settingStore.language === 'ko' ? '삭제' : 'Delete' }}
              </button>
            </div>
          </div>
          
          <!-- 보고서 생성 서브메뉴 (Teleport로 body에 렌더링) -->
          <div v-if="reportSubmenu.visible" class="fixed z-[201]"
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
          
          <!-- 보고서 목록 서브메뉴 (Teleport로 body에 렌더링) -->
          <div v-if="reportListSubmenu.visible" class="fixed z-[202]"
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
                <div class="font-medium break-words line-clamp-2">{{ report.title }}</div>
                <div v-if="report.description" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {{ report.description }}
                </div>
              </button>
            </div>
          </div>
          
          <!-- 확대된 클립용 보고서 생성 서브메뉴 (Teleport로 body에 렌더링, 팝업보다 높은 z-index) -->
          <div v-if="zoomedClipReportSubmenu.visible" class="fixed z-[10000]"
            :style="{ left: `${zoomedClipReportSubmenu.x}px`, top: `${zoomedClipReportSubmenu.y}px` }" 
            @click.stop
            @mouseenter.stop="keepZoomedClipReportSubmenuVisible"
            @mouseleave.stop="hideZoomedClipReportSubmenu">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[180px]">
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm flex items-center justify-between"
                @click.stop="showZoomedClipReportListSubmenu(zoomedClipReportSubmenu.x, zoomedClipReportSubmenu.y)">
                <span>{{ settingStore.language === 'ko' ? '기존 보고서에 추가' : 'Add to Existing Report' }}</span>
                <span class="ml-2">›</span>
              </button>
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="createNewReportFromZoomedClip">
                {{ settingStore.language === 'ko' ? '새 보고서 생성' : 'Create New Report' }}
              </button>
            </div>
          </div>
          
          <!-- 확대된 클립용 보고서 목록 서브메뉴 (Teleport로 body에 렌더링, 팝업보다 높은 z-index) -->
          <div v-if="zoomedClipReportListSubmenu.visible" class="fixed z-[10001]"
            :style="{ left: `${zoomedClipReportListSubmenu.x}px`, top: `${zoomedClipReportListSubmenu.y}px` }" 
            @click.stop
            @mouseenter.stop="keepZoomedClipReportListSubmenuVisible"
            @mouseleave.stop="hideZoomedClipReportListSubmenu">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[250px] max-h-[400px] overflow-y-auto">
              <div v-if="zoomedClipReportListSubmenu.reports.length === 0" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {{ settingStore.language === 'ko' ? '보고서가 없습니다' : 'No reports available' }}
              </div>
              <button 
                v-for="report in zoomedClipReportListSubmenu.reports" 
                :key="report.id"
                class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                @click.stop="addZoomedClipToSelectedReport(report.id)">
                <div class="font-medium break-words line-clamp-2">{{ report.title }}</div>
                <div v-if="report.description" class="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                  {{ report.description }}
                </div>
              </button>
            </div>
          </div>
        </Teleport>

        <!-- 채팅창 탭 컨텍스트 메뉴 (Teleport로 body에 렌더링) -->
        <Teleport to="body">
          <!-- 배경 오버레이 (외부 클릭 시 메뉴 닫기) -->
          <Transition name="overlay">
            <div v-if="chatTabContextMenu.visible" 
              class="fixed inset-0 z-[199]"
              @click="closeChatTabContextMenu">
            </div>
          </Transition>
          <!-- 컨텍스트 메뉴 -->
          <div v-if="chatTabContextMenu.visible" class="fixed z-[200]"
            :style="{ left: `${chatTabContextMenu.x}px`, top: `${chatTabContextMenu.y}px` }" @click.stop>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden w-[160px]">
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="closeChatTab(chatTabContextMenu.chatIndex)">
                {{ settingStore.language === 'ko' ? '닫기' : 'Close' }}
              </button>
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="closeOtherChatTabs(chatTabContextMenu.chatIndex)">
                {{ settingStore.language === 'ko' ? '다른 탭 닫기' : 'Close Others' }}
              </button>
              <button class="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm"
                @click.stop="closeAllChatTabs">
                {{ settingStore.language === 'ko' ? '전체 닫기' : 'Close All' }}
              </button>
            </div>
          </div>
        </Teleport>

        <!-- 중앙 팝업창 -->
        <Transition name="modal">
          <div v-if="showDeletePopup"
            class="fixed inset-0 flex items-center justify-center z-[100] bg-black/50 backdrop-blur-sm rounded-2xl">
            <div
              class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 min-w-[350px] max-w-[90vw] relative transform transition-all duration-300">
              <div class="text-lg font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
                <p class="mb-2">{{ selectedIds.length }}{{ settingStore.language === 'ko' ? '개의 동영상이 삭제됩니다.' : ' ' + t.deleteConfirm }}</p>
                <p class="text-sm font-normal text-gray-600 dark:text-gray-400">{{ t.deleteConfirmDetail }}</p>
              </div>
              <div class="flex justify-end gap-3 mt-8">
                <button
                  class="px-6 py-2.5 rounded-xl bg-slate-700 dark:bg-gray-700 text-white hover:bg-slate-800 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-sm"
                  @click="confirmDelete">delete</button>
                <button
                  class="px-6 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 transform hover:scale-105 active:scale-95 font-medium shadow-sm"
                  @click="showDeletePopup = false">cancel</button>
              </div>
            </div>
          </div>
        </Transition>


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
                      <button class="w-full text-left flex items-center gap-3 px-5 py-4 bg-emerald-100/80 dark:bg-emerald-900/30 hover:bg-emerald-200/80 dark:hover:bg-emerald-900/40 transition-colors" @click="showSummarizeVlmParams = !showSummarizeVlmParams">
                        <div class="flex items-center gap-3 flex-1">
                          <div class="w-8 h-8 rounded-lg bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h2 class="text-lg font-bold text-emerald-900 dark:text-emerald-100">{{ settingStore.language === 'ko' ? 'Summarize 파라미터' : 'Summarize Parameters' }}</h2>
                        </div>
                        <span class="text-emerald-600 dark:text-emerald-300 text-xl font-bold">{{ showSummarizeVlmParams ? '▲' : '▼' }}</span>
                      </button>
                      <Transition name="fade-slide">
                        <div v-show="showSummarizeVlmParams" class="p-5 space-y-5">
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
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Summarize 전용 파라미터' : 'Summarize-Specific Parameters' }}</h3>
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

                          <!-- Chat 파라미터 -->
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Chat 파라미터' : 'Chat Parameters' }}</h3>
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

                          <!-- Notification 파라미터 -->
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                            <h3 class="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Notification 파라미터' : 'Notification Parameters' }}</h3>
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
                        </div>
                      </Transition>
                    </div>
                    
                    <!-- Query Parameters -->
                    <div class="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 shadow-lg overflow-hidden">
                      <button class="w-full text-left flex items-center gap-3 px-5 py-4 bg-blue-100/80 dark:bg-blue-900/30 hover:bg-blue-200/80 dark:hover:bg-blue-900/40 transition-colors" @click="showQueryVlmParams = !showQueryVlmParams">
                        <div class="flex items-center gap-3 flex-1">
                          <div class="w-8 h-8 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <h2 class="text-lg font-bold text-blue-900 dark:text-blue-100">{{ settingStore.language === 'ko' ? 'Query 파라미터' : 'Query Parameters' }}</h2>
                        </div>
                        <span class="text-blue-600 dark:text-blue-300 text-xl font-bold">{{ showQueryVlmParams ? '▲' : '▼' }}</span>
                      </button>
                      <Transition name="fade-slide">
                        <div v-show="showQueryVlmParams" class="p-5 space-y-5">
                          <!-- Chunk 설정 -->
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                            <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'Chunk 설정' : 'Chunk Settings' }}</h3>
                            <div class="grid lg:grid-cols-1 gap-4">
                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">{{ settingStore.language === 'ko' ? 'Chunk Size' : 'Chunk Size' }}</h2>
                              <label class="block text-sm mb-1 text-gray-700 dark:text-gray-300">{{ settingStore.language === 'ko' ? 'Chunk Size' : 'Chunk Size' }}</label>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">{{ settingStore.language === 'ko' ? '동영상 추론에서 분할 단위를 설정합니다.' : 'Set the chunking unit for video inference.' }}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '동영상 추론에서 분할 단위를 설정합니다.' : 'Set the chunking unit for video inference.' }}</p>
                                <select v-model.number="settingStore.searchChunk" class="border-2 border-blue-300 dark:border-blue-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
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
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                            <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? 'LLM 기본 파라미터' : 'Basic LLM Parameters' }}</h3>
                            <div class="grid lg:grid-cols-3 gap-4">
                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Top-k</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '최고 확률 어휘 토큰을 유지할 개수' : 'The number of highest probability vocabulary tokens to keep for top-k-filtering' }}</p>
                                <input v-model.number="settingStore.searchTopK" type="number" min="1" max="1000" step="1"
                                  @input="clampSearchValue('searchTopK', 1000, 1)"
                                  class="border-2 border-blue-300 dark:border-blue-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                              </section>

                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Top-p</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 top-p 샘플링 질량' : 'The top-p sampling mass used for text generation' }}</p>
                                <div class="flex items-center gap-2 mb-2">
                                  <input v-model.number="settingStore.searchTopP" type="number" min="0" max="1" step="0.1"
                                    @input="clampSearchValue('searchTopP', 1, 0)"
                                    class="border-2 border-blue-300 dark:border-blue-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                  <button class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" @click="resetSearchTopP">↺</button>
                                </div>
                                <div class="flex items-center gap-2 h-8">
                                  <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.searchTopP" type="range" min="0" max="1" step="0.05"
                                    class="flex-1 border-blue-300 dark:border-blue-600" />
                                  <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                </div>
                              </section>

                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Temperature</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '텍스트 생성에 사용되는 샘플링 온도' : 'The sampling temperature to use for text generation' }}</p>
                                <div class="flex items-center gap-2 mb-2">
                                  <input v-model.number="settingStore.searchTemperature" type="number" min="0" max="2" step="0.1"
                                    @input="clampSearchValue('searchTemperature', 2, 0)"
                                    class="border-2 border-blue-300 dark:border-blue-600 w-24 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                  <button class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" @click="resetSearchTemperature">↺</button>
                                </div>
                                <div class="flex items-center gap-2 h-8">
                                  <span class="text-xs text-gray-400 w-8 text-center">0</span>
                                <input v-model.number="settingStore.searchTemperature" type="range" min="0" max="2" step="0.1"
                                    class="flex-1 border-blue-300 dark:border-blue-600" />
                                  <span class="text-xs text-gray-400 w-8 text-center">2</span>
                                </div>
                              </section>
                            </div>
                          </div>

                          <!-- 기타 파라미터 -->
                          <div class="bg-white/80 dark:bg-gray-800/80 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                            <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4 uppercase tracking-wide">{{ settingStore.language === 'ko' ? '기타 파라미터' : 'Other Parameters' }}</h3>
                            <div class="grid lg:grid-cols-2 gap-4">
                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <div class="flex items-center justify-between mb-2">
                                  <div>
                                    <h2 class="font-semibold text-gray-800 dark:text-gray-200 text-base">Max Tokens</h2>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ settingStore.language === 'ko' ? '생성할 최대 토큰 수' : 'The maximum number of tokens to generate' }}</p>
                                  </div>
                                  <div class="flex items-center gap-2">
                                    <input v-model.number="settingStore.searchMaxTokens" type="number" min="1" max="1024" step="1"
                                      @input="clampSearchValue('searchMaxTokens', 1024, 1)"
                                      class="border-2 border-blue-300 dark:border-blue-600 w-20 text-center rounded-lg px-2 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                    <button class="border-2 border-blue-300 dark:border-blue-600 w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center" @click="resetSearchMaxTokens">↺</button>
                                  </div>
                                </div>
                                <div class="flex items-center gap-2 h-8 mt-3">
                                  <span class="text-xs text-gray-400 w-8 text-center">1</span>
                                  <input v-model.number="settingStore.queryMaxTokens" type="range" min="1" max="1024" step="1"
                                    class="flex-1 border-blue-300 dark:border-blue-600" />
                                  <span class="text-xs text-gray-400 w-12 text-center">1024</span>
                                </div>
                              </section>

                              <section class="rounded-lg border border-blue-200 dark:border-blue-700 px-4 py-4 bg-white dark:bg-gray-800 shadow-sm">
                                <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200 text-base">Seed</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ settingStore.language === 'ko' ? '샘플링에 사용할 시드 값' : 'Seed value to use for sampling' }}</p>
                                <input v-model.number="settingStore.searchSeed" type="number" min="1" max="4294967295" step="1"
                                  @input="clampSearchValue('searchSeed', 4294967295, 1)"
                                  class="border-2 border-blue-300 dark:border-blue-600 rounded-lg px-4 py-2.5 w-full bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
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

        <!-- 업로드 진행률 모달 -->
        <Teleport to="body">
          <div v-if="showUploadModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ t.uploading }}</h3>
                <button @click="closeUploadModal" class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="space-y-4 max-h-[60vh] overflow-y-auto">
                <div v-for="(upload, index) in uploadProgress" :key="upload.id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-700">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1 mr-2">{{ upload.fileName }}</span>
                    <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ upload.progress }}%</span>
                  </div>
                  <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mb-2">
                    <div 
                      class="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2.5 rounded-full transition-all duration-300"
                      :style="{ width: `${upload.progress}%` }"
                    ></div>
                  </div>
                  <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{{ upload.status }}</span>
                    <span v-if="upload.uploaded > 0">{{ formatFileSize(upload.uploaded) }} / {{ formatFileSize(upload.total) }}</span>
                  </div>
                </div>
              </div>
              <div v-if="allUploadsComplete" class="mt-4 text-center">
                <button @click="closeUploadModal" class="px-6 py-2 bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg hover:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors">
                  {{ t.complete }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>
    </div>
  </div>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showListLoadingModal" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onActivated, onDeactivated, computed, nextTick, watch, onBeforeUnmount } from "vue";
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useSummaryVideoStore } from '@/stores/summaryVideoStore';
import { useSettingStore } from '@/stores/settingStore';
import { useVideoFileStore } from '@/stores/videoFileStore';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { marked } from 'marked';
import { formatTime, formatFileSize, getCurrentTime } from '@/utils/formatUtils';
import { isImageFile, isUnsupportedFormat, getVideoFileExtension, createVideoObject } from '@/utils/videoUtils';
import { emitVideoDeletedEvent } from '@/composables/useVideoSync';
import settingIcon from '@/assets/icons/setting.png';
import videoIcon from '@/assets/icons/video.png';
import timeIcon from '@/assets/icons/time.png';

// ==================== 상수 정의 ====================
const API_BASE_URL = getApiBaseUrl();
const UNSUPPORTED_VIDEO_FORMATS = ['avi', 'mkv', 'flv', 'wmv']; // 브라우저 호환성을 위해 .avi도 변환 필요
const MAX_ERROR_RETRIES = 2;
const UPLOAD_TIMEOUT = 1800000; // 30분
const CONTEXT_MENU_SIZE = { width: 200, height: 200, margin: 10 };
const ROWS_PER_PAGE = 3;
const ENABLE_DEMO_MODE = false;

// ==================== 로딩 모달 상태 ====================
const showListLoadingModal = ref(false);

// ==================== AbortController 관리 유틸리티 ====================

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

// ==================== API 호출 함수 ====================

/**
 * VIA 파일 목록 조회
 * @returns {Promise<Array|null>} 파일 목록 또는 null
 */
async function loadViaFiles() {
  const abortController = createAbortController();
  
  try {
    const response = await fetch(`${API_BASE_URL}/via-files?purpose=vision`, {
      signal: abortController.signal
    });
    if (!response.ok) {
      console.warn('VIA 파일 목록 조회 실패:', response.status);
      return null;
    }
    const data = await response.json();
    if (data?.data) {
      console.log('VIA 서버 파일 목록:', data.data);
      return data.data;
    }
    return null;
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }
    console.error('VIA 파일 목록 조회 중 오류:', error);
    return null;
  } finally {
    removeAbortController(abortController);
  }
}

/**
 * 동영상을 MP4로 변환
 * @param {string|number} videoId - 동영상 ID
 * @param {string} userId - 사용자 ID
 * @param {Object} videoObject - 동영상 객체
 * @returns {Promise<string|null>} 변환된 URL 또는 null
 */
async function convertVideoToMp4(videoId, userId, videoObject) {
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

// ==================== 다국어 지원 ====================
const settingStore = useSettingStore();
const videoFileStore = useVideoFileStore();

const translations = {  
  ko: {
    workspace: "Video management space",
    description: "파일 업로드 후 파일을 우클릭하여 요약 혹은 검색을 진행할 수 있습니다.",
    descriptionDetail: "검색 메뉴에서 원하는 장면을 검색하고 해당 장면의 클립을 확인할 수 있습니다.",
    selectAll: "전체 선택",
    clearSelection: "선택 해제",
    uploadVideo: "파일 업로드",
    pleaseUpload: "파일을 업로드해주세요",
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
    createGroup: "그룹 생성",
    deleteGroup: "그룹 삭제",
    deleteGroupConfirm: "그룹을 삭제하시겠습니까?",
    deleteGroupConfirmDetail: "그룹 내의 동영상은 루트로 이동됩니다."
  },
  en: {
    workspace: "Video management space",
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
    createGroup: "Create Group",
    deleteGroup: "Delete Group",
    deleteGroupConfirm: "Do you want to delete this group?",
    deleteGroupConfirmDetail: "Videos in the group will be moved to root."
  }
};

const t = computed(() => translations[settingStore.language] || translations.ko);

const isZoomed = ref(false);
const zoomedVideo = ref(null);
const zoomedClip = ref(null); // 현재 재생 중인 클립 정보 (sentence 포함)
const showSentencePopup = ref(true); // 장면 설명 팝업 표시 여부
const zoomVideoRef = ref(null);
const zoomProgressBarRef = ref(null);
const zoomPlaying = ref(false); // 확대 모달 재생 상태 (그리드와 분리)
const zoomProgress = ref(0);   // 확대 모달 진행률 (그리드와 분리)
const hoveredVideoId = ref(null);
const playingVideoIds = ref([]);
const showDeletePopup = ref(false);
const items = ref([]);
const selectedIds = ref([]);
const videoRefs = ref({});
const progressBarRefs = ref({}); // 비디오별 진행바 엘리먼트 참조
const isDragging = ref(false);
const draggedVideoId = ref(null);
let draggingBarEl = null; // 현재 드래그 중인 진행바 엘리먼트
// 드래그 선택 관련
const videoContainerRef = ref(null);
const videoGridRef = ref(null);
const videoCardRefs = ref({});
const isDragSelecting = ref(false);
const dragSelectStart = ref({ x: 0, y: 0 });
const dragSelectEnd = ref({ x: 0, y: 0 });
const dragSelectBox = ref(null);
const dragSelectInitialSelection = ref([]); // 드래그 시작 시점의 선택 상태 저장
const isDragOverUpload = ref(false); // 드래그 & 드롭 업로드 상태
const chatSessions = ref([]);
const currentChatIndex = ref(0);
const searchInput = ref('');
const isSearching = ref(false);
const chatContainer = ref(null);
const editingChatIndex = ref(null);
const editingChatName = ref('');
const chatNameInput = ref(null);
// 업로드 진행률 모달 상태
const showUploadModal = ref(false);
const uploadProgress = ref([]); // { id, fileName, progress, status, uploaded, total }
// 보고서 생성 로딩 상태
const isCreatingReport = ref(false);
const reportLoadingMessage = ref('');
const reportSuccess = ref(false);
const reportSuccessMessage = ref('');
// 보고서 제목 입력 모달 상태
const showReportTitleModal = ref(false);
const reportTitleInput = ref('');
const pendingReportData = ref(null); // 제목 입력 대기 중인 보고서 데이터
const reportTitleError = ref(''); // 제목 중복 에러 메시지
const isCheckingTitle = ref(false); // 제목 확인 중 플래그
const activeUploads = ref({}); // { uploadId: XMLHttpRequest } - 진행 중인 업로드 추적

// 진행 중인 fetch 요청을 취소하기 위한 AbortController
const abortControllers = ref([]); // 진행 중인 fetch 요청 추적

// 시간 표시용 맵 (Summary.vue 스타일 이식)
const currentTimeMap = ref({});
const durationMap = ref({});

// 페이지네이션 관련
const currentPage = ref(1);
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);

// 화면 크기 변경 핸들러
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

// 화면 크기에 따른 열 수 계산
const columnsPerRow = computed(() => {
  const width = windowWidth.value;
  if (width >= 1024) return 5; // lg:grid-cols-5
  if (width >= 768) return 3;  // md:grid-cols-3
  return 2; // grid-cols-2
});

// 페이지당 아이템 수 계산 (3줄 × 열 수)
const itemsPerPage = computed(() => ROWS_PER_PAGE * columnsPerRow.value);


// 총 페이지 수 계산
// const totalPages = computed(() => {
//   if (items.value.length <= itemsPerPage.value) return 1;
//   return Math.ceil(items.value.length / itemsPerPage.value);
// });

// 현재 그룹에 속한 동영상만 필터링
const filteredItems = computed(() => {
  // 루트 그룹이면 그룹에 속하지 않은 동영상만 표시
  if (currentGroupPath.value.length === 0) {
    // 모든 그룹에 속한 동영상 ID 수집
    const groupedVideoIds = new Set();
    groups.value.forEach(group => {
      if (group.videoIds && Array.isArray(group.videoIds)) {
        group.videoIds.forEach(videoId => groupedVideoIds.add(videoId));
      }
    });
    
    // 그룹에 속하지 않은 동영상만 필터링
    return items.value.filter(video => !groupedVideoIds.has(video.id));
  }
  
  // 현재 그룹 ID 가져오기
  const currentGroupId = currentGroupPath.value[currentGroupPath.value.length - 1];
  const currentGroup = groups.value.find(g => g.id === currentGroupId);
  
  if (!currentGroup) {
    return items.value;
  }
  
  // 현재 그룹에 속한 동영상만 필터링
  return items.value.filter(video => currentGroup.videoIds.includes(video.id));
});

// 현재 그룹에 속한 그룹만 필터링 (하위 그룹)
const filteredGroups = computed(() => {
  // 루트 그룹이면 모든 그룹 표시
  if (currentGroupPath.value.length === 0) {
    return groups.value;
  }
  
  // 현재 그룹 ID 가져오기
  const currentGroupId = currentGroupPath.value[currentGroupPath.value.length - 1];
  const currentGroup = groups.value.find(g => g.id === currentGroupId);
  
  if (!currentGroup) {
    return [];
  }
  
  // 현재 그룹에 속한 그룹만 필터링 (그룹도 videoIds처럼 관리하거나, 별도 필드 필요)
  // 일단은 빈 배열 반환 (그룹 내부에 그룹이 있는 경우는 나중에 확장)
  return [];
});

// 예시 이미지 촬영용 고정값
const totalPages = computed(() => {
  if (ENABLE_DEMO_MODE) {
    return 7; // 고정값: 7페이지
  }
  if (filteredItems.value.length <= itemsPerPage.value) return 1;
  return Math.ceil(filteredItems.value.length / itemsPerPage.value);
});

// 현재 페이지의 아이템만 필터링
const paginatedItems = computed(() => {
  if (filteredItems.value.length <= itemsPerPage.value) {
    return filteredItems.value;
  }
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  const endIndex = startIndex + itemsPerPage.value;
  return filteredItems.value.slice(startIndex, endIndex);
});

// 동영상 리스트 통계
// const videoListCount = computed(() => items.value.length);
// const videoListTotalDuration = computed(() => {
//   const totalSeconds = items.value.reduce((sum, video) => {
//     // durationMap에서 동영상 길이 가져오기
//     const duration = durationMap.value[video.id] || 0;
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
    // durationMap에서 동영상 길이 가져오기
    const duration = durationMap.value[video.id] || 0;
    return sum + (isFinite(duration) && duration > 0 ? duration : 0);
  }, 0);
  return formatDuration(totalSeconds);
});

// 확대 모달 시간 표시용
const zoomCurrentTime = ref(0);
const zoomDuration = ref(0);
// Context menu state for right-click on video cards
const contextMenu = ref({ visible: false, x: 0, y: 0, video: null });
// 채팅 메시지 컨텍스트 메뉴 상태
const chatMessageContextMenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
// 보고서 생성 서브메뉴 상태
const reportSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0 });
// 보고서 목록 서브메뉴 상태
const reportListSubmenu = ref({ visible: false, messageIndex: null, x: 0, y: 0, reports: [] });
// 확대된 클립용 보고서 생성 서브메뉴 상태
const zoomedClipReportSubmenu = ref({ visible: false, x: 0, y: 0 });
// 확대된 클립용 보고서 목록 서브메뉴 상태
const zoomedClipReportListSubmenu = ref({ visible: false, x: 0, y: 0, reports: [] });
// 채팅창 탭 컨텍스트 메뉴 상태
const chatTabContextMenu = ref({ visible: false, chatIndex: null, x: 0, y: 0 });
// 빈 공간 우클릭 컨텍스트 메뉴 상태
const emptySpaceContextMenu = ref({ visible: false, x: 0, y: 0 });
// 그룹 데이터
const groups = ref([]);
// 현재 그룹 경로 (그룹 ID 배열, 빈 배열이면 루트)
const currentGroupPath = ref([]);
// 드래그 오버 중인 그룹 ID
const dragOverGroupId = ref(null);
// 편집 중인 그룹 ID
const editingGroupId = ref(null);
// 편집 중인 그룹 이름
const editingGroupName = ref('');
// 그룹 우클릭 컨텍스트 메뉴 상태
const groupContextMenu = ref({ visible: false, x: 0, y: 0, group: null });

// ==================== 그룹 데이터 저장/복원 ====================
function getGroupsStorageKey() {
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    return 'management_groups_no_user';
  }
  return `management_groups_${userId}`;
}

function saveGroupsToLocalStorage() {
  try {
    const storageKey = getGroupsStorageKey();
    const groupsData = groups.value.map(group => ({
      id: group.id,
      name: group.name,
      position: group.position,
      videoIds: group.videoIds
    }));
    localStorage.setItem(storageKey, JSON.stringify(groupsData));
  } catch (error) {
    console.error('그룹 데이터 저장 실패:', error);
  }
}

function loadGroupsFromLocalStorage() {
  try {
    const storageKey = getGroupsStorageKey();
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      groups.value = [];
      return;
    }
    
    const groupsData = JSON.parse(stored);
    if (Array.isArray(groupsData)) {
      groups.value = groupsData;
    } else {
      groups.value = [];
    }
  } catch (error) {
    console.error('그룹 데이터 불러오기 실패:', error);
    groups.value = [];
  }
}

// ==================== 유틸리티 함수 ====================
// 팝업 배경 클릭 핸들러 (드래그 방지)
let modalMouseDownPos = null;
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
// formatTime, getCurrentTime은 @/utils/formatUtils에서 import됨
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

// formatFileSize는 @/utils/formatUtils에서 import됨
// filterVideoFiles는 alert를 포함하는 커스텀 버전 필요
function filterVideoFiles(files) {
  return Array.from(files).filter((file) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
      alert(settingStore.language === 'ko' ? '동영상 또는 이미지 파일만 업로드할 수 있습니다.' : 'Only video or image files can be uploaded.');
      return false;
    }
    return true;
  });
}

// createVideoObject, getVideoFileExtension, isUnsupportedFormat, isImageFile은 @/utils/videoUtils에서 import됨

function constrainContextMenuPosition(x, y) {
  const { width, height, margin } = CONTEXT_MENU_SIZE;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // 경계 확인 및 조정
  if (x + width > windowWidth) x = windowWidth - width - margin;
  if (y + height > windowHeight) y = windowHeight - height - margin;
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  return { x, y };
  }

// ==================== 컨텍스트 메뉴 ====================
function onVideoContextMenu(video, e) {
  if (selectedIds.value.length < 2 && !selectedIds.value.includes(video.id)) {
    selectedIds.value = [video.id];
  }

  // 다른 메뉴들에게 비디오 컨텍스트 메뉴가 열릴 예정임을 먼저 알림 (다른 메뉴를 닫기 위해)
  window.dispatchEvent(new CustomEvent('video-context-menu-opened'));

  const { x, y } = constrainContextMenuPosition(e.clientX, e.clientY);
  contextMenu.value = { visible: true, x, y, video };
}

function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.video = null;
}

// ==================== 빈 공간 우클릭 컨텍스트 메뉴 ====================
function onEmptySpaceContextMenu(e) {
  const clickedElement = e.target;
  
  // 그리드 요소 자체를 클릭한 경우 처리
  if (clickedElement === videoGridRef.value) {
    e.preventDefault();
    e.stopPropagation();
    
    // 다른 메뉴들에게 빈 공간 컨텍스트 메뉴가 열릴 예정임을 알림
    window.dispatchEvent(new CustomEvent('empty-space-context-menu-opened'));

    const { x, y } = constrainContextMenuPosition(e.clientX, e.clientY);
    emptySpaceContextMenu.value = { visible: true, x, y };
    return;
  }
  
  // 동영상 카드나 그룹 요소를 클릭한 경우 무시
  // 동영상 카드는 rounded-2xl 클래스를 가진 div로 감싸져 있음
  // 그룹 요소는 border-dashed 클래스를 가짐
  const videoCard = clickedElement.closest('div[class*="rounded-2xl"]:not([class*="border-dashed"])');
  const groupElement = clickedElement.closest('[class*="border-dashed"]');
  
  // 동영상 카드나 그룹이 아닌 경우에만 처리 (빈 공간)
  // 또한 드래그 선택 영역도 무시
  if (!videoCard && !groupElement && !clickedElement.closest('[class*="border-blue-500"]')) {
    e.preventDefault();
    e.stopPropagation();
    
    // 다른 메뉴들에게 빈 공간 컨텍스트 메뉴가 열릴 예정임을 알림
    window.dispatchEvent(new CustomEvent('empty-space-context-menu-opened'));

    const { x, y } = constrainContextMenuPosition(e.clientX, e.clientY);
    emptySpaceContextMenu.value = { visible: true, x, y };
  }
}

function closeEmptySpaceContextMenu() {
  emptySpaceContextMenu.value.visible = false;
}

// ==================== 그룹 생성 ====================
function createGroup() {
  if (!emptySpaceContextMenu.value.visible) return;

  // 그리드 내에서 마우스 위치를 기준으로 그룹 위치 계산
  const gridRect = videoGridRef.value?.getBoundingClientRect();
  if (!gridRect) return;

  const clickX = emptySpaceContextMenu.value.x;
  const clickY = emptySpaceContextMenu.value.y;

  // 그리드 좌표로 변환
  const gridX = clickX - gridRect.left;
  const gridY = clickY - gridRect.top;

  // 그리드 열 수 계산 (반응형)
  const gridCols = window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 3 : 2;
  const gap = 24; // gap-6 = 1.5rem = 24px
  const padding = 24; // p-6 = 1.5rem = 24px

  // 그리드 셀 크기 계산 (대략적인 값)
  const cellWidth = (gridRect.width - padding * 2 - gap * (gridCols - 1)) / gridCols;
  const cellHeight = cellWidth * 0.75; // aspect-video 비율

  // 그리드 셀 인덱스 계산
  const colIndex = Math.max(0, Math.floor((gridX - padding) / (cellWidth + gap)));
  const rowIndex = Math.max(0, Math.floor((gridY - padding) / (cellHeight + gap)));

  // 그룹 생성
  const newGroup = {
    id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: settingStore.language === 'ko' ? `그룹 ${groups.value.length + 1}` : `Group ${groups.value.length + 1}`,
    position: { x: colIndex, y: rowIndex },
    videoIds: []
  };

  groups.value.push(newGroup);
  closeEmptySpaceContextMenu();
  // 그룹 데이터 저장
  saveGroupsToLocalStorage();
}

// 그룹의 그리드 위치 계산 (CSS Grid order 사용)
function getGroupGridPosition(group) {
  // 그리드 열 수 계산 (반응형)
  const gridCols = window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 3 : 2;
  // 그리드 순서 계산: row * cols + col
  // 그룹을 동영상 앞에 배치하기 위해 큰 음수 값 사용
  const order = -(group.position.y * gridCols + group.position.x + 1000);
  return {
    order: order
  };
}

// ==================== 그룹 네비게이션 ====================
function enterGroup(groupId) {
  // 그룹 내부로 진입
  currentGroupPath.value.push(groupId);
  // 페이지를 1로 리셋
  currentPage.value = 1;
}

function navigateToGroup(path) {
  // 특정 그룹 경로로 이동
  currentGroupPath.value = [...path];
  // 페이지를 1로 리셋
  currentPage.value = 1;
}

function getGroupName(groupId) {
  const group = groups.value.find(g => g.id === groupId);
  return group ? group.name : (settingStore.language === 'ko' ? '알 수 없음' : 'Unknown');
}

// ==================== 그룹 이름 편집 ====================
const groupNameInput = ref(null);

function startEditGroupName(groupId, currentName) {
  editingGroupId.value = groupId;
  editingGroupName.value = currentName;
  // 다음 틱에서 input에 포커스
  nextTick(() => {
    if (groupNameInput.value) {
      groupNameInput.value.focus();
      groupNameInput.value.select();
    }
  });
}

function saveGroupName(groupId) {
  if (!editingGroupName.value.trim()) {
    // 빈 이름이면 원래 이름으로 복원
    cancelGroupNameEdit();
    return;
  }
  
  const group = groups.value.find(g => g.id === groupId);
  if (group) {
    group.name = editingGroupName.value.trim();
    // 그룹 데이터 저장
    saveGroupsToLocalStorage();
  }
  
  editingGroupId.value = null;
  editingGroupName.value = '';
}

function cancelGroupNameEdit() {
  editingGroupId.value = null;
  editingGroupName.value = '';
}

// ==================== 그룹 컨텍스트 메뉴 ====================
function onGroupContextMenu(group, e) {
  // 다른 메뉴들에게 그룹 컨텍스트 메뉴가 열릴 예정임을 알림
  window.dispatchEvent(new CustomEvent('group-context-menu-opened'));

  const { x, y } = constrainContextMenuPosition(e.clientX, e.clientY);
  groupContextMenu.value = { visible: true, x, y, group };
}

function closeGroupContextMenu() {
  groupContextMenu.value.visible = false;
  groupContextMenu.value.group = null;
}

function deleteGroup() {
  if (!groupContextMenu.value.group) return;
  
  const group = groupContextMenu.value.group;
  const confirmMessage = settingStore.language === 'ko' 
    ? `${t.value.deleteGroupConfirm}\n${t.value.deleteGroupConfirmDetail}`
    : `${t.value.deleteGroupConfirm}\n${t.value.deleteGroupConfirmDetail}`;
  
  if (!confirm(confirmMessage)) {
    closeGroupContextMenu();
    return;
  }
  
  // 그룹 삭제
  const groupIndex = groups.value.findIndex(g => g.id === group.id);
  if (groupIndex !== -1) {
    // 그룹에 속한 동영상은 루트로 이동 (videoIds에서 제거하면 자동으로 루트에 표시됨)
    // 그룹 삭제
    groups.value.splice(groupIndex, 1);
    
    // 현재 그룹 경로가 삭제된 그룹을 포함하고 있으면 루트로 이동
    if (currentGroupPath.value.includes(group.id)) {
      currentGroupPath.value = [];
      currentPage.value = 1;
    }
    
    // 그룹 데이터 저장
    saveGroupsToLocalStorage();
  }
  
  closeGroupContextMenu();
}

// ==================== 동영상 드래그 앤 드롭 ====================
function onVideoDragStart(videoId, e) {
  draggedVideoId.value = videoId;
  // 드래그 데이터 설정
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', videoId);
  // 동영상 드래그임을 표시하는 커스텀 데이터 타입 추가
  e.dataTransfer.setData('application/video-drag', 'true');
  // 드래그 이미지 설정 (투명하게)
  const dragImage = document.createElement('div');
  dragImage.style.opacity = '0';
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, 0, 0);
  setTimeout(() => document.body.removeChild(dragImage), 0);
}

function onVideoDragEnd() {
  draggedVideoId.value = null;
  dragOverGroupId.value = null;
}

function onGroupDragOver(groupId, e) {
  e.preventDefault();
  e.stopPropagation();
  dragOverGroupId.value = groupId;
  e.dataTransfer.dropEffect = 'move';
}

function onGroupDragLeave(groupId, e) {
  // 그룹 요소를 벗어났는지 확인 (자식 요소로 이동한 경우는 무시)
  const relatedTarget = e.relatedTarget;
  const groupElement = e.currentTarget;
  if (!groupElement.contains(relatedTarget)) {
    dragOverGroupId.value = null;
  }
}

function onGroupDrop(groupId, e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!draggedVideoId.value) return;
  
  const group = groups.value.find(g => g.id === groupId);
  if (!group) return;
  
  // 그룹에 동영상 추가 (중복 방지)
  if (!group.videoIds.includes(draggedVideoId.value)) {
    group.videoIds.push(draggedVideoId.value);
    // 그룹 데이터 저장
    saveGroupsToLocalStorage();
  }
  
  // 드래그 상태 초기화
  draggedVideoId.value = null;
  dragOverGroupId.value = null;
}

function contextZoom() {
  if (!contextMenu.value.video) return;
  zoomVideo(contextMenu.value.video);
  closeContextMenu();
}

function contextSummary() {
  goToSummary();
  closeContextMenu();
}

function contextSearch() {
  if (selectedIds.value.length === 0) {
    return;
  }
  goToSearch();
  closeContextMenu();
}

function contextDelete() {
  if (!contextMenu.value.video) return;
  // If multiple items are already selected, delete those; otherwise delete the clicked one
  if (selectedIds.value.length < 2) {
    const id = contextMenu.value.video.id;
    selectedIds.value = [id];
  }
  closeContextMenu();
  showDeletePopup.value = true; // reuse existing delete confirmation flow
}

async function contextRemoveSummary() {
  if (selectedIds.value.length === 0) return;
  closeContextMenu();
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  // 선택된 동영상의 dbId 가져오기
  const videosToRemoveSummary = items.value
    .filter(video => selectedIds.value.includes(video.id))
    .map(video => video.dbId || video.id)
    .filter(id => id != null);
  
  if (videosToRemoveSummary.length === 0) {
    alert('요약 결과를 제거할 동영상을 찾을 수 없습니다.');
    return;
  }
  
  // AbortController 생성 및 추적
  const abortController = new AbortController();
  abortControllers.value.push(abortController);
  
  try {
    const response = await fetch(`${API_BASE_URL}/summaries`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_ids: videosToRemoveSummary,
        user_id: userId
      }),
      signal: abortController.signal
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
      alert(`요약 결과 제거 실패: ${errorData.detail || '알 수 없는 오류'}`);
      return;
    }
    
    const data = await response.json();
    if (data.success) {
      alert(data.message || `${data.deleted_count || 0}개의 요약 결과가 제거되었습니다.`);
    } else if (data.deleted_count === 0) {
      alert('삭제할 요약 결과가 없습니다.');
    } else {
      alert('요약 결과 제거에 실패했습니다.');
    }
  } catch (error) {
    // AbortError는 정상적인 취소이므로 무시
    if (error.name === 'AbortError') {
      return;
    }
    console.error('요약 결과 제거 중 오류:', error);
    alert(`요약 결과 제거 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    // 완료된 AbortController 제거
    const index = abortControllers.value.indexOf(abortController);
    if (index > -1) {
      abortControllers.value.splice(index, 1);
    }
  }
}

function handleGlobalClick(e) {
  // 우클릭 이벤트는 무시 (컨텍스트 메뉴가 열릴 수 있음)
  if (e.button === 2 || e.which === 3) return;
  
  if (contextMenu.value.visible) {
    // close when clicking outside
    closeContextMenu();
  }
  
  if (emptySpaceContextMenu.value.visible) {
    // close empty space context menu when clicking outside
    closeEmptySpaceContextMenu();
  }
  
  if (groupContextMenu.value.visible) {
    // close group context menu when clicking outside
    closeGroupContextMenu();
  }
  
  if (chatMessageContextMenu.value.visible) {
    // close chat message context menu when clicking outside
    closeChatMessageContextMenu();
  }
  
  if (chatTabContextMenu.value.visible) {
    // close chat tab context menu when clicking outside
    closeChatTabContextMenu();
  }
}

// ==================== 채팅 메시지 컨텍스트 메뉴 ====================
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

let submenuTimeout = null;

function showReportSubmenu(messageIndex, parentX, parentY) {
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
  
  // "보고서 생성" 버튼의 위치 계산 (두 번째 버튼이므로 첫 번째 버튼 높이만큼 아래)
  const buttonHeight = 40; // py-2.5 = 약 40px
  const submenuWidth = 180; // 서브메뉴 너비
  const margin = 10; // 여백
  
  let submenuX = parentX + 160 + 4; // 메인 메뉴 너비(160px) + 간격(4px)
  let submenuY = parentY + buttonHeight; // 첫 번째 버튼 높이만큼 아래
  
  // 화면 오른쪽 경계 체크
  if (submenuX + submenuWidth + margin > window.innerWidth) {
    // 오른쪽으로 나가면 왼쪽으로 표시 (메인 메뉴 왼쪽)
    submenuX = parentX - submenuWidth - 4;
    // 왼쪽으로도 나가면 화면 중앙에 배치
    if (submenuX < margin) {
      submenuX = (window.innerWidth - submenuWidth) / 2;
    }
  }
  
  // 화면 아래쪽 경계 체크
  const submenuHeight = 80; // 대략적인 서브메뉴 높이 (2개 버튼)
  const availableHeight = window.innerHeight - submenuY - margin;
  if (availableHeight < submenuHeight) {
    // 아래로 나가면 위로 조정
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
  // 서브메뉴에 마우스가 있을 때는 타이머 취소 (위치 재계산하지 않음)
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
}

function hideReportSubmenu() {
  // 약간의 지연을 두어 서브메뉴로 마우스 이동할 시간 제공
  submenuTimeout = setTimeout(() => {
    reportSubmenu.value.visible = false;
    submenuTimeout = null;
  }, 200);
}

// 확대된 클립에서 데이터 수집
function collectZoomedClipData() {
  if (!zoomedClip.value) {
    alert(settingStore.language === 'ko' 
      ? '클립 정보를 찾을 수 없습니다.' 
      : 'Clip information not found.');
    return null;
  }
  
  return {
    clips: [{
      id: zoomedClip.value.id || `clip_${Date.now()}`,
      title: zoomedClip.value.title || zoomedClip.value.id || '',
      url: zoomedClip.value.url || '',
      sentence: zoomedClip.value.sentence || '',
      start_time: zoomedClip.value.start_time,
      end_time: zoomedClip.value.end_time,
      sourceVideo: zoomedClip.value.sourceVideo || zoomedClip.value.date || ''
    }],
    query: zoomedClip.value.search_query || ''
  };
}

let zoomedClipSubmenuTimeout = null;

// 확대된 클립용 보고서 생성 서브메뉴 표시 (버튼 위에 표시)
function showZoomedClipReportSubmenu(event) {
  if (zoomedClipSubmenuTimeout) {
    clearTimeout(zoomedClipSubmenuTimeout);
    zoomedClipSubmenuTimeout = null;
  }
  
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const submenuWidth = 180;
  const submenuHeight = 80; // 2개 버튼 높이
  const margin = 10;
  
  // 버튼 위에 표시 (버튼의 왼쪽 정렬)
  let submenuX = rect.left;
  let submenuY = rect.top - submenuHeight - 4; // 버튼 위에 4px 간격
  
  // 화면 왼쪽 경계 체크
  if (submenuX < margin) {
    submenuX = margin;
  }
  
  // 화면 오른쪽 경계 체크
  if (submenuX + submenuWidth + margin > window.innerWidth) {
    submenuX = window.innerWidth - submenuWidth - margin;
    if (submenuX < margin) {
      submenuX = (window.innerWidth - submenuWidth) / 2;
    }
  }
  
  // 화면 위쪽 경계 체크 (버튼 위에 공간이 없으면 버튼 아래에 표시)
  if (submenuY < margin) {
    submenuY = rect.bottom + 4; // 버튼 아래에 4px 간격
    // 아래쪽에도 공간이 없으면 화면 중앙에 배치
    const availableHeight = window.innerHeight - submenuY - margin;
    if (availableHeight < submenuHeight) {
      submenuY = Math.max(margin, (window.innerHeight - submenuHeight) / 2);
    }
  }
  
  zoomedClipReportSubmenu.value = {
    visible: true,
    x: submenuX,
    y: submenuY
  };
}

function keepZoomedClipReportSubmenuVisible() {
  if (zoomedClipSubmenuTimeout) {
    clearTimeout(zoomedClipSubmenuTimeout);
    zoomedClipSubmenuTimeout = null;
  }
}

function hideZoomedClipReportSubmenu() {
  zoomedClipSubmenuTimeout = setTimeout(() => {
    zoomedClipReportSubmenu.value.visible = false;
    zoomedClipSubmenuTimeout = null;
  }, 200);
}

let zoomedClipReportListSubmenuTimeout = null;

async function showZoomedClipReportListSubmenu(parentX, parentY) {
  if (zoomedClipReportListSubmenuTimeout) {
    clearTimeout(zoomedClipReportListSubmenuTimeout);
    zoomedClipReportListSubmenuTimeout = null;
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
        const maxHeight = Math.min(400, availableHeight);
        
        zoomedClipReportListSubmenu.value = {
          visible: true,
          x: submenuX,
          y: submenuY,
          reports: data.reports
        };
      } else {
        alert(settingStore.language === 'ko' 
          ? '보고서를 찾을 수 없습니다. 새 보고서를 생성해주세요.' 
          : 'No existing reports found. Please create a new report.');
      }
    }
  } catch (error) {
    console.error('보고서 목록 가져오기 실패:', error);
    alert(settingStore.language === 'ko' 
      ? '보고서 목록을 가져오는 중 오류가 발생했습니다.' 
      : 'Error fetching report list.');
  }
}

function keepZoomedClipReportListSubmenuVisible() {
  if (zoomedClipReportListSubmenuTimeout) {
    clearTimeout(zoomedClipReportListSubmenuTimeout);
    zoomedClipReportListSubmenuTimeout = null;
  }
}

function hideZoomedClipReportListSubmenu() {
  zoomedClipReportListSubmenuTimeout = setTimeout(() => {
    zoomedClipReportListSubmenu.value.visible = false;
    zoomedClipReportListSubmenuTimeout = null;
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
    // 보고서 목록 가져오기
    const response = await fetch(`${API_BASE_URL}/reports?user_id=${userId}&page=1&page_size=50`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.reports && data.reports.length > 0) {
        const reportListWidth = 250; // 보고서 목록 너비
        const reportListMaxHeight = 400; // 최대 높이
        const margin = 10; // 여백
        
        // 오른쪽으로 표시할 위치 계산
        let submenuX = parentX + 180 + 4; // 메인 서브메뉴 너비(180px) + 간격(4px)
        let submenuY = parentY; // 같은 높이
        
        // 화면 오른쪽 경계 체크
        if (submenuX + reportListWidth + margin > window.innerWidth) {
          // 오른쪽으로 나가면 왼쪽으로 표시 (메인 서브메뉴 왼쪽)
          submenuX = parentX - reportListWidth - 4;
          // 왼쪽으로도 나가면 화면 중앙에 배치
          if (submenuX < margin) {
            submenuX = (window.innerWidth - reportListWidth) / 2;
          }
        }
        
        // 화면 아래쪽 경계 체크
        const availableHeight = window.innerHeight - submenuY - margin;
        if (availableHeight < reportListMaxHeight) {
          // 아래로 나가면 위로 조정
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
  // 보고서 리스트 서브메뉴에 마우스가 있을 때는 타이머 취소
  if (reportListSubmenuTimeout) {
    clearTimeout(reportListSubmenuTimeout);
    reportListSubmenuTimeout = null;
  }
  // 첫 번째 서브메뉴(기존 보고서에 추가 메뉴)도 유지
  if (submenuTimeout) {
    clearTimeout(submenuTimeout);
    submenuTimeout = null;
  }
}

function hideReportListSubmenu() {
  reportListSubmenuTimeout = setTimeout(() => {
    reportListSubmenu.value.visible = false;
    reportListSubmenuTimeout = null;
    // 보고서 리스트가 닫힐 때 첫 번째 서브메뉴도 함께 닫기
    hideReportSubmenu();
  }, 200);
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

// 클립 데이터 수집 공통 함수
function collectClipsData(messageIndex) {
  if (messageIndex === null || messageIndex === undefined) return null;
  
  const currentChat = chatSessions.value[currentChatIndex.value];
  if (!currentChat || !currentChat.messages || !currentChat.messages[messageIndex]) return null;
  
  const message = currentChat.messages[messageIndex];
  
  // assistant 메시지가 아니거나 클립이 없으면 보고서 생성 불가
  if (message.role !== 'assistant' || !message.clips || message.clips.length === 0) {
    alert(settingStore.language === 'ko' 
      ? '보고서를 생성할 수 있는 클립이 없습니다.' 
      : 'No clips available to create a report.');
    return null;
  }
  
  // 사용자 질문 찾기 (이전 메시지 중 user 역할의 메시지)
  let userQuery = '';
  for (let i = messageIndex - 1; i >= 0; i--) {
    const prevMessage = currentChat.messages[i];
    if (prevMessage && prevMessage.role === 'user') {
      // HTML 태그 제거하여 순수 텍스트만 추출
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

// 보고서 제목 생성 공통 함수
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

// 선택한 보고서에 클립 추가
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
  
  // 로딩 시작
  isCreatingReport.value = true;
  reportSuccess.value = false;
  reportLoadingMessage.value = settingStore.language === 'ko' 
    ? '보고서에 클립을 추가하는 중입니다...' 
    : 'Adding clips to report...';
  reportSuccessMessage.value = '';
  
  try {
    // 선택한 보고서에 클립 추가
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
        
        // 완료 상태로 변경
        reportSuccess.value = true;
        reportSuccessMessage.value = message;
        
        // 3초 후 모달 닫기
        setTimeout(() => {
          isCreatingReport.value = false;
          reportSuccess.value = false;
          reportLoadingMessage.value = '';
          reportSuccessMessage.value = '';
        }, 3000);
      } else {
        // 중복 클립만 있는 경우
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
    // 에러 메시지를 모달에 표시
    reportSuccess.value = false;
    reportLoadingMessage.value = settingStore.language === 'ko' 
      ? `오류: ${error.message}` 
      : `Error: ${error.message}`;
    
    // 3초 후 모달 닫기
    setTimeout(() => {
      isCreatingReport.value = false;
      reportSuccess.value = false;
      reportLoadingMessage.value = '';
      reportSuccessMessage.value = '';
    }, 3000);
  }
}

// 새 보고서 생성
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
  
  // 제목 입력 모달 표시
  pendingReportData.value = { reportData, userId };
  reportTitleInput.value = generateReportTitle(); // 기본 제목으로 초기화
  showReportTitleModal.value = true;
}

// 확대된 클립으로 새 보고서 생성
function createNewReportFromZoomedClip() {
  hideZoomedClipReportSubmenu();
  hideZoomedClipReportListSubmenu();
  
  const reportData = collectZoomedClipData();
  if (!reportData) return;
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  // 제목 입력 모달 표시
  pendingReportData.value = { reportData, userId };
  reportTitleInput.value = generateReportTitle(); // 기본 제목으로 초기화
  showReportTitleModal.value = true;
}

// 확대된 클립을 선택한 보고서에 추가
async function addZoomedClipToSelectedReport(reportId) {
  hideZoomedClipReportSubmenu();
  hideZoomedClipReportListSubmenu();
  
  const reportData = collectZoomedClipData();
  if (!reportData) return;
  
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert(settingStore.language === 'ko' 
      ? '로그인이 필요합니다.' 
      : 'Please log in.');
    return;
  }
  
  // 로딩 시작
  isCreatingReport.value = true;
  reportSuccess.value = false;
  reportLoadingMessage.value = settingStore.language === 'ko' 
    ? '보고서에 클립을 추가하는 중입니다...' 
    : 'Adding clip to report...';
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
          ? `클립이 보고서에 추가되었습니다.` 
          : `Clip has been added to the report.`;
        
        if (data.duplicate_count && data.duplicate_count > 0) {
          message += settingStore.language === 'ko'
            ? ` (중복 클립은 제외되었습니다)`
            : ` (Duplicate clip was excluded)`;
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
            ? '이 클립은 이미 보고서에 포함되어 있습니다.'
            : 'This clip is already included in the report.';
          
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

// 보고서 제목 중복 확인
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
    // 에러가 발생해도 계속 진행 가능하도록 함
  } finally {
    isCheckingTitle.value = false;
  }
}

// 보고서 제목 확인 및 생성
async function confirmReportTitle() {
  if (!reportTitleInput.value.trim()) return;
  
  // 중복 제목이면 생성하지 않음
  if (reportTitleError.value) return;
  
  if (!pendingReportData.value) return;
  
  const { reportData, userId } = pendingReportData.value;
  const reportTitle = reportTitleInput.value.trim();
  
  // 제목 입력 모달 닫기
  showReportTitleModal.value = false;
  reportTitleError.value = '';
  pendingReportData.value = null;
  
  // 로딩 시작
  isCreatingReport.value = true;
  reportSuccess.value = false;
  reportLoadingMessage.value = settingStore.language === 'ko' 
    ? '보고서를 생성하는 중입니다...' 
    : 'Creating report...';
  reportSuccessMessage.value = '';
  
  try {
    // 새 보고서 생성
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
        
        // 완료 상태로 변경
        reportSuccess.value = true;
        reportSuccessMessage.value = message;
        
        // 3초 후 모달 닫기
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
    // 에러 메시지를 모달에 표시
    reportSuccess.value = false;
    reportLoadingMessage.value = settingStore.language === 'ko' 
      ? `오류: ${error.message}` 
      : `Error: ${error.message}`;
    
    // 3초 후 모달 닫기
    setTimeout(() => {
      isCreatingReport.value = false;
      reportSuccess.value = false;
      reportLoadingMessage.value = '';
      reportSuccessMessage.value = '';
    }, 3000);
  }
}

const showSearchSettingModal = ref(false);
const showQueryVlmParams = ref(true);
const showSummarizeVlmParams = ref(true);

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

function openSettingsFromContextMenu() {
  closeChatMessageContextMenu();
  showSearchSettingModal.value = true;
}

function closeSearchSettingModal() {
  showSearchSettingModal.value = false;
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
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick);
  // 전체 화면에서 드래그 선택 시작 가능하도록 document 레벨 이벤트 리스너 추가
  document.addEventListener('mousedown', startDragSelect);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleGlobalClick);
  // document 레벨 이벤트 리스너 제거
  document.removeEventListener('mousedown', startDragSelect);
  document.removeEventListener('mousemove', handleDragSelectMove);
  document.removeEventListener('mouseup', handleDragSelectEnd);
});


// ==================== 비디오 선택 ====================
function onCardClick(id, event) {
  // 드래그 선택 중이면 클릭 무시
  if (isDragSelecting.value) return;
  if (event && typeof event.button !== 'undefined' && event.button !== 0) return;
  toggleSelect(id);
}

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id);
  idx === -1 ? selectedIds.value.push(id) : selectedIds.value.splice(idx, 1);
}

function allselect() {
  selectedIds.value = selectedIds.value.length === items.value.length 
    ? [] 
    : items.value.map(v => v.id);
}

// ==================== 드래그 선택 ====================
function startDragSelect(event) {
  // 진행 바 드래그 중이면 무시
  if (isDragging.value) return;
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
    target.closest('.group') && target.closest('video') ||
    target.closest('[role="button"]') ||
    target.closest('.cursor-pointer') && target.closest('.group')
  ) {
    return;
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
    applyDragSelection(event);
  }
  
  isDragSelecting.value = false;
  dragSelectBox.value = null;
  dragSelectInitialSelection.value = [];
  
  event.preventDefault();
}

// 드래그 선택 적용 (토글 방식)
function applyDragSelection(event) {
  if (!dragSelectBox.value || !videoGridRef.value) return;
  
  // 화면 기준 선택 박스
  const box = {
    left: parseFloat(dragSelectBox.value.left),
    top: parseFloat(dragSelectBox.value.top),
    right: parseFloat(dragSelectBox.value.left) + parseFloat(dragSelectBox.value.width),
    bottom: parseFloat(dragSelectBox.value.top) + parseFloat(dragSelectBox.value.height)
  };
  
  // 선택 박스와 교차하는 동영상 찾기
  paginatedItems.value.forEach(video => {
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

function updateDragSelect(event) {
  // 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
  handleDragSelectMove(event);
}

function endDragSelect() {
  // 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
  handleDragSelectEnd(new MouseEvent('mouseup'));
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

// 이 함수는 더 이상 사용하지 않지만 호환성을 위해 유지
function updateSelectedVideosInBox() {
  // 파일 탐색기 방식으로 변경되어 드래그 중에는 선택하지 않음
  // 실제 선택은 handleDragSelectEnd에서 applyDragSelection으로 처리
}

// ==================== Vue 인스턴스 및 스토어 ====================
const router = useRouter();
const summaryVideoStore = useSummaryVideoStore();

// ==================== Computed ====================
const selectedVideos = computed(() => items.value.filter(v => selectedIds.value.includes(v.id)));

// ==================== 청크 크기 자동 설정 ====================
/**
 * 추천 chunk_size를 API에서 가져오는 함수
 */
async function fetchRecommendedChunkSize(videoLength) {
  if (!videoLength || !isFinite(videoLength)) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/get-recommended-chunk-size`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_length: videoLength })
    });

    if (!response.ok) {
      console.warn('추천 chunk_size 가져오기 실패:', response.status);
      return null;
    }

    const data = await response.json();
    return data.recommended_chunk_size;
  } catch (error) {
    console.warn('추천 chunk_size 가져오기 중 오류:', error);
    return null;
  }
}

/**
 * 선택된 동영상에 대해 추천 chunk_size를 가져와서 설정 스토어에 저장
 */
async function updateRecommendedChunkSize() {
  if (selectedIds.value.length === 0) return;
  
  // 첫 번째 선택된 동영상의 duration 사용
  const firstSelectedId = selectedIds.value[0];
  const duration = durationMap.value[firstSelectedId];
  
  if (!duration || !isFinite(duration)) {
    // duration이 아직 로드되지 않았으면 비디오 엘리먼트에서 가져오기 시도
    const videoElement = videoRefs.value[firstSelectedId];
    if (videoElement && videoElement.duration && isFinite(videoElement.duration)) {
      const recommendedChunkSize = await fetchRecommendedChunkSize(videoElement.duration);
      if (recommendedChunkSize !== null && settingStore) {
        settingStore.summarizeChunk = recommendedChunkSize;
      }
    }
    return;
  }

  const recommendedChunkSize = await fetchRecommendedChunkSize(duration);
  if (recommendedChunkSize !== null && settingStore) {
    // 추천된 chunk_size를 설정 스토어에 저장
    settingStore.summarizeChunk = recommendedChunkSize;
  }
}

// 선택된 동영상이 변경될 때 자동으로 청크 크기 업데이트
watch(selectedIds, async (newIds, oldIds) => {
  // 선택된 동영상이 있고, 이전과 다를 때만 업데이트
  if (newIds.length > 0 && (oldIds.length === 0 || newIds[0] !== oldIds[0])) {
    // 약간의 지연을 두어 duration이 로드될 시간을 줌
    await nextTick();
    setTimeout(() => {
      updateRecommendedChunkSize();
    }, 500);
  }
}, { deep: true });

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

const allUploadsComplete = computed(() => {
  return uploadProgress.value.length > 0 && 
         uploadProgress.value.every(u => u.progress === 100 || u.status === '완료' || u.status === '실패');
});

// ==================== 검색 상태 저장/복원 ====================
function getSearchStorageKey() {
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    return 'search_page_state_no_user';
  }
  return `search_page_state_${userId}`;
}

function saveSearchStateToLocalStorage() {
  try {
    const userId = localStorage.getItem("vss_user_id");
    if (!userId) {
      console.warn('사용자 ID가 없어 검색 상태를 저장할 수 없습니다.');
      return;
    }

    const state = {
      userId: userId,
      chatSessions: chatSessions.value.map(chat => ({
        id: chat.id,
        name: chat.name,
        messages: chat.messages || [],
        selectionSignature: chat.selectionSignature
      })),
      currentChatIndex: currentChatIndex.value,
      searchInput: searchInput.value,
      savedAt: new Date().toISOString()
    };
    const storageKey = getSearchStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    console.warn('검색 상태 localStorage 저장 실패:', e);
  }
}

function restoreSearchStateFromLocalStorage() {
  try {
    const currentUserId = localStorage.getItem("vss_user_id");
    if (!currentUserId) {
      return false;
    }

    const storageKey = getSearchStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (!saved) return false;

    const state = JSON.parse(saved);
    
    // 저장된 사용자 ID와 현재 사용자 ID 비교
    if (state.userId && state.userId !== currentUserId) {
      return false;
    }
    
    // 채팅 세션 복원
    if (Array.isArray(state.chatSessions) && state.chatSessions.length > 0) {
      chatSessions.value = state.chatSessions;
    }
    
    // 현재 채팅 인덱스 복원
    if (typeof state.currentChatIndex === 'number' && state.currentChatIndex >= 0) {
      currentChatIndex.value = Math.min(state.currentChatIndex, chatSessions.value.length - 1);
    }
    
    // 검색 입력값 복원
    if (state.searchInput) {
      searchInput.value = state.searchInput;
    }
    
    // 동영상 목록이 로드된 후 채팅 메시지의 selectedVideos 업데이트
    if (items.value.length > 0 && chatSessions.value.length > 0) {
      nextTick(() => {
        updateChatVideoUrls(chatSessions.value);
      });
    }
    
    return true;
  } catch (e) {
    console.warn('검색 상태 localStorage 복원 실패:', e);
    return false;
  }
}

// 상태 변경 감지하여 자동 저장 (debounce 적용)
let searchSaveTimeout = null;
function autoSaveSearchState() {
  if (searchSaveTimeout) clearTimeout(searchSaveTimeout);
  searchSaveTimeout = setTimeout(() => {
    saveSearchStateToLocalStorage();
  }, 1000); // 1초 지연
}

onMounted(() => {
  // 그룹 데이터 먼저 불러오기
  loadGroupsFromLocalStorage();
  
  showListLoadingModal.value = true;
  loadVideosFromStorage().then(() => {
    if (items.value.length > 0 && chatSessions.value.length > 0) {
      updateChatVideoUrls(chatSessions.value);
    }
    // 모든 동영상의 duration 미리 로드
    if (items.value.length > 0) {
      nextTick(() => {
        preloadAllVideoDurations();
      });
    }
  }).finally(() => {
    showListLoadingModal.value = false;
  });
  // Summarize.vue에서 동영상이 추가되었을 때 이벤트 리스너
  window.addEventListener('search-videos-updated', () => {
    showListLoadingModal.value = true;
    loadVideosFromStorage().then(() => {
      if (items.value.length > 0 && chatSessions.value.length > 0) {
        updateChatVideoUrls(chatSessions.value);
      }
    }).finally(() => {
      showListLoadingModal.value = false;
    });
  });
  // 다른 메뉴가 열렸을 때 컨텍스트 메뉴 닫기
  window.addEventListener('profile-menu-opened', closeContextMenu);
  window.addEventListener('empty-space-context-menu-opened', closeContextMenu);
  window.addEventListener('group-context-menu-opened', closeContextMenu);
  window.addEventListener('video-context-menu-opened', closeChatMessageContextMenu);
  window.addEventListener('chat-message-context-menu-opened', closeContextMenu);
  
  // 검색 상태 복원
  restoreSearchStateFromLocalStorage();
  
  // 화면 크기 변경 감지
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
  }
});

// 라우터 네비게이션 가드: 다른 메뉴로 이동하기 전에 비디오 정리
onBeforeRouteLeave((to, from, next) => {
  cleanupVideos();
  next();
});

// 컴포넌트가 비활성화될 때 (keep-alive로 인해 언마운트되지 않는 경우)
onDeactivated(() => {
  cleanupVideos();
});

// 컴포넌트 언마운트 시 이벤트 리스너 제거
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize);
  }
});

// 비디오 정리 함수 (공통)
function cleanupVideos() {
  // 모든 비디오 요소 일시정지 및 Blob URL 정리
  Object.values(videoRefs.value).forEach(videoEl => {
    if (videoEl && videoEl instanceof HTMLVideoElement) {
      try {
        videoEl.pause();
        // Blob URL인 경우 서버 URL로 전환
        if (videoEl.src && videoEl.src.startsWith('blob:')) {
          const video = items.value.find(v => v.displayUrl === videoEl.src || v.objectUrl === videoEl.src);
          if (video && video.originUrl && !video.originUrl.startsWith('blob:')) {
            videoEl.src = video.originUrl;
            videoEl.crossOrigin = 'anonymous';
          } else {
            videoEl.src = '';
          }
        } else {
          videoEl.src = '';
        }
        videoEl.load();
      } catch (e) {
        // 에러가 발생해도 무시
      }
    }
  });
  
  // 확대 모달 비디오 정리
  if (zoomVideoRef.value && zoomVideoRef.value instanceof HTMLVideoElement) {
    try {
      zoomVideoRef.value.pause();
      if (zoomVideoRef.value.src && zoomVideoRef.value.src.startsWith('blob:')) {
        if (zoomedVideo.value && zoomedVideo.value.originUrl && !zoomedVideo.value.originUrl.startsWith('blob:')) {
          zoomVideoRef.value.src = zoomedVideo.value.originUrl;
          zoomVideoRef.value.crossOrigin = 'anonymous';
        } else {
          zoomVideoRef.value.src = '';
        }
      } else {
        zoomVideoRef.value.src = '';
      }
      zoomVideoRef.value.load();
    } catch (e) {
      // 에러가 발생해도 무시
    }
  }
  
  // Blob URL을 서버 URL로 전환 (나중에 다시 활성화될 때 사용)
  items.value.forEach(video => {
    if (video.displayUrl && video.displayUrl.startsWith('blob:')) {
      if (video.originUrl && !video.originUrl.startsWith('blob:')) {
        // Blob URL을 서버 URL로 전환
        video.displayUrl = video.originUrl;
      }
    }
    // objectUrl은 유지 (나중에 필요할 수 있음)
  });
}

onActivated(() => {
  // 그룹 데이터 불러오기 (컴포넌트가 활성화될 때마다)
  loadGroupsFromLocalStorage();
  
  if (items.value.length === 0) {
    loadVideosFromStorage().then(() => {
      // 동영상 목록 로드 후 채팅 메시지의 selectedVideos 업데이트
      if (items.value.length > 0 && chatSessions.value.length > 0) {
        updateChatVideoUrls(chatSessions.value);
      }
    });
  } else {
    // 동영상 목록이 이미 있으면 채팅 메시지의 selectedVideos 업데이트
    if (chatSessions.value.length > 0) {
      updateChatVideoUrls(chatSessions.value);
    }
  }
  // 검색 상태 복원 (페이지 재활성화 시)
  restoreSearchStateFromLocalStorage();
});

onBeforeUnmount(() => {
  window.removeEventListener('search-videos-updated', loadVideosFromStorage);
  window.removeEventListener('profile-menu-opened', closeContextMenu);
  window.removeEventListener('empty-space-context-menu-opened', closeContextMenu);
  window.removeEventListener('group-context-menu-opened', closeContextMenu);
  window.removeEventListener('group-context-menu-opened', closeContextMenu);
  window.removeEventListener('video-context-menu-opened', closeChatMessageContextMenu);
  window.removeEventListener('chat-message-context-menu-opened', closeContextMenu);
  
  // 진행 중인 모든 fetch 요청 취소
  abortControllers.value.forEach(controller => {
    try {
      controller.abort();
    } catch (e) {
      // 이미 취소되었거나 에러가 발생해도 무시
    }
  });
  abortControllers.value = [];
  
  // 진행 중인 모든 업로드 취소
  Object.keys(activeUploads.value).forEach(uploadId => {
    const xhr = activeUploads.value[uploadId];
    if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
      try {
        xhr.abort();
      } catch (e) {
        // 이미 취소되었거나 에러가 발생해도 무시
      }
    }
  });
  activeUploads.value = {};
  
  // 모든 비디오 요소 일시정지 및 정리
  Object.values(videoRefs.value).forEach(videoEl => {
    if (videoEl && videoEl instanceof HTMLVideoElement) {
      try {
        videoEl.pause();
        videoEl.src = '';
        videoEl.load();
      } catch (e) {
        // 에러가 발생해도 무시
      }
    }
  });
  
  // 확대 모달 비디오 정리
  if (zoomVideoRef.value && zoomVideoRef.value instanceof HTMLVideoElement) {
    try {
      zoomVideoRef.value.pause();
      zoomVideoRef.value.src = '';
      zoomVideoRef.value.load();
    } catch (e) {
      // 에러가 발생해도 무시
    }
  }
  
  // 모든 ObjectURL 정리
  items.value.forEach(video => {
    if (video.objectUrl) {
      try {
        URL.revokeObjectURL(video.objectUrl);
      } catch (e) {
        // 에러가 발생해도 무시
      }
    }
  });
  
  // 검색 상태 저장
  saveSearchStateToLocalStorage();
});

// 페이지네이션: items나 itemsPerPage 변경 시 현재 페이지 조정
// 그룹 경로 변경 시 페이지 리셋
watch(currentGroupPath, () => {
  currentPage.value = 1;
});

watch([filteredItems, itemsPerPage, totalPages], () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    currentPage.value = totalPages.value;
  }
});

// 그룹 경로 변경 시 페이지 리셋
watch(currentGroupPath, () => {
  currentPage.value = 1;
});

// items가 변경될 때 모든 동영상의 duration 미리 로드
watch(items, () => {
  if (items.value.length > 0) {
    // 다음 틱에서 실행하여 DOM 업데이트 후 실행
    nextTick(() => {
      preloadAllVideoDurations();
    });
  }
}, { deep: false });

// 검색 상태 변경 감지하여 자동 저장
watch([chatSessions, currentChatIndex, searchInput], () => {
  autoSaveSearchState();
}, { deep: true });

// ==================== 비디오 목록 관리 ====================
async function loadVideosFromStorage() {
  showListLoadingModal.value = true;
  const userId = localStorage.getItem("vss_user_id");
  
  if (!userId) {
    loadFromLocalStorage();
    showListLoadingModal.value = false;
    return;
  }

  // AbortController 생성 및 추적
  const abortController = new AbortController();
  abortControllers.value.push(abortController);
  
  try {
    const response = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`, {
      signal: abortController.signal
    });
    if (!response.ok) throw new Error('동영상 목록 조회 실패');
    
    const data = await response.json();
    
    // 응답 데이터 형식 검증
    if (!data || typeof data !== 'object') {
      console.error('서버 응답 형식이 올바르지 않습니다:', data);
      loadFromLocalStorage();
      return;
    }
    
    if (!data.success) {
      console.warn('서버에서 success=false를 반환했습니다:', data);
      loadFromLocalStorage();
      return;
    }
    
    // videos가 배열인지 확인
    if (!Array.isArray(data.videos)) {
      console.error('서버 응답의 videos가 배열이 아닙니다:', data);
      loadFromLocalStorage();
      return;
    }
    
    // 동영상이 없는 경우 (정상적인 상황)
    if (data.videos.length === 0) {
      items.value = [];
      // localStorage에서 로드 시도 (이전 세션 데이터가 있을 수 있음)
      loadFromLocalStorage();
      return;
    }
    
    // 모든 동영상 처리 (file_url이 비어있어도 포함)
    const allVideos = data.videos.filter(v => v); // null이 아닌 동영상만 필터링
    
    if (allVideos.length > 0) {
      // file_url이 비어있는 동영상 ID 목록 수집
      const videosNeedingUrl = allVideos.filter(v => !v.file_url || v.file_url.trim() === '').map(v => v.id);
      
      // file_url이 비어있는 동영상이 있으면 서버에서 한 번에 조회
      let urlMap = new Map();
      if (videosNeedingUrl.length > 0) {
        try {
          const videoResponse = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            if (videoData.success && videoData.videos) {
              videoData.videos.forEach(sv => {
                if (sv.file_url && sv.file_url.trim() !== '') {
                  urlMap.set(sv.id, sv.file_url);
                }
              });
            }
          }
        } catch (error) {
          console.warn('동영상 URL 일괄 조회 실패:', error);
        }
      }
      
      // 비동기로 비디오 객체 생성
      const loadedItems = allVideos.map(v => {
        // ISO 형식(2026-02-23T11:12:59)에서 날짜만 추출 (2026-02-23)
        const dateValue = v.created_at || v.date || '';
        const dateOnly = dateValue ? (dateValue.includes('T') ? dateValue.split('T')[0] : dateValue) : '';
        
        // file_url이 비어있으면 urlMap에서 조회, 없으면 원본 file_url 사용
        const fileUrl = v.file_url && v.file_url.trim() !== '' 
          ? v.file_url 
          : (urlMap.get(v.id) || '');
        
        return createVideoObject({
          id: v.id,
          title: v.title,
          originUrl: fileUrl,
          displayUrl: fileUrl,
          date: dateOnly,
          fileSize: v.file_size || v.fileSize || null,
          width: v.width || null,
          height: v.height || null,
          duration: v.duration || null,
          dbId: v.id,
          videoId: v.video_id || null
        });
      });
      
      // file_url이 있는 동영상만 필터링 (최종적으로 URL이 있는 것만 표시)
      const validItems = loadedItems.filter(item => item.originUrl && item.originUrl.trim() !== '');
      
      // Vue 반응성 업데이트를 보장하기 위해 nextTick 사용
      await nextTick();
      items.value = validItems;
      
      // 지연 로딩: 지원하지 않는 형식의 동영상만 백그라운드에서 변환 체크
      // 초기 로딩 속도를 위해 requestIdleCallback 사용 (또는 setTimeout으로 폴백)
      const checkUnsupportedVideos = () => {
        validItems.forEach((videoObj) => {
          if (isUnsupportedFormat(videoObj.title || '')) {
            // 비동기로 변환 요청 (완료를 기다리지 않음)
            convertVideoToMp4(videoObj.id, userId, videoObj).catch(err => {
              console.warn(`동영상 변환 실패 (${videoObj.title}):`, err);
            });
          }
        });
      };
      
      // 브라우저가 유휴 상태일 때 실행
      if ('requestIdleCallback' in window) {
        requestIdleCallback(checkUnsupportedVideos, { timeout: 2000 });
      } else {
        setTimeout(checkUnsupportedVideos, 500);
      }
    } else {
      // 모든 동영상의 file_url이 비어있는 경우
      console.warn('모든 동영상의 file_url이 비어있습니다.');
      items.value = [];
      // localStorage에서 로드 시도
      loadFromLocalStorage();
    }
    
    // VIA 서버 파일 목록 조회 (동기화 확인용, 비동기로 실행, 완료를 기다리지 않음)
    // 이것도 지연 로딩
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        loadViaFiles().catch(err => {
          console.warn('VIA 파일 목록 조회 실패:', err);
        });
      }, { timeout: 3000 });
    } else {
      setTimeout(() => {
        loadViaFiles().catch(err => {
          console.warn('VIA 파일 목록 조회 실패:', err);
        });
      }, 1000);
    }
  } catch (error) {
    // AbortError는 정상적인 취소이므로 무시
    if (error.name === 'AbortError') {
      return;
    }
    console.error('동영상 목록 로드 실패:', error);
    loadFromLocalStorage();
  } finally {
    // 완료된 AbortController 제거
    const index = abortControllers.value.indexOf(abortController);
    if (index > -1) {
      abortControllers.value.splice(index, 1);
    }
    showListLoadingModal.value = false;
  }
}

function loadFromLocalStorage() {
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    // 사용자 ID가 없으면 빈 배열 반환
    items.value = [];
    return;
  }
  
  // 사용자별 localStorage 키 사용
  const storageKey = `videoItems_${userId}`;
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    items.value = [];
    return;
  }
  
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('localStorage의 videoItems가 배열 형식이 아닙니다.');
      items.value = [];
      return;
    }
    
    const loadedItems = parsed
      .filter(v => v && (v.displayUrl || v.url || v.originUrl)) // URL이 있는 항목만 필터링
      .map(v => {
        // blob URL은 일시적이므로 서버 URL(originUrl)을 우선 사용
        let displayUrl = v.displayUrl || v.url || v.originUrl || '';
        // displayUrl이 blob URL이면 originUrl 사용
        if (displayUrl && displayUrl.startsWith('blob:')) {
          displayUrl = v.originUrl || v.url || '';
        }
        const originUrl = v.originUrl || v.url || displayUrl;
        
        return createVideoObject({
          id: v.id,
          title: v.title,
          originUrl: originUrl,
          displayUrl: displayUrl,
          date: v.date,
          fileSize: v.fileSize,
          width: v.width,
          height: v.height
        });
      });
    
    // Vue 반응성 업데이트를 보장하기 위해 nextTick 사용
    nextTick(() => {
      items.value = loadedItems;
    });
  } catch (error) {
    console.error('localStorage에서 동영상 목록 로드 실패:', error);
    items.value = [];
  }
}

function persistToStorage() {
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    // 사용자 ID가 없으면 저장하지 않음
    return;
  }
  
  // 사용자별 localStorage 키 사용
  const storageKey = `videoItems_${userId}`;
  localStorage.setItem(storageKey, JSON.stringify(items.value.map(({ id, title, originUrl, displayUrl, date, fileSize, width, height }) => ({ 
    id, 
    title, 
    url: originUrl || displayUrl || '', 
    originUrl: originUrl || displayUrl || '',
    displayUrl: displayUrl || originUrl || '',
    date,
    fileSize: fileSize || null,
    width: width || null,
    height: height || null
  }))));
}


// ==================== 파일 업로드 ====================
function onDragOverUpload(e) {
  // 동영상 드래그 중이면 파일 업로드 드래그 오버 무시
  if (draggedVideoId.value !== null) {
    return;
  }
  
  // 파일 드래그인지 확인 (dataTransfer.types에 'Files'가 있는지)
  const hasFiles = e.dataTransfer.types && e.dataTransfer.types.includes('Files');
  
  // 파일 드래그가 아닌 경우 (동영상 드래그 등) 무시
  if (!hasFiles) {
    return;
  }
  
  e.preventDefault();
  isDragOverUpload.value = true;
}

function onDragLeaveUpload(e) {
  // 동영상 드래그 중이면 파일 업로드 드래그 오버 무시
  if (draggedVideoId.value !== null) {
    return;
  }
  
  e.preventDefault();
  if (!e.currentTarget.contains(e.relatedTarget)) {
    isDragOverUpload.value = false;
  }
}

async function onDropUpload(e) {
  // 동영상 드래그 중이면 파일 업로드 드롭 무시
  if (draggedVideoId.value !== null) {
    return;
  }
  
  e.preventDefault();
  isDragOverUpload.value = false;
  const files = filterVideoFiles(e.dataTransfer.files ?? []);
  if (files.length > 0) await processUploadFiles(files);
}

async function handleUpload(e) {
  const files = filterVideoFiles(e.target.files ?? []);
  if (files.length > 0) await processUploadFiles(files);
  if (e.target) e.target.value = '';
}

function handleAddButtonClick() {
  document.querySelector('input[type="file"]')?.click();
}

// 공통 업로드 처리 함수
async function processUploadFiles(files) {

  // 사용자 ID 확인
  const userId = localStorage.getItem("vss_user_id");
  if (!userId) {
    alert('로그인이 필요합니다.');
    return;
  }

  // 중복 파일명 체크 및 필터링
  let filesToUpload = files;
  try {
    const response = await fetch(`${API_BASE_URL}/videos?user_id=${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.videos) {
        const existingFileNames = new Set(data.videos.map(v => v.title));
        const duplicateFiles = files.filter(file => existingFileNames.has(file.name));
        
        if (duplicateFiles.length > 0) {
          // 중복 파일 제외
          filesToUpload = files.filter(file => !existingFileNames.has(file.name));
          
          // 중복 파일 알림 (하지만 업로드는 계속 진행)
          const duplicateNames = duplicateFiles.map(f => f.name).join(', ');
          if (filesToUpload.length > 0) {
            alert(`${settingStore.language === 'ko' ? '다음 동영상은 이미 업로드되어 제외됩니다' : 'The following videos are already uploaded and will be skipped'}: ${duplicateNames}\n\n${settingStore.language === 'ko' ? '나머지 동영상은 정상적으로 업로드됩니다.' : 'The remaining videos will be uploaded normally.'}`);
          } else {
            alert(`${settingStore.language === 'ko' ? '이미 업로드된 동영상입니다' : 'These videos are already uploaded'}: ${duplicateNames}`);
            return;
          }
        }
      }
    }
  } catch (error) {
    console.warn('중복 체크 실패, 업로드 계속 진행:', error);
  }

  // 업로드할 파일이 없으면 종료
  if (filesToUpload.length === 0) {
    return;
  }

  // 업로드 진행률 초기화
  uploadProgress.value = filesToUpload.map((file, index) => ({
    id: Date.now() + index,
    fileName: file.name,
    progress: 0,
    status: '대기 중...',
    uploaded: 0,
    total: file.size
  }));

  // 업로드 모달 표시
  showUploadModal.value = true;

  // 동시 업로드 수 자동 조절 (최대 2~10개, 네트워크 상황에 따라 확장 가능)
  // 네트워크 대역폭이 충분한 경우 더 많은 동시 업로드로 전체 시간 단축
  const MAX_CONCURRENT_UPLOADS = Math.min(10, Math.max(2, navigator.hardwareConcurrency || 6));
  let activeUploads = 0;
  // uploadQueue 생성 시 uploadId를 미리 저장하여 인덱스 변경 문제 방지
  let uploadQueue = filesToUpload.map((file, idx) => ({ 
    file, 
    idx, 
    uploadId: uploadProgress.value[idx]?.id, // ID 미리 저장
    retries: 0 
  }));
  const MAX_RETRIES = 2;

  async function uploadSingleFile(queueItem) {
    const { file, uploadId } = queueItem; // idx 대신 uploadId 사용
    if (!uploadId) {
      console.warn(`[업로드] 업로드 ID를 찾을 수 없습니다. 파일: ${file.name}`);
      return;
    }
    
    try {
      // 업로드 시작 전 상태 업데이트
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = '업로드 대기 중...';
        uploadItem.progress = 0;
      }
      
      const data = await uploadVideoWithProgress(file, userId, uploadId);
      
      // 업로드 성공 후 동영상 객체 생성
      const useServerUrl = isUnsupportedFormat(file.name);
      const serverUrl = data.file_url;
      const objUrl = useServerUrl ? null : URL.createObjectURL(file);
      const newVideo = createVideoObject({
        id: data.video_id,
        title: file.name,
        originUrl: serverUrl,
        displayUrl: useServerUrl ? serverUrl : objUrl,
        fileSize: file.size,
        dbId: data.video_id
      }, { file, objectUrl: objUrl });
      items.value.unshift(newVideo);
      
      if (useServerUrl) {
        convertVideoToMp4(data.video_id, userId, newVideo).then(convertedUrl => {
          if (convertedUrl) nextTick(() => {});
        });
      }
      
      // 업로드 완료 처리 - ID 기반으로 안전하게 찾기
      const finalUploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (finalUploadItem) {
        finalUploadItem.progress = 100;
        finalUploadItem.status = '완료';
        // 0.5초 후 제거
        setTimeout(() => {
          const removeIndex = uploadProgress.value.findIndex(u => u.id === uploadId);
          if (removeIndex !== -1) {
            uploadProgress.value.splice(removeIndex, 1);
          }
        }, 500);
      }
    } catch (error) {
      // 에러 처리 - ID 기반으로 안전하게 찾기
      const errorUploadItem = uploadProgress.value.find(u => u.id === uploadId);
      
      if (error.message === '업로드 취소됨') {
        if (errorUploadItem) {
          const removeIndex = uploadProgress.value.findIndex(u => u.id === uploadId);
          if (removeIndex !== -1) {
            uploadProgress.value.splice(removeIndex, 1);
          }
        }
      } else {
        queueItem.retries++;
        if (queueItem.retries <= MAX_RETRIES) {
          // 재시도 전 상태 업데이트
          if (errorUploadItem) {
            errorUploadItem.status = `재시도 중... (${queueItem.retries}/${MAX_RETRIES})`;
            errorUploadItem.progress = 0;
          }
          // 재시도
          await uploadSingleFile(queueItem);
        } else {
          // 최종 실패 처리
          if (errorUploadItem) {
            errorUploadItem.status = '실패';
            errorUploadItem.progress = 0;
            setTimeout(() => {
              const removeIndex = uploadProgress.value.findIndex(u => u.id === uploadId);
              if (removeIndex !== -1) {
                uploadProgress.value.splice(removeIndex, 1);
              }
            }, 1000);
          }
          alert(`동영상 업로드 실패: ${error.message}`);
        }
      }
    }
  }

  async function uploadManager() {
    const totalFiles = filesToUpload.length;
    console.log(`[업로드 시작] 총 ${totalFiles}개 파일 업로드 시작`);
    
    while (uploadQueue.length > 0) {
      if (activeUploads < MAX_CONCURRENT_UPLOADS) {
        const queueItem = uploadQueue.shift();
        activeUploads++;
        uploadSingleFile(queueItem).finally(() => {
          activeUploads--;
        });
      } else {
        // 업로드 큐 체크 간격 단축 (100ms → 50ms)으로 다음 파일을 더 빠르게 시작
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    // 모든 업로드가 끝나면 모달 닫기 (체크 간격 단축: 200ms → 100ms)
    const checkDone = setInterval(() => {
      if (uploadProgress.value.length === 0) {
        console.log(`[업로드 완료] 총 ${totalFiles}개 파일 업로드 프로세스 완료`);
        showUploadModal.value = false;
        clearInterval(checkDone);
      }
    }, 100);
  }
  uploadManager();
}


function zoomVideo(video) {
  // 그리드 비디오 상태 캡처 후 그리드 재생 중이면 일시정지
  const gridEl = videoRefs.value[video.id];
  let currentT = 0;
  const wasPlaying = playingVideoIds.value.includes(video.id) && gridEl;
  if (gridEl) {
    currentT = gridEl.currentTime;
    if (wasPlaying) {
      // 그리드 비디오 재생 중이었다면 일시정지 후 재생 목록에서 제거 (확대 모달은 독립 재생 상태 사용)
      gridEl.pause();
      const idx = playingVideoIds.value.indexOf(video.id);
      if (idx !== -1) playingVideoIds.value.splice(idx, 1);
    }
  }
  zoomedVideo.value = video;
  isZoomed.value = true;
  zoomPlaying.value = wasPlaying; // 확대 모달 재생 상태 독립 관리
  zoomProgress.value = video.progress || 0; // 기존 진행률 초기화
  nextTick(() => {
    if (zoomVideoRef.value) {
      try {
        if (currentT > 0) zoomVideoRef.value.currentTime = currentT;
        if (zoomPlaying.value) zoomVideoRef.value.play();
      } catch (e) {
        console.warn('Zoom video sync 실패:', e);
      }
    }
  });
}

function unzoomVideo() {
  // 확대 모달 상태 -> 그리드 동기화 (최종 시점 반영)
  const zVideo = zoomedVideo.value;
  const zoomEl = zoomVideoRef.value;
  const wasPlaying = zoomEl && !zoomEl.paused && zoomPlaying.value;
  let currentT = 0;
  if (zoomEl) currentT = zoomEl.currentTime;

  isZoomed.value = false;
  zoomedVideo.value = null;
  zoomedClip.value = null;
  showSentencePopup.value = true;
  nextTick(() => {
    if (zVideo) {
      const gridEl = videoRefs.value[zVideo.id];
      const item = items.value.find(v => v.id === zVideo.id);
      if (gridEl) {
        try {
          if (currentT > 0) gridEl.currentTime = currentT;
          if (wasPlaying) {
            gridEl.play();
          }
        } catch (e) {
          console.warn('Unzoom sync 실패:', e);
        }
      }
      // 확대 모달에서 조작한 진행률을 그리드에 반영
      if (item) item.progress = zoomProgress.value;
      // 재생 상태 동기화: 확대 모달 최종 재생 상태에 따라 그리드 재생 ID 목록 갱신
      const listIdx = playingVideoIds.value.indexOf(zVideo.id);
      if (wasPlaying) {
        // 모달에서 재생 중이었으므로 그리드에서도 재생 상태로 표시
        if (listIdx === -1) playingVideoIds.value.push(zVideo.id);
      } else {
        // 모달에서 정지 상태였으므로 그리드에서도 제거 및 일시정지 보장
        if (listIdx !== -1) playingVideoIds.value.splice(listIdx, 1);
        if (gridEl) {
          try { gridEl.pause(); } catch (e) { /* ignore */ }
        }
      }
    }
    zoomPlaying.value = false;
  });
}

async function confirmDelete() {
  // 사용자 ID 확인
  const userId = localStorage.getItem("vss_user_id");
  
  // 선택된 동영상 삭제
  const videosToDelete = items.value.filter(video => selectedIds.value.includes(video.id));
  
  console.log('삭제할 동영상:', videosToDelete.map(v => ({ id: v.id, dbId: v.dbId, videoId: v.videoId, title: v.title })));
  
  // VIA 서버에서 미디어 삭제 (video_id가 있는 경우)
  const mediaIdsToDelete = videosToDelete
    .map(v => v.videoId)
    .filter(id => id != null); // null이 아닌 것만 필터링
  
  if (mediaIdsToDelete.length > 0) {
    await removeMediaFromServer(mediaIdsToDelete);
  }
  
  // DB에서 삭제 (dbId가 있는 경우)
  if (userId) {
    const deletePromises = videosToDelete
      .filter(video => video.dbId) // dbId가 있는 동영상만
      .map(async (video) => {
        try {
          console.log(`DB 삭제 시도: video_id=${video.dbId}, user_id=${userId}`);
          const response = await fetch(`${API_BASE_URL}/videos/${video.dbId}?user_id=${userId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: '응답 파싱 실패' }));
            console.error(`동영상 삭제 실패 (ID: ${video.dbId}):`, errorData);
            alert(`동영상 삭제 실패: ${errorData.detail || '알 수 없는 오류'}`);
          } else {
            const result = await response.json();
            console.log(`동영상 삭제 성공 (ID: ${video.dbId}):`, result);
          }
        } catch (error) {
          console.error(`동영상 삭제 중 오류 (ID: ${video.dbId}):`, error);
          alert(`동영상 삭제 중 오류가 발생했습니다: ${error.message}`);
        }
      });
    
    await Promise.all(deletePromises);
  } else {
    console.warn('사용자 ID가 없어 DB 삭제를 건너뜁니다.');
  }

  // 삭제된 동영상의 ID와 dbId 수집
  const deletedVideoIds = new Set();
  const deletedVideoDbIds = new Set();
  videosToDelete.forEach(video => {
    // id 추가
    if (video.id != null) {
      deletedVideoIds.add(video.id);
      // id가 숫자면 dbIds에도 추가 (id와 dbId가 같은 경우 대비)
      if (typeof video.id === 'number') {
        deletedVideoDbIds.add(video.id);
      }
    }
    // dbId 추가
    if (video.dbId != null) {
      deletedVideoDbIds.add(video.dbId);
      // dbId가 숫자면 ids에도 추가 (id와 dbId가 같은 경우 대비)
      if (typeof video.dbId === 'number') {
        deletedVideoIds.add(video.dbId);
      }
    }
    // id와 dbId가 모두 없으면 id를 기본값으로 사용
    if (video.id == null && video.dbId == null && video.id != undefined) {
      deletedVideoIds.add(video.id);
    }
  });
  
  console.log(`[Management] 삭제할 동영상 ID 수집 완료: ids=${deletedVideoIds.size}개, dbIds=${deletedVideoDbIds.size}개`);
  console.log(`[Management] 삭제할 IDs:`, Array.from(deletedVideoIds));
  console.log(`[Management] 삭제할 DB IDs:`, Array.from(deletedVideoDbIds));

  // 삭제된 동영상과 연관된 채팅 탭 찾기 및 닫기
  const tabsToClose = [];
  chatSessions.value.forEach((chat, index) => {
    if (chat.messages && chat.messages.length > 0) {
      const initialMessage = chat.messages.find(msg => msg.isInitial && msg.selectedVideos);
      if (initialMessage && initialMessage.selectedVideos) {
        // 선택된 동영상 중 삭제된 동영상이 있는지 확인
        const hasDeletedVideo = initialMessage.selectedVideos.some(savedVideo => {
          const videoId = savedVideo.id || savedVideo.dbId;
          const videoDbId = savedVideo.dbId || savedVideo.id;
          return deletedVideoIds.has(videoId) || 
                 deletedVideoDbIds.has(videoDbId) ||
                 (videoId && deletedVideoDbIds.has(videoId)) ||
                 (videoDbId && deletedVideoIds.has(videoDbId));
        });
        
        if (hasDeletedVideo) {
          tabsToClose.push(index);
        }
      }
    }
  });

  // 연관된 탭 닫기 (역순으로 삭제하여 인덱스 문제 방지)
  if (tabsToClose.length > 0) {
    // 각 탭의 클립 삭제
    const allClipUrls = new Set();
    tabsToClose.forEach(tabIndex => {
      const chat = chatSessions.value[tabIndex];
      if (chat && chat.messages) {
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
          body: JSON.stringify({
            clip_urls: Array.from(allClipUrls)
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const deletedCount = data.deleted_count || 0;
          if (deletedCount > 0) {
            console.log(`동영상 삭제로 인한 탭 닫기: ${deletedCount}개의 클립이 삭제되었습니다.`);
          }
        } else {
          const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
          console.warn('클립 삭제 실패:', response.status, errorData);
        }
      } catch (error) {
        console.error('클립 삭제 중 오류:', error);
      }
    }

    // 탭 삭제 (역순으로 정렬하여 뒤에서부터 삭제)
    tabsToClose.sort((a, b) => b - a);
    tabsToClose.forEach(tabIndex => {
      chatSessions.value.splice(tabIndex, 1);
    });

    // 현재 채팅 인덱스 조정
    if (tabsToClose.includes(currentChatIndex.value)) {
      // 현재 보고 있던 탭이 삭제된 경우
      if (chatSessions.value.length > 0) {
        currentChatIndex.value = Math.min(currentChatIndex.value, chatSessions.value.length - 1);
      } else {
        currentChatIndex.value = 0;
        showSearchSidebar.value = false;
      }
    } else {
      // 삭제된 탭이 현재 탭보다 앞에 있으면 인덱스 조정
      const deletedBeforeCurrent = tabsToClose.filter(idx => idx < currentChatIndex.value).length;
      if (deletedBeforeCurrent > 0) {
        currentChatIndex.value = Math.max(0, currentChatIndex.value - deletedBeforeCurrent);
      }
    }

  }

  // 로컬에서 삭제
  items.value = items.value.filter(video => {
    if (selectedIds.value.includes(video.id)) {
      if (video.objectUrl) {
        try {
          URL.revokeObjectURL(video.objectUrl);
        } catch (error) {
          console.error("Failed to revoke object URL:", error);
        }
      }
      return false; // 삭제 대상
    }
    return true; // 유지 대상
  });

  // localStorage 업데이트
  persistToStorage();

  // Search 메뉴에 동영상 삭제 알림 (useVideoSync의 emitVideoDeletedEvent 사용)
  emitVideoDeletedEvent(deletedVideoIds, deletedVideoDbIds);

  // 선택된 ID 초기화
  selectedIds.value = [];
  showDeletePopup.value = false;
}

// ==================== 네비게이션 헬퍼 함수 ====================

/**
 * 선택된 동영상을 Summarize 형식으로 변환
 * @param {Array} videos - 변환할 동영상 배열
 * @returns {Array} 변환된 동영상 배열
 */
function prepareVideosForSummarize(videos) {
  return videos.map(video => {
    const displayUrl = video.originUrl || (video.displayUrl?.startsWith('blob:') ? null : video.displayUrl) || video.url || '';
    const originUrl = video.originUrl || video.url || displayUrl;
    
    return {
      ...video,
      objectUrl: null,
      displayUrl: displayUrl.startsWith('blob:') ? originUrl : displayUrl,
      originUrl: originUrl,
      url: originUrl || displayUrl
    };
  });
}

/**
 * 선택된 동영상을 Search 형식으로 변환
 * @param {Array} videos - 변환할 동영상 배열
 * @returns {Array} 변환된 동영상 배열
 */
function prepareVideosForSearch(videos) {
  return videos.map(video => ({
    id: video.id,
    dbId: video.dbId || video.id,
    title: video.title,
    date: video.date,
    displayUrl: video.displayUrl || video.originUrl || '',
    originUrl: video.originUrl || video.displayUrl || ''
  }));
}

/**
 * history.state에 데이터를 설정하고 라우터로 이동
 * @param {string} routeName - 이동할 라우트 이름
 * @param {Object} stateData - history.state에 저장할 데이터
 */
function navigateWithState(routeName, stateData) {
  console.log('[Management] navigateWithState 호출:', routeName, stateData);
  
  // router.push()를 먼저 호출하고, 완료 후 state 설정
  router.push({ name: routeName }).then(() => {
    // router.push() 완료 후 nextTick에서 state 설정
    nextTick(() => {
      const currentState = history.state || {};
      const newState = {
        ...currentState,
        ...stateData
      };
      history.replaceState(newState, '');
      console.log('[Management] History state 설정 완료:', newState);
      
      // Search.vue가 마운트된 후 state를 확인할 수 있도록 약간의 지연
      setTimeout(() => {
        if (history.state && history.state.selectedVideos) {
          console.log('[Management] History state 확인:', history.state.selectedVideos.length, '개 동영상');
        } else {
          console.warn('[Management] History state가 설정되지 않았습니다!');
        }
      }, 200);
    });
  }).catch((error) => {
    console.error('[Management] 네비게이션 에러:', error);
  });
}

function goToSummary() {
  const selectedVideos = items.value.filter(v => selectedIds.value.includes(v.id));
  const videosForSummarize = prepareVideosForSummarize(selectedVideos);
  summaryVideoStore.setVideos(videosForSummarize);
  router.push({ name: 'Summarize' });
}

function goToSearch() {
  if (selectedIds.value.length === 0) {
    return;
  }
  const selectedVideos = items.value.filter(v => selectedIds.value.includes(v.id));
  const videosData = prepareVideosForSearch(selectedVideos);
  console.log('[Management] 검색 버튼 클릭 - 선택된 동영상:', videosData.length, '개');
  navigateWithState('search', { selectedVideos: videosData });
}

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

// 채팅 메시지의 selectedVideos에 최신 displayUrl 업데이트
function updateChatVideoUrls(chatSessions) {
  chatSessions.forEach(chat => {
    if (chat.messages) {
      chat.messages.forEach(message => {
        if (message.isInitial && message.selectedVideos) {
          message.selectedVideos = message.selectedVideos.map(savedVideo => {
            // items.value에서 최신 동영상 정보 찾기
            const currentVideo = items.value.find(v => 
              v.id === savedVideo.id || v.dbId === savedVideo.dbId
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
              // items.value에 없으면 서버에서 조회 시도
              // 일단 저장된 정보 유지 (서버 조회는 나중에)
              return {
                ...savedVideo,
                displayUrl: savedVideo.displayUrl || ''
              };
            }
          });
        }
      });
    }
  });
}

function handleChatVideoError(video, event) {
  console.warn('채팅창 동영상 로드 실패:', video.title, video.displayUrl, event);
  // 에러 발생 시 displayUrl을 null로 설정하여 대체 UI 표시
  if (video) {
    video.displayUrl = null;
  }
}

function createNewChat(videos = selectedVideos.value, signature) {
  const effectiveVideos = videos || [];
  const selectionSnapshot = snapshotVideosForChat(effectiveVideos);
  const resolvedSignature = signature ?? getSelectionSignature(effectiveVideos);

  const newChat = {
    id: Date.now(),
    name: null, // 사용자가 수정할 수 있는 이름
    messages: [],
    selectionSignature: resolvedSignature
  };

  // 초기 시스템 메시지 추가
  const initialMessage = settingStore.language === 'ko'
    ? `안녕하세요! 선택하신 <strong>${selectionSnapshot.length}개의 동영상</strong>에서 검색을 도와드리겠습니다.`
    : `Hello! I'll help you search through <strong>${selectionSnapshot.length} selected videos</strong>.`;
  newChat.messages.push({
    role: 'assistant',
    content: initialMessage,
    isInitial: true,
    selectedVideos: selectionSnapshot,
    timestamp: getCurrentTime()
  });

  chatSessions.value.push(newChat);
  currentChatIndex.value = chatSessions.value.length - 1;

  nextTick(() => {
    scrollToBottom();
  });
}

function handleNewChatButtonClick() {
  // 선택된 비디오가 있으면 그것으로, 없으면 빈 배열로 새 채팅방 생성
  const selectionVideos = selectedVideos.value;
  const selectionSignature = getSelectionSignature(selectionVideos);
  
  // 입력창 초기화
  searchInput.value = '';
  
  // 새 채팅방 생성
  createNewChat(selectionVideos, selectionSignature);
  
  nextTick(() => {
    scrollToBottom();
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
        body: JSON.stringify({
          clip_urls: Array.from(clipUrls) // Set을 배열로 변환
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const deletedCount = data.deleted_count || 0;
        if (deletedCount > 0) {
          console.log(`채팅방 삭제: ${deletedCount}개의 클립이 삭제되었습니다.`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
        console.warn('클립 삭제 실패:', response.status, errorData);
      }
    } catch (error) {
      console.error('클립 삭제 중 오류:', error);
    }
  }

  chatSessions.value.splice(index, 1);

  // 삭제된 채팅창이 현재 채팅창이거나 그 이후인 경우 인덱스 조정
  if (currentChatIndex.value >= index) {
    currentChatIndex.value = Math.max(0, currentChatIndex.value - 1);
  }

  // 현재 채팅창이 범위를 벗어난 경우 마지막 채팅창으로 이동
  if (currentChatIndex.value >= chatSessions.value.length) {
    currentChatIndex.value = chatSessions.value.length - 1;
  }
}

// 채팅창 탭 컨텍스트 메뉴 함수
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

async function closeOtherChatTabs(clickedTabIndex) {
  closeChatTabContextMenu();
  
  // 현재 탭이 유효하지 않거나 탭이 1개 이하면 실행하지 않음
  if (clickedTabIndex === null || clickedTabIndex < 0 || clickedTabIndex >= chatSessions.value.length || chatSessions.value.length <= 1) {
    return;
  }
  
  // 현재 보고 있던 탭의 인덱스를 저장
  const activeTabIndex = currentChatIndex.value;
  
  // 현재 탭을 제외한 나머지 탭들의 클립 URL 수집
  const otherClipUrls = new Set();
  chatSessions.value.forEach((chat, index) => {
    if (index !== clickedTabIndex && chat.messages) {
      chat.messages.forEach(message => {
        if (message.clips && Array.isArray(message.clips)) {
          message.clips.forEach(clip => {
            if (clip.url && !clip.via_response) {
              otherClipUrls.add(clip.url);
            }
          });
        }
        if (message.groupedClips && Array.isArray(message.groupedClips)) {
          message.groupedClips.forEach(group => {
            if (group.clips && Array.isArray(group.clips)) {
              group.clips.forEach(clip => {
                if (clip.url && !clip.via_response) {
                  otherClipUrls.add(clip.url);
                }
              });
            }
          });
        }
      });
    }
  });
  
  // 클립이 있으면 삭제 요청
  if (otherClipUrls.size > 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clip_urls: Array.from(otherClipUrls)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const deletedCount = data.deleted_count || 0;
        if (deletedCount > 0) {
          console.log(`나머지 탭 닫기: ${deletedCount}개의 클립이 삭제되었습니다.`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
        console.warn('클립 삭제 실패:', response.status, errorData);
      }
    } catch (error) {
      console.error('클립 삭제 중 오류:', error);
    }
  }
  
  // 현재 탭만 남기고 나머지 탭 삭제 (역순으로 삭제하여 인덱스 문제 방지)
  const tabsToDelete = [];
  for (let i = chatSessions.value.length - 1; i >= 0; i--) {
    if (i !== clickedTabIndex) {
      tabsToDelete.push(i);
    }
  }
  
  // 역순으로 삭제
  tabsToDelete.sort((a, b) => b - a);
  tabsToDelete.forEach(index => {
    chatSessions.value.splice(index, 1);
  });
  
  // 현재 보고 있던 탭 인덱스 조정
  // 우클릭한 탭이 현재 보고 있던 탭이었다면, 삭제 후 0번 인덱스가 됨
  if (activeTabIndex === clickedTabIndex) {
    currentChatIndex.value = 0;
  } else if (activeTabIndex < clickedTabIndex) {
    // 현재 보고 있던 탭이 우클릭한 탭보다 앞에 있으면 인덱스 유지
    // (삭제되는 탭들이 뒤에 있으므로)
    currentChatIndex.value = activeTabIndex;
  } else {
    // 현재 보고 있던 탭이 우클릭한 탭보다 뒤에 있으면
    // activeTabIndex보다 작은 탭들 중에서 clickedTabIndex가 아닌 탭들이 삭제됨
    // 삭제 후에는 clickedTabIndex가 0번이 되고, activeTabIndex는 삭제되므로
    // activeTabIndex가 유효한 범위 내에 있는지 확인
    // 실제로는 activeTabIndex가 clickedTabIndex보다 크므로 삭제되어야 하는데,
    // 이 경우 activeTabIndex는 삭제되므로 다른 탭을 보여줄 수 없음
    // 하지만 activeTabIndex가 유효한 범위 내에 있다면, 삭제 후에도 그 탭이 남아있어야 함
    // 다시 생각해보니, activeTabIndex > clickedTabIndex인 경우
    // activeTabIndex는 삭제 대상이 아니므로 남아있어야 함
    // 하지만 clickedTabIndex만 남게 되므로, activeTabIndex는 삭제됨
    // 따라서 이 경우는 발생하지 않아야 함 (activeTabIndex가 clickedTabIndex와 다르고 더 크면 삭제됨)
    
    // 실제로는 activeTabIndex가 clickedTabIndex보다 크면 삭제되므로
    // 이 경우는 발생하지 않아야 하지만, 안전을 위해 처리
    // 삭제 후에는 clickedTabIndex만 남으므로, activeTabIndex는 유효하지 않음
    // 하지만 사용자가 보고 있던 탭이 삭제되면 안 되므로, 
    // 이 경우는 이미 위에서 처리되었어야 함
    
    // 다시 생각: activeTabIndex > clickedTabIndex인 경우
    // activeTabIndex는 삭제 대상이 아니므로 남아있어야 함
    // 하지만 clickedTabIndex만 남게 되므로, activeTabIndex는 삭제됨
    // 따라서 이 경우는 발생하지 않아야 함
    
    // 실제로는 activeTabIndex가 clickedTabIndex와 다르면 삭제되므로
    // 이 경우는 발생하지 않아야 하지만, 안전을 위해 0으로 설정
    currentChatIndex.value = 0;
  }
}

async function closeAllChatTabs() {
  closeChatTabContextMenu();
  
  // 모든 채팅창의 클립 URL 수집
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
  
  // 클립이 있으면 삭제 요청
  if (allClipUrls.size > 0) {
    try {
      const response = await fetch(`${API_BASE_URL}/delete-clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clip_urls: Array.from(allClipUrls)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const deletedCount = data.deleted_count || 0;
        if (deletedCount > 0) {
          console.log(`모든 채팅창 삭제: ${deletedCount}개의 클립이 삭제되었습니다.`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: '알 수 없는 오류' }));
        console.warn('클립 삭제 실패:', response.status, errorData);
      }
    } catch (error) {
      console.error('클립 삭제 중 오류:', error);
    }
  }
  
  // 모든 채팅창 삭제
  chatSessions.value = [];
  currentChatIndex.value = 0;
}

async function ensureVideoFile(video) {
  // 최적화: 이미 File 객체가 있으면 fetch를 건너뛰기
  if (video.file instanceof File) {
    // Store에도 저장 (다른 메뉴에서 재사용)
    videoFileStore.setFileByVideo(video, video.file);
    return video.file;
  }

  if (!video.displayUrl) {
    return null;
  }

  // Store에서 먼저 확인 (다른 메뉴에서 이미 로드한 경우)
  const cachedFile = videoFileStore.getFileByVideo(video);
  if (cachedFile instanceof File) {
    video.file = cachedFile;
    return cachedFile;
  }

  // blob URL의 경우 fetch를 수행하지 않음 (반복 요청 방지)
  // blob URL은 브라우저 내부 메모리 URL이므로 fetch로 접근하면 반복 요청이 발생할 수 있음
  if (video.displayUrl.startsWith('blob:')) {
    // blob URL인 경우 이미 file 객체가 있어야 하므로 null 반환
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
    // Store에 저장 (다른 메뉴에서 재사용)
    videoFileStore.setFileByVideo(video, file);
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
  nextTick(() => {
    const el = zoomVideoRef.value;
    if (!el) return;
    // 메타데이터가 준비될 때까지 기다린 뒤 재생
    if (!isFinite(el.duration)) {
      el.addEventListener('loadedmetadata', () => {
        try { el.currentTime = 0; el.play(); zoomPlaying.value = true; } catch (e) { console.warn('클립 모달 재생 실패:', e); }
      }, { once: true });
    } else {
      try { el.currentTime = 0; el.play(); zoomPlaying.value = true; } catch (e) { console.warn('클립 모달 재생 실패:', e); }
    }
  });
}


function safePlayVideo(videoElement, onSuccess) {
  if (!isFinite(videoElement.duration)) {
    videoElement.addEventListener('loadedmetadata', () => {
      videoElement.play().then(onSuccess).catch(e => console.warn('video play failed:', e));
    }, { once: true });
  } else {
    videoElement.play().then(onSuccess).catch(e => console.warn('video play failed:', e));
  }
}

function togglePlay(videoId) {
  const isZoom = zoomedVideo.value && zoomedVideo.value.id === videoId;
  const videoElement = isZoom ? zoomVideoRef.value : videoRefs.value[videoId];
  
  if (!videoElement || !videoElement.src) {
    console.warn('togglePlay: video has no src');
      return;
    }
  
  if (isZoom) {
    if (!zoomPlaying.value) {
      safePlayVideo(videoElement, () => { zoomPlaying.value = true; });
      } else {
      try {
        videoElement.pause();
      zoomPlaying.value = false;
      } catch (e) {
        /* ignore */
      }
    }
    return;
  }

  // 그리드 비디오 토글
  const index = playingVideoIds.value.indexOf(videoId);
  if (index === -1) {
    playingVideoIds.value.push(videoId);
    safePlayVideo(videoElement, () => {});
  } else {
    playingVideoIds.value.splice(index, 1);
    videoElement.pause();
  }
}

function onVideoMetadataLoaded(videoId, event) {
  const video = items.value.find(v => v.id === videoId);
  if (video && event.target) {
    const { videoWidth, videoHeight, duration } = event.target;
    if (videoWidth && videoHeight) {
      video.width = videoWidth;
      video.height = videoHeight;
    }
    if (duration && isFinite(duration)) {
      durationMap.value[videoId] = duration;
      // 선택된 동영상의 메타데이터가 로드되면 청크 크기 업데이트
      if (selectedIds.value.includes(videoId) && selectedIds.value[0] === videoId) {
        updateRecommendedChunkSize();
      }
    }
  }
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
  // 화면에 보이는 비디오 우선 처리 (현재 페이지의 비디오)
  const currentPageStart = (currentPage.value - 1) * itemsPerPage.value;
  const currentPageEnd = currentPageStart + itemsPerPage.value;
  const visibleVideos = items.value.slice(currentPageStart, currentPageEnd);
  const visibleVideoIds = new Set(visibleVideos.map(v => v.id));
  
  const visibleBatch = durationLoadQueue.filter(v => visibleVideoIds.has(v.id));
  const hiddenBatch = durationLoadQueue.filter(v => !visibleVideoIds.has(v.id));
  
  // 화면에 보이는 비디오를 먼저 큐 앞에 배치
  durationLoadQueue = [...visibleBatch, ...hiddenBatch];
  
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
  // 이미 duration이 있으면 스킵
  if (durationMap.value[video.id]) return;
  // 이미지 파일이면 스킵
  if (isImageFile(video)) return;
  // 이미 로드 중인 video ID면 스킵
  if (loadingDurationVideoIds.has(video.id)) return;
  
  // 백엔드 API에서 받은 duration이 있으면 먼저 사용
  if (video.duration && isFinite(video.duration) && video.duration > 0) {
    durationMap.value[video.id] = video.duration;
    return;
  }
  
  // displayUrl이 없으면 스킵
  if (!video.displayUrl) return;
  
  // blob URL은 duration 로드 시도하지 않음 (반복 요청 방지)
  // blob URL은 브라우저 내부 메모리 URL이므로 video 요소로 로드 시 반복 요청이 발생할 수 있음
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
      } catch (e) {
        // 이미 제거되었을 수 있음
      }
    }
    // src 제거하여 추가 요청 방지
    try {
      videoElement.src = '';
      videoElement.load();
    } catch (e) {
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
      durationMap.value[video.id] = duration;
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
  
  videoElement.src = video.displayUrl;
  document.body.appendChild(videoElement);
}

function preloadAllVideoDurations() {
  // 큐에 추가 (중복 제거: 이미 로드 중인 URL은 제외)
  durationLoadQueue = items.value.filter(video => {
    if (durationMap.value[video.id]) return false;
    if (isImageFile(video)) return false;
    if (video.duration && isFinite(video.duration) && video.duration > 0) {
      durationMap.value[video.id] = video.duration;
      return false;
    }
    if (!video.displayUrl) return false;
    // blob URL은 duration 로드 시도하지 않음 (반복 요청 방지)
    if (video.displayUrl.startsWith('blob:')) return false;
    // 이미 로드 중인 URL은 제외 (중복 요청 방지)
    if (loadingDurationUrls.has(video.displayUrl)) return false;
    // 이미 로드 중인 video ID는 제외
    if (loadingDurationVideoIds.has(video.id)) return false;
    // 큰 파일 (1GB 이상)은 스킵
    const fileSizeGB = video.fileSize ? video.fileSize / (1024 * 1024 * 1024) : 0;
    if (fileSizeGB > 1.0) return false;
    return true;
  });
  
  // 첫 배치 시작
  if (durationLoadQueue.length > 0) {
    setTimeout(processDurationQueue, 100);
  }
}

// ==================== 비디오 에러 처리 ====================
function initializeVideoErrorTracking(video) {
  if (video._errorRetryCount === undefined) video._errorRetryCount = 0;
  if (!video._triedUrls) video._triedUrls = new Set();
}

function switchToServerUrl(video, videoElement) {
  if (video.objectUrl) {
    try {
      URL.revokeObjectURL(video.objectUrl);
    } catch (e) {
      console.warn('ObjectURL 해제 실패:', e);
    }
  }
  video.displayUrl = video.originUrl;
  video.objectUrl = null;
  if (videoElement) {
    videoElement.crossOrigin = 'anonymous';
    videoElement.src = video.originUrl;
    videoElement.load();
  }
}

function switchToObjectUrl(video, videoElement, currentUrl) {
  if (video.objectUrl && video.objectUrl !== currentUrl) {
    try {
      URL.revokeObjectURL(video.objectUrl);
    } catch (e) {
      console.warn('ObjectURL 해제 실패:', e);
    }
  }
  const objUrl = URL.createObjectURL(video.file);
  video.displayUrl = objUrl;
  video.objectUrl = objUrl;
  if (videoElement) {
    videoElement.crossOrigin = null;
    videoElement.src = objUrl;
    videoElement.load();
  }
}

async function handleVideoError(videoId, event, isZoom = false) {
  const video = items.value.find(v => v.id === videoId);
  if (!video) return;
  
  // currentUrl과 isBlobUrl을 함수 시작 부분에서 한 번만 선언
  const currentUrl = isZoom && zoomedVideo.value 
    ? zoomedVideo.value.displayUrl 
    : video.displayUrl;
  const isBlobUrl = currentUrl?.startsWith('blob:');
  
  // Blob URL 에러이고 originUrl이 있으면 즉시 서버 URL로 전환
  if (isBlobUrl && video.originUrl && !video.originUrl.startsWith('blob:')) {
    const videoElement = isZoom ? zoomVideoRef.value : videoRefs.value[videoId];
    if (videoElement) {
      try {
        videoElement.pause();
        videoElement.src = video.originUrl;
        videoElement.crossOrigin = 'anonymous';
        videoElement.load();
      } catch (e) {
        // 에러 무시
      }
    }
    // displayUrl도 서버 URL로 업데이트
    if (!isZoom) {
      video.displayUrl = video.originUrl;
    } else if (zoomedVideo.value) {
      zoomedVideo.value.displayUrl = video.originUrl;
    }
    // 에러 처리는 여기서 종료 (조용히 처리)
    return;
  }
  
  initializeVideoErrorTracking(video);
  
  // 에러 상세 정보 수집 (디버깅용)
  const errorInfo = {
    videoId,
    title: video.title,
    currentUrl: currentUrl,
    originUrl: video.originUrl,
    errorCount: video._errorRetryCount,
    event: event?.type || 'unknown'
  };
  
  // 최대 재시도 횟수 초과 시 즉시 종료 (더 이상 시도하지 않음)
  if (video._errorRetryCount >= MAX_ERROR_RETRIES) {
    // 최종 실패 시 displayUrl을 null로 설정하여 썸네일 없음 상태로 표시
    console.warn(`비디오 로드 최종 실패 (최대 재시도 횟수 초과): ${video.title}. 썸네일을 숨깁니다.`, errorInfo);
    if (!isZoom) {
      video.displayUrl = null;
    } else if (zoomedVideo.value) {
      zoomedVideo.value.displayUrl = null;
    }
    // _triedUrls에 현재 URL 추가하여 더 이상 시도하지 않도록 함
    if (currentUrl) {
      video._triedUrls.add(currentUrl);
    }
    return;
  }
  
  // 현재 URL이 이미 시도한 URL이고, 변환된 URL도 이미 시도했다면 더 이상 재시도하지 않음
  if (video._triedUrls.has(currentUrl)) {
    // 변환된 URL이 있는지 확인
    if (currentUrl && currentUrl.includes('/video-files/') && !currentUrl.includes('/converted-videos/')) {
      try {
        const urlPath = new URL(currentUrl).pathname;
        const filename = urlPath.split('/').pop() || '';
        const baseName = filename.replace(/\.[^.]+$/, '');
        const convertedUrl = currentUrl.replace('/video-files/', '/converted-videos/').replace(filename, `${baseName}.mp4`);
        
        if (video._triedUrls.has(convertedUrl)) {
          // 원본 URL과 변환된 URL 모두 시도했으면 최종 실패
          console.warn(`비디오 로드 최종 실패 (모든 URL 시도 완료): ${video.title}`, errorInfo);
          if (!isZoom) {
            video.displayUrl = null;
          } else if (zoomedVideo.value) {
            zoomedVideo.value.displayUrl = null;
          }
          return;
        }
      } catch (urlError) {
        // URL 파싱 실패 시 최종 실패 처리
        console.warn(`비디오 URL 파싱 실패: ${video.title}`, errorInfo);
        if (!isZoom) {
          video.displayUrl = null;
        } else if (zoomedVideo.value) {
          zoomedVideo.value.displayUrl = null;
        }
        return;
      }
    } else if (currentUrl && currentUrl.includes('/converted-videos/')) {
      // 변환된 URL이 이미 실패했다면 더 이상 재시도하지 않음
      console.warn(`비디오 로드 최종 실패 (변환된 URL 실패): ${video.title}`, errorInfo);
      if (!isZoom) {
        video.displayUrl = null;
      } else if (zoomedVideo.value) {
        zoomedVideo.value.displayUrl = null;
      }
      return;
    }
  }
  
  video._triedUrls.add(currentUrl);
  video._errorRetryCount++;
  
  const videoElement = isZoom ? zoomVideoRef.value : videoRefs.value[videoId];
  
  // 지원하지 않는 형식인지 확인 (AVI, MKV, FLV, WMV)
  const isUnsupported = isUnsupportedFormat(video.title || video.name || '');
  
  // 1. blob: URL 실패 시 서버 URL로 전환
  if (isBlobUrl && video.originUrl && !video.originUrl.startsWith('blob:')) {
    if (video._triedUrls.has(video.originUrl)) {
      // 이미 서버 URL을 시도했으면 최종 실패
      console.warn(`비디오 로드 실패 (모든 URL 시도 완료): ${video.title}`, errorInfo);
      if (!isZoom) {
        video.displayUrl = null;
      } else if (zoomedVideo.value) {
        zoomedVideo.value.displayUrl = null;
      }
      return;
    }
    console.warn(`비디오 로드 실패 (ObjectURL), 서버 URL로 전환: ${video.title}`, errorInfo);
    switchToServerUrl(video, videoElement);
    if (isZoom && zoomedVideo.value) {
      zoomedVideo.value.displayUrl = video.originUrl;
    }
    return;
  }
  
  // 2. 서버 URL 실패 시 ObjectURL로 재시도 (지원하는 형식만)
  if (!isBlobUrl && video.file && !isUnsupported) {
    if (video.objectUrl && video._triedUrls.has(video.objectUrl)) {
      // 이미 ObjectURL을 시도했으면 최종 실패
      console.warn(`비디오 로드 실패 (모든 URL 시도 완료): ${video.title}`, errorInfo);
      if (!isZoom) {
        video.displayUrl = null;
      } else if (zoomedVideo.value) {
        zoomedVideo.value.displayUrl = null;
      }
      return;
    }
    console.warn(`비디오 로드 실패 (서버 URL), ObjectURL로 재시도: ${video.title}`, errorInfo);
    switchToObjectUrl(video, videoElement, currentUrl);
    if (isZoom && zoomedVideo.value) {
      zoomedVideo.value.displayUrl = video.displayUrl;
    }
    return;
  }
  
  // 3. 지원하지 않는 형식이거나 file이 없는 경우
  if (isUnsupported) {
    // 변환된 MP4가 없으면 변환 요청
    const userId = localStorage.getItem("vss_user_id");
    if (userId && video.dbId && !video._isConverting) {
      console.info(`지원하지 않는 형식, MP4 변환 요청: ${video.title}`, errorInfo);
      convertVideoToMp4(video.dbId, userId, video).then(convertedUrl => {
        if (convertedUrl && videoElement) {
          videoElement.crossOrigin = 'anonymous';
          videoElement.src = convertedUrl;
          videoElement.load();
        }
      }).catch(err => {
        console.warn(`동영상 변환 실패 (${video.title}):`, err);
      });
    }
    return;
  }
  
  // 4. 서버 URL이지만 로드 실패한 경우 - 변환된 MP4 URL 확인 및 URL 접근성 확인
  if (!isBlobUrl && !video.file && currentUrl && currentUrl.startsWith('http')) {
    // 변환된 MP4 URL 확인 (converted-videos 경로) - 먼저 시도
    // 단, 이미 변환된 URL(/converted-videos/)이 실패한 경우는 더 이상 재시도하지 않음
    if (currentUrl.includes('/video-files/') && !currentUrl.includes('/converted-videos/')) {
      try {
        // 파일명에서 확장자 제거 후 .mp4 추가
        const urlPath = new URL(currentUrl).pathname;
        const filename = urlPath.split('/').pop() || '';
        const baseName = filename.replace(/\.[^.]+$/, ''); // 확장자 제거
        const convertedUrl = currentUrl.replace('/video-files/', '/converted-videos/').replace(filename, `${baseName}.mp4`);
        
        // 변환된 URL을 아직 시도하지 않았고, 원래 URL도 이미 시도한 경우에만 변환된 URL 시도
        if (!video._triedUrls.has(convertedUrl) && video._triedUrls.has(currentUrl)) {
          console.info(`변환된 MP4 URL 시도: ${video.title}`, { 
            originalUrl: currentUrl,
            convertedUrl 
          });
          video._triedUrls.add(convertedUrl);
          if (videoElement) {
            videoElement.crossOrigin = 'anonymous';
            videoElement.src = convertedUrl;
            videoElement.load();
          }
          if (isZoom && zoomedVideo.value) {
            zoomedVideo.value.displayUrl = convertedUrl;
          }
          return;
        } else if (video._triedUrls.has(convertedUrl)) {
          // 변환된 URL도 이미 시도했으면 더 이상 재시도하지 않음
          console.warn(`비디오 로드 실패 (변환된 URL도 실패): ${video.title}`, {
            ...errorInfo,
            convertedUrl,
            note: '원본 URL과 변환된 URL 모두 시도했지만 실패했습니다.'
          });
          if (!isZoom) {
            video.displayUrl = null;
          } else if (zoomedVideo.value) {
            zoomedVideo.value.displayUrl = null;
          }
          return;
        }
      } catch (urlError) {
        // URL 파싱 실패 시 최종 실패 처리
        console.warn(`비디오 URL 파싱 실패: ${video.title}`, {
          ...errorInfo,
          urlError: urlError.message,
          note: 'URL 파싱 중 오류가 발생했습니다.'
        });
        if (!isZoom) {
          video.displayUrl = null;
        } else if (zoomedVideo.value) {
          zoomedVideo.value.displayUrl = null;
        }
        return;
      }
    } else if (currentUrl.includes('/converted-videos/')) {
      // 이미 변환된 URL이 실패한 경우 - 더 이상 재시도하지 않음
      console.warn(`비디오 로드 실패 (변환된 URL 실패): ${video.title}`, {
        ...errorInfo,
        note: '변환된 MP4 URL도 실패했습니다. 더 이상 재시도하지 않습니다.'
      });
      if (!isZoom) {
        video.displayUrl = null;
      } else if (zoomedVideo.value) {
        zoomedVideo.value.displayUrl = null;
      }
      return;
    }
    
    // 변환된 MP4도 실패했거나 없으면 최대 재시도 횟수 확인 후 종료
    // HEAD 요청은 CORS 문제로 인해 대부분 실패하므로 제거하고, 재시도 횟수만 확인
    console.warn(`비디오 로드 실패 (서버 URL): ${video.title}`, {
      ...errorInfo,
      url: currentUrl,
      note: '서버 URL 로드 실패. 최대 재시도 횟수 확인 후 종료합니다.'
    });
  }
  
  // 5. 그 외의 경우 최종 실패
  console.warn(`비디오 로드 실패: ${video.title}`, errorInfo);
  
  // 비디오 요소를 비활성화하여 무한 루프 방지
  if (videoElement) {
    try {
      videoElement.removeAttribute('src');
      videoElement.load();
      // 에러 핸들러 제거는 Vue의 반응형 시스템과 충돌할 수 있으므로 하지 않음
    } catch (e) {
      // 에러 무시
    }
  }
  
  if (!isZoom) {
    video.displayUrl = null;
  } else if (zoomedVideo.value) {
    zoomedVideo.value.displayUrl = null;
  }
}

function handleZoomVideoError(videoId, event) {
  handleVideoError(videoId, event, true);
}

function handleImageError(videoId, event) {
  const video = items.value.find(v => v.id === videoId);
  if (!video) return;
  console.warn('이미지 로드 실패:', video.title, video.displayUrl, event);
  // 이미지 로드 실패 시 displayUrl을 null로 설정하여 대체 UI 표시
  video.displayUrl = null;
}

function updateProgress(videoId, event) {
  const video = items.value.find(v => v.id === videoId);
  if (video) {
    const { currentTime, duration } = event.target;
    video.progress = duration ? (currentTime / duration) * 100 : 0;
    currentTimeMap.value[videoId] = currentTime;
    if (duration && isFinite(duration)) {
      durationMap.value[videoId] = duration;
    }
  }
}

function onZoomTimeUpdate(event) {
  const { currentTime, duration } = event.target;
  zoomProgress.value = duration ? (currentTime / duration) * 100 : 0;
  zoomCurrentTime.value = currentTime || 0;
  zoomDuration.value = duration || 0;
}

// ==================== 비디오 재생 제어 ====================
function seekVideo(videoId, event) {
  const isZoom = zoomedVideo.value && zoomedVideo.value.id === videoId;
  const videoElement = isZoom ? zoomVideoRef.value : videoRefs.value[videoId];
  
    if (!videoElement || !videoElement.src) return;
  
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min((event.clientX - left) / width, 1));
    const targetTime = pct * (isFinite(videoElement.duration) ? videoElement.duration : 0);
  
    if (!isFinite(targetTime)) return;
  
    try {
      videoElement.currentTime = targetTime;
    if (isZoom) {
    zoomProgress.value = pct * 100;
    zoomCurrentTime.value = videoElement.currentTime;
    zoomDuration.value = videoElement.duration || 0;
    }
  } catch (e) {
    console.warn('seekVideo failed:', e);
  }
}

function startDragging(videoId, evt) {
  // 이미 드래그 중이면 중복 등록 방지
  if (isDragging.value) {
    return;
  }
  
  isDragging.value = true;
  draggedVideoId.value = videoId;
  // 확대 모달의 경우 zoomProgressBarRef 사용
  if (zoomedVideo.value && zoomedVideo.value.id === videoId) {
    draggingBarEl = zoomProgressBarRef.value;
  } else {
    // 진행바 엘리먼트 확보 (ref 사용, 없으면 이벤트 타겟에서 추론)
    draggingBarEl = progressBarRefs.value[videoId] || (evt && evt.target && evt.target.closest('.relative.cursor-pointer'));
  }
  document.addEventListener('mousemove', handleDragging);
  document.addEventListener('mouseup', stopDragging);
  if (evt) evt.preventDefault();
  if (evt) evt.stopPropagation();
}

function handleDragging(event) {
  if (!isDragging.value || !draggedVideoId.value) return;

  const isZoom = zoomedVideo.value && zoomedVideo.value.id === draggedVideoId.value;
  const videoElement = isZoom ? zoomVideoRef.value : videoRefs.value[draggedVideoId.value];
  const progressBarEl = isZoom ? zoomProgressBarRef.value : draggingBarEl;
  
  if (!videoElement || !videoElement.duration || !progressBarEl) return;
  
    const { left, width } = progressBarEl.getBoundingClientRect();
    const clickX = event.clientX - left;
    const percentage = Math.max(0, Math.min(clickX / width, 1));
  
    videoElement.currentTime = percentage * videoElement.duration;
  
  if (isZoom) {
    zoomProgress.value = percentage * 100;
    zoomCurrentTime.value = videoElement.currentTime;
    zoomDuration.value = videoElement.duration || 0;
  } else {
  const video = items.value.find(v => v.id === draggedVideoId.value);
  if (video) video.progress = percentage * 100;
  }
}

function stopDragging() {
  // 드래그 중이 아니면 아무것도 하지 않음
  if (!isDragging.value) {
    return;
  }
  
  isDragging.value = false;
  draggedVideoId.value = null;
  draggingBarEl = null;
  document.removeEventListener('mousemove', handleDragging);
  document.removeEventListener('mouseup', stopDragging);
}

// 보고서 제목 입력 모달 닫기
function closeReportTitleModal() {
  showReportTitleModal.value = false;
  reportTitleInput.value = '';
  reportTitleError.value = '';
  isCheckingTitle.value = false;
  pendingReportData.value = null;
}

// 보고서 생성 모달 닫기
function closeReportModal() {
  // 완료 상태일 때만 닫기 (로딩 중에는 닫지 않음)
  if (reportSuccess.value) {
    isCreatingReport.value = false;
    reportSuccess.value = false;
    reportLoadingMessage.value = '';
    reportSuccessMessage.value = '';
  }
}

// 업로드 모달 닫기 (X 버튼 클릭 시 업로드 중단)
function closeUploadModal() {
  // 진행 중인 모든 업로드 취소
  Object.keys(activeUploads.value).forEach(uploadId => {
    const xhr = activeUploads.value[uploadId];
    if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
      xhr.abort(); // 업로드 중단
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem && uploadItem.progress < 100) {
        uploadItem.status = '취소됨';
        uploadItem.progress = 0;
      }
    }
  });
  
  // 활성 업로드 목록 초기화
  activeUploads.value = {};
  
  // 모달 닫기 및 진행률 초기화
    showUploadModal.value = false;
    uploadProgress.value = [];
}


// 서버에서 미디어 삭제하는 함수
async function removeMediaFromServer(mediaIds) {
  if (!mediaIds || mediaIds.length === 0) return;

  try {
    const response = await fetch(`${API_BASE_URL}/remove-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ media_ids: mediaIds })
    });

    if (!response.ok) {
      console.warn('서버 미디어 삭제 실패:', response.status);
      return false;
    }

    const data = await response.json();
    console.log('서버 미디어 삭제 성공:', data);
    return true;
  } catch (error) {
    console.warn('서버 미디어 삭제 중 오류:', error);
    return false;
  }
}

// XMLHttpRequest를 사용한 업로드 함수 (진행률 추적)
function uploadVideoWithProgress(file, userId, uploadId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    // 활성 업로드 목록에 추가 (취소 가능하도록)
    activeUploads.value[uploadId] = xhr;

    xhr.timeout = UPLOAD_TIMEOUT;

    // 모든 파일은 /upload-video 엔드포인트 사용
    const uploadEndpoint = `${API_BASE_URL}/upload-video`;

    // 진행률 업데이트 (99%까지만 표시)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const rawProgress = Math.round((e.loaded / e.total) * 100);
        // 99%까지만 표시 (리스트에 추가되기 전까지)
        const progress = Math.min(rawProgress, 99);
        const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
        if (uploadItem) {
          uploadItem.progress = progress;
          uploadItem.uploaded = e.loaded;
          uploadItem.total = e.total;
          uploadItem.status = '업로드 중...';
        }
      }
    });

    // 완료 처리 (진행률만 업데이트, 제거는 uploadSingleFile에서 처리)
    xhr.addEventListener('load', () => {
      delete activeUploads.value[uploadId];
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (uploadItem) {
            uploadItem.progress = 100;
            uploadItem.status = '처리 중...';
          }
          resolve(data);
        } catch (e) {
          if (uploadItem) {
            uploadItem.status = '실패: 응답 파싱 오류';
            uploadItem.progress = 0;
          }
          reject(new Error('응답 파싱 실패'));
        }
      } else {
        if (uploadItem) {
          uploadItem.status = `실패: HTTP ${xhr.status}`;
          uploadItem.progress = 0;
        }
        reject(new Error(`업로드 실패: ${xhr.status}`));
      }
    });

    // 타임아웃 처리 (제거는 uploadSingleFile에서 처리)
    xhr.addEventListener('timeout', () => {
      delete activeUploads.value[uploadId];
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = '실패: 타임아웃 (서버 응답 없음)';
        uploadItem.progress = 0;
      }
      reject(new Error('업로드 타임아웃: 서버 응답이 없습니다.'));
    });

    // 에러 처리 (제거는 uploadSingleFile에서 처리)
    xhr.addEventListener('error', () => {
      delete activeUploads.value[uploadId];
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = '실패: 네트워크 오류';
        uploadItem.progress = 0;
      }
      reject(new Error('네트워크 오류'));
    });

    // 중단(abort) 처리 (제거는 uploadSingleFile에서 처리)
    xhr.addEventListener('abort', () => {
      delete activeUploads.value[uploadId];
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = '취소됨';
        uploadItem.progress = 0;
      }
      reject(new Error('업로드 취소됨'));
    });

    try {
      xhr.open('POST', uploadEndpoint);
      xhr.send(formData);
    } catch (error) {
      // 활성 업로드 목록에서 제거
      delete activeUploads.value[uploadId];
      
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = `실패: ${error.message}`;
        uploadItem.progress = 0;
      }
      reject(error);
    }
  });
}

</script>

<style scoped>
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

.fade-slide-enter-active, .fade-slide-leave-active { 
  transition: all .28s cubic-bezier(.4,0,.2,1); 
}
.fade-slide-enter-from, .fade-slide-leave-to { 
  opacity:0; 
  transform: translateY(-6px); 
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scale-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.5s ease-out;
}

@keyframes check-draw {
  0% {
    stroke-dasharray: 0, 100;
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dasharray: 100, 0;
    stroke-dashoffset: 0;
  }
}

.animate-check-draw .check-path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: check-draw 0.6s ease-out 0.3s forwards;
}
</style>

<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-950 p-10">
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- 좌측: 동영상 업로드 -->
      <section
        class="rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-400/40 dark:border-indigo-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400 uppercase">
                {{ tCVDetector.cvPipelineManager }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ tCVDetector.cvPipelineManagerDesc }}
            </p>
          </div>
        </header>

        <!-- 파일 업로드 영역 -->
        <div
          class="relative w-full border border-slate-200/80 dark:border-gray-800 bg-blue-100 dark:bg-blue-900/30 rounded-3xl p-6 mb-4 shadow-[0_18px_45px_rgba(15,23,42,0.25)] backdrop-blur-md">
          <div
            class="aspect-video rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-400 transition-all cursor-pointer relative overflow-hidden group ring-1 ring-gray-300 dark:ring-gray-600"
            :class="[isDragging ? 'bg-blue-50 dark:bg-blue-900/50 ring-blue-300 dark:ring-blue-600' : 'bg-gray-200 dark:bg-gray-700']"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
            @click="onUploadAreaClick">
            <!-- 업로드된 동영상 표시 -->
            <template v-if="currentVideo && currentVideo.displayUrl">
              <div class="relative w-full h-full">
                <video
                  :src="currentVideo.displayUrl"
                  class="w-full h-full rounded-xl object-cover"
                  controls
                  preload="metadata"
                  @loadedmetadata="onVideoMetadataLoaded"
                  ref="videoRef"></video>
                <!-- 삭제 버튼 -->
                <button
                  @click.stop="removeCurrentVideo"
                  :disabled="isRemoving || isUploading"
                  class="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50">
                  <svg v-if="!isRemoving" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </button>
              </div>
            </template>
            <!-- 업로드 안내 -->
            <template v-else>
              <span v-if="!isDragging" class="font-bold text-blue-500 dark:text-blue-400 flex flex-col items-center justify-center text-center">
                <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {{ tCVDetector.dropVideo }}<br>{{ tCVDetector.or }}<br>{{ tCVDetector.clickUpload }}
              </span>
              <span v-else class="text-blue-600 dark:text-blue-400 font-bold">{{ tCVDetector.dropHere }}</span>
            </template>
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept="video/*"
            class="hidden"
            @change="onFileSelected">
        </div>
      </section>

      <!-- 중앙: 파라미터 설정 -->
      <section
        class="rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-400/40 dark:border-emerald-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400 uppercase">
                {{ tCVDetector.parameters }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ tCVDetector.parametersDesc }}
            </p>
          </div>
        </header>

        <!-- 파라미터 설정 폼 -->
        <div class="space-y-4 max-h-[calc(100vh-20rem)] overflow-y-auto">
          <!-- Detection Classes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ tCVDetector.detectionClasses }}
            </label>
            <textarea
              v-model="parameters.detection_classes"
              rows="5"
              :placeholder="tCVDetector.detectionClassesPlaceholder"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"></textarea>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ tCVDetector.detectionClassesHint }}</p>
          </div>

          <!-- Box Threshold -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ tCVDetector.boxThreshold }}
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ tCVDetector.boxThresholdHint }}</p>
            <div>
              <input
                v-model.number="parameters.box_threshold"
                type="number"
                min="0.1"
                max="0.9"
                step="0.05"
                class="border-2 border-gray-300 dark:border-gray-600 w-20 mt-3 text-center bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              <button
                @click="parameters.box_threshold = 0.5"
                class="border-2 border-gray-300 dark:border-gray-600 w-7 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">↺</button>
            </div>
            <div class="flex items-end h-10">
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0.1</span>
              <input
                v-model.number="parameters.box_threshold"
                type="range"
                step="0.05"
                min="0.1"
                max="0.9"
                class="w-full border-gray-300 dark:border-gray-600" />
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">0.9</span>
            </div>
          </div>

          <!-- Frame Skip -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ tCVDetector.frameSkip }}
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ tCVDetector.frameSkipHint }}</p>
            <div>
              <input
                v-model.number="parameters.frame_skip"
                type="number"
                min="1"
                max="60"
                step="1"
                class="border-2 border-gray-300 dark:border-gray-600 w-20 mt-3 text-center bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              <button
                @click="parameters.frame_skip = 1"
                class="border-2 border-gray-300 dark:border-gray-600 w-7 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">↺</button>
            </div>
            <div class="flex items-end h-10">
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
              <input
                v-model.number="parameters.frame_skip"
                type="range"
                step="1"
                min="1"
                max="60"
                class="w-full border-gray-300 dark:border-gray-600" />
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">60</span>
            </div>
          </div>

          <!-- Object Detection Threshold -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ tCVDetector.objectDetectionThreshold }}
            </label>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ tCVDetector.objectDetectionThresholdHint }}</p>
            <div>
              <input
                v-model.number="parameters.object_detection_threshold"
                type="number"
                min="1"
                max="100"
                step="1"
                class="border-2 border-gray-300 dark:border-gray-600 w-20 mt-3 text-center bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
              <button
                @click="parameters.object_detection_threshold = 50"
                class="border-2 border-gray-300 dark:border-gray-600 w-7 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">↺</button>
            </div>
            <div class="flex items-end h-10">
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">1</span>
              <input
                v-model.number="parameters.object_detection_threshold"
                type="range"
                step="1"
                min="1"
                max="100"
                class="w-full border-gray-300 dark:border-gray-600" />
              <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-center">100</span>
            </div>
          </div>

          <!-- 파이프라인 파라미터 (선택사항) -->
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase">{{ tCVDetector.pipelineParams }}</h4>
            
            <!-- Min Clip Duration -->
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ tCVDetector.minClipDuration }} (초)
              </label>
              <input
                v-model.number="pipelineParams.min_clip_duration"
                type="number"
                min="1"
                max="300"
                class="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" />
            </div>
            
            <!-- Max Clip Duration -->
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ tCVDetector.maxClipDuration }} (초)
              </label>
              <input
                v-model.number="pipelineParams.max_clip_duration"
                type="number"
                min="1"
                max="300"
                class="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200" />
            </div>
          </div>

          <!-- 이벤트 감지 시작 버튼 -->
          <button
            @click="startEventDetection"
            :disabled="!currentVideo || isProcessing"
            class="w-full px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4">
            <div v-if="isProcessing" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>{{ isProcessing ? tCVDetector.processing : tCVDetector.startDetection }}</span>
          </button>

          <!-- 스트림 상태 표시 -->
          <div v-if="streamStatus" class="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ tCVDetector.streamStatus }}</span>
              <span 
                class="text-xs px-2 py-1 rounded"
                :class="{
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200': streamStatus.status === 'processing_pending',
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': streamStatus.status === 'completed',
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': streamStatus.status === 'terminated'
                }">
                {{ streamStatus.status === 'processing_pending' ? tCVDetector.processingPending : 
                   streamStatus.status === 'completed' ? tCVDetector.completed : 
                   streamStatus.status === 'terminated' ? tCVDetector.terminated : streamStatus.status }}
              </span>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">{{ streamStatus.message }}</p>
            <p v-if="currentStreamId" class="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Stream ID: {{ currentStreamId.substring(0, 8) }}...
            </p>
          </div>
        </div>
      </section>

      <!-- 우측: Alert 설정 및 결과 -->
      <section
        class="rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/10 dark:bg-orange-500/20 border border-orange-400/40 dark:border-orange-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-orange-600 dark:text-orange-400 uppercase">
                {{ tCVDetector.alertConfiguration }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ tCVDetector.alertConfigurationDesc }}
            </p>
          </div>
        </header>


        <!-- VSS Alert Parameters -->
        <div class="mt-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            {{ tCVDetector.vssAlertParameters }}
          </h3>
          <div class="space-y-4">
            <!-- Enable Yes/No Verification & Enable Descriptions (가로 배치) -->
            <div class="flex items-center gap-6">
              <!-- Enable Yes/No Verification -->
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="vssAlertParams.enable_yes_no_verification"
                  type="checkbox"
                  @change="handleCheckboxChange"
                  class="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ tCVDetector.enableYesNoVerification }}
                </span>
              </label>

              <!-- Enable Descriptions -->
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="vssAlertParams.enable_descriptions"
                  type="checkbox"
                  @change="handleCheckboxChange"
                  class="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ tCVDetector.enableDescriptions }}
                </span>
              </label>
            </div>

            <!-- System Prompt for Alerts -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ tCVDetector.systemPromptForAlerts }}
              </label>
              <textarea
                v-model="vssAlertParams.system_prompt_for_alerts"
                rows="3"
                :placeholder="tCVDetector.systemPromptForAlertsPlaceholder"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"></textarea>
            </div>

            <!-- Alert Prompts -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ tCVDetector.alertPrompts }}
              </label>
              <textarea
                v-model="vssAlertParams.alert_prompts"
                rows="3"
                :placeholder="tCVDetector.alertPromptsPlaceholder"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"></textarea>
            </div>

            <!-- Enable Alert Reasoning -->
            <div class="flex items-center gap-3">
              <input
                v-model="vssAlertParams.enable_alert_reasoning"
                type="checkbox"
                class="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ tCVDetector.enableAlertReasoning }}
              </label>
            </div>
          </div>
        </div>


        <!-- 생성된 클립 목록 -->
        <div v-if="generatedClips.length > 0" class="mt-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ tCVDetector.generatedClips }}</h3>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="clip in generatedClips"
              :key="clip.id"
              class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <video
                v-if="clip.url"
                :src="clip.url"
                controls
                class="w-full rounded-lg mb-2"
                preload="metadata"></video>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                <p class="font-medium mb-1">{{ clip.sentence || clip.search_query }}</p>
                <p v-if="clip.start_time !== undefined && clip.end_time !== undefined">
                  {{ formatTime(clip.start_time) }} - {{ formatTime(clip.end_time) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 업로드 진행률 모달 -->
    <Teleport to="body">
      <div v-if="showUploadModal" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">{{ tCVDetector.uploading }}</h3>
            <button 
              @click="closeUploadModal" 
              :disabled="!allUploadsComplete"
              class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="space-y-4 max-h-[60vh] overflow-y-auto">
            <div v-for="upload in uploadProgress" :key="upload.id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-700">
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
              {{ tCVDetector.complete }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSettingStore } from '@/stores/settingStore';
import { getApiBaseUrl, getViaServerUrl, getCVEventDetectorApiUrl } from '@/utils/apiConfig';

const settingStore = useSettingStore();
const API_BASE_URL = getApiBaseUrl();
const VIA_SERVER_URL = getViaServerUrl();
// CV Event Detector API는 백엔드 프록시를 통해 호출
const CV_EVENT_DETECTOR_API_URL = `${API_BASE_URL}/cv-event-detector`;

const currentVideo = ref(null);
const videoRef = ref(null);
const isDragging = ref(false);
const fileInputRef = ref(null);
const isUploading = ref(false);
const isRemoving = ref(false);
const isProcessing = ref(false);
const generatedClips = ref([]);
const durationMap = ref({});
const currentPipelineId = ref(null);
const currentStreamId = ref(null);
const streamStatus = ref(null);
const statusCheckInterval = ref(null);
// VSS Alert Parameters
const vssAlertParams = ref({
  enable_yes_no_verification: true, // 기본값: 체크됨
  enable_descriptions: false,
  system_prompt_for_alerts: '',
  alert_prompts: '',
  enable_alert_reasoning: false
});

// 체크박스 변경 핸들러: 둘 다 체크 해제되어 있을 때만 자동으로 둘 다 체크, System Prompt 자동 설정
function handleCheckboxChange() {
  // 둘 다 체크 해제되어 있으면 둘 다 체크
  if (!vssAlertParams.value.enable_yes_no_verification && !vssAlertParams.value.enable_descriptions) {
    vssAlertParams.value.enable_yes_no_verification = true;
    vssAlertParams.value.enable_descriptions = true;
  }
  
  // System Prompt for Alerts 자동 설정
  const yesNo = vssAlertParams.value.enable_yes_no_verification;
  const descriptions = vssAlertParams.value.enable_descriptions;
  
  if (yesNo && descriptions) {
    // 둘 다 활성화
    vssAlertParams.value.system_prompt_for_alerts = "You are a helpful assistant. Answer the user's question in yes or no along with a one line description.";
  } else if (yesNo) {
    // Yes/No만 활성화
    vssAlertParams.value.system_prompt_for_alerts = "You are a helpful assistant. Answer the user's question in yes or no only.";
  } else if (descriptions) {
    // Descriptions만 활성화
    vssAlertParams.value.system_prompt_for_alerts = "You are a helpful assistant. Answer the user's question in 1-2 sentences.";
  } else {
    // 둘 다 비활성화 (기본값은 유지하거나 빈 문자열)
    // vssAlertParams.value.system_prompt_for_alerts = '';
  }
}
// 업로드 진행률 모달 상태
const showUploadModal = ref(false);
const uploadProgress = ref([]); // { id, fileName, progress, status, uploaded, total }
const activeUploads = ref({}); // { uploadId: XMLHttpRequest } - 진행 중인 업로드 추적
const UPLOAD_TIMEOUT = 300000; // 5분

// 파라미터 설정 (cv-event-detector 원본 파라미터)
const parameters = ref({
  detection_classes: 'person\ncar\nbicycle\nmotorcycle\nbus\ntruck',
  box_threshold: 0.5, // 0.1~0.9
  frame_skip: 1, // 1~60
  object_detection_threshold: 50 // 1~100
});

// 파이프라인 파라미터 설정
const pipelineParams = ref({
  min_clip_duration: 5, // 최소 클립 지속 시간 (초)
  max_clip_duration: 30, // 최대 클립 지속 시간 (초)
  frame_skip_interval: 1, // 프레임 스킵 간격
  minimum_detection_threshold: 3 // 최소 감지 임계값 (객체 수)
});

// 다국어 지원
const translations = {
  ko: {
    cvPipelineManager: 'CV Pipeline Manager',
    cvPipelineManagerDesc: '동영상 파일 업로드 및 관리',
    dropVideo: '동영상 파일을 드롭하세요',
    or: '또는',
    clickUpload: '클릭하여 업로드',
    dropHere: '여기에 놓으세요',
    parameters: '파라미터 설정',
    parametersDesc: '이벤트 감지 파라미터 조정',
    detectionClasses: 'Detection Classes',
    detectionClassesPlaceholder: 'person\ncar\nbicycle',
    detectionClassesHint: '감지할 객체 클래스를 한 줄에 하나씩 입력하세요',
    boxThreshold: 'Box Threshold',
    boxThresholdHint: '바운딩 박스 감지 임계값 (0.1-0.9)',
    frameSkip: 'Frame Skip',
    frameSkipHint: '프레임 스킵 간격 (1=모든 프레임, 2=1프레임 건너뛰기, 범위: 1-60)',
    objectDetectionThreshold: 'Object Detection Threshold',
    objectDetectionThresholdHint: '객체 감지 임계값 (범위: 1-100)',
    startDetection: '이벤트 감지 시작',
    processing: '처리 중...',
    pipelineParams: '파이프라인 파라미터',
    minClipDuration: '최소 클립 지속 시간',
    maxClipDuration: '최대 클립 지속 시간',
    streamStatus: '스트림 상태',
    processingPending: '처리 대기 중',
    completed: '완료',
    terminated: '중단됨',
    alertConfiguration: 'Alert 설정',
    alertConfigurationDesc: '이벤트 감지를 위한 Alert 프롬프트 설정',
    alertType: 'Alert 타입',
    selectAlertType: 'Alert 타입 선택',
    objectDetection: '객체 감지',
    ppeCheck: '안전장비 확인',
    intrusionDetection: '침입 감지',
    custom: '사용자 정의',
    prompt: '프롬프트',
    promptPlaceholder: '예: 사람이 안전모를 착용하고 있나요?',
    save: '저장',
    saving: '저장 중...',
    reset: '초기화',
    generatedClips: '생성된 클립',
    uploading: '동영상 업로드 중...',
    complete: '완료',
    vssAlertParameters: 'VSS Alert Parameters',
    enableYesNoVerification: 'Enable Yes/No Verification',
    enableDescriptions: 'Enable Descriptions',
    systemPromptForAlerts: 'System Prompt for Alerts',
    systemPromptForAlertsPlaceholder: '시스템 프롬프트를 입력하세요',
    alertPrompts: 'Alert Prompts',
    alertPromptsPlaceholder: 'Alert 프롬프트를 입력하세요',
    enableAlertReasoning: 'Enable Alert Reasoning'
  },
  en: {
    cvPipelineManager: 'CV Pipeline Manager',
    cvPipelineManagerDesc: 'Upload and manage video files',
    dropVideo: 'Drop video files here',
    or: 'or',
    clickUpload: 'click to upload',
    dropHere: 'Drop here',
    parameters: 'Parameters',
    parametersDesc: 'Adjust event detection parameters',
    detectionClasses: 'Detection Classes',
    detectionClassesPlaceholder: 'person\ncar\nbicycle',
    detectionClassesHint: 'Enter object classes to detect, one per line',
    boxThreshold: 'Box Threshold',
    boxThresholdHint: 'Bounding box detection threshold (0.1-0.9)',
    frameSkip: 'Frame Skip',
    frameSkipHint: 'Frame skip interval (1=all frames, 2=skip every other frame, range: 1-60)',
    objectDetectionThreshold: 'Object Detection Threshold',
    objectDetectionThresholdHint: 'Object detection threshold (range: 1-100)',
    startDetection: 'Start Detection',
    processing: 'Processing...',
    pipelineParams: 'Pipeline Parameters',
    minClipDuration: 'Min Clip Duration',
    maxClipDuration: 'Max Clip Duration',
    streamStatus: 'Stream Status',
    processingPending: 'Processing Pending',
    completed: 'Completed',
    terminated: 'Terminated',
    alertConfiguration: 'Alert Configuration',
    alertConfigurationDesc: 'Configure alert prompts for event detection',
    alertType: 'Alert Type',
    selectAlertType: 'Select Alert Type',
    objectDetection: 'Object Detection',
    ppeCheck: 'PPE Check',
    intrusionDetection: 'Intrusion Detection',
    custom: 'Custom',
    prompt: 'Prompt',
    promptPlaceholder: 'e.g., Is the person wearing a hard hat?',
    save: 'Save',
    saving: 'Saving...',
    reset: 'Reset',
    generatedClips: 'Generated Clips',
    uploading: 'Uploading video...',
    complete: 'Complete',
    vssAlertParameters: 'VSS Alert Parameters',
    enableYesNoVerification: 'Enable Yes/No Verification',
    enableDescriptions: 'Enable Descriptions',
    systemPromptForAlerts: 'System Prompt for Alerts',
    systemPromptForAlertsPlaceholder: 'Enter system prompt',
    alertPrompts: 'Alert Prompts',
    alertPromptsPlaceholder: 'Enter alert prompts',
    enableAlertReasoning: 'Enable Alert Reasoning'
  }
};

const tCVDetector = computed(() => translations[settingStore.language] || translations.ko);

function onDragOver(event) {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave(event) {
  event.preventDefault();
  isDragging.value = false;
}

function onDrop(event) {
  event.preventDefault();
  isDragging.value = false;
  
  const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('video/'));
  if (files.length > 0) {
    uploadFiles(files);
  }
}

function onUploadAreaClick() {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
}

function onFileSelected(event) {
  const files = Array.from(event.target.files || []).filter(f => f.type.startsWith('video/'));
  if (files.length > 0) {
    uploadFile(files[0]); // 첫 번째 파일만 사용
  }
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

async function uploadFile(file) {
  if (isUploading.value) return;
  
  isUploading.value = true;
  
  // File 객체로 ObjectURL 생성하여 즉시 표시
  const objectUrl = URL.createObjectURL(file);
  const tempId = `temp_${Date.now()}`;
  currentVideo.value = {
    id: tempId,
    name: file.name,
    file: file,
    displayUrl: objectUrl,
    viaFileId: null
  };
  
  // 업로드 진행률 초기화
  const uploadId = Date.now();
  uploadProgress.value = [{
    id: uploadId,
    fileName: file.name,
    progress: 0,
    status: settingStore.language === 'ko' ? '대기 중...' : 'Waiting...',
    uploaded: 0,
    total: file.size
  }];
  
  // 업로드 모달 표시
  showUploadModal.value = true;
  
  try {
    // XMLHttpRequest를 사용하여 진행률 추적
    const result = await uploadFileWithProgress(file, uploadId);
    
    // VIA 서버의 file_id 저장
    if (currentVideo.value) {
      currentVideo.value.viaFileId = result.id;
      currentVideo.value.id = result.id;
    }
    
    // 업로드 완료 표시
    const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
    if (uploadItem) {
      uploadItem.progress = 100;
      uploadItem.status = settingStore.language === 'ko' ? '완료' : 'Complete';
    }
  } catch (error) {
    console.error(`파일 업로드 실패 (${file.name}):`, error);
    // 업로드 실패 시 ObjectURL 정리
    if (currentVideo.value && currentVideo.value.displayUrl) {
      URL.revokeObjectURL(currentVideo.value.displayUrl);
    }
    currentVideo.value = null;
    
    // 업로드 실패 표시
    const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
    if (uploadItem) {
      uploadItem.status = settingStore.language === 'ko' 
        ? `실패: ${error.message}` 
        : `Failed: ${error.message}`;
      uploadItem.progress = 0;
    }
    
    alert(settingStore.language === 'ko' 
      ? `파일 업로드에 실패했습니다: ${file.name} - ${error.message}` 
      : `Failed to upload file: ${file.name} - ${error.message}`);
  } finally {
    isUploading.value = false;
  }
}

// XMLHttpRequest를 사용한 업로드 함수 (진행률 추적)
function uploadFileWithProgress(file, uploadId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'vision');
    formData.append('media_type', 'video');

    // 활성 업로드 목록에 추가 (취소 가능하도록)
    activeUploads.value[uploadId] = xhr;

    xhr.timeout = UPLOAD_TIMEOUT;

    const uploadEndpoint = `${API_BASE_URL}/via-upload-file`;

    // 진행률 업데이트
    // 파일 업로드 진행률은 0-85%로 제한 (나머지 15%는 VIA 서버 업로드 처리 시간)
    let fileUploadComplete = false;
    let viaProgressInterval = null; // 인터벌 참조를 외부 스코프에 저장
    
    // 인터벌 정리 함수
    const clearViaProgressInterval = () => {
      if (viaProgressInterval) {
        clearInterval(viaProgressInterval);
        viaProgressInterval = null;
      }
    };
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const fileUploadProgress = Math.round((e.loaded / e.total) * 100);
        // 파일 업로드 진행률을 85%로 스케일링
        const progress = Math.round((fileUploadProgress * 85) / 100);
        const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
        if (uploadItem) {
          uploadItem.progress = progress;
          uploadItem.uploaded = e.loaded;
          uploadItem.total = e.total;
          uploadItem.status = settingStore.language === 'ko' ? '파일 업로드 중...' : 'Uploading file...';
          
          // 파일 업로드 완료 감지 (85% 도달)
          if (e.loaded === e.total && !fileUploadComplete) {
            fileUploadComplete = true;
            uploadItem.progress = 85;
            uploadItem.status = settingStore.language === 'ko' ? 'VIA 서버로 업로드 중...' : 'Uploading to VIA server...';
            
            // VIA 서버 업로드 처리 중 점진적 진행률 증가 (85-99%)
            let viaProgress = 85;
            viaProgressInterval = setInterval(() => {
              if (viaProgress < 99) {
                viaProgress += 1;
                uploadItem.progress = viaProgress;
              } else {
                clearViaProgressInterval();
              }
            }, 200); // 200ms마다 1%씩 증가
            
            // 요청이 완료되면 인터벌 정리
            xhr.addEventListener('load', clearViaProgressInterval, { once: true });
            xhr.addEventListener('error', clearViaProgressInterval, { once: true });
            xhr.addEventListener('timeout', clearViaProgressInterval, { once: true });
            xhr.addEventListener('abort', clearViaProgressInterval, { once: true });
          }
        }
      }
    });

    // 완료 처리 (백엔드 응답 수신, 100% 도달)
    xhr.addEventListener('load', () => {
      // 인터벌 정리
      clearViaProgressInterval();
      
      // 활성 업로드 목록에서 제거
      delete activeUploads.value[uploadId];
      
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          // VIA 서버 업로드 완료 (100% 도달)
          if (uploadItem) {
            uploadItem.progress = 100;
            uploadItem.status = settingStore.language === 'ko' ? '완료' : 'Complete';
          }
          resolve(data);
        } catch (e) {
          if (uploadItem) {
            uploadItem.status = settingStore.language === 'ko' ? '실패: 응답 파싱 오류' : 'Failed: Response parse error';
            uploadItem.progress = 0;
          }
          reject(new Error(settingStore.language === 'ko' ? '응답 파싱 실패' : 'Response parse failed'));
        }
      } else {
        if (uploadItem) {
          uploadItem.status = settingStore.language === 'ko' ? `실패: HTTP ${xhr.status}` : `Failed: HTTP ${xhr.status}`;
          uploadItem.progress = 0;
        }
        reject(new Error(settingStore.language === 'ko' ? `업로드 실패: ${xhr.status}` : `Upload failed: ${xhr.status}`));
      }
    });

    // 타임아웃 처리
    xhr.addEventListener('timeout', () => {
      // 인터벌 정리
      clearViaProgressInterval();
      
      // 활성 업로드 목록에서 제거
      delete activeUploads.value[uploadId];
      
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = settingStore.language === 'ko' ? '실패: 타임아웃 (서버 응답 없음)' : 'Failed: Timeout (No server response)';
        uploadItem.progress = 0;
      }
      reject(new Error(settingStore.language === 'ko' ? '업로드 타임아웃: 서버 응답이 없습니다.' : 'Upload timeout: No server response.'));
    });

    // 에러 처리
    xhr.addEventListener('error', () => {
      // 인터벌 정리
      clearViaProgressInterval();
      
      // 활성 업로드 목록에서 제거
      delete activeUploads.value[uploadId];
      
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = settingStore.language === 'ko' ? '실패: 네트워크 오류' : 'Failed: Network error';
        uploadItem.progress = 0;
      }
      reject(new Error(settingStore.language === 'ko' ? '네트워크 오류' : 'Network error'));
    });

    // 중단(abort) 처리
    xhr.addEventListener('abort', () => {
      // 인터벌 정리
      clearViaProgressInterval();
      
      // 활성 업로드 목록에서 제거
      delete activeUploads.value[uploadId];
      
      const uploadItem = uploadProgress.value.find(u => u.id === uploadId);
      if (uploadItem) {
        uploadItem.status = settingStore.language === 'ko' ? '취소됨' : 'Cancelled';
        uploadItem.progress = 0;
      }
      reject(new Error(settingStore.language === 'ko' ? '업로드 취소됨' : 'Upload cancelled'));
    });

    // 요청 전송
    xhr.open('POST', uploadEndpoint);
    xhr.send(formData);
  });
}

// 모든 업로드가 완료되었는지 확인
const allUploadsComplete = computed(() => {
  return uploadProgress.value.length > 0 && 
         uploadProgress.value.every(u => u.progress === 100 || u.status === '완료' || u.status === 'Complete' || u.status.includes('실패') || u.status.includes('Failed'));
});

// 업로드 모달 닫기
function closeUploadModal() {
  if (!allUploadsComplete.value) {
    // 업로드가 완료되지 않았으면 닫을 수 없음
    return;
  }
  
  showUploadModal.value = false;
  uploadProgress.value = [];
}

async function removeCurrentVideo() {
  if (!currentVideo.value || isRemoving.value) return;
  
  isRemoving.value = true;
  try {
    // ObjectURL 정리
    if (currentVideo.value.displayUrl && currentVideo.value.displayUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentVideo.value.displayUrl);
    }
    
    // VIA 서버에서 파일 삭제
    if (currentVideo.value.viaFileId) {
      const response = await fetch(`${API_BASE_URL}/remove-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          media_ids: [currentVideo.value.viaFileId]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to remove file');
      }
    }
    
    currentVideo.value = null;
    durationMap.value = {};
  } catch (error) {
    console.error('파일 제거 실패:', error);
    alert(settingStore.language === 'ko' 
      ? `파일 제거에 실패했습니다: ${error.message}` 
      : `Failed to remove file: ${error.message}`);
  } finally {
    isRemoving.value = false;
  }
}

function onVideoMetadataLoaded(event) {
  if (currentVideo.value && videoRef.value) {
    durationMap.value[currentVideo.value.id] = videoRef.value.duration;
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (seconds === undefined || seconds === null) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


// 파이프라인 생성 또는 기존 파이프라인 사용
async function ensurePipeline() {
  // 기존 파이프라인이 있으면 재사용
  if (currentPipelineId.value) {
    return currentPipelineId.value;
  }

  // Detection Classes를 쉼표로 변환
  const classesArray = parameters.value.detection_classes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  const gdinoprompt = classesArray.join(' . '); // cv_event_detector.py는 ' . '로 구분

  // 파이프라인 생성 요청
  const pipelineRequest = {
    name: `cv-event-detector-${Date.now()}`,
    type: 'object_detection',
    params: {
      min_clip_duration: pipelineParams.value.min_clip_duration,
      max_clip_duration: pipelineParams.value.max_clip_duration,
      frame_skip_interval: parameters.value.frame_skip || pipelineParams.value.frame_skip_interval,
      minimum_detection_threshold: parameters.value.object_detection_threshold || pipelineParams.value.minimum_detection_threshold
    }
  };

  const response = await fetch(`${CV_EVENT_DETECTOR_API_URL}/api/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(pipelineRequest)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`파이프라인 생성 실패: ${errorText}`);
  }

  const pipelineData = await response.json();
  currentPipelineId.value = pipelineData.id;
  return pipelineData.id;
}

// 스트림 상태 확인 (폴링)
async function checkStreamStatus(streamId) {
  const response = await fetch(`${CV_EVENT_DETECTOR_API_URL}/api/streams/${streamId}/status?timeout_ms=2000`, {
    method: 'GET'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`스트림 상태 확인 실패: ${errorText}`);
  }

  const statusData = await response.json();
  streamStatus.value = statusData;
  return statusData;
}

// 스트림 상태 폴링 중지
function stopStatusPolling() {
  if (statusCheckInterval.value) {
    clearInterval(statusCheckInterval.value);
    statusCheckInterval.value = null;
  }
}

// 스트림 상태 폴링 시작
function startStatusPolling(streamId) {
  stopStatusPolling();
  
  statusCheckInterval.value = setInterval(async () => {
    try {
      const status = await checkStreamStatus(streamId);
      
      if (status.status === 'completed') {
        stopStatusPolling();
        isProcessing.value = false;
        
        // 이벤트 클립 처리
        if (status.events && status.events.length > 0) {
          // 이벤트 클립을 generatedClips 형식으로 변환
          generatedClips.value = status.events.map((event, index) => ({
            id: `event-${index}`,
            url: event.clip ? `${CV_EVENT_DETECTOR_API_URL}/${event.clip}` : null,
            metadata: event.metadata,
            event_type: event.event_type,
            sentence: event.event_type || 'Event detected'
          }));
          
          alert(settingStore.language === 'ko' 
            ? `이벤트 감지 완료. ${generatedClips.value.length}개의 클립이 생성되었습니다.` 
            : `Event detection completed. ${generatedClips.value.length} clips generated.`);
        } else {
          alert(settingStore.language === 'ko' 
            ? '이벤트 감지가 완료되었지만 생성된 클립이 없습니다.' 
            : 'Event detection completed but no clips were generated.');
        }
      } else if (status.status === 'terminated') {
        stopStatusPolling();
        isProcessing.value = false;
        alert(settingStore.language === 'ko' 
          ? '이벤트 감지가 중단되었습니다.' 
          : 'Event detection was terminated.');
      }
    } catch (error) {
      console.error('스트림 상태 확인 오류:', error);
    }
  }, 2000); // 2초마다 확인
}

async function startEventDetection() {
  if (!currentVideo.value || !currentVideo.value.viaFileId || isProcessing.value) return;

  isProcessing.value = true;
  generatedClips.value = [];
  stopStatusPolling(); // 기존 폴링 중지

  try {
    // 1. 파이프라인 생성 또는 기존 파이프라인 사용
    const pipelineId = await ensurePipeline();

    // 2. Detection Classes를 쉼표로 변환 (cv_event_detector.py 형식: ' . '로 구분)
    const classesArray = parameters.value.detection_classes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    const gdinoprompt = classesArray.join(' . ');

    // 3. 비디오 파일 경로 가져오기
    // cv_event_detector.py는 로컬 파일 경로(file://) 또는 RTSP 스트림(rtsp://)을 필요로 함
    // 백엔드에 프록시 엔드포인트가 필요: VIA 서버에서 파일을 다운로드하여 로컬 경로를 제공
    // 예: POST /api/cv-event-detector/get-video-path { via_file_id: "..." }
    // 반환: { file_path: "/tmp/xxx.mp4" }
    
    // TODO: 백엔드에 프록시 엔드포인트 추가 필요
    // 현재는 임시로 VIA 서버의 파일 ID를 사용
    // 실제 구현 시 백엔드에서 파일을 다운로드하여 로컬 경로를 제공해야 함
    const videoFileUrl = `file:///tmp/cv-videos/${currentVideo.value.viaFileId}.mp4`;
    
    // 4. 스트림 추가 요청
    const addStreamRequest = {
      version: '1.0',
      stream_url: videoFileUrl, // file:// 경로 또는 rtsp:// URL
      pipeline_id: pipelineId,
      output_folder: '/tmp/cv-events', // 출력 폴더 경로
      cv_params: {
        gdinoprompt: gdinoprompt,
        gdinothreshold: parameters.value.box_threshold,
        gdino_rois: null // ROI는 선택사항
      }
    };

    const addStreamResponse = await fetch(`${CV_EVENT_DETECTOR_API_URL}/api/addstream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(addStreamRequest)
    });

    if (!addStreamResponse.ok) {
      const errorText = await addStreamResponse.text();
      throw new Error(`스트림 추가 실패: ${errorText}`);
    }

    const streamData = await addStreamResponse.json();
    currentStreamId.value = streamData.stream_id;

    // 5. 스트림 상태 폴링 시작
    startStatusPolling(streamData.stream_id);

    // 초기 상태 확인
    await checkStreamStatus(streamData.stream_id);

  } catch (error) {
    console.error('이벤트 감지 실패:', error);
    stopStatusPolling();
    isProcessing.value = false;
    alert(settingStore.language === 'ko' 
      ? `이벤트 감지에 실패했습니다: ${error.message}` 
      : `Failed to detect events: ${error.message}`);
  }
}

onMounted(() => {
  // 컴포넌트 마운트 시 기본값에 맞게 System Prompt 설정
  handleCheckboxChange();
});

// 컴포넌트 언마운트 시 정리
onUnmounted(() => {
  // ObjectURL 정리
  if (currentVideo.value && currentVideo.value.displayUrl && currentVideo.value.displayUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideo.value.displayUrl);
  }
  
  // 스트림 상태 폴링 중지
  stopStatusPolling();
  
  // 실행 중인 스트림이 있으면 제거
  if (currentStreamId.value) {
    fetch(`${CV_EVENT_DETECTOR_API_URL}/api/stream`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stream_id: currentStreamId.value,
        version: '1.0'
      })
    }).catch(err => console.error('스트림 제거 실패:', err));
  }
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

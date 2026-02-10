<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-950 p-10">
    <div class="grid lg:grid-cols-[1fr_400px] gap-6 h-full">
      <!-- 좌측: Alert 목록 및 상세 -->
      <section
        class="h-[calc(100vh-10rem)] rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-400/40 dark:border-blue-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-blue-600 dark:text-blue-400 uppercase">
                {{ tEventReviewer.alertInspector }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ tEventReviewer.alertInspectorDesc }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="refreshAlerts"
              :disabled="isLoading"
              class="w-9 h-9 flex items-center justify-center bg-slate-200/70 dark:bg-gray-700 hover:bg-slate-400/80 dark:hover:bg-gray-600 border border-slate-500/60 dark:border-gray-600 text-slate-700 dark:text-gray-200 rounded-lg shadow transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              :title="tEventReviewer.refresh">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <select
              v-model="filterStatus"
              class="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">{{ tEventReviewer.allStatus }}</option>
              <option value="REVIEW_PENDING">{{ tEventReviewer.pending }}</option>
              <option value="REVIEWED">{{ tEventReviewer.reviewed }}</option>
              <option value="REVIEW_FAILED">{{ tEventReviewer.failed }}</option>
            </select>
          </div>
        </header>

        <!-- Alert 목록 -->
        <div class="flex-1 overflow-y-auto space-y-3">
          <div
            v-for="alert in filteredAlerts"
            :key="alert.id"
            @click="selectAlert(alert)"
            :class="[
              'p-4 rounded-xl border cursor-pointer transition-all duration-200',
              selectedAlert?.id === alert.id
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 shadow-md'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow'
            ]">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    :class="[
                      'px-2 py-1 rounded text-xs font-semibold',
                      getStatusClass(alert.alert?.status)
                    ]">
                    {{ getStatusText(alert.alert?.status) }}
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatTimestamp(alert.timestamp) }}
                  </span>
                </div>
                <h3 class="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  {{ alert.alert?.type || tEventReviewer.unknownType }}
                </h3>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {{ alert.alert?.description || alert.event?.description || '' }}
                </p>
              </div>
            </div>
            <div v-if="alert.result?.verification_result !== undefined" class="mt-2">
              <span
                :class="[
                  'px-2 py-1 rounded text-xs font-medium',
                  alert.result.verification_result
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                ]">
                {{ alert.result.verification_result ? tEventReviewer.verified : tEventReviewer.notVerified }}
              </span>
            </div>
          </div>
          <div v-if="filteredAlerts.length === 0 && !isLoading" class="text-center py-12">
            <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p class="text-gray-500 dark:text-gray-400">{{ tEventReviewer.noAlerts }}</p>
          </div>
          <div v-if="isLoading" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
            <p class="text-gray-500 dark:text-gray-400">{{ tEventReviewer.loading }}</p>
          </div>
        </div>
      </section>

      <!-- 우측: Alert 상세 및 Q&A -->
      <section
        class="h-[calc(100vh-10rem)] rounded-2xl p-6 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
        <!-- 헤더 -->
        <header class="flex items-center justify-between px-1 pb-4 mb-4 border-b border-slate-800/70 dark:border-gray-200/30">
          <div class="flex flex-col gap-1">
            <div
              class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 dark:bg-purple-500/20 border border-purple-400/40 dark:border-purple-400/60 w-fit">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
              <span class="text-[11px] font-semibold tracking-wide text-purple-600 dark:text-purple-400 uppercase">
                {{ tEventReviewer.alertDetails }}
              </span>
            </div>
            <p class="text-xs md:text-sm text-black dark:text-gray-200 mt-1">
              {{ selectedAlert ? selectedAlert.alert?.type : tEventReviewer.selectAlert }}
            </p>
          </div>
        </header>

        <!-- Alert 상세 -->
        <div v-if="selectedAlert" class="flex-1 overflow-y-auto space-y-4 mb-4">
          <!-- 비디오/이미지 미리보기 -->
          <div v-if="selectedAlert.video_path" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <video
              v-if="selectedAlert.video_path.endsWith('.mp4') || selectedAlert.video_path.endsWith('.avi')"
              :src="getVideoUrl(selectedAlert.video_path)"
              controls
              class="w-full max-h-64 object-contain bg-black">
            </video>
            <img
              v-else
              :src="getVideoUrl(selectedAlert.video_path)"
              alt="Alert media"
              class="w-full max-h-64 object-contain bg-gray-100 dark:bg-gray-800">
          </div>

          <!-- Alert 정보 -->
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ tEventReviewer.alertType }}</label>
              <p class="text-sm text-gray-800 dark:text-gray-200 mt-1">{{ selectedAlert.alert?.type || '-' }}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ tEventReviewer.description }}</label>
              <p class="text-sm text-gray-800 dark:text-gray-200 mt-1">{{ selectedAlert.result?.description || selectedAlert.alert?.description || '-' }}</p>
            </div>
            <div v-if="selectedAlert.result?.reasoning">
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ tEventReviewer.reasoning }}</label>
              <p class="text-sm text-gray-800 dark:text-gray-200 mt-1">{{ selectedAlert.result.reasoning }}</p>
            </div>
            <div v-if="selectedAlert.result?.verification_result !== undefined">
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ tEventReviewer.verificationResult }}</label>
              <p
                :class="[
                  'text-sm font-semibold mt-1',
                  selectedAlert.result.verification_result
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                ]">
                {{ selectedAlert.result.verification_result ? tEventReviewer.verified : tEventReviewer.notVerified }}
              </p>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ tEventReviewer.timestamp }}</label>
              <p class="text-sm text-gray-800 dark:text-gray-200 mt-1">{{ formatTimestamp(selectedAlert.timestamp) }}</p>
            </div>
          </div>
        </div>

        <!-- 빈 상태 -->
        <div v-else class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-gray-500 dark:text-gray-400 text-sm">{{ tEventReviewer.selectAlertToView }}</p>
          </div>
        </div>

        <!-- Q&A 섹션 -->
        <div v-if="selectedAlert" class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ tEventReviewer.qa }}</h3>
          </div>
          <div class="space-y-2 max-h-48 overflow-y-auto mb-3">
            <div
              v-for="(msg, idx) in chatMessages"
              :key="idx"
              :class="[
                'p-2 rounded-lg text-sm',
                msg.role === 'user'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 ml-8'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 mr-8'
              ]">
              <div class="font-semibold text-xs mb-1">{{ msg.role === 'user' ? tEventReviewer.user : tEventReviewer.assistant }}</div>
              <div v-html="msg.content"></div>
            </div>
          </div>
          <div class="flex gap-2">
            <input
              v-model="queryInput"
              @keyup.enter="sendQuery"
              :placeholder="tEventReviewer.askQuestion"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <button
              @click="sendQuery"
              :disabled="!queryInput.trim() || isQuerying"
              class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ tEventReviewer.send }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSettingStore } from '@/stores/settingStore';
import { getApiBaseUrl, getViaServerUrl } from '@/utils/apiConfig';
import { marked } from 'marked';

const settingStore = useSettingStore();
const API_BASE_URL = getApiBaseUrl();
const VIA_SERVER_URL = getViaServerUrl();

const alerts = ref([]);
const selectedAlert = ref(null);
const filterStatus = ref('all');
const isLoading = ref(false);
const queryInput = ref('');
const chatMessages = ref([]);
const isQuerying = ref(false);
let ws = null;

// 다국어 지원
const translations = {
  ko: {
    alertInspector: 'Alert Inspector',
    alertInspectorDesc: '이벤트 알림 검토 및 관리',
    refresh: '새로고침',
    allStatus: '모든 상태',
    pending: '대기 중',
    reviewed: '검토 완료',
    failed: '검토 실패',
    unknownType: '알 수 없음',
    verified: '검증됨',
    notVerified: '미검증',
    noAlerts: '알림이 없습니다',
    loading: '로딩 중...',
    alertDetails: 'Alert 상세',
    selectAlert: 'Alert 선택',
    alertType: 'Alert 타입',
    description: '설명',
    reasoning: '추론',
    verificationResult: '검증 결과',
    timestamp: '타임스탬프',
    selectAlertToView: '상세를 보려면 Alert를 선택하세요',
    qa: 'Q&A',
    user: '사용자',
    assistant: '어시스턴트',
    askQuestion: '질문을 입력하세요...',
    send: '전송'
  },
  en: {
    alertInspector: 'Alert Inspector',
    alertInspectorDesc: 'Review and manage event alerts',
    refresh: 'Refresh',
    allStatus: 'All Status',
    pending: 'Pending',
    reviewed: 'Reviewed',
    failed: 'Failed',
    unknownType: 'Unknown',
    verified: 'Verified',
    notVerified: 'Not Verified',
    noAlerts: 'No alerts',
    loading: 'Loading...',
    alertDetails: 'Alert Details',
    selectAlert: 'Select Alert',
    alertType: 'Alert Type',
    description: 'Description',
    reasoning: 'Reasoning',
    verificationResult: 'Verification Result',
    timestamp: 'Timestamp',
    selectAlertToView: 'Select an alert to view details',
    qa: 'Q&A',
    user: 'User',
    assistant: 'Assistant',
    askQuestion: 'Enter your question...',
    send: 'Send'
  }
};

const tEventReviewer = computed(() => translations[settingStore.language] || translations.ko);

const filteredAlerts = computed(() => {
  if (filterStatus.value === 'all') return alerts.value;
  return alerts.value.filter(alert => alert.alert?.status === filterStatus.value);
});

function getStatusClass(status) {
  const classes = {
    'REVIEW_PENDING': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    'REVIEWED': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    'REVIEW_FAILED': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  };
  return classes[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400';
}

function getStatusText(status) {
  const texts = {
    'REVIEW_PENDING': tEventReviewer.value.pending,
    'REVIEWED': tEventReviewer.value.reviewed,
    'REVIEW_FAILED': tEventReviewer.value.failed
  };
  return texts[status] || status;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString(settingStore.language === 'ko' ? 'ko-KR' : 'en-US');
}

function getVideoUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // VIA 서버의 Alert Bridge를 통해 미디어 파일 접근
  // ALERT_REVIEW_MEDIA_BASE_DIR 환경 변수에 설정된 경로 사용
  return `${VIA_SERVER_URL}/api/v1/alerts/media/${encodeURIComponent(path)}`;
}

function selectAlert(alert) {
  selectedAlert.value = alert;
  chatMessages.value = [];
  queryInput.value = '';
}

async function refreshAlerts() {
  isLoading.value = true;
  try {
    // VIA 서버의 Alert Bridge API를 통해 최신 알림 목록 가져오기
    const response = await fetch(`${VIA_SERVER_URL}/api/v1/alerts/recent`);
    if (response.ok) {
      const data = await response.json();
      alerts.value = data || [];
    } else {
      console.error('알림 목록 조회 실패:', response.status, await response.text());
    }
  } catch (error) {
    console.error('알림 목록 조회 실패:', error);
  } finally {
    isLoading.value = false;
  }
}

async function sendQuery() {
  if (!queryInput.value.trim() || !selectedAlert.value || isQuerying.value) return;

  const query = queryInput.value.trim();
  chatMessages.value.push({
    role: 'user',
    content: query
  });
  queryInput.value = '';
  isQuerying.value = true;

  try {
    // VIA 서버의 chat/completions API를 사용하여 Alert에 대한 Q&A
    // Alert의 video_path를 사용하여 쿼리
    const response = await fetch(`${VIA_SERVER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: selectedAlert.value.video_path ? [selectedAlert.value.video_path] : [],
        model: 'cosmos-reason2', // 기본 모델
        messages: [{ role: 'user', content: query }],
        stream: false
      })
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || '';
      const formattedAnswer = marked.parse(answer);
      chatMessages.value.push({
        role: 'assistant',
        content: formattedAnswer
      });
    } else {
      const errorText = await response.text();
      throw new Error(errorText || 'Query failed');
    }
  } catch (error) {
    console.error('질의 실패:', error);
    chatMessages.value.push({
      role: 'assistant',
      content: settingStore.language === 'ko' 
        ? `질의 처리 중 오류가 발생했습니다: ${error.message}` 
        : `An error occurred while processing the query: ${error.message}`
    });
  } finally {
    isQuerying.value = false;
  }
}

function connectWebSocket() {
  try {
    // VIA 서버의 WebSocket 엔드포인트 (Alert Bridge)
    const wsHost = VIA_SERVER_URL.replace('http://', '').replace('https://', '');
    const wsUrl = `ws://${wsHost.replace(':8101', ':9080')}/ws/alerts`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
        // 새 알림 추가 또는 기존 알림 업데이트
        const index = alerts.value.findIndex(a => a.id === alert.id);
        if (index >= 0) {
          alerts.value[index] = alert;
        } else {
          alerts.value.unshift(alert);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(connectWebSocket, 5000);
    };
  } catch (error) {
    console.error('WebSocket connection failed:', error);
  }
}

onMounted(() => {
  refreshAlerts();
  connectWebSocket();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

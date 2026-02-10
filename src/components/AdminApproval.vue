<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gray-200 to-gray-300 via-gray-100 dark:from-gray-950 dark:to-gray-900 dark:via-gray-950 p-10">
    <div class="max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">관리자 승인</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">승인 대기 사용자 목록을 확인하고 승인/반려할 수 있습니다.</p>
        </div>
        <button
          class="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold shadow hover:bg-blue-600 transition-colors disabled:opacity-50"
          :disabled="isLoading"
          @click="loadPendingUsers"
        >
          새로고침
        </button>
      </div>

      <div v-if="!isAdmin" class="text-center py-12 text-gray-600 dark:text-gray-300">
        관리자 권한이 없습니다.
      </div>

      <div v-else>
        <div v-if="errorMessage" class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
          {{ successMessage }}
        </div>

        <div v-if="isLoading" class="text-center py-12 text-gray-500">
          로딩 중...
        </div>

        <div v-else-if="pendingUsers.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
          승인 대기 사용자가 없습니다.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b dark:border-gray-700">
                <th class="py-2">사용자 ID</th>
                <th class="py-2">이메일</th>
                <th class="py-2">가입일</th>
                <th class="py-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in pendingUsers" :key="user.id" class="border-b dark:border-gray-800">
                <td class="py-3 text-gray-900 dark:text-gray-100">{{ user.id }}</td>
                <td class="py-3 text-gray-700 dark:text-gray-300">{{ user.email }}</td>
                <td class="py-3 text-gray-500 dark:text-gray-400">{{ formatDate(user.created_at) }}</td>
                <td class="py-3 text-right">
                  <button
                    class="px-3 py-1.5 rounded-md bg-emerald-500 text-white text-xs font-semibold mr-2 hover:bg-emerald-600"
                    :disabled="isProcessing"
                    @click="setApproval(user.id, true)"
                  >
                    승인
                  </button>
                  <button
                    class="px-3 py-1.5 rounded-md bg-gray-400 text-white text-xs font-semibold hover:bg-gray-500"
                    :disabled="isProcessing"
                    @click="setApproval(user.id, false)"
                  >
                    반려
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { getApiBaseUrl } from "@/utils/apiConfig";

const API_BASE_URL = getApiBaseUrl();
const pendingUsers = ref([]);
const isLoading = ref(false);
const isProcessing = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const adminId = () => localStorage.getItem("vss_user_id") || "";
const role = () => localStorage.getItem("vss_user_role") || "";
const isAdmin = computed(() => role() === "ADMIN");

function formatDate(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

async function loadPendingUsers() {
  errorMessage.value = "";
  successMessage.value = "";
  if (!isAdmin.value) return;
  const adminUserId = adminId();
  if (!adminUserId) {
    errorMessage.value = "관리자 ID를 확인할 수 없습니다.";
    return;
  }
  isLoading.value = true;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/pending-users?admin_id=${encodeURIComponent(adminUserId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      errorMessage.value = data.detail || data.message || "승인 대기 사용자 조회에 실패했습니다.";
      pendingUsers.value = [];
      return;
    }
    pendingUsers.value = data.users || [];
  } catch (e) {
    errorMessage.value = "승인 대기 사용자 조회 중 오류가 발생했습니다.";
  } finally {
    isLoading.value = false;
  }
}

async function setApproval(userId, approved) {
  errorMessage.value = "";
  successMessage.value = "";
  if (!isAdmin.value) return;
  const adminUserId = adminId();
  if (!adminUserId) {
    errorMessage.value = "관리자 ID를 확인할 수 없습니다.";
    return;
  }
  isProcessing.value = true;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/approve-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_id: adminUserId,
        user_id: userId,
        approved
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      errorMessage.value = data.detail || data.message || "승인 처리에 실패했습니다.";
      return;
    }
    pendingUsers.value = pendingUsers.value.filter((u) => u.id !== userId);
    successMessage.value = approved ? "승인 완료." : "반려 처리 완료.";
  } catch (e) {
    errorMessage.value = "승인 처리 중 오류가 발생했습니다.";
  } finally {
    isProcessing.value = false;
  }
}

onMounted(() => {
  loadPendingUsers();
});
</script>

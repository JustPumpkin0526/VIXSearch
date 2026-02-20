<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- 로고/타이틀 영역 -->
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">VSS</h1>
        <h2 class="text-2xl font-semibold text-gray-700">로그인</h2>
        <p class="mt-2 text-sm text-gray-600">계정에 로그인하여 시작하세요</p>
      </div>

      <!-- 로그인 카드 -->
      <div class="bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <!-- 에러 메시지 -->
        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- 성공 메시지 -->
        <div v-if="successMessage" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>{{ successMessage }}</span>
        </div>

        <!-- 입력 폼 -->
        <form @submit.prevent="login" class="space-y-5">
          <!-- ID 입력 -->
          <div>
            <label for="id" class="block text-sm font-medium text-gray-700 mb-2">사용자 ID</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                id="id"
                v-model="id"
                type="text"
                required
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="사용자 ID를 입력하세요"
                @input="clearError"
              />
            </div>
          </div>

          <!-- 비밀번호 입력 -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="password"
                v-model="pw"
                type="password"
                required
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="비밀번호를 입력하세요"
                @input="clearError"
              />
            </div>
          </div>

          <!-- 비밀번호 재설정 링크 -->
          <div class="flex items-center justify-end">
            <button
              type="button"
              :disabled="isLoading"
              @click="resetPw"
              class="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors disabled:text-gray-400"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          <!-- 로그인 버튼 -->
          <button
            type="submit"
            :disabled="isLoading || !id || !pw"
            class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isLoading ? '로그인 중...' : '로그인' }}</span>
          </button>
        </form>

        <!-- 회원가입 링크 -->
        <div class="text-center pt-4 border-t border-gray-200">
          <p class="text-sm text-gray-600">
            계정이 없으신가요?
            <router-link to="/register" class="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              회원가입
            </router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "@/composables/useAuth";
import { useErrorHandler } from "@/composables/useErrorHandler";

const router = useRouter();
const { login: authLogin } = useAuth();
const { errorMessage, successMessage, clearMessages, handleError, showSuccess } = useErrorHandler();

const id = ref("");
const pw = ref("");
const isLoading = ref(false);

async function login() {
  if (!id.value.trim() || !pw.value.trim()) {
    handleError(new Error("ID와 비밀번호를 모두 입력해주세요."));
    return;
  }

  isLoading.value = true;
  clearMessages();

  try {
    const result = await authLogin(id.value.trim(), pw.value);
    
    if (result?.success) {
      showSuccess("로그인 성공!");
      
      // 성공 메시지 표시 후 페이지 이동
      setTimeout(() => {
        router.push("/search");
      }, 500);
    } else {
      handleError(new Error(result?.message || "가입되지 않았거나 비밀번호가 올바르지 않습니다."));
    }
  } catch (err) {
    handleError(err, "로그인 중 오류가 발생했습니다.");
  } finally {
    isLoading.value = false;
  }
}

function resetPw() {
  // ID가 입력되어 있으면 쿼리 파라미터로 전달
  if (id.value.trim()) {
    router.push({ path: "/reset-password", query: { id: id.value.trim() } });
  } else {
    router.push("/reset-password");
  }
}
</script>

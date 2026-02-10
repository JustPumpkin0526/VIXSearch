<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- 로고/타이틀 영역 -->
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">VSS</h1>
        <h2 class="text-2xl font-semibold text-gray-700">비밀번호 재설정</h2>
        <p class="mt-2 text-sm text-gray-600">ID와 이메일 인증을 통해 비밀번호를 재설정하세요</p>
      </div>

      <!-- 비밀번호 재설정 카드 -->
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
        <form @submit.prevent="resetPassword" class="space-y-5">
          <!-- ID 입력 -->
          <div>
            <label for="id" class="block text-sm font-medium text-gray-700 mb-2">
              사용자 ID
              <span class="text-red-500">*</span>
            </label>
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
                :disabled="isLoading || isEmailVerified"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="사용자 ID를 입력하세요"
                @input="clearError"
              />
            </div>
          </div>

          <!-- 이메일 입력 -->
          <div v-if="id && !isEmailVerified">
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              이메일
              <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  required
                  :disabled="isLoading || isEmailVerified"
                  class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="등록된 이메일을 입력하세요"
                  @input="clearError"
                />
              </div>
              <button
                type="button"
                :disabled="!isValidEmail || isSendingCode || isEmailVerified"
                @click="sendVerificationCode"
                class="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm font-medium"
              >
                <span v-if="isSendingCode">전송 중...</span>
                <span v-else-if="isEmailVerified">인증 완료</span>
                <span v-else>인증 코드 전송</span>
              </button>
            </div>
            <p v-if="email && !isValidEmail" class="mt-1 text-xs text-red-600">올바른 이메일 형식이 아닙니다.</p>
            <p v-if="isEmailVerified" class="mt-1 text-xs text-green-600 flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              이메일 인증이 완료되었습니다.
            </p>
          </div>

          <!-- 이메일 인증 코드 입력 -->
          <div v-if="codeSent && !isEmailVerified">
            <label for="verificationCode" class="block text-sm font-medium text-gray-700 mb-2">
              인증 코드
              <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="verificationCode"
                  v-model="verificationCode"
                  type="text"
                  maxlength="6"
                  :disabled="isLoading || isVerifyingCode"
                  class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-center text-lg tracking-widest"
                  placeholder="000000"
                  @input="clearError"
                />
              </div>
              <button
                type="button"
                :disabled="!verificationCode || verificationCode.length !== 6 || isVerifyingCode"
                @click="verifyEmailCode"
                class="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm font-medium"
              >
                <span v-if="isVerifyingCode">확인 중...</span>
                <span v-else>인증 확인</span>
              </button>
            </div>
            <p v-if="verificationCode && verificationCode.length !== 6" class="mt-1 text-xs text-gray-500">6자리 인증 코드를 입력하세요.</p>
          </div>

          <!-- 새 비밀번호 입력 -->
          <div v-if="isEmailVerified">
            <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-2">
              새 비밀번호
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="newPassword"
                v-model="newPassword"
                type="password"
                required
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="새 비밀번호를 입력하세요 (8자 이상)"
                @input="clearError"
              />
            </div>
            <div class="mt-1 space-y-1">
              <p v-if="newPassword && !isValidPassword" class="text-xs text-red-600">비밀번호는 8자 이상이어야 합니다.</p>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <div class="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full transition-all duration-300" :class="passwordStrengthClass" :style="{ width: passwordStrength + '%' }"></div>
                </div>
                <span>{{ passwordStrengthText }}</span>
              </div>
            </div>
          </div>

          <!-- 새 비밀번호 확인 -->
          <div v-if="isEmailVerified">
            <label for="confirmNewPassword" class="block text-sm font-medium text-gray-700 mb-2">
              새 비밀번호 확인
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                id="confirmNewPassword"
                v-model="confirmNewPassword"
                type="password"
                required
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                :class="confirmNewPassword && newPassword !== confirmNewPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'"
                placeholder="새 비밀번호를 다시 입력하세요"
                @input="clearError"
              />
            </div>
            <p v-if="confirmNewPassword && newPassword !== confirmNewPassword" class="mt-1 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
          </div>

          <!-- 비밀번호 재설정 버튼 -->
          <button
            v-if="isEmailVerified"
            type="submit"
            :disabled="isLoading || !isFormValid"
            class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isLoading ? '재설정 중...' : '비밀번호 재설정' }}</span>
          </button>
        </form>

        <!-- 로그인 링크 -->
        <div class="text-center pt-4 border-t border-gray-200">
          <p class="text-sm text-gray-600">
            비밀번호를 기억하셨나요?
            <router-link to="/login" class="font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              로그인
            </router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import axios from "axios";
import { getApiBaseUrl } from '@/utils/apiConfig';

// API 설정
const API_BASE_URL = getApiBaseUrl();

const router = useRouter();
const route = useRoute();
const id = ref("");
const email = ref("");
const verificationCode = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const isLoading = ref(false);
const isSendingCode = ref(false);
const isVerifyingCode = ref(false);
const codeSent = ref(false);
const isEmailVerified = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const isValidPassword = computed(() => newPassword.value.length >= 8);
const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email.value === "" || emailRegex.test(email.value);
});

const passwordStrength = computed(() => {
  if (!newPassword.value) return 0;
  let strength = 0;
  if (newPassword.value.length >= 8) strength += 25;
  if (newPassword.value.length >= 12) strength += 25;
  if (/[a-z]/.test(newPassword.value) && /[A-Z]/.test(newPassword.value)) strength += 25;
  if (/\d/.test(newPassword.value)) strength += 12.5;
  if (/[^a-zA-Z\d]/.test(newPassword.value)) strength += 12.5;
  return Math.min(strength, 100);
});

const passwordStrengthClass = computed(() => {
  if (passwordStrength.value < 50) return "bg-red-500";
  if (passwordStrength.value < 75) return "bg-yellow-500";
  return "bg-green-500";
});

const passwordStrengthText = computed(() => {
  if (passwordStrength.value < 50) return "약함";
  if (passwordStrength.value < 75) return "보통";
  return "강함";
});

// URL 쿼리 파라미터에서 ID 가져오기
onMounted(() => {
  if (route.query.id) {
    id.value = route.query.id;
  }
});

const isFormValid = computed(() => {
  return isValidPassword.value && 
         newPassword.value === confirmNewPassword.value && 
         isEmailVerified.value &&
         id.value.trim() !== "" &&
         email.value.trim() !== "";
});

function clearError() {
  errorMessage.value = "";
  successMessage.value = "";
}

async function sendVerificationCode() {
  if (!id.value.trim()) {
    errorMessage.value = "ID를 먼저 입력해주세요.";
    return;
  }

  if (!isValidEmail.value) {
    errorMessage.value = "올바른 이메일 형식을 입력해주세요.";
    return;
  }

  isSendingCode.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const res = await axios.post(`${API_BASE_URL}/send-reset-password-code`, {
      username: id.value.trim(),
      email: email.value.trim()
    });
    
    if (res.data && res.data.success) {
      successMessage.value = res.data.message || "인증 코드가 이메일로 전송되었습니다.";
      codeSent.value = true;
      verificationCode.value = "";
    } else {
      errorMessage.value = res.data?.message || "인증 코드 전송에 실패했습니다.";
    }
  } catch (err) {
    if (err.response && err.response.data) {
      if (err.response.data.detail) {
        errorMessage.value = err.response.data.detail;
      } else if (err.response.data.message) {
        errorMessage.value = err.response.data.message;
      } else {
        errorMessage.value = "인증 코드 전송 중 오류가 발생했습니다.";
      }
    } else if (err.request) {
      errorMessage.value = "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
    } else {
      errorMessage.value = "인증 코드 전송 중 오류가 발생했습니다.";
    }
  } finally {
    isSendingCode.value = false;
  }
}

async function verifyEmailCode() {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    errorMessage.value = "6자리 인증 코드를 입력해주세요.";
    return;
  }

  isVerifyingCode.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const res = await axios.post(`${API_BASE_URL}/verify-reset-password-code`, {
      username: id.value.trim(),
      email: email.value.trim(),
      code: verificationCode.value.trim()
    });
    
    if (res.data && res.data.success) {
      successMessage.value = res.data.message || "이메일 인증이 완료되었습니다.";
      isEmailVerified.value = true;
    } else {
      errorMessage.value = res.data?.message || "인증 코드가 일치하지 않습니다.";
    }
  } catch (err) {
    if (err.response && err.response.data) {
      if (err.response.data.detail) {
        errorMessage.value = err.response.data.detail;
      } else if (err.response.data.message) {
        errorMessage.value = err.response.data.message;
      } else {
        errorMessage.value = "인증 코드 확인 중 오류가 발생했습니다.";
      }
    } else if (err.request) {
      errorMessage.value = "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
    } else {
      errorMessage.value = "인증 코드 확인 중 오류가 발생했습니다.";
    }
  } finally {
    isVerifyingCode.value = false;
  }
}

async function resetPassword() {
  if (!isFormValid.value) {
    errorMessage.value = "모든 필드를 올바르게 입력하고 이메일 인증을 완료해주세요.";
    return;
  }

  if (!isEmailVerified.value) {
    errorMessage.value = "이메일 인증을 먼저 완료해주세요.";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const res = await axios.post(`${API_BASE_URL}/reset-password`, {
      username: id.value.trim(),
      email: email.value.trim(),
      verification_code: verificationCode.value.trim(),
      new_password: newPassword.value
    });
    
    successMessage.value = res.data?.message || "비밀번호가 성공적으로 재설정되었습니다!";
    
    // 성공 메시지 표시 후 폼 초기화 및 로그인 페이지로 이동
    setTimeout(() => {
      id.value = "";
      email.value = "";
      verificationCode.value = "";
      newPassword.value = "";
      confirmNewPassword.value = "";
      codeSent.value = false;
      isEmailVerified.value = false;
      router.push("/login");
    }, 1500);
  } catch (err) {
    if (err.response && err.response.data) {
      if (err.response.data.detail) {
        errorMessage.value = err.response.data.detail;
      } else if (err.response.data.message) {
        errorMessage.value = err.response.data.message;
      } else {
        errorMessage.value = "비밀번호 재설정 중 오류가 발생했습니다.";
      }
    } else if (err.request) {
      errorMessage.value = "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
    } else {
      errorMessage.value = "비밀번호 재설정 중 오류가 발생했습니다.";
    }
  } finally {
    isLoading.value = false;
  }
}
</script>


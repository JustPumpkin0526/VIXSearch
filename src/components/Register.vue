<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- 로고/타이틀 영역 -->
      <div class="text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">VSS</h1>
        <h2 class="text-2xl font-semibold text-gray-700">회원가입</h2>
        <p class="mt-2 text-sm text-gray-600">새로운 계정을 만들어 시작하세요</p>
      </div>

      <!-- 회원가입 카드 -->
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
        <form @submit.prevent="register" class="space-y-5">
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
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="사용할 ID를 입력하세요"
                @input="clearMessages"
              />
            </div>
            <p v-if="id && !isValidId" class="mt-1 text-xs text-red-600">ID는 3자 이상이어야 합니다.</p>
          </div>

          <!-- 비밀번호 입력 -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
              <span class="text-red-500">*</span>
            </label>
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
                placeholder="비밀번호를 입력하세요 (8자 이상)"
                @input="clearMessages"
              />
            </div>
            <div class="mt-1 space-y-1">
              <p v-if="pw && !isValidPassword" class="text-xs text-red-600">비밀번호는 8자 이상이어야 합니다.</p>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <div class="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full transition-all duration-300" :class="passwordStrengthClass" :style="{ width: passwordStrength + '%' }"></div>
                </div>
                <span>{{ passwordStrengthText }}</span>
              </div>
            </div>
          </div>

          <!-- 비밀번호 확인 -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
              비밀번호 확인
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                id="confirmPassword"
                v-model="confirmPw"
                type="password"
                required
                :disabled="isLoading"
                class="block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                :class="confirmPw && pw !== confirmPw ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'"
                placeholder="비밀번호를 다시 입력하세요"
                @input="clearMessages"
              />
            </div>
            <p v-if="confirmPw && pw !== confirmPw" class="mt-1 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
          </div>

          <!-- 이메일 입력 -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
              이메일
              <span v-if="emailVerificationEnabled.value" class="text-red-500">*</span>
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
                  :required="emailVerificationEnabled.value"
                  :disabled="isLoading || (emailVerificationEnabled.value && isEmailVerified.value)"
                  class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  :placeholder="emailVerificationEnabled.value ? '이메일을 입력하세요' : '이메일을 입력하세요 (선택사항)'"
                  @input="clearMessages"
                />
              </div>
              <button
                v-if="emailVerificationEnabled.value"
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
            <p v-if="emailVerificationEnabled.value && isEmailVerified" class="mt-1 text-xs text-green-600 flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              이메일 인증이 완료되었습니다.
            </p>
          </div>

          <!-- 이메일 인증 코드 입력 -->
          <div v-if="emailVerificationEnabled.value && codeSent && !isEmailVerified">
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
                  @input="clearMessages"
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

          <!-- 회원가입 버튼 -->
          <button
            type="submit"
            :disabled="isLoading || !isFormValid"
            class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ isLoading ? '가입 중...' : '회원가입' }}</span>
          </button>
        </form>

        <!-- 로그인 링크 -->
        <div class="text-center pt-4 border-t border-gray-200">
          <p class="text-sm text-gray-600">
            이미 계정이 있으신가요?
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
import { useRouter } from "vue-router";
import { useErrorHandler } from "@/composables/useErrorHandler";
import { usePost, useGet } from "@/composables/useApi";
import { validateEmail, validatePasswordStrength } from "@/composables/useFormValidation";

const router = useRouter();
const { errorMessage, successMessage, clearMessages, handleError, showSuccess } = useErrorHandler();

const id = ref("");
const pw = ref("");
const confirmPw = ref("");
const email = ref("");
const verificationCode = ref("");
const isLoading = ref(false);
const isSendingCode = ref(false);
const isVerifyingCode = ref(false);
const codeSent = ref(false);
const isEmailVerified = ref(false);
const emailVerificationEnabled = ref(true); // 기본값은 true (기존 동작 유지)

// 폼 검증
const isValidId = computed(() => id.value.length >= 3);
const isValidPassword = computed(() => pw.value.length >= 8);
const isValidEmail = computed(() => {
  return email.value === "" || validateEmail(email.value);
});

const passwordStrengthInfo = computed(() => validatePasswordStrength(pw.value));
const passwordStrength = computed(() => {
  if (!pw.value) return 0;
  const { score } = passwordStrengthInfo.value;
  return Math.min((score / 5) * 100, 100);
});

const passwordStrengthClass = computed(() => {
  const { strength } = passwordStrengthInfo.value;
  if (strength === 'weak') return "bg-red-500";
  if (strength === 'medium') return "bg-yellow-500";
  return "bg-green-500";
});

const passwordStrengthText = computed(() => {
  const { strength } = passwordStrengthInfo.value;
  if (strength === 'weak') return "약함";
  if (strength === 'medium') return "보통";
  return "강함";
});

const isFormValid = computed(() => {
  return isValidId.value && 
         isValidPassword.value && 
         pw.value === confirmPw.value && 
         isValidEmail.value &&
         (!emailVerificationEnabled.value || isEmailVerified.value) &&
         id.value.trim() !== "" &&
         // 이메일 인증이 활성화된 경우에만 이메일 필수, 비활성화된 경우 선택
         (!emailVerificationEnabled.value || email.value.trim() !== "");
});

// 이메일 인증 활성화 여부 확인
const { execute: checkEmailVerificationEnabled } = useGet('/email-verification-enabled', {
  onSuccess: (data) => {
    emailVerificationEnabled.value = data?.enabled ?? true;
  },
  onError: () => {
    // 에러 발생 시 기본값(true) 유지
    emailVerificationEnabled.value = true;
  },
  showError: false
});

// API 호출
const { execute: sendCode, loading: sendingCode } = usePost('/send-verification-code', {
  onSuccess: (data) => {
    showSuccess(data?.message || "인증 코드가 이메일로 전송되었습니다.");
    codeSent.value = true;
    verificationCode.value = "";
  },
  onError: handleError,
});

const { execute: verifyCode, loading: verifyingCode } = usePost('/verify-email-code', {
  onSuccess: (data) => {
    showSuccess(data?.message || "이메일 인증이 완료되었습니다.");
    isEmailVerified.value = true;
  },
  onError: handleError,
});

const { execute: registerUser, loading: registering } = usePost('/register', {
  onSuccess: (data) => {
    showSuccess(data?.message || "회원가입이 완료되었습니다!");
    
    // 성공 메시지 표시 후 폼 초기화 및 로그인 페이지로 이동
    setTimeout(() => {
      id.value = "";
      pw.value = "";
      confirmPw.value = "";
      email.value = "";
      verificationCode.value = "";
      codeSent.value = false;
      isEmailVerified.value = false;
      router.push("/login");
    }, 1500);
  },
  onError: handleError,
});

async function sendVerificationCode() {
  if (!isValidEmail.value) {
    handleError(new Error("올바른 이메일 형식을 입력해주세요."));
    return;
  }

  clearMessages();
  isSendingCode.value = sendingCode.value;
  
  try {
    await sendCode({ email: email.value.trim() });
  } catch (_err) {
    // 에러는 usePost의 onError에서 처리됨
  } finally {
    isSendingCode.value = false;
  }
}

async function verifyEmailCode() {
  if (!verificationCode.value || verificationCode.value.length !== 6) {
    handleError(new Error("6자리 인증 코드를 입력해주세요."));
    return;
  }

  clearMessages();
  isVerifyingCode.value = verifyingCode.value;
  
  try {
    await verifyCode({
      email: email.value.trim(),
      code: verificationCode.value.trim()
    });
  } catch (_err) {
    // 에러는 usePost의 onError에서 처리됨
  } finally {
    isVerifyingCode.value = false;
  }
}

async function register() {
  if (!isFormValid.value) {
    const errorMsg = emailVerificationEnabled.value 
      ? "모든 필드를 올바르게 입력하고 이메일 인증을 완료해주세요."
      : "모든 필드를 올바르게 입력해주세요.";
    handleError(new Error(errorMsg));
    return;
  }

  if (emailVerificationEnabled.value && !isEmailVerified.value) {
    handleError(new Error("이메일 인증을 먼저 완료해주세요."));
    return;
  }

  clearMessages();
  isLoading.value = registering.value;
  
  try {
    await registerUser({
      username: id.value.trim(),
      password: pw.value,
      email: email.value.trim(),
      verification_code: emailVerificationEnabled.value ? verificationCode.value.trim() : ""
    });
  } catch (_err) {
    // 에러는 usePost의 onError에서 처리됨
  } finally {
    isLoading.value = false;
  }
}

// 컴포넌트 마운트 시 이메일 인증 활성화 여부 확인
onMounted(() => {
  checkEmailVerificationEnabled();
});
</script>

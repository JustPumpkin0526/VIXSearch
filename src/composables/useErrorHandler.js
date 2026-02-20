/**
 * 에러 처리 Composable
 * 일관된 에러 메시지 표시
 */
import { ref } from 'vue';

/**
 * 에러 처리 Composable
 * @returns {object} { errorMessage, successMessage, clearMessages, handleError, showSuccess }
 */
export function useErrorHandler() {
  const errorMessage = ref('');
  const successMessage = ref('');
  
  /**
   * 메시지 초기화
   */
  const clearMessages = () => {
    errorMessage.value = '';
    successMessage.value = '';
  };
  
  /**
   * 에러 처리
   * @param {Error} error - 에러 객체
   * @param {string} defaultMessage - 기본 에러 메시지
   */
  const handleError = (error, defaultMessage = '오류가 발생했습니다.') => {
    clearMessages();
    
    if (error?.userMessage) {
      errorMessage.value = error.userMessage;
    } else if (error?.message) {
      errorMessage.value = error.message;
    } else if (typeof error === 'string') {
      errorMessage.value = error;
    } else {
      errorMessage.value = defaultMessage;
    }
  };
  
  /**
   * 성공 메시지 표시
   * @param {string} message - 성공 메시지
   */
  const showSuccess = (message) => {
    clearMessages();
    successMessage.value = message;
  };
  
  /**
   * 에러 메시지 설정
   * @param {string} message - 에러 메시지
   */
  const setError = (message) => {
    clearMessages();
    errorMessage.value = message;
  };
  
  return {
    errorMessage,
    successMessage,
    clearMessages,
    handleError,
    showSuccess,
    setError,
  };
}

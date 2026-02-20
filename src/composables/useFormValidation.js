/**
 * 폼 검증 Composable
 * 공통 폼 검증 로직
 */
import { ref, computed } from 'vue';

/**
 * 폼 검증 Composable
 * @param {object} rules - 검증 규칙
 * @returns {object} { errors, validate, isValid, clearErrors }
 */
export function useFormValidation(rules = {}) {
  const errors = ref({});
  
  /**
   * 에러 초기화
   */
  const clearErrors = () => {
    errors.value = {};
  };
  
  /**
   * 특정 필드 에러 초기화
   * @param {string} field - 필드명
   */
  const clearFieldError = (field) => {
    if (errors.value[field]) {
      delete errors.value[field];
    }
  };
  
  /**
   * 필드 검증
   * @param {string} field - 필드명
   * @param {any} value - 필드 값
   * @returns {boolean} 검증 통과 여부
   */
  const validateField = (field, value) => {
    const rule = rules[field];
    if (!rule) return true;
    
    clearFieldError(field);
    
    // 필수 검증
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors.value[field] = rule.requiredMessage || `${field}는 필수 항목입니다.`;
      return false;
    }
    
    // 최소 길이 검증
    if (rule.minLength && value && value.length < rule.minLength) {
      errors.value[field] = rule.minLengthMessage || `${field}는 최소 ${rule.minLength}자 이상이어야 합니다.`;
      return false;
    }
    
    // 최대 길이 검증
    if (rule.maxLength && value && value.length > rule.maxLength) {
      errors.value[field] = rule.maxLengthMessage || `${field}는 최대 ${rule.maxLength}자까지 입력 가능합니다.`;
      return false;
    }
    
    // 이메일 검증
    if (rule.email && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.value[field] = rule.emailMessage || '올바른 이메일 형식이 아닙니다.';
        return false;
      }
    }
    
    // 커스텀 검증
    if (rule.validator && typeof rule.validator === 'function') {
      const result = rule.validator(value);
      if (result !== true) {
        errors.value[field] = result || `${field} 검증에 실패했습니다.`;
        return false;
      }
    }
    
    return true;
  };
  
  /**
   * 전체 폼 검증
   * @param {object} formData - 폼 데이터
   * @returns {boolean} 검증 통과 여부
   */
  const validate = (formData) => {
    clearErrors();
    let isValid = true;
    
    for (const field in rules) {
      if (!validateField(field, formData[field])) {
        isValid = false;
      }
    }
    
    return isValid;
  };
  
  /**
   * 검증 통과 여부
   */
  const isValid = computed(() => {
    return Object.keys(errors.value).length === 0;
  });
  
  return {
    errors,
    validate,
    validateField,
    isValid,
    clearErrors,
    clearFieldError,
  };
}

/**
 * 이메일 검증
 * @param {string} email - 이메일 주소
 * @returns {boolean}
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 비밀번호 강도 검증
 * @param {string} password - 비밀번호
 * @returns {object} { strength, score, feedback }
 */
export function validatePasswordStrength(password) {
  if (!password) {
    return { strength: 'weak', score: 0, feedback: '' };
  }
  
  let score = 0;
  const feedback = [];
  
  // 길이 검증
  if (password.length >= 8) score += 1;
  else feedback.push('8자 이상');
  
  if (password.length >= 12) score += 1;
  
  // 대문자 포함
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('대문자');
  }
  
  // 소문자 포함
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('소문자');
  }
  
  // 숫자 포함
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('숫자');
  }
  
  // 특수문자 포함
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('특수문자');
  }
  
  let strength = 'weak';
  if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return {
    strength,
    score,
    feedback: feedback.length > 0 ? feedback.join(', ') : '',
  };
}

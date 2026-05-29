"use client";

import React, { useEffect, useRef, useState } from 'react';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterPage() {
  const routerRef = useRef<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('next/router');
        routerRef.current = mod && mod.default ? mod.default : null;
      } catch {
        routerRef.current = null;
      }
    })();
  }, []);

  const { ready, register, error } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const isEmailValid = (emailToCheck: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailToCheck);
  };

  const isFilled = username.trim() !== '' && password.trim() !== '' && isEmailValid(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
      try {
      // require email verification before registering
      if (!verified) {
        setEmailError('이메일 인증이 필요합니다. 인증 후 가입하세요.');
        setLoading(false);
        return;
      }
      await register(username, password, email);
      if (routerRef.current && routerRef.current.router && typeof routerRef.current.replace === 'function') {
        routerRef.current.replace('/');
      } else {
        window.location.replace('/');
      }
    } catch (e) {
      // registration hook sets error
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-700">
          {/* Section 1: Header */}
          <div className="p-4 text-center">
            <h2 className="text-2xl font-bold text-gray-100 tracking-tight">회원가입</h2>
          </div>

          {/* Section 2: Inputs */}
          <div className="p-8">
            <div className="mb-6">
              <label className="block text-base font-medium text-gray-300 mb-2">아이디</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full rounded-lg border border-gray-600 px-5 py-3 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none text-lg"
                required
                placeholder="아이디를 입력하세요"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-300 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border border-gray-600 px-5 py-3 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none text-lg"
                required
                placeholder="비밀번호를 입력하세요"
                autoComplete="new-password"
              />
            </div>

            {/* 이메일 입력과 발송 버튼: 한 줄에 배치, 전체 너비는 기존 입력과 동일 */}
            <div className="mt-6">
              <label className="block text-base font-medium text-gray-300 mb-2">이메일</label>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-600 px-4 py-3 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none text-lg"
                  required
                  placeholder="example@domain.com"
                  autoComplete="email"
                  aria-label="email"
                />
                <button
                  type="button"
                  aria-label="인증 코드 전송"
                  title={verified ? '인증됨' : '인증 코드 전송'}
                  disabled={sending || verified}
                  onClick={async () => {
                    // 이메일 형식 간단 검증
                    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!re.test(email)) {
                      setEmailError('유효한 이메일을 입력하세요');
                      return;
                    }
                    setSending(true);
                    try {
                      const res = await fetch('/api/auth/send-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                      });
                      const data = await res.json();
                      if (res.ok && data.ok) {
                        setSent(true);
                      } else {
                        setEmailError(data.message || '발송 실패');
                      }
                    } catch (e) {
                      setEmailError('네트워크 오류');
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60 flex items-center justify-center"
                >
                  {sending ? (
                    <span className="w-5 h-5 inline-block border-2 border-t-transparent border-white rounded-full animate-spin" />
                  ) : verified ? (
                    <IconCheck className="w-5 h-5 text-white" />
                  ) : (
                    <IconArrowRight className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
              {emailError && <div className="text-sm text-red-400 mt-2">{emailError}</div>}
            </div>

            {/* 인증번호 입력 섹션 */}
            {sent && !verified && (
              <div className="mt-4">
                <label className="block text-base font-medium text-gray-300 mb-2">인증번호</label>
                <div className="flex gap-2">
                  <input
                    value={verificationCodeInput}
                    onChange={(e) => setVerificationCodeInput(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-600 px-4 py-3 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none text-lg"
                    placeholder="받은 인증번호를 입력하세요"
                    aria-label="verification-code"
                  />
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={async () => {
                      setVerifying(true);
                      try {
                        const res = await fetch('/api/auth/verify-verification', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email, code: verificationCodeInput }),
                        });
                        const data = await res.json();
                        if (res.ok && data.ok) {
                          setVerified(true);
                        } else {
                          setEmailError(data.message || '인증 실패');
                        }
                      } catch (e) {
                        setEmailError('네트워크 오류');
                      } finally {
                        setVerifying(false);
                      }
                    }}
                    className="px-4 py-3 rounded-lg bg-green-600 text-white font-medium disabled:opacity-60"
                  >
                    {verifying ? '확인중...' : '확인'}
                  </button>
                </div>
              </div>
            )}
            {error && <div className="text-base text-red-400 text-center mt-4">{error}</div>}
          </div>

          {/* Section 3: Actions */}
          <div className="p-8">
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || !verified}
                className={`w-full py-3 rounded-lg font-bold text-lg shadow transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  loading
                    ? 'bg-gray-600 text-gray-300'
                    : isFilled
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-gray-300'
                }`}
              >
                {loading ? '계정 생성 중...' : '계정 생성'}
              </button>
              {!verified && (
                <div className="text-center mt-2 text-sm text-yellow-300">이메일 인증이 필요합니다</div>
              )}
              <div className="text-center mt-2 flex items-center justify-center gap-2">
                <span className="text-sm text-gray-300">이미 생성한 계정이 있으신가요?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (routerRef.current && routerRef.current.router && typeof routerRef.current.push === 'function') {
                      routerRef.current.push('/auth/login');
                    } else {
                      window.location.href = '/auth/login';
                    }
                  }}
                  className="text-sm text-blue-400 hover:underline"
                >
                  로그인
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

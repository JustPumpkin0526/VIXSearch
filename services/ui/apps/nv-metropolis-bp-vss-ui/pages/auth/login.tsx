'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthContext } from '../../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { setError, login, error } = useAuthContext();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isFilled = username.trim() !== '' && password.trim() !== '';

  const handleSubmit = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();
  
    if (!isFilled || loading) {
      return;
    }
  
    setError('');
    setLoading(true);
  
    try {
      await login(
        username,
        password,
      );
    
      await router.replace('/');
    } catch {
      /*
       * useAuth의 login 함수가 사용자용
       * 오류 문구를 설정합니다.
       */
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-700">
          {/* Section 1: Header */}
          <div className="p-4 text-center">
            <h2 className="text-2xl font-bold text-gray-100 tracking-tight">VIXSearch</h2>
          </div>

          {/* Section 2: Inputs (아이디, 비밀번호) */}
          <div className="p-8">
            <div className="mb-6">
              <label className="block text-base font-medium text-gray-300 mb-2">아이디</label>
              <input
                value={username}
                onChange={(e) => {setUsername(e.target.value);
                  if (error) {
                    setError('');
                  }
                }}
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
                onChange={(e) => {setPassword(e.target.value);
                  if (error) {
                    setError('');
                  }
                }}
                className="block w-full rounded-lg border border-gray-600 px-5 py-3 bg-gray-700 text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none text-lg"
                required
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
              />
            </div>
            {error && <div className="text-base text-red-400 text-center mt-4">{error}</div>}
          </div>

          {/* Section 3: Actions (로그인 버튼, 회원가입 텍스트) */}
          <div className="p-8">
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold text-lg shadow transition-colors ${
                  loading
                    ? 'opacity-60 cursor-not-allowed bg-gray-600 text-gray-300'
                    : isFilled
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <div className="text-center mt-2 flex items-center justify-center gap-2">
                <p className="text-sm text-gray-400">
                  계정은 관리자에 의해 생성됩니다.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

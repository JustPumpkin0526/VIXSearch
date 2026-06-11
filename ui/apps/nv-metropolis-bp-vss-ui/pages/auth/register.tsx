"use client";

import React, { useEffect, useRef, useState } from 'react';
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
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isFilled = username.trim() !== '' && password.trim() !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(username, password);
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
            {error && <div className="text-base text-red-400 text-center mt-4">{error}</div>}
          </div>

          {/* Section 3: Actions */}
          <div className="p-8">
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || !isFilled}
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

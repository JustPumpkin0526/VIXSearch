"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
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

  const { ready, login, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
      try {
        await login(username, password);
        if (routerRef.current && routerRef.current.router && typeof routerRef.current.replace === 'function') {
          routerRef.current.replace('/');
        } else {
          window.location.replace('/');
        }
    } catch (e) {
      // login hook sets error; remain on page
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
                className="w-full py-3 rounded-lg btn-primary font-bold text-lg shadow disabled:opacity-60 transition-colors"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
              <div className="text-center mt-2 flex items-center justify-center gap-2">
                <span className="text-sm text-gray-300">계정이 없으신가요?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (routerRef.current && routerRef.current.router && typeof routerRef.current.push === 'function') {
                      routerRef.current.push('/auth/register');
                    } else {
                      window.location.href = '/auth/register';
                    }
                  }}
                  className="text-sm text-blue-400 hover:underline"
                >
                  회원가입
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

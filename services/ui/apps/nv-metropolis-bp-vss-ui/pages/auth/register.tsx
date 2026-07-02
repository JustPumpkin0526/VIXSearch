"use client";

import React from 'react';

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-semibold">회원가입 비활성화</h1>

        <p className="mt-4 text-sm text-gray-400">
          VIXSearch 계정은 관리자 메뉴에서 생성됩니다.
        </p>

        <button
          type="button"
          onClick={() => {
            window.location.href = '/auth/login';
          }}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          로그인 화면으로 이동
        </button>
      </div>
    </main>
  );
}
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { IconUser, IconX } from '@tabler/icons-react';
import { useAuthContext } from '../contexts/AuthContext';

export default function HeaderLogin() {
  const { ready, isAuthenticated, user, logout } = useAuthContext();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;

      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('click', onDocClick);

    return () => {
      document.removeEventListener('click', onDocClick);
    };
  }, []);

  // ESC 키로 프로필 팝업 닫기
  useEffect(() => {
    if (!profileOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  const handleLogout = () => {
    logout();
    window.location.replace('/auth/login');
  };

  if (!ready || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <div
        className="relative"
        ref={containerRef}
      >
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          className="flex items-center gap-2 rounded-md px-3 py-1 text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
          aria-label="Profile"
          aria-expanded={open}
        >
          <IconUser size={18} />
          
          <span className="hidden text-sm sm:inline">
            {user?.username ?? 'User'}
          </span>
        </button>

        {isAuthenticated && open && (
          <div className="absolute right-0 z-50 mt-2 w-40 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <ul className="py-1">
              <li>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700"
                  onClick={() => {
                    setOpen(false);
                    setProfileOpen(true);
                  }}
                >
                  My Profile
                </button>
              </li>

              <li>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                >
                  Logout
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {isAuthenticated && profileOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-dialog-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setProfileOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <IconUser size={22} />

                <h2
                  id="profile-dialog-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  My Profile
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Close profile"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Username
                </div>

                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {user?.username ?? '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
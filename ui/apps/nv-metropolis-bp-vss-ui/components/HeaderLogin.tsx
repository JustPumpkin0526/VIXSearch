'use client';

import React, { useEffect, useRef, useState } from 'react';
import { IconUser } from '@tabler/icons-react';
import { useAuth } from '../hooks/useAuth';

export default function HeaderLogin() {
  const { ready, isAuthenticated, user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Use dedicated login page instead of prompt to avoid exposing credentials

  const handleLogout = () => {
    logout();
    // ensure navigation to login
    window.location.replace('/auth/login');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          if (isAuthenticated) {
            setOpen((v) => !v);
          } else {
            // navigate to full login page (masked password input)
            setOpen(false);
            window.location.href = '/auth/login';
          }
        }}
        className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label={isAuthenticated ? 'Profile' : 'Login'}
      >
        {isAuthenticated ? (
          <>
            <IconUser size={18} />
            <span className="hidden sm:inline text-sm">{user?.username ?? 'User'}</span>
          </>
        ) : (
          <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span>Login</span>
            <span>Registry</span>
          </div>
        )}
      </button>

      {isAuthenticated && open && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
          <ul className="py-1">
            <li>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setOpen(false);
                  window.location.href = '/profile';
                }}
              >
                My Profile
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setOpen(false);
                  window.location.href = '/settings';
                }}
              >
                Settings
              </button>
            </li>
            <li>
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
  );
}

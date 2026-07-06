// SPDX-License-Identifier: MIT

import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';

import { APPLICATION_TITLE } from '../constants/constants';
import { useAuth } from '../hooks/useAuth';

import '../styles/globals.css';
import 'rsuite/dist/rsuite.min.css';
import '../styles/rsuite-custom.css';

function App({ Component, pageProps }: AppProps<{}>) {
  const queryClient = new QueryClient();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let refreshPromise: Promise<any | null> | null = null;
    
    const clearAuthAndRedirect = () => {
      window.localStorage.removeItem('vss.auth.token');
      window.localStorage.removeItem('vss.auth.user');
      window.localStorage.removeItem('vss.auth.exp');
    
      if (
        window.location.pathname !== '/auth/login' &&
        !window.location.pathname.startsWith('/auth')
      ) {
        window.location.replace('/auth/login?reason=expired');
      }
    };
  
    const refreshToken = async () => {
      if (!refreshPromise) {
        refreshPromise = originalFetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
          .then(async (response) => {
            if (!response.ok) {
              return null;
            }
          
            return response.json();
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
    
      return refreshPromise;
    };
  
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = window.localStorage.getItem('vss.auth.token');
      
        const target =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
      
        const shouldAttachAuth =
          target.startsWith('/api/') ||
          target.includes('/api/v1/') ||
          target.includes(':8000') ||
          target.includes(':30888');
      
        const isAuthEndpoint =
          target.includes('/api/auth/login') ||
          target.includes('/api/auth/register') ||
          target.includes('/api/auth/refresh') ||
          target.includes('/api/auth/logout');
      
        if (!shouldAttachAuth || isAuthEndpoint) {
          return originalFetch(input, init);
        }
      
        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
      
        if (token && !headers.get('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      
        const nextInit: RequestInit = {
          ...(init || {}),
          headers,
        };
      
        const response = await originalFetch(input, nextInit);
      
        if (response.status !== 401) {
          return response;
        }
      
        const refreshed = await refreshToken();
      
        if (!refreshed?.token) {
          clearAuthAndRedirect();
          return response;
        }
      
        window.localStorage.setItem('vss.auth.token', refreshed.token);
        window.localStorage.setItem(
          'vss.auth.user',
          JSON.stringify(refreshed.user),
        );
        window.localStorage.setItem(
          'vss.auth.exp',
          String(refreshed.expiresAt),
        );
      
        const retryHeaders = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
      
        retryHeaders.set('Authorization', `Bearer ${refreshed.token}`);
      
        const retryInit: RequestInit = {
          ...(init || {}),
          headers: retryHeaders,
        };
      
        return originalFetch(input, retryInit);
      } catch {
        return originalFetch(input, init);
      }
    };
  
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const { ready, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!ready) return;

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthPath = path.startsWith('/auth');

    if (!isAuthenticated && !isAuthPath) {
      (async () => {
        try {
          const mod = await import('next/router');
          if (
            mod &&
            mod.default &&
            typeof mod.default.replace === 'function'
          ) {
            mod.default.replace('/auth/login');
            return;
          }
        } catch {
          // fall through to hard redirect
        }

        window.location.replace('/auth/login');
      })();
    }
  }, [ready, isAuthenticated]);

  return (
    <>
      <Head>
        <title>{APPLICATION_TITLE}</title>
      </Head>

      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>

      <Toaster position="top-right" />
    </>
  );
}

export default appWithTranslation(App);
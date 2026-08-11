// SPDX-License-Identifier: MIT

import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';

import { APPLICATION_TITLE } from '../constants/constants';
import { getOrCreateClientInstanceId } from '@aiqtoolkit-ui/common';
import { AuthProvider, useAuthContext } from '../contexts/AuthContext';

import '../styles/globals.css';
import 'rsuite/dist/rsuite.min.css';
import '../styles/rsuite-custom.css';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated } = useAuthContext();

  useEffect(() => {
    if (!ready) return;

    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthPath = path.startsWith('/auth');

    if (!isAuthenticated && !isAuthPath) {
      window.location.replace('/auth/login');
    }
  }, [ready, isAuthenticated]);

  return <>{children}</>;
}

const queryClient = new QueryClient();

function App({ Component, pageProps }: AppProps<{}>) {

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
  
    const saveAuth = (refreshed: any) => {
      window.localStorage.setItem('vss.auth.token', refreshed.token);
      window.localStorage.setItem(
        'vss.auth.user',
        JSON.stringify(refreshed.user),
      );
      window.localStorage.setItem(
        'vss.auth.exp',
        String(refreshed.expiresAt),
      );
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
  
    const getTarget = (input: RequestInfo | URL): string => {
      if (typeof input === 'string') {
        return input;
      }
    
      if (input instanceof URL) {
        return input.toString();
      }
    
      return input.url;
    };
  
    const getMethod = (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): string => {
      return (
        init?.method ||
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
    };
  
    const isAuthEndpoint = (target: string) => {
      return (
        target.includes('/api/auth/login') ||
        target.includes('/api/auth/register') ||
        target.includes('/api/auth/refresh') ||
        target.includes('/api/auth/logout')
      );
    };
  
    const shouldAttachAuth = (target: string) => {
      return (
        target.startsWith('/api/') ||
        target.includes('/api/v1/') ||
        target.includes(':8000') ||
        target.includes(':30888')
      );
    };
  
    const isSafeRetryMethod = (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const method = getMethod(input, init);
    
      return method === 'GET' || method === 'HEAD';
    };
  
    const isNonRetryableRequest = (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const method = getMethod(input, init);
      const target = getTarget(input);
    
      const isUploadComplete =
        method === 'POST' &&
        /\/api\/v1\/videos\/[^/]+\/complete/.test(target);
    
      const isVstChunkUpload =
        method === 'POST' &&
        target.includes('/vst/api/v1/storage/file');
    
      const isDeleteRequest = method === 'DELETE';
    
      if (isUploadComplete || isVstChunkUpload || isDeleteRequest) {
        return true;
      }
    
      return !isSafeRetryMethod(input, init);
    };
  
    const isTokenExpiringSoon = () => {
      const expRaw = window.localStorage.getItem('vss.auth.exp');
    
      if (!expRaw) {
        return false;
      }
    
      const exp = Number(expRaw);
    
      if (!Number.isFinite(exp)) {
        return false;
      }
    
      // expiresAt이 초 단위인지 ms 단위인지 모두 대응
      const expMs = exp < 10_000_000_000 ? exp * 1000 : exp;
    
      // 만료 60초 전이면 미리 refresh
      return expMs <= Date.now() + 60_000;
    };
  
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = getTarget(input);
    
      // ensure client id exists per browser tab and attach it
      try {
        const clientId = getOrCreateClientInstanceId();
        // expose globally for other scripts
        // @ts-ignore
        window.__VSS_CLIENT_ID = clientId;
      } catch (e) {
        // ignore
      }

      if (!shouldAttachAuth(target) || isAuthEndpoint(target)) {
        return originalFetch(input, init);
      }
    
      try {
        let token = window.localStorage.getItem('vss.auth.token');
      
        /*
         * 중요:
         * POST /complete 같은 비멱등 요청을 보낸 뒤 401 retry를 하지 않도록,
         * 요청을 보내기 전에 토큰이 곧 만료될 것 같으면 먼저 refresh합니다.
         */
        if (token && isTokenExpiringSoon()) {
          const refreshed = await refreshToken();
        
          if (refreshed?.token) {
            saveAuth(refreshed);
            token = refreshed.token;
          } else {
            clearAuthAndRedirect();
          }
        }
      
        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
        try {
          // attach client id header for per-tab counting
          // prefer existing session-scoped id if available
          const clientId = (window as any).__VSS_CLIENT_ID || window.sessionStorage.getItem('vss.client.tab_id');
          if (clientId && !headers.get('X-Client-Id')) headers.set('X-Client-Id', String(clientId));
        } catch {}
      
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
      
        saveAuth(refreshed);
      
        /*
         * 핵심 수정:
         * 토큰은 갱신하되, POST/PUT/PATCH/DELETE 요청은 자동 retry하지 않습니다.
         * 특히 POST /api/v1/videos/{sensor_id}/complete 자동 retry를 막아야
         * vss-rt-embed ResourceInUse를 방지할 수 있습니다.
         */
        if (isNonRetryableRequest(input, init)) {
          console.warn(
            '[auth] Token refreshed, but original request was not retried because it is non-retryable:',
            getMethod(input, init),
            target,
          );
        
          return response;
        }
      
        const retryHeaders = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );
      
        retryHeaders.set('Authorization', `Bearer ${refreshed.token}`);
      
        const retryInit: RequestInit = {
          ...(init || {}),
          headers: retryHeaders,
        };
      
        return originalFetch(input, retryInit);
      } catch (error) {
        /*
         * 기존 코드의 `return originalFetch(input, init)`는 위험합니다.
         * 이미 한 번 전송된 POST 요청이 네트워크 오류 등으로 다시 실행될 수 있습니다.
         * 따라서 여기서는 원요청을 재실행하지 않고 에러를 그대로 올립니다.
         */
        console.error('[auth] fetch wrapper failed:', error);
        throw error;
      }
    };
  
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <>
      <Head>
        <title>{APPLICATION_TITLE}</title>
      </Head>

      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate>
            <Component {...pageProps} />
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>

      <Toaster position="top-right" />
    </>
  );
}

export default appWithTranslation(App);
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

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = window.localStorage.getItem('vss.auth.token');

        if (!token) {
          return originalFetch(input, init);
        }

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

        if (!shouldAttachAuth) {
          return originalFetch(input, init);
        }

        const headers = new Headers(
          init?.headers || (input instanceof Request ? input.headers : undefined),
        );

        if (!headers.get('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const nextInit: RequestInit = {
          ...(init || {}),
          headers,
        };

        return originalFetch(input, nextInit);
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
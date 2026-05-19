// SPDX-License-Identifier: MIT
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';

import '../styles/globals.css';
import 'rsuite/dist/rsuite.min.css';
import '../styles/rsuite-custom.css';

const inter = Inter({ subsets: ['latin'] });

function App({ Component, pageProps }: AppProps) {
  const queryClient = new QueryClient();

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = window.localStorage.getItem('vss.auth.token');
        if (!token) {
          return originalFetch(input, init);
        }

        const target = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const shouldAttachAuth =
          target.startsWith('/api/') || target.includes('/api/v1/') || target.includes(':8000') || target.includes(':30888');

        if (!shouldAttachAuth) {
          return originalFetch(input, init);
        }

        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.get('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        const nextInit: RequestInit = { ...(init || {}), headers };
        return originalFetch(input, nextInit);
      } catch {
        return originalFetch(input, init);
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className={inter.className}>
      <Toaster
        toastOptions={{
          style: {
            maxWidth: 500,
            wordBreak: 'break-all',
          },
        }}
      />
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </div>
  );
}

export default appWithTranslation(App);
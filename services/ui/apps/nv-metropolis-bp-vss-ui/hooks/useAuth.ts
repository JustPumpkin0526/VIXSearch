import { useCallback, useEffect, useMemo, useState } from 'react';

export type UserRole = 'admin' | 'user';

export type AuthUser = {
  username: string;
  role: UserRole;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
  expiresAt: number;
};

type ErrorPayload = {
  error?: string;
};

const TOKEN_KEY = 'vss.auth.token';
const USER_KEY = 'vss.auth.user';
const EXP_KEY = 'vss.auth.exp';

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

let sharedRefreshPromise: Promise<AuthResponse | null> | null = null;
async function refreshAccessToken(): Promise<AuthResponse | null> {
  if (sharedRefreshPromise) {
    return sharedRefreshPromise;
  }

  sharedRefreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      const payload = await parseApiPayload(response);

      if (!response.ok) {
        return null;
      }

      return payload as AuthResponse;
    } catch {
      return null;
    } finally {
      sharedRefreshPromise = null;
    }
  })();

  return sharedRefreshPromise;
}

async function parseApiPayload(response: Response): Promise<AuthResponse | ErrorPayload | null> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as AuthResponse | ErrorPayload;
    } catch {
      return null;
    }
  }

  const text = await response.text();
  if (!text) return null;
  return { error: text };
}

function extractError(payload: AuthResponse | ErrorPayload | null, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return fallback;
}

export function useAuth() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    
    const initializeAuth = async () => {
      const storedToken = window.localStorage.getItem(TOKEN_KEY) || '';
      const storedUser = safeJsonParse<AuthUser>(
        window.localStorage.getItem(USER_KEY),
      );
      const expRaw = window.localStorage.getItem(EXP_KEY);
      const exp = expRaw ? Number(expRaw) : 0;
      const now = Math.floor(Date.now() / 1000);
    
      if (storedToken && storedUser && exp > now + 30) {
        if (!cancelled) {
          setToken(storedToken);
          setUser(storedUser);
          setReady(true);
        }
      
        return;
      }
    
      const refreshed = await refreshAccessToken();
    
      if (cancelled) {
        return;
      }
    
      if (refreshed) {
        setToken(refreshed.token);
        setUser(refreshed.user);
        setError('');
      
        window.localStorage.setItem(TOKEN_KEY, refreshed.token);
        window.localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
        window.localStorage.setItem(EXP_KEY, String(refreshed.expiresAt));
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(EXP_KEY);
      
        setToken('');
        setUser(null);
      }
    
      setReady(true);
    };
  
    initializeAuth();
  
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((resp: AuthResponse) => {
    setToken(resp.token);
    setUser(resp.user);
    setError('');
    window.localStorage.setItem(TOKEN_KEY, resp.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
    window.localStorage.setItem(EXP_KEY, String(resp.expiresAt));
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const payload = await parseApiPayload(response);
    if (!response.ok) {
      const msg = extractError(payload, 'Registration failed');
      setError(msg);
      throw new Error(msg);
    }
    persist(payload as AuthResponse);
  }, [persist]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const payload = await parseApiPayload(response);
    if (!response.ok) {
      const msg = extractError(payload, 'Login failed');
      setError(msg);
      throw new Error(msg);
    }
    persist(payload as AuthResponse);
  }, [persist]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
  
    setToken('');
    setUser(null);
    setError('');
  
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(EXP_KEY);
  }, []);

  useEffect(() => {
    if (!ready || !token || !user) {
      return;
    }
  
    const timer = window.setInterval(async () => {
      const expRaw = window.localStorage.getItem(EXP_KEY);
      const exp = expRaw ? Number(expRaw) : 0;
      const now = Math.floor(Date.now() / 1000);
    
      if (!exp || exp > now + 120) {
        return;
      }
    
      const refreshed = await refreshAccessToken();
    
      if (refreshed) {
        setToken(refreshed.token);
        setUser(refreshed.user);
        setError('');
      
        window.localStorage.setItem(TOKEN_KEY, refreshed.token);
        window.localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));
        window.localStorage.setItem(EXP_KEY, String(refreshed.expiresAt));
      } else {
        setToken('');
        setUser(null);
        setError('Session expired. Please log in again.');
      
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(EXP_KEY);
      }
    }, 60 * 1000);
  
    return () => {
      window.clearInterval(timer);
    };
  }, [ready, token, user]);

  const isAuthenticated = useMemo(() => !!token && !!user, [token, user]);

  return {
    ready,
    isAuthenticated,
    token,
    user,
    error,
    setError,
    register,
    login,
    logout,
  };
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextValue, AuthState, AuthTokenPair } from './types';
import { clearTokens, loadTokens, storeTokens } from './tokenStorage';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const tokensRef = useRef<AuthTokenPair | null>(null);

  useEffect(() => {
    loadTokens().then((stored) => {
      if (stored && new Date(stored.expiresAt) > new Date()) {
        tokensRef.current = stored;
        setState({ status: 'authenticated', tokens: stored });
      } else {
        if (stored) clearTokens();
        setState({ status: 'unauthenticated' });
      }
    });
  }, []);

  const signIn = useCallback(async (tokens: AuthTokenPair) => {
    await storeTokens(tokens);
    tokensRef.current = tokens;
    setState({ status: 'authenticated', tokens });
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    tokensRef.current = null;
    setState({ status: 'unauthenticated' });
  }, []);

  const getAccessToken = useCallback(() => {
    return tokensRef.current?.accessToken ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, getAccessToken }),
    [state, signIn, signOut, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

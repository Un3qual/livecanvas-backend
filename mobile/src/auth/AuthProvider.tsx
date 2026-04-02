import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextValue, AuthState, AuthTokenPair } from './types';
import { clearTokens, loadTokens, storeTokens } from './tokenStorage';
import { resolveAuthBootstrapState } from './authBootstrap';

const AuthContext = createContext<AuthContextValue | null>(null);

function sameTokenPair(left: AuthTokenPair, right: AuthTokenPair): boolean {
  return (
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken &&
    left.expiresAt === right.expiresAt
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const tokensRef = useRef<AuthTokenPair | null>(null);

  const syncTokens = useCallback((tokens: AuthTokenPair) => {
    tokensRef.current = tokens;
    setState((current) => {
      if (current.status === 'authenticated' && sameTokenPair(current.tokens, tokens)) {
        return current;
      }

      return { status: 'authenticated', tokens };
    });
  }, []);

  const onForcedLogout = useCallback(() => {
    tokensRef.current = null;
    setState({ status: 'unauthenticated' });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void resolveAuthBootstrapState(loadTokens).then((nextState) => {
      if (cancelled) return;

      setState((current) => {
        if (current.status !== 'loading') {
          return current;
        }

        if (nextState.status === 'authenticated') {
          tokensRef.current = nextState.tokens;
          return { status: 'authenticated', tokens: nextState.tokens };
        }

        tokensRef.current = null;
        return { status: 'unauthenticated' };
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (tokens: AuthTokenPair) => {
    await storeTokens(tokens);
    syncTokens(tokens);
  }, [syncTokens]);

  const signOut = useCallback(async () => {
    await clearTokens();
    onForcedLogout();
  }, [onForcedLogout]);

  const getAccessToken = useCallback(() => {
    return tokensRef.current?.accessToken ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, syncTokens, onForcedLogout, getAccessToken }),
    [state, signIn, signOut, syncTokens, onForcedLogout, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

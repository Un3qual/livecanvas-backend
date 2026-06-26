import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AuthContextValue,
  AuthState,
  AuthTokenPair,
  BeforeUnauthenticatedCallback,
} from './types';
import { clearTokens, loadTokens, storeTokens } from './tokenStorage';
import { resolveAuthBootstrapState } from './authBootstrap';
import {
  forceUnauthenticated,
  runBestEffortBeforeUnauthenticatedCallback,
  shouldApplyBootstrapState,
} from './authProviderLifecycle';

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

export function AuthProvider({
  apiBaseUrl,
  children,
}: {
  apiBaseUrl: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const stateRef = useRef<AuthState>(state);
  const bootstrapRanRef = useRef(false);
  const tokensRef = useRef<AuthTokenPair | null>(null);
  const beforeUnauthenticatedCallbacksRef = useRef(
    new Set<BeforeUnauthenticatedCallback>(),
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const commitAuthenticatedTokens = useCallback((tokens: AuthTokenPair) => {
    tokensRef.current = tokens;
    stateRef.current = { status: 'authenticated', tokens };
    setState((current) => {
      if (current.status === 'authenticated' && sameTokenPair(current.tokens, tokens)) {
        return current;
      }

      return { status: 'authenticated', tokens };
    });
  }, []);

  const commitUnauthenticated = useCallback(() => {
    tokensRef.current = null;
    stateRef.current = { status: 'unauthenticated' };
    setState({ status: 'unauthenticated' });
  }, []);

  const syncTokens = useCallback((tokens: AuthTokenPair) => {
    bootstrapRanRef.current = true;
    commitAuthenticatedTokens(tokens);
  }, [commitAuthenticatedTokens]);

  const registerBeforeUnauthenticated = useCallback(
    (callback: BeforeUnauthenticatedCallback) => {
      beforeUnauthenticatedCallbacksRef.current.add(callback);
      return () => {
        beforeUnauthenticatedCallbacksRef.current.delete(callback);
      };
    },
    [],
  );

  const runBeforeUnauthenticatedCallbacks = useCallback(async () => {
    for (const callback of Array.from(beforeUnauthenticatedCallbacksRef.current)) {
      try {
        await runBestEffortBeforeUnauthenticatedCallback(callback);
      } catch {
        // Keep local auth teardown independent from best-effort session cleanup.
      }
    }
  }, []);

  const onForcedLogout = useCallback(async () => {
    bootstrapRanRef.current = true;
    await runBeforeUnauthenticatedCallbacks();
    commitUnauthenticated();
  }, [commitUnauthenticated, runBeforeUnauthenticatedCallbacks]);

  useEffect(() => {
    let cancelled = false;

    void resolveAuthBootstrapState({
      apiBaseUrl,
      readTokens: loadTokens,
      storeTokens,
      clearTokens,
    }).then((nextState) => {
      if (cancelled || !shouldApplyBootstrapState(stateRef.current, bootstrapRanRef.current)) {
        return;
      }

      bootstrapRanRef.current = true;

      if (nextState.status === 'authenticated') {
        commitAuthenticatedTokens(nextState.tokens);
        return;
      }

      commitUnauthenticated();
    });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, commitAuthenticatedTokens, commitUnauthenticated]);

  const signIn = useCallback(async (tokens: AuthTokenPair) => {
    bootstrapRanRef.current = true;

    try {
      await storeTokens(tokens);
    } catch (error) {
      commitUnauthenticated();
      throw error;
    }

    commitAuthenticatedTokens(tokens);
  }, [commitAuthenticatedTokens, commitUnauthenticated]);

  const signOut = useCallback(async () => {
    bootstrapRanRef.current = true;
    await forceUnauthenticated(
      clearTokens,
      commitUnauthenticated,
      runBeforeUnauthenticatedCallbacks,
    );
  }, [commitUnauthenticated, runBeforeUnauthenticatedCallbacks]);

  const getAuthStatus = useCallback(() => {
    return stateRef.current.status;
  }, []);

  const getAccessToken = useCallback(() => {
    return tokensRef.current?.accessToken ?? null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      syncTokens,
      onForcedLogout,
      registerBeforeUnauthenticated,
      getAuthStatus,
      getAccessToken,
    }),
    [
      state,
      signIn,
      signOut,
      syncTokens,
      onForcedLogout,
      registerBeforeUnauthenticated,
      getAuthStatus,
      getAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

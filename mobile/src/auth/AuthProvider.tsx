import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextValue, AuthState, AuthTokenPair } from './types';
import { createAuthSubmissionGate } from './authSubmissionGate';
import { clearTokens, loadTokens, storeTokens } from './tokenStorage';
import { resolveAuthBootstrapState } from './authBootstrap';
import { forceUnauthenticated, shouldApplyBootstrapState } from './authProviderLifecycle';

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
  const stateRef = useRef<AuthState>(state);
  const bootstrapRanRef = useRef(false);
  const tokensRef = useRef<AuthTokenPair | null>(null);
  const authSubmissionGateRef = useRef(createAuthSubmissionGate());

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

  const onForcedLogout = useCallback(() => {
    bootstrapRanRef.current = true;
    commitUnauthenticated();
  }, [commitUnauthenticated]);

  useEffect(() => {
    let cancelled = false;

    void resolveAuthBootstrapState(loadTokens).then((nextState) => {
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
  }, [commitAuthenticatedTokens, commitUnauthenticated]);

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
    await forceUnauthenticated(clearTokens, commitUnauthenticated);
  }, [commitUnauthenticated]);

  const getAuthStatus = useCallback(() => {
    return stateRef.current.status;
  }, []);

  const getAccessToken = useCallback(() => {
    return tokensRef.current?.accessToken ?? null;
  }, []);

  const beginAuthSubmission = useCallback(() => {
    return authSubmissionGateRef.current.begin();
  }, []);

  const endAuthSubmission = useCallback(() => {
    authSubmissionGateRef.current.end();
  }, []);

  const isAuthSubmissionActive = useCallback(() => {
    return authSubmissionGateRef.current.isActive();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      syncTokens,
      onForcedLogout,
      getAuthStatus,
      getAccessToken,
      beginAuthSubmission,
      endAuthSubmission,
      isAuthSubmissionActive,
    }),
    [
      state,
      signIn,
      signOut,
      syncTokens,
      onForcedLogout,
      getAuthStatus,
      getAccessToken,
      beginAuthSubmission,
      endAuthSubmission,
      isAuthSubmissionActive,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

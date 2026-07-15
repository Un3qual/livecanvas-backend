import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenState } from '../../components/ScreenState';
import { useStartupState } from '../../providers/StartupGate';
import { useAuth } from '../AuthProvider';
import {
  redeemMagicLinkAuthMutation,
  type AuthMutationResult,
} from '../authMutationClient';
import type { AuthTokenPair } from '../types';
import {
  clearMagicLinkHandoff,
  withMagicLinkHandoff,
} from './magicLinkHandoff';
import type { MagicLinkPayload } from './magicLinkLink';
import {
  isDefinitiveMagicLinkRejection,
  readMagicLinkHandoffParam,
} from './magicLinkState';

type MagicLinkScreenStatus =
  | 'checking'
  | 'redeeming'
  | 'invalid'
  | 'retryable_error';

type ActiveAttempt = {
  readonly handoffId: string | null;
  readonly id: number;
};

type RedemptionOutcome =
  | { readonly status: 'invalid' }
  | { readonly status: 'retryable_error' }
  | { readonly status: 'tokens'; readonly tokens: AuthTokenPair };

type PendingTokens = {
  readonly handoffId: string;
  readonly tokens: AuthTokenPair;
};

export function MagicLinkScreen() {
  const { handoff: rawHandoffId } = useLocalSearchParams<{
    handoff?: string | string[];
  }>();
  const handoffId = readMagicLinkHandoffParam(rawHandoffId);
  const { environment } = useStartupState();
  const { signIn, state: authState } = useAuth();
  const { replace } = useRouter();
  const [status, setStatus] =
    useState<MagicLinkScreenStatus>('checking');
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const attemptSequenceRef = useRef(0);
  const pendingTokensRef = useRef<PendingTokens | null>(null);
  const previousHandoffIdRef = useRef(handoffId);

  const isCurrentAttempt = useCallback((attempt: ActiveAttempt) => {
    const current = activeAttemptRef.current;
    return current?.id === attempt.id && current.handoffId === attempt.handoffId;
  }, []);

  const finishAttempt = useCallback(
    (attempt: ActiveAttempt) => {
      if (isCurrentAttempt(attempt)) {
        activeAttemptRef.current = null;
      }
    },
    [isCurrentAttempt],
  );

  const clearBestEffort = useCallback((matchingHandoffId: string) => {
    return clearMagicLinkHandoff(matchingHandoffId).catch(() => false);
  }, []);

  const persistAndEnterSession = useCallback(
    async (attempt: ActiveAttempt, tokens: AuthTokenPair) => {
      if (!attempt.handoffId || !isCurrentAttempt(attempt)) {
        return;
      }

      pendingTokensRef.current = { handoffId: attempt.handoffId, tokens };

      try {
        await signIn(tokens);
      } catch {
        if (isCurrentAttempt(attempt)) {
          setStatus('retryable_error');
          finishAttempt(attempt);
        }
        return;
      }

      if (!isCurrentAttempt(attempt)) {
        return;
      }

      pendingTokensRef.current = null;
      await clearBestEffort(attempt.handoffId);

      if (isCurrentAttempt(attempt)) {
        finishAttempt(attempt);
        replace('/home');
      }
    },
    [clearBestEffort, finishAttempt, isCurrentAttempt, replace, signIn],
  );

  const redeemPayload = useCallback(
    async (payload: MagicLinkPayload): Promise<RedemptionOutcome> => {
      const result: AuthMutationResult = await redeemMagicLinkAuthMutation({
        apiBaseUrl: environment.apiBaseUrl,
        mode: payload.purpose,
        token: payload.token,
      });

      if (result.ok) {
        return { status: 'tokens', tokens: result.tokens };
      }

      return isDefinitiveMagicLinkRejection(result.errors)
        ? { status: 'invalid' }
        : { status: 'retryable_error' };
    },
    [environment.apiBaseUrl],
  );

  const beginAttempt = useCallback(() => {
    if (activeAttemptRef.current || authState.status === 'loading') {
      return;
    }

    const attempt: ActiveAttempt = {
      handoffId,
      id: ++attemptSequenceRef.current,
    };
    activeAttemptRef.current = attempt;

    if (authState.status === 'authenticated') {
      const cleanup = handoffId
        ? clearBestEffort(handoffId)
        : Promise.resolve(false);

      cleanup.finally(() => {
        if (isCurrentAttempt(attempt)) {
          finishAttempt(attempt);
          replace('/home');
        }
      });
      return;
    }

    if (!handoffId) {
      setStatus('invalid');
      finishAttempt(attempt);
      return;
    }

    setStatus('redeeming');
    const pendingTokens = pendingTokensRef.current;

    if (pendingTokens?.handoffId === handoffId) {
      void persistAndEnterSession(attempt, pendingTokens.tokens);
      return;
    }

    withMagicLinkHandoff(handoffId, redeemPayload)
      .then((result) => {
        if (!isCurrentAttempt(attempt)) {
          return;
        }

        if (result.status !== 'matched') {
          setStatus('invalid');
          finishAttempt(attempt);
          return;
        }

        if (result.value.status === 'tokens') {
          void persistAndEnterSession(attempt, result.value.tokens);
          return;
        }

        setStatus(result.value.status);
        finishAttempt(attempt);

        if (result.value.status === 'invalid') {
          void clearBestEffort(handoffId);
        }
      })
      .catch(() => {
        if (isCurrentAttempt(attempt)) {
          setStatus('retryable_error');
          finishAttempt(attempt);
        }
      });
  }, [
    authState.status,
    clearBestEffort,
    finishAttempt,
    handoffId,
    isCurrentAttempt,
    persistAndEnterSession,
    redeemPayload,
    replace,
  ]);

  useEffect(() => {
    if (previousHandoffIdRef.current !== handoffId) {
      previousHandoffIdRef.current = handoffId;
      activeAttemptRef.current = null;
      pendingTokensRef.current = null;
      setStatus('checking');
    }

    beginAttempt();
  }, [beginAttempt, handoffId]);

  useEffect(
    () => () => {
      activeAttemptRef.current = null;
      pendingTokensRef.current = null;
    },
    [],
  );

  switch (status) {
    case 'checking':
      return <ScreenState state="loading" message="Checking this email link..." />;
    case 'redeeming':
      return <ScreenState state="loading" message="Signing you in..." />;
    case 'invalid':
      return (
        <ScreenState
          state="empty"
          message="This email link is invalid or has expired."
          actionLabel="Back to sign in"
          onAction={() => replace('/sign-in')}
        />
      );
    case 'retryable_error':
      return (
        <ScreenState
          state="error"
          message="We could not confirm this email link. Try again."
          onRetry={beginAttempt}
        />
      );
  }
}

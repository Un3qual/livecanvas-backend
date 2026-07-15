import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenState } from '../../components/ScreenState';
import { useStartupState } from '../../providers/StartupGate';
import { useAuth } from '../AuthProvider';
import {
  readAuthReturnToParam,
} from '../../config/runtime';
import {
  redeemMagicLinkAuthMutation,
  type AuthMutationResult,
} from '../authMutationClient';
import type { AuthTokenPair } from '../types';
import {
  clearMagicLinkHandoff,
  withMagicLinkHandoff,
} from './magicLinkHandoff';
import type { MagicLinkHandoffPayload } from './magicLinkHandoffCore';
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
  | {
      readonly status: 'tokens';
      readonly successHref: string;
      readonly tokens: AuthTokenPair;
    };

type PendingTokens = {
  readonly handoffId: string;
  readonly successHref: string;
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
    async (
      attempt: ActiveAttempt,
      tokens: AuthTokenPair,
      successHref: string,
    ) => {
      if (!attempt.handoffId || !isCurrentAttempt(attempt)) {
        return;
      }

      pendingTokensRef.current = {
        handoffId: attempt.handoffId,
        successHref,
        tokens,
      };

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
        replace(successHref);
      }
    },
    [clearBestEffort, finishAttempt, isCurrentAttempt, replace, signIn],
  );

  const redeemPayload = useCallback(
    async (payload: MagicLinkHandoffPayload): Promise<RedemptionOutcome> => {
      const result: AuthMutationResult = await redeemMagicLinkAuthMutation({
        apiBaseUrl: environment.apiBaseUrl,
        mode: payload.purpose,
        token: payload.token,
      });

      if (result.ok) {
        return {
          status: 'tokens',
          successHref: readAuthReturnToParam(payload.returnTo) ?? '/home',
          tokens: result.tokens,
        };
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
      persistAndEnterSession(
        attempt,
        pendingTokens.tokens,
        pendingTokens.successHref,
      ).catch(() => undefined);
      return;
    }

    withMagicLinkHandoff(handoffId, redeemPayload, {
      shouldRetainResult: (outcome) => outcome.status !== 'retryable_error',
    })
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
          persistAndEnterSession(
            attempt,
            result.value.tokens,
            result.value.successHref,
          ).catch(() => undefined);
          return;
        }

        setStatus(result.value.status);
        finishAttempt(attempt);

        if (result.value.status === 'invalid') {
          clearBestEffort(handoffId).catch(() => undefined);
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
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected magic-link screen status: ${String(value)}`);
}

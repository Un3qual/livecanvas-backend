import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from 'react-relay';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { authRouteHref } from '../config/runtime';
import { useAppTheme } from '../providers/ThemeProvider';
import { spacing, typography } from '../theme/tokens';
import {
  clearContactInviteHandoff,
  readContactInviteHandoffStatus,
  withContactInviteToken,
} from './contactInviteHandoff';
import {
  contactInviteConsumeMutation,
  type ContactInviteConsumeMutation,
} from './contactInviteOperations';
import {
  contactInviteStateReducer,
  createContactInviteState,
  readContactInviteHandoffParam,
} from './contactInviteState';

type ActiveAttempt = {
  readonly authStatus: 'authenticated' | 'loading' | 'unauthenticated';
  readonly handoffId: string | null;
  readonly id: number;
};

type ConsumeResult = 'consumed' | 'invalid' | 'requires_auth';

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
  },
});

export function ContactInviteScreen() {
  const { handoff: rawHandoffId } = useLocalSearchParams<{
    handoff?: string | string[];
  }>();
  const handoffId = readContactInviteHandoffParam(rawHandoffId);
  const { state: authState } = useAuth();
  const router = useRouter();
  const theme = useAppTheme();
  const [commitConsume] = useMutation<ContactInviteConsumeMutation>(
    contactInviteConsumeMutation,
  );
  const [state, dispatch] = useReducer(
    contactInviteStateReducer,
    handoffId,
    createContactInviteState,
  );
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const attemptSequenceRef = useRef(0);
  const previousHandoffIdRef = useRef(handoffId);

  const isCurrentAttempt = useCallback((attempt: ActiveAttempt) => {
    const current = activeAttemptRef.current;

    return current?.id === attempt.id && current.handoffId === attempt.handoffId;
  }, []);

  const finishAttempt = useCallback((attempt: ActiveAttempt) => {
    if (isCurrentAttempt(attempt)) {
      activeAttemptRef.current = null;
    }
  }, [isCurrentAttempt]);

  const commitToken = useCallback(
    (token: string) =>
      new Promise<ConsumeResult>((resolve, reject) => {
        commitConsume({
          variables: { input: { token } },
          onCompleted: (payload, errors) => {
            const result = payload.consumeContactInvite;

            if (errors?.length || !result) {
              reject(new Error('contact_invite_execution_failed'));
              return;
            }

            if (result.consumed && result.errors.length === 0) {
              resolve('consumed');
              return;
            }

            const errorCodes = new Set(
              result.errors.map((error) => error.message),
            );

            if (errorCodes.has('invalid_contact_invite')) {
              resolve('invalid');
              return;
            }

            if (errorCodes.has('unauthenticated')) {
              resolve('requires_auth');
              return;
            }

            reject(new Error('contact_invite_payload_failed'));
          },
          onError: reject,
        });
      }),
    [commitConsume],
  );

  const beginAttempt = useCallback(() => {
    const currentAttempt = activeAttemptRef.current;

    if (
      currentAttempt?.handoffId === handoffId &&
      currentAttempt.authStatus === authState.status
    ) {
      return;
    }

    const attempt: ActiveAttempt = {
      authStatus: authState.status,
      handoffId,
      id: ++attemptSequenceRef.current,
    };
    activeAttemptRef.current = attempt;

    if (authState.status === 'loading') {
      return;
    }

    if (!handoffId) {
      dispatch({
        attemptId: attempt.id,
        handoffId,
        type: 'invalid',
      });
      finishAttempt(attempt);
      return;
    }

    if (authState.status === 'unauthenticated') {
      readContactInviteHandoffStatus(handoffId)
        .then((status) => {
          if (!isCurrentAttempt(attempt)) {
            return;
          }

          dispatch({
            attemptId: attempt.id,
            handoffId,
            type: status === 'matched' ? 'requires_auth' : 'invalid',
          });
          finishAttempt(attempt);
        })
        .catch(() => {
          if (!isCurrentAttempt(attempt)) {
            return;
          }

          dispatch({ attemptId: attempt.id, handoffId, type: 'invalid' });
          finishAttempt(attempt);
        });
      return;
    }

    dispatch({ attemptId: attempt.id, handoffId, type: 'consuming' });
    withContactInviteToken(handoffId, commitToken)
      .then(async (result) => {
        if (!isCurrentAttempt(attempt)) {
          return;
        }

        if (result.status !== 'matched') {
          dispatch({ attemptId: attempt.id, handoffId, type: 'invalid' });
          finishAttempt(attempt);
          return;
        }

        if (result.value === 'invalid') {
          await clearContactInviteHandoff(handoffId);

          if (!isCurrentAttempt(attempt)) {
            return;
          }

          dispatch({ attemptId: attempt.id, handoffId, type: 'invalid' });
          finishAttempt(attempt);
          return;
        }

        if (result.value === 'requires_auth') {
          dispatch({
            attemptId: attempt.id,
            handoffId,
            type: 'requires_auth',
          });
          finishAttempt(attempt);
          return;
        }

        await clearContactInviteHandoff(handoffId);

        if (!isCurrentAttempt(attempt)) {
          return;
        }

        dispatch({ attemptId: attempt.id, handoffId, type: 'consumed' });
        finishAttempt(attempt);
      })
      .catch(() => {
        if (!isCurrentAttempt(attempt)) {
          return;
        }

        // Transport failures retain the matching record for idempotent retry.
        dispatch({
          attemptId: attempt.id,
          handoffId,
          type: 'retryable_error',
        });
        finishAttempt(attempt);
      });
  }, [
    authState.status,
    commitToken,
    finishAttempt,
    handoffId,
    isCurrentAttempt,
  ]);

  useEffect(() => {
    if (previousHandoffIdRef.current !== handoffId) {
      previousHandoffIdRef.current = handoffId;
      dispatch({ handoffId, type: 'route_changed' });
    }

    beginAttempt();
  }, [beginAttempt, handoffId]);

  useEffect(
    () => () => {
      activeAttemptRef.current = null;
    },
    [],
  );

  const inviteHref = handoffId ? `/invite?handoff=${handoffId}` : null;
  const content = contactInviteContent(state.status);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AppCard>
        <AppHeader eyebrow="Invitation" title={content.title} />
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          {content.message}
        </Text>
        {state.status === 'requires_auth' && inviteHref ? (
          <View style={styles.actions}>
            <AppButton
              label="Sign in"
              onPress={() => router.push(authRouteHref('/sign-in', inviteHref))}
            />
            <AppButton
              label="Create account"
              onPress={() => router.push(authRouteHref('/sign-up', inviteHref))}
              variant="secondary"
            />
          </View>
        ) : null}
        {state.status === 'retryable_error' ? (
          <AppButton label="Try again" onPress={beginAttempt} />
        ) : null}
      </AppCard>
    </View>
  );
}

function contactInviteContent(
  status: ReturnType<typeof createContactInviteState>['status'],
): {
  readonly message: string;
  readonly title: string;
} {
  switch (status) {
    case 'checking':
      return {
        message: 'Checking this invitation...',
        title: 'Checking invitation',
      };
    case 'requires_auth':
      return {
        message: 'You have been invited to LiveCanvas.',
        title: 'Continue to your invitation',
      };
    case 'consuming':
      return {
        message: 'Accepting your invitation...',
        title: 'Accepting invitation',
      };
    case 'consumed':
      return { message: 'Invitation accepted.', title: 'Welcome to LiveCanvas' };
    case 'invalid':
      return {
        message: 'This invitation is invalid or has expired.',
        title: 'Invitation unavailable',
      };
    case 'retryable_error':
      return {
        message: 'We could not confirm the invitation. Try again.',
        title: 'Could not confirm invitation',
      };
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected contact invite state: ${String(value)}`);
}

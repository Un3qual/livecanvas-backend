import React, {
  Suspense,
  useEffect,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { formatProfileIdentity } from '../profile/profilePresentation';
import { useAppTheme } from '../providers/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import {
  badgeColorsForLiveStatusTone,
  canEnterLiveSession,
  formatLiveMutationErrors,
  formatLiveSessionStatus,
  formatLiveSessionTiming,
  formatLiveSessionVisibility,
  normalizeLiveSessionStatus,
  normalizeLiveSessionVisibility,
  type LiveSessionStatus,
} from './liveSessionPresentation';
import {
  clearLiveSessionWatchPendingMutation,
  createLiveSessionWatchState,
  isLiveSessionWatchAnyMutationPending,
  liveSessionWatchReducer,
  readLiveSessionWatchSubmission,
  shouldAutoLeaveLiveSession,
  type LiveSessionWatchPendingMutation,
} from './liveSessionWatchReducer';
import type { LiveSessionWatchScreenJoinMutation } from './__generated__/LiveSessionWatchScreenJoinMutation.graphql';
import type { LiveSessionWatchScreenLeaveMutation } from './__generated__/LiveSessionWatchScreenLeaveMutation.graphql';
import type { LiveSessionWatchScreenQuery } from './__generated__/LiveSessionWatchScreenQuery.graphql';

type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];
type LiveSessionNode = Extract<
  NonNullable<LiveSessionWatchData['node']>,
  { readonly __typename: 'LiveSession' }
>;

type LiveSessionWatchScreenProps = {
  sessionId: string;
};

type PendingMutationRef = {
  current: LiveSessionWatchPendingMutation | null;
};

type AutoLeaveOnUnmountRef = {
  current: { readonly sessionId: string; readonly shouldLeave: boolean } | null;
};

type LiveSessionWatchContentProps = LiveSessionWatchScreenProps & {
  pendingMutationRef: PendingMutationRef;
};

const liveSessionWatchScreenJoinMutation = graphql`
  mutation LiveSessionWatchScreenJoinMutation(
    $input: JoinLiveSessionInput!
  ) {
    joinLiveSession(input: $input) {
      liveSession {
        id
        status
        visibility
        insertedAt
        startedAt
        endedAt
        host {
          id
          email
        }
      }
      errors {
        field
        message
      }
    }
  }
`;

const liveSessionWatchScreenLeaveMutation = graphql`
  mutation LiveSessionWatchScreenLeaveMutation(
    $input: LeaveLiveSessionInput!
  ) {
    leaveLiveSession(input: $input) {
      left
      errors {
        field
        message
      }
    }
  }
`;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  unavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  sectionTitle: typography.label,
  bodyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  metadataRow: {
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  metadataLabel: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 16,
  },
  metadataValue: typography.body,
  recordingMetadata: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
});

export function LiveSessionWatchScreen({
  sessionId,
}: LiveSessionWatchScreenProps) {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);
  const pendingMutationRef = useRef<LiveSessionWatchPendingMutation | null>(
    null,
  );
  const resetKey = `${sessionId}:${queryRetryKey}`;

  return (
    <LiveSessionWatchErrorBoundary key={resetKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading live session..." />
        }
      >
        <LiveSessionWatchContent
          key={resetKey}
          pendingMutationRef={pendingMutationRef}
          sessionId={sessionId}
        />
      </Suspense>
    </LiveSessionWatchErrorBoundary>
  );
}

type LiveSessionWatchErrorBoundaryProps = PropsWithChildren<{
  onRetry: () => void;
}>;

type LiveSessionWatchErrorBoundaryState = {
  hasError: boolean;
};

class LiveSessionWatchErrorBoundary extends React.Component<
  LiveSessionWatchErrorBoundaryProps,
  LiveSessionWatchErrorBoundaryState
> {
  state: LiveSessionWatchErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LiveSessionWatchErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScreenState
          state="error"
          message="We couldn't load this live session. Check your connection and try again."
          onRetry={this.props.onRetry}
        />
      );
    }

    return this.props.children;
  }
}

function LiveSessionWatchContent({
  pendingMutationRef,
  sessionId,
}: LiveSessionWatchContentProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const data = useLazyLoadQuery<LiveSessionWatchScreenQuery>(
    graphql`
      query LiveSessionWatchScreenQuery($id: ID!) {
        node(id: $id) {
          __typename
          ... on LiveSession {
            id
            channelTopic
            status
            visibility
            insertedAt
            startedAt
            endedAt
            host {
              id
              email
            }
            recordingMediaAsset {
              id
              processingState
              publicUrl
            }
          }
        }
      }
    `,
    { id: sessionId },
    { fetchPolicy: 'store-and-network' },
  );
  const [watchState, dispatchWatchAction] = useReducer(
    liveSessionWatchReducer,
    createLiveSessionWatchState(),
  );
  const [commitJoinLiveSession] =
    useMutation<LiveSessionWatchScreenJoinMutation>(
      liveSessionWatchScreenJoinMutation,
    );
  const [commitLeaveLiveSession] =
    useMutation<LiveSessionWatchScreenLeaveMutation>(
      liveSessionWatchScreenLeaveMutation,
    );
  const autoLeaveOnUnmountRef = useRef<
    AutoLeaveOnUnmountRef['current']
  >(null);
  const didUnmountRef = useRef(false);
  const leaveMutationRef = useRef(commitLeaveLiveSession);

  leaveMutationRef.current = commitLeaveLiveSession;

  useEffect(() => {
    dispatchWatchAction({ type: 'session_changed', sessionId });
  }, [sessionId]);

  useEffect(() => {
    didUnmountRef.current = false;

    return () => {
      didUnmountRef.current = true;
      const autoLeave = autoLeaveOnUnmountRef.current;

      if (!autoLeave?.shouldLeave) {
        return;
      }

      commitDetachedLeaveLiveSession(autoLeave.sessionId);
    };
  }, [pendingMutationRef]);

  function commitDetachedLeaveLiveSession(sessionId: string) {
    if (
      isLiveSessionWatchAnyMutationPending(pendingMutationRef.current, sessionId)
    ) {
      return;
    }

    pendingMutationRef.current = {
      kind: 'leave',
      sessionId,
    };
    leaveMutationRef.current({
      variables: {
        input: {
          liveSessionId: sessionId,
        },
      },
      onCompleted: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          sessionId,
          'leave',
        );
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          sessionId,
          'leave',
        );
      },
    });
  }

  if (data.node?.__typename !== 'LiveSession') {
    return <UnavailableLiveSession onBack={() => router.back()} />;
  }

  const session = data.node;
  const normalizedStatus = normalizeLiveSessionStatus(session.status);
  const status = formatLiveSessionStatus(normalizedStatus);
  const enterable = canEnterLiveSession(normalizedStatus);
  const isCurrentSession = watchState.activeSessionId === session.id;
  const isJoined = isCurrentSession && watchState.isJoined;
  const visibleSubmission = readLiveSessionWatchSubmission(
    watchState,
    session.id,
  );
  const isJoining = visibleSubmission === 'joining';
  const isLeaving = visibleSubmission === 'leaving';
  const hasActiveSubmission = visibleSubmission !== 'idle';

  autoLeaveOnUnmountRef.current = {
    sessionId: session.id,
    shouldLeave: shouldAutoLeaveLiveSession(
      watchState,
      session.id,
      pendingMutationRef.current,
    ),
  };

  // UI submission state disables controls after render; the ref closes the
  // same-render double-tap gap before reducer state propagates.
  function handleJoinPress() {
    if (
      !enterable ||
      hasActiveSubmission ||
      isJoined ||
      isLiveSessionWatchAnyMutationPending(
        pendingMutationRef.current,
        session.id,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'join', sessionId: session.id };
    dispatchWatchAction({ type: 'join_started', sessionId: session.id });

    commitJoinLiveSession({
      variables: {
        input: {
          liveSessionId: session.id,
        },
      },
      onCompleted: (payload) => {
        const result = payload.joinLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          session.id,
          'join',
        );

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (didUnmountRef.current) {
            return;
          }

          dispatchWatchAction({
            error: formatLiveMutationErrors(result?.errors),
            sessionId: session.id,
            type: 'join_failed',
          });
          return;
        }

        if (didUnmountRef.current) {
          commitDetachedLeaveLiveSession(session.id);
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: session.id,
          shouldLeave: true,
        };
        dispatchWatchAction({
          sessionId: session.id,
          type: 'join_succeeded',
        });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          session.id,
          'join',
        );

        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          error: formatLiveMutationErrors([]),
          sessionId: session.id,
          type: 'join_failed',
        });
      },
    });
  }

  function handleLeavePress() {
    if (
      !isJoined ||
      hasActiveSubmission ||
      isLiveSessionWatchAnyMutationPending(
        pendingMutationRef.current,
        session.id,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'leave', sessionId: session.id };
    autoLeaveOnUnmountRef.current = {
      sessionId: session.id,
      shouldLeave: false,
    };
    dispatchWatchAction({ type: 'leave_started', sessionId: session.id });

    commitLeaveLiveSession({
      variables: {
        input: {
          liveSessionId: session.id,
        },
      },
      onCompleted: (payload) => {
        const result = payload.leaveLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          session.id,
          'leave',
        );

        if (!result?.left || (result.errors?.length ?? 0) > 0) {
          autoLeaveOnUnmountRef.current = {
            sessionId: session.id,
            shouldLeave: true,
          };
          if (didUnmountRef.current) {
            return;
          }

          dispatchWatchAction({
            error: formatLiveMutationErrors(result?.errors),
            sessionId: session.id,
            type: 'leave_failed',
          });
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: session.id,
          shouldLeave: false,
        };
        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          sessionId: session.id,
          type: 'leave_succeeded',
        });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          session.id,
          'leave',
        );
        autoLeaveOnUnmountRef.current = {
          sessionId: session.id,
          shouldLeave: true,
        };
        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          error: formatLiveMutationErrors([]),
          sessionId: session.id,
          type: 'leave_failed',
        });
      },
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <LiveSessionHero
        isJoined={isJoined}
        session={session}
        status={status}
        normalizedStatus={normalizedStatus}
      />

      <AppCard>
        <SectionHeading title="Session details" />
        <MetadataRow label="Status" value={status.label} />
        <MetadataRow
          label="Visibility"
          value={formatLiveSessionVisibility(
            normalizeLiveSessionVisibility(session.visibility),
          )}
        />
        <MetadataRow
          label="Timing"
          value={formatLiveSessionTiming({
            endedAt: session.endedAt,
            insertedAt: session.insertedAt,
            startedAt: session.startedAt,
            status: normalizedStatus,
          })}
        />
        {session.recordingMediaAsset ? (
          <RecordingMetadata asset={session.recordingMediaAsset} />
        ) : null}
      </AppCard>

      <AppCard>
        <SectionHeading title="Watch controls" />
        {normalizedStatus === 'ENDED' ? (
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            This live session has ended.
          </Text>
        ) : null}
        {isJoined ? (
          <Text style={[styles.bodyText, { color: theme.colors.text }]}>
            You are joined to this live session.
          </Text>
        ) : null}
        {isJoining ? (
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            Joining live session...
          </Text>
        ) : null}
        {isLeaving ? (
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            Leaving live session...
          </Text>
        ) : null}
        {watchState.error ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {watchState.error}
          </Text>
        ) : null}
        {isJoined ? (
          <AppButton
            disabled={isLeaving || hasActiveSubmission}
            label="Leave live"
            onPress={handleLeavePress}
            variant="secondary"
          />
        ) : (
          <AppButton
            disabled={!enterable || isJoining || hasActiveSubmission}
            label="Join live"
            onPress={handleJoinPress}
          />
        )}
      </AppCard>
    </ScrollView>
  );
}

function UnavailableLiveSession({ onBack }: { onBack: () => void }) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.unavailable,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <AppCard>
        <AppHeader
          eyebrow="Live"
          title="Live session unavailable"
          subtitle="This live session is not available to your account."
        />
        <AppButton label="Go back" onPress={onBack} variant="secondary" />
      </AppCard>
    </View>
  );
}

function LiveSessionHero({
  isJoined,
  normalizedStatus,
  session,
  status,
}: {
  isJoined: boolean;
  normalizedStatus: LiveSessionStatus;
  session: LiveSessionNode;
  status: ReturnType<typeof formatLiveSessionStatus>;
}) {
  const theme = useAppTheme();
  const host = formatProfileIdentity(session.host);
  const badgeColors = badgeColorsForLiveStatusTone(status.tone, theme);

  return (
    <AppCard>
      <View style={styles.heroHeader}>
        <View style={[styles.badge, { backgroundColor: badgeColors.surface }]}>
          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
            {status.label}
          </Text>
        </View>
        {isJoined ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.accent }]}>
              Joined
            </Text>
          </View>
        ) : null}
      </View>
      <AppHeader
        eyebrow="Live session"
        title={host.title}
        subtitle={formatLiveSessionTiming({
          endedAt: session.endedAt,
          insertedAt: session.insertedAt,
          startedAt: session.startedAt,
          status: normalizedStatus,
        })}
      />
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        Host
      </Text>
    </AppCard>
  );
}

function SectionHeading({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={[styles.metadataRow, { borderColor: theme.colors.border }]}>
      <Text style={[styles.metadataLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metadataValue, { color: theme.colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function RecordingMetadata({
  asset,
}: {
  asset: LiveSessionNode['recordingMediaAsset'];
}) {
  if (!asset) {
    return null;
  }

  return (
    <View style={styles.recordingMetadata}>
      <SectionHeading title="Recording" />
      <MetadataRow
        label="Processing"
        value={formatRecordingProcessingState(asset.processingState)}
      />
      {asset.publicUrl ? (
        <MetadataRow label="Public URL" value={asset.publicUrl} />
      ) : null}
    </View>
  );
}

function formatRecordingProcessingState(processingState: string): string {
  switch (processingState) {
    case 'PENDING_UPLOAD':
      return 'Pending upload';
    case 'UPLOADED':
      return 'Uploaded';
    case 'PROCESSED':
      return 'Processed';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Unavailable';
  }
}

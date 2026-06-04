import React, {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { formatProfileIdentity } from '../profile/profilePresentation';
import { useStartupState } from '../providers/StartupGate';
import { useAppTheme } from '../providers/ThemeProvider';
import { createPhoenixSocket } from '../realtime/phoenixSocket';
import { radius, spacing, typography } from '../theme/tokens';
import { LiveSessionChatPanel } from './LiveSessionChatPanel';
import {
  createLiveSessionChannelClient,
  type LiveSessionChannelClient,
} from './liveSessionChannelClient';
import {
  createLiveSessionChatState,
  liveSessionChatReducer,
  selectLiveSessionChatChannelStatus,
  selectLiveSessionChatSendError,
  selectLiveSessionChatSendStatus,
  selectLiveSessionChatVisibleRows,
} from './liveSessionChatReducer';
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
import {
  readLiveSessionTimelineHistory,
  type LiveSessionTimelineHistoryConnection,
} from './liveSessionTimelineHistory';
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

const INITIAL_TIMELINE_HISTORY_COUNT = 30;

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
  const auth = useAuth();
  const { environment } = useStartupState();
  const data = useLazyLoadQuery<LiveSessionWatchScreenQuery>(
    graphql`
      query LiveSessionWatchScreenQuery(
        $id: ID!
        $timelineLast: Int!
        $timelineBefore: String
      ) {
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
            timelineEvents(last: $timelineLast, before: $timelineBefore) {
              edges {
                cursor
                node {
                  __typename
                  id
                  eventType
                  occurredAt
                  actor {
                    id
                  }
                  ... on ChatMessageEvent {
                    body
                    edited
                    editCount
                    editedAt
                  }
                }
              }
              pageInfo {
                startCursor
                endCursor
                hasNextPage
                hasPreviousPage
              }
            }
          }
        }
      }
    `,
    {
      id: sessionId,
      timelineBefore: null,
      timelineLast: INITIAL_TIMELINE_HISTORY_COUNT,
    },
    { fetchPolicy: 'store-and-network' },
  );
  const [watchState, dispatchWatchAction] = useReducer(
    liveSessionWatchReducer,
    createLiveSessionWatchState(),
  );
  const [chatState, dispatchChatAction] = useReducer(
    liveSessionChatReducer,
    createLiveSessionChatState(),
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
  const chatChannelClientRef = useRef<LiveSessionChannelClient | null>(null);
  const didUnmountRef = useRef(false);
  const leaveMutationRef = useRef(commitLeaveLiveSession);

  leaveMutationRef.current = commitLeaveLiveSession;

  const session =
    data.node?.__typename === 'LiveSession' ? data.node : null;
  const retainedTimelineConnection = session?.timelineEvents ?? null;
  const retainedTimelineHistory = useMemo(
    () =>
      readLiveSessionTimelineHistory(
        retainedTimelineConnection as LiveSessionTimelineHistoryConnection,
      ),
    [retainedTimelineConnection],
  );
  const normalizedStatus = normalizeLiveSessionStatus(
    session?.status ?? 'ENDED',
  );
  const enterable = canEnterLiveSession(normalizedStatus);
  const isCurrentSession =
    session !== null && watchState.activeSessionId === session.id;
  const isJoined = isCurrentSession && watchState.isJoined;
  const visibleSubmission = session
    ? readLiveSessionWatchSubmission(watchState, session.id)
    : 'idle';
  const isJoining = visibleSubmission === 'joining';
  const isLeaving = visibleSubmission === 'leaving';
  const hasActiveSubmission = visibleSubmission !== 'idle';
  const chatRows = selectLiveSessionChatVisibleRows(chatState);
  const chatChannelStatus = selectLiveSessionChatChannelStatus(chatState);
  const chatSendStatus = selectLiveSessionChatSendStatus(chatState);
  const chatSendError = selectLiveSessionChatSendError(chatState);

  useEffect(() => {
    dispatchWatchAction({ type: 'session_changed', sessionId });
    dispatchChatAction({ type: 'session_changed', sessionId });
  }, [sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    dispatchChatAction({
      history: retainedTimelineHistory,
      sessionId: session.id,
      type: 'retained_initial_loaded',
    });
  }, [retainedTimelineHistory, session?.id]);

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

  useEffect(() => {
    if (
      !session ||
      !isJoined ||
      !session.channelTopic ||
      auth.state.status !== 'authenticated'
    ) {
      chatChannelClientRef.current = null;

      if (session) {
        dispatchChatAction({
          sessionId: session.id,
          status: 'idle',
          type: 'channel_status_changed',
        });
      }

      return;
    }

    let isActive = true;
    const socket = createPhoenixSocket({
      getAccessToken: auth.getAccessToken,
      websocketUrl: environment.websocketUrl,
    });
    const client = createLiveSessionChannelClient({
      onSessionState: () => {
        if (!isActive) {
          return;
        }

        dispatchChatAction({
          sessionId: session.id,
          status: 'joined',
          type: 'channel_status_changed',
        });
      },
      onTimelineEvent: (event) => {
        if (!isActive) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: session.id,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventRemoved: (event) => {
        if (!isActive) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: session.id,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventUpdated: (event) => {
        if (!isActive) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: session.id,
          type: 'realtime_event_received',
        });
      },
      socket,
      topic: session.channelTopic,
    });

    chatChannelClientRef.current = client;
    dispatchChatAction({
      sessionId: session.id,
      status: 'joining',
      type: 'channel_status_changed',
    });
    socket.connect();

    void client.join().then((result) => {
      if (!isActive) {
        return;
      }

      if (result.status === 'joined') {
        dispatchChatAction({
          sessionId: session.id,
          status: 'joined',
          type: 'channel_status_changed',
        });
        return;
      }

      dispatchChatAction({
        error: result.reason,
        sessionId: session.id,
        status: 'errored',
        type: 'channel_status_changed',
      });
    });

    return () => {
      isActive = false;
      chatChannelClientRef.current = null;
      client.leave();
      socket.disconnect();
    };
  }, [
    auth.getAccessToken,
    auth.state.status,
    environment.websocketUrl,
    isJoined,
    session?.channelTopic,
    session?.id,
  ]);

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

  const liveSession = session;

  if (!liveSession) {
    return <UnavailableLiveSession onBack={() => router.back()} />;
  }

  const liveSessionId = liveSession.id;
  const status = formatLiveSessionStatus(normalizedStatus);

  autoLeaveOnUnmountRef.current = {
    sessionId: liveSessionId,
    shouldLeave: shouldAutoLeaveLiveSession(
      watchState,
      liveSessionId,
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
        liveSessionId,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'join', sessionId: liveSessionId };
    dispatchWatchAction({ type: 'join_started', sessionId: liveSessionId });

    commitJoinLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.joinLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'join',
        );

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (didUnmountRef.current) {
            return;
          }

          dispatchWatchAction({
            error: formatLiveMutationErrors(result?.errors),
            sessionId: liveSessionId,
            type: 'join_failed',
          });
          return;
        }

        if (didUnmountRef.current) {
          commitDetachedLeaveLiveSession(liveSessionId);
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: liveSessionId,
          shouldLeave: true,
        };
        dispatchWatchAction({
          sessionId: liveSessionId,
          type: 'join_succeeded',
        });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'join',
        );

        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          error: formatLiveMutationErrors([]),
          sessionId: liveSessionId,
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
        liveSessionId,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'leave', sessionId: liveSessionId };
    autoLeaveOnUnmountRef.current = {
      sessionId: liveSessionId,
      shouldLeave: false,
    };
    dispatchWatchAction({ type: 'leave_started', sessionId: liveSessionId });

    commitLeaveLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.leaveLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'leave',
        );

        if (!result?.left || (result.errors?.length ?? 0) > 0) {
          autoLeaveOnUnmountRef.current = {
            sessionId: liveSessionId,
            shouldLeave: true,
          };
          if (didUnmountRef.current) {
            return;
          }

          dispatchWatchAction({
            error: formatLiveMutationErrors(result?.errors),
            sessionId: liveSessionId,
            type: 'leave_failed',
          });
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: liveSessionId,
          shouldLeave: false,
        };
        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          sessionId: liveSessionId,
          type: 'leave_succeeded',
        });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'leave',
        );
        autoLeaveOnUnmountRef.current = {
          sessionId: liveSessionId,
          shouldLeave: true,
        };
        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          error: formatLiveMutationErrors([]),
          sessionId: liveSessionId,
          type: 'leave_failed',
        });
      },
    });
  }

  async function handleSendChatMessage(body: string) {
    if (chatChannelStatus !== 'joined') {
      return;
    }

    const client = chatChannelClientRef.current;

    if (!client) {
      return;
    }

    dispatchChatAction({ sessionId: liveSessionId, type: 'send_started' });

    const result = await client.sendChatMessage(body);

    if (didUnmountRef.current) {
      return;
    }

    if (result.status === 'ok') {
      dispatchChatAction({
        event: {
          event: result.event,
          kind: 'timeline_event',
        },
        sessionId: liveSessionId,
        type: 'realtime_event_received',
      });
      dispatchChatAction({
        sessionId: liveSessionId,
        type: 'send_succeeded',
      });
      return;
    }

    dispatchChatAction({
      error: result.reason,
      sessionId: liveSessionId,
      type: 'send_failed',
    });
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <LiveSessionHero
        isJoined={isJoined}
        session={liveSession}
        status={status}
        normalizedStatus={normalizedStatus}
      />

      <AppCard>
        <SectionHeading title="Session details" />
        <MetadataRow label="Status" value={status.label} />
        <MetadataRow
          label="Visibility"
          value={formatLiveSessionVisibility(
            normalizeLiveSessionVisibility(liveSession.visibility),
          )}
        />
        <MetadataRow
          label="Timing"
          value={formatLiveSessionTiming({
            endedAt: liveSession.endedAt,
            insertedAt: liveSession.insertedAt,
            startedAt: liveSession.startedAt,
            status: normalizedStatus,
          })}
        />
        {liveSession.recordingMediaAsset ? (
          <RecordingMetadata asset={liveSession.recordingMediaAsset} />
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

      <LiveSessionChatPanel
        channelStatus={chatChannelStatus}
        isJoined={isJoined}
        onSendMessage={handleSendChatMessage}
        rows={chatRows}
        sendError={chatSendError}
        sendStatus={chatSendStatus}
      />
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

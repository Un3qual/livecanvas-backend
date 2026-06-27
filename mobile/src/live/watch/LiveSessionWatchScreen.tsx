import React, {
  Suspense,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { useLazyLoadQuery, useMutation } from 'react-relay';

import { useAuth } from '../../auth/AuthProvider';
import { ScreenState } from '../../components/ScreenState';
import { useHostBroadcastPublishingSessions } from '../../host/HostBroadcastPublishingSessionProvider';
import { useStartupState } from '../../providers/StartupGate';
import { useAppTheme } from '../../providers/ThemeProvider';
import { createPhoenixSocket } from '../../realtime/phoenixSocket';
import { LiveSessionChatPanel } from '../LiveSessionChatPanel';
import { createLiveSessionChatChannelLifecycle } from '../liveSessionChatChannelLifecycle';
import {
  createLiveSessionChannelClient,
  shouldCloseLiveSessionChatChannelAfterJoin,
  type LiveSessionChannelClient,
} from '../liveSessionChannelClient';
import {
  canStartLiveSessionChatSend,
  createLiveSessionChatState,
  liveSessionChatReducer,
  selectLiveSessionChatChannelStatus,
  selectLiveSessionChatSendError,
  selectLiveSessionChatSendStatus,
  selectLiveSessionChatVisibleRows,
} from '../liveSessionChatReducer';
import {
  canEnterLiveSession,
  formatLiveMutationErrors,
  formatLiveSessionStatus,
  normalizeLiveSessionStatus,
  type LiveSessionStatus,
} from '../liveSessionPresentation';
import {
  clearLiveSessionWatchPendingMutation,
  createLiveSessionWatchState,
  isLiveSessionWatchAnyMutationPending,
  liveSessionWatchReducer,
  readLiveSessionWatchSubmission,
  shouldAutoLeaveLiveSession,
  type LiveSessionWatchPendingMutation,
} from '../liveSessionWatchReducer';
import { canStartLiveSessionViewerJoin } from '../liveSessionWatchControls';
import { readLiveSessionTimelineHistory } from '../liveSessionTimelineHistory';
import { handleLiveSessionEndedRealtimeCleanup } from '../liveSessionEndedRealtimeCleanup';
import { shouldMaintainLiveSessionRealtimeChannel } from '../liveSessionRealtimeSubscription';
import {
  readLiveSessionRealtimeStatus,
  updateLiveSessionRealtimeStatus,
  type LiveSessionRealtimeStatusMap,
} from '../liveSessionRealtimeStatus';
import {
  LiveSessionDetailsCard,
  LiveSessionHero,
  LiveSessionWatchControlsCard,
  UnavailableLiveSession,
} from './components/LiveSessionWatchCards';
import { LiveSessionViewerPlaybackSurface } from './components/LiveSessionViewerPlaybackSurface';
import { useLiveSessionViewerPlaybackController } from './hooks/useLiveSessionViewerPlaybackController';
import {
  readLiveSessionWatchModel,
  readLiveSessionWatchViewerId,
} from './liveSessionWatchData';
import {
  liveSessionWatchScreenEndMutation,
  liveSessionWatchScreenJoinMutation,
  liveSessionWatchScreenLeaveMutation,
  liveSessionWatchScreenPrepareMediaMutation,
  liveSessionWatchScreenQuery,
  type LiveSessionWatchScreenEndMutation,
  type LiveSessionWatchScreenJoinMutation,
  type LiveSessionWatchScreenLeaveMutation,
  type LiveSessionWatchScreenPrepareMediaMutation,
  type LiveSessionWatchScreenQuery,
} from './liveSessionWatchOperations';
import { liveSessionWatchScreenStyles as styles } from './liveSessionWatchScreenStyles';
import type {
  AutoLeaveOnUnmountRef,
  LiveSessionWatchContentProps,
  LiveSessionWatchScreenProps,
  PendingChatSendRef,
} from './liveSessionWatchScreenTypes';

const INITIAL_TIMELINE_HISTORY_COUNT = 30;

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
  const hostPublishingSessions = useHostBroadcastPublishingSessions();
  const data = useLazyLoadQuery<LiveSessionWatchScreenQuery>(
    liveSessionWatchScreenQuery,
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
  const [commitPrepareLiveSessionMedia] =
    useMutation<LiveSessionWatchScreenPrepareMediaMutation>(
      liveSessionWatchScreenPrepareMediaMutation,
    );
  const [commitLeaveLiveSession] =
    useMutation<LiveSessionWatchScreenLeaveMutation>(
      liveSessionWatchScreenLeaveMutation,
    );
  const [commitEndLiveSession] =
    useMutation<LiveSessionWatchScreenEndMutation>(
      liveSessionWatchScreenEndMutation,
    );
  const [realtimeSessionStatuses, setRealtimeSessionStatuses] =
    useState<LiveSessionRealtimeStatusMap>(() => new Map());
  const autoLeaveOnUnmountRef = useRef<
    AutoLeaveOnUnmountRef['current']
  >(null);
  const chatChannelClientRef = useRef<LiveSessionChannelClient | null>(null);
  const chatSendPendingRef = useRef<PendingChatSendRef['current']>(null);
  const chatSendTokenRef = useRef(0);
  const didUnmountRef = useRef(false);
  const leaveMutationRef = useRef(commitLeaveLiveSession);

  leaveMutationRef.current = commitLeaveLiveSession;

  const session = readLiveSessionWatchModel(data);
  const retainedTimelineConnection = session?.timelineEvents ?? null;
  const retainedTimelineHistory = useMemo(
    () =>
      readLiveSessionTimelineHistory(retainedTimelineConnection),
    [retainedTimelineConnection],
  );
  const queriedNormalizedStatus = normalizeLiveSessionStatus(
    session?.status ?? 'ENDED',
  );
  const normalizedStatus = session
    ? readLiveSessionRealtimeStatus({
        liveSessionId: session.id,
        queriedStatus: queriedNormalizedStatus,
        realtimeStatuses: realtimeSessionStatuses,
      })
    : queriedNormalizedStatus;
  const enterable = canEnterLiveSession(normalizedStatus);
  const isCurrentSession =
    session !== null && watchState.activeSessionId === session.id;
  const isJoined = isCurrentSession && watchState.isJoined;
  const visibleSubmission = session
    ? readLiveSessionWatchSubmission(watchState, session.id)
    : 'idle';
  const isJoining = visibleSubmission === 'joining';
  const isLeaving = visibleSubmission === 'leaving';
  const isEnding = visibleSubmission === 'ending';
  const hasActiveSubmission = visibleSubmission !== 'idle';
  const chatRows = selectLiveSessionChatVisibleRows(chatState);
  const chatChannelStatus = selectLiveSessionChatChannelStatus(chatState);
  const chatSendStatus = selectLiveSessionChatSendStatus(chatState);
  const chatSendError = selectLiveSessionChatSendError(chatState);
  const hasRetainedHostPublishingSession = session
    ? hostPublishingSessions.has(session.id)
    : false;
  const shouldMaintainSessionRealtimeChannel =
    shouldMaintainLiveSessionRealtimeChannel({
      hasRetainedHostPublishingSession,
      isJoined,
    });
  const { stopViewerPlayback, viewerPlaybackState } =
    useLiveSessionViewerPlaybackController({
      authStatus: auth.state.status,
      commitPrepareLiveSessionMedia,
      getAccessToken: auth.getAccessToken,
      isJoined,
      isLeaving,
      liveSessionId: session?.id ?? null,
      normalizedStatus,
      websocketUrl: environment.websocketUrl,
    });

  useEffect(() => {
    dispatchWatchAction({ type: 'session_changed', sessionId });
    dispatchChatAction({ type: 'session_changed', sessionId });
    chatSendPendingRef.current = null;
    setRealtimeSessionStatuses(new Map());
  }, [sessionId]);

  function markLiveSessionEnded(liveSessionId: string) {
    markLiveSessionRealtimeStatus(liveSessionId, 'ENDED');
  }

  function markLiveSessionRealtimeStatus(
    liveSessionId: string,
    status: LiveSessionStatus,
  ) {
    setRealtimeSessionStatuses((statuses) =>
      updateLiveSessionRealtimeStatus({
        liveSessionId,
        realtimeStatuses: statuses,
        status,
      }),
    );
  }

  useEffect(() => {
    if (session?.id && normalizedStatus === 'ENDED') {
      stopViewerPlayback({ resetState: true });
      hostPublishingSessions.release(session.id);
    }
  }, [hostPublishingSessions, normalizedStatus, session?.id]);

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
      stopViewerPlayback({ resetState: false });
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
      !shouldMaintainSessionRealtimeChannel ||
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

      return undefined;
    }

    let chatChannelClient: LiveSessionChannelClient | null = null;
    const socket = createPhoenixSocket({
      getAccessToken: auth.getAccessToken,
      websocketUrl: environment.websocketUrl,
    });
    const chatChannelLifecycle = createLiveSessionChatChannelLifecycle({
      clearClientRef: () => {
        chatChannelClientRef.current = null;
      },
      disconnectSocket: () => {
        socket.disconnect();
      },
      failPendingSendForEndedSession: () => {
        failPendingChatSend(session.id, 'This live session has ended.');
      },
      leaveChannel: () => {
        chatChannelClient?.leave();
      },
      markClosedForEndedSession: () => {
        dispatchChatAction({
          sessionId: session.id,
          status: 'closed',
          type: 'channel_status_changed',
        });
      },
    });

    const client = createLiveSessionChannelClient({
      onClose: () => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: session.id,
          shouldLeave: false,
        };
        chatChannelClientRef.current = null;
        failPendingChatSend(
          session.id,
          'Chat disconnected before the message was sent.',
        );
        stopViewerPlayback({ resetState: true });
        dispatchWatchAction({
          sessionId: session.id,
          type: 'membership_lost',
        });
        dispatchChatAction({
          sessionId: session.id,
          status: 'closed',
          type: 'channel_status_changed',
        });
      },
      onError: (reason) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        autoLeaveOnUnmountRef.current = {
          sessionId: session.id,
          shouldLeave: false,
        };
        chatChannelClientRef.current = null;
        failPendingChatSend(session.id, reason);
        stopViewerPlayback({ resetState: true });
        dispatchWatchAction({
          sessionId: session.id,
          type: 'membership_lost',
        });
        dispatchChatAction({
          error: reason,
          sessionId: session.id,
          status: 'errored',
          type: 'channel_status_changed',
        });
      },
      onSessionState: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        markLiveSessionRealtimeStatus(session.id, event.status);

        if (event.status === 'ENDED') {
          handleLiveSessionEndedRealtimeCleanup({
            clearEndedSessionMembership: (liveSessionId) => {
              autoLeaveOnUnmountRef.current = {
                sessionId: liveSessionId,
                shouldLeave: false,
              };
              dispatchWatchAction({
                sessionId: liveSessionId,
                type: 'membership_lost',
              });
            },
            closeChatChannelForEndedSession: () => {
              chatChannelLifecycle.closeForEndedSession();
            },
            liveSessionId: session.id,
            markLiveSessionEnded,
            releaseHostPublishing: (liveSessionId) => {
              hostPublishingSessions.release(liveSessionId);
            },
            stopViewerPlayback,
          });
          return;
        }

        dispatchChatAction({
          sessionId: session.id,
          status: 'joined',
          type: 'channel_status_changed',
        });
      },
      onTimelineEvent: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: session.id,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventRemoved: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: session.id,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventUpdated: (event) => {
        if (!chatChannelLifecycle.isActive()) {
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

    chatChannelClient = client;
    chatChannelClientRef.current = client;
    dispatchChatAction({
      sessionId: session.id,
      status: 'joining',
      type: 'channel_status_changed',
    });
    socket.connect();

    client
      .join()
      .then((result) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        if (result.status === 'joined') {
          if (shouldCloseLiveSessionChatChannelAfterJoin(result)) {
            handleLiveSessionEndedRealtimeCleanup({
              clearEndedSessionMembership: (liveSessionId) => {
                autoLeaveOnUnmountRef.current = {
                  sessionId: liveSessionId,
                  shouldLeave: false,
                };
                dispatchWatchAction({
                  sessionId: liveSessionId,
                  type: 'membership_lost',
                });
              },
              closeChatChannelForEndedSession: () => {
                chatChannelLifecycle.closeForEndedSession();
              },
              liveSessionId: session.id,
              markLiveSessionEnded,
              releaseHostPublishing: (liveSessionId) => {
                hostPublishingSessions.release(liveSessionId);
              },
              stopViewerPlayback,
            });
            return;
          }

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
      })
      .catch((error: unknown) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          error:
            error instanceof Error ? error.message : 'Chat connection failed.',
          sessionId: session.id,
          status: 'errored',
          type: 'channel_status_changed',
        });
      });

    return () => {
      cancelPendingChatSend(session.id);
      chatChannelLifecycle.cleanup();
    };
  }, [
    auth.getAccessToken,
    auth.state.status,
    environment.websocketUrl,
    hostPublishingSessions,
    shouldMaintainSessionRealtimeChannel,
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

  function failPendingChatSend(sessionId: string, error: string) {
    if (chatSendPendingRef.current?.sessionId !== sessionId) {
      return;
    }

    chatSendPendingRef.current = null;
    dispatchChatAction({
      error,
      sessionId,
      type: 'send_failed',
    });
  }

  function cancelPendingChatSend(sessionId: string) {
    if (chatSendPendingRef.current?.sessionId !== sessionId) {
      return;
    }

    chatSendPendingRef.current = null;
    if (didUnmountRef.current) {
      return;
    }

    dispatchChatAction({
      sessionId,
      type: 'send_cancelled',
    });
  }

  const liveSession = session;

  if (!liveSession) {
    return <UnavailableLiveSession onBack={() => router.back()} />;
  }

  const liveSessionId = liveSession.id;
  const status = formatLiveSessionStatus(normalizedStatus);
  const isCurrentViewerHost =
    readLiveSessionWatchViewerId(data) === liveSession.host.id;
  const canEndLiveSession =
    isCurrentViewerHost && normalizedStatus !== 'ENDED';

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
    const hasPendingMutation = isLiveSessionWatchAnyMutationPending(
      pendingMutationRef.current,
      liveSessionId,
    );

    if (
      !canStartLiveSessionViewerJoin({
        enterable,
        hasActiveSubmission,
        hasPendingMutation,
        isHostOwnedSession: isCurrentViewerHost,
        isJoined,
      })
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
    stopViewerPlayback({ resetState: true });

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

  function handleEndPress() {
    if (
      !canEndLiveSession ||
      hasActiveSubmission ||
      isLiveSessionWatchAnyMutationPending(
        pendingMutationRef.current,
        liveSessionId,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'end', sessionId: liveSessionId };
    autoLeaveOnUnmountRef.current = {
      sessionId: liveSessionId,
      shouldLeave: false,
    };
    dispatchWatchAction({ type: 'end_started', sessionId: liveSessionId });

    commitEndLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.endLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'end',
        );

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (didUnmountRef.current) {
            return;
          }

          dispatchWatchAction({
            error: formatLiveMutationErrors(result?.errors),
            sessionId: liveSessionId,
            type: 'end_failed',
          });
          return;
        }

        hostPublishingSessions.release(liveSessionId);
        stopViewerPlayback({ resetState: true });
        autoLeaveOnUnmountRef.current = {
          sessionId: liveSessionId,
          shouldLeave: false,
        };

        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          sessionId: liveSessionId,
          type: 'end_succeeded',
        });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'end',
        );

        if (didUnmountRef.current) {
          return;
        }

        dispatchWatchAction({
          error: formatLiveMutationErrors([]),
          sessionId: liveSessionId,
          type: 'end_failed',
        });
      },
    });
  }

  async function handleSendChatMessage(body: string): Promise<boolean> {
    if (
      !canStartLiveSessionChatSend({
        channelStatus: chatChannelStatus,
        hasPendingSend:
          chatSendPendingRef.current?.sessionId === liveSessionId,
        sendStatus: chatSendStatus,
      })
    ) {
      return false;
    }

    const client = chatChannelClientRef.current;

    if (!client) {
      return false;
    }

    const sendToken = chatSendTokenRef.current + 1;
    chatSendTokenRef.current = sendToken;
    chatSendPendingRef.current = {
      sessionId: liveSessionId,
      token: sendToken,
    };
    dispatchChatAction({ sessionId: liveSessionId, type: 'send_started' });

    const result = await client.sendChatMessage(body);
    const isActiveSend =
      chatSendPendingRef.current?.sessionId === liveSessionId &&
      chatSendPendingRef.current.token === sendToken;

    if (isActiveSend) {
      chatSendPendingRef.current = null;
    }

    if (didUnmountRef.current || !isActiveSend) {
      return false;
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
      return true;
    }

    dispatchChatAction({
      error: result.reason,
      sessionId: liveSessionId,
      type: 'send_failed',
    });
    return false;
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

      <LiveSessionViewerPlaybackSurface
        isJoined={isJoined}
        state={viewerPlaybackState}
      />

      <LiveSessionDetailsCard
        normalizedStatus={normalizedStatus}
        session={liveSession}
        status={status}
      />

      <LiveSessionWatchControlsCard
        canEndLiveSession={canEndLiveSession}
        enterable={enterable}
        hasActiveSubmission={hasActiveSubmission}
        isEnding={isEnding}
        isHostOwnedSession={isCurrentViewerHost}
        isJoined={isJoined}
        isJoining={isJoining}
        isLeaving={isLeaving}
        normalizedStatus={normalizedStatus}
        onEndPress={handleEndPress}
        onJoinPress={handleJoinPress}
        onLeavePress={handleLeavePress}
        watchError={watchState.error}
      />

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

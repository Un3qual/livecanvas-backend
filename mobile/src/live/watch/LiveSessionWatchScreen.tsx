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
import { createActor } from 'xstate';

import { useAuth } from '../../auth/AuthProvider';
import { ScreenState } from '../../components/ScreenState';
import { useHostBroadcastPublishingSessions } from '../../host/HostBroadcastPublishingSessionProvider';
import { useStartupState } from '../../providers/StartupGate';
import { useAppTheme } from '../../providers/ThemeProvider';
import { createPhoenixSocket } from '../../realtime/phoenixSocket';
import { LiveSessionChatPanel } from '../chat/LiveSessionChatPanel';
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
  selectLiveSessionChatVisibleRows,
} from '../liveSessionChatReducer';
import {
  liveSessionChatChannelMachine,
  selectLiveSessionChatChannelState,
  type LiveSessionChatChannelMachineEvent,
} from '../chat/state/liveSessionChatChannelMachine';
import {
  canEnterLiveSession,
  formatLiveSessionStatus,
  normalizeLiveSessionStatus,
  type LiveSessionStatus,
} from '../liveSessionPresentation';
import { readLiveSessionTimelineHistory } from '../liveSessionTimelineHistory';
import {
  LiveSessionDetailsCard,
  LiveSessionHero,
  LiveSessionWatchControlsCard,
  UnavailableLiveSession,
} from './components/LiveSessionWatchCards';
import { LiveSessionViewerPlaybackSurface } from './components/LiveSessionViewerPlaybackSurface';
import { useLiveSessionWatchController } from './hooks/useLiveSessionWatchController';
import { useLiveSessionViewerPlaybackController } from './hooks/useLiveSessionViewerPlaybackController';
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
  LiveSessionWatchContentProps,
  LiveSessionWatchScreenProps,
  PendingChatSendRef,
  StopViewerPlayback,
} from './liveSessionWatchScreenTypes';

const INITIAL_TIMELINE_HISTORY_COUNT = 30;

type LiveSessionRealtimeStatusMap = ReadonlyMap<string, LiveSessionStatus>;

export function LiveSessionWatchScreen({
  sessionId,
}: LiveSessionWatchScreenProps) {
  const [queryRetryKey, retryQuery] = useReducer((key: number) => key + 1, 0);
  const resetKey = `${sessionId}:${queryRetryKey}`;

  return (
    <LiveSessionWatchErrorBoundary key={resetKey} onRetry={retryQuery}>
      <Suspense
        fallback={
          <ScreenState state="loading" message="Loading live session..." />
        }
      >
        <LiveSessionWatchContent key={resetKey} sessionId={sessionId} />
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
  const [chatState, dispatchChatAction] = useReducer(
    liveSessionChatReducer,
    createLiveSessionChatState(),
  );
  const [chatChannelActor] = useState(() =>
    createActor(liveSessionChatChannelMachine).start(),
  );
  const [chatChannelState, setChatChannelState] = useState(() =>
    selectLiveSessionChatChannelState(chatChannelActor.getSnapshot()),
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
  const chatChannelClientRef = useRef<LiveSessionChannelClient | null>(null);
  const chatSendPendingRef = useRef<PendingChatSendRef['current']>(null);
  const chatSendTokenRef = useRef(0);
  const didUnmountRef = useRef(false);
  const stopViewerPlaybackRef = useRef<StopViewerPlayback>(
    () => undefined,
  );
  const releaseRetainedHostPublishingSessionRef = useRef<
    (liveSessionId: string) => void
  >(() => undefined);

  releaseRetainedHostPublishingSessionRef.current = (liveSessionId) => {
    hostPublishingSessions.release(liveSessionId);
  };

  const watchController = useLiveSessionWatchController({
    commitEndLiveSession,
    commitJoinLiveSession,
    commitLeaveLiveSession,
    liveSessionId: sessionId,
    releaseRetainedHostPublishingSession: (liveSessionId) => {
      releaseRetainedHostPublishingSessionRef.current(liveSessionId);
    },
    stopViewerPlayback: (options) => {
      stopViewerPlaybackRef.current(options);
    },
  });

  const session = data.node?.__typename === 'LiveSession' ? data.node : null;
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
    ? realtimeSessionStatuses.get(session.id) ?? queriedNormalizedStatus
    : queriedNormalizedStatus;
  const enterable = canEnterLiveSession(normalizedStatus);
  const isJoined = session !== null && watchController.isJoined;
  const isJoining = watchController.isJoining;
  const isLeaving = watchController.isLeaving;
  const isEnding = watchController.isEnding;
  const hasActiveSubmission = watchController.hasActiveSubmission;
  const chatRows = selectLiveSessionChatVisibleRows(chatState);
  const chatChannelStatus = chatChannelState.channelStatus;
  const chatSendStatus = chatChannelState.sendStatus;
  const chatSendError = chatChannelState.sendError;
  const hasRetainedHostPublishingSession = session
    ? hostPublishingSessions.has(session.id)
    : false;
  const shouldMaintainSessionRealtimeChannel =
    isJoined || hasRetainedHostPublishingSession;
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

  stopViewerPlaybackRef.current = stopViewerPlayback;

  useEffect(() => {
    dispatchChatAction({ type: 'session_changed', sessionId });
    sendChatChannelEvent({ sessionId, type: 'SESSION_CHANGED' });
    chatSendPendingRef.current = null;
    setRealtimeSessionStatuses(new Map());
  }, [sessionId]);

  function sendChatChannelEvent(event: LiveSessionChatChannelMachineEvent) {
    chatChannelActor.send(event);
    setChatChannelState(
      selectLiveSessionChatChannelState(chatChannelActor.getSnapshot()),
    );
  }

  function markLiveSessionEnded(liveSessionId: string) {
    markLiveSessionRealtimeStatus(liveSessionId, 'ENDED');
  }

  function markLiveSessionRealtimeStatus(
    liveSessionId: string,
    status: LiveSessionStatus,
  ) {
    setRealtimeSessionStatuses((statuses) => {
      if (statuses.get(liveSessionId) === status) {
        return statuses;
      }

      const nextStatuses = new Map(statuses);
      nextStatuses.set(liveSessionId, status);
      return nextStatuses;
    });
  }

  function handleEndedLiveSession(
    liveSessionId: string,
    closeChatChannelForEndedSession: () => void,
  ) {
    markLiveSessionEnded(liveSessionId);
    watchController.handleSessionEnded(
      liveSessionId,
      closeChatChannelForEndedSession,
    );
  }

  useEffect(() => {
    if (session?.id && normalizedStatus === 'ENDED') {
      watchController.handleSessionEnded(session.id);
    }
  }, [normalizedStatus, session?.id, watchController.handleSessionEnded]);

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
    };
  }, []);

  useEffect(() => {
    if (
      !session ||
      !shouldMaintainSessionRealtimeChannel ||
      !session.channelTopic ||
      auth.state.status !== 'authenticated'
    ) {
      chatChannelClientRef.current = null;

      if (session) {
        sendChatChannelEvent({ sessionId: session.id, type: 'CHANNEL_IDLE' });
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
        sendChatChannelEvent({
          sessionId: session.id,
          type: 'CHANNEL_CLOSED',
        });
      },
    });

    const client = createLiveSessionChannelClient({
      onClose: () => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        chatChannelClientRef.current = null;
        clearPendingChatSend(session.id);
        watchController.handleMembershipLost(session.id);
        sendChatChannelEvent({
          sessionId: session.id,
          type: 'CHANNEL_CLOSED',
        });
      },
      onError: (reason) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        chatChannelClientRef.current = null;
        clearPendingChatSend(session.id);
        watchController.handleMembershipLost(session.id);
        sendChatChannelEvent({
          error: reason,
          sessionId: session.id,
          type: 'CHANNEL_ERRORED',
        });
      },
      onSessionState: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        markLiveSessionRealtimeStatus(session.id, event.status);

        if (event.status === 'ENDED') {
          handleEndedLiveSession(session.id, () => {
            chatChannelLifecycle.closeForEndedSession();
          });
          return;
        }

        sendChatChannelEvent({
          sessionId: session.id,
          type: 'CHANNEL_JOINED',
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
    sendChatChannelEvent({
      sessionId: session.id,
      type: 'CHANNEL_JOINING',
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
            handleEndedLiveSession(session.id, () => {
              chatChannelLifecycle.closeForEndedSession();
            });
            return;
          }

          sendChatChannelEvent({
            sessionId: session.id,
            type: 'CHANNEL_JOINED',
          });
          return;
        }

        sendChatChannelEvent({
          error: result.reason,
          sessionId: session.id,
          type: 'CHANNEL_ERRORED',
        });
      })
      .catch((error: unknown) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        sendChatChannelEvent({
          error:
            error instanceof Error ? error.message : 'Chat connection failed.',
          sessionId: session.id,
          type: 'CHANNEL_ERRORED',
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
    watchController.handleMembershipLost,
    watchController.handleSessionEnded,
  ]);

  function failPendingChatSend(sessionId: string, error: string) {
    if (!clearPendingChatSend(sessionId)) {
      return;
    }

    sendChatChannelEvent({
      error,
      sessionId,
      type: 'SEND_FAILED',
    });
  }

  function clearPendingChatSend(sessionId: string): boolean {
    if (chatSendPendingRef.current?.sessionId !== sessionId) {
      return false;
    }

    chatSendPendingRef.current = null;
    return true;
  }

  function cancelPendingChatSend(sessionId: string) {
    if (!clearPendingChatSend(sessionId)) {
      return;
    }

    if (didUnmountRef.current) {
      return;
    }

    sendChatChannelEvent({
      sessionId,
      type: 'SEND_CANCELLED',
    });
  }

  const liveSession = session;

  if (!liveSession) {
    return <UnavailableLiveSession onBack={() => router.back()} />;
  }

  const liveSessionId = liveSession.id;
  const status = formatLiveSessionStatus(normalizedStatus);
  const isCurrentViewerHost = data.viewer?.id === liveSession.host.id;
  const canEndLiveSession =
    isCurrentViewerHost && normalizedStatus !== 'ENDED';

  function handleJoinPress() {
    watchController.requestJoin({
      enterable,
      isCurrentViewerHost,
      liveSessionId,
    });
  }

  function handleLeavePress() {
    watchController.requestLeave({ liveSessionId });
  }

  function handleEndPress() {
    watchController.requestEnd({
      canEndLiveSession,
      liveSessionId,
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
    sendChatChannelEvent({ sessionId: liveSessionId, type: 'SEND_STARTED' });

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
      sendChatChannelEvent({
        sessionId: liveSessionId,
        type: 'SEND_SUCCEEDED',
      });
      return true;
    }

    sendChatChannelEvent({
      error: result.reason,
      sessionId: liveSessionId,
      type: 'SEND_FAILED',
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
        watchError={watchController.error}
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

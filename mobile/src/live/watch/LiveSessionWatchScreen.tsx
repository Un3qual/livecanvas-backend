import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import {
  fetchQuery,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from 'react-relay';

import { useAuth } from '../../auth/AuthProvider';
import { ScreenState } from '../../components/ScreenState';
import { useHostBroadcastPublishingSessions } from '../../host/HostBroadcastPublishingSessionProvider';
import type { HostBroadcastLocalMediaControlsSnapshot } from '../../host/publishing/hostBroadcastLocalMediaControls';
import { useStartupState } from '../../providers/StartupGate';
import { useAppTheme } from '../../providers/ThemeProvider';
import { createPhoenixSocket } from '../../realtime/phoenixSocket';
import { PRIVACY_SENSITIVE_FETCH_OPTIONS } from '../../relay/privacySensitiveFetch';
import { LiveSessionChatPanel } from '../chat/LiveSessionChatPanel';
import {
  canStartLiveSessionChatSend,
  selectLiveSessionChatVisibleRows,
} from '../chat/liveSessionChatSelectors';
import { createLiveSessionChatState } from '../chat/liveSessionChatState';
import { liveSessionChatTimelineReducer } from '../chat/liveSessionChatTimelineReducer';
import {
  useLiveSessionChatControls,
  type LiveSessionChatTimelineMutationAction,
} from '../chat/useLiveSessionChatControls';
import { createLiveSessionChatChannelLifecycle } from '../liveSessionChatChannelLifecycle';
import {
  createLiveSessionChannelClient,
  shouldCloseLiveSessionChatChannelAfterJoin,
  type LiveSessionChannelClient,
} from '../liveSessionChannelClient';
import {
  INITIAL_LIVE_SESSION_CHAT_CHANNEL_STATE,
  type LiveSessionChatChannelMachineEvent,
} from '../chat/state/liveSessionChatChannelMachine';
import {
  createLiveSessionChatChannelActorLifecycle,
} from '../chat/state/liveSessionChatChannelActorLifecycle';
import {
  canEnterLiveSession,
  formatLiveSessionStatus,
  normalizeLiveSessionStatus,
  type LiveSessionStatus,
} from '../liveSessionPresentation';
import {
  readLiveSessionTimelineHistory,
  readLiveSessionTimelinePage,
} from '../liveSessionTimelineHistory';
import {
  createLiveSessionWatchHostMediaControls,
  LiveSessionDetailsCard,
  LiveSessionHero,
  LiveSessionWatchControlsCard,
  UnavailableLiveSession,
} from './components/LiveSessionWatchCards';
import { LiveSessionViewerPlaybackSurface } from './components/LiveSessionViewerPlaybackSurface';
import {
  createLiveSessionOlderTimelinePageLoader,
  useLiveSessionWatchController,
  type LiveSessionOlderTimelinePageLoadState,
  type LiveSessionOlderTimelinePageLoaderLifecycle,
} from './hooks/useLiveSessionWatchController';
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
import {
  canRetryLiveSessionViewerPlayback,
} from './state/liveSessionViewerPlaybackMachine';
import {
  canUseLiveSessionChat,
  resolveRejectedLiveSessionChatSend,
} from './liveSessionWatchChat';
import type {
  LiveSessionWatchScreenProps,
  StopViewerPlayback,
} from './liveSessionWatchScreenTypes';

const INITIAL_TIMELINE_HISTORY_COUNT = 30;

type LiveSessionRealtimeState = Readonly<{
  status: LiveSessionStatus;
  viewerCount: number | null;
}>;

type LiveSessionRealtimeStateMap = ReadonlyMap<
  string,
  LiveSessionRealtimeState
>;

type PendingChatSend = {
  readonly sessionId: string;
  readonly token: number;
};

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
        <LiveSessionWatchContent
          fetchKey={queryRetryKey}
          key={resetKey}
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
  fetchKey,
  sessionId,
}: LiveSessionWatchScreenProps & { fetchKey: number }) {
  const theme = useAppTheme();
  const router = useRouter();
  const auth = useAuth();
  const { environment } = useStartupState();
  const relayEnvironment = useRelayEnvironment();
  const hostPublishingSessions = useHostBroadcastPublishingSessions();
  const data = useLazyLoadQuery<LiveSessionWatchScreenQuery>(
    liveSessionWatchScreenQuery,
    {
      id: sessionId,
      timelineBefore: null,
      timelineLast: INITIAL_TIMELINE_HISTORY_COUNT,
    },
    { ...PRIVACY_SENSITIVE_FETCH_OPTIONS, fetchKey },
  );
  const [chatState, dispatchChatAction] = useReducer(
    liveSessionChatTimelineReducer,
    createLiveSessionChatState(),
  );
  const [chatChannelState, setChatChannelState] = useState(() =>
    INITIAL_LIVE_SESSION_CHAT_CHANNEL_STATE,
  );
  const [chatChannelLifecycle] = useState(() =>
    createLiveSessionChatChannelActorLifecycle({
      onStateChanged: setChatChannelState,
    }),
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
  const [realtimeSessionStates, setRealtimeSessionStates] =
    useState<LiveSessionRealtimeStateMap>(() => new Map());
  const chatChannelClientRef = useRef<LiveSessionChannelClient | null>(null);
  const chatSendPendingRef = useRef<PendingChatSend | null>(null);
  const chatSendTokenRef = useRef(0);
  const didUnmountRef = useRef(false);
  const stopViewerPlaybackRef = useRef<StopViewerPlayback>(
    () => undefined,
  );
  const releaseRetainedHostPublishingSessionRef = useRef<
    (liveSessionId: string) => void
  >(() => undefined);
  const [hostMediaControlsSnapshot, setHostMediaControlsSnapshot] =
    useState<HostBroadcastLocalMediaControlsSnapshot | null>(null);
  const [olderTimelinePageLoadState, setOlderTimelinePageLoadState] =
    useState<LiveSessionOlderTimelinePageLoadState>(() => ({
      error: null,
      isLoading: false,
    }));
  const olderTimelinePageLoaderRef =
    useRef<LiveSessionOlderTimelinePageLoaderLifecycle | null>(null);

  releaseRetainedHostPublishingSessionRef.current = (liveSessionId) => {
    hostPublishingSessions.release(liveSessionId);
  };

  // Keep one loader instance across renders so its request/session tokens can
  // reject stale older-page responses from previous sessions.
  if (!olderTimelinePageLoaderRef.current) {
    olderTimelinePageLoaderRef.current =
      createLiveSessionOlderTimelinePageLoader({
        fetchOlderTimelinePage: async ({
          liveSessionId,
          timelineBefore,
          timelineLast,
        }) => {
          const olderTimelineData =
            await fetchQuery<LiveSessionWatchScreenQuery>(
              relayEnvironment,
              liveSessionWatchScreenQuery,
              {
                id: liveSessionId,
                timelineBefore,
                timelineLast,
              },
              { fetchPolicy: 'network-only' },
            ).toPromise();
          const olderTimelineSession =
            olderTimelineData?.node?.__typename === 'LiveSession'
              ? olderTimelineData.node
              : null;

          if (!olderTimelineSession) {
            return null;
          }

          return readLiveSessionTimelinePage(
            olderTimelineSession.timelineEvents,
          );
        },
        onOlderTimelinePageLoaded: ({ history, sessionId: loadedSessionId }) => {
          dispatchChatAction({
            history,
            sessionId: loadedSessionId,
            type: 'retained_older_loaded',
          });
        },
        onStateChanged: setOlderTimelinePageLoadState,
      });
  }
  const olderTimelinePageLoader = olderTimelinePageLoaderRef.current;

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
  const activeLiveSessionId = session?.id ?? null;
  const activeLiveSessionChannelTopic = session?.channelTopic ?? null;
  const retainedTimelineConnection = session?.timelineEvents ?? null;
  const retainedTimelineHistory = useMemo(
    () =>
      readLiveSessionTimelineHistory(retainedTimelineConnection),
    [retainedTimelineConnection],
  );
  const queriedNormalizedStatus = normalizeLiveSessionStatus(
    session?.status ?? 'ENDED',
  );
  const realtimeSessionState = activeLiveSessionId
    ? realtimeSessionStates.get(activeLiveSessionId)
    : null;
  const normalizedStatus = session
    ? realtimeSessionState?.status ?? queriedNormalizedStatus
    : queriedNormalizedStatus;
  const viewerCount = realtimeSessionState?.viewerCount ?? null;
  const dispatchChatMutation = useCallback(
    (action: LiveSessionChatTimelineMutationAction) => {
      if (!activeLiveSessionId) {
        return;
      }

      dispatchChatAction({
        ...action,
        sessionId: activeLiveSessionId,
      });
    },
    [activeLiveSessionId],
  );
  const chatMessageControlsController = useLiveSessionChatControls({
    dispatchTimeline: dispatchChatMutation,
    hostId: session?.host.id ?? null,
    sessionStatus: normalizedStatus,
    viewerId: data.viewer?.id ?? null,
  });
  const chatMessageControls = useMemo(
    () => ({
      ...chatMessageControlsController,
      hostId: session?.host.id ?? null,
      sessionStatus: normalizedStatus,
      viewerId: data.viewer?.id ?? null,
    }),
    [
      chatMessageControlsController,
      data.viewer?.id,
      normalizedStatus,
      session?.host.id,
    ],
  );
  const enterable = canEnterLiveSession(normalizedStatus);
  const isJoined = session !== null && watchController.isJoined;
  const isJoining = watchController.isJoining;
  const isLeaving = watchController.isLeaving;
  const isEnding = watchController.isEnding;
  const hasActiveSubmission = watchController.hasActiveSubmission;
  const chatRows = selectLiveSessionChatVisibleRows(chatState);
  const canLoadOlderChatHistory =
    chatState.pageInfo?.hasPreviousPage === true;
  const olderTimelineBeforeCursor = chatState.pageInfo?.startCursor ?? null;
  const chatChannelStatus = chatChannelState.channelStatus;
  const chatSendStatus = chatChannelState.sendStatus;
  const chatSendError = chatChannelState.sendError;
  const handleWatchMembershipLost = watchController.handleMembershipLost;
  const handleWatchSessionEnded = watchController.handleSessionEnded;
  const hasRetainedHostPublishingSession = session
    ? hostPublishingSessions.has(activeLiveSessionId ?? '')
    : false;
  const hostLocalMediaControls = session
    ? hostPublishingSessions.controlsFor(activeLiveSessionId ?? '')
    : null;
  const hostControls = createLiveSessionWatchHostMediaControls({
    controls: hostLocalMediaControls,
    isHostOwnedSession: data.viewer?.id === session?.host.id,
    normalizedStatus,
    onSnapshotChanged: setHostMediaControlsSnapshot,
    snapshot:
      hostMediaControlsSnapshot ?? hostLocalMediaControls?.snapshot() ?? null,
  });
  const canUseChat = canUseLiveSessionChat({
    hasRetainedHostPublishingSession,
    isJoined,
  });
  const shouldMaintainSessionRealtimeChannel = canUseChat;
  const { retryViewerPlayback, stopViewerPlayback, viewerPlaybackState } =
    useLiveSessionViewerPlaybackController({
      authStatus: auth.state.status,
      commitPrepareLiveSessionMedia,
      getAccessToken: auth.getAccessToken,
      isJoined,
      isLeaving,
      liveSessionId: activeLiveSessionId,
      normalizedStatus,
      websocketUrl: environment.websocketUrl,
    });

  stopViewerPlaybackRef.current = stopViewerPlayback;

  const sendChatChannelEvent = useCallback(
    (event: LiveSessionChatChannelMachineEvent) => {
      chatChannelLifecycle.send(event);
    },
    [chatChannelLifecycle],
  );

  const markLiveSessionRealtimeStatus = useCallback(
    (liveSessionId: string, status: LiveSessionStatus) => {
      setRealtimeSessionStates((states) => {
        const currentState = states.get(liveSessionId);
        if (currentState?.status === status) {
          return states;
        }

        const nextStates = new Map(states);
        nextStates.set(liveSessionId, {
          status,
          viewerCount: currentState?.viewerCount ?? null,
        });
        return nextStates;
      });
    },
    [],
  );

  const markLiveSessionRealtimeState = useCallback(
    (
      liveSessionId: string,
      status: LiveSessionStatus,
      nextViewerCount: number,
    ) => {
      setRealtimeSessionStates((states) => {
        const currentState = states.get(liveSessionId);
        if (
          currentState?.status === status &&
          currentState.viewerCount === nextViewerCount
        ) {
          return states;
        }

        const nextStates = new Map(states);
        nextStates.set(liveSessionId, {
          status,
          viewerCount: nextViewerCount,
        });
        return nextStates;
      });
    },
    [],
  );

  const markLiveSessionEnded = useCallback(
    (liveSessionId: string) => {
      markLiveSessionRealtimeStatus(liveSessionId, 'ENDED');
    },
    [markLiveSessionRealtimeStatus],
  );

  const handleEndedLiveSession = useCallback(
    (
      liveSessionId: string,
      closeChatChannelForEndedSession?: () => void,
    ) => {
      markLiveSessionEnded(liveSessionId);
      handleWatchSessionEnded(
        liveSessionId,
        closeChatChannelForEndedSession,
      );
    },
    [handleWatchSessionEnded, markLiveSessionEnded],
  );

  const clearPendingChatSend = useCallback((liveSessionId: string): boolean => {
    if (chatSendPendingRef.current?.sessionId !== liveSessionId) {
      return false;
    }

    chatSendPendingRef.current = null;
    return true;
  }, []);

  const failPendingChatSend = useCallback(
    (liveSessionId: string, error: string) => {
      if (!clearPendingChatSend(liveSessionId)) {
        return;
      }

      sendChatChannelEvent({
        error,
        sessionId: liveSessionId,
        type: 'SEND_FAILED',
      });
    },
    [clearPendingChatSend, sendChatChannelEvent],
  );

  const cancelPendingChatSend = useCallback(
    (liveSessionId: string) => {
      if (!clearPendingChatSend(liveSessionId)) {
        return;
      }

      if (didUnmountRef.current) {
        return;
      }

      sendChatChannelEvent({
        sessionId: liveSessionId,
        type: 'SEND_CANCELLED',
      });
    },
    [clearPendingChatSend, sendChatChannelEvent],
  );

  useEffect(() => {
    chatChannelLifecycle.start();
    setChatChannelState(chatChannelLifecycle.getState());

    return () => {
      chatChannelLifecycle.stop();
    };
  }, [chatChannelLifecycle]);

  useEffect(() => {
    dispatchChatAction({ type: 'session_changed', sessionId });
    olderTimelinePageLoader.syncSession(sessionId);
    sendChatChannelEvent({ sessionId, type: 'SESSION_CHANGED' });
    chatSendPendingRef.current = null;
    setRealtimeSessionStates(new Map());
  }, [olderTimelinePageLoader, sendChatChannelEvent, sessionId]);

  useEffect(() => {
    if (activeLiveSessionId && normalizedStatus === 'ENDED') {
      handleWatchSessionEnded(activeLiveSessionId);
    }
  }, [activeLiveSessionId, handleWatchSessionEnded, normalizedStatus]);

  useEffect(() => {
    setHostMediaControlsSnapshot(hostLocalMediaControls?.snapshot() ?? null);
  }, [activeLiveSessionId, hostLocalMediaControls]);

  useEffect(() => {
    if (!activeLiveSessionId) {
      return;
    }

    dispatchChatAction({
      history: retainedTimelineHistory,
      sessionId: activeLiveSessionId,
      type: 'retained_initial_loaded',
    });
  }, [activeLiveSessionId, retainedTimelineHistory]);

  useEffect(() => {
    didUnmountRef.current = false;

    return () => {
      didUnmountRef.current = true;
    };
  }, []);

  useEffect(
    () => {
      olderTimelinePageLoader.mount();

      return () => {
        olderTimelinePageLoader.unmount();
      };
    },
    [olderTimelinePageLoader],
  );

  useEffect(() => {
    if (
      !activeLiveSessionId ||
      !shouldMaintainSessionRealtimeChannel ||
      !activeLiveSessionChannelTopic ||
      auth.state.status !== 'authenticated'
    ) {
      // Keep the channel only while a joined viewer or retained host publishing
      // session needs it; otherwise clear the client so stale signaling cannot
      // leak across sessions.
      chatChannelClientRef.current = null;

      if (activeLiveSessionId) {
        sendChatChannelEvent({
          sessionId: activeLiveSessionId,
          type: 'CHANNEL_IDLE',
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
        failPendingChatSend(
          activeLiveSessionId,
          'This live session has ended.',
        );
      },
      leaveChannel: () => {
        chatChannelClient?.leave();
      },
      markClosedForEndedSession: () => {
        sendChatChannelEvent({
          sessionId: activeLiveSessionId,
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
        clearPendingChatSend(activeLiveSessionId);
        handleWatchMembershipLost(activeLiveSessionId);
        sendChatChannelEvent({
          sessionId: activeLiveSessionId,
          type: 'CHANNEL_CLOSED',
        });
      },
      onError: (reason) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        chatChannelClientRef.current = null;
        clearPendingChatSend(activeLiveSessionId);
        handleWatchMembershipLost(activeLiveSessionId);
        sendChatChannelEvent({
          error: reason,
          sessionId: activeLiveSessionId,
          type: 'CHANNEL_ERRORED',
        });
      },
      onSessionState: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        markLiveSessionRealtimeState(
          activeLiveSessionId,
          event.status,
          event.viewerCount,
        );

        if (event.status === 'ENDED') {
          handleEndedLiveSession(activeLiveSessionId, () => {
            chatChannelLifecycle.closeForEndedSession();
          });
          return;
        }

        sendChatChannelEvent({
          sessionId: activeLiveSessionId,
          type: 'CHANNEL_JOINED',
        });
      },
      onTimelineEvent: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: activeLiveSessionId,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventRemoved: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: activeLiveSessionId,
          type: 'realtime_event_received',
        });
      },
      onTimelineEventUpdated: (event) => {
        if (!chatChannelLifecycle.isActive()) {
          return;
        }

        dispatchChatAction({
          event,
          sessionId: activeLiveSessionId,
          type: 'realtime_event_received',
        });
      },
      socket,
      topic: activeLiveSessionChannelTopic,
    });

    chatChannelClient = client;
    chatChannelClientRef.current = client;
    sendChatChannelEvent({
      sessionId: activeLiveSessionId,
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
            handleEndedLiveSession(activeLiveSessionId, () => {
              chatChannelLifecycle.closeForEndedSession();
            });
            return;
          }

          sendChatChannelEvent({
            sessionId: activeLiveSessionId,
            type: 'CHANNEL_JOINED',
          });
          return;
        }

        sendChatChannelEvent({
          error: result.reason,
          sessionId: activeLiveSessionId,
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
          sessionId: activeLiveSessionId,
          type: 'CHANNEL_ERRORED',
        });
      });

    return () => {
      cancelPendingChatSend(activeLiveSessionId);
      chatChannelLifecycle.cleanup();
    };
  }, [
    activeLiveSessionChannelTopic,
    activeLiveSessionId,
    auth.getAccessToken,
    auth.state.status,
    cancelPendingChatSend,
    clearPendingChatSend,
    environment.websocketUrl,
    failPendingChatSend,
    handleEndedLiveSession,
    handleWatchMembershipLost,
    hostPublishingSessions,
    markLiveSessionRealtimeState,
    sendChatChannelEvent,
    shouldMaintainSessionRealtimeChannel,
  ]);

  const handleLoadOlderChatMessages = useCallback(() => {
    if (!activeLiveSessionId) {
      return;
    }

    olderTimelinePageLoader.requestOlderPage({
      canLoadOlder: canLoadOlderChatHistory,
      liveSessionId: activeLiveSessionId,
      timelineBefore: olderTimelineBeforeCursor,
      timelineLast: INITIAL_TIMELINE_HISTORY_COUNT,
    });
  }, [
    activeLiveSessionId,
    canLoadOlderChatHistory,
    olderTimelineBeforeCursor,
    olderTimelinePageLoader,
  ]);

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

    let result: Awaited<ReturnType<LiveSessionChannelClient['sendChatMessage']>>;

    try {
      result = await client.sendChatMessage(body);
    } catch (error: unknown) {
      const rejectedSend = resolveRejectedLiveSessionChatSend({
        didUnmount: didUnmountRef.current,
        error,
        liveSessionId,
        pendingSend: chatSendPendingRef.current,
        sendToken,
      });

      chatSendPendingRef.current = rejectedSend.nextPendingSend;

      if (rejectedSend.failureEvent) {
        sendChatChannelEvent(rejectedSend.failureEvent);
      }

      return false;
    }

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
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <LiveSessionHero
        isJoined={isJoined}
        session={liveSession}
        status={status}
        normalizedStatus={normalizedStatus}
        viewerCount={viewerCount}
      />

      <LiveSessionViewerPlaybackSurface
        isJoined={isJoined}
        recovery={{
          canRetry: canRetryLiveSessionViewerPlayback({
            enterable,
            isJoined,
            state: viewerPlaybackState,
          }),
          onRetry: retryViewerPlayback,
        }}
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
        hostControls={hostControls}
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
        canLoadOlder={canLoadOlderChatHistory}
        channelStatus={chatChannelStatus}
        isJoined={canUseChat}
        isLoadingOlder={olderTimelinePageLoadState.isLoading}
        messageControls={chatMessageControls}
        olderLoadError={olderTimelinePageLoadState.error}
        onLoadOlder={handleLoadOlderChatMessages}
        onSendMessage={handleSendChatMessage}
        rows={chatRows}
        sendError={chatSendError}
        sendStatus={chatSendStatus}
      />
    </ScrollView>
  );
}

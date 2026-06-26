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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ScreenState } from '../components/ScreenState';
import { useHostBroadcastPublishingSessions } from '../host/HostBroadcastPublishingSessionProvider';
import { formatProfileIdentity } from '../profile/profilePresentation';
import { useStartupState } from '../providers/StartupGate';
import { useAppTheme } from '../providers/ThemeProvider';
import { createPhoenixSocket } from '../realtime/phoenixSocket';
import { radius, spacing, typography } from '../theme/tokens';
import { LiveSessionChatPanel } from './LiveSessionChatPanel';
import { createLiveSessionChatChannelLifecycle } from './liveSessionChatChannelLifecycle';
import {
  createLiveSessionChannelClient,
  shouldCloseLiveSessionChatChannelAfterJoin,
  type LiveSessionChannelClient,
} from './liveSessionChannelClient';
import {
  canStartLiveSessionChatSend,
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
} from './liveSessionTimelineHistory';
import { handleLiveSessionEndedRealtimeCleanup } from './liveSessionEndedRealtimeCleanup';
import {
  createDefaultLiveSessionViewerPeerConnectionFactory,
  createLiveSessionViewerPlaybackRuntime,
  readPreparedLiveSessionViewerMedia,
  type LiveSessionViewerPlaybackRuntime,
} from './liveSessionViewerPlaybackRuntime';
import { handleLiveSessionViewerPlaybackChannelTerminated } from './liveSessionViewerPlaybackLifecycle';
import type { LiveSessionWatchScreenEndMutation } from './__generated__/LiveSessionWatchScreenEndMutation.graphql';
import type { LiveSessionWatchScreenJoinMutation } from './__generated__/LiveSessionWatchScreenJoinMutation.graphql';
import type { LiveSessionWatchScreenLeaveMutation } from './__generated__/LiveSessionWatchScreenLeaveMutation.graphql';
import type { LiveSessionWatchScreenPrepareMediaMutation } from './__generated__/LiveSessionWatchScreenPrepareMediaMutation.graphql';
import type { LiveSessionWatchScreenQuery } from './__generated__/LiveSessionWatchScreenQuery.graphql';

type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];
type LiveSessionRTCViewProps = {
  readonly objectFit?: 'contain' | 'cover';
  readonly streamURL: string;
  readonly style?: unknown;
};
type ReactNativeWebRtcViewModule = Readonly<{
  RTCView?: React.ComponentType<LiveSessionRTCViewProps>;
}>;
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

type PendingChatSendRef = {
  current: { readonly sessionId: string; readonly token: number } | null;
};

type AutoLeaveOnUnmountRef = {
  current: { readonly sessionId: string; readonly shouldLeave: boolean } | null;
};

type ViewerPlaybackStatus =
  | 'idle'
  | 'preparing'
  | 'connecting'
  | 'waiting_for_host'
  | 'playing'
  | 'errored'
  | 'closed';

type ViewerPlaybackState = {
  readonly error: string | null;
  readonly remoteStreamUrl: string | null;
  readonly status: ViewerPlaybackStatus;
};

type ViewerPlaybackResource = {
  readonly disconnectSocket: () => void;
  readonly generation: number;
  readonly runtime: LiveSessionViewerPlaybackRuntime;
  readonly sessionId: string;
};

type LiveSessionWatchContentProps = LiveSessionWatchScreenProps & {
  pendingMutationRef: PendingMutationRef;
};

declare const require:
  | undefined
  | ((moduleName: 'react-native-webrtc') => ReactNativeWebRtcViewModule);

const LiveSessionRTCView = resolveLiveSessionRTCView();

function resolveLiveSessionRTCView(): React.ComponentType<LiveSessionRTCViewProps> | null {
  if (typeof require === 'undefined') {
    return null;
  }

  try {
    return require('react-native-webrtc').RTCView ?? null;
  } catch {
    return null;
  }
}

const INITIAL_TIMELINE_HISTORY_COUNT = 30;

const INITIAL_VIEWER_PLAYBACK_STATE: ViewerPlaybackState = {
  error: null,
  remoteStreamUrl: null,
  status: 'idle',
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

const liveSessionWatchScreenPrepareMediaMutation = graphql`
  mutation LiveSessionWatchScreenPrepareMediaMutation(
    $input: PrepareLiveMediaSessionInput!
  ) {
    prepareLiveMediaSession(input: $input) {
      liveSession {
        id
        status
      }
      signalingTopic
      iceServers {
        urls
        username
        credential
        credentialType
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

const liveSessionWatchScreenEndMutation = graphql`
  mutation LiveSessionWatchScreenEndMutation($input: EndLiveSessionInput!) {
    endLiveSession(input: $input) {
      liveSession {
        id
        status
        endedAt
        channelTopic
      }
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
  mediaFrame: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  mediaPlaceholder: {
    padding: spacing.md,
  },
  remoteVideo: {
    height: '100%',
    width: '100%',
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
  const hostPublishingSessions = useHostBroadcastPublishingSessions();
  const data = useLazyLoadQuery<LiveSessionWatchScreenQuery>(
    graphql`
      query LiveSessionWatchScreenQuery(
        $id: ID!
        $timelineLast: Int!
        $timelineBefore: String
      ) {
        viewer {
          id
        }
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
  const [viewerPlaybackState, setViewerPlaybackState] =
    useState<ViewerPlaybackState>(INITIAL_VIEWER_PLAYBACK_STATE);
  const autoLeaveOnUnmountRef = useRef<
    AutoLeaveOnUnmountRef['current']
  >(null);
  const chatChannelClientRef = useRef<LiveSessionChannelClient | null>(null);
  const chatSendPendingRef = useRef<PendingChatSendRef['current']>(null);
  const chatSendTokenRef = useRef(0);
  const didUnmountRef = useRef(false);
  const leaveMutationRef = useRef(commitLeaveLiveSession);
  const viewerPlaybackGenerationRef = useRef(0);
  const viewerPlaybackResourceRef = useRef<ViewerPlaybackResource | null>(null);

  leaveMutationRef.current = commitLeaveLiveSession;

  const session =
    data.node?.__typename === 'LiveSession' ? data.node : null;
  const retainedTimelineConnection = session?.timelineEvents ?? null;
  const retainedTimelineHistory = useMemo(
    () =>
      readLiveSessionTimelineHistory(retainedTimelineConnection),
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
  const isEnding = visibleSubmission === 'ending';
  const hasActiveSubmission = visibleSubmission !== 'idle';
  const chatRows = selectLiveSessionChatVisibleRows(chatState);
  const chatChannelStatus = selectLiveSessionChatChannelStatus(chatState);
  const chatSendStatus = selectLiveSessionChatSendStatus(chatState);
  const chatSendError = selectLiveSessionChatSendError(chatState);

  useEffect(() => {
    dispatchWatchAction({ type: 'session_changed', sessionId });
    dispatchChatAction({ type: 'session_changed', sessionId });
    chatSendPendingRef.current = null;
  }, [sessionId]);

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
      !isJoined ||
      isLeaving ||
      normalizedStatus === 'ENDED' ||
      auth.state.status !== 'authenticated'
    ) {
      stopViewerPlayback({ resetState: true });
      return undefined;
    }

    const generation = startViewerPlayback(session.id);

    return () => {
      stopViewerPlaybackGeneration(generation, { resetState: false });
    };
  }, [
    auth.getAccessToken,
    auth.state.status,
    commitPrepareLiveSessionMedia,
    environment.websocketUrl,
    isJoined,
    isLeaving,
    normalizedStatus,
    session?.id,
  ]);

  function startViewerPlayback(liveSessionId: string): number {
    const generation = viewerPlaybackGenerationRef.current + 1;
    viewerPlaybackGenerationRef.current = generation;
    disposeViewerPlaybackResource();
    setViewerPlaybackState({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    try {
      commitPrepareLiveSessionMedia({
        variables: {
          input: {
            liveSessionId,
          },
        },
        onCompleted: (payload) => {
          if (!isViewerPlaybackGenerationActive(generation)) {
            return;
          }

          const prepared = readPreparedLiveSessionViewerMedia(
            payload.prepareLiveMediaSession,
          );

          if (!prepared) {
            setViewerPlaybackState({
              error: formatLiveMutationErrors(
                payload.prepareLiveMediaSession?.errors,
              ),
              remoteStreamUrl: null,
              status: 'errored',
            });
            return;
          }

          const peerConnectionFactory =
            createDefaultLiveSessionViewerPeerConnectionFactory();

          if (!peerConnectionFactory) {
            setViewerPlaybackState({
              error: 'Live video playback is not available on this device.',
              remoteStreamUrl: null,
              status: 'errored',
            });
            return;
          }

          const socket = createPhoenixSocket({
            getAccessToken: auth.getAccessToken,
            websocketUrl: environment.websocketUrl,
          });
          const runtime = createLiveSessionViewerPlaybackRuntime({
            onChannelTerminated: () => {
              handleLiveSessionViewerPlaybackChannelTerminated({
                generation,
                isGenerationActive: isViewerPlaybackGenerationActive,
                setClosed: () => {
                  setViewerPlaybackState({
                    error: null,
                    remoteStreamUrl: null,
                    status: 'closed',
                  });
                },
                stopPlaybackGeneration: stopViewerPlaybackGeneration,
              });
            },
            onError: (reason) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              stopViewerPlaybackGeneration(generation, { resetState: false });
              setViewerPlaybackState({
                error: reason,
                remoteStreamUrl: null,
                status: 'errored',
              });
            },
            onRemoteStream: (stream) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              const remoteStreamUrl = stream?.toURL?.() ?? null;

              setViewerPlaybackState((current) => ({
                error: current.error,
                remoteStreamUrl,
                status: remoteStreamUrl ? 'playing' : current.status,
              }));
            },
            peerConnectionFactory,
            preparedMedia: prepared,
            socket,
          });

          viewerPlaybackResourceRef.current = {
            disconnectSocket: () => {
              socket.disconnect();
            },
            generation,
            runtime,
            sessionId: liveSessionId,
          };

          setViewerPlaybackState({
            error: null,
            remoteStreamUrl: null,
            status: 'connecting',
          });
          socket.connect();

          runtime
            .start()
            .then((result) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              if (result.status === 'started') {
                setViewerPlaybackState((current) => ({
                  error: null,
                  remoteStreamUrl: current.remoteStreamUrl,
                  status: current.remoteStreamUrl
                    ? 'playing'
                    : 'waiting_for_host',
                }));
                return;
              }

              disposeViewerPlaybackResource(generation);
              setViewerPlaybackState({
                error: result.reason,
                remoteStreamUrl: null,
                status: 'errored',
              });
            })
            .catch((error: unknown) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              disposeViewerPlaybackResource(generation);
              setViewerPlaybackState({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Could not start live video playback. Please try again.',
                remoteStreamUrl: null,
                status: 'errored',
              });
            });
        },
        onError: () => {
          if (!isViewerPlaybackGenerationActive(generation)) {
            return;
          }

          setViewerPlaybackState({
            error: formatLiveMutationErrors([]),
            remoteStreamUrl: null,
            status: 'errored',
          });
        },
      });
    } catch {
      if (isViewerPlaybackGenerationActive(generation)) {
        setViewerPlaybackState({
          error: formatLiveMutationErrors([]),
          remoteStreamUrl: null,
          status: 'errored',
        });
      }
    }

    return generation;
  }

  function isViewerPlaybackGenerationActive(generation: number): boolean {
    return (
      !didUnmountRef.current &&
      viewerPlaybackGenerationRef.current === generation
    );
  }

  function stopViewerPlayback({
    resetState,
  }: {
    readonly resetState: boolean;
  }) {
    viewerPlaybackGenerationRef.current += 1;
    disposeViewerPlaybackResource();

    if (resetState && !didUnmountRef.current) {
      setViewerPlaybackState(INITIAL_VIEWER_PLAYBACK_STATE);
    }
  }

  function stopViewerPlaybackGeneration(
    generation: number,
    {
      resetState,
    }: {
      readonly resetState: boolean;
    },
  ) {
    if (viewerPlaybackGenerationRef.current === generation) {
      viewerPlaybackGenerationRef.current += 1;
    }

    disposeViewerPlaybackResource(generation);

    if (resetState && !didUnmountRef.current) {
      setViewerPlaybackState(INITIAL_VIEWER_PLAYBACK_STATE);
    }
  }

  function disposeViewerPlaybackResource(generation?: number) {
    const resource = viewerPlaybackResourceRef.current;

    if (!resource || (generation !== undefined && resource.generation !== generation)) {
      return;
    }

    // Viewer playback work is generation-scoped so stale prepare/start
    // continuations cannot dispose the newer runtime that replaced them.
    viewerPlaybackResourceRef.current = null;
    resource.runtime.dispose();
    resource.disconnectSocket();
  }

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

        if (event.status === 'ENDED') {
          handleLiveSessionEndedRealtimeCleanup({
            closeChatChannelForEndedSession: () => {
              chatChannelLifecycle.closeForEndedSession();
            },
            liveSessionId: session.id,
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
              closeChatChannelForEndedSession: () => {
                chatChannelLifecycle.closeForEndedSession();
              },
              liveSessionId: session.id,
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
  const isCurrentViewerHost = data.viewer?.id === liveSession.host.id;
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
        {isEnding ? (
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            Ending live session...
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
        {canEndLiveSession ? (
          <AppButton
            disabled={isEnding || hasActiveSubmission}
            label={isEnding ? 'Ending live...' : 'End live'}
            onPress={handleEndPress}
            variant="secondary"
          />
        ) : null}
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

function LiveSessionViewerPlaybackSurface({
  isJoined,
  state,
}: {
  isJoined: boolean;
  state: ViewerPlaybackState;
}) {
  const theme = useAppTheme();
  const message = viewerPlaybackMessage(isJoined, state);
  const RTCViewComponent = LiveSessionRTCView;

  return (
    <AppCard>
      <SectionHeading title="Live video" />
      <View style={[styles.mediaFrame, { backgroundColor: '#050505' }]}>
        {state.remoteStreamUrl && RTCViewComponent ? (
          <RTCViewComponent
            objectFit="cover"
            streamURL={state.remoteStreamUrl}
            style={styles.remoteVideo}
          />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Text
              style={[
                styles.bodyText,
                {
                  color:
                    state.status === 'errored'
                      ? theme.colors.error
                      : theme.colors.surfaceMuted,
                  textAlign: 'center',
                },
              ]}
            >
              {message}
            </Text>
          </View>
        )}
      </View>
    </AppCard>
  );
}

function viewerPlaybackMessage(
  isJoined: boolean,
  state: ViewerPlaybackState,
): string {
  if (!isJoined) {
    return 'Join live to watch host video.';
  }

  if (state.error) {
    return state.error;
  }

  switch (state.status) {
    case 'preparing':
      return 'Preparing live video...';
    case 'connecting':
      return 'Connecting live video...';
    case 'waiting_for_host':
      return 'Waiting for host video...';
    case 'playing':
      return 'Live video is playing.';
    case 'closed':
      return 'Live video disconnected.';
    case 'errored':
      return 'Could not start live video playback. Please try again.';
    case 'idle':
    default:
      return 'Live video will start after you join.';
  }
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

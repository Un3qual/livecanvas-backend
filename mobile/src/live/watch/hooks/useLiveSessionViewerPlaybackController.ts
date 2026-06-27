import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { UseMutationConfig } from 'react-relay';

import type { AuthState } from '../../../auth/types';
import {
  createPhoenixSocket,
  type PhoenixAccessTokenProvider,
  type PhoenixSocket,
  type PhoenixSocketOptions,
} from '../../../realtime/phoenixSocket';
import type { LiveSessionWatchScreenPrepareMediaMutation } from '../../../__generated__/LiveSessionWatchScreenPrepareMediaMutation.graphql';
import {
  formatLiveMutationErrors,
  type LiveSessionStatus,
} from '../../liveSessionPresentation';
import {
  createDefaultLiveSessionViewerPeerConnectionFactory,
  createLiveSessionViewerPlaybackRuntime,
  type LiveSessionViewerPlaybackPeerConnectionFactory,
  type LiveSessionViewerPlaybackRuntime,
  type LiveSessionViewerPlaybackRuntimeOptions,
} from '../../playback/liveSessionViewerPlaybackRuntime';
import { readPreparedLiveSessionViewerMedia } from '../../playback/liveSessionViewerPlaybackPreparation';
import { handleLiveSessionViewerPlaybackChannelTerminated } from '../../liveSessionViewerPlaybackLifecycle';
import type {
  StopViewerPlayback,
  StopViewerPlaybackGeneration,
  ViewerPlaybackState,
} from '../liveSessionWatchScreenTypes';

const INITIAL_VIEWER_PLAYBACK_STATE: ViewerPlaybackState = {
  error: null,
  remoteStreamUrl: null,
  status: 'idle',
};

export type LiveSessionViewerPlaybackResource = {
  readonly disconnectSocket: () => void;
  readonly generation: number;
  readonly runtime: LiveSessionViewerPlaybackRuntime;
};

export type PrepareLiveSessionMediaCommit = (
  config: UseMutationConfig<LiveSessionWatchScreenPrepareMediaMutation>,
) => unknown;

type ViewerPlaybackStateUpdate =
  | ViewerPlaybackState
  | ((current: ViewerPlaybackState) => ViewerPlaybackState);

type ViewerPlaybackStateSetter = (state: ViewerPlaybackStateUpdate) => void;

type LiveSessionViewerPlaybackControllerSyncOptions = {
  readonly authStatus: AuthState['status'];
  readonly isJoined: boolean;
  readonly isLeaving: boolean;
  readonly liveSessionId: string | null;
  readonly normalizedStatus: LiveSessionStatus;
};

export type LiveSessionViewerPlaybackControllerLifecycle = {
  readonly stopViewerPlayback: StopViewerPlayback;
  readonly stopViewerPlaybackGeneration: StopViewerPlaybackGeneration;
  readonly syncViewerPlayback: (
    options: LiveSessionViewerPlaybackControllerSyncOptions,
  ) => (() => void) | undefined;
  readonly unmount: () => void;
};

export type LiveSessionViewerPlaybackControllerLifecycleOptions = {
  readonly commitPrepareLiveSessionMedia: PrepareLiveSessionMediaCommit;
  readonly createPeerConnectionFactory?: () =>
    | LiveSessionViewerPlaybackPeerConnectionFactory
    | null;
  readonly createPlaybackRuntime?: (
    options: LiveSessionViewerPlaybackRuntimeOptions,
  ) => LiveSessionViewerPlaybackRuntime;
  readonly createSocket?: (options: PhoenixSocketOptions) => PhoenixSocket;
  readonly getAccessToken: PhoenixAccessTokenProvider;
  readonly isMountedRef: MutableRefObject<boolean>;
  readonly setViewerPlaybackState: ViewerPlaybackStateSetter;
  readonly viewerPlaybackGenerationRef: MutableRefObject<number>;
  readonly viewerPlaybackResourceRef: MutableRefObject<LiveSessionViewerPlaybackResource | null>;
  readonly websocketUrl: string;
};

export type LiveSessionViewerPlaybackControllerOptions =
  LiveSessionViewerPlaybackControllerSyncOptions & {
    readonly commitPrepareLiveSessionMedia: PrepareLiveSessionMediaCommit;
    readonly getAccessToken: PhoenixAccessTokenProvider;
    readonly websocketUrl: string;
  };

export type LiveSessionViewerPlaybackController = {
  readonly stopViewerPlayback: StopViewerPlayback;
  readonly stopViewerPlaybackGeneration: StopViewerPlaybackGeneration;
  readonly viewerPlaybackState: ViewerPlaybackState;
};

export function createLiveSessionViewerPlaybackControllerLifecycle({
  commitPrepareLiveSessionMedia,
  createPeerConnectionFactory =
    createDefaultLiveSessionViewerPeerConnectionFactory,
  createPlaybackRuntime = createLiveSessionViewerPlaybackRuntime,
  createSocket = createPhoenixSocket,
  getAccessToken,
  isMountedRef,
  setViewerPlaybackState,
  viewerPlaybackGenerationRef,
  viewerPlaybackResourceRef,
  websocketUrl,
}: LiveSessionViewerPlaybackControllerLifecycleOptions): LiveSessionViewerPlaybackControllerLifecycle {
  function syncViewerPlayback({
    authStatus,
    isJoined,
    isLeaving,
    liveSessionId,
    normalizedStatus,
  }: LiveSessionViewerPlaybackControllerSyncOptions) {
    if (
      !liveSessionId ||
      !isJoined ||
      isLeaving ||
      normalizedStatus === 'ENDED' ||
      authStatus !== 'authenticated'
    ) {
      stopViewerPlayback({ resetState: true });
      return undefined;
    }

    const generation = startViewerPlayback(liveSessionId);

    return () => {
      stopViewerPlaybackGeneration(generation, { resetState: false });
    };
  }

  function startViewerPlayback(currentLiveSessionId: string): number {
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
            liveSessionId: currentLiveSessionId,
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

          const peerConnectionFactory = createPeerConnectionFactory();

          if (!peerConnectionFactory) {
            setViewerPlaybackState({
              error: 'Live video playback is not available on this device.',
              remoteStreamUrl: null,
              status: 'errored',
            });
            return;
          }

          const socket = createSocket({
            getAccessToken,
            websocketUrl,
          });
          const runtime = createPlaybackRuntime({
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
      isMountedRef.current &&
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

    if (resetState && isMountedRef.current) {
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

    if (resetState && isMountedRef.current) {
      setViewerPlaybackState(INITIAL_VIEWER_PLAYBACK_STATE);
    }
  }

  function disposeViewerPlaybackResource(generation?: number) {
    const resource = viewerPlaybackResourceRef.current;

    if (
      !resource ||
      (generation !== undefined && resource.generation !== generation)
    ) {
      return;
    }

    // Viewer playback work is generation-scoped so stale prepare/start
    // continuations cannot dispose the newer runtime that replaced them.
    viewerPlaybackResourceRef.current = null;
    resource.runtime.dispose();
    resource.disconnectSocket();
  }

  function unmount() {
    isMountedRef.current = false;
    stopViewerPlayback({ resetState: false });
  }

  return {
    stopViewerPlayback,
    stopViewerPlaybackGeneration,
    syncViewerPlayback,
    unmount,
  };
}

export function useLiveSessionViewerPlaybackController({
  authStatus,
  commitPrepareLiveSessionMedia,
  getAccessToken,
  isJoined,
  isLeaving,
  liveSessionId,
  normalizedStatus,
  websocketUrl,
}: LiveSessionViewerPlaybackControllerOptions): LiveSessionViewerPlaybackController {
  const [viewerPlaybackState, setViewerPlaybackState] =
    useState<ViewerPlaybackState>(INITIAL_VIEWER_PLAYBACK_STATE);
  const isMountedRef = useRef(true);
  const viewerPlaybackGenerationRef = useRef(0);
  const viewerPlaybackResourceRef =
    useRef<LiveSessionViewerPlaybackResource | null>(null);
  const controller = createLiveSessionViewerPlaybackControllerLifecycle({
    commitPrepareLiveSessionMedia,
    getAccessToken,
    isMountedRef,
    setViewerPlaybackState,
    viewerPlaybackGenerationRef,
    viewerPlaybackResourceRef,
    websocketUrl,
  });

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      controller.unmount();
    };
  }, []);

  useEffect(
    () =>
      controller.syncViewerPlayback({
        authStatus,
        isJoined,
        isLeaving,
        liveSessionId,
        normalizedStatus,
      }),
    [
      authStatus,
      commitPrepareLiveSessionMedia,
      getAccessToken,
      isJoined,
      isLeaving,
      liveSessionId,
      normalizedStatus,
      websocketUrl,
    ],
  );

  return {
    stopViewerPlayback: controller.stopViewerPlayback,
    stopViewerPlaybackGeneration: controller.stopViewerPlaybackGeneration,
    viewerPlaybackState,
  };
}

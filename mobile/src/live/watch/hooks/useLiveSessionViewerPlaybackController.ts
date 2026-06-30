import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { UseMutationConfig } from 'react-relay';
import { createActor } from 'xstate';

import type { AuthState } from '../../../auth/types';
import {
  createPhoenixSocket,
  type PhoenixAccessTokenProvider,
  type PhoenixSocket,
  type PhoenixSocketOptions,
} from '../../../realtime/phoenixSocket';
import {
  canEnterLiveSession,
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
import type {
  StopViewerPlayback,
  StopViewerPlaybackGeneration,
  ViewerPlaybackState,
} from '../liveSessionWatchScreenTypes';
import type { LiveSessionWatchScreenPrepareMediaMutation } from '../liveSessionWatchOperations';
import {
  canRetryLiveSessionViewerPlayback,
  INITIAL_VIEWER_PLAYBACK_STATE,
  liveSessionViewerPlaybackMachine,
  selectLiveSessionViewerPlaybackState,
  type LiveSessionViewerPlaybackMachineEvent,
} from '../state/liveSessionViewerPlaybackMachine';

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
  readonly retryViewerPlayback: () => void;
  readonly stopViewerPlayback: StopViewerPlayback;
  readonly stopViewerPlaybackGeneration: StopViewerPlaybackGeneration;
  readonly syncViewerPlayback: (
    options: LiveSessionViewerPlaybackControllerSyncOptions,
  ) => (() => void) | undefined;
  readonly unmount: () => void;
  readonly updateOptions: (
    options: LiveSessionViewerPlaybackControllerLifecycleOptions,
  ) => void;
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
  readonly retryViewerPlayback: () => void;
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
  const viewerPlaybackActor = createActor(
    liveSessionViewerPlaybackMachine,
  ).start();
  let currentCommitPrepareLiveSessionMedia = commitPrepareLiveSessionMedia;
  let currentCreatePeerConnectionFactory = createPeerConnectionFactory;
  let currentCreatePlaybackRuntime = createPlaybackRuntime;
  let currentCreateSocket = createSocket;
  let currentGetAccessToken = getAccessToken;
  let currentWebsocketUrl = websocketUrl;
  let currentSyncOptions: LiveSessionViewerPlaybackControllerSyncOptions | null =
    null;

  function updateOptions(
    nextOptions: LiveSessionViewerPlaybackControllerLifecycleOptions,
  ) {
    currentCommitPrepareLiveSessionMedia =
      nextOptions.commitPrepareLiveSessionMedia;
    currentCreatePeerConnectionFactory =
      nextOptions.createPeerConnectionFactory ??
      createDefaultLiveSessionViewerPeerConnectionFactory;
    currentCreatePlaybackRuntime =
      nextOptions.createPlaybackRuntime ?? createLiveSessionViewerPlaybackRuntime;
    currentCreateSocket = nextOptions.createSocket ?? createPhoenixSocket;
    currentGetAccessToken = nextOptions.getAccessToken;
    currentWebsocketUrl = nextOptions.websocketUrl;
  }

  function sendViewerPlaybackEvent(
    event: LiveSessionViewerPlaybackMachineEvent,
  ) {
    viewerPlaybackActor.send(event);

    if (isMountedRef.current) {
      setViewerPlaybackState(
        selectLiveSessionViewerPlaybackState(
          viewerPlaybackActor.getSnapshot(),
        ),
      );
    }
  }

  function syncViewerPlayback({
    authStatus,
    isJoined,
    isLeaving,
    liveSessionId,
    normalizedStatus,
  }: LiveSessionViewerPlaybackControllerSyncOptions) {
    currentSyncOptions = {
      authStatus,
      isJoined,
      isLeaving,
      liveSessionId,
      normalizedStatus,
    };

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

  function retryViewerPlayback() {
    const syncOptions = currentSyncOptions;

    if (!syncOptions || !isMountedRef.current) {
      return;
    }

    const {
      authStatus,
      isJoined,
      isLeaving,
      liveSessionId,
      normalizedStatus,
    } = syncOptions;

    if (
      !liveSessionId ||
      isLeaving ||
      authStatus !== 'authenticated' ||
      !canRetryLiveSessionViewerPlayback({
        enterable: canEnterLiveSession(normalizedStatus),
        isJoined,
        state: selectLiveSessionViewerPlaybackState(
          viewerPlaybackActor.getSnapshot(),
        ),
      })
    ) {
      return;
    }

    // Re-read latest sync options and actor state before retrying; leaving,
    // ending, or a newer playback generation in flight makes retry ineligible.
    startViewerPlayback(liveSessionId, 'RETRY_REQUESTED');
  }

  function startViewerPlayback(
    currentLiveSessionId: string,
    startEventType: 'PREPARE_REQUESTED' | 'RETRY_REQUESTED' =
      'PREPARE_REQUESTED',
  ): number {
    const generation = viewerPlaybackGenerationRef.current + 1;
    viewerPlaybackGenerationRef.current = generation;
    disposeViewerPlaybackResource();
    sendViewerPlaybackEvent({ type: startEventType });

    try {
      currentCommitPrepareLiveSessionMedia({
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
            sendViewerPlaybackEvent({
              error: formatLiveMutationErrors(
                payload.prepareLiveMediaSession?.errors,
              ),
              type: 'FAILED',
            });
            return;
          }

          const peerConnectionFactory = currentCreatePeerConnectionFactory();

          if (!peerConnectionFactory) {
            sendViewerPlaybackEvent({
              error: 'Live video playback is not available on this device.',
              type: 'FAILED',
            });
            return;
          }

          const socket = currentCreateSocket({
            getAccessToken: currentGetAccessToken,
            websocketUrl: currentWebsocketUrl,
          });
          const runtime = currentCreatePlaybackRuntime({
            onChannelTerminated: () => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              // Invalidate this generation before publishing the closed state,
              // so pending start continuations cannot overwrite it.
              stopViewerPlaybackGeneration(generation, { resetState: false });
              sendViewerPlaybackEvent({ type: 'CLOSED' });
            },
            onError: (reason) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              stopViewerPlaybackGeneration(generation, { resetState: false });
              sendViewerPlaybackEvent({
                error: reason,
                type: 'FAILED',
              });
            },
            onRemoteStream: (stream) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              const remoteStreamUrl = stream?.toURL?.() ?? null;

              sendViewerPlaybackEvent({
                remoteStreamUrl,
                type: 'REMOTE_STREAM_RECEIVED',
              });
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

          sendViewerPlaybackEvent({ type: 'CONNECT_REQUESTED' });
          socket.connect();

          runtime
            .start()
            .then((result) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              if (result.status === 'started') {
                sendViewerPlaybackEvent({ type: 'RUNTIME_STARTED' });
                return;
              }

              disposeViewerPlaybackResource(generation);
              sendViewerPlaybackEvent({
                error: result.reason,
                type: 'FAILED',
              });
            })
            .catch((error: unknown) => {
              if (!isViewerPlaybackGenerationActive(generation)) {
                return;
              }

              disposeViewerPlaybackResource(generation);
              sendViewerPlaybackEvent({
                error: formatPlaybackStartError(error),
                type: 'FAILED',
              });
            });
        },
        onError: () => {
          if (!isViewerPlaybackGenerationActive(generation)) {
            return;
          }

          sendViewerPlaybackEvent({
            error: formatLiveMutationErrors([]),
            type: 'FAILED',
          });
        },
      });
    } catch {
      if (isViewerPlaybackGenerationActive(generation)) {
        sendViewerPlaybackEvent({
          error: formatLiveMutationErrors([]),
          type: 'FAILED',
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
      sendViewerPlaybackEvent({ type: 'RESET' });
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
      sendViewerPlaybackEvent({ type: 'RESET' });
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
    retryViewerPlayback,
    stopViewerPlayback,
    stopViewerPlaybackGeneration,
    syncViewerPlayback,
    unmount,
    updateOptions,
  };
}

export function getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
  lifecycleRef: MutableRefObject<LiveSessionViewerPlaybackControllerLifecycle | null>,
  options: LiveSessionViewerPlaybackControllerLifecycleOptions,
): LiveSessionViewerPlaybackControllerLifecycle {
  if (!lifecycleRef.current) {
    lifecycleRef.current =
      createLiveSessionViewerPlaybackControllerLifecycle(options);
  } else {
    lifecycleRef.current.updateOptions(options);
  }

  return lifecycleRef.current;
}

function formatPlaybackStartError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Could not start live video playback. Please try again.';
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
  const controllerLifecycleRef =
    useRef<LiveSessionViewerPlaybackControllerLifecycle | null>(null);
  const controller = getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
    controllerLifecycleRef,
    {
      commitPrepareLiveSessionMedia,
      getAccessToken,
      isMountedRef,
      setViewerPlaybackState,
      viewerPlaybackGenerationRef,
      viewerPlaybackResourceRef,
      websocketUrl,
    },
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      controller.unmount();
    };
  }, [controller]);

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
      controller,
    ],
  );

  return {
    retryViewerPlayback: controller.retryViewerPlayback,
    stopViewerPlayback: controller.stopViewerPlayback,
    stopViewerPlaybackGeneration: controller.stopViewerPlaybackGeneration,
    viewerPlaybackState,
  };
}

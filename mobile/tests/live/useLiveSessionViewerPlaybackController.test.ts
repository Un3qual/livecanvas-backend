import { describe, expect, test } from 'bun:test';

import type {
  LiveSessionViewerPlaybackRuntime,
  LiveSessionViewerPlaybackRuntimeOptions,
  LiveSessionViewerPlaybackRuntimeStartResult,
} from '../../src/live/playback/liveSessionViewerPlaybackRuntime';
import {
  createLiveSessionViewerPlaybackControllerLifecycle,
  getOrCreateLiveSessionViewerPlaybackControllerLifecycle,
  type LiveSessionViewerPlaybackControllerLifecycle,
  type LiveSessionViewerPlaybackControllerLifecycleOptions,
} from '../../src/live/watch/hooks/useLiveSessionViewerPlaybackController';
import type { ViewerPlaybackState } from '../../src/live/watch/liveSessionWatchScreenTypes';
import type { PhoenixSocket } from '../../src/realtime/phoenixSocket';

type PrepareMediaCommitConfig = {
  readonly onCompleted?: (payload: PrepareMediaPayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly liveSessionId: string;
    };
  };
};

type PrepareMediaPayload = {
  readonly prepareLiveMediaSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null;
      readonly message: string;
    }>;
    readonly iceServers: ReadonlyArray<{
      readonly credential: string | null;
      readonly credentialType: 'PASSWORD' | null;
      readonly urls: ReadonlyArray<string>;
      readonly username: string | null;
    }>;
    readonly liveSession: {
      readonly id: string;
      readonly status: 'LIVE' | 'STARTING';
    };
    readonly signalingTopic: string;
  };
};

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
};

function failViewerPlaybackRuntimeChannel(): never {
  throw new Error('controller tests replace the runtime boundary');
}

class FakeSocket {
  connectCount = 0;
  disconnectCount = 0;

  constructor(
    readonly websocketUrl = 'wss://example.test/socket',
    readonly accessToken: string | null = 'viewer-token',
  ) {}

  connect(): void {
    this.connectCount += 1;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  readonly channel: PhoenixSocket['channel'] = failViewerPlaybackRuntimeChannel;
}

class FakeRuntime implements LiveSessionViewerPlaybackRuntime {
  readonly startDeferred =
    createDeferred<LiveSessionViewerPlaybackRuntimeStartResult>();
  disposeCount = 0;
  startCount = 0;

  constructor(
    readonly options: LiveSessionViewerPlaybackRuntimeOptions,
  ) {}

  dispose(): void {
    this.disposeCount += 1;
  }

  start(): Promise<LiveSessionViewerPlaybackRuntimeStartResult> {
    this.startCount += 1;
    return this.startDeferred.promise;
  }
}

function createDeferred<T>(): Deferred<T> {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });

  return { promise, reject, resolve };
}

function createHarness() {
  const commits: PrepareMediaCommitConfig[] = [];
  const runtimes: FakeRuntime[] = [];
  const sockets: FakeSocket[] = [];
  const stateHistory: ViewerPlaybackState[] = [];
  const initialState: ViewerPlaybackState = {
    error: null,
    remoteStreamUrl: null,
    status: 'idle',
  };
  let state = initialState;
  const controller = createLiveSessionViewerPlaybackControllerLifecycle({
    commitPrepareLiveSessionMedia: (config) => {
      commits.push(config as PrepareMediaCommitConfig);
    },
    createPeerConnectionFactory: () => () => ({
      addIceCandidate: () => Promise.resolve(),
      close: () => undefined,
      createAnswer: () => Promise.resolve({ sdp: 'answer', type: 'answer' }),
      onicecandidate: null,
      ontrack: null,
      setLocalDescription: () => Promise.resolve(),
      setRemoteDescription: () => Promise.resolve(),
    }),
    createPlaybackRuntime: (options) => {
      const runtime = new FakeRuntime(options);
      runtimes.push(runtime);
      return runtime;
    },
    createSocket: ({ getAccessToken, websocketUrl }) => {
      const socket = new FakeSocket(websocketUrl, getAccessToken() ?? undefined);
      sockets.push(socket);
      return socket;
    },
    getAccessToken: () => 'viewer-token',
    isMountedRef: { current: true },
    setViewerPlaybackState: (nextState) => {
      state =
        typeof nextState === 'function' ? nextState(state) : nextState;
      stateHistory.push(state);
    },
    viewerPlaybackGenerationRef: { current: 0 },
    viewerPlaybackResourceRef: { current: null },
    websocketUrl: 'wss://example.test/socket',
  });

  function completePrepare(
    index = commits.length - 1,
    payload = createPrepareMediaPayload(
      commits[index]?.variables.input.liveSessionId ?? 'session-1',
    ),
  ) {
    commits[index]?.onCompleted?.(payload);
  }

  function sync(
    overrides: Partial<
      Parameters<
        LiveSessionViewerPlaybackControllerLifecycle['syncViewerPlayback']
      >[0]
    > = {},
  ) {
    return controller.syncViewerPlayback({
      authStatus: 'authenticated',
      isJoined: true,
      isLeaving: false,
      liveSessionId: 'session-1',
      normalizedStatus: 'LIVE',
      ...overrides,
    });
  }

  return {
    commits,
    completePrepare,
    controller,
    get state() {
      return state;
    },
    initialState,
    runtimes,
    sockets,
    stateHistory,
    sync,
  };
}

function createLifecycleOptions({
  commits,
  getState,
  runtimes,
  setState,
  sockets,
  stateHistory,
}: {
  readonly commits: PrepareMediaCommitConfig[];
  readonly getState: () => ViewerPlaybackState;
  readonly runtimes: FakeRuntime[];
  readonly setState: (state: ViewerPlaybackState) => void;
  readonly sockets: FakeSocket[];
  readonly stateHistory: ViewerPlaybackState[];
}): LiveSessionViewerPlaybackControllerLifecycleOptions {
  return {
    commitPrepareLiveSessionMedia: (config) => {
      commits.push(config as PrepareMediaCommitConfig);
    },
    createPeerConnectionFactory: () => () => ({
      addIceCandidate: () => Promise.resolve(),
      close: () => undefined,
      createAnswer: () => Promise.resolve({ sdp: 'answer', type: 'answer' }),
      onicecandidate: null,
      ontrack: null,
      setLocalDescription: () => Promise.resolve(),
      setRemoteDescription: () => Promise.resolve(),
    }),
    createPlaybackRuntime: (options) => {
      const runtime = new FakeRuntime(options);
      runtimes.push(runtime);
      return runtime;
    },
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    getAccessToken: () => 'viewer-token',
    isMountedRef: { current: true },
    setViewerPlaybackState: (nextState) => {
      const nextResolvedState =
        typeof nextState === 'function' ? nextState(getState()) : nextState;
      setState(nextResolvedState);
      stateHistory.push(nextResolvedState);
    },
    viewerPlaybackGenerationRef: { current: 0 },
    viewerPlaybackResourceRef: { current: null },
    websocketUrl: 'wss://example.test/socket',
  };
}

function createPrepareCompleter(commits: PrepareMediaCommitConfig[]) {
  return (
    index = commits.length - 1,
    payload = createPrepareMediaPayload(
      commits[index]?.variables.input.liveSessionId ?? 'session-1',
    ),
  ) => {
    commits[index]?.onCompleted?.(payload);
  };
}

function createPrepareMediaPayload(liveSessionId: string): PrepareMediaPayload {
  return {
    prepareLiveMediaSession: {
      errors: [],
      iceServers: [
        {
          credential: null,
          credentialType: null,
          urls: ['stun:stun.example.test:3478'],
          username: null,
        },
      ],
      liveSession: {
        id: liveSessionId,
        status: 'LIVE',
      },
      signalingTopic: `live_session_media:${liveSessionId}`,
    },
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

describe('useLiveSessionViewerPlaybackController lifecycle', () => {
  test('reuses one lifecycle for the hook lifetime so exposed methods share the active actor', () => {
    const commits: PrepareMediaCommitConfig[] = [];
    const runtimes: FakeRuntime[] = [];
    const sockets: FakeSocket[] = [];
    const stateHistory: ViewerPlaybackState[] = [];
    let state: ViewerPlaybackState = {
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    };
    const options = createLifecycleOptions({
      commits,
      getState: () => state,
      runtimes,
      setState: (nextState) => {
        state = nextState;
      },
      sockets,
      stateHistory,
    });
    const lifecycleRef = {
      current: null as LiveSessionViewerPlaybackControllerLifecycle | null,
    };
    const firstLifecycle =
      getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
        lifecycleRef,
        options,
      );

    firstLifecycle.syncViewerPlayback({
      authStatus: 'authenticated',
      isJoined: true,
      isLeaving: false,
      liveSessionId: 'session-1',
      normalizedStatus: 'LIVE',
    });
    createPrepareCompleter(commits)();
    runtimes[0].options.onRemoteStream?.({
      toURL: () => 'stream://host-camera',
    });

    expect(state).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });

    const rerenderLifecycle =
      getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
        lifecycleRef,
        options,
      );

    expect(rerenderLifecycle).toBe(firstLifecycle);

    rerenderLifecycle.stopViewerPlayback({ resetState: true });

    expect(runtimes[0].disposeCount).toBe(1);
    expect(sockets[0].disconnectCount).toBe(1);
    expect(state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });
  });

  test('updates socket options when the stable lifecycle receives new options', () => {
    const commits: PrepareMediaCommitConfig[] = [];
    const runtimes: FakeRuntime[] = [];
    const sockets: FakeSocket[] = [];
    const stateHistory: ViewerPlaybackState[] = [];
    let state: ViewerPlaybackState = {
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    };
    const lifecycleRef = {
      current: null as LiveSessionViewerPlaybackControllerLifecycle | null,
    };
    const firstLifecycle =
      getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
        lifecycleRef,
        {
          ...createLifecycleOptions({
            commits,
            getState: () => state,
            runtimes,
            setState: (nextState) => {
              state = nextState;
            },
            sockets,
            stateHistory,
          }),
          createSocket: ({ getAccessToken, websocketUrl }) => {
            const socket = new FakeSocket(websocketUrl, getAccessToken() ?? undefined);
            sockets.push(socket);
            return socket;
          },
          getAccessToken: () => 'initial-token',
          websocketUrl: 'wss://initial.example.test/socket',
        },
      );

    firstLifecycle.syncViewerPlayback({
      authStatus: 'authenticated',
      isJoined: true,
      isLeaving: false,
      liveSessionId: 'session-1',
      normalizedStatus: 'LIVE',
    });
    createPrepareCompleter(commits)();

    expect(sockets[0].websocketUrl).toBe('wss://initial.example.test/socket');
    expect(sockets[0].accessToken).toBe('initial-token');

    firstLifecycle.stopViewerPlayback({ resetState: true });

    const rerenderLifecycle =
      getOrCreateLiveSessionViewerPlaybackControllerLifecycle(
        lifecycleRef,
        {
          ...createLifecycleOptions({
            commits,
            getState: () => state,
            runtimes,
            setState: (nextState) => {
              state = nextState;
            },
            sockets,
            stateHistory,
          }),
          createSocket: ({ getAccessToken, websocketUrl }) => {
            const socket = new FakeSocket(websocketUrl, getAccessToken() ?? undefined);
            sockets.push(socket);
            return socket;
          },
          getAccessToken: () => 'updated-token',
          websocketUrl: 'wss://updated.example.test/socket',
        },
      );

    expect(rerenderLifecycle).toBe(firstLifecycle);

    rerenderLifecycle.syncViewerPlayback({
      authStatus: 'authenticated',
      isJoined: true,
      isLeaving: false,
      liveSessionId: 'session-2',
      normalizedStatus: 'LIVE',
    });
    createPrepareCompleter(commits)();

    expect(sockets[1].websocketUrl).toBe('wss://updated.example.test/socket');
    expect(sockets[1].accessToken).toBe('updated-token');
  });

  test('starts for joined authenticated live sessions and reaches playing when a remote stream arrives', async () => {
    const harness = createHarness();

    const cleanup = harness.sync();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });
    expect(harness.commits).toHaveLength(1);
    expect(harness.commits[0].variables.input.liveSessionId).toBe('session-1');

    harness.completePrepare();

    expect(harness.sockets).toHaveLength(1);
    expect(harness.sockets[0].connectCount).toBe(1);
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0].startCount).toBe(1);
    expect(harness.state.status).toBe('connecting');

    harness.runtimes[0].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });

    harness.runtimes[0].options.onRemoteStream?.({
      toURL: () => 'stream://host-camera',
    });

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });

    cleanup?.();
  });

  test('ignores stale prepare completion from an earlier generation', () => {
    const harness = createHarness();
    const cleanupFirst = harness.sync({ liveSessionId: 'session-1' });

    cleanupFirst?.();
    const cleanupSecond = harness.sync({ liveSessionId: 'session-2' });

    harness.completePrepare(0, createPrepareMediaPayload('session-1'));

    expect(harness.runtimes).toHaveLength(0);
    expect(harness.sockets).toHaveLength(0);
    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    harness.completePrepare(1, createPrepareMediaPayload('session-2'));

    expect(harness.runtimes).toHaveLength(1);
    expect(harness.sockets).toHaveLength(1);
    cleanupSecond?.();
  });

  test('ignores stale runtime completion after a newer generation starts', async () => {
    const harness = createHarness();
    const cleanupFirst = harness.sync({ liveSessionId: 'session-1' });
    harness.completePrepare(0, createPrepareMediaPayload('session-1'));

    cleanupFirst?.();
    harness.sync({ liveSessionId: 'session-2' });
    harness.completePrepare(1, createPrepareMediaPayload('session-2'));

    harness.runtimes[0].startDeferred.resolve({
      reason: 'stale runtime failure',
      status: 'error',
    });
    await flushAsyncHandlers();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });
    expect(harness.runtimes[1].disposeCount).toBe(0);
    expect(harness.sockets[1].disconnectCount).toBe(0);

    harness.runtimes[1].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });
  });

  test('leaving and ended sessions dispose playback and reset state', () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare();
    harness.sync({ isLeaving: true });

    expect(harness.runtimes[0].disposeCount).toBe(1);
    expect(harness.sockets[0].disconnectCount).toBe(1);
    expect(harness.state).toEqual(harness.initialState);

    harness.sync();
    harness.completePrepare();
    harness.sync({ normalizedStatus: 'ENDED' });

    expect(harness.runtimes[1].disposeCount).toBe(1);
    expect(harness.sockets[1].disconnectCount).toBe(1);
    expect(harness.state).toEqual(harness.initialState);
  });

  test('unmount disposes playback and ignores later async callbacks', () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare();
    expect(harness.state.status).toBe('connecting');

    harness.controller.unmount();
    const stateAfterUnmount = harness.state;

    expect(harness.runtimes[0].disposeCount).toBe(1);
    expect(harness.sockets[0].disconnectCount).toBe(1);

    harness.runtimes[0].startDeferred.resolve({ status: 'started' });
    harness.runtimes[0].options.onRemoteStream?.({
      toURL: () => 'stream://stale-camera',
    });

    expect(harness.state).toBe(stateAfterUnmount);
  });

  test('runtime errors update only the active generation and dispose active resources', () => {
    const harness = createHarness();
    const cleanupFirst = harness.sync({ liveSessionId: 'session-1' });
    harness.completePrepare(0, createPrepareMediaPayload('session-1'));

    cleanupFirst?.();
    harness.sync({ liveSessionId: 'session-2' });
    harness.completePrepare(1, createPrepareMediaPayload('session-2'));

    harness.runtimes[0].options.onError?.('stale failure');

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });
    expect(harness.runtimes[1].disposeCount).toBe(0);
    expect(harness.sockets[1].disconnectCount).toBe(0);

    harness.runtimes[1].options.onError?.('active failure');

    expect(harness.state).toEqual({
      error: 'active failure',
      remoteStreamUrl: null,
      status: 'errored',
    });
    expect(harness.runtimes[1].disposeCount).toBe(1);
    expect(harness.sockets[1].disconnectCount).toBe(1);
  });

  test('channel termination closes active playback before pending start continuations can update state', async () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare();

    harness.runtimes[0].options.onChannelTerminated?.();

    expect(harness.runtimes[0].disposeCount).toBe(1);
    expect(harness.sockets[0].disconnectCount).toBe(1);
    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });

    harness.runtimes[0].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });
  });

  test('retries closed playback with a fresh prepare and runtime generation', async () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare(0, {
      ...createPrepareMediaPayload('session-1'),
      prepareLiveMediaSession: {
        ...createPrepareMediaPayload('session-1').prepareLiveMediaSession,
        signalingTopic: 'live_session_media:session-1:first',
      },
    });
    harness.runtimes[0].options.onChannelTerminated?.();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });

    harness.controller.retryViewerPlayback();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });
    expect(harness.commits).toHaveLength(2);
    expect(harness.commits[1].variables.input.liveSessionId).toBe('session-1');

    harness.completePrepare(1, {
      ...createPrepareMediaPayload('session-1'),
      prepareLiveMediaSession: {
        ...createPrepareMediaPayload('session-1').prepareLiveMediaSession,
        signalingTopic: 'live_session_media:session-1:retry',
      },
    });

    expect(harness.runtimes).toHaveLength(2);
    expect(harness.sockets).toHaveLength(2);
    expect(harness.runtimes[1].options.preparedMedia.signalingTopic).toBe(
      'live_session_media:session-1:retry',
    );
    expect(harness.runtimes[1].startCount).toBe(1);
    expect(harness.state.status).toBe('connecting');

    harness.runtimes[0].startDeferred.resolve({
      reason: 'stale retry failure',
      status: 'error',
    });
    await flushAsyncHandlers();

    expect(harness.state.status).toBe('connecting');

    harness.runtimes[1].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });
  });

  test('ignores retry after leave or unmount clears playback eligibility', () => {
    const leaveHarness = createHarness();

    leaveHarness.sync();
    leaveHarness.completePrepare();
    leaveHarness.runtimes[0].options.onChannelTerminated?.();
    leaveHarness.sync({ isJoined: false });
    leaveHarness.controller.retryViewerPlayback();

    expect(leaveHarness.commits).toHaveLength(1);
    expect(leaveHarness.state).toEqual(leaveHarness.initialState);

    const unmountHarness = createHarness();

    unmountHarness.sync();
    unmountHarness.completePrepare();
    unmountHarness.runtimes[0].options.onChannelTerminated?.();
    unmountHarness.controller.unmount();
    unmountHarness.controller.retryViewerPlayback();

    expect(unmountHarness.commits).toHaveLength(1);
    expect(unmountHarness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });
  });

  test('leaving while retry playback is pending disposes the retry generation once', async () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare();
    harness.runtimes[0].options.onChannelTerminated?.();
    harness.controller.retryViewerPlayback();
    harness.completePrepare(1);

    expect(harness.runtimes[1].disposeCount).toBe(0);
    expect(harness.sockets[1].disconnectCount).toBe(0);

    harness.sync({ isLeaving: true });

    expect(harness.runtimes[1].disposeCount).toBe(1);
    expect(harness.sockets[1].disconnectCount).toBe(1);
    expect(harness.state).toEqual(harness.initialState);

    harness.runtimes[1].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.runtimes[1].disposeCount).toBe(1);
    expect(harness.sockets[1].disconnectCount).toBe(1);
    expect(harness.state).toEqual(harness.initialState);
  });

  test('ended sessions suppress retry and clear pending retry playback', async () => {
    const endedBeforeRetryHarness = createHarness();

    endedBeforeRetryHarness.sync();
    endedBeforeRetryHarness.completePrepare();
    endedBeforeRetryHarness.runtimes[0].options.onChannelTerminated?.();
    endedBeforeRetryHarness.sync({ normalizedStatus: 'ENDED' });
    endedBeforeRetryHarness.controller.retryViewerPlayback();

    expect(endedBeforeRetryHarness.commits).toHaveLength(1);
    expect(endedBeforeRetryHarness.state).toEqual(
      endedBeforeRetryHarness.initialState,
    );

    const endedDuringRetryHarness = createHarness();

    endedDuringRetryHarness.sync();
    endedDuringRetryHarness.completePrepare();
    endedDuringRetryHarness.runtimes[0].options.onChannelTerminated?.();
    endedDuringRetryHarness.controller.retryViewerPlayback();
    endedDuringRetryHarness.completePrepare(1);
    endedDuringRetryHarness.sync({ normalizedStatus: 'ENDED' });

    expect(endedDuringRetryHarness.runtimes[1].disposeCount).toBe(1);
    expect(endedDuringRetryHarness.sockets[1].disconnectCount).toBe(1);
    expect(endedDuringRetryHarness.state).toEqual(
      endedDuringRetryHarness.initialState,
    );

    endedDuringRetryHarness.runtimes[1].options.onChannelTerminated?.();
    endedDuringRetryHarness.runtimes[1].startDeferred.resolve({
      status: 'started',
    });
    await flushAsyncHandlers();

    expect(endedDuringRetryHarness.state).toEqual(
      endedDuringRetryHarness.initialState,
    );
  });

  test('channel termination during retry remains recoverable for joined enterable sessions', () => {
    const harness = createHarness();

    harness.sync();
    harness.completePrepare();
    harness.runtimes[0].options.onChannelTerminated?.();
    harness.controller.retryViewerPlayback();
    harness.completePrepare(1);
    harness.runtimes[1].options.onChannelTerminated?.();

    expect(harness.runtimes[1].disposeCount).toBe(1);
    expect(harness.sockets[1].disconnectCount).toBe(1);
    expect(harness.state).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });

    harness.controller.retryViewerPlayback();

    expect(harness.commits).toHaveLength(3);
    expect(harness.state.status).toBe('preparing');
  });
});

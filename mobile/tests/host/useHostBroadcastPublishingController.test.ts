import { describe, expect, test } from 'vitest';

import type { HostBroadcastMediaPreparation } from '../../src/host/hostBroadcastMediaSignaling';
import type { HostBroadcastNative } from '../../src/host/hostBroadcastNative';
import type {
  HostBroadcastLocalMediaControls,
  HostBroadcastLocalMediaStream,
  HostBroadcastLocalMediaTrack,
} from '../../src/host/publishing/hostBroadcastLocalMediaControls';
import type { PhoenixSocket } from '../../src/realtime/phoenixSocket';
import {
  createHostBroadcastPublishingPreflightController,
  createHostBroadcastPublishingSessionStore,
  type HostBroadcastPublishingResource,
} from '../../src/host/publishing/hostBroadcastPublishingSessionStore';
import type {
  HostBroadcastPublishingRuntime,
  HostBroadcastPublishingRuntimeOptions,
  HostBroadcastPublishingRuntimeStartResult,
} from '../../src/host/publishing/hostBroadcastPublishingRuntime';
import {
  createHostBroadcastPublishingControllerLifecycle,
  type HostBroadcastPublishingStatus,
  type HostBroadcastPublishingControllerLifecycle,
} from '../../src/host/preflight/hooks/useHostBroadcastPublishingController';

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

type PreviewTrack = HostBroadcastLocalMediaTrack & {
  stop: () => void;
};

function failPublishingRuntimeChannel(): never {
  throw new Error('controller tests replace the publishing runtime boundary');
}

class FakeSocket {
  connectCount = 0;
  disconnectCount = 0;

  readonly channel: PhoenixSocket['channel'] = failPublishingRuntimeChannel;

  connect(): void {
    this.connectCount += 1;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

class FakeRuntime implements HostBroadcastPublishingRuntime {
  readonly startDeferred =
    createDeferred<HostBroadcastPublishingRuntimeStartResult>();
  disposeCount = 0;
  negotiationReady = false;
  startCount = 0;

  constructor(
    readonly options: HostBroadcastPublishingRuntimeOptions,
  ) {}

  dispose(): void {
    this.disposeCount += 1;
  }

  isNegotiationReady(): boolean {
    return this.negotiationReady;
  }

  start(): Promise<HostBroadcastPublishingRuntimeStartResult> {
    this.startCount += 1;
    return this.startDeferred.promise;
  }
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

const preparedMedia: HostBroadcastMediaPreparation = {
  channelTopic: 'live_session:chat-topic',
  iceServers: [],
  liveSessionId: 'live-session-id',
  signalingTopic: 'live_session_media:opaque-topic',
};

function createHarness(
  options: {
    readonly createLocalMediaControls?: (
      stream: HostBroadcastLocalMediaStream,
    ) => HostBroadcastLocalMediaControls | null;
  } = {},
) {
  const hostPublishingSessions = createHostBroadcastPublishingSessionStore();
  const publishingPreflightController =
    createHostBroadcastPublishingPreflightController();
  const runtimes: FakeRuntime[] = [];
  const sockets: FakeSocket[] = [];
  const statusHistory: HostBroadcastPublishingStatus[] = [];
  const backendMediaReadyHistory: boolean[] = [];
  const errors: Array<string | null> = [];
  const endedLiveSessionIds: string[] = [];
  const retainedPublishingResourceRef = {
    current: null as HostBroadcastPublishingResource | null,
  };
  const retainedPublishingLiveSessionIdsRef = {
    current: new Map<HostBroadcastPublishingResource, string>(),
  };
  const hasRetainedPublishingResourceRef = { current: false };
  const previewTracks: PreviewTrack[] = [
    { enabled: true, kind: 'audio', stop: () => undefined },
    { enabled: true, kind: 'video', stop: () => undefined },
  ];
  const previewStream = {
    getTracks() {
      return previewTracks;
    },
  };
  let previewStreamRequestCount = 0;
  const native: Pick<
    HostBroadcastNative,
    'getPreviewStream' | 'releasePreviewStream'
  > = {
    getPreviewStream() {
      previewStreamRequestCount += 1;
      return Promise.resolve(previewStream);
    },
    releasePreviewStream() {
      // The runtime owns preview stream release through disposeLocalMedia.
    },
  };
  const controller = createHostBroadcastPublishingControllerLifecycle({
    createLocalMediaControls: options.createLocalMediaControls,
    createPeerConnectionFactory: () => () => ({
      addIceCandidate: () => Promise.resolve(),
      addTrack: () => undefined,
      close: () => undefined,
      createOffer: () => Promise.resolve({ sdp: 'offer', type: 'offer' }),
      onicecandidate: null,
      setLocalDescription: () => Promise.resolve(),
      setRemoteDescription: () => Promise.resolve(),
    }),
    createPublishingRuntime: (options) => {
      const runtime = new FakeRuntime(options);
      runtimes.push(runtime);
      return runtime;
    },
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    failPreparedPublishing: (reason) => {
      errors.push(reason);
    },
    getAccessToken: () => 'host-token',
    hasRetainedPublishingResourceRef,
    hostPublishingSessions,
    native,
    publishingPreflightController,
    requestPreflightEndLiveSession: (liveSessionId) => {
      endedLiveSessionIds.push(liveSessionId);
    },
    retainedPublishingLiveSessionIdsRef,
    retainedPublishingResourceRef,
    setBackendMediaContractReady: (ready) => {
      backendMediaReadyHistory.push(ready);
    },
    setHostActionError: (error) => {
      errors.push(error);
    },
    setPublishingStatus: (status) => {
      statusHistory.push(status);
    },
    websocketUrl: 'wss://example.test/socket',
  });

  function sync(
    overrides: Partial<
      Parameters<
        HostBroadcastPublishingControllerLifecycle['syncPublishing']
      >[0]
    > = {},
  ) {
    return controller.syncPublishing({
      authStatus: 'authenticated',
      preparedMedia,
      ...overrides,
    });
  }

  return {
    backendMediaReadyHistory,
    controller,
    endedLiveSessionIds,
    errors,
    get previewStreamRequestCount() {
      return previewStreamRequestCount;
    },
    previewStream,
    previewTracks,
    hasRetainedPublishingResourceRef,
    hostPublishingSessions,
    publishingPreflightController,
    retainedPublishingResourceRef,
    runtimes,
    sockets,
    statusHistory,
    sync,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

describe('useHostBroadcastPublishingController lifecycle', () => {
  test('starts host publishing and updates backend media readiness when negotiation is ready', async () => {
    const harness = createHarness();

    const cleanup = harness.sync();
    await flushAsyncHandlers();

    expect(harness.previewStreamRequestCount).toBe(1);
    expect(harness.backendMediaReadyHistory).toEqual([false]);
    expect(harness.statusHistory).toEqual(['starting']);
    expect(harness.sockets).toHaveLength(1);
    expect(harness.sockets[0].connectCount).toBe(1);
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0].startCount).toBe(1);

    harness.runtimes[0].startDeferred.resolve({ status: 'started' });
    await flushAsyncHandlers();

    expect(harness.statusHistory).toEqual(['starting', 'negotiating']);

    harness.runtimes[0].negotiationReady = true;
    harness.runtimes[0].options.onNegotiationReady?.();

    expect(harness.statusHistory).toEqual([
      'starting',
      'negotiating',
      'ready',
    ]);
    expect(harness.backendMediaReadyHistory).toEqual([false, true]);

    cleanup?.();
    expect(harness.runtimes[0].disposeCount).toBe(1);
    expect(harness.sockets[0].disconnectCount).toBe(1);
  });

  test('retains local media controls created from the preview stream', async () => {
    const harness = createHarness();

    harness.sync();
    await flushAsyncHandlers();

    const retainedResource =
      harness.controller.retainAttachedPublishingForLiveSession(
        'live-session-id',
      );

    expect(retainedResource?.localMediaControls?.snapshot()).toEqual({
      audio: { available: true, enabled: true },
      video: { available: true, enabled: true },
    });

    retainedResource?.localMediaControls?.setAudioEnabled(false);

    expect(harness.previewTracks[0].enabled).toBe(false);
    expect(harness.previewTracks[1].enabled).toBe(true);
    expect(
      harness.hostPublishingSessions.controlsFor('live-session-id') ?? null,
    ).toBe(
      retainedResource?.localMediaControls ?? null,
    );
  });

  test('continues publishing when local media controls cannot be created', async () => {
    let controlsCreateCount = 0;
    const harness = createHarness({
      createLocalMediaControls(stream) {
        controlsCreateCount += 1;
        expect(stream).toBe(harness.previewStream);
        throw new Error('local controls unavailable');
      },
    });

    harness.sync();
    await flushAsyncHandlers();

    expect(controlsCreateCount).toBe(1);
    expect(harness.runtimes).toHaveLength(1);
    expect(harness.runtimes[0].startCount).toBe(1);

    const retainedResource =
      harness.controller.retainAttachedPublishingForLiveSession(
        'live-session-id',
      );

    expect(retainedResource?.localMediaControls).toBeUndefined();
    expect(harness.hostPublishingSessions.controlsFor('live-session-id')).toBeNull();
  });

  test('releases retained publishing resources and ends the session when the media channel closes', async () => {
    const harness = createHarness();

    harness.sync();
    await flushAsyncHandlers();

    const retainedResource =
      harness.controller.retainAttachedPublishingForLiveSession(
        'live-session-id',
      );

    expect(retainedResource).toBe(harness.retainedPublishingResourceRef.current);
    expect(harness.hasRetainedPublishingResourceRef.current).toBe(true);
    expect(harness.hostPublishingSessions.has('live-session-id')).toBe(true);

    harness.runtimes[0].options.onChannelTerminated?.('closed');

    expect(harness.endedLiveSessionIds).toEqual(['live-session-id']);
    expect(harness.hostPublishingSessions.has('live-session-id')).toBe(false);
    expect(harness.retainedPublishingResourceRef.current).toBeNull();
    expect(harness.hasRetainedPublishingResourceRef.current).toBe(false);
    expect(harness.runtimes[0].disposeCount).toBe(1);
    expect(harness.sockets[0].disconnectCount).toBe(1);
  });
});

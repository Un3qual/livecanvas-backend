import { describe, expect, test } from 'bun:test';

import type {
  LiveSessionChannel,
  LiveSessionChannelPush,
  LiveSessionChannelPushStatus,
} from '../live/liveSessionChannelClient';
import type { HostBroadcastMediaPreparation } from './hostBroadcastMediaSignaling';
import { createHostBroadcastPublishingSessionStore } from './hostBroadcastPublishingSession';
import {
  createHostBroadcastPublishingRuntime,
  type HostBroadcastPublishingIceCandidate,
  type HostBroadcastPublishingPeerConnection,
  type HostBroadcastPublishingPeerConnectionConfig,
  type HostBroadcastPublishingSessionDescription,
} from './hostBroadcastPublishingRuntime';

class FakePush implements LiveSessionChannelPush {
  private readonly callbacks = new Map<
    LiveSessionChannelPushStatus,
    (payload: unknown) => void
  >();

  receive(
    status: LiveSessionChannelPushStatus,
    callback: (payload: unknown) => void,
  ): this {
    this.callbacks.set(status, callback);
    return this;
  }

  resolve(
    status: LiveSessionChannelPushStatus,
    payload: unknown = {},
  ): void {
    const callback = this.callbacks.get(status);

    if (!callback) {
      throw new Error(`No callback registered for ${status}`);
    }

    callback(payload);
  }
}

class FakeChannel implements LiveSessionChannel {
  readonly closeHandlers: Array<() => void> = [];
  readonly errorHandlers: Array<(payload: unknown) => void> = [];
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  readonly joinPush = new FakePush();
  readonly leavePush = new FakePush();
  readonly pushes: Array<{
    readonly eventName: string;
    readonly payload: Record<string, unknown>;
    readonly push: FakePush;
  }> = [];
  leaveCount = 0;

  join(): LiveSessionChannelPush {
    return this.joinPush;
  }

  leave(): LiveSessionChannelPush {
    this.leaveCount += 1;
    return this.leavePush;
  }

  on(eventName: string, callback: (payload: unknown) => void): number {
    const handlers = this.handlers.get(eventName) ?? [];
    handlers.push(callback);
    this.handlers.set(eventName, handlers);
    return handlers.length;
  }

  onClose(callback: () => void): number {
    this.closeHandlers.push(callback);
    return this.closeHandlers.length;
  }

  onError(callback: (payload: unknown) => void): number {
    this.errorHandlers.push(callback);
    return this.errorHandlers.length;
  }

  push(
    eventName: string,
    payload: Record<string, unknown>,
  ): LiveSessionChannelPush {
    const push = new FakePush();
    this.pushes.push({ eventName, payload, push });
    return push;
  }

  emit(eventName: string, payload: unknown): void {
    for (const callback of this.handlers.get(eventName) ?? []) {
      callback(payload);
    }
  }

  close(): void {
    for (const callback of this.closeHandlers) {
      callback();
    }
  }

  error(payload: unknown = {}): void {
    for (const callback of this.errorHandlers) {
      callback(payload);
    }
  }
}

type Deferred<T = undefined> = {
  readonly promise: Promise<T>;
  readonly resolve: (value?: T) => void;
};

function createDeferred<T = undefined>(): Deferred<T> {
  let resolve!: (value?: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = (value) => {
      resolvePromise(value as T);
    };
  });

  return { promise, resolve };
}

class FakePeerConnection implements HostBroadcastPublishingPeerConnection {
  readonly addIceCandidateCalls: HostBroadcastPublishingIceCandidate[] = [];
  readonly addTrackCalls: Array<{ readonly stream: unknown; readonly track: unknown }> =
    [];
  readonly localDescriptions: HostBroadcastPublishingSessionDescription[] = [];
  readonly remoteDescriptions: HostBroadcastPublishingSessionDescription[] = [];
  closeCount = 0;
  createOfferDeferred: Deferred<HostBroadcastPublishingSessionDescription> | null =
    null;
  onicecandidate:
    | ((
        event: Readonly<{
          candidate?: HostBroadcastPublishingIceCandidate | null;
        }>,
      ) => void)
    | null = null;
  offer: HostBroadcastPublishingSessionDescription = {
    sdp: 'v=0\r\nhost-offer',
    type: 'offer',
  };
  setLocalDescriptionDeferred: Deferred | null = null;
  setRemoteDescriptionDeferred: Deferred | null = null;

  addTrack(track: unknown, stream: unknown): void {
    this.addTrackCalls.push({ stream, track });
  }

  addIceCandidate(
    candidate: HostBroadcastPublishingIceCandidate,
  ): Promise<void> {
    this.addIceCandidateCalls.push(candidate);
    return Promise.resolve();
  }

  close(): void {
    this.closeCount += 1;
  }

  createOffer(): Promise<HostBroadcastPublishingSessionDescription> {
    if (this.createOfferDeferred) {
      return this.createOfferDeferred.promise;
    }

    return Promise.resolve(this.offer);
  }

  setLocalDescription(
    description: HostBroadcastPublishingSessionDescription,
  ): Promise<void> {
    this.localDescriptions.push(description);
    return this.setLocalDescriptionDeferred?.promise ?? Promise.resolve();
  }

  setRemoteDescription(
    description: HostBroadcastPublishingSessionDescription,
  ): Promise<void> {
    this.remoteDescriptions.push(description);
    return this.setRemoteDescriptionDeferred?.promise ?? Promise.resolve();
  }

  emitLocalIceCandidate(
    candidate: HostBroadcastPublishingIceCandidate | null,
  ): void {
    this.onicecandidate?.({ candidate });
  }
}

const preparedMedia: HostBroadcastMediaPreparation = {
  channelTopic: 'live_session:chat-topic',
  iceServers: [
    {
      credential: null,
      credentialType: null,
      username: null,
      urls: ['stun:stun.example.test:3478'],
    },
    {
      credential: 'turn-secret',
      credentialType: 'PASSWORD',
      username: 'turn-user',
      urls: ['turn:turn.example.test:3478'],
    },
  ],
  liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
  signalingTopic: ' live_session_media:opaque/topic-with-segments ',
};

function createHarness(
  options: {
    readonly onChannelTerminated?: () => void;
    readonly onError?: (reason: string) => void;
  } = {},
) {
  const channel = new FakeChannel();
  const topics: string[] = [];
  const peerConnections: FakePeerConnection[] = [];
  const peerConnectionConfigs: HostBroadcastPublishingPeerConnectionConfig[] = [];
  const tracks = [{ id: 'audio-track' }, { id: 'video-track' }];
  const stream = {
    getTracks() {
      return tracks;
    },
  };
  let localDisposeCount = 0;
  let readyCount = 0;
  let channelTerminatedCount = 0;
  const errorReasons: string[] = [];
  const socket = {
    channel(topic: string) {
      topics.push(topic);
      return channel;
    },
  };
  const runtime = createHostBroadcastPublishingRuntime({
    disposeLocalMedia: () => {
      localDisposeCount += 1;
    },
    localStream: stream,
    onNegotiationReady: () => {
      readyCount += 1;
    },
    onError: (reason) => {
      errorReasons.push(reason);
      options.onError?.(reason);
    },
    onChannelTerminated: () => {
      channelTerminatedCount += 1;
      options.onChannelTerminated?.();
    },
    peerConnectionFactory(config) {
      peerConnectionConfigs.push(config);
      const peerConnection = new FakePeerConnection();
      peerConnections.push(peerConnection);
      return peerConnection;
    },
    preparedMedia,
    socket,
  });

  return {
    channel,
    get channelTerminatedCount() {
      return channelTerminatedCount;
    },
    get localDisposeCount() {
      return localDisposeCount;
    },
    peerConnectionConfigs,
    peerConnections,
    errorReasons,
    get readyCount() {
      return readyCount;
    },
    runtime,
    stream,
    topics,
    tracks,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('createHostBroadcastPublishingRuntime', () => {
  test('joins the exact signaling topic, attaches local tracks, and pushes a host offer', async () => {
    const {
      channel,
      peerConnectionConfigs,
      peerConnections,
      runtime,
      stream,
      topics,
      tracks,
    } = createHarness();

    const start = runtime.start();

    expect(topics).toEqual([preparedMedia.signalingTopic]);
    expect(peerConnectionConfigs).toEqual([
      {
        iceServers: [
          {
            urls: ['stun:stun.example.test:3478'],
          },
          {
            credential: 'turn-secret',
            credentialType: 'PASSWORD',
            username: 'turn-user',
            urls: ['turn:turn.example.test:3478'],
          },
        ],
      },
    ]);

    channel.joinPush.resolve('ok');

    await expect(start).resolves.toEqual({ status: 'started' });
    expect(peerConnections).toHaveLength(1);
    expect(peerConnections[0].addTrackCalls).toEqual([
      { stream, track: tracks[0] },
      { stream, track: tracks[1] },
    ]);
    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
    ]);
    expect(channel.pushes).toContainEqual({
      eventName: 'media:offer',
      payload: {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
      push: expect.any(FakePush),
    });
  });

  test('pushes local ICE candidates as media ice_candidate payloads', async () => {
    const { channel, peerConnections, runtime } = createHarness();

    const start = runtime.start();
    channel.joinPush.resolve('ok');
    await start;

    peerConnections[0].emitLocalIceCandidate({
      candidate:
        'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
      sdpMLineIndex: 0,
      sdpMid: '0',
      usernameFragment: 'ufrag',
    });
    peerConnections[0].emitLocalIceCandidate(null);

    expect(channel.pushes).toContainEqual({
      eventName: 'media:ice_candidate',
      payload: {
        candidate:
          'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
        sdp_m_line_index: 0,
        sdp_mid: '0',
        username_fragment: 'ufrag',
      },
      push: expect.any(FakePush),
    });
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:ice_candidate'),
    ).toHaveLength(1);
  });

  test('re-sends the stored offer when a viewer becomes ready before negotiation completes', async () => {
    const harness = createHarness();
    const { channel, runtime } = harness;

    await startAndFlush(runtime, channel);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toHaveLength(1);

    channel.emit('media:viewer_ready', {
      sender_role: 'host',
    });
    channel.emit('media:viewer_ready', {
      sender_role: 'viewer',
    });

    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toEqual([
      {
        eventName: 'media:offer',
        payload: {
          sdp: 'v=0\r\nhost-offer',
          type: 'offer',
        },
        push: expect.any(FakePush),
      },
      {
        eventName: 'media:offer',
        payload: {
          sdp: 'v=0\r\nhost-offer',
          type: 'offer',
        },
        push: expect.any(FakePush),
      },
    ]);

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    channel.emit('media:viewer_ready', {
      sender_role: 'viewer',
    });

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toHaveLength(2);
  });

  test('applies viewer answers and ICE candidates while ignoring host-authored or invalid media events', async () => {
    const { channel, peerConnections, runtime } = createHarness();

    await startAndFlush(runtime, channel);

    channel.emit('media:answer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-authored-answer',
      type: 'answer',
    });
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: '   ',
      type: 'answer',
    });
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    channel.emit('media:ice_candidate', {
      candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
      sender_role: 'host',
    });
    channel.emit('media:ice_candidate', {
      candidate: '   ',
      sender_role: 'viewer',
    });
    channel.emit('media:ice_candidate', {
      candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'viewer',
      username_fragment: 'viewer-ufrag',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
    ]);
    expect(peerConnections[0].addIceCandidateCalls).toEqual([
      {
        candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'viewer-ufrag',
      },
    ]);
  });

  test('reports negotiation readiness once after a viewer answer is applied', async () => {
    const harness = createHarness();
    const { channel, runtime } = harness;

    await startAndFlush(runtime, channel);
    expect(runtime.isNegotiationReady()).toBe(false);

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer-again',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
  });

  test('does not report negotiation readiness when disposed while applying a viewer answer', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    runtime.dispose();
    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(runtime.isNegotiationReady()).toBe(false);
    expect(harness.readyCount).toBe(0);
  });

  test('does not push an offer or report started when disposed while setting the local description', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;
    const start = runtime.start();
    const localDescription = createDeferred();

    peerConnections[0].setLocalDescriptionDeferred = localDescription;
    channel.joinPush.resolve('ok');
    await flushAsyncHandlers();

    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
    ]);

    runtime.dispose();
    localDescription.resolve();

    await expect(start).resolves.toEqual({
      reason: 'Could not start host media publishing. Please try again.',
      status: 'error',
    });
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toHaveLength(0);
    expect(harness.errorReasons).toEqual([]);
  });

  test('disposes channel, peer connection, and local native media once', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);

    runtime.dispose();
    runtime.dispose();

    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
  });

  test('reports media signaling channel termination so retained sessions can release on end', async () => {
    const store = createHostBroadcastPublishingSessionStore();
    const harness = createHarness({
      onChannelTerminated: () => {
        store.release('live-session-id');
      },
    });
    const { channel, peerConnections, runtime } = harness;
    let disconnectCount = 0;

    await startAndFlush(runtime, channel);

    store.retain('live-session-id', {
      disconnectSocket: () => {
        disconnectCount += 1;
      },
      runtime,
    });

    expect(store.has('live-session-id')).toBe(true);

    channel.close();

    expect(harness.channelTerminatedCount).toBe(1);
    expect(store.has('live-session-id')).toBe(false);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
    expect(disconnectCount).toBe(1);

    channel.error({ reason: 'session_ended' });

    expect(harness.channelTerminatedCount).toBe(2);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
    expect(disconnectCount).toBe(1);
  });
});

async function startAndFlush(
  runtime: ReturnType<typeof createHostBroadcastPublishingRuntime>,
  channel: FakeChannel,
): Promise<void> {
  const start = runtime.start();
  channel.joinPush.resolve('ok');
  await expect(start).resolves.toEqual({ status: 'started' });
  await flushAsyncHandlers();
}

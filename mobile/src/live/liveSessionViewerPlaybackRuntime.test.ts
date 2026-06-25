import { describe, expect, test } from 'bun:test';

import type {
  LiveSessionChannel,
  LiveSessionChannelPush,
  LiveSessionChannelPushStatus,
} from './liveSessionChannelClient';
import {
  createLiveSessionViewerMediaAnswerPayload,
  createLiveSessionViewerMediaIceCandidatePayload,
  createLiveSessionViewerPlaybackRuntime,
  readPreparedLiveSessionViewerMedia,
  type LiveSessionViewerPlaybackIceCandidate,
  type LiveSessionViewerPlaybackPeerConnection,
  type LiveSessionViewerPlaybackPeerConnectionConfig,
  type LiveSessionViewerPlaybackSessionDescription,
} from './liveSessionViewerPlaybackRuntime';

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

class FakePeerConnection implements LiveSessionViewerPlaybackPeerConnection {
  readonly addIceCandidateCalls: LiveSessionViewerPlaybackIceCandidate[] = [];
  readonly localDescriptions: LiveSessionViewerPlaybackSessionDescription[] = [];
  readonly remoteDescriptions: LiveSessionViewerPlaybackSessionDescription[] = [];
  addIceCandidateError: Error | null = null;
  answer: LiveSessionViewerPlaybackSessionDescription = {
    sdp: 'v=0\r\nviewer-answer',
    type: 'answer',
  };
  closeCount = 0;
  createAnswerError: Error | null = null;
  createAnswerDeferred: Deferred<LiveSessionViewerPlaybackSessionDescription> | null =
    null;
  onicecandidate:
    | ((
        event: Readonly<{
          candidate?: LiveSessionViewerPlaybackIceCandidate | null;
        }>,
      ) => void)
    | null = null;
  ontrack:
    | ((
        event: Readonly<{
          streams?: ReadonlyArray<unknown>;
        }>,
      ) => void)
    | null = null;
  setLocalDescriptionDeferred: Deferred | null = null;
  setLocalDescriptionError: Error | null = null;
  setRemoteDescriptionDeferred: Deferred | null = null;
  setRemoteDescriptionError: Error | null = null;

  addIceCandidate(
    candidate: LiveSessionViewerPlaybackIceCandidate,
  ): Promise<void> {
    this.addIceCandidateCalls.push(candidate);
    if (this.addIceCandidateError) {
      return Promise.reject(this.addIceCandidateError);
    }

    return Promise.resolve();
  }

  close(): void {
    this.closeCount += 1;
  }

  createAnswer(): Promise<LiveSessionViewerPlaybackSessionDescription> {
    if (this.createAnswerError) {
      return Promise.reject(this.createAnswerError);
    }

    return this.createAnswerDeferred?.promise ?? Promise.resolve(this.answer);
  }

  setLocalDescription(
    description: LiveSessionViewerPlaybackSessionDescription,
  ): Promise<void> {
    this.localDescriptions.push(description);
    if (this.setLocalDescriptionError) {
      return Promise.reject(this.setLocalDescriptionError);
    }

    return this.setLocalDescriptionDeferred?.promise ?? Promise.resolve();
  }

  setRemoteDescription(
    description: LiveSessionViewerPlaybackSessionDescription,
  ): Promise<void> {
    this.remoteDescriptions.push(description);
    if (this.setRemoteDescriptionError) {
      return Promise.reject(this.setRemoteDescriptionError);
    }

    return this.setRemoteDescriptionDeferred?.promise ?? Promise.resolve();
  }

  emitLocalIceCandidate(
    candidate: LiveSessionViewerPlaybackIceCandidate | null,
  ): void {
    this.onicecandidate?.({ candidate });
  }

  emitRemoteStream(stream: unknown): void {
    this.ontrack?.({ streams: [stream] });
  }
}

const preparedMedia = {
  iceServers: [
    {
      credential: null,
      credentialType: null,
      username: null,
      urls: ['stun:stun.example.test:3478'],
    },
    {
      credential: 'turn-secret',
      credentialType: 'PASSWORD' as const,
      username: 'turn-user',
      urls: ['turn:turn.example.test:3478'],
    },
  ],
  liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
  signalingTopic: ' live_session_media:opaque/topic-with-segments ',
};

function createHarness() {
  const channel = new FakeChannel();
  const topics: string[] = [];
  const peerConnections: FakePeerConnection[] = [];
  const peerConnectionConfigs: LiveSessionViewerPlaybackPeerConnectionConfig[] =
    [];
  const remoteStreams: Array<unknown | null> = [];
  const errorReasons: string[] = [];
  let channelTerminatedCount = 0;
  const socket = {
    channel(topic: string) {
      topics.push(topic);
      return channel;
    },
  };
  const runtime = createLiveSessionViewerPlaybackRuntime({
    onChannelTerminated: () => {
      channelTerminatedCount += 1;
    },
    onError: (reason) => {
      errorReasons.push(reason);
    },
    onRemoteStream: (stream) => {
      remoteStreams.push(stream);
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

  async function startRuntime() {
    const start = runtime.start();
    channel.joinPush.resolve('ok');
    await expect(start).resolves.toEqual({ status: 'started' });
  }

  return {
    channel,
    get channelTerminatedCount() {
      return channelTerminatedCount;
    },
    errorReasons,
    peerConnectionConfigs,
    peerConnections,
    remoteStreams,
    runtime,
    startRuntime,
    topics,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

async function applyHostOffer(channel: FakeChannel): Promise<void> {
  channel.emit('media:offer', {
    sender_role: 'host',
    sdp: 'v=0\r\nhost-offer',
    type: 'offer',
  });
  await flushAsyncHandlers();
}

describe('live session viewer media helpers', () => {
  test('normalizes successful prepare payloads without parsing opaque topics', () => {
    expect(
      readPreparedLiveSessionViewerMedia({
        errors: [],
        iceServers: preparedMedia.iceServers,
        liveSession: {
          id: preparedMedia.liveSessionId,
          status: 'LIVE',
        },
        signalingTopic: preparedMedia.signalingTopic,
      }),
    ).toEqual(preparedMedia);
  });

  test('omits unsupported OAuth ICE servers from viewer media preparation', () => {
    expect(
      readPreparedLiveSessionViewerMedia({
        errors: [],
        iceServers: [
          {
            credential: 'oauth-token',
            credentialType: 'OAUTH',
            username: 'oauth-user',
            urls: ['turn:oauth.example.test:3478'],
          },
          {
            credential: 'future-secret',
            credentialType: 'TOKEN',
            username: 'future-user',
            urls: ['turn:future.example.test:3478'],
          },
          {
            credential: 'turn-secret',
            credentialType: 'PASSWORD',
            username: 'turn-user',
            urls: ['turn:turn.example.test:3478'],
          },
        ],
        liveSession: {
          id: preparedMedia.liveSessionId,
          status: 'LIVE',
        },
        signalingTopic: preparedMedia.signalingTopic,
      })?.iceServers,
    ).toEqual([
      {
        credential: 'turn-secret',
        credentialType: 'PASSWORD',
        username: 'turn-user',
        urls: ['turn:turn.example.test:3478'],
      },
    ]);
    expect(
      readPreparedLiveSessionViewerMedia({
        errors: [],
        iceServers: [
          {
            credential: 'oauth-token',
            credentialType: 'OAUTH',
            username: 'oauth-user',
            urls: ['turn:oauth.example.test:3478'],
          },
        ],
        liveSession: {
          id: preparedMedia.liveSessionId,
          status: 'LIVE',
        },
        signalingTopic: preparedMedia.signalingTopic,
      }),
    ).toBeNull();
  });

  test('rejects prepare payloads with errors, ended sessions, blank topics, or missing ICE servers', () => {
    const valid = {
      errors: [],
      iceServers: [{ urls: ['stun:stun.example.test:3478'] }],
      liveSession: {
        id: preparedMedia.liveSessionId,
        status: 'LIVE',
      },
      signalingTopic: preparedMedia.signalingTopic,
    };

    expect(
      readPreparedLiveSessionViewerMedia({
        ...valid,
        errors: [{ field: null, message: 'not_authorized' }],
      }),
    ).toBeNull();
    expect(
      readPreparedLiveSessionViewerMedia({
        ...valid,
        liveSession: { ...valid.liveSession, status: 'ENDED' },
      }),
    ).toBeNull();
    expect(
      readPreparedLiveSessionViewerMedia({
        ...valid,
        signalingTopic: '   ',
      }),
    ).toBeNull();
    expect(
      readPreparedLiveSessionViewerMedia({
        ...valid,
        iceServers: [],
      }),
    ).toBeNull();
  });

  test('creates only validated viewer answer payloads', () => {
    expect(
      createLiveSessionViewerMediaAnswerPayload({
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      }),
    ).toEqual({
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    expect(
      createLiveSessionViewerMediaAnswerPayload({
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      }),
    ).toBeNull();
    expect(
      createLiveSessionViewerMediaAnswerPayload({
        sdp: '   ',
        type: 'answer',
      }),
    ).toBeNull();
  });

  test('creates viewer ICE payloads with signaling snake_case keys', () => {
    expect(
      createLiveSessionViewerMediaIceCandidatePayload({
        candidate:
          'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'ufrag',
      }),
    ).toEqual({
      candidate:
        'candidate:842163049 1 udp 1677729535 192.0.2.10 54400 typ srflx',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      username_fragment: 'ufrag',
    });
    expect(
      createLiveSessionViewerMediaIceCandidatePayload({
        candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
        sdpMLineIndex: null,
        sdpMid: null,
        usernameFragment: null,
      }),
    ).toEqual({
      candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
    });
    expect(
      createLiveSessionViewerMediaIceCandidatePayload({
        candidate: 'candidate:2 1 udp 1 192.0.2.11 54400 typ host',
        sdpMid: '   ',
        usernameFragment: '',
      }),
    ).toEqual({
      candidate: 'candidate:2 1 udp 1 192.0.2.11 54400 typ host',
    });
    expect(
      createLiveSessionViewerMediaIceCandidatePayload({
        candidate: '   ',
      }),
    ).toBeNull();
    expect(
      createLiveSessionViewerMediaIceCandidatePayload({
        candidate: 'candidate',
        sdpMLineIndex: -1,
      }),
    ).toBeNull();
  });
});

describe('createLiveSessionViewerPlaybackRuntime', () => {
  test('joins the exact signaling topic and answers host offers', async () => {
    const {
      channel,
      peerConnectionConfigs,
      peerConnections,
      runtime,
      topics,
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
            username: 'turn-user',
            urls: ['turn:turn.example.test:3478'],
          },
        ],
      },
    ]);

    channel.joinPush.resolve('ok');
    await expect(start).resolves.toEqual({ status: 'started' });
    expect(channel.pushes).toContainEqual({
      eventName: 'media:viewer_ready',
      payload: {},
      push: expect.any(FakePush),
    });

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
    ]);
    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
    ]);
    expect(channel.pushes).toContainEqual({
      eventName: 'media:answer',
      payload: {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
      push: expect.any(FakePush),
    });
  });

  test('pushes local ICE candidates as media ice_candidate payloads', async () => {
    const { channel, peerConnections, startRuntime } = createHarness();

    await startRuntime();

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

  test('applies host ICE candidates and ignores viewer-authored or malformed media events', async () => {
    const { channel, peerConnections, startRuntime } = createHarness();

    await startRuntime();
    await applyHostOffer(channel);

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
      sender_role: 'viewer',
    });
    channel.emit('media:ice_candidate', {
      candidate: '   ',
      sender_role: 'host',
    });
    channel.emit('media:ice_candidate', {
      candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'host',
      username_fragment: 'host-ufrag',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([
      {
        candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'host-ufrag',
      },
    ]);
  });

  test('queues host ICE candidates until the remote offer is applied', async () => {
    const { channel, peerConnections, startRuntime } = createHarness();

    await startRuntime();
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    await applyHostOffer(channel);

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'host',
      username_fragment: 'host-ufrag',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([]);

    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([
      {
        candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'host-ufrag',
      },
    ]);
    expect(channel.pushes).toContainEqual({
      eventName: 'media:answer',
      payload: {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
      push: expect.any(FakePush),
    });
  });

  test('reports remote streams from peer connection track events', async () => {
    const { peerConnections, remoteStreams, startRuntime } = createHarness();
    const remoteStream = { id: 'remote-stream' };

    await startRuntime();
    peerConnections[0].emitRemoteStream(remoteStream);

    expect(remoteStreams).toEqual([remoteStream]);
  });

  test('disposes channel and peer connection on channel close or error', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime, startRuntime } = harness;

    await startRuntime();
    peerConnections[0].emitRemoteStream({ id: 'remote-stream' });

    channel.close();

    expect(harness.channelTerminatedCount).toBe(1);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.remoteStreams).toEqual([{ id: 'remote-stream' }, null]);

    runtime.dispose();
    channel.error({ reason: 'session_ended' });

    expect(harness.channelTerminatedCount).toBe(2);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
  });

  test('does not push an answer when disposed while setting the local description', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime, startRuntime } = harness;

    await startRuntime();
    const localDescription = createDeferred();
    peerConnections[0].setLocalDescriptionDeferred = localDescription;

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
    ]);

    runtime.dispose();
    localDescription.resolve();
    await flushAsyncHandlers();

    expect(
      channel.pushes.filter((push) => push.eventName === 'media:answer'),
    ).toHaveLength(0);
    expect(harness.errorReasons).toEqual([]);
  });

  test('disposes playback resources and clears remote stream after fatal answer negotiation failures', async () => {
    const cases: ReadonlyArray<{
      readonly fail: (peerConnection: FakePeerConnection) => void;
      readonly name: string;
    }> = [
      {
        fail: (peerConnection) => {
          peerConnection.setRemoteDescriptionError = new Error(
            'remote description failed',
          );
        },
        name: 'setRemoteDescription',
      },
      {
        fail: (peerConnection) => {
          peerConnection.createAnswerError = new Error('create answer failed');
        },
        name: 'createAnswer',
      },
      {
        fail: (peerConnection) => {
          peerConnection.setLocalDescriptionError = new Error(
            'local description failed',
          );
        },
        name: 'setLocalDescription',
      },
    ];

    for (const testCase of cases) {
      const harness = createHarness();
      const { channel, peerConnections, startRuntime } = harness;

      await startRuntime();
      peerConnections[0].emitRemoteStream({ id: `remote-${testCase.name}` });
      testCase.fail(peerConnections[0]);

      channel.emit('media:offer', {
        sender_role: 'host',
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      });
      await flushAsyncHandlers();

      expect(harness.errorReasons).toEqual([
        'Could not start live video playback. Please try again.',
      ]);
      expect(channel.leaveCount).toBe(1);
      expect(peerConnections[0].closeCount).toBe(1);
      expect(harness.remoteStreams).toEqual([
        { id: `remote-${testCase.name}` },
        null,
      ]);
    }
  });

  test('disposes playback resources and clears remote stream after fatal host ICE failures', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    peerConnections[0].emitRemoteStream({ id: 'remote-stream' });
    await applyHostOffer(channel);
    peerConnections[0].addIceCandidateError = new Error(
      'add ice candidate failed',
    );

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
      sender_role: 'host',
    });
    await flushAsyncHandlers();

    expect(harness.errorReasons).toEqual([
      'Could not start live video playback. Please try again.',
    ]);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.remoteStreams).toEqual([{ id: 'remote-stream' }, null]);
  });
});

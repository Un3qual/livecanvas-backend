import { describe, expect, test } from 'vitest';

import type { HostBroadcastMediaPreparation } from '../../src/host/hostBroadcastMediaSignaling';
import { createHostBroadcastPublishingSessionStore } from '../../src/host/publishing/hostBroadcastPublishingSessionStore';
import {
  createHostBroadcastPublishingRuntime,
  type HostBroadcastPublishingChannelTerminationReason,
  type HostBroadcastPublishingPeerConnectionConfig,
} from '../../src/host/publishing/hostBroadcastPublishingRuntime';
import { createLiveWebRtcPeerConnectionFactory } from '../../src/live/media/liveWebRtcAdapter';
import {
  FakeChannel,
  FakePush,
} from '../live/support/fakeLiveSessionChannel';
import {
  createDeferred,
  FakeHostBroadcastPeerConnection as FakePeerConnection,
} from '../live/support/fakeWebRtcPeerConnection';

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
    readonly onChannelTerminated?: (
      reason: HostBroadcastPublishingChannelTerminationReason,
    ) => void;
    readonly onError?: (reason: string) => void;
    readonly onNegotiationPending?: () => void;
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
  let pendingCount = 0;
  let readyCount = 0;
  let channelTerminatedCount = 0;
  const channelTerminationReasons: HostBroadcastPublishingChannelTerminationReason[] =
    [];
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
    onNegotiationPending: () => {
      pendingCount += 1;
      options.onNegotiationPending?.();
    },
    onError: (reason) => {
      errorReasons.push(reason);
      options.onError?.(reason);
    },
    onChannelTerminated: (reason) => {
      channelTerminatedCount += 1;
      channelTerminationReasons.push(reason);
      options.onChannelTerminated?.(reason);
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
    get channelTerminationReasons() {
      return channelTerminationReasons;
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
    get pendingCount() {
      return pendingCount;
    },
    runtime,
    stream,
    topics,
    tracks,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let index = 0; index < 200; index += 1) {
    await Promise.resolve();
  }
}

describe('createHostBroadcastPublishingRuntime', () => {
  test('creates host peer connection factories with host runtime types', () => {
    class MockPeerConnection extends FakePeerConnection {
      readonly config: HostBroadcastPublishingPeerConnectionConfig;

      constructor(config: HostBroadcastPublishingPeerConnectionConfig) {
        super();
        this.config = config;
      }
    }

    const factory = createLiveWebRtcPeerConnectionFactory<
      HostBroadcastPublishingPeerConnectionConfig,
      MockPeerConnection
    >({
      RTCPeerConnection: MockPeerConnection,
    });
    const config = { iceServers: [] };
    const peerConnection = factory?.(config);

    expect(peerConnection).toBeInstanceOf(MockPeerConnection);
    expect(peerConnection?.config).toBe(config);
  });

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

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toHaveLength(2);
  });

  test('restarts single-viewer negotiation when a viewer becomes ready after negotiation completes', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
    expect(harness.pendingCount).toBe(0);

    channel.emit('media:viewer_ready', {
      sender_role: 'viewer',
    });
    await flushAsyncHandlers();

    expect(peerConnections).toHaveLength(2);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(peerConnections[1].addTrackCalls).toEqual([
      { stream: harness.stream, track: harness.tracks[0] },
      { stream: harness.stream, track: harness.tracks[1] },
    ]);
    expect(runtime.isNegotiationReady()).toBe(false);
    expect(harness.pendingCount).toBe(1);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:offer'),
    ).toHaveLength(2);

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer-after-restart',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(2);
    expect(harness.pendingCount).toBe(1);
  });

  test('replays gathered host ICE candidates after a late viewer readiness signal', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);
    peerConnections[0].emitLocalIceCandidate({
      candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
      sdpMLineIndex: 0,
      sdpMid: '0',
      usernameFragment: 'host-ufrag',
    });

    expect(
      channel.pushes.filter((push) => push.eventName === 'media:ice_candidate'),
    ).toHaveLength(1);

    channel.emit('media:viewer_ready', {
      sender_role: 'viewer',
    });

    expect(channel.pushes.slice(-2)).toEqual([
      {
        eventName: 'media:offer',
        payload: {
          sdp: 'v=0\r\nhost-offer',
          type: 'offer',
        },
        push: expect.any(FakePush),
      },
      {
        eventName: 'media:ice_candidate',
        payload: {
          candidate: 'candidate:host 1 udp 1 192.0.2.10 54400 typ host',
          sdp_m_line_index: 0,
          sdp_mid: '0',
          username_fragment: 'host-ufrag',
        },
        push: expect.any(FakePush),
      },
    ]);
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

  test('queues viewer ICE candidates until the viewer answer is applied', async () => {
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

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'viewer',
      username_fragment: 'viewer-ufrag',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([]);

    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([
      {
        candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
        usernameFragment: 'viewer-ufrag',
      },
    ]);
    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
  });

  test('ignores duplicate viewer answers while one is applying or already applied', async () => {
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
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nduplicate-viewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
    ]);

    remoteDescription.resolve();
    await flushAsyncHandlers();
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nlate-duplicate-viewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toHaveLength(1);
    expect(runtime.isNegotiationReady()).toBe(true);
    expect(harness.readyCount).toBe(1);
    expect(harness.errorReasons).toEqual([]);
  });

  test('bounds queued viewer ICE candidates while waiting for the viewer answer', async () => {
    const { channel, peerConnections, runtime } = createHarness();

    await startAndFlush(runtime, channel);

    for (let index = 0; index < 55; index += 1) {
      channel.emit('media:ice_candidate', {
        candidate: `candidate:viewer-${index}`,
        sender_role: 'viewer',
      });
    }

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toHaveLength(50);
    expect(peerConnections[0].addIceCandidateCalls[0]).toEqual({
      candidate: 'candidate:viewer-5',
    });
    expect(peerConnections[0].addIceCandidateCalls[49]).toEqual({
      candidate: 'candidate:viewer-54',
    });
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

  test('disposes retained publishing resources after viewer answer application fails', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);
    peerConnections[0].setRemoteDescriptionError = new Error(
      'invalid_viewer_answer',
    );

    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();

    expect(harness.errorReasons).toEqual([
      'Could not start host media publishing. Please try again.',
    ]);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
    expect(runtime.isNegotiationReady()).toBe(false);

    channel.emit('media:viewer_ready', {
      sender_role: 'viewer',
    });
    await flushAsyncHandlers();

    expect(peerConnections).toHaveLength(1);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
  });

  test('disposes retained publishing resources after viewer ICE application fails', async () => {
    const harness = createHarness();
    const { channel, peerConnections, runtime } = harness;

    await startAndFlush(runtime, channel);
    channel.emit('media:answer', {
      sender_role: 'viewer',
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    await flushAsyncHandlers();
    peerConnections[0].addIceCandidateError = new Error('invalid_viewer_ice');

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:viewer 1 udp 1 192.0.2.11 54401 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'viewer',
      username_fragment: 'viewer-ufrag',
    });
    await flushAsyncHandlers();

    expect(harness.errorReasons).toEqual([
      'Could not start host media publishing. Please try again.',
    ]);
    expect(channel.leaveCount).toBe(1);
    expect(peerConnections[0].closeCount).toBe(1);
    expect(harness.localDisposeCount).toBe(1);
    expect(runtime.isNegotiationReady()).toBe(true);
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
    expect(harness.channelTerminationReasons).toEqual(['closed', 'errored']);
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

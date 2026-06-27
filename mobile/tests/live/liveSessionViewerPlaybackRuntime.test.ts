import { describe, expect, test } from 'bun:test';

import {
  createLiveSessionViewerMediaAnswerPayload,
  createLiveSessionViewerMediaIceCandidatePayload,
  createLiveSessionViewerPlaybackRuntime,
  readPreparedLiveSessionViewerMedia,
  type LiveSessionViewerPlaybackPeerConnectionConfig,
} from '../../src/live/liveSessionViewerPlaybackRuntime';
import {
  createLiveMediaSessionDescriptionPayload,
  isRecord,
  readOptionalNonNegativeInteger,
  readOptionalString,
} from '../../src/live/media/liveMediaPayloads';
import { createLiveWebRtcPeerConnectionFactory } from '../../src/live/media/liveWebRtcAdapter';
import {
  createLiveSessionViewerMediaAnswerPayload as createPreparedViewerAnswerPayload,
  createLiveSessionViewerMediaIceCandidatePayload as createPreparedViewerIceCandidatePayload,
  readPreparedLiveSessionViewerMedia as readPreparedViewerMedia,
} from '../../src/live/playback/liveSessionViewerPlaybackPreparation';
import { FakeChannel, FakePush } from './support/fakeLiveSessionChannel';
import {
  createDeferred,
  FakeLiveSessionViewerPeerConnection as FakePeerConnection,
} from './support/fakeWebRtcPeerConnection';

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
  for (let index = 0; index < 200; index += 1) {
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
  test('exports preparation helpers from the playback preparation module', () => {
    expect(
      readPreparedViewerMedia({
        errors: [],
        iceServers: preparedMedia.iceServers,
        liveSession: {
          id: preparedMedia.liveSessionId,
          status: 'STARTING',
        },
        signalingTopic: preparedMedia.signalingTopic,
      }),
    ).toEqual({
      ...preparedMedia,
      liveSessionId: preparedMedia.liveSessionId,
    });
    expect(
      createPreparedViewerAnswerPayload({
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      }),
    ).toEqual({
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    expect(
      createPreparedViewerIceCandidatePayload({
        candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      }),
    ).toEqual({
      candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
    });
  });

  test('shared media helpers validate descriptions and optional primitives', () => {
    expect(
      createLiveMediaSessionDescriptionPayload(
        {
          sdp: 'v=0\r\nviewer-answer',
          type: 'answer',
        },
        'answer',
      ),
    ).toEqual({
      sdp: 'v=0\r\nviewer-answer',
      type: 'answer',
    });
    expect(
      createLiveMediaSessionDescriptionPayload(
        {
          sdp: 'v=0\r\nhost-offer',
          type: 'offer',
        },
        'answer',
      ),
    ).toBeNull();

    expect(isRecord({ candidate: 'candidate' })).toBe(true);
    expect(isRecord(['candidate'])).toBe(false);
    expect(readOptionalString('  mid  ')).toBe('mid');
    expect(readOptionalString('  ')).toBeNull();
    expect(readOptionalString(42)).toBeUndefined();
    expect(readOptionalNonNegativeInteger(0)).toBe(0);
    expect(readOptionalNonNegativeInteger(null)).toBeNull();
    expect(readOptionalNonNegativeInteger(-1)).toBeUndefined();
  });

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

describe('live session viewer WebRTC adapter boundary', () => {
  test('creates viewer peer connection factories with viewer runtime types', () => {
    class MockPeerConnection extends FakePeerConnection {
      readonly config: LiveSessionViewerPlaybackPeerConnectionConfig;

      constructor(config: LiveSessionViewerPlaybackPeerConnectionConfig) {
        super();
        this.config = config;
      }
    }

    const factory = createLiveWebRtcPeerConnectionFactory<
      LiveSessionViewerPlaybackPeerConnectionConfig,
      MockPeerConnection
    >({
      RTCPeerConnection: MockPeerConnection,
    });
    const config = { iceServers: [] };
    const peerConnection = factory?.(config);

    expect(peerConnection).toBeInstanceOf(MockPeerConnection);
    expect(peerConnection?.config).toBe(config);
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

  test('ignores duplicate host offers while answering and after the first offer is applied', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

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

    remoteDescription.resolve();
    await flushAsyncHandlers();

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toHaveLength(1);
    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
    ]);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:answer'),
    ).toHaveLength(1);
    expect(harness.errorReasons).toEqual([]);
  });

  test('answers only the fresh host offer received while an earlier offer is still applying', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer-2',
      type: 'offer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
    ]);

    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
      {
        sdp: 'v=0\r\nhost-offer-2',
        type: 'offer',
      },
    ]);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:answer'),
    ).toHaveLength(1);
    expect(harness.errorReasons).toEqual([]);
  });

  test('applies host ICE after the queued fresh host offer is accepted', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer-2',
      type: 'offer',
    });
    channel.emit('media:ice_candidate', {
      candidate: 'candidate:fresh-host 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'host',
      username_fragment: 'fresh-host-ufrag',
    });
    await flushAsyncHandlers();

    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(peerConnections[0].operations).toEqual([
      {
        description: {
          sdp: 'v=0\r\nhost-offer',
          type: 'offer',
        },
        type: 'setRemoteDescription',
      },
      {
        description: {
          sdp: 'v=0\r\nhost-offer-2',
          type: 'offer',
        },
        type: 'setRemoteDescription',
      },
      {
        candidate: {
          candidate: 'candidate:fresh-host 1 udp 1 192.0.2.10 54400 typ host',
          sdpMLineIndex: 0,
          sdpMid: '0',
          usernameFragment: 'fresh-host-ufrag',
        },
        type: 'addIceCandidate',
      },
    ]);
    expect(harness.errorReasons).toEqual([]);
  });

  test('drops queued old-offer ICE when a fresh host offer supersedes it', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    const remoteDescription = createDeferred();
    peerConnections[0].setRemoteDescriptionDeferred = remoteDescription;

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    channel.emit('media:ice_candidate', {
      candidate: 'candidate:old-host 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      sender_role: 'host',
      username_fragment: 'old-host-ufrag',
    });
    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer-2',
      type: 'offer',
    });
    await flushAsyncHandlers();

    remoteDescription.resolve();
    await flushAsyncHandlers();

    expect(peerConnections[0].addIceCandidateCalls).toEqual([]);
    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
      {
        sdp: 'v=0\r\nhost-offer-2',
        type: 'offer',
      },
    ]);
    expect(harness.errorReasons).toEqual([]);
  });

  test('answers a later fresh host offer after ignoring duplicate replay', async () => {
    const harness = createHarness();
    const { channel, peerConnections, startRuntime } = harness;

    await startRuntime();
    await applyHostOffer(channel);

    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    await flushAsyncHandlers();

    peerConnections[0].answer = {
      sdp: 'v=0\r\nviewer-answer-2',
      type: 'answer',
    };
    channel.emit('media:offer', {
      sender_role: 'host',
      sdp: 'v=0\r\nhost-offer-2',
      type: 'offer',
    });
    await flushAsyncHandlers();

    expect(peerConnections[0].remoteDescriptions).toEqual([
      {
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      },
      {
        sdp: 'v=0\r\nhost-offer-2',
        type: 'offer',
      },
    ]);
    expect(peerConnections[0].localDescriptions).toEqual([
      {
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      },
      {
        sdp: 'v=0\r\nviewer-answer-2',
        type: 'answer',
      },
    ]);
    expect(
      channel.pushes.filter((push) => push.eventName === 'media:answer'),
    ).toHaveLength(2);
    expect(harness.errorReasons).toEqual([]);
  });

  test('bounds queued host ICE candidates while waiting for the host offer', async () => {
    const { channel, peerConnections, startRuntime } = createHarness();

    await startRuntime();

    for (let index = 0; index < 55; index += 1) {
      channel.emit('media:ice_candidate', {
        candidate: `candidate:host-${index}`,
        sender_role: 'host',
      });
    }

    await applyHostOffer(channel);

    expect(peerConnections[0].addIceCandidateCalls).toHaveLength(50);
    expect(peerConnections[0].addIceCandidateCalls[0]).toEqual({
      candidate: 'candidate:host-5',
    });
    expect(peerConnections[0].addIceCandidateCalls[49]).toEqual({
      candidate: 'candidate:host-54',
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

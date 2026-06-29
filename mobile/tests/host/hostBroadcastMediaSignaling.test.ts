import { describe, expect, test } from 'bun:test';

import {
  createHostBroadcastMediaIceCandidatePayload,
  createHostBroadcastMediaOfferPayload,
  isRetryableHostGoLiveMediaReadinessError,
  readPreparedHostBroadcastMedia,
} from '../../src/host/hostBroadcastMediaSignaling';
import {
  normalizeLiveMediaIceCandidatePayload,
  normalizeLiveMediaIceServers,
} from '../../src/live/media/liveMediaPayloads';

describe('hostBroadcastMediaSignaling', () => {
  test('normalizes successful prepare payloads without parsing opaque topics', () => {
    expect(
      readPreparedHostBroadcastMedia({
        errors: [],
        iceServers: [
          {
            credential: null,
            credentialType: null,
            username: null,
            urls: ['stun:stun.l.google.com:19302'],
          },
          {
            credential: 'turn-secret',
            credentialType: 'PASSWORD',
            username: 'turn-user',
            urls: [
              ' turn:turn.example.com:3478 ',
              'turns:turn.example.com:5349',
            ],
          },
        ],
        liveSession: {
          channelTopic: ' live_session:opaque-topic ',
          id: 'TGl2ZVNlc3Npb246MQ==',
          status: 'STARTING',
        },
        signalingTopic: ' live_session:opaque-topic ',
      }),
    ).toEqual({
      channelTopic: ' live_session:opaque-topic ',
      iceServers: [
        {
          credential: null,
          credentialType: null,
          username: null,
          urls: ['stun:stun.l.google.com:19302'],
        },
        {
          credential: 'turn-secret',
          credentialType: 'PASSWORD',
          username: 'turn-user',
          urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        },
      ],
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      signalingTopic: ' live_session:opaque-topic ',
    });
  });

  test('omits unsupported OAuth ICE servers from host media preparation', () => {
    expect(
      readPreparedHostBroadcastMedia({
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
          channelTopic: 'live_session:opaque-topic',
          id: 'TGl2ZVNlc3Npb246MQ==',
          status: 'STARTING',
        },
        signalingTopic: 'live_session_media:opaque-topic',
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
      readPreparedHostBroadcastMedia({
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
          channelTopic: 'live_session:opaque-topic',
          id: 'TGl2ZVNlc3Npb246MQ==',
          status: 'STARTING',
        },
        signalingTopic: 'live_session_media:opaque-topic',
      }),
    ).toBeNull();
  });

  test('rejects payloads with errors, ended sessions, blank topics, or missing ICE servers', () => {
    const valid = {
      errors: [],
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      liveSession: {
        channelTopic: 'live_session:opaque-topic',
        id: 'TGl2ZVNlc3Npb246MQ==',
        status: 'STARTING',
      },
      signalingTopic: 'live_session:opaque-topic',
    };

    expect(
      readPreparedHostBroadcastMedia({
        ...valid,
        errors: [{ field: null, message: 'not_authorized' }],
      }),
    ).toBeNull();
    expect(
      readPreparedHostBroadcastMedia({
        ...valid,
        liveSession: { ...valid.liveSession, status: 'ENDED' },
      }),
    ).toBeNull();
    expect(
      readPreparedHostBroadcastMedia({
        ...valid,
        signalingTopic: '   ',
      }),
    ).toBeNull();
    expect(
      readPreparedHostBroadcastMedia({
        ...valid,
        iceServers: [],
      }),
    ).toBeNull();
  });

  test('recognizes media_not_ready as the retryable host go-live state', () => {
    expect(
      isRetryableHostGoLiveMediaReadinessError([
        { field: null, message: 'media_not_ready' },
      ]),
    ).toBe(true);
    expect(
      isRetryableHostGoLiveMediaReadinessError([
        { field: null, message: 'not_authorized' },
      ]),
    ).toBe(false);
    expect(isRetryableHostGoLiveMediaReadinessError([])).toBe(false);
    expect(isRetryableHostGoLiveMediaReadinessError(null)).toBe(false);
  });

  test('creates only validated host media offer payloads', () => {
    expect(
      createHostBroadcastMediaOfferPayload({
        sdp: 'v=0\r\nhost-offer',
        type: 'offer',
      }),
    ).toEqual({
      sdp: 'v=0\r\nhost-offer',
      type: 'offer',
    });
    expect(
      createHostBroadcastMediaOfferPayload({
        sdp: 'v=0\r\nviewer-answer',
        type: 'answer',
      }),
    ).toBeNull();
    expect(
      createHostBroadcastMediaOfferPayload({
        sdp: '   ',
        type: 'offer',
      }),
    ).toBeNull();
  });

  test('creates host ICE payloads with signaling snake_case keys', () => {
    expect(
      createHostBroadcastMediaIceCandidatePayload({
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
      createHostBroadcastMediaIceCandidatePayload({
        candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
        sdpMLineIndex: null,
        sdpMid: null,
        usernameFragment: null,
      }),
    ).toEqual({
      candidate: 'candidate:1 1 udp 1 192.0.2.10 54400 typ host',
    });
    expect(
      createHostBroadcastMediaIceCandidatePayload({
        candidate: 'candidate:2 1 udp 1 192.0.2.11 54400 typ host',
        sdpMid: '   ',
        usernameFragment: '',
      }),
    ).toEqual({
      candidate: 'candidate:2 1 udp 1 192.0.2.11 54400 typ host',
    });
    expect(
      createHostBroadcastMediaIceCandidatePayload({
        candidate: '   ',
      }),
    ).toBeNull();
    expect(
      createHostBroadcastMediaIceCandidatePayload({
        candidate: 'candidate',
        sdpMLineIndex: -1,
      }),
    ).toBeNull();
  });

  test('shared media helpers normalize ICE servers and candidate toJSON payloads', () => {
    expect(
      normalizeLiveMediaIceServers([
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
          urls: [
            ' turn:turn.example.test:3478 ',
            42 as unknown as string,
            null as unknown as string,
            '',
          ],
        },
      ]),
    ).toEqual([
      {
        credential: 'turn-secret',
        credentialType: 'PASSWORD',
        username: 'turn-user',
        urls: ['turn:turn.example.test:3478'],
      },
    ]);

    expect(
      normalizeLiveMediaIceCandidatePayload({
        candidate: 'candidate:outer 1 udp 1 192.0.2.10 54400 typ host',
        toJSON: () => ({
          candidate: 'candidate:json 1 udp 1 192.0.2.10 54400 typ host',
          sdp_m_line_index: 0,
          sdp_mid: '0',
          username_fragment: 'ufrag',
        }),
      }),
    ).toEqual({
      candidate: 'candidate:json 1 udp 1 192.0.2.10 54400 typ host',
      sdp_m_line_index: 0,
      sdp_mid: '0',
      username_fragment: 'ufrag',
    });
  });
});

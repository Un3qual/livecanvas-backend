import { describe, expect, test } from 'bun:test';

import {
  isRetryableHostGoLiveMediaReadinessError,
  readPreparedHostBroadcastMedia,
} from './hostBroadcastMediaSignaling';

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
});

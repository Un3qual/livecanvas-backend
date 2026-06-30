import { describe, expect, test } from 'bun:test';

import { formatLiveSessionRecordingPresentation } from '../../src/live/recording/liveSessionRecordingPresentation';

describe('liveSessionRecordingPresentation', () => {
  test('offers a replay action for processed recordings with a nonblank public URL', () => {
    expect(
      formatLiveSessionRecordingPresentation({
        processingState: 'PROCESSED',
        publicUrl: '  https://media.example.test/replay/session-1.m3u8  ',
      }),
    ).toEqual({
      statusLabel: 'Replay ready',
      body: 'This session recording is ready to watch.',
      canOpen: true,
      publicUrl: 'https://media.example.test/replay/session-1.m3u8',
    });
  });

  test('keeps blank or missing processed URLs unavailable for opening', () => {
    expect(
      formatLiveSessionRecordingPresentation({
        processingState: 'PROCESSED',
        publicUrl: '   ',
      }),
    ).toEqual({
      statusLabel: 'Recording unavailable',
      body: 'The replay is not available yet.',
      canOpen: false,
      publicUrl: null,
    });

    expect(
      formatLiveSessionRecordingPresentation({
        processingState: 'PROCESSED',
        publicUrl: null,
      }),
    ).toEqual({
      statusLabel: 'Recording unavailable',
      body: 'The replay is not available yet.',
      canOpen: false,
      publicUrl: null,
    });
  });

  test('keeps malformed processed URLs unavailable for opening', () => {
    expect(
      formatLiveSessionRecordingPresentation({
        processingState: 'PROCESSED',
        publicUrl: 'not a url',
      }),
    ).toEqual({
      statusLabel: 'Recording unavailable',
      body: 'The replay is not available yet.',
      canOpen: false,
      publicUrl: null,
    });
  });

  test('formats upload and processing states as in-progress copy', () => {
    for (const processingState of ['PENDING_UPLOAD', 'UPLOADED']) {
      expect(
        formatLiveSessionRecordingPresentation({
          processingState,
          publicUrl: 'https://media.example.test/ignored',
        }),
      ).toEqual({
        statusLabel: 'Recording processing',
        body: 'The recording is still being prepared. Check back soon.',
        canOpen: false,
        publicUrl: null,
      });
    }
  });

  test('formats failed and unknown states without throwing', () => {
    expect(
      formatLiveSessionRecordingPresentation({
        processingState: 'FAILED',
        publicUrl: 'https://media.example.test/ignored',
      }),
    ).toEqual({
      statusLabel: 'Recording failed',
      body: 'The recording could not be processed.',
      canOpen: false,
      publicUrl: null,
    });

    expect(
      formatLiveSessionRecordingPresentation({
        processingState: '%future added value',
        publicUrl: 'https://media.example.test/ignored',
      }),
    ).toEqual({
      statusLabel: 'Recording unavailable',
      body: 'The replay is not available yet.',
      canOpen: false,
      publicUrl: null,
    });
  });
});

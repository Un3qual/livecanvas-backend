import { describe, expect, test } from 'bun:test';

import {
  badgeColorsForLiveStatusTone,
  canEnterLiveSession,
  formatLiveMutationErrors,
  formatLiveSessionStatus,
  formatLiveSessionTiming,
  formatLiveSessionVisibility,
  normalizeLiveSessionStatus,
  normalizeLiveSessionVisibility,
  type LiveMutationError,
} from './liveSessionPresentation';

describe('liveSessionPresentation', () => {
  test('formats known and future live-session statuses', () => {
    expect(formatLiveSessionStatus('STARTING')).toEqual({
      label: 'Starting soon',
      tone: 'pending',
    });
    expect(formatLiveSessionStatus('LIVE')).toEqual({
      label: 'Live now',
      tone: 'live',
    });
    expect(formatLiveSessionStatus('ENDED')).toEqual({
      label: 'Ended',
      tone: 'ended',
    });
    expect(formatLiveSessionStatus('%future added value')).toEqual({
      label: 'Status unavailable',
      tone: 'ended',
    });
  });

  test('normalizes unknown status and visibility values to Relay future sentinels', () => {
    expect(normalizeLiveSessionStatus('LIVE')).toBe('LIVE');
    expect(normalizeLiveSessionStatus('BUFFERING')).toBe(
      '%future added value',
    );
    expect(normalizeLiveSessionVisibility('PUBLIC')).toBe('PUBLIC');
    expect(normalizeLiveSessionVisibility('SUBSCRIBERS')).toBe(
      '%future added value',
    );
  });

  test('treats starting and live sessions as enterable', () => {
    expect(canEnterLiveSession('STARTING')).toBe(true);
    expect(canEnterLiveSession('LIVE')).toBe(true);
    expect(canEnterLiveSession('ENDED')).toBe(false);
    expect(canEnterLiveSession('%future added value')).toBe(false);
  });

  test('formats visibility without leaking policy internals', () => {
    expect(formatLiveSessionVisibility('PUBLIC')).toBe('Public');
    expect(formatLiveSessionVisibility('FOLLOWERS')).toBe('Followers');
    expect(formatLiveSessionVisibility('%future added value')).toBe('Visibility unavailable');
  });

  test('maps live status tones to theme colors', () => {
    const theme = {
      colors: {
        accent: 'accent',
        accentText: 'accentText',
        error: 'error',
        errorMuted: 'errorMuted',
        surfaceMuted: 'surfaceMuted',
        textMuted: 'textMuted',
      },
    };

    expect(badgeColorsForLiveStatusTone('live', theme)).toEqual({
      surface: 'accent',
      text: 'accentText',
    });
    expect(badgeColorsForLiveStatusTone('pending', theme)).toEqual({
      surface: 'surfaceMuted',
      text: 'accent',
    });
    expect(badgeColorsForLiveStatusTone('ended', theme)).toEqual({
      surface: 'errorMuted',
      text: 'error',
    });
  });

  test('formats timing from the status-specific timestamp', () => {
    expect(
      formatLiveSessionTiming({
        endedAt: null,
        insertedAt: '2026-06-01T16:00:00Z',
        startedAt: '2026-06-01T16:04:00Z',
        status: 'LIVE',
      }),
    ).toBe('Live since Jun 1, 2026');

    expect(
      formatLiveSessionTiming({
        endedAt: '2026-06-01T17:10:00Z',
        insertedAt: '2026-06-01T16:00:00Z',
        startedAt: '2026-06-01T16:04:00Z',
        status: 'ENDED',
      }),
    ).toBe('Ended Jun 1, 2026');
  });

  test('keeps malformed timing explicit', () => {
    expect(
      formatLiveSessionTiming({
        endedAt: null,
        insertedAt: 'not-a-date',
        startedAt: null,
        status: 'STARTING',
      }),
    ).toBe('Time unavailable');
  });

  test('maps mutation errors to viewer-safe copy', () => {
    const unavailable = 'This live session is not available to your account.';
    const fallback =
      'We could not update this live session. Check your connection and try again.';
    const cases: ReadonlyArray<{
      readonly errors: ReadonlyArray<LiveMutationError> | null | undefined;
      readonly expected: string;
    }> = [
      {
        errors: [{ field: null, message: 'rate_limited' }],
        expected: 'Too many live-session attempts. Wait a moment and try again.',
      },
      {
        errors: [{ field: 'liveSessionId', message: 'not_authorized' }],
        expected: unavailable,
      },
      {
        errors: [{ field: 'liveSessionId', message: 'not_found' }],
        expected: unavailable,
      },
      {
        errors: [{ field: 'liveSessionId', message: 'ended' }],
        expected: unavailable,
      },
      {
        errors: [{ field: null, message: 'unauthenticated' }],
        expected: 'Sign in again to keep watching live sessions.',
      },
      {
        errors: [{ field: null, message: 'media_not_ready' }],
        expected:
          'Media negotiation is not ready yet. Prepare media and try again.',
      },
      {
        errors: [
          { field: null, message: 'unexpected_error' },
          { field: null, message: 'unauthenticated' },
        ],
        expected: 'Sign in again to keep watching live sessions.',
      },
      {
        errors: [],
        expected: fallback,
      },
      {
        errors: null,
        expected: fallback,
      },
      {
        errors: undefined,
        expected: fallback,
      },
    ];

    for (const { errors, expected } of cases) {
      expect(formatLiveMutationErrors(errors)).toBe(expected);
    }
  });
});

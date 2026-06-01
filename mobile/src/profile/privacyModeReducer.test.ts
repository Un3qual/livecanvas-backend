import { describe, expect, test } from 'bun:test';

import {
  createPrivacyModeState,
  formatMutationErrors,
  nextPrivacyMode,
  privacyModeReducer,
} from './privacyModeReducer';

describe('privacyModeReducer', () => {
  test('creates idle state for supported modes', () => {
    expect(createPrivacyModeState('PUBLIC')).toEqual({
      currentMode: 'PUBLIC',
      errorMessage: null,
      pendingMode: null,
    });

    expect(createPrivacyModeState('PRIVATE')).toEqual({
      currentMode: 'PRIVATE',
      errorMessage: null,
      pendingMode: null,
    });
  });

  test('keeps unsupported modes non-submittable until Relay refreshes a known mode', () => {
    expect(createPrivacyModeState('%future added value')).toEqual({
      currentMode: null,
      errorMessage: null,
      pendingMode: null,
    });
  });

  test('toggles only between public and private modes', () => {
    expect(nextPrivacyMode('PUBLIC')).toBe('PRIVATE');
    expect(nextPrivacyMode('PRIVATE')).toBe('PUBLIC');
    expect(nextPrivacyMode(null)).toBeNull();
  });

  test('tracks submit and success state', () => {
    const submitting = privacyModeReducer(createPrivacyModeState('PUBLIC'), {
      mode: 'PRIVATE',
      type: 'submit',
    });

    expect(submitting).toEqual({
      currentMode: 'PUBLIC',
      errorMessage: null,
      pendingMode: 'PRIVATE',
    });

    expect(
      privacyModeReducer(submitting, {
        mode: 'PRIVATE',
        type: 'success',
      }),
    ).toEqual({
      currentMode: 'PRIVATE',
      errorMessage: null,
      pendingMode: null,
    });
  });

  test('normalizes future enum values after mutation success', () => {
    expect(
      privacyModeReducer(
        {
          currentMode: 'PUBLIC',
          errorMessage: 'previous error',
          pendingMode: 'PRIVATE',
        },
        {
          mode: '%future added value',
          type: 'success',
        },
      ),
    ).toEqual({
      currentMode: null,
      errorMessage: null,
      pendingMode: null,
    });
  });

  test('keeps the confirmed mode when a mutation fails', () => {
    expect(
      privacyModeReducer(
        {
          currentMode: 'PUBLIC',
          errorMessage: null,
          pendingMode: 'PRIVATE',
        },
        {
          message: 'privacyMode: invalid',
          type: 'error',
        },
      ),
    ).toEqual({
      currentMode: 'PUBLIC',
      errorMessage: 'privacyMode: invalid',
      pendingMode: null,
    });
  });

  test('resets to known modes and keeps future enum values non-submittable', () => {
    expect(
      privacyModeReducer(
        {
          currentMode: 'PUBLIC',
          errorMessage: 'previous error',
          pendingMode: 'PRIVATE',
        },
        {
          mode: 'PRIVATE',
          type: 'reset',
        },
      ),
    ).toEqual({
      currentMode: 'PRIVATE',
      errorMessage: null,
      pendingMode: null,
    });

    expect(
      privacyModeReducer(
        {
          currentMode: 'PRIVATE',
          errorMessage: 'previous error',
          pendingMode: 'PUBLIC',
        },
        {
          mode: '%future added value',
          type: 'reset',
        },
      ),
    ).toEqual({
      currentMode: null,
      errorMessage: null,
      pendingMode: null,
    });
  });

  test('formats payload errors without exposing sensitive values', () => {
    expect(
      formatMutationErrors([
        { field: 'privacyMode', message: 'invalid' },
        { field: null, message: 'unauthenticated' },
      ]),
    ).toBe('privacyMode: invalid; unauthenticated');

    expect(formatMutationErrors([])).toBe('We could not update privacy mode.');
  });
});

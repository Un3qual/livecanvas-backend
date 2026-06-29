import { describe, expect, test } from 'bun:test';

import {
  authEntryControllerReducer,
  initialAuthEntryControllerState,
  isAuthProviderSubmitting,
} from '../../src/auth/authEntryControllerReducer';

describe('authEntryControllerReducer', () => {
  test('tracks the active auth provider until the attempt finishes', () => {
    const busyState = authEntryControllerReducer(
      initialAuthEntryControllerState,
      {
        type: 'attemptStarted',
        attempt: { mode: 'signIn', provider: 'google' },
      },
    );

    expect(busyState.activeAttempt).toEqual({
      mode: 'signIn',
      provider: 'google',
    });
    expect(isAuthProviderSubmitting(busyState, 'google')).toBe(true);
    expect(isAuthProviderSubmitting(busyState, 'password')).toBe(false);
    expect(
      authEntryControllerReducer(busyState, { type: 'attemptFinished' }),
    ).toEqual(initialAuthEntryControllerState);
  });
});

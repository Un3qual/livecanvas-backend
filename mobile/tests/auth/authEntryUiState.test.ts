import { describe, expect, test } from 'bun:test';

import { resolveAuthEntryUiState } from '../../src/auth/authEntryUiState';

describe('resolveAuthEntryUiState', () => {
  test('shows the oauth divider only when at least one provider is available', () => {
    expect(
      resolveAuthEntryUiState({
        hasAppleAuthOption: false,
        hasGoogleAuthOption: false,
        isBusy: false,
      }),
    ).toEqual({
      canSwitchScreens: true,
      showOauthDivider: false,
    });

    expect(
      resolveAuthEntryUiState({
        hasAppleAuthOption: true,
        hasGoogleAuthOption: false,
        isBusy: false,
      }),
    ).toEqual({
      canSwitchScreens: true,
      showOauthDivider: true,
    });
  });

  test('disables auth-screen route switching while a request is in flight', () => {
    expect(
      resolveAuthEntryUiState({
        hasAppleAuthOption: true,
        hasGoogleAuthOption: true,
        isBusy: true,
      }),
    ).toEqual({
      canSwitchScreens: false,
      showOauthDivider: true,
    });
  });
});

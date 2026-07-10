import { describe, expect, test } from 'bun:test';

import {
  otherUserProfileScreenResetKey,
  selectActiveRelationshipViewOverride,
} from '../../src/profile/other/otherUserProfileRouteState';

describe('OtherUserProfileScreen route state helpers', () => {
  test('keys route reset state by profile id and retry attempt', () => {
    expect(otherUserProfileScreenResetKey('profile-1', 0)).toBe('profile-1:0');
    expect(otherUserProfileScreenResetKey('profile-2', 0)).toBe('profile-2:0');
    expect(otherUserProfileScreenResetKey('profile-1', 1)).toBe('profile-1:1');
  });

  test('uses partial relationship overrides only for the active profile id', () => {
    const override = {
      isBlockedByViewer: false,
      profileId: 'profile-1',
      state: null,
    } as const;

    expect(selectActiveRelationshipViewOverride(override, 'profile-1')).toEqual(
      override,
    );
    expect(
      selectActiveRelationshipViewOverride(override, 'profile-2'),
    ).toBeNull();
  });
});

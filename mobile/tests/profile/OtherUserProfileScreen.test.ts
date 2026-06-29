import { describe, expect, test } from 'bun:test';

import {
  otherUserProfileScreenResetKey,
  selectActiveRelationshipStateOverride,
} from '../../src/profile/other/otherUserProfileRouteState';

describe('OtherUserProfileScreen route state helpers', () => {
  test('keys route reset state by profile id and retry attempt', () => {
    expect(otherUserProfileScreenResetKey('profile-1', 0)).toBe('profile-1:0');
    expect(otherUserProfileScreenResetKey('profile-2', 0)).toBe('profile-2:0');
    expect(otherUserProfileScreenResetKey('profile-1', 1)).toBe('profile-1:1');
  });

  test('uses relationship overrides only for the active profile id', () => {
    expect(
      selectActiveRelationshipStateOverride(
        { profileId: 'profile-1', state: 'REQUESTED' },
        'profile-1',
      ),
    ).toBe('REQUESTED');
    expect(
      selectActiveRelationshipStateOverride(
        { profileId: 'profile-1', state: 'REQUESTED' },
        'profile-2',
      ),
    ).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';

import { otherUserProfileScreenResetKey } from '../../src/profile/other/otherUserProfileRouteState';

describe('OtherUserProfileScreen route state helpers', () => {
  test('keys route reset state by profile id and retry attempt', () => {
    expect(otherUserProfileScreenResetKey('profile-1', 0)).toBe('profile-1:0');
    expect(otherUserProfileScreenResetKey('profile-2', 0)).toBe('profile-2:0');
    expect(otherUserProfileScreenResetKey('profile-1', 1)).toBe('profile-1:1');
  });
});

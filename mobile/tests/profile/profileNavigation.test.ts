import { describe, expect, test } from 'vitest';

import { profileHref } from '../../src/profile/profileNavigation';

describe('profileNavigation', () => {
  test('routes the current viewer to the viewer profile', () => {
    expect(profileHref('opaque-viewer-id', 'opaque-viewer-id')).toEqual({
      pathname: '/profile',
    });
  });

  test('preserves another author Relay ID in the other-profile route', () => {
    expect(profileHref('opaque-author-id', 'opaque-viewer-id')).toEqual({
      params: { id: 'opaque-author-id' },
      pathname: '/profiles/[id]',
    });
  });

  test('uses the other-profile route when viewer ownership is unknown', () => {
    expect(profileHref('opaque-author-id', null)).toEqual({
      params: { id: 'opaque-author-id' },
      pathname: '/profiles/[id]',
    });
  });
});

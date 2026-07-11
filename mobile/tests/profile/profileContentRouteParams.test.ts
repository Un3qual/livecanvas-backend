import { describe, expect, test } from 'bun:test';

import {
  profileContentHref,
  readProfileContentKindParam,
} from '../../src/profile/profileContentRouteParams';

describe('profileContentRouteParams', () => {
  test('accepts exactly one supported profile content kind', () => {
    expect(readProfileContentKindParam('posts')).toBe('posts');
    expect(readProfileContentKindParam(['stories'])).toBe('stories');
    expect(readProfileContentKindParam(' replays ')).toBe('replays');
    expect(readProfileContentKindParam(['posts', 'stories'])).toBeNull();
    expect(readProfileContentKindParam('live')).toBeNull();
    expect(readProfileContentKindParam('unknown')).toBeNull();
    expect(readProfileContentKindParam()).toBeNull();
  });

  test('builds viewer and other routes with opaque IDs intact', () => {
    expect(profileContentHref('opaque-profile-id', 'posts', 'viewer')).toEqual({
      params: { id: 'opaque-profile-id', kind: 'posts' },
      pathname: '/profile/content',
    });
    expect(profileContentHref('opaque-profile-id', 'stories', 'other')).toEqual({
      params: { id: 'opaque-profile-id', kind: 'stories' },
      pathname: '/profiles/[id]/content',
    });
  });
});

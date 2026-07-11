import { describe, expect, test } from 'bun:test';

import { applyContentPostChanges } from '../../src/content/contentPostChanges';

describe('applyContentPostChanges', () => {
  test('applies local deletion tombstones without shadowing Relay row objects', () => {
    const first = {
      bodyText: 'First',
      id: 'post-1',
      visibility: 'PUBLIC',
    };
    const second = {
      bodyText: 'Second',
      id: 'post-2',
      visibility: 'PUBLIC',
    };

    const result = applyContentPostChanges([first, second], {
      deletedPostIds: { 'post-1': true },
      updatedPostsById: {},
    });

    expect(result).toEqual([second]);
    expect(result[0]).toBe(second);
  });

  test('applies a saved edit while a retained row still matches its source', () => {
    const retainedPost = {
      bodyText: 'Original body',
      id: 'post-1',
      visibility: 'PUBLIC',
    };

    const result = applyContentPostChanges([retainedPost], {
      deletedPostIds: {},
      updatedPostsById: {
        'post-1': {
          from: { bodyText: 'Original body', visibility: 'PUBLIC' },
          to: { bodyText: 'Updated body', visibility: 'FOLLOWERS' },
        },
      },
    });

    expect(result).toEqual([
      {
        bodyText: 'Updated body',
        id: 'post-1',
        visibility: 'FOLLOWERS',
      },
    ]);
  });

  test('prefers a newer Relay edit over a saved local edit', () => {
    const newerRelayPost = {
      bodyText: 'Server newer body',
      id: 'post-1',
      visibility: 'PUBLIC',
    };

    const result = applyContentPostChanges([newerRelayPost], {
      deletedPostIds: {},
      updatedPostsById: {
        'post-1': {
          from: { bodyText: 'Original body', visibility: 'PUBLIC' },
          to: { bodyText: 'Updated body', visibility: 'FOLLOWERS' },
        },
      },
    });

    expect(result[0]).toBe(newerRelayPost);
  });
});

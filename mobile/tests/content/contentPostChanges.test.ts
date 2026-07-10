import { describe, expect, test } from 'bun:test';

import { applyContentPostChanges } from '../../src/content/contentPostChanges';

describe('applyContentPostChanges', () => {
  test('applies updates and deletions without changing unaffected row objects', () => {
    const first = { bodyText: 'First', id: 'post-1' };
    const second = { bodyText: 'Second', id: 'post-2' };
    const updatedSecond = { bodyText: 'Updated', id: 'post-2' };

    const result = applyContentPostChanges([first, second], {
      deletedPostIds: { 'post-1': true },
      updatedPostsById: { 'post-2': updatedSecond },
    });

    expect(result).toEqual([updatedSecond]);
    expect(result[0]).toBe(updatedSecond);
  });
});

import { describe, expect, test } from 'bun:test';

import { applyContentPostChanges } from '../../src/content/contentPostChanges';

describe('applyContentPostChanges', () => {
  test('applies local deletion tombstones without shadowing Relay row objects', () => {
    const first = { bodyText: 'First', id: 'post-1' };
    const second = { bodyText: 'Second', id: 'post-2' };

    const result = applyContentPostChanges([first, second], {
      deletedPostIds: { 'post-1': true },
    });

    expect(result).toEqual([second]);
    expect(result[0]).toBe(second);
  });
});

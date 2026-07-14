import { describe, expect, test } from 'vitest';

import {
  appendProfileConnectionNodes,
  readProfileConnectionPageInfo,
} from '../../src/profile/profileConnectionPagination';

describe('profileConnectionPagination', () => {
  test('reads pageInfo with stable defaults', () => {
    expect(readProfileConnectionPageInfo(null)).toEqual({
      endCursor: null,
      hasNextPage: false,
    });
    expect(
      readProfileConnectionPageInfo({
        pageInfo: {
          endCursor: 'cursor-1',
          hasNextPage: true,
        },
      }),
    ).toEqual({
      endCursor: 'cursor-1',
      hasNextPage: true,
    });
  });

  test('appends nodes while deduplicating by opaque id', () => {
    const existing = [
      { email: 'first@example.com', id: 'opaque-user-1', privacyMode: 'PUBLIC' },
      { email: 'second@example.com', id: 'opaque-user-2', privacyMode: 'PRIVATE' },
    ];
    const incoming = [
      { email: 'second-new@example.com', id: 'opaque-user-2', privacyMode: 'PUBLIC' },
      { email: 'third@example.com', id: 'opaque-user-3', privacyMode: 'PUBLIC' },
    ];

    expect(appendProfileConnectionNodes(existing, incoming)).toEqual([
      { email: 'first@example.com', id: 'opaque-user-1', privacyMode: 'PUBLIC' },
      { email: 'second@example.com', id: 'opaque-user-2', privacyMode: 'PRIVATE' },
      { email: 'third@example.com', id: 'opaque-user-3', privacyMode: 'PUBLIC' },
    ]);
  });
});

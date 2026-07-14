import { describe, expect, test } from 'vitest';

import { readConnectionNodes } from '../../src/relay/readConnectionNodes';

describe('readConnectionNodes', () => {
  test('returns non-null nodes from nullable Relay connection edges', () => {
    expect(
      readConnectionNodes({
        edges: [
          { node: { id: 'first' } },
          null,
          { node: null },
          { node: { id: 'second' } },
          undefined,
        ],
      }),
    ).toEqual([{ id: 'first' }, { id: 'second' }]);
  });

  test('returns an empty list when the connection is missing', () => {
    expect(readConnectionNodes(null)).toEqual([]);
    expect(readConnectionNodes()).toEqual([]);
  });
});

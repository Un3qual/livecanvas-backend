import { describe, expect, test } from 'bun:test';

import { readOptionalProfileIdParam } from '../../src/profile/profileRouteParams';

describe('profileRouteParams', () => {
  test('reads missing, single, and array opaque profile IDs without decoding', () => {
    expect(readOptionalProfileIdParam(undefined)).toBeNull();
    expect(readOptionalProfileIdParam('  opaque-profile-id  ')).toBe(
      'opaque-profile-id',
    );
    expect(readOptionalProfileIdParam(['opaque-profile-id'])).toBe(
      'opaque-profile-id',
    );
    expect(readOptionalProfileIdParam(['first', 'second'])).toBeNull();
    expect(readOptionalProfileIdParam('   ')).toBeNull();
  });
});

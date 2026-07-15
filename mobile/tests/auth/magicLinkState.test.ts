import { describe, expect, test } from 'vitest';

import {
  isDefinitiveMagicLinkRejection,
  readMagicLinkHandoffParam,
} from '../../src/auth/magicLink/magicLinkState';

describe('readMagicLinkHandoffParam', () => {
  test('accepts one opaque handoff and rejects raw, duplicate, or malformed values', () => {
    expect(readMagicLinkHandoffParam('handoff_one-123')).toBe(
      'handoff_one-123',
    );

    for (const value of [
      undefined,
      '',
      'short',
      'handoff?token=raw-secret',
      ['handoff-one', 'handoff-two'],
    ]) {
      expect(readMagicLinkHandoffParam(value)).toBeNull();
    }
  });
});

describe('isDefinitiveMagicLinkRejection', () => {
  test('distinguishes invalid or expired credentials from retryable failures', () => {
    expect(
      isDefinitiveMagicLinkRejection([
        { code: 'INVALID_CREDENTIALS', message: 'invalid_credentials' },
      ]),
    ).toBe(true);
    expect(
      isDefinitiveMagicLinkRejection([
        { code: 'INVALID_INPUT', message: 'Token is invalid or expired.' },
      ]),
    ).toBe(true);
    expect(
      isDefinitiveMagicLinkRejection([
        { code: 'RATE_LIMITED', message: 'Try again later.' },
      ]),
    ).toBe(false);
  });
});

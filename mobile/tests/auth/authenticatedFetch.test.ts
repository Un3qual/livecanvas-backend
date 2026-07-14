import { describe, expect, test } from 'vitest';

import {
  REFRESH_MUTATION,
  extractRefreshedAuthTokens,
  hasUnauthenticatedError,
} from '../../src/auth/authenticatedFetchHelpers';

describe('authenticated fetch helpers', () => {
  test('refresh mutation selects token subfields', () => {
    expect(REFRESH_MUTATION).toContain('accessToken {');
    expect(REFRESH_MUTATION).toContain('serializedValue');
    expect(REFRESH_MUTATION).toContain('expiresAt');
    expect(REFRESH_MUTATION).toContain('refreshToken {');
    expect(REFRESH_MUTATION).not.toMatch(/errors\s*\{[^}]*\bcode\b[^}]*\}/);
    expect(REFRESH_MUTATION).not.toContain('accessToken\n      refreshToken');
  });

  test('extracts nested token values from the refresh payload', () => {
    expect(
      extractRefreshedAuthTokens({
        data: {
          refreshAuthTokens: {
            accessToken: {
              serializedValue: 'access-token',
              tokenVersion: 3,
              expiresAt: '2026-04-15T00:00:00.000Z',
            },
            refreshToken: {
              serializedValue: 'refresh-token',
              tokenVersion: 4,
            },
            errors: [],
          },
        },
      }),
    ).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-04-15T00:00:00.000Z',
    });
  });

  test('detects unauthenticated top-level GraphQL errors', () => {
    expect(
      hasUnauthenticatedError({
        errors: [
          {
            message: 'unauthenticated',
          },
        ],
      }),
    ).toBe(true);
  });

  test('detects unauthenticated payload errors in response data', () => {
    expect(
      hasUnauthenticatedError({
        data: {
          refreshAuthTokens: {
            accessToken: null,
            refreshToken: null,
            errors: [
              {
                field: 'refreshToken',
                message: 'unauthenticated',
              },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  test('detects unauthenticated payload errors with a direct code field', () => {
    expect(
      hasUnauthenticatedError({
        data: {
          refreshAuthTokens: {
            accessToken: null,
            refreshToken: null,
            errors: [
              {
                field: 'refreshToken',
                code: 'UNAUTHENTICATED',
              },
            ],
          },
        },
      }),
    ).toBe(true);
  });

  test('ignores deeply nested data errors that are outside the mutation payload layer', () => {
    expect(
      hasUnauthenticatedError({
        data: {
          viewer: {
            profile: {
              auditTrail: {
                errors: [
                  {
                    message: 'unauthenticated',
                  },
                ],
              },
            },
          },
        },
      }),
    ).toBe(false);
  });
});

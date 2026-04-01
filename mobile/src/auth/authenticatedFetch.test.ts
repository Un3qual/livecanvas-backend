import { describe, expect, test } from 'bun:test';

import {
  REFRESH_MUTATION,
  extractRefreshedAuthTokens,
  hasUnauthenticatedError,
} from './authenticatedFetchHelpers';

describe('authenticated fetch helpers', () => {
  test('refresh mutation selects token subfields', () => {
    expect(REFRESH_MUTATION).toContain('accessToken {');
    expect(REFRESH_MUTATION).toContain('serializedValue');
    expect(REFRESH_MUTATION).toContain('refreshToken {');
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
});

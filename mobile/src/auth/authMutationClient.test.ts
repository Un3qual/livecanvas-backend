import { describe, expect, mock, test } from 'bun:test';

import {
  normalizeAuthErrors,
  submitOauthAuthMutation,
  submitPasswordAuthMutation,
} from './authMutationClient';

describe('authMutationClient', () => {
  test('returns a validation error before calling sign-up when passwords do not match', async () => {
    const fetchImpl = mock(async () => {
      throw new Error('network should not run');
    });

    const result = await submitPasswordAuthMutation({
      apiBaseUrl: 'http://localhost:4000',
      mode: 'signUp',
      email: 'user@example.com',
      password: 'hunter2',
      passwordConfirmation: 'different-password',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: 'passwordConfirmation',
          message: 'Passwords must match.',
        },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  test('preserves matching password confirmation spacing during sign-up', async () => {
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          data: {
            signUp: {
              accessToken: {
                serializedValue: 'access-token',
                expiresAt: '2026-05-01T00:00:00.000Z',
              },
              refreshToken: {
                serializedValue: 'refresh-token',
              },
              errors: [],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await submitPasswordAuthMutation({
      apiBaseUrl: 'http://localhost:4000',
      mode: 'signUp',
      email: 'user@example.com',
      password: 'hunter2 ',
      passwordConfirmation: 'hunter2 ',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const request = JSON.parse((init as RequestInit).body as string);

    expect(request.variables).toEqual({
      input: {
        provider: 'PASSWORD',
        password: {
          email: 'user@example.com',
          password: 'hunter2 ',
          passwordConfirmation: 'hunter2 ',
        },
      },
    });
  });

  test('posts password sign-in variables and returns the issued tokens', async () => {
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          data: {
            logIn: {
              accessToken: {
                serializedValue: 'access-token',
                expiresAt: '2026-05-01T00:00:00.000Z',
              },
              refreshToken: {
                serializedValue: 'refresh-token',
              },
              errors: [],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await submitPasswordAuthMutation({
      apiBaseUrl: 'http://localhost:4000',
      mode: 'signIn',
      email: '  user@example.com  ',
      password: 'hunter2',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: true,
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: '2026-05-01T00:00:00.000Z',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const request = JSON.parse((init as RequestInit).body as string);

    expect(request.variables).toEqual({
      input: {
        provider: 'PASSWORD',
        password: {
          email: 'user@example.com',
          password: 'hunter2',
        },
      },
    });
  });

  test('returns backend payload errors for oauth sign-in attempts', async () => {
    const fetchImpl = mock(async () =>
      new Response(
        JSON.stringify({
          data: {
            logIn: {
              accessToken: null,
              refreshToken: null,
              errors: [
                {
                  field: 'oauth',
                  code: 'PROVIDER_VERIFICATION_FAILED',
                  message: 'Google could not verify this credential.',
                },
              ],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await submitOauthAuthMutation({
      apiBaseUrl: 'http://localhost:4000',
      mode: 'signIn',
      provider: 'GOOGLE',
      idToken: 'google-id-token',
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          field: 'oauth',
          code: 'PROVIDER_VERIFICATION_FAILED',
          message: 'Google could not verify this credential.',
        },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('splits field and form errors for screen rendering', () => {
    expect(
      normalizeAuthErrors([
        {
          field: 'email',
          message: 'Email is required.',
        },
        {
          code: 'INVALID_CREDENTIALS',
          message: 'The email or password was incorrect.',
        },
      ]),
    ).toEqual({
      fieldErrors: {
        email: 'Email is required.',
      },
      formError: 'The email or password was incorrect.',
    });
  });
});

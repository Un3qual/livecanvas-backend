import { describe, expect, vi, test } from 'vitest';

import {
  requestMagicLinkAuthChallenge,
  redeemMagicLinkAuthMutation,
  normalizeAuthErrors,
  submitOauthAuthMutation,
  submitPasswordAuthMutation,
} from '../../src/auth/authMutationClient';

type TestFetch = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Response | Promise<Response>;

describe('authMutationClient', () => {
  test('requests an enumeration-safe magic-link login challenge', async () => {
    const fetchImpl = vi.fn<TestFetch>((_url, _init) =>
      new Response(
        JSON.stringify({
          data: {
            beginAuthChallenge: {
              challenge: {
                provider: 'MAGIC_LINK',
                purpose: 'LOG_IN',
                dispatched: false,
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

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        email: '  user@example.com  ',
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: true });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const request = JSON.parse((init as RequestInit).body as string);

    expect(request.variables).toEqual({
      input: {
        provider: 'MAGIC_LINK',
        purpose: 'LOG_IN',
        magicLink: { email: 'user@example.com' },
      },
    });
  });

  test('requests a magic-link signup challenge with the signup purpose', async () => {
    const fetchImpl = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({
          data: {
            beginAuthChallenge: {
              challenge: {
                provider: 'MAGIC_LINK',
                purpose: 'SIGN_UP',
                dispatched: true,
              },
              errors: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signUp',
        email: 'new@example.com',
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: true });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const request = JSON.parse((init as RequestInit).body as string);
    expect(request.variables.input.purpose).toBe('SIGN_UP');
  });

  test('validates a magic-link email before network access', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('network should not run');
    });

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        email: '   ',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [{ field: 'email', message: 'Email is required.' }],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('returns magic-link challenge payload errors and rejects malformed success', async () => {
    const payloadErrorFetch = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({
          data: {
            beginAuthChallenge: {
              challenge: null,
              errors: [
                {
                  field: 'magicLink.email',
                  code: 'EMAIL_TAKEN',
                  message: 'has already been taken',
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signUp',
        email: 'used@example.com',
        fetchImpl: payloadErrorFetch,
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [
        {
          field: 'magicLink.email',
          code: 'EMAIL_TAKEN',
          message: 'has already been taken',
        },
      ],
    });

    const malformedFetch = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({
          data: {
            beginAuthChallenge: { challenge: null, errors: [] },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        email: 'user@example.com',
        fetchImpl: malformedFetch,
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [{ message: 'The server did not confirm the email link request.' }],
    });
  });

  test('returns top-level challenge errors and rejects HTTP failures', async () => {
    const topLevelErrorFetch = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({ errors: [{ message: 'Rate limit exceeded.' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        email: 'user@example.com',
        fetchImpl: topLevelErrorFetch,
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [{ message: 'Rate limit exceeded.' }],
    });

    await expect(
      requestMagicLinkAuthChallenge({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        email: 'user@example.com',
        fetchImpl: () =>
          Promise.resolve(
            new Response(null, { status: 503, statusText: 'Unavailable' }),
          ),
      }),
    ).rejects.toThrow('Auth request failed with 503 Unavailable');
  });

  test.each([
    ['signIn', 'logIn'],
    ['signUp', 'signUp'],
  ] as const)('redeems a %s magic link through the matching mutation', async (mode, field) => {
    const fetchImpl = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({
          data: {
            [field]: {
              accessToken: {
                serializedValue: 'magic-access-token',
                expiresAt: '2026-08-01T00:00:00.000Z',
              },
              refreshToken: { serializedValue: 'magic-refresh-token' },
              errors: [],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      redeemMagicLinkAuthMutation({
        apiBaseUrl: 'http://localhost:4000',
        mode,
        token: 'serialized-magic-token',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: true,
      tokens: {
        accessToken: 'magic-access-token',
        refreshToken: 'magic-refresh-token',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
    });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    const request = JSON.parse((init as RequestInit).body as string);
    expect(request.variables).toEqual({
      input: {
        provider: 'MAGIC_LINK',
        magicLink: { token: 'serialized-magic-token' },
      },
    });
  });

  test('returns invalid magic-link credentials without fabricating tokens', async () => {
    const fetchImpl = vi.fn<TestFetch>(() =>
      new Response(
        JSON.stringify({
          data: {
            logIn: {
              accessToken: null,
              refreshToken: null,
              errors: [
                {
                  field: 'magicLink.token',
                  code: 'INVALID_CREDENTIALS',
                  message: 'invalid_credentials',
                },
              ],
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      redeemMagicLinkAuthMutation({
        apiBaseUrl: 'http://localhost:4000',
        mode: 'signIn',
        token: 'expired-token',
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      errors: [
        {
          field: 'magicLink.token',
          code: 'INVALID_CREDENTIALS',
          message: 'invalid_credentials',
        },
      ],
    });
  });

  test('returns a validation error before calling sign-up when passwords do not match', async () => {
    const fetchImpl = vi.fn(() => {
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
    const fetchImpl = vi.fn<TestFetch>((_url, _init) =>
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
    const fetchImpl = vi.fn<TestFetch>((_url, _init) =>
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
    const fetchImpl = vi.fn(() =>
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

  test('normalizes prefixed password field paths into field errors', () => {
    expect(
      normalizeAuthErrors([
        {
          field: 'password.email',
          message: 'Email has already been taken.',
        },
        {
          field: 'password.passwordConfirmation',
          message: 'Passwords must match.',
        },
        {
          code: 'INVALID_CREDENTIALS',
          message: 'The email or password was incorrect.',
        },
      ]),
    ).toEqual({
      fieldErrors: {
        email: 'Email has already been taken.',
        passwordConfirmation: 'Passwords must match.',
      },
      formError: 'The email or password was incorrect.',
    });
  });

  test('normalizes a magic-link email path into the shared email field', () => {
    expect(
      normalizeAuthErrors([
        {
          field: 'magicLink.email',
          message: 'has already been taken',
        },
      ]),
    ).toEqual({
      fieldErrors: { email: 'has already been taken' },
      formError: null,
    });
  });
});

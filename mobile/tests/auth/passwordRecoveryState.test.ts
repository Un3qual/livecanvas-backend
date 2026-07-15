import { describe, expect, test } from 'vitest';

import {
  PASSWORD_RECOVERY_SUCCESS_COPY,
  PASSWORD_RESET_SUCCESS_COPY,
  buildPasswordRecoveryInput,
  buildResetPasswordInput,
  formatRecoveryMutationErrors,
  normalizeRecoveryEmail,
  readResetPasswordTokenParam,
} from '../../src/auth/recovery/passwordRecoveryState';

describe('passwordRecoveryState', () => {
  test('normalizes email and builds recovery input only for email-like values', () => {
    expect(normalizeRecoveryEmail(' Viewer@Example.COM ')).toBe(
      'viewer@example.com',
    );
    expect(buildPasswordRecoveryInput({ email: ' Viewer@Example.COM ' })).toEqual({
      email: 'viewer@example.com',
    });
    expect(buildPasswordRecoveryInput({ email: 'not-an-email' })).toBeNull();
  });

  test('reads reset token query params without decoding opaque token data', () => {
    expect(readResetPasswordTokenParam(undefined)).toBe('');
    expect(readResetPasswordTokenParam(' reset-token ')).toBe('reset-token');
    expect(readResetPasswordTokenParam(['first-token', 'second-token'])).toBe(
      'first-token',
    );
  });

  test('builds reset input only when token and passwords are present', () => {
    expect(
      buildResetPasswordInput({
        password: 'new-password-123',
        passwordConfirmation: 'new-password-123',
        token: ' reset-token ',
      }),
    ).toEqual({
      password: 'new-password-123',
      passwordConfirmation: 'new-password-123',
      token: 'reset-token',
    });

    expect(
      buildResetPasswordInput({
        password: 'new-password-123',
        passwordConfirmation: '',
        token: 'reset-token',
      }),
    ).toBeNull();
  });

  test('keeps success and error copy viewer-safe', () => {
    expect(PASSWORD_RECOVERY_SUCCESS_COPY).toContain('If an account exists');
    expect(PASSWORD_RESET_SUCCESS_COPY).toBe(
      'Password reset. Sign in with your new password.',
    );
    expect(
      formatRecoveryMutationErrors([{ field: 'password', message: 'too_short' }]),
    ).toBe('password: too_short');
    expect(formatRecoveryMutationErrors(null)).toBe(
      'We could not update account recovery.',
    );
  });
});

import { formatMutationErrors, type MutationError } from '../../profile/mutationErrors';

export const PASSWORD_RECOVERY_SUCCESS_COPY =
  'If an account exists for that email, reset instructions will be sent.';
export const PASSWORD_RESET_SUCCESS_COPY =
  'Password reset. Sign in with your new password.';

export type PasswordRecoveryFormState = {
  email: string;
};

export type ResetPasswordFormState = {
  password: string;
  passwordConfirmation: string;
  token: string;
};

export function normalizeRecoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildPasswordRecoveryInput(state: PasswordRecoveryFormState):
  | { email: string }
  | null {
  const email = normalizeRecoveryEmail(state.email);

  return email.includes('@') ? { email } : null;
}

export function readResetPasswordTokenParam(
  token: string | string[] | undefined,
): string {
  const value = Array.isArray(token) ? token[0] : token;

  return value?.trim() ?? '';
}

export function buildResetPasswordInput(state: ResetPasswordFormState):
  | {
      password: string;
      passwordConfirmation: string;
      token: string;
    }
  | null {
  const token = state.token.trim();
  const password = state.password;
  const passwordConfirmation = state.passwordConfirmation;

  if (!token || !password || !passwordConfirmation) {
    return null;
  }

  return { password, passwordConfirmation, token };
}

export function formatRecoveryMutationErrors(
  errors: ReadonlyArray<MutationError> | null | undefined,
): string {
  return formatMutationErrors(errors, 'We could not update account recovery.');
}

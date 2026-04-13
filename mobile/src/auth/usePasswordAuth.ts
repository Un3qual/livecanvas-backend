import { useCallback, useState } from 'react';

import { useStartupState } from '../providers/StartupGate';
import { useAuth } from './AuthProvider';
import {
  normalizeAuthErrors,
  submitPasswordAuthMutation,
  type AuthFieldName,
} from './authMutationClient';

type AuthMode = 'signIn' | 'signUp';

export type PasswordAuthFields = {
  email: string;
  password: string;
  passwordConfirmation?: string;
};

function fallbackErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'LiveCanvas could not reach the auth service. Please try again.';
}

export function usePasswordAuth() {
  const auth = useAuth();
  const { environment } = useStartupState();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AuthFieldName, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<AuthMode | null>(null);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
  }, []);

  const submit = useCallback(
    async (mode: AuthMode, fields: PasswordAuthFields) => {
      if (!auth.beginAuthSubmission()) {
        return false;
      }

      clearErrors();
      setPendingMode(mode);

      try {
        const result = await submitPasswordAuthMutation({
          apiBaseUrl: environment.apiBaseUrl,
          mode,
          email: fields.email,
          password: fields.password,
          passwordConfirmation: fields.passwordConfirmation,
        });

        if (!result.ok) {
          const normalized = normalizeAuthErrors(result.errors);
          setFieldErrors(normalized.fieldErrors);
          setFormError(normalized.formError);
          return false;
        }

        await auth.signIn(result.tokens);
        return true;
      } catch (error) {
        setFormError(fallbackErrorMessage(error));
        return false;
      } finally {
        auth.endAuthSubmission();
        setPendingMode(null);
      }
    },
    [auth, clearErrors, environment.apiBaseUrl],
  );

  return {
    clearErrors,
    fieldErrors,
    formError,
    isSubmitting: pendingMode !== null,
    signInWithPassword: (fields: PasswordAuthFields) => submit('signIn', fields),
    signUpWithPassword: (fields: PasswordAuthFields) => submit('signUp', fields),
  };
}

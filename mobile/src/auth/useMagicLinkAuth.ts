import { useCallback, useState } from 'react';

import { useStartupState } from '../providers/StartupGate';
import {
  normalizeAuthErrors,
  requestMagicLinkAuthChallenge,
  type AuthFieldName,
} from './authMutationClient';
import { storePendingMagicLinkReturnTo } from './magicLink/magicLinkHandoff';

type AuthMode = 'signIn' | 'signUp';

export const MAGIC_LINK_REQUEST_SUCCESS_COPY =
  'Check your inbox. If this email can use a LiveCanvas link, it will arrive shortly.';

function fallbackErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'LiveCanvas could not request an email link. Please try again.';
}

export function useMagicLinkAuth() {
  const { environment } = useStartupState();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<AuthFieldName, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    setMessage(null);
  }, []);

  const request = useCallback(
    async (mode: AuthMode, email: string, returnTo: string) => {
      clearErrors();

      try {
        const result = await requestMagicLinkAuthChallenge({
          apiBaseUrl: environment.apiBaseUrl,
          mode,
          email,
        });

        if (!result.ok) {
          const normalized = normalizeAuthErrors(result.errors);
          setFieldErrors(normalized.fieldErrors);
          setFormError(normalized.formError);
          return false;
        }

        // This is local routing intent, not an email-link credential. Attach it
        // to the next same-purpose handoff on this device when the link opens.
        await storePendingMagicLinkReturnTo(mode, returnTo).catch(
          () => undefined,
        );
        setMessage(MAGIC_LINK_REQUEST_SUCCESS_COPY);
        return true;
      } catch (error) {
        setFormError(fallbackErrorMessage(error));
        return false;
      }
    },
    [clearErrors, environment.apiBaseUrl],
  );

  return {
    clearErrors,
    fieldErrors,
    formError,
    message,
    requestSignInLink: (email: string, returnTo: string) =>
      request('signIn', email, returnTo),
    requestSignUpLink: (email: string, returnTo: string) =>
      request('signUp', email, returnTo),
  };
}

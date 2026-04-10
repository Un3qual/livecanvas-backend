import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';

import { useStartupState } from '../providers/StartupGate';
import { useAuth } from './AuthProvider';
import { submitOauthAuthMutation } from './authMutationClient';

type AuthMode = 'signIn' | 'signUp';

function isCanceledError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ERR_REQUEST_CANCELED'
  );
}

function fallbackErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Apple sign-in did not complete.';
}

export function useAppleAuth() {
  const auth = useAuth();
  const { environment } = useStartupState();
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    void AppleAuthentication.isAvailableAsync()
      .then((nextValue) => {
        if (active) {
          setIsAvailable(nextValue);
        }
      })
      .catch(() => {
        if (active) {
          setIsAvailable(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const authenticate = useCallback(
    async (mode: AuthMode) => {
      if (isSubmitting) {
        return false;
      }

      clearError();

      if (!isAvailable) {
        setError('Apple sign-in is only available on supported iOS devices.');
        return false;
      }

      setIsSubmitting(true);

      try {
        const credential = await AppleAuthentication.signInAsync({
          nonce: Crypto.randomUUID(),
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          ],
          state: `${mode}-${Crypto.randomUUID()}`,
        });

        const result = await submitOauthAuthMutation({
          apiBaseUrl: environment.apiBaseUrl,
          idToken: credential.identityToken ?? '',
          mode,
          provider: 'APPLE',
        });

        if (!result.ok) {
          setError(result.errors[0]?.message ?? 'Apple sign-in failed.');
          return false;
        }

        await auth.signIn(result.tokens);
        return true;
      } catch (nextError) {
        if (isCanceledError(nextError)) {
          return false;
        }

        setError(fallbackErrorMessage(nextError));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, clearError, environment.apiBaseUrl, isAvailable, isSubmitting],
  );

  return {
    clearError,
    error,
    isAvailable,
    isSubmitting,
    signInWithApple: () => authenticate('signIn'),
    signUpWithApple: () => authenticate('signUp'),
  };
}

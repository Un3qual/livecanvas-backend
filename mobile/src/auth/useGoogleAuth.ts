import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';

import { useStartupState } from '../providers/StartupGate';
import { useAuth } from './AuthProvider';
import { submitOauthAuthMutation } from './authMutationClient';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'signIn' | 'signUp';

type GoogleClientConfig = {
  clientId?: string;
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
};

function readProcessEnvironment(): Record<string, string | undefined> {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };

  return maybeProcess.process?.env ?? {};
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveGoogleClientConfig(): GoogleClientConfig {
  const env = readProcessEnvironment();

  return {
    clientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_CLIENT_ID),
    iosClientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    androidClientId: normalizeOptionalValue(
      env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ),
    webClientId: normalizeOptionalValue(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  };
}

function hasGoogleClientConfig(config: GoogleClientConfig): boolean {
  return Boolean(
    config.clientId ||
      config.iosClientId ||
      config.androidClientId ||
      config.webClientId,
  );
}

function fallbackErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Google sign-in did not complete.';
}

export function useGoogleAuth() {
  const auth = useAuth();
  const { environment } = useStartupState();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const config = useMemo(resolveGoogleClientConfig, []);
  const isConfigured = hasGoogleClientConfig(config);
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: config.clientId ?? 'missing-google-client-id',
      iosClientId: config.iosClientId,
      androidClientId: config.androidClientId,
      webClientId: config.webClientId,
      scopes: ['openid', 'profile', 'email'],
      selectAccount: true,
    },
    {
      path: 'oauthredirect',
      scheme: 'livecanvas-mobile',
    },
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const authenticate = useCallback(
    async (mode: AuthMode) => {
      if (isSubmitting) {
        return false;
      }

      clearError();

      if (!isConfigured) {
        setError(
          'Google sign-in is not configured. Set the EXPO_PUBLIC_GOOGLE_CLIENT_ID or platform-specific Google client IDs.',
        );
        return false;
      }

      if (!request) {
        setError('Google sign-in is still preparing. Please try again.');
        return false;
      }

      setIsSubmitting(true);

      try {
        const response = await promptAsync();

        if (response.type === 'error') {
          setError(fallbackErrorMessage(response.error));
          return false;
        }

        if (response.type !== 'success') {
          return false;
        }

        const result = await submitOauthAuthMutation({
          apiBaseUrl: environment.apiBaseUrl,
          idToken: response.params.id_token ?? '',
          mode,
          provider: 'GOOGLE',
        });

        if (!result.ok) {
          setError(result.errors[0]?.message ?? 'Google sign-in failed.');
          return false;
        }

        await auth.signIn(result.tokens);
        return true;
      } catch (nextError) {
        setError(fallbackErrorMessage(nextError));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, clearError, environment.apiBaseUrl, isConfigured, isSubmitting, promptAsync, request],
  );

  return {
    clearError,
    error,
    isSubmitting,
    isSupported: true,
    signInWithGoogle: () => authenticate('signIn'),
    signUpWithGoogle: () => authenticate('signUp'),
  };
}

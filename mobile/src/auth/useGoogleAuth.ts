import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useStartupState } from '../providers/StartupGate';
import { useAuth } from './AuthProvider';
import { submitOauthAuthMutation } from './authMutationClient';
import { hasGoogleClientConfig, resolveGoogleClientConfig } from './googleClientConfig';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'signIn' | 'signUp';

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
  // This hook can still be reused outside the auth-entry controller, so keep a
  // local re-entry guard around the provider-specific OAuth flow.
  const isSubmittingRef = useRef(false);
  const config = useMemo(resolveGoogleClientConfig, []);
  const isConfigured = hasGoogleClientConfig(config, Platform.OS);
  // The Expo hook must run on every render, so keep it mounted with a sentinel
  // client ID and block the user action before promptAsync when config is absent.
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
      if (isSubmittingRef.current) {
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

      isSubmittingRef.current = true;

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
        isSubmittingRef.current = false;
      }
    },
    [auth, clearError, environment.apiBaseUrl, isConfigured, promptAsync, request],
  );

  return {
    clearError,
    error,
    isConfigured,
    isSupported: isConfigured,
    signInWithGoogle: () => authenticate('signIn'),
    signUpWithGoogle: () => authenticate('signUp'),
  };
}

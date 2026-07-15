import { useCallback, useReducer, useRef } from 'react';

import {
  authEntryControllerReducer,
  initialAuthEntryControllerState,
  isAuthProviderSubmitting,
  type AuthEntryAttempt,
  type AuthEntryMode,
} from './authEntryControllerReducer';
import { useAppleAuth } from './useAppleAuth';
import { useGoogleAuth } from './useGoogleAuth';
import { useMagicLinkAuth } from './useMagicLinkAuth';
import {
  usePasswordAuth,
  type PasswordAuthFields,
} from './usePasswordAuth';

type AlternateScreenAction = () => void;

export function useAuthEntryController(mode: AuthEntryMode) {
  const passwordAuth = usePasswordAuth();
  const googleAuth = useGoogleAuth();
  const appleAuth = useAppleAuth();
  const magicLinkAuth = useMagicLinkAuth();
  const [state, dispatch] = useReducer(
    authEntryControllerReducer,
    initialAuthEntryControllerState,
  );
  // React only applies reducer state after the current event, so keep a private
  // admission flag to close the same-tick gap before the busy UI rerenders.
  const activeAttemptRef = useRef<AuthEntryAttempt | null>(null);

  const formError =
    passwordAuth.formError ??
    magicLinkAuth.formError ??
    googleAuth.error ??
    appleAuth.error;
  const fieldErrors = {
    ...passwordAuth.fieldErrors,
    ...magicLinkAuth.fieldErrors,
  };
  const isBusy = state.activeAttempt !== null;
  const canSwitchScreens = !isBusy;

  const clearTransientErrors = useCallback(() => {
    passwordAuth.clearErrors();
    magicLinkAuth.clearErrors();
    googleAuth.clearError();
    appleAuth.clearError();
  }, [appleAuth, googleAuth, magicLinkAuth, passwordAuth]);

  const runAttempt = useCallback(
    async (attempt: AuthEntryAttempt, task: () => Promise<boolean>) => {
      if (activeAttemptRef.current) {
        return false;
      }

      activeAttemptRef.current = attempt;
      dispatch({ type: 'attemptStarted', attempt });

      try {
        clearTransientErrors();
        return await task();
      } finally {
        activeAttemptRef.current = null;
        dispatch({ type: 'attemptFinished' });
      }
    },
    [clearTransientErrors],
  );

  const submitPassword = useCallback(
    (fields: PasswordAuthFields) => {
      return runAttempt({ mode, provider: 'password' }, () =>
        mode === 'signIn'
          ? passwordAuth.signInWithPassword(fields)
          : passwordAuth.signUpWithPassword(fields),
      );
    },
    [mode, passwordAuth, runAttempt],
  );

  const submitGoogle = useCallback(() => {
    return runAttempt({ mode, provider: 'google' }, () =>
      mode === 'signIn'
        ? googleAuth.signInWithGoogle()
        : googleAuth.signUpWithGoogle(),
    );
  }, [googleAuth, mode, runAttempt]);

  const submitMagicLink = useCallback(
    (email: string) => {
      return runAttempt({ mode, provider: 'magicLink' }, () =>
        mode === 'signIn'
          ? magicLinkAuth.requestSignInLink(email)
          : magicLinkAuth.requestSignUpLink(email),
      );
    },
    [magicLinkAuth, mode, runAttempt],
  );

  const submitApple = useCallback(() => {
    return runAttempt({ mode, provider: 'apple' }, () =>
      mode === 'signIn'
        ? appleAuth.signInWithApple()
        : appleAuth.signUpWithApple(),
    );
  }, [appleAuth, mode, runAttempt]);

  const handleAlternateScreenPress = useCallback(
    (action: AlternateScreenAction) => {
      if (activeAttemptRef.current || !canSwitchScreens) {
        return;
      }

      action();
    },
    [canSwitchScreens],
  );

  return {
    clearTransientErrors,
    fieldErrors,
    formError,
    handleAlternateScreenPress,
    hasAppleAuthOption: appleAuth.isAvailable,
    hasGoogleAuthOption: googleAuth.isSupported,
    isAppleSubmitting: isAuthProviderSubmitting(state, 'apple'),
    isBusy,
    isGoogleSubmitting: isAuthProviderSubmitting(state, 'google'),
    isMagicLinkSubmitting: isAuthProviderSubmitting(state, 'magicLink'),
    isPasswordSubmitting: isAuthProviderSubmitting(state, 'password'),
    canSwitchScreens,
    magicLinkMessage: magicLinkAuth.message,
    submitApple,
    submitGoogle,
    submitMagicLink,
    submitPassword,
  };
}

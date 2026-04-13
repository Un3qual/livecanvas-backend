export type AuthEntryMode = 'signIn' | 'signUp';
export type AuthProvider = 'password' | 'google' | 'apple';

export type AuthEntryAttempt = {
  mode: AuthEntryMode;
  provider: AuthProvider;
};

export type AuthEntryControllerState = {
  activeAttempt: AuthEntryAttempt | null;
};

export type AuthEntryControllerAction =
  | { type: 'attemptStarted'; attempt: AuthEntryAttempt }
  | { type: 'attemptFinished' };

export const initialAuthEntryControllerState: AuthEntryControllerState = {
  activeAttempt: null,
};

export function authEntryControllerReducer(
  state: AuthEntryControllerState,
  action: AuthEntryControllerAction,
): AuthEntryControllerState {
  switch (action.type) {
    case 'attemptStarted':
      return {
        activeAttempt: action.attempt,
      };
    case 'attemptFinished':
      return initialAuthEntryControllerState;
    default:
      return state;
  }
}

export function isAuthProviderSubmitting(
  state: AuthEntryControllerState,
  provider: AuthProvider,
): boolean {
  return state.activeAttempt?.provider === provider;
}

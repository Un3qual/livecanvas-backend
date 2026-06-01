export type PrivacyMode = 'PUBLIC' | 'PRIVATE';

export type PrivacyModeState = {
  currentMode: PrivacyMode | null;
  errorMessage: string | null;
  pendingMode: PrivacyMode | null;
};

export type PrivacyModeAction =
  | { type: 'submit'; mode: PrivacyMode }
  | { type: 'success'; mode: string }
  | { type: 'error'; message: string }
  | { type: 'reset'; mode: string };

type MutationError = {
  readonly field?: string | null;
  readonly message: string;
};

export function createPrivacyModeState(mode: string): PrivacyModeState {
  return {
    currentMode: normalizePrivacyMode(mode),
    errorMessage: null,
    pendingMode: null,
  };
}

export function privacyModeReducer(
  state: PrivacyModeState,
  action: PrivacyModeAction,
): PrivacyModeState {
  switch (action.type) {
    case 'submit':
      return {
        currentMode: state.currentMode,
        errorMessage: null,
        pendingMode: action.mode,
      };

    case 'success':
      return {
        currentMode: normalizePrivacyMode(action.mode),
        errorMessage: null,
        pendingMode: null,
      };

    case 'error':
      return {
        currentMode: state.currentMode,
        errorMessage: action.message,
        pendingMode: null,
      };

    case 'reset':
      return createPrivacyModeState(action.mode);
  }
}

export function nextPrivacyMode(mode: PrivacyMode | null): PrivacyMode | null {
  switch (mode) {
    case 'PUBLIC':
      return 'PRIVATE';

    case 'PRIVATE':
      return 'PUBLIC';

    case null:
      return null;
  }
}

export function normalizePrivacyMode(mode: string): PrivacyMode | null {
  return mode === 'PUBLIC' || mode === 'PRIVATE' ? mode : null;
}

export function formatMutationErrors(
  errors: ReadonlyArray<MutationError> | null | undefined,
): string {
  const messages =
    errors
      ?.map((error) =>
        error.field ? `${error.field}: ${error.message}` : error.message,
      )
      .filter((message) => message.length > 0) ?? [];

  return messages.length > 0
    ? messages.join('; ')
    : 'We could not update privacy mode.';
}

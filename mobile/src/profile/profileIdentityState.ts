import type { MutationError } from './mutationErrors';

export type ProfileIdentityField = 'displayName' | 'username';

export type ProfileIdentityValues = {
  readonly displayName: string;
  readonly username: string;
};

type ProfileIdentitySourceValues = {
  readonly displayName?: string | null;
  readonly username?: string | null;
};

type ProfileIdentityFieldErrors = Record<ProfileIdentityField, string | null>;

type ProfileIdentityAttempt = {
  readonly id: number;
  readonly input: ProfileIdentityValues;
};

export type ProfileIdentityState = {
  readonly activeAttempt: ProfileIdentityAttempt | null;
  readonly confirmed: ProfileIdentityValues;
  readonly fieldErrors: ProfileIdentityFieldErrors;
  readonly generalError: string | null;
  readonly values: ProfileIdentityValues;
};

export type ProfileIdentityAction =
  | {
      readonly field: ProfileIdentityField;
      readonly type: 'changed';
      readonly value: string;
    }
  | { readonly attemptId: number; readonly type: 'submitted' }
  | {
      readonly attemptId: number;
      readonly type: 'succeeded';
      readonly values: ProfileIdentitySourceValues;
    }
  | {
      readonly attemptId: number;
      readonly errors: ReadonlyArray<MutationError> | null | undefined;
      readonly type: 'failed';
    }
  | { readonly type: 'reset'; readonly values: ProfileIdentitySourceValues };

type ProfileIdentityValidation = {
  readonly fieldErrors: ProfileIdentityFieldErrors;
  readonly input: ProfileIdentityValues | null;
};

const EMPTY_FIELD_ERRORS: ProfileIdentityFieldErrors = {
  displayName: null,
  username: null,
};

const FAILURE_MESSAGE = 'We could not update your profile identity. Try again.';

export function createProfileIdentityState(
  values: ProfileIdentitySourceValues,
): ProfileIdentityState {
  const normalizedValues = sourceValues(values);

  return {
    activeAttempt: null,
    confirmed: normalizedValues,
    fieldErrors: EMPTY_FIELD_ERRORS,
    generalError: null,
    values: normalizedValues,
  };
}

export function validateProfileIdentity(
  values: ProfileIdentityValues,
): ProfileIdentityValidation {
  const displayName = values.displayName.trim();
  const username = values.username.trim().toLowerCase();
  const fieldErrors: ProfileIdentityFieldErrors = {
    displayName: validateDisplayName(displayName),
    username: validateUsername(username),
  };

  return {
    fieldErrors,
    input:
      fieldErrors.displayName === null && fieldErrors.username === null
        ? { displayName, username }
        : null,
  };
}

export function profileIdentityReducer(
  state: ProfileIdentityState,
  action: ProfileIdentityAction,
): ProfileIdentityState {
  switch (action.type) {
    case 'changed':
      return {
        ...state,
        fieldErrors: { ...state.fieldErrors, [action.field]: null },
        generalError: null,
        values: { ...state.values, [action.field]: action.value },
      };

    case 'submitted': {
      if (state.activeAttempt !== null) {
        return state;
      }

      const validation = validateProfileIdentity(state.values);

      if (validation.input === null) {
        return {
          ...state,
          fieldErrors: validation.fieldErrors,
          generalError: null,
        };
      }

      return {
        ...state,
        activeAttempt: { id: action.attemptId, input: validation.input },
        fieldErrors: EMPTY_FIELD_ERRORS,
        generalError: null,
      };
    }

    case 'succeeded': {
      if (state.activeAttempt?.id !== action.attemptId) {
        return state;
      }

      const confirmed = sourceValues(action.values);
      const currentInput = validateProfileIdentity(state.values).input;
      const values = sameValues(currentInput, state.activeAttempt.input)
        ? confirmed
        : state.values;

      return {
        activeAttempt: null,
        confirmed,
        fieldErrors: EMPTY_FIELD_ERRORS,
        generalError: null,
        values,
      };
    }

    case 'failed': {
      if (state.activeAttempt?.id !== action.attemptId) {
        return state;
      }

      const failure = failureMessages(action.errors);

      return {
        ...state,
        activeAttempt: null,
        fieldErrors: failure.fieldErrors,
        generalError: failure.generalError,
      };
    }

    case 'reset': {
      if (state.activeAttempt !== null) {
        return state;
      }

      const confirmed = sourceValues(action.values);
      const isDirty = !sameValues(state.values, state.confirmed);

      return isDirty
        ? { ...state, confirmed }
        : {
            activeAttempt: null,
            confirmed,
            fieldErrors: EMPTY_FIELD_ERRORS,
            generalError: null,
            values: confirmed,
          };
    }
  }
}

function validateDisplayName(displayName: string): string | null {
  if (displayName.length === 0) {
    return 'Enter a display name.';
  }

  if (/[\u0000-\u001F\u007F]/u.test(displayName)) {
    return 'Use a single-line display name.';
  }

  if (Array.from(displayName).length > 50) {
    return 'Use a display name with 50 characters or fewer.';
  }

  return null;
}

function validateUsername(username: string): string | null {
  if (username.length === 0) {
    return 'Enter a username.';
  }

  return /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/.test(username)
    ? null
    : 'Use 3-30 letters, numbers, or underscores, starting and ending with a letter or number.';
}

function sourceValues(values: ProfileIdentitySourceValues): ProfileIdentityValues {
  return {
    displayName: values.displayName ?? '',
    username: values.username ?? '',
  };
}

function sameValues(
  left: ProfileIdentityValues | null,
  right: ProfileIdentityValues,
): boolean {
  return (
    left !== null &&
    left.displayName === right.displayName &&
    left.username === right.username
  );
}

function failureMessages(
  errors: ReadonlyArray<MutationError> | null | undefined,
): {
  readonly fieldErrors: ProfileIdentityFieldErrors;
  readonly generalError: string | null;
} {
  const fieldMessages: Record<ProfileIdentityField, string[]> = {
    displayName: [],
    username: [],
  };
  const generalMessages: string[] = [];

  for (const error of errors ?? []) {
    if (error.field === 'displayName' || error.field === 'username') {
      fieldMessages[error.field].push(error.message);
    } else if (error.message.length > 0) {
      generalMessages.push(error.message);
    }
  }

  const fieldErrors = {
    displayName: joinedMessages(fieldMessages.displayName),
    username: joinedMessages(fieldMessages.username),
  };
  const hasPayloadMessage =
    fieldErrors.displayName !== null ||
    fieldErrors.username !== null ||
    generalMessages.length > 0;

  return {
    fieldErrors,
    generalError: hasPayloadMessage
      ? joinedMessages(generalMessages)
      : FAILURE_MESSAGE,
  };
}

function joinedMessages(messages: ReadonlyArray<string>): string | null {
  const nonEmptyMessages = messages.filter((message) => message.length > 0);

  return nonEmptyMessages.length > 0 ? nonEmptyMessages.join('; ') : null;
}

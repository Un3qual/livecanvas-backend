import type { AuthTokenPair } from './types';

const ACCESS_TOKEN_TTL_DAYS = 14;
const GRAPHQL_ENDPOINT_PATH = '/graphql';

type MutationField = 'logIn' | 'signUp';
type AuthMode = 'signIn' | 'signUp';
type OauthProvider = 'GOOGLE' | 'APPLE';
type FetchImpl = typeof fetch;

type GraphQLToken = {
  serializedValue?: unknown;
  expiresAt?: unknown;
};

type GraphQLErrorLike = {
  message?: unknown;
};

type GraphQLAuthError = {
  field?: unknown;
  code?: unknown;
  message?: unknown;
};

type AuthPayload = {
  accessToken?: GraphQLToken | null;
  refreshToken?: GraphQLToken | null;
  errors?: GraphQLAuthError[] | null;
};

type GraphQLResponse = {
  data?: Record<string, AuthPayload | null> | null;
  errors?: GraphQLErrorLike[] | null;
};

export type AuthFieldName = 'email' | 'password' | 'passwordConfirmation';

export type AuthMutationError = {
  field?: string;
  code?: string;
  message: string;
};

export type AuthMutationResult =
  | {
      ok: true;
      tokens: AuthTokenPair;
    }
  | {
      ok: false;
      errors: AuthMutationError[];
    };

type PasswordAuthParams = {
  apiBaseUrl: string;
  mode: AuthMode;
  email: string;
  password: string;
  passwordConfirmation?: string;
  fetchImpl?: FetchImpl;
};

type OauthAuthParams = {
  apiBaseUrl: string;
  mode: AuthMode;
  provider: OauthProvider;
  idToken: string;
  fetchImpl?: FetchImpl;
};

const LOG_IN_MUTATION = `
  mutation AuthPasswordLogIn($input: LogInInput!) {
    logIn(input: $input) {
      accessToken {
        serializedValue
        expiresAt
      }
      refreshToken {
        serializedValue
      }
      errors {
        field
        code
        message
      }
    }
  }
`;

const SIGN_UP_MUTATION = `
  mutation AuthPasswordSignUp($input: SignUpInput!) {
    signUp(input: $input) {
      accessToken {
        serializedValue
        expiresAt
      }
      refreshToken {
        serializedValue
      }
      errors {
        field
        code
        message
      }
    }
  }
`;

function fallbackAccessTokenExpiresAt(): string {
  // The current auth contract still allows a nullable access-token expiry.
  return new Date(Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function mutationFieldForMode(mode: AuthMode): MutationField {
  return mode === 'signIn' ? 'logIn' : 'signUp';
}

function mutationTextForMode(mode: AuthMode): string {
  return mode === 'signIn' ? LOG_IN_MUTATION : SIGN_UP_MUTATION;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseErrorEntry(value: unknown): AuthMutationError | null {
  const entry = asRecord(value);

  if (!entry) {
    return null;
  }

  const message = typeof entry.message === 'string' ? entry.message.trim() : '';
  if (!message) {
    return null;
  }

  return {
    field: typeof entry.field === 'string' ? entry.field : undefined,
    code: typeof entry.code === 'string' ? entry.code : undefined,
    message,
  };
}

function parseTopLevelErrors(response: GraphQLResponse): AuthMutationError[] {
  if (!Array.isArray(response.errors)) {
    return [];
  }

  return response.errors
    .map(parseErrorEntry)
    .filter((error): error is AuthMutationError => error !== null);
}

function extractPayload(
  response: GraphQLResponse,
  field: MutationField,
): AuthPayload | null {
  const data = asRecord(response.data);

  if (!data) {
    return null;
  }

  const payload = asRecord(data[field]);
  return payload as AuthPayload | null;
}

function getTokenValue(token: GraphQLToken | null | undefined): string | null {
  return typeof token?.serializedValue === 'string' ? token.serializedValue : null;
}

function getTokenExpiry(token: GraphQLToken | null | undefined): string | null {
  return typeof token?.expiresAt === 'string' ? token.expiresAt : null;
}

function buildTokenPair(payload: AuthPayload): AuthTokenPair | null {
  const accessToken = getTokenValue(payload.accessToken);
  const refreshToken = getTokenValue(payload.refreshToken);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: getTokenExpiry(payload.accessToken) ?? fallbackAccessTokenExpiresAt(),
  };
}

function validatePasswordInput(
  mode: AuthMode,
  email: string,
  password: string,
  passwordConfirmation?: string,
): AuthMutationError[] {
  const errors: AuthMutationError[] = [];

  if (!email) {
    errors.push({
      field: 'email',
      message: 'Email is required.',
    });
  }

  if (!password) {
    errors.push({
      field: 'password',
      message: 'Password is required.',
    });
  }

  if (mode === 'signUp') {
    if (!passwordConfirmation) {
      errors.push({
        field: 'passwordConfirmation',
        message: 'Password confirmation is required.',
      });
    } else if (password !== passwordConfirmation) {
      errors.push({
        field: 'passwordConfirmation',
        message: 'Passwords must match.',
      });
    }
  }

  return errors;
}

async function executeAuthMutation(
  apiBaseUrl: string,
  mode: AuthMode,
  input: Record<string, unknown>,
  fetchImpl: FetchImpl,
): Promise<AuthMutationResult> {
  const response = await fetchImpl(`${apiBaseUrl}${GRAPHQL_ENDPOINT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutationTextForMode(mode),
      variables: {
        input,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth request failed with ${response.status} ${response.statusText}`);
  }

  const parsed = (await response.json()) as GraphQLResponse;
  const payload = extractPayload(parsed, mutationFieldForMode(mode));
  const payloadErrors = Array.isArray(payload?.errors)
    ? payload.errors
        .map(parseErrorEntry)
        .filter((error): error is AuthMutationError => error !== null)
    : [];

  if (payloadErrors.length > 0) {
    return {
      ok: false,
      errors: payloadErrors,
    };
  }

  const topLevelErrors = parseTopLevelErrors(parsed);
  if (topLevelErrors.length > 0) {
    return {
      ok: false,
      errors: topLevelErrors,
    };
  }

  const tokens = payload ? buildTokenPair(payload) : null;
  if (!tokens) {
    return {
      ok: false,
      errors: [
        {
          message: 'The server did not return auth tokens.',
        },
      ],
    };
  }

  return {
    ok: true,
    tokens,
  };
}

export async function submitPasswordAuthMutation(
  params: PasswordAuthParams,
): Promise<AuthMutationResult> {
  const email = params.email.trim();
  const password = params.password;
  const passwordConfirmation = params.passwordConfirmation?.trim();
  const validationErrors = validatePasswordInput(
    params.mode,
    email,
    password,
    passwordConfirmation,
  );

  if (validationErrors.length > 0) {
    return {
      ok: false,
      errors: validationErrors,
    };
  }

  return executeAuthMutation(
    params.apiBaseUrl,
    params.mode,
    {
      provider: 'PASSWORD',
      password: {
        email,
        password,
        ...(params.mode === 'signUp' ? { passwordConfirmation } : {}),
      },
    },
    params.fetchImpl ?? fetch,
  );
}

export async function submitOauthAuthMutation(
  params: OauthAuthParams,
): Promise<AuthMutationResult> {
  const idToken = params.idToken.trim();

  if (!idToken) {
    return {
      ok: false,
      errors: [
        {
          message: 'The identity provider did not return a usable token.',
        },
      ],
    };
  }

  return executeAuthMutation(
    params.apiBaseUrl,
    params.mode,
    {
      provider: params.provider,
      oauth: {
        idToken,
      },
    },
    params.fetchImpl ?? fetch,
  );
}

export function normalizeAuthErrors(errors: AuthMutationError[]): {
  fieldErrors: Partial<Record<AuthFieldName, string>>;
  formError: string | null;
} {
  const fieldErrors: Partial<Record<AuthFieldName, string>> = {};
  let formError: string | null = null;

  for (const error of errors) {
    if (
      (error.field === 'email' ||
        error.field === 'password' ||
        error.field === 'passwordConfirmation') &&
      !fieldErrors[error.field]
    ) {
      fieldErrors[error.field] = error.message;
      continue;
    }

    if (!formError) {
      formError = error.message;
    }
  }

  return { fieldErrors, formError };
}

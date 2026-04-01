import type { AuthTokenPair } from './types';

export interface GraphQLResponseLike {
  data?: unknown;
  errors?: unknown;
}

export type GraphQLResponseInput =
  | GraphQLResponseLike
  | readonly GraphQLResponseLike[]
  | null
  | undefined;

export interface RefreshedAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const REFRESH_MUTATION = `
  mutation RefreshAuthTokens($input: RefreshAuthTokensInput!) {
    refreshAuthTokens(input: $input) {
      accessToken {
        serializedValue
        tokenVersion
      }
      refreshToken {
        serializedValue
        tokenVersion
      }
      errors { field code message }
    }
  }
`;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGraphQLResponseObject(
  value: GraphQLResponseInput,
): value is GraphQLResponseLike {
  return !Array.isArray(value) && isObject(value);
}

function normalizeGraphQLErrorValue(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
}

function isUnauthenticatedErrorEntry(entry: unknown): boolean {
  if (!isObject(entry)) return false;

  const message = normalizeGraphQLErrorValue(entry.message);
  if (message === 'unauthenticated') return true;

  const extensions = entry.extensions;
  if (isObject(extensions) && normalizeGraphQLErrorValue(extensions.code) === 'unauthenticated') {
    return true;
  }

  return normalizeGraphQLErrorValue(entry.code) === 'unauthenticated';
}

function hasUnauthenticatedPayloadError(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasUnauthenticatedPayloadError);
  }

  if (!isObject(value)) return false;

  const errors = value.errors;
  if (Array.isArray(errors) && errors.some(isUnauthenticatedErrorEntry)) {
    return true;
  }

  return Object.values(value).some(hasUnauthenticatedPayloadError);
}

export function hasUnauthenticatedError(response: GraphQLResponseInput): boolean {
  if (Array.isArray(response)) {
    return response.some(hasUnauthenticatedError);
  }

  if (!isGraphQLResponseObject(response)) return false;

  if (Array.isArray(response.errors) && response.errors.some(isUnauthenticatedErrorEntry)) {
    return true;
  }

  return hasUnauthenticatedPayloadError(response.data);
}

function getTokenValue(value: unknown): string | null {
  if (!isObject(value)) return null;
  return typeof value.serializedValue === 'string' ? value.serializedValue : null;
}

export function extractRefreshedAuthTokens(
  response: GraphQLResponseInput,
): RefreshedAuthTokens | null {
  if (!isGraphQLResponseObject(response) || !isObject(response.data)) return null;

  const payload = response.data.refreshAuthTokens;
  if (!isObject(payload)) return null;

  const accessToken = getTokenValue(payload.accessToken);
  const refreshToken = getTokenValue(payload.refreshToken);

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function buildTokenPair(
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
): AuthTokenPair {
  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

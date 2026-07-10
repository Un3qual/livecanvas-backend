// Bypass potentially stale identity records until the server reauthorizes them.
export const PRIVACY_SENSITIVE_FETCH_OPTIONS = {
  fetchPolicy: 'network-only',
} as const;

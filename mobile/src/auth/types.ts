export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  /** ISO 8601 timestamp when the access token expires */
  expiresAt: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; tokens: AuthTokenPair }
  | { status: 'unauthenticated' };

export interface AuthContextValue {
  state: AuthState;
  /** Store tokens after successful sign-in/sign-up and transition to authenticated */
  signIn: (tokens: AuthTokenPair) => Promise<void>;
  /** Clear tokens and transition to unauthenticated */
  signOut: () => Promise<void>;
  /** Sync in-memory auth state after background token rotation */
  syncTokens: (tokens: AuthTokenPair) => void;
  /** Transition to unauthenticated after the network layer already cleared storage */
  onForcedLogout: () => void;
  /** Get the current access token, or null if unauthenticated */
  getAccessToken: () => string | null;
}

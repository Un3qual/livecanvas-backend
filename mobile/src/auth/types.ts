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
  /** Read the latest auth status without waiting for a re-render */
  getAuthStatus: () => AuthState['status'];
  /** Get the current access token, or null if unauthenticated */
  getAccessToken: () => string | null;
  /** Start an auth submission if no other provider is already in flight */
  beginAuthSubmission: () => boolean;
  /** Release the shared auth submission gate after an attempt settles */
  endAuthSubmission: () => void;
  /** Read the shared auth submission gate without waiting for a re-render */
  isAuthSubmissionActive: () => boolean;
}

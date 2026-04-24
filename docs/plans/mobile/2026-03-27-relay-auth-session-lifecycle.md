# Relay Data Layer, Auth, And Session Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the mobile app to the backend GraphQL API through Relay, implement authenticated network transport with secure token storage and rotation, build the auth provider and sign-in/sign-up screens for password and OAuth entry, and implement viewer bootstrap with session restoration on cold start.

**Architecture:** The Relay environment plugs into the existing provider stack inside StartupGate. An AuthProvider manages token lifecycle, session state, and auth-gated routing. The network layer injects bearer tokens, handles transparent refresh, and triggers forced logout on unrecoverable failures. Auth screens replace the current placeholders with real sign-in/sign-up flows for password, Google, and Apple. Viewer bootstrap runs after successful auth to hydrate the signed-in shell.

**Tech Stack:** Relay (relay-runtime, react-relay, relay-compiler), expo-secure-store, expo-auth-session (for OAuth), GraphQL SDL schema from backend introspection

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. The mobile shell is complete with routing, providers, startup gate, and layout primitives (all 4 tasks green in the shell plan).
2. `StartupGate` manages boot state (`signed_out`, `authenticated`, `forced_logout`) and exposes environment config via `useStartupState()`.
3. `AppProviders.tsx` has an explicit seam comment: "Keep future Relay/auth/channel providers outside the router tree seam."
4. Environment config provides `apiBaseUrl` (`http://localhost:4000`) and `websocketUrl` (`ws://localhost:4000/socket`).
5. The auth route group has placeholder sign-in screen that hardcodes navigation to `/home`.
6. The backend exposes `mix absinthe.schema.sdl --schema LCGQL.Schema` which produces a 900-line `schema.graphql` (already exported to `mobile/schema.graphql`).
7. Backend auth surface is mature: `signUp`, `logIn`, `beginAuthChallenge`, `refreshAuthTokens`, `revokeRefreshToken`, `issueViewerAuthTokens` mutations with 5 providers (password, magic_link, google, apple, passkey).
8. Bearer token auth via `Authorization: Bearer <token>` header. Access tokens expire in 14 days, refresh tokens in 30 days with single-use rotation.
9. All GraphQL connections use Relay cursor pagination with global IDs and the `node(id:)` interface.

## Scope Decisions

- **In scope:** Relay environment, codegen, authenticated fetch, token storage/rotation, AuthProvider, password sign-in/sign-up, Google OAuth, Apple OAuth, viewer bootstrap query, session restoration, forced logout, auth-gated routing.
- **Out of scope:** Magic link auth (requires email delivery UX), passkey auth (requires WebAuthn native module investigation), Phoenix Channels, chat, live sessions, profile editing, offline persistence.
- **Deferred to later plans:** Channel client integration, Relay store persistence, advanced error recovery, account settings, identity management.

## Backend Dependencies

- The GraphQL schema is already exported to `mobile/schema.graphql`. If backend mutations change, re-export with `mix absinthe.schema.sdl --schema LCGQL.Schema` and copy to `mobile/`.
- No backend code changes are required for this plan. All auth mutations, token lifecycle, and viewer query surfaces already exist.

## Progress

- [x] Task 1: Add Relay dependencies, configure codegen, and wire the environment provider
- [x] Task 2: Build secure token storage and the auth state provider
- [x] Task 3: Build the authenticated network layer with token refresh and forced logout
- [x] Task 4: Implement sign-in and sign-up screens with password and OAuth flows
- [x] Task 5: Implement viewer bootstrap, session restoration, and auth-gated routing
- [x] Task 6: Verify the Relay/auth slice and advance the mobile planning pointers

### Task 1: Add Relay Dependencies, Configure Codegen, And Wire The Environment Provider

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/tsconfig.json`
- Create: `mobile/relay.config.js`
- Create: `mobile/src/relay/environment.ts`
- Create: `mobile/src/relay/RelayEnvironmentProvider.tsx`
- Modify: `mobile/src/providers/AppProviders.tsx`
- Already present: `mobile/schema.graphql`

**Task 1 Step Progress:**
- [ ] Step 1: Install Relay packages (`relay-runtime`, `react-relay`, `relay-compiler`, `graphql`, `babel-plugin-relay`) and their type definitions
- [ ] Step 2: Create `relay.config.js` pointing at `schema.graphql`, TypeScript output, and the `src/` source root
- [ ] Step 3: Add a `relay` script to `package.json` that runs the Relay compiler, and run it to verify schema parsing succeeds
- [ ] Step 4: Create the Relay Environment in `src/relay/environment.ts` with a basic (unauthenticated) fetch function that posts to `apiBaseUrl + '/graphql'`
- [ ] Step 5: Create `RelayEnvironmentProvider.tsx` that wraps `react-relay`'s provider with the app environment
- [ ] Step 6: Insert `RelayEnvironmentProvider` into the `AppProviders` stack inside `StartupGate`, after the auth provider seam comment
- [ ] Step 7: Run Relay compiler and `tsc --noEmit` to verify the pipeline

**Task 1 behavior targets:**

- The Relay compiler parses the backend schema without errors.
- The Relay Environment is initialized with the correct GraphQL endpoint from environment config.
- Components inside the provider tree can use `useLazyLoadQuery`, `useFragment`, etc.
- The fetch function is a seam that Task 3 will replace with an authenticated version.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS for both.

### Task 2: Build Secure Token Storage And The Auth State Provider

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/src/auth/tokenStorage.ts`
- Create: `mobile/src/auth/AuthProvider.tsx`
- Create: `mobile/src/auth/types.ts`
- Modify: `mobile/src/config/runtime.ts`

**Task 2 Step Progress:**
- [ ] Step 1: Install `expo-secure-store` for encrypted token persistence on device
- [ ] Step 2: Create `src/auth/types.ts` defining `AuthTokenPair` (`accessToken`, `refreshToken`, `expiresAt` fields), `AuthState` union (`loading | authenticated | unauthenticated`), and `AuthContextValue` (state, signIn, signUp, signOut, refreshTokens)
- [ ] Step 3: Create `src/auth/tokenStorage.ts` with functions: `storeTokens(pair)`, `loadTokens(): AuthTokenPair | null`, `clearTokens()`, using `expo-secure-store` with keys `lc_access_token`, `lc_refresh_token`, `lc_token_expires_at`
- [ ] Step 4: Create `src/auth/AuthProvider.tsx` with React context that manages `AuthState`, exposes `useAuth()` hook, and coordinates with token storage for state transitions
- [ ] Step 5: Update `StartupGate` to delegate session state determination to the auth provider instead of reading `bootSessionState` from environment config directly — the auth provider checks stored tokens on mount and sets initial state accordingly
- [ ] Step 6: Run `tsc --noEmit` to verify

**Task 2 behavior targets:**

- Tokens are stored encrypted on device via SecureStore, not in AsyncStorage or memory.
- `useAuth()` provides the current auth state and action functions to any component in the tree.
- The auth provider determines `authenticated` vs `signed_out` on cold start by checking for stored tokens.
- `forced_logout` transitions clear stored tokens and reset auth state.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

### Task 3: Build The Authenticated Network Layer With Token Refresh And Forced Logout

**Files:**
- Modify: `mobile/src/relay/environment.ts`
- Create: `mobile/src/auth/authenticatedFetch.ts`
- Create: `mobile/src/auth/tokenRefresh.ts`
- Modify: `mobile/src/auth/AuthProvider.tsx`

**Task 3 Step Progress:**
- [ ] Step 1: Create `src/auth/authenticatedFetch.ts` — a fetch wrapper that reads the current access token from storage and injects `Authorization: Bearer <token>` header on every GraphQL request
- [ ] Step 2: Create `src/auth/tokenRefresh.ts` — implements the refresh flow: when an access token is expired or a request returns an auth error, call `refreshAuthTokens` mutation with the stored refresh token, store the new pair, and retry the original request once
- [ ] Step 3: Handle unrecoverable auth failures in the refresh flow: if the refresh token is expired, revoked, or invalid, clear tokens and trigger forced logout through the auth provider
- [ ] Step 4: Wire `authenticatedFetch` into the Relay Environment's `fetchFunction` so all Relay queries and mutations automatically use authenticated transport
- [ ] Step 5: Ensure unauthenticated requests (sign-up, log-in) bypass the auth header injection by checking the operation name or using a separate fetch path
- [ ] Step 6: Run `tsc --noEmit` to verify

**Task 3 behavior targets:**

- All Relay queries include a valid bearer token when the user is authenticated.
- Expired access tokens trigger transparent refresh without user interaction.
- Unrecoverable auth failures (expired/revoked refresh token) trigger forced logout and redirect to sign-in.
- Sign-up and log-in mutations work without an existing session.
- No token secrets are logged or exposed in error messages.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

### Task 4: Implement Sign-In And Sign-Up Screens With Password And OAuth Flows

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app/(auth)/sign-in.tsx`
- Create: `mobile/app/(auth)/sign-up.tsx`
- Create: `mobile/src/auth/usePasswordAuth.ts`
- Create: `mobile/src/auth/useGoogleAuth.ts`
- Create: `mobile/src/auth/useAppleAuth.ts`
- Modify: `mobile/app/(auth)/_layout.tsx`

**Task 4 Step Progress:**
- [x] Step 1: Install `expo-auth-session` and `expo-apple-authentication` for OAuth flows, and `expo-crypto` if needed for PKCE/nonce
- [x] Step 2: Create `src/auth/usePasswordAuth.ts` — a hook that wraps the `logIn(provider: PASSWORD)` and `signUp(provider: PASSWORD)` mutations, handles validation, and calls `useAuth().signIn` / `useAuth().signUp` on success
- [x] Step 3: Create `src/auth/useGoogleAuth.ts` — a hook that initiates Google OAuth via `expo-auth-session`, receives the `idToken`, and calls `logIn(provider: GOOGLE, oauth: {idToken})` or `signUp` as appropriate
- [x] Step 4: Create `src/auth/useAppleAuth.ts` — a hook that initiates Apple Sign In via `expo-apple-authentication`, receives the `identityToken`, and calls `logIn(provider: APPLE, oauth: {idToken})` or `signUp`
- [x] Step 5: Replace the placeholder sign-in screen with a real form: email/password fields, "Sign In" button, OAuth buttons for Google and Apple, link to sign-up screen, and error display for `invalid_credentials`, `email_taken`, etc.
- [x] Step 6: Create the sign-up screen with email/password/confirmation fields, OAuth buttons, link back to sign-in, and validation error display
- [x] Step 7: Add the `sign-up` route to the `(auth)/_layout.tsx` stack
- [x] Step 8: Run `tsc --noEmit` to verify

**Task 4 behavior targets:**

- Users can sign in with email/password and see validation errors for invalid credentials.
- Users can create an account with email/password and see errors for taken emails or weak passwords.
- Google and Apple OAuth flows launch the native picker, exchange tokens, and complete auth.
- Successful auth stores tokens, updates auth state to `authenticated`, and triggers redirect to the app shell.
- Failed auth stays on the auth screen with a visible error message.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS.

### Task 5: Implement Viewer Bootstrap, Session Restoration, And Auth-Gated Routing

**Files:**
- Create: `mobile/src/auth/ViewerBootstrap.tsx`
- Create: `mobile/src/auth/__generated__/ViewerBootstrapQuery.graphql.ts` (auto-generated by relay-compiler)
- Modify: `mobile/src/auth/AuthProvider.tsx`
- Modify: `mobile/src/providers/StartupGate.tsx`
- Modify: `mobile/app/index.tsx`
- Modify: `mobile/app/(app)/_layout.tsx`

**Task 5 Step Progress:**
- [x] Step 1: Define the `ViewerBootstrapQuery` GraphQL query fetching `viewer { id email privacyMode insertedAt }` and run the Relay compiler to generate artifacts
- [x] Step 2: Create `ViewerBootstrap.tsx` — a component that runs the bootstrap query after auth succeeds, hydrates viewer context, and handles the case where `viewer` returns `null` (treat as forced logout)
- [x] Step 3: Update `AuthProvider` to run session restoration on mount: load stored tokens, attempt `issueViewerAuthTokens` to validate the session, and set state to `authenticated` or `signed_out` based on the result
- [x] Step 4: Update `StartupGate` to integrate with the auth provider's loading state — show the splash/loading screen until both boot snapshot and auth state are resolved
- [x] Step 5: Add an auth guard to `(app)/_layout.tsx` that redirects to `/sign-in` if the auth state is `unauthenticated`, using `useAuth()` and `<Redirect>`
- [x] Step 6: Update root `index.tsx` to derive `landingHref` from the auth provider's resolved state rather than the static environment config
- [x] Step 7: Run Relay compiler and `tsc --noEmit` to verify

**Task 5 behavior targets:**

- Cold start with valid stored tokens silently restores the session and lands on `/home`.
- Cold start with expired/revoked tokens clears storage and lands on `/sign-in`.
- Cold start with no stored tokens lands on `/sign-in`.
- Navigating to `(app)` routes while unauthenticated redirects to `/sign-in`.
- Deep links to authenticated routes are held until session state resolves, then honored or redirected.
- Viewer data is available to the signed-in shell after bootstrap completes.

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
```

Expected: PASS for both.

### Task 6: Verify The Relay/Auth Slice And Advance The Mobile Planning Pointers

**Files:**
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/mobile/NOW.md`

**Task 6 Step Progress:**
- [x] Step 1: Re-read this plan and confirm the Relay/auth slice is complete without leaking channel, chat, or live-session implementation
- [x] Step 2: Run the Relay compiler, tsc, and workspace sanity checks
- [x] Step 3: Update the mobile track and lane pointer to the next batch (profiles and social basics, or the next unblocked slice)
- [x] Step 4: Commit the Relay/auth slice with the planning updates

**Suggested verification command:**

```bash
cd mobile
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec relay-compiler
XDG_CACHE_HOME=/tmp/nix-run-cache nix --extra-experimental-features 'nix-command flakes' run path:.#pnpm -- exec tsc --noEmit
cd ..
test -d mobile
test -f mobile/package.json
```

Expected: PASS.

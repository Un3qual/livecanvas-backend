# Unified Auth Entry Points And Cluster Rate Limits Implementation Plan

**Goal:** Deliver generic GraphQL signup/login/challenge entry points for password, magic-link, Google, Apple, and passkey auth while replacing per-node abuse throttles with cluster-aware OTP coordination.

**Architecture:** Keep terminal auth orchestration in `LC.Accounts`, keep GraphQL resolver layers adapter-thin, and split reusable challenge issuance from signup/login entry points. Reuse the existing `DNSCluster` + `:erpc` stack for cluster-aware rate-limit ownership, and persist passkey-specific data in dedicated relational storage instead of overloading `user_identities`.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, Req, ExUnit, Dialyzer, OTP distribution

---

## Candidate Status Verification (2026-03-16)

Verified directly in active docs, code, and tests before writing this plan:

1. **Generic auth entry points are missing.**
   - Evidence: GraphQL only exposes viewer-scoped token issuance/refresh/revoke plus browser-oriented registration/reset flows (`lib/live_canvas_gql/accounts/account_mutations.ex`, `lib/live_canvas_web/router.ex`).
2. **Client auth provider modeling is inconsistent.**
   - Evidence: `user_identity_provider` includes `:apple_provider`, `:google_provider`, `:passkey_provider`, `:snap_provider`, and `:instagram_provider`, while GraphQL still exposes `oauth_provider` values that do not match the intended launch set (`lib/live_canvas_schemas/accounts/user_identity_provider.ex`, `lib/live_canvas_gql/accounts/account_types.ex`).
3. **Password and magic-link primitives exist, but they are not composed into mobile-friendly signup/login GraphQL entry points.**
   - Evidence: `LC.Accounts` already has password lookup plus magic-link issue/redeem helpers (`lib/live_canvas/accounts.ex`), but there are no generic `signUp`, `logIn`, or `beginAuthChallenge` mutations.
4. **Google, Apple, and passkey auth are not implemented beyond identity storage.**
   - Evidence: active identity rows can be persisted and queried, but no provider verification or passkey credential flow exists in `lib/` or `test/`.
5. **Rate limiting is still node-local.**
   - Evidence: `LCWeb.RateLimiter` uses a local ETS table with no cross-node owner routing (`lib/live_canvas_web/rate_limiter.ex`).
6. **Compliance work remains paused and must stay out of scope.**
   - Evidence: plan index and roadmap explicitly keep hard-delete work paused (`docs/plans/README.md`, `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Scope And Assumptions

- Do not freeze the full GraphQL API in this slice.
- Keep browser auth routes and existing token lifecycle behavior intact.
- `signUp` and `logIn` are terminal auth mutations only.
- `beginAuthChallenge` issues reusable challenge state and is intentionally separate from signup/login.
- Identity-linking, add-email, and other authenticated account-management flows remain separate viewer-scoped mutations.
- Use the existing cluster wiring (`DNSCluster` + `:erpc`) before considering new dependencies.
- Keep new public functions fully typespecced and comment non-obvious invariants.

## Progress

- [x] Task 1: Add generic auth GraphQL foundation and auth-specific error codes
- [x] Task 2: Deliver password + magic-link challenge/signup/login flows
- [x] Task 3: Deliver Google + Apple signup/login flows
- [x] Task 4: Deliver passkey challenge/signup/login flows with dedicated credential persistence
- [x] Task 5: Replace node-local throttles with cluster-aware OTP owner routing
- [x] Task 6: Run full verification and update roadmap/index tracking

### Task 1: Add Generic Auth GraphQL Foundation And Auth-Specific Error Codes

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


**Task 1 behavior targets:**

- New auth mutations exist with stable Relay payloads.
- Auth payload errors include both `message` and machine-readable `code`.
- GraphQL auth provider exposure matches the intended launch set:
  - `PASSWORD`
  - `MAGIC_LINK`
  - `GOOGLE`
  - `APPLE`
  - `PASSKEY`

Verification evidence (2026-03-16):

- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/account_queries_test.exs` -> RED first (`43 tests, 4 failures`) and GREEN after implementation (`43 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)
- `mix compile` -> PASS

### Task 2: Deliver Password + Magic-Link Challenge/Signup/Login Flows

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Create: `test/live_canvas/accounts/auth_entrypoints_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/integration/accounts_login_flow_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


**Task 2 behavior targets:**

- `signUp(provider: PASSWORD, ...)` creates a new account, sets the password, and returns tokens.
- `logIn(provider: PASSWORD, ...)` authenticates an existing account and returns tokens.
- `beginAuthChallenge(provider: MAGIC_LINK, purpose: SIGN_UP, ...)` creates a signup magic-link challenge for a new email.
- `beginAuthChallenge(provider: MAGIC_LINK, purpose: LOG_IN, ...)` creates a login magic-link challenge for an existing account while keeping enumeration-safe responses.
- `signUp(provider: MAGIC_LINK, ...)` and `logIn(provider: MAGIC_LINK, ...)` redeem challenge tokens and return tokens.

Verification evidence (2026-03-16):

- `mix test test/live_canvas/accounts/auth_entrypoints_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/integration/accounts_login_flow_test.exs` -> RED first (`54 tests, 16 failures`) and GREEN after implementation (`54 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Deliver Google + Apple Signup/Login Flows

**Files:**
- Create: `lib/live_canvas/accounts/provider_auth.ex`
- Create: `lib/live_canvas/accounts/provider_auth/google.ex`
- Create: `lib/live_canvas/accounts/provider_auth/apple.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `config/config.exs`
- Modify: `config/runtime.exs`
- Create: `test/live_canvas/accounts/provider_auth_test.exs`
- Create: `test/support/provider_auth_test_support.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


**Task 3 behavior targets:**

- `signUp(provider: GOOGLE|APPLE, ...)` succeeds only when the presented provider proof is valid and no active identity is already linked.
- `logIn(provider: GOOGLE|APPLE, ...)` succeeds only for an existing active linked identity.
- Provider verification failures map to stable auth error codes instead of leaking transport exceptions.

Verification evidence (2026-03-16):

- `mix test test/live_canvas/accounts/provider_auth_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED first (`60 tests, 10 failures`) and GREEN after implementation (`60 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 4: Deliver Passkey Challenge/Signup/Login Flows With Dedicated Credential Persistence

**Files:**
- Create: `priv/repo/migrations/<timestamp>_expand_user_token_context_for_passkey_challenges.exs`
- Create: `priv/repo/migrations/<timestamp>_create_user_passkeys.exs`
- Create: `lib/live_canvas_schemas/accounts/user_passkey.ex`
- Modify: `lib/live_canvas_schemas/accounts/user_token_context.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Create: `lib/live_canvas/accounts/passkeys.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Create: `test/live_canvas_schemas/accounts/user_passkey_test.exs`
- Create: `test/live_canvas/accounts/passkeys_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


**Task 4 persistence targets:**

- `user_passkeys`
  - `id`
  - `entropy_id`
  - `user_id`
  - `user_identity_id`
  - `credential_id`
  - `public_key`
  - `sign_count`
  - `transports`
  - `last_used_at`
  - timestamps

**Task 4 behavior targets:**

- `beginAuthChallenge(provider: PASSKEY, purpose: SIGN_UP, ...)` issues a persisted registration challenge token plus WebAuthn creation options.
- `beginAuthChallenge(provider: PASSKEY, purpose: LOG_IN, ...)` issues an enumeration-safe authentication challenge plus WebAuthn request options for active credentials.
- `signUp(provider: PASSKEY, ...)` confirms the challenge, persists a dedicated `user_passkeys` row, and returns auth tokens.
- `logIn(provider: PASSKEY, ...)` verifies the assertion against the stored credential, updates sign-in counters, and returns auth tokens.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_schemas/accounts/user_passkey_test.exs test/live_canvas/accounts/passkeys_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED first (`61 tests, 8 failures`) and GREEN after implementation (`61 tests, 0 failures`)
- `MIX_ENV=test mix ecto.migrate --quiet` -> PASS
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 5: Replace Node-Local Throttles With Cluster-Aware OTP Owner Routing

**Files:**
- Modify: `lib/live_canvas_web/rate_limiter.ex`
- Create: `test/live_canvas_web/rate_limiter_test.exs`
- Modify: `test/live_canvas_web/controllers/user_session_rate_limit_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


**Task 5 behavior targets:**

- `auth_login`, `graphql_mutation`, `moderation_action`, `channel_join`, and `chat_send` limits are cluster-aware in healthy distributed conditions.
- The authoritative bucket for a subject is owned by one node at a time via deterministic hashing.
- Remote-owner transport failures fall back to local-node enforcement instead of hard request failure.

Verification evidence (2026-03-16):

- `mix test test/live_canvas_web/rate_limiter_test.exs` -> RED first (`3 tests, 1 failure`) while stabilizing the focused suite, then GREEN (`3 tests, 0 failures`)
- `mix test test/live_canvas_web/rate_limiter_test.exs test/live_canvas_web/controllers/user_session_rate_limit_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs test/live_canvas_web/channels/live_session_channel_test.exs` -> GREEN (`19 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 6: Run Full Verification And Update Roadmap/Index Tracking

**Files:**
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`


Verification evidence (2026-03-16):

- `mix compile` -> PASS
- `mix test` -> PASS (`546 tests, 0 failures, 1 excluded`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)
- `mix precommit` -> PASS
- `docs/plans/README.md` now relabels this plan under Recently Completed instead of Active Work
- `docs/plans/2026-03-03-backend-release-readiness-roadmap.md` now records the shipped mobile auth contract, v1 provider rollout, and cluster-aware auth/mutation/channel abuse throttles

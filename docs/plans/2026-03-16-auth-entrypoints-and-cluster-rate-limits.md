# Unified Auth Entry Points And Cluster Rate Limits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

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
- [ ] Task 2: Deliver password + magic-link challenge/signup/login flows
- [ ] Task 3: Deliver Google + Apple signup/login flows
- [ ] Task 4: Deliver passkey challenge/signup/login flows with dedicated credential persistence
- [ ] Task 5: Replace node-local throttles with cluster-aware OTP owner routing
- [ ] Task 6: Run full verification and update roadmap/index tracking

### Task 1: Add Generic Auth GraphQL Foundation And Auth-Specific Error Codes

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing GraphQL tests for `beginAuthChallenge`, `signUp`, and `logIn` payload shape, `AUTH_PROVIDER` enum validation, and auth error `code` output
- [x] Step 2: Run focused GraphQL auth tests to verify RED
- [x] Step 3: Implement `auth_provider`, `auth_challenge_purpose`, and `auth_error_code` types plus mutation scaffolding and resolver error helpers
- [x] Step 4: Add `authProvider` output on `UserIdentity` and deprecate the mismatched `oauthProvider` shape in the GraphQL layer
- [x] Step 5: Run focused GraphQL tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

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

**Task 2 Step Progress:**
- [ ] Step 1: Add failing Accounts and GraphQL tests for password signup/login and magic-link challenge issuance plus signup/login redemption
- [ ] Step 2: Run focused Accounts/GraphQL auth tests to verify RED
- [ ] Step 3: Implement Accounts entry points for password signup/login and magic-link challenge/signup/login, returning access + refresh token pairs on success
- [ ] Step 4: Keep email confirmation separate from password signup while treating successful magic-link redemption as email ownership proof
- [ ] Step 5: Wire GraphQL resolvers to the new Accounts APIs and keep browser routes untouched
- [ ] Step 6: Run focused Accounts/GraphQL/integration auth tests to verify GREEN
- [ ] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- `signUp(provider: PASSWORD, ...)` creates a new account, sets the password, and returns tokens.
- `logIn(provider: PASSWORD, ...)` authenticates an existing account and returns tokens.
- `beginAuthChallenge(provider: MAGIC_LINK, purpose: SIGN_UP, ...)` creates a signup magic-link challenge for a new email.
- `beginAuthChallenge(provider: MAGIC_LINK, purpose: LOG_IN, ...)` creates a login magic-link challenge for an existing account while keeping enumeration-safe responses.
- `signUp(provider: MAGIC_LINK, ...)` and `logIn(provider: MAGIC_LINK, ...)` redeem challenge tokens and return tokens.

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
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing tests for Google/Apple provider-token verification, existing-identity login, and new-account signup semantics
- [ ] Step 2: Run focused provider-auth tests to verify RED
- [ ] Step 3: Implement a verifier behaviour plus Google/Apple verifier modules with injected HTTP/JWKS/config seams
- [ ] Step 4: Implement Accounts signup/login entry points that create or resolve linked `user_identities` for Google and Apple
- [ ] Step 5: Add runtime configuration for provider audiences/issuers/JWKS URLs and keep failure reasons deterministic
- [ ] Step 6: Run focused Accounts/GraphQL provider-auth tests to verify GREEN
- [ ] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 3 behavior targets:**

- `signUp(provider: GOOGLE|APPLE, ...)` succeeds only when the presented provider proof is valid and no active identity is already linked.
- `logIn(provider: GOOGLE|APPLE, ...)` succeeds only for an existing active linked identity.
- Provider verification failures map to stable auth error codes instead of leaking transport exceptions.

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

**Task 4 Step Progress:**
- [ ] Step 1: Add failing schema, Accounts, and GraphQL tests for passkey challenge issuance, signup attestation completion, and login assertion completion
- [ ] Step 2: Run focused passkey tests to verify RED
- [ ] Step 3: Implement persisted passkey challenge-token contexts and the `user_passkeys` relational table using bigint + `entropy_id`
- [ ] Step 4: Implement passkey challenge issuance and attestation/assertion verification in Accounts-owned modules
- [ ] Step 5: Link passkey credentials to `user_identities` with `provider: :passkey_provider` while keeping credential-specific state in `user_passkeys`
- [ ] Step 6: Run focused schema/Accounts/GraphQL passkey tests to verify GREEN
- [ ] Step 7: Run `MIX_ENV=test mix ecto.migrate --quiet`, touched passkey tests, `mix compile`, and `mix typecheck`; then update checklist progress and commit milestone

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

### Task 5: Replace Node-Local Throttles With Cluster-Aware OTP Owner Routing

**Files:**
- Modify: `lib/live_canvas_web/rate_limiter.ex`
- Create: `test/live_canvas_web/rate_limiter_test.exs`
- Modify: `test/live_canvas_web/controllers/user_session_rate_limit_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`

**Task 5 Step Progress:**
- [ ] Step 1: Add failing limiter tests for deterministic owner-node selection, remote-owner forwarding, and local fallback when owner routing fails
- [ ] Step 2: Run focused limiter tests to verify RED
- [ ] Step 3: Implement deterministic node selection using the connected cluster membership and `:erpc` forwarding to an owner-node local ETS counter path
- [ ] Step 4: Preserve the existing public `allow/2`, `conn_subject/1`, and `reset!/0` API so current plugs/channels/controllers do not change
- [ ] Step 5: Keep unhealthy-cluster behavior fail-open to local enforcement rather than rejecting traffic on transport errors
- [ ] Step 6: Run focused limiter/controller/channel/GraphQL rate-limit tests to verify GREEN
- [ ] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 5 behavior targets:**

- `auth_login`, `graphql_mutation`, `moderation_action`, `channel_join`, and `chat_send` limits are cluster-aware in healthy distributed conditions.
- The authoritative bucket for a subject is owned by one node at a time via deterministic hashing.
- Remote-owner transport failures fall back to local-node enforcement instead of hard request failure.

### Task 6: Run Full Verification And Update Roadmap/Index Tracking

**Files:**
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/2026-03-16-auth-entrypoints-and-cluster-rate-limits.md`

**Task 6 Step Progress:**
- [ ] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 2: Update the roadmap/index to record delivered auth entry points, provider rollout status, and cluster-aware limiter behavior
- [ ] Step 3: Archive or relabel older active-plan references only if their scope is now superseded by this delivered work
- [ ] Step 4: Mark all completed checklist items and commit the final milestone

# Release Authn/Authz Hardening Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the highest-priority release blockers in authentication and authorization by removing client-controlled actor identity on sensitive mutations, enforcing authenticated write semantics, and hardening GraphQL surface access.

**Architecture:** Keep GraphQL Relay-first while binding all mutation actor identity to `current_scope.user` from the authenticated request context. Context boundaries (`LC.Accounts`, `LC.Social`, `LC.Content`) remain the source of domain rules, while GraphQL resolvers stay adapter-thin and enforce auth/ID decoding at the API edge.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in code before selecting next work:

1. **Lock mutation actor identity to authenticated viewer scope**: **Not implemented**.
   - Evidence: client-provided actor IDs are accepted in [lib/live_canvas_gql/social/social_mutations.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/social/social_mutations.ex), [lib/live_canvas_gql/content/content_mutations.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/content/content_mutations.ex), and [lib/live_canvas_gql/accounts/account_mutations.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/accounts/account_mutations.ex).
2. **Strict authz checks for writes**: **Partially implemented**.
   - Evidence: viewer-scoped contact mutations already require authenticated scope in [lib/live_canvas_gql/accounts/account_resolver.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/accounts/account_resolver.ex), but social/content/attach-phone write paths do not.
3. **Define mobile API auth contract (`access + refresh` lifecycle)**: **Not implemented**.
   - Evidence: GraphQL context is currently derived from session token only in [lib/live_canvas_gql/context.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/context.ex).
4. **Restrict non-production GraphiQL exposure**: **Not implemented**.
   - Evidence: `/graphiql` is always forwarded in [lib/live_canvas_gql/router.ex](/Users/admin/.codex/worktrees/067e/backend/lib/live_canvas_gql/router.ex).
5. **Add rate limiting/abuse throttles**: **Not implemented**.
   - Evidence: no limiter plug/dependency wiring in router/context paths (`rg -n "rate.?limit|throttle|hammer|ex_rated|plug_attack" lib config`).

## Progress

- [x] Task 1: Enforce viewer-scoped identity + authenticated writes for sensitive GraphQL mutations
- [x] Task 2: Add GraphQL transport auth contract for mobile token usage
- [x] Task 3: Restrict GraphiQL to explicitly allowed non-production environments
- [x] Task 4: Add rate-limit baseline for auth, mutation, and channel-join abuse paths
- [x] Task 5: Final verification and rollout notes

### Task 1: Enforce Viewer-Scoped Identity + Authenticated Writes

**Files:**
- Modify: `lib/live_canvas_gql/social/social_mutations.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/social/social_mutations_test.exs`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `test/integration/accounts_login_flow_test.exs`
- Modify: `docs/plans/2026-03-03-release-authn-authz-hardening.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests proving actor IDs are ignored/removed and auth is required
- [x] Step 2: Run focused GraphQL tests to verify RED
- [x] Step 3: Implement schema/resolver hardening to derive actor from `current_scope`
- [x] Step 4: Run focused GraphQL and integration tests to verify GREEN
- [x] Step 5: Run compile + typing checks and commit milestone

**Step 1: Add failing tests proving actor IDs are ignored/removed and auth is required**

Cover at minimum:
- `followUser` uses authenticated viewer as follower and only accepts target user ID.
- `acceptFollowRequest` uses authenticated viewer as acting/followed user and only accepts requester ID.
- `blockUser`, `muteUser`, `unmuteUser` use authenticated viewer as actor and only accept target ID.
- `createPost` uses authenticated viewer as author and rejects unauthenticated calls.
- `attachUserPhoneNumber` attaches only to authenticated viewer and rejects unauthenticated calls.
- Integration flow (`accounts_login_flow_test`) updates to viewer-scoped mutation contracts.

**Step 2: Run focused GraphQL tests to verify RED**

Run:

```bash
mix test test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/integration/accounts_login_flow_test.exs
```

Expected: FAIL because mutation input contracts and resolver auth handling still use client-provided actor IDs.

**Step 3: Implement schema/resolver hardening to derive actor from `current_scope`**

Implement:
- Remove actor ID arguments from sensitive mutation inputs and keep only target/resource arguments.
- Add authenticated-scope pattern matches in resolvers and return structured `unauthenticated` errors when scope is missing.
- Keep Relay global ID decoding for target IDs and maintain existing structured error payload shape.
- Add concise comments where resolver control flow is non-obvious (auth edge handling, actor derivation).

**Step 4: Run focused GraphQL and integration tests to verify GREEN**

Run the command from Step 2 again.

Expected: PASS for updated mutation contracts and viewer-scoped behavior.

**Step 5: Run compile + typing checks and commit milestone**

Run:

```bash
mix compile
mix typecheck
```

Then commit:

```bash
git add lib/live_canvas_gql/social/social_mutations.ex lib/live_canvas_gql/social/social_resolver.ex lib/live_canvas_gql/content/content_mutations.ex lib/live_canvas_gql/content/content_resolver.ex lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_resolver.ex test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/integration/accounts_login_flow_test.exs docs/plans/2026-03-03-release-authn-authz-hardening.md
git commit -m "feat: enforce viewer-scoped graphql write actors"
```

### Task 2: Add GraphQL Transport Auth Contract For Mobile Tokens

Define and implement the GraphQL auth transport contract so API clients can authenticate without cookie sessions.

Planned outcomes:
- Explicit bearer token extraction and validation strategy.
- Contracted precedence/fallback semantics if both bearer and session token are present.
- Error semantics for expired/revoked/invalid tokens documented and tested.

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for bearer-token GraphQL auth and precedence semantics
- [x] Step 2: Add failing tests for access-token error semantics (`invalid`/`expired`/`revoked`)
- [x] Step 3: Implement `Accounts.authenticate_access_token/1` with explicit auth error contract
- [x] Step 4: Implement bearer-first GraphQL context auth with explicit precedence/fallback semantics
- [x] Step 5: Run focused verification, update checklist progress, and commit milestone

### Task 3: Restrict GraphiQL Exposure

Gate `/graphiql` forwarding by environment/config so production defaults to disabled.

Planned outcomes:
- Config switch with secure default.
- Router behavior tests for enabled/disabled routing.

**Task 3 Step Progress:**
- [x] Step 1: Add failing route tests for enabled/disabled GraphiQL behavior
- [x] Step 2: Add runtime router config gate with production-safe default (`disabled`)
- [x] Step 3: Enable GraphiQL explicitly in development config
- [x] Step 4: Run focused verification (`graphiql` + request-context tests) and typing checks
- [x] Step 5: Update checklist progress and commit milestone

### Task 4: Add Rate-Limit Baseline For Abuse Paths

Add minimal production-safe throttles for auth and sensitive write paths.

Planned outcomes:
- Per-IP and/or per-user limits for login/session/token and selected GraphQL writes.
- Structured rate-limit responses for clients.
- Focused tests for allow/deny windows.

**Task 4 Step Progress:**
- [x] Step 1: Add failing tests for GraphQL mutation throttling, login throttling, and channel-join throttling
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement shared limiter and wire auth, GraphQL, and channel join paths
- [x] Step 4: Run focused verification to verify GREEN
- [x] Step 5: Update checklist progress with code + tests in the same milestone

### Task 5: Final Verification And Rollout Notes

After Tasks 1-4 complete:

```bash
mix compile
mix test
mix typecheck
mix precommit
```

Document rollout caveats (breaking GraphQL input changes and client migration order) before merge.

**Task 5 Step Progress:**
- [x] Step 1: Run full verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Capture rollout caveats for rate-limit defaults and client-facing 429 behavior
- [x] Step 3: Mark Task 5 complete and commit the milestone

**Rollout Notes (2026-03-03):**
- Added default throttle baselines via `LCWeb.RateLimiter`: `auth_login` `20/60s` per remote IP, `graphql_mutation` `120/60s` per remote IP, and `channel_join` `60/60s` per authenticated user.
- GraphQL mutation throttles now return HTTP `429` with `{"errors":[{"message":"rate_limited","extensions":{"code":"RATE_LIMITED"}}]}` so mobile/web clients can branch on a stable error code.
- Browser login throttles now return HTTP `429` with body `rate_limited`; web clients should map that response to a retry UX instead of generic login failure messaging.
- Live channel join throttles now return `%{reason: "rate_limited"}` in join errors; realtime clients should treat this as retryable backoff instead of authorization failure.

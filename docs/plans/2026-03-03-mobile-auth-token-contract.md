# Mobile Auth Token Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a production-ready mobile authentication token contract with explicit `access + refresh` lifecycle semantics, refresh rotation, and revocation behavior.

**Architecture:** Keep authentication domain logic in `LC.Accounts` and keep GraphQL resolver logic adapter-thin. Token issuance, authentication, rotation, and revocation semantics live in the Accounts boundary; GraphQL mutations only normalize transport input/output and bind to authenticated viewer scope where required.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in code before selecting work (do not assume checklist state):

1. **Refresh token issuance API**: **Not implemented**.
   - Evidence: `LC.Accounts` has `issue_access_token/2` but no `issue_refresh_token/*` wrapper (`lib/live_canvas/accounts.ex`).
2. **Refresh token authentication API**: **Not implemented**.
   - Evidence: `LC.Accounts` has `authenticate_access_token/1` only; no refresh-token counterpart (`lib/live_canvas/accounts.ex`).
3. **Refresh rotation API (single-use refresh semantics)**: **Not implemented**.
   - Evidence: no rotate function in accounts boundary (`rg -n "rotate.*refresh|refresh.*rotate" lib/live_canvas/accounts.ex`).
4. **Refresh revocation API**: **Not implemented**.
   - Evidence: only `delete_user_session_token/1` exists and validates `:access_token` context (`lib/live_canvas/accounts.ex`).
5. **Mobile-facing GraphQL mutation contract for token exchange/refresh/revoke**: **Not implemented**.
   - Evidence: `account_mutations.ex` only exposes register/phone/contact mutations (`lib/live_canvas_gql/accounts/account_mutations.ex`).

## Progress

- [x] Task 1: Add Accounts refresh-token lifecycle primitives (issue/authenticate/rotate/revoke)
- [ ] Task 2: Expose mobile auth token mutation contract in GraphQL
- [ ] Task 3: Verify full auth contract behavior and rollout notes

### Task 1: Add Accounts Refresh-Token Lifecycle Primitives

**Files:**
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/refresh_token_lifecycle_test.exs`
- Modify: `docs/plans/2026-03-03-mobile-auth-token-contract.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for refresh token issue/authenticate/rotate/revoke semantics
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement refresh-token lifecycle functions in `LC.Accounts` + `LC.Accounts.Tokens`
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit milestone

**Step 1: Add failing tests for refresh token lifecycle**

Cover at minimum:
- `issue_refresh_token/2` stores `:refresh_token` context and returns serializable token value.
- `authenticate_refresh_token/1` returns `{:ok, scope}` for valid refresh tokens.
- `authenticate_refresh_token/1` returns deterministic auth errors for `invalid`, `expired`, and `revoked` refresh tokens.
- `rotate_refresh_token/1` revokes old refresh token and issues a new `{access, refresh}` pair.
- `revoke_refresh_token/1` revokes the target token and returns `:ok` idempotently.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts/refresh_token_lifecycle_test.exs
```

Expected: FAIL because refresh lifecycle functions are missing.

**Step 3: Implement refresh-token lifecycle functions**

Implement in `LC.Accounts`:
- `issue_refresh_token/2`
- `authenticate_refresh_token/1`
- `rotate_refresh_token/1`
- `revoke_refresh_token/1`

Implement in `LC.Accounts.Tokens`:
- refresh token validity helper with explicit expiry window separate from access tokens.

Constraints:
- Preserve hashed-secret persistence model (`secret_hash` only).
- Keep error semantics explicit and stable (`:invalid_token | :expired_token | :revoked_token`).
- Add concise comments around non-obvious lifecycle invariants (single-use refresh rotation and revocation behavior).
- Add typespecs for all new public functions.

**Step 4: Run focused tests to verify GREEN**

Run again:

```bash
mix test test/live_canvas/accounts/refresh_token_lifecycle_test.exs
```

Expected: PASS.

**Step 5: Run compile/typecheck and commit milestone**

Run:

```bash
mix compile
mix typecheck
```

Then commit:

```bash
git add lib/live_canvas/accounts/tokens.ex lib/live_canvas/accounts.ex test/live_canvas/accounts/refresh_token_lifecycle_test.exs docs/plans/2026-03-03-mobile-auth-token-contract.md
git commit -m "feat: add refresh token lifecycle primitives"
```

### Task 2: Expose Mobile Auth Token Mutation Contract In GraphQL

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/2026-03-03-mobile-auth-token-contract.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for token issue/refresh/revoke mutations
- [ ] Step 2: Run focused GraphQL tests to verify RED
- [ ] Step 3: Implement mutation schema + resolver adapters for Task 1 APIs
- [ ] Step 4: Run focused GraphQL tests to verify GREEN
- [ ] Step 5: Run compile/typecheck, update checklist, and commit milestone

### Task 3: Verify Full Auth Contract Behavior And Rollout Notes

**Files:**
- Modify: `docs/plans/2026-03-03-mobile-auth-token-contract.md`
- Optional docs update: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run final verification (`mix test`, `mix compile`, `mix typecheck`)
- [ ] Step 2: Capture mobile contract notes (token precedence, rotation order, revoke semantics)
- [ ] Step 3: Mark plan task completion and commit final milestone

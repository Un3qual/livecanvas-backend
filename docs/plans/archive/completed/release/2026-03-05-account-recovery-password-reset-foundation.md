# Account-Recovery Password Reset Foundation Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a concrete password-reset account-recovery workflow so v1 has a first-class recovery path and auth-audit coverage can include recovery lifecycle outcomes.

**Architecture:** Extend existing `users_tokens` semantics with a dedicated `:password_reset_token` context, keep recovery operations inside `LC.Accounts`, and emit append-only auth events for recovery request/success/failure. Build the flow with additive APIs first, then expose transport-layer entrypoints.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto/PostgreSQL enums, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-05)

Verified directly in `lib/`, `test/`, and migrations before selecting this batch:

1. **Password-reset token context:** **Missing**.
   - Evidence: `LCSchemas.Accounts.UserTokenContext` does not include `:password_reset_token` (`lib/live_canvas_schemas/accounts/user_token_context.ex`).
2. **Recovery-specific Accounts APIs:** **Missing**.
   - Evidence: `LC.Accounts` has `deliver_login_instructions/2` and `update_user_password/2`, but no password-reset request/reset-by-token APIs (`lib/live_canvas/accounts.ex`).
3. **Recovery-specific auth-audit events:** **Missing**.
   - Evidence: `auth_event_type` enum lacks recovery event types (`lib/live_canvas_schemas/accounts/auth_event_type.ex`).
4. **Public recovery entrypoints (web/GraphQL):** **Missing**.
   - Evidence: no reset-password routes/controllers and no GraphQL recovery mutations (`lib/live_canvas_web/router.ex`, `lib/live_canvas_gql/accounts/account_mutations.ex`).

## Why This Is The Next Batch

The release roadmap still tracks account-recovery auth-audit expansion as deferred pending a concrete recovery workflow. Implementing password reset first closes that blocker with minimal cross-context risk and aligns with `ARCHITECTURE.md` token/recovery expectations.

## Scope And Assumptions

- Start with Accounts-domain primitives and audit coverage before transport-layer UX work.
- Keep token persistence SHA3-based through existing token infrastructure.
- Preserve additive Postgres enum evolution with reversible-noop downs.
- Keep recovery token validation strict (`sent_to` + freshness + active-user checks).

## Progress

- [x] Task 1: Add password-reset token context, Accounts recovery APIs, and recovery audit events
- [x] Task 2: Add web reset-password transport flow (request + token consume forms/controllers)
- [x] Task 3: Add GraphQL recovery mutations and relay-compatible error contracts
- [x] Task 4: Run full verification, update roadmap/index tracking, and finalize milestone

### Task 1: Recovery Primitives In Accounts (Current Batch)

**Files:**
- Create: `priv/repo/migrations/20260305010000_add_password_reset_token_context.exs`
- Create: `priv/repo/migrations/20260305011000_expand_auth_event_type_for_account_recovery_events.exs`
- Modify: `lib/live_canvas_schemas/accounts/user_token_context.ex`
- Modify: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts/tokens.ex`
- Modify: `lib/live_canvas/accounts/user_notifier.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts/user_token_test.exs`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/live_canvas/accounts/auth_event_test.exs`
- Modify: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for password-reset token issuance/delivery, token validation, reset-by-token success/failure, and recovery auth-event emissions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement enum/migration additions plus Accounts + notifier recovery APIs
- [x] Step 4: Run focused tests and migration rehearsal to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/auth_event_test.exs` -> RED first (`104 tests, 10 failures`) and GREEN after implementation (`104 tests, 0 failures`)
- `MIX_ENV=test mix ecto.migrate --quiet && MIX_ENV=test mix ecto.rollback --step 2 --quiet && MIX_ENV=test mix ecto.migrate --quiet` -> PASS
- `mix compile && mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Step 2 command:**

```bash
mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/auth_event_test.exs
```

Expected: FAIL before implementation.

**Step 4 commands:**

```bash
mix test test/live_canvas/accounts/user_token_test.exs test/live_canvas/accounts_test.exs test/live_canvas/accounts/auth_event_test.exs
MIX_ENV=test mix ecto.migrate --quiet
MIX_ENV=test mix ecto.rollback --step 2 --quiet
MIX_ENV=test mix ecto.migrate --quiet
```

Expected: PASS after implementation.

### Task 2: Web Reset-Password Transport Flow

**Files:**
- Modify: `lib/live_canvas_web/router.ex`
- Create/Modify: `lib/live_canvas_web/controllers/user_reset_password_controller.ex`
- Create/Modify: `lib/live_canvas_web/controllers/user_reset_password_html/*.heex`
- Modify: `lib/live_canvas_web/controllers/user_session_html/new.html.heex`
- Modify: `test/live_canvas_web/controllers/user_reset_password_controller_test.exs`
- Modify: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing web-controller tests for request and token-consume flows
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement reset-password request + submit flow through Accounts APIs
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix test test/live_canvas_web/controllers/user_reset_password_controller_test.exs`, update checklist, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas_web/controllers/user_reset_password_controller_test.exs` -> RED first (`9 tests, 9 failures`) and GREEN after implementation (`9 tests, 0 failures`)

### Task 3: GraphQL Recovery Mutations

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing GraphQL mutation tests for request/reset recovery behavior and errors
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement relay payloads and resolver wiring to Accounts recovery APIs
- [x] Step 4: Run focused GraphQL tests for GREEN
- [x] Step 5: Run `mix test test/live_canvas_gql/accounts/account_mutations_test.exs` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED first (`34 tests, 5 failures`) and GREEN after implementation (`34 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 4: Final Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/release/2026-03-05-account-recovery-password-reset-foundation.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`

**Task 4 Step Progress:**
- [x] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Update roadmap planning-hole notes for recovery workflow delivery
- [x] Step 3: Mark completed checklist items and commit final milestone

Verification evidence (2026-03-05):

- `mix compile` -> PASS
- `mix test` -> PASS (`411 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)
- `mix precommit` -> PASS (after one transient rerun of a flaky live-session heartbeat test)

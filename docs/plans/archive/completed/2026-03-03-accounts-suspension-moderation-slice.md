# Accounts Suspension Moderation Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the first architecture-aligned moderation flag by adding account suspension state and enforcing it across authentication/session lookup flows.

**Architecture:** `LC.Accounts` owns account-level moderation flags on `users`. Adapter layers (`LCWeb`, `LCGQL`) stay thin and inherit suspension behavior through existing `Accounts` APIs instead of adding transport-specific branching.

**Tech Stack:** Elixir 1.15+, Ecto, PostgreSQL, ExUnit, Dialyzer

---

## Status Verification Snapshot (2026-03-03)

- Verified complete in code:
  - Account-level privacy mode exists on `users` (`privacy_mode`).
  - Relationship moderation exists in `Social` (`blocks`, `mutes`).
- Verified incomplete in code:
  - `users` has no moderation timestamp/flag field.
  - `LC.Accounts` exposes no public suspend/unsuspend APIs.
  - Authentication/session lookups do not reject suspended users.

## Progress

- [x] Task 1: Add `users.suspended_at` persistence and `LC.Accounts` moderation APIs
- [x] Task 2: Enforce suspension in session and login lookup APIs
- [x] Task 3: Run focused verification, update checklist progress, and commit milestone

### Task 1: Add `users.suspended_at` Persistence And `LC.Accounts` Moderation APIs

**Files:**
- Create: `priv/repo/migrations/TIMESTAMP_add_users_suspended_at.exs`
- Modify: `lib/live_canvas_schemas/accounts/user.ex`
- Modify: `lib/live_canvas/accounts/user_changes.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `docs/plans/2026-03-03-accounts-suspension-moderation-slice.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for suspend/unsuspend/suspended? APIs
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement migration, schema field, changesets, and Accounts APIs
- [x] Step 4: Run test DB migration
- [x] Step 5: Run focused tests to verify GREEN

**Step 1: Add failing tests for suspend/unsuspend/suspended? APIs**

Add tests that define the public contract:
- `suspend_user/1` sets `suspended_at` with microsecond precision.
- `unsuspend_user/1` clears `suspended_at` and is idempotent.
- `suspended?/1` returns live DB-backed moderation state.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts_test.exs
```

Expected: FAIL for missing moderation APIs.

**Step 3: Implement migration, schema field, changesets, and Accounts APIs**

Implement:
- Additive `users.suspended_at :utc_datetime_usec` migration (+ index).
- `LCSchemas.Accounts.User` field/type update for `suspended_at`.
- `UserChanges.suspend_changeset/2` and `UserChanges.unsuspend_changeset/1`.
- `LC.Accounts` public APIs:
  - `suspend_user/1`
  - `unsuspend_user/1`
  - `suspended?/1`

Implementation notes:
- Keep writes in `LC.Accounts`; keep schemas data-only.
- Add concise comments only where DB-backed moderation checks are non-obvious.

**Step 4: Run test DB migration**

Run:

```bash
MIX_ENV=test mix ecto.migrate
```

Expected: migration applies cleanly.

**Step 5: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/accounts_test.exs
```

Expected: PASS for new moderation API coverage.

### Task 2: Enforce Suspension In Session And Login Lookup APIs

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts_test.exs`
- Modify: `test/live_canvas_web/user_auth_test.exs`
- Modify: `docs/plans/2026-03-03-accounts-suspension-moderation-slice.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing auth/session tests for suspended users
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Enforce suspended-user rejection in Accounts login/session getters
- [x] Step 4: Run focused tests to verify GREEN

**Step 1: Add failing auth/session tests for suspended users**

Add coverage for:
- `get_user_by_email_and_password/2` returns `nil` for suspended users.
- `get_user_by_magic_link_token/1` returns `nil` for suspended users.
- `get_user_by_session_token/1` returns `nil` for suspended users.
- `UserAuth.fetch_current_scope_for_user/2` leaves scope empty when token belongs to a suspended user.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs
```

Expected: FAIL because suspended-user gating is not implemented in auth/session lookups.

**Step 3: Enforce suspended-user rejection in Accounts login/session getters**

Implement:
- A shared private predicate for active (non-suspended) account checks.
- Apply the predicate in:
  - `get_user_by_email_and_password/2`
  - `get_user_by_magic_link_token/1`
  - `get_user_by_session_token/1`

Implementation notes:
- Keep behavior adapter-transparent so Phoenix and GraphQL flows inherit gating automatically.
- Preserve existing return shapes (`nil` for denied/invalid lookups).

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs
```

Expected: PASS with suspended-user auth/session denial behavior.

### Task 3: Final Verification And Milestone Commit

**Files:**
- Modify: `docs/plans/2026-03-03-accounts-suspension-moderation-slice.md`
- Verify: `lib/live_canvas/accounts.ex`
- Verify: `lib/live_canvas/accounts/user_changes.ex`
- Verify: `lib/live_canvas_schemas/accounts/user.ex`
- Verify: `test/live_canvas/accounts_test.exs`
- Verify: `test/live_canvas_web/user_auth_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Mark completed checklist items in this plan file
- [x] Step 2: Run required verification commands
- [x] Step 3: Commit code, tests, and plan updates together

**Step 2: Run required verification commands**

Run:

```bash
mix test test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs
mix typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add priv/repo/migrations lib/live_canvas/accounts.ex lib/live_canvas/accounts/user_changes.ex lib/live_canvas_schemas/accounts/user.ex test/live_canvas/accounts_test.exs test/live_canvas_web/user_auth_test.exs docs/plans/2026-03-03-accounts-suspension-moderation-slice.md
git commit -m "feat: add account suspension moderation gates"
```

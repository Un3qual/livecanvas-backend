# Auth Audit Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand auth audit coverage to additional high-risk identity lifecycle outcomes so security and release operations can inspect refresh-token rotation and credential-management behavior.

**Architecture:** Keep all audit persistence inside `LC.Accounts` using the existing append-only `auth_events` table and best-effort write semantics. Extend the auth event enum and the Accounts boundary API surface only where needed for durable, queryable lifecycle outcomes, while preserving current auth success/failure behavior for callers.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, PostgreSQL, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in `lib/`, `test/`, and `priv/repo/migrations` before selecting this plan:

1. **Refresh-token rotation success/failure audit events**: **Not implemented**.
   - Evidence: `rotate_refresh_token/1` has no `emit_auth_event/2` call (`lib/live_canvas/accounts.ex`), and auth event enum contains no rotation event types (`lib/live_canvas_schemas/accounts/auth_event_type.ex`).
2. **Credential-change audit events (password change / email change confirmation)**: **Not implemented**.
   - Evidence: `update_user_password/2` and `update_user_email/2` contain no auth audit emission (`lib/live_canvas/accounts.ex`).
3. **Coverage for expanded auth lifecycle audit emissions**: **Not implemented**.
   - Evidence: existing auth audit tests cover password login, magic-link login, and refresh revoke only (`test/live_canvas/accounts/auth_event_test.exs`).

## Progress

- [x] Task 1: Add refresh-token rotation audit events and focused coverage
- [x] Task 2: Add credential-change audit events for password/email lifecycle paths
- [ ] Task 3: Run verification, update release roadmap notes, and commit final milestone

### Task 1: Add Refresh-Token Rotation Audit Events

**Files:**
- Create: `priv/repo/migrations/20260303213000_expand_auth_event_type_for_rotation_events.exs`
- Modify: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/auth_event_test.exs`
- Modify: `docs/plans/release/2026-03-03-auth-audit-expansion.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for refresh-token rotation success/failure audit emissions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement enum + migration + Accounts rotation emission hooks
- [x] Step 4: Rebuild test DB as needed and run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Step 1: Add failing tests**

Add tests that prove:
- successful `rotate_refresh_token/1` emits `:refresh_token_rotation_succeeded` for the acting user.
- failed `rotate_refresh_token/1` emits `:refresh_token_rotation_failed` with non-secret metadata (reason only).

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts/auth_event_test.exs
```

Expected: FAIL because rotation event enum values and emission hooks do not exist.

**Step 3: Implement minimal rotation audit expansion**

Implement:
- New auth event enum values:
  - `:refresh_token_rotation_succeeded`
  - `:refresh_token_rotation_failed`
- Add migration that extends Postgres `auth_event_type` with these values.
- Emit rotation success event when `rotate_refresh_token/1` returns a fresh token pair.
- Emit rotation failure event for invalid/revoked/expired rotation attempts.

Constraints:
- Do not log raw token values or hashes.
- Keep auth flow behavior unchanged for callers.
- Keep audit writes best-effort and non-blocking.
- Add concise comments where lifecycle/audit invariants are non-obvious.

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
MIX_ENV=test mix ecto.migrate --quiet
mix test test/live_canvas/accounts/auth_event_test.exs \
  test/live_canvas/accounts/refresh_token_lifecycle_test.exs
```

Expected: PASS.

**Step 5: Compile/typecheck and commit milestone**

Run:

```bash
mix compile
mix typecheck
```

Then commit:

```bash
git add priv/repo/migrations/20260303213000_expand_auth_event_type_for_rotation_events.exs \
  lib/live_canvas_schemas/accounts/auth_event_type.ex \
  lib/live_canvas_schemas/accounts.ex \
  lib/live_canvas/accounts.ex \
  test/live_canvas/accounts/auth_event_test.exs \
  docs/plans/release/2026-03-03-auth-audit-expansion.md
git commit -m "feat: audit refresh token rotation outcomes"
```

### Task 2: Add Credential-Change Auth Audit Events

**Files:**
- Create: `priv/repo/migrations/20260303220000_expand_auth_event_type_for_credential_events.exs`
- Modify: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/auth_event_test.exs`
- Test: `test/live_canvas/accounts_test.exs`
- Modify: `docs/plans/release/2026-03-03-auth-audit-expansion.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for password-change and email-change audit emissions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement audit emissions in credential lifecycle paths
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run compile/typecheck, update checklist, and commit milestone

### Task 3: Final Verification And Release Tracking

**Files:**
- Modify: `docs/plans/release/2026-03-03-auth-audit-expansion.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run final verification (`mix test`, `mix compile`, `mix typecheck`)
- [ ] Step 2: Update roadmap planning-holes/blocker notes for delivered expansion scope
- [ ] Step 3: Mark plan tasks complete and commit final milestone

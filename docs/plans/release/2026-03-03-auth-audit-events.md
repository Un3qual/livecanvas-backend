# Auth Audit Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add durable, queryable auth security audit events for high-risk authentication paths so release operations can inspect login and token lifecycle behavior.

**Architecture:** Keep event persistence in the `LC.Accounts` boundary with schema-only data modules under `LCSchemas.Accounts`. Use a dedicated append-only relational table (`bigint + entropy_id`) and account-facing write/read APIs, then wire sensitive auth paths to emit events without leaking secrets.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, Absinthe, PostgreSQL, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in `lib/`, `test/`, and `priv/repo/migrations` before selecting this work:

1. **Durable auth audit event table**: **Not implemented**.
   - Evidence: no `auth_events` migration/schema/modules (`rg -n "auth_events|auth audit|auth_event" lib test priv/repo/migrations`).
2. **Accounts API for recording/listing auth security events**: **Not implemented**.
   - Evidence: no `record_auth_event` or equivalent in `LC.Accounts` (`rg -n "record.*auth|audit.*event|list.*auth.*event" lib/live_canvas/accounts.ex`).
3. **Sensitive auth paths emit audit records**: **Not implemented**.
   - Evidence: password login, magic-link login, and refresh revocation flows in `LC.Accounts`/`LCWeb.UserSessionController` have no audit writes.
4. **Coverage for auth audit persistence + emission behavior**: **Not implemented**.
   - Evidence: no tests asserting persisted auth event rows (`rg -n "auth event|audit" test/live_canvas test/live_canvas_web test/integration`).

## Progress

- [x] Task 1: Add auth audit event persistence primitives (schema, migration, Accounts APIs)
- [x] Task 2: Emit audit events from sensitive login and token revocation paths
- [ ] Task 3: Run verification, update release roadmap notes, and commit final milestone

### Task 1: Add Auth Audit Event Persistence Primitives

**Files:**
- Create: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Create: `lib/live_canvas_schemas/accounts/auth_event.ex`
- Create: `lib/live_canvas/accounts/auth_event.ex`
- Create: `priv/repo/migrations/20260303200000_create_auth_events.exs`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/auth_event_test.exs`
- Modify: `docs/plans/release/2026-03-03-auth-audit-events.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for auth event persistence and listing APIs
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement enum/schema/migration and minimal `LC.Accounts` APIs
- [x] Step 4: Rebuild test DB and run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Step 1: Add failing tests for persistence/listing APIs**

Add tests that prove:
- `record_auth_event/2` persists a row with `event_type`, `metadata`, `user_id`, and generated `entropy_id`.
- `record_auth_event/2` supports anonymous events (`user_id` omitted) for failed auth attempts.
- `list_user_auth_events/2` returns newest-first records and honors explicit `:limit`.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts/auth_event_test.exs
```

Expected: FAIL because API and schema do not exist yet.

**Step 3: Implement minimal persistence primitives**

Implement:
- New enum `LCSchemas.Accounts.AuthEventType` with initial values:
  - `:password_login_succeeded`
  - `:password_login_failed`
  - `:magic_link_login_succeeded`
  - `:magic_link_login_failed`
  - `:refresh_token_revoked`
- New schema `LCSchemas.Accounts.AuthEvent`:
  - `id` bigint PK
  - `entropy_id` UUIDv7 default in Postgres
  - nullable `user_id` FK to `users`
  - `event_type` enum
  - `metadata` map (default `%{}`)
  - `timestamps(type: :utc_datetime_usec, updated_at: false)`
- New boundary-local changeset module `LC.Accounts.AuthEvent`.
- New public `LC.Accounts` APIs:
  - `record_auth_event/2`
  - `list_user_auth_events/2`

Constraints:
- No token secrets/passwords in metadata.
- Add concise comments where invariants are non-obvious.
- Keep public APIs typespec’d.

**Step 4: Rebuild test DB and run focused tests to verify GREEN**

Run:

```bash
MIX_ENV=test mix ecto.drop --quiet
MIX_ENV=test mix ecto.create --quiet
MIX_ENV=test mix ecto.migrate --quiet
mix test test/live_canvas/accounts/auth_event_test.exs
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
git add lib/live_canvas_schemas/accounts/auth_event_type.ex \
  lib/live_canvas_schemas/accounts/auth_event.ex \
  lib/live_canvas/accounts/auth_event.ex \
  lib/live_canvas_schemas/accounts.ex \
  lib/live_canvas_schemas.ex \
  lib/live_canvas/accounts.ex \
  priv/repo/migrations/20260303200000_create_auth_events.exs \
  test/live_canvas/accounts/auth_event_test.exs \
  docs/plans/release/2026-03-03-auth-audit-events.md
git commit -m "feat: add auth audit event persistence primitives"
```

### Task 2: Emit Audit Events For Sensitive Auth Paths

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/auth_event_test.exs`
- Modify: `docs/plans/release/2026-03-03-auth-audit-events.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for password/magic-link login and refresh revoke event emission
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Emit auth audit events in `LC.Accounts` login and revocation code paths
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit milestone

**Step 1: Add failing event-emission tests**

Cover:
- successful password login emits `:password_login_succeeded`.
- failed password login emits `:password_login_failed` without leaking raw password.
- successful magic-link login emits `:magic_link_login_succeeded`.
- failed magic-link login emits `:magic_link_login_failed`.
- `revoke_refresh_token/1` emits `:refresh_token_revoked` only when a matching token is actually revoked.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/accounts/auth_event_test.exs
```

Expected: FAIL because emission hooks are missing.

**Step 3: Implement emission hooks**

In `LC.Accounts`:
- Emit events directly in domain paths where outcomes are known.
- Ensure audit-write failures never crash user-facing auth behavior:
  - swallow audit write errors after best-effort insert
  - keep auth semantics unchanged
- Add short comments around this non-blocking audit invariant.

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/accounts/auth_event_test.exs \
  test/live_canvas/accounts/access_token_auth_test.exs \
  test/live_canvas/accounts/refresh_token_lifecycle_test.exs \
  test/live_canvas/accounts_test.exs
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
git add lib/live_canvas/accounts.ex \
  test/live_canvas/accounts/auth_event_test.exs \
  docs/plans/release/2026-03-03-auth-audit-events.md
git commit -m "feat: emit auth audit events for login and token revocation"
```

### Task 3: Final Verification And Release Tracking Notes

**Files:**
- Modify: `docs/plans/release/2026-03-03-auth-audit-events.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run final verification (`mix test`, `mix compile`, `mix typecheck`, `mix precommit`)
- [ ] Step 2: Update roadmap "planning holes/blockers" notes to reflect delivered auth audit baseline
- [ ] Step 3: Mark tasks complete and commit final milestone

**Step 1: Run final verification**

Run:

```bash
mix test
mix compile
mix typecheck
mix precommit
```

Expected: all PASS.

**Step 2: Update roadmap notes**

Update release roadmap status:
- remove/adjust the auth-audit-events gap under planning holes
- note current scope delivered (login + token revocation baseline; credential unlink still pending if not implemented)

**Step 3: Commit**

```bash
git add docs/plans/release/2026-03-03-auth-audit-events.md \
  docs/plans/2026-03-03-backend-release-readiness-roadmap.md
git commit -m "docs: update release roadmap for auth audit event baseline"
```

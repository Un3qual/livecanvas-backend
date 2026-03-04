# Auth Audit Provider/Recovery Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand auth audit coverage for provider-identity unlink lifecycle outcomes, and document the remaining account-recovery audit gap so launch-readiness tracking stays explicit.

**Architecture:** Extend the existing append-only `auth_events` model in `LC.Accounts` with provider unlink event types and best-effort emissions. Add a viewer-scoped GraphQL unlink mutation that revokes a linked identity via Accounts boundary APIs and keeps Relay/global-ID contracts intact. Keep account-recovery scope explicit by tracking it as deferred until a concrete recovery workflow enters v1 scope.

**Tech Stack:** Elixir 1.15, Phoenix, Ecto, PostgreSQL, Absinthe Relay, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-04)

Verified directly in `lib/`, `test/`, `priv/repo/migrations`, `ARCHITECTURE.md`, and active plans before selecting this batch:

1. **Provider identity unlink workflow + auth audit events:** **Not implemented**.
   - Evidence: `LC.Accounts` has `register_user_identity/4` but no unlink/revoke API that emits auth events (`lib/live_canvas/accounts.ex`).
   - Evidence: GraphQL schema exposes identity reads but no unlink mutation (`lib/live_canvas_gql/accounts/account_mutations.ex`).
   - Evidence: auth event enum has no provider unlink types (`lib/live_canvas_schemas/accounts/auth_event_type.ex`).
2. **Account recovery-specific auth audit events:** **Not implemented and currently out of concrete scope**.
   - Evidence: no account-recovery workflow boundary API exists today (no password-reset/account-recovery handler paths in `LC.Accounts`), so there is no concrete recovery lifecycle to instrument yet.
3. **Compliance hard-delete follow-up candidate:** **Intentionally paused by operator direction in this session**.
   - Evidence: roadmap still tracks this as a follow-up (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Progress

- [x] Task 1: Add provider identity unlink audit primitives in Accounts
- [x] Task 2: Expose viewer-scoped Relay unlink mutation and active-identity query semantics
- [x] Task 3: Run verification, refresh roadmap/plan index, and record compliance pause state

### Task 1: Add Provider Identity Unlink Audit Primitives In Accounts

**Files:**
- Create: `priv/repo/migrations/20260304040000_expand_auth_event_type_for_provider_unlink_events.exs`
- Modify: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Test: `test/live_canvas/accounts/auth_event_test.exs`
- Test: `test/live_canvas/accounts_test.exs`
- Modify: `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for identity unlink success/failure/repeat behavior and auth telemetry/audit emissions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement enum + migration + Accounts unlink API with best-effort auth event emission
- [x] Step 4: Run focused tests and migration rehearsal to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

### Task 2: Add Viewer-Scoped Relay Identity Unlink Mutation

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Test: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Test: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL tests for viewer-owned unlink success, invalid node IDs, and unauthorized/unowned identity behavior
- [x] Step 2: Run focused GraphQL tests to verify RED
- [x] Step 3: Implement mutation schema + resolver decode/ownership checks + Accounts handoff
- [x] Step 4: Ensure identity listings and lookups expose only active identities after unlink; run focused tests for GREEN
- [x] Step 5: Run `mix test` on Accounts/GraphQL slices + `mix typecheck`, update checklist progress, and commit milestone

### Task 3: Final Verification, Roadmap Tracking, And Pause Documentation

**Files:**
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/release/2026-03-04-auth-audit-provider-recovery-expansion.md`

**Task 3 Step Progress:**
- [x] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Update roadmap and plan index with delivered provider unlink audit scope and explicit compliance-hard-delete pause note
- [x] Step 3: Keep account-recovery audit expansion tracked as deferred until a concrete recovery workflow enters scope
- [x] Step 4: Mark completed checklist items and commit final milestone

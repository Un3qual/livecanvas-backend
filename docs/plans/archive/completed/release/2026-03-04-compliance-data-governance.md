# Compliance Data Governance Baseline Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a v1-ready compliance baseline for retention/deletion/export by adding explicit policy docs plus enforceable backend workflows for export requests, account deletion requests, and retention cleanup.

**Architecture:** Keep policy decisions versioned in `docs/release/`, and implement execution paths in additive `LC.Infra.DataGovernance` modules plus viewer-scoped `LC.Accounts` entrypoints. Reuse `LC.Infra.AsyncJobs` for asynchronous export/deletion orchestration, and keep GraphQL relay-first with node/global IDs for governance request resources.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, Absinthe Relay, Phoenix, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-04)

Verified before selecting this plan so we do not assume missing implementation from checklist state alone:

1. **Retention/deletion/export policy plan artifact:** **Was missing at selection time**.
   - Evidence: roadmap tracked compliance/data-governance as an open planning hole before this plan was created (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).
2. **Data export request API/workflow:** **Missing**.
   - Evidence: accounts GraphQL surfaces do not expose export request mutations/queries (`lib/live_canvas_gql/accounts/account_queries.ex`, `lib/live_canvas_gql/accounts/account_mutations.ex`).
3. **Account deletion request workflow:** **Missing**.
   - Evidence: account flows currently cover auth/session token deletion and logout only; no account-erasure request lifecycle exists (`lib/live_canvas/accounts.ex`, `lib/live_canvas_web/user_auth.ex`).
4. **Retention policy enforcement jobs:** **Missing/underspecified**.
   - Evidence: roadmap still marks chat/live retention decisions unresolved; no governance retention sweeper exists (`ARCHITECTURE.md`, `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Why This Is The Next Batch

`ARCHITECTURE.md` identifies chat retention and durable state boundaries as first-class concerns, and the release roadmap explicitly marks compliance/data-governance as an open planning hole. Closing this gap next unblocks launch-readiness operations work without risky late-stage policy decisions.

## Scope And Assumptions

- Scope this slice to governance primitives needed for v1 launch readiness: policy matrix, export/deletion request lifecycles, and retention sweeper baseline.
- Keep destructive operations asynchronous and idempotent; hard deletion execution is intentionally stubbed in this milestone.
- Keep request APIs viewer-scoped and non-admin for v1.
- Prefer additive schema/migration changes and keep existing domain behavior intact.
- Use `:utc_datetime_usec` timestamps and bigint + `:entropy_id` UUIDv7 on new relational tables per conventions.

## Progress

- [x] Task 1: Author compliance policy matrix and operator runbook
- [x] Task 2: Add data-governance persistence primitives and schemas
- [x] Task 3: Add viewer-scoped data export request workflow (context + GraphQL + async handler)
- [x] Task 4: Add viewer-scoped account deletion request workflow (context + GraphQL + async handler)
- [x] Task 5: Add retention sweeper baseline for operational tables
- [x] Task 6: Run full verification, close roadmap planning hole, and finalize milestone

### Task 1: Compliance Policy Matrix And Runbook

**Files:**
- Create: `docs/release/compliance-data-governance.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`
- Modify: `README.md`

**Task 1 Step Progress:**
- [x] Step 1: Draft policy matrix covering each durable table family (accounts, social, content, live, chat, infra)
- [x] Step 2: Define retention/deletion/export rules per data family, including legal-hold placeholder semantics
- [x] Step 3: Add operator workflow for export/deletion fulfillment and retention sweeper execution
- [x] Step 4: Link the runbook from `README.md` and roadmap evidence notes
- [x] Step 5: Run markdown checks (if available), update checklist, and commit milestone

**Task 1 policy targets:**
- Explicit retention windows for `auth_events`, `webhook_events`, `async_jobs`, and chat/live participation records.
- Clear split between user-initiated deletion, automatic retention purge, and operational rollback procedures.
- Export scope list of user-owned entities, with explicit exclusions and rationale.

**Step 5 commit:**

```bash
git add docs/release/compliance-data-governance.md \
  docs/plans/2026-03-03-backend-release-readiness-roadmap.md \
  docs/plans/release/2026-03-04-compliance-data-governance.md \
  README.md
git commit -m "docs: define compliance data governance policy baseline"
```

### Task 2: Persistence Primitives For Governance Requests

**Files:**
- Create: `priv/repo/migrations/<timestamp>_create_data_governance_requests.exs`
- Create: `lib/live_canvas_schemas/infra/data_export_request.ex`
- Create: `lib/live_canvas_schemas/infra/account_deletion_request.ex`
- Create: `lib/live_canvas_schemas/infra/data_export_request_status.ex`
- Create: `lib/live_canvas_schemas/infra/account_deletion_request_status.ex`
- Modify: `lib/live_canvas_schemas/infra.ex`
- Modify: `lib/live_canvas_schemas.ex`
- Create: `test/live_canvas_schemas/infra/data_governance_request_schema_test.exs`
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing schema tests for constraints, defaults, and UUIDv7 entropy IDs
- [x] Step 2: Run focused schema tests to verify RED
- [x] Step 3: Implement migration + schema modules (including status enum evolution migration-safe pattern)
- [x] Step 4: Run focused tests and `mix ecto.migrate`/`mix ecto.rollback` rehearsal for GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-04):

- `mix test test/live_canvas_schemas/infra/data_governance_request_schema_test.exs` -> RED (`5 tests, 5 failures`) before implementation
- `MIX_ENV=test mix ecto.migrate --quiet` -> PASS
- `MIX_ENV=test mix ecto.rollback --step 1 --quiet` -> PASS
- `MIX_ENV=test mix ecto.migrate --quiet` -> PASS
- `mix test test/live_canvas_schemas/infra/data_governance_request_schema_test.exs` -> PASS (`5 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Task 2 schema targets:**
- `data_export_requests`: `id`, `entropy_id`, `user_id`, `status`, `format`, `requested_at`, `completed_at`, `failure_reason`, timestamps.
- `account_deletion_requests`: `id`, `entropy_id`, `user_id`, `status`, `requested_at`, `scheduled_purge_at`, `completed_at`, `failure_reason`, timestamps.
- Indexes for `(user_id, inserted_at)` and uniqueness on `entropy_id`.

**Step 5 commit:**

```bash
git add priv/repo/migrations/*_create_data_governance_requests.exs \
  lib/live_canvas_schemas/infra/data_export_request.ex \
  lib/live_canvas_schemas/infra/account_deletion_request.ex \
  lib/live_canvas_schemas/infra/data_export_request_status.ex \
  lib/live_canvas_schemas/infra/account_deletion_request_status.ex \
  lib/live_canvas_schemas/infra.ex \
  lib/live_canvas_schemas.ex \
  test/live_canvas_schemas/infra/data_governance_request_schema_test.exs \
  docs/plans/release/2026-03-04-compliance-data-governance.md
git commit -m "feat: add data governance request persistence primitives"
```

### Task 3: Data Export Request Workflow

**Files:**
- Create: `lib/live_canvas/infra/data_governance.ex`
- Create: `lib/live_canvas/infra/data_governance/export.ex`
- Create: `priv/repo/migrations/20260304020000_add_artifact_metadata_to_data_export_requests.exs`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_schemas/infra/data_export_request.ex`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_queries.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Create: `test/live_canvas/infra/data_governance_export_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing context/GraphQL tests for export request creation, deduping, and request listing
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement viewer-scoped request API + async-job enqueue path + relay node exposure
- [x] Step 4: Run focused tests and integration smoke checks to verify GREEN
- [x] Step 5: Run `mix test` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-04):

- `mix test test/live_canvas/infra/data_governance_export_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED (`25 tests, 6 failures`) before implementation
- `mix test test/live_canvas/infra/data_governance_export_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> GREEN (`25 tests, 0 failures`) after implementation
- `mix test` -> PASS (`356 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Task 3 behavior targets:**
- Authenticated viewer can submit an export request; request is persisted and queued exactly once per active pending request.
- GraphQL returns relay-compatible node/connection for viewer's own export requests.
- Async handler persists completion/failure state and stores artifact reference metadata (not raw binary payload in Postgres).

**Step 5 commit:**

```bash
git add lib/live_canvas/infra/data_governance.ex \
  lib/live_canvas/infra/data_governance/export.ex \
  priv/repo/migrations/20260304020000_add_artifact_metadata_to_data_export_requests.exs \
  lib/live_canvas/infra.ex \
  lib/live_canvas/accounts.ex \
  lib/live_canvas_schemas/infra/data_export_request.ex \
  config/config.exs \
  lib/live_canvas_gql/accounts/account_mutations.ex \
  lib/live_canvas_gql/accounts/account_queries.ex \
  lib/live_canvas_gql/accounts/account_resolver.ex \
  lib/live_canvas_gql/accounts/account_types.ex \
  lib/live_canvas_gql/schema.ex \
  test/live_canvas/infra/data_governance_export_test.exs \
  test/live_canvas_gql/accounts/account_mutations_test.exs \
  docs/plans/release/2026-03-04-compliance-data-governance.md
git commit -m "feat: add viewer-scoped data export request workflow"
```

### Task 4: Account Deletion Request Workflow

**Files:**
- Create: `lib/live_canvas/infra/data_governance/deletion.ex`
- Create: `priv/repo/migrations/20260304030000_expand_auth_event_type_for_account_deletion_events.exs`
- Modify: `lib/live_canvas/infra/data_governance.ex`
- Modify: `lib/live_canvas/infra.ex`
- Modify: `config/config.exs`
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts.ex`
- Modify: `lib/live_canvas_schemas/accounts/auth_event_type.ex`
- Modify: `lib/live_canvas_gql/accounts/account_mutations.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Create: `test/live_canvas/infra/data_governance_deletion_test.exs`
- Modify: `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`

**Task 4 Step Progress:**
- [x] Step 1: Add failing tests for deletion request creation, cancellation guardrails, and completion state transitions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement deletion request lifecycle + async executor with idempotent table purge ordering
- [x] Step 4: Run focused tests and integration smoke checks for GREEN
- [x] Step 5: Run `mix test` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-04):

- `mix test test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> RED (`28 tests, 6 failures`) before implementation
- `mix test test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs` -> GREEN (`28 tests, 0 failures`) after implementation
- `mix test` -> PASS (`362 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Task 4 behavior targets:**
- Viewer can request account deletion; workflow schedules purge after policy-defined grace period.
- Deletion executor records deterministic purge intent but keeps hard deletion stubbed for now, while still recording status transitions.
- Auth events record deletion request and completion outcomes (including failures) with safe metadata only.

**Step 5 commit:**

```bash
git add lib/live_canvas/infra/data_governance/deletion.ex \
  priv/repo/migrations/20260304030000_expand_auth_event_type_for_account_deletion_events.exs \
  lib/live_canvas/infra/data_governance.ex \
  lib/live_canvas/infra.ex \
  config/config.exs \
  lib/live_canvas/accounts.ex \
  lib/live_canvas_schemas/accounts.ex \
  lib/live_canvas_schemas/accounts/auth_event_type.ex \
  lib/live_canvas_gql/accounts/account_mutations.ex \
  lib/live_canvas_gql/accounts/account_resolver.ex \
  lib/live_canvas_gql/accounts/account_types.ex \
  lib/live_canvas_gql/schema.ex \
  test/live_canvas/infra/data_governance_deletion_test.exs \
  test/live_canvas_gql/accounts/account_mutations_test.exs \
  docs/plans/release/2026-03-04-compliance-data-governance.md
git commit -m "feat: add account deletion request governance workflow"
```

### Task 5: Retention Sweeper Baseline

**Files:**
- Create: `lib/live_canvas/infra/data_governance/retention.ex`
- Create: `lib/mix/tasks/release.retention_sweep.ex`
- Modify: `mix.exs`
- Modify: `lib/live_canvas/infra/data_governance/deletion.ex`
- Modify: `lib/live_canvas/infra/data_governance.ex`
- Modify: `lib/live_canvas/infra.ex`
- Create: `test/live_canvas/infra/data_governance_retention_test.exs`
- Create: `test/live_canvas/release/retention_sweep_task_test.exs`
- Modify: `test/live_canvas/infra/data_governance_deletion_test.exs`
- Modify: `docs/release/compliance-data-governance.md`
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`

**Task 5 Step Progress:**
- [x] Step 1: Add failing tests for cutoff calculation, dry-run reporting, and deletion ordering
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement retention sweeper module + mix task wrapper (`--dry-run`, `--apply`, `--cutoff-days`)
- [x] Step 4: Run focused tests and task command checks for GREEN
- [x] Step 5: Run `mix compile` + `mix test` + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-04):

- `mix test test/live_canvas/infra/data_governance_retention_test.exs test/live_canvas/release/retention_sweep_task_test.exs test/live_canvas/infra/data_governance_deletion_test.exs` -> RED (`11 tests, 9 failures`) before implementation
- `mix test test/live_canvas/infra/data_governance_retention_test.exs test/live_canvas/release/retention_sweep_task_test.exs test/live_canvas/infra/data_governance_deletion_test.exs` -> GREEN (`11 tests, 0 failures`) after implementation
- `mix compile && mix test && mix typecheck` -> PASS (`370 tests, 0 failures`; `Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Task 5 retention targets:**
- Initial enforced families: `auth_events`, `async_jobs` terminal rows, `webhook_events` terminal rows.
- Dry-run prints per-table candidate counts and cutoff timestamp in UTC.
- Apply mode is explicit and fail-fast if safeguards/arguments are invalid, but hard deletion remains stubbed and non-destructive.

**Step 5 commit:**

```bash
git add lib/live_canvas/infra/data_governance/retention.ex \
  lib/mix/tasks/release.retention_sweep.ex \
  mix.exs \
  lib/live_canvas/infra/data_governance/deletion.ex \
  lib/live_canvas/infra/data_governance.ex \
  lib/live_canvas/infra.ex \
  test/live_canvas/infra/data_governance_retention_test.exs \
  test/live_canvas/release/retention_sweep_task_test.exs \
  test/live_canvas/infra/data_governance_deletion_test.exs \
  docs/release/compliance-data-governance.md \
  docs/plans/release/2026-03-04-compliance-data-governance.md
git commit -m "feat: add release retention sweep baseline"
```

### Task 6: Final Verification And Roadmap Alignment

**Files:**
- Modify: `docs/plans/release/2026-03-04-compliance-data-governance.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`

**Task 6 Step Progress:**
- [x] Step 1: Run full verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Update roadmap planning-hole notes and active-plan index to reflect compliance gap closure and remaining gaps
- [x] Step 3: Mark all completed checklist items and commit final milestone

Verification evidence (2026-03-04):

- `mix compile && mix test && mix typecheck && mix precommit` -> PASS (`370 tests, 0 failures`; `Total errors: 0`)
- `mix test test/live_canvas/live_test.exs` -> PASS (`14 tests, 0 failures`) after hardening telemetry assertions to match expected IDs directly.

**Step 1 command set:**

```bash
mix compile
mix test
mix typecheck
mix precommit
```

Expected: all PASS.

**Step 3 commit:**

```bash
git add docs/plans/release/2026-03-04-compliance-data-governance.md \
  docs/plans/2026-03-03-backend-release-readiness-roadmap.md \
  docs/plans/README.md
git commit -m "chore: finalize compliance data governance implementation plan"
```

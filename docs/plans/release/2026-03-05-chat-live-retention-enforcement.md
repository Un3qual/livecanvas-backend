# Chat And Live Retention Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining release-roadmap gap for chat/live retention enforcement by extending `mix release.retention_sweep` coverage to `chat_messages` and `live_participants` while keeping apply mode non-destructive in this slice.

**Architecture:** Extend `LC.Infra.DataGovernance.Retention` family coverage and query logic so communication-domain retention candidates are visible in governance sweeps. Keep retention execution model unchanged (`dry_run` + stubbed `apply`) and preserve command compatibility for operators.

**Tech Stack:** Elixir 1.15, Ecto, Mix tasks, ExUnit

---

## Candidate Status Verification (2026-03-05)

Verified directly in active plans, docs, code, and tests before selecting this batch:

1. **Multi-node partition/rejoin drills:** **Still missing**.
   - Evidence: roadmap continues to track this as unplanned implementation work (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`), and current distributed tests rely on fake runtime RPC paths (`test/live_canvas/live/distributed_runtime_test.exs`, `test/live_canvas_web/channels/live_session_channel_test.exs`).
2. **Chat/live retention enforcement:** **Policy defined, code coverage incomplete**.
   - Evidence: policy windows for `chat_messages` and `live_participants` are documented (`docs/release/compliance-data-governance.md`), while retention code currently reports only `auth_events`, `async_jobs`, and `webhook_events` (`lib/live_canvas/infra/data_governance/retention.ex`).
3. **Compliance hard-delete enablement:** **Explicitly paused**.
   - Evidence: active plan index marks hard-delete follow-up as deferred and blocked by operator pause (`docs/plans/README.md`).

## Why This Is The Next Batch

This batch addresses an active roadmap gap with bounded risk and no schema churn. It improves operational visibility for compliance sweeps now, while keeping destructive retention enforcement and legal-hold policy wiring in later slices.

## Scope And Assumptions

- Keep `mix release.retention_sweep` option contract stable (`--dry-run`, `--apply`, `--cutoff-days`).
- Keep apply mode stubbed and non-destructive for this milestone.
- Add deterministic ordering and test coverage for new retention families.
- Do not resume paused compliance hard-delete scope.

## Progress

- [x] Task 1: Add `chat_messages` and `live_participants` retention candidate coverage
- [x] Task 2: Encode policy-aligned per-family retention windows and report output
- [ ] Task 3: Evaluate safe apply-mode enforcement rollout path (feature gates + hold semantics) and track follow-up

### Task 1: Add Chat/Live Retention Candidate Coverage (Current Batch)

**Files:**
- Modify: `lib/live_canvas/infra/data_governance/retention.ex`
- Modify: `test/live_canvas/infra/data_governance_retention_test.exs`
- Modify: `test/live_canvas/release/retention_sweep_task_test.exs`
- Modify: `docs/plans/release/2026-03-05-chat-live-retention-enforcement.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing retention tests proving `chat_messages` and `live_participants` appear in deterministic family order with expected candidate counts
- [x] Step 2: Run focused retention tests to verify RED
- [x] Step 3: Implement retention family/type/query updates for `chat_messages` and `live_participants`
- [x] Step 4: Run focused retention tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/infra/data_governance_retention_test.exs test/live_canvas/release/retention_sweep_task_test.exs` -> RED first (`8 tests, 2 failures`) and GREEN after implementation (`8 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Policy Window Alignment

**Files:**
- Modify: `lib/live_canvas/infra/data_governance/retention.ex`
- Modify: `lib/mix/tasks/release.retention_sweep.ex`
- Modify: `test/live_canvas/infra/data_governance_retention_test.exs`
- Modify: `test/live_canvas/release/retention_sweep_task_test.exs`
- Modify: `docs/release/compliance-data-governance.md`
- Modify: `docs/plans/release/2026-03-05-chat-live-retention-enforcement.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for policy defaults (`auth_events` 365, `webhook_events` 90, `async_jobs` 30, `chat_messages` 180, `live_participants` 180) and CLI override behavior
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement per-family cutoff resolution and report formatting updates
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix test` on retention slices + `mix typecheck`, update checklist, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/infra/data_governance_retention_test.exs test/live_canvas/release/retention_sweep_task_test.exs` -> RED first (`10 tests, 5 failures`) and GREEN after implementation (`10 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Apply-Mode Enforcement Follow-Up (Planned)

**Files:**
- Modify: `docs/plans/release/2026-03-05-chat-live-retention-enforcement.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [ ] Step 1: Validate operator constraints for destructive retention execution and hold gates
- [ ] Step 2: Document rollout guardrails and split implementation/deferred items in roadmap tracking
- [ ] Step 3: Mark checklist updates and commit milestone with any associated code/test changes

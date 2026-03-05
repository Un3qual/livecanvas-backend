# Live Runtime Partition/Rejoin Drills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining Phase 3 roadmap gap by adding deterministic partition/rejoin drills and reconnect-consistency safeguards for distributed live runtime ownership.

**Architecture:** Build this in additive slices: first harden `LC.Live.join_live_session/4` so transient remote handoff failures do not leave durable participant drift, then add a real distributed drill harness for lease-owner transitions, and finally expose an operator-facing drill command/runbook that reuses existing release-gate conventions.

**Tech Stack:** Elixir 1.15, OTP/`:erpc`, Phoenix Channels, Ecto/PostgreSQL, Mix tasks, ExUnit

---

## Candidate Status Verification (2026-03-05)

Verified directly in active plans, runtime code, tests, and release tooling before selecting this batch:

1. **Multi-node partition/rejoin drill coverage:** **Missing**.
   - Evidence: no runtime tests start peer nodes or perform node disconnect/reconnect choreography (`rg -n "\\b:peer\\b|Node\\.connect|Node\\.disconnect|partition|rejoin" test lib` -> no matches).
2. **Reconnect join consistency under transient remote handoff races:** **Partially implemented**.
   - Evidence: `LC.Live.join_live_session/4` currently persists participant state before runtime admission, and remote runtime routing is single-attempt (`lib/live_canvas/live.ex`); distributed tests only assert one-pass remote behavior with fake RPC responses (`test/live_canvas/live/distributed_runtime_test.exs`).
3. **Operator-facing live-runtime failover drill command/runbook:** **Missing**.
   - Evidence: release task surface currently includes `release.gates`, `release.migration_drill`, and `release.retention_sweep` only (`lib/mix/tasks/`, `mix.exs` CLI env aliases).
4. **Roadmap tracking for partition/rejoin work:** **Still open**.
   - Evidence: release roadmap explicitly lists multi-node failover drills and reconnect consistency under partition/rejoin as remaining unplanned implementation work (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Why This Is The Next Batch

This is the highest-impact remaining runtime reliability gap after distributed ownership, heartbeat failover, and operational rate limits are already delivered. Closing it now reduces reconnect regressions before broader launch-readiness and deployment work.

## Scope And Assumptions

- Keep schema shape unchanged for this slice; focus on runtime behavior, tests, and release/operator tooling.
- Preserve existing client contract (`"session_unavailable"`) and internal remote error atoms.
- Avoid production-only debug hooks; use test-only seams where deterministic orchestration is required.
- Keep changes additive and comment non-obvious invariants.

## Progress

- [x] Task 1: Harden reconnect join consistency for transient remote handoff failures
- [ ] Task 2: Add deterministic partition/rejoin drill integration coverage with real peer-node orchestration
- [ ] Task 3: Add operator drill command + runbook for runtime ownership failover rehearsal
- [ ] Task 4: Run final verification and update roadmap/plan index tracking

### Task 1: Reconnect Consistency Hardening

**Files:**
- Modify: `lib/live_canvas/live.ex`
- Modify: `test/live_canvas/live/distributed_runtime_test.exs`
- Modify: `docs/plans/release/2026-03-05-live-runtime-partition-rejoin-drills.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing distributed-runtime tests for transient remote `:not_found` retry behavior and no-ghost-participant persistence on failed remote joins
- [x] Step 2: Run focused distributed-runtime tests to verify RED
- [x] Step 3: Implement runtime-join retry + participant persistence ordering/atomicity adjustments in `LC.Live.join_live_session/4`
- [x] Step 4: Run focused distributed-runtime tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**
- If the first remote join attempt returns `:remote_not_found`, retry the remote join path once before failing.
- Failed remote join attempts must not leave a newly active `live_participants` row behind.
- Existing success/error atoms for callers must remain stable.

**Step 2 command:**

```bash
mix test test/live_canvas/live/distributed_runtime_test.exs
```

Expected: FAIL before implementation.

**Step 4 command:**

```bash
mix test test/live_canvas/live/distributed_runtime_test.exs
```

Expected: PASS.

**Step 5 commands:**

```bash
mix compile
mix typecheck
```

Verification evidence (2026-03-05):

- `mix test test/live_canvas/live/distributed_runtime_test.exs` -> RED first (`7 tests, 2 failures`) and GREEN after implementation (`7 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Real Partition/Rejoin Drill Coverage

**Files:**
- Create: `test/support/live/peer_runtime_helper.ex`
- Create/Modify: `test/integration/live/runtime_partition_rejoin_test.exs`
- Modify: `test/test_helper.exs`
- Modify: `config/test.exs`
- Modify: `docs/plans/release/2026-03-05-live-runtime-partition-rejoin-drills.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing integration test that starts two peer nodes, forces ownership handoff, disconnects/reconnects owner node links, and asserts reconnect-safe join outcomes
- [ ] Step 2: Run focused integration test to verify RED
- [ ] Step 3: Implement peer-node helper + deterministic test seams (sandbox allowances/config) needed for partition/rejoin drill orchestration
- [ ] Step 4: Run focused integration test to verify GREEN
- [ ] Step 5: Run touched live/channel integration slices + `mix typecheck`, update checklist progress, and commit milestone

### Task 3: Operator Drill Command And Runbook

**Files:**
- Create: `lib/live_canvas/release/live_runtime_drill.ex`
- Create: `lib/mix/tasks/release.live_runtime_drill.ex`
- Create: `test/live_canvas/release/live_runtime_drill_test.exs`
- Create: `docs/release/live-runtime-failover-drills.md`
- Modify: `docs/release/deployment-gates.md`
- Modify: `README.md`
- Modify: `mix.exs`
- Modify: `docs/plans/release/2026-03-05-live-runtime-partition-rejoin-drills.md`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing release-task tests for deterministic drill plan output (`--dry-run`) and safe non-test confirmation requirements
- [ ] Step 2: Run focused release-task tests to verify RED
- [ ] Step 3: Implement `LC.Release.LiveRuntimeDrill` command planner + Mix task wrapper and docs runbook
- [ ] Step 4: Run focused release-task tests and task dry-run output to verify GREEN
- [ ] Step 5: Run `mix compile` + touched task tests + `mix typecheck`, update checklist progress, and commit milestone

### Task 4: Final Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/release/2026-03-05-live-runtime-partition-rejoin-drills.md`

**Task 4 Step Progress:**
- [ ] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 2: Update roadmap/plans index to record delivered partition/rejoin drill scope and remaining release follow-ups
- [ ] Step 3: Mark all completed checklist items and commit final milestone

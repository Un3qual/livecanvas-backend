# Phase 5 Capacity Verification And Launch Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining Phase 5 roadmap gap by adding deterministic capacity verification for feed query load, channel fanout, and live-session concurrency, then wiring the drill into release gates and operator runbooks.

**Architecture:** Introduce a dedicated `LC.Release.CapacityDrill` planner/executor with deterministic dry-run output and safe execution guards similar to existing release drill tasks. Keep probe logic bounded and reproducible in `MIX_ENV=test` using seeded data and explicit thresholds, then expose the workflow via `mix release.capacity_drill` and release gate/runbook wiring.

**Tech Stack:** Elixir 1.15, Phoenix Channels, Ecto, Mix tasks, ExUnit

---

## Candidate Status Verification (2026-03-05)

Verified directly in active docs, release modules, and tests before selecting this batch:

1. **Object-storage serving strategy/provider hardening:** **Partially implemented but lower-priority in current execution note**.
   - Evidence: roadmap still tracks this as remaining (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`), while `ARCHITECTURE.md` says to prioritize non-`Content` work unless blocked.
   - Implemented pieces: upload intent/finalize/webhook pipeline and object-storage seam exist.
2. **Phase 5 performance and capacity verification (feed load, channel fanout, live concurrency):** **Missing**.
   - Evidence: roadmap Phase 5 still lists this as open (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`), no `release.capacity_*` task exists in `lib/mix/tasks`, and current release gates (`LC.Release.Gates`) do not include a capacity step.
3. **Launch checklist instrumentation closure:** **Partially missing**.
   - Evidence: runbooks and telemetry events exist, but no executable capacity drill or gate-level enforcement ties those thresholds to release go/no-go flow.

## Why This Is The Next Batch

This slice closes the highest-priority remaining non-`Content` launch-readiness gap called out in the roadmap and aligns with the architecture note to prioritize `Accounts`, `Social`, `Live`, `Chat`, and `Feed` over new `Content` expansion. It is also a natural extension of existing release drills (`release.gates`, `release.migration_drill`, `release.live_runtime_drill`) without schema churn.

## Scope And Assumptions

- Capacity verification will be deterministic and bounded for CI/test environments, not an open-ended production load test harness.
- `mix release.capacity_drill --dry-run` must print ordered operator steps before any execution mode is used.
- Non-test environments require explicit `--confirm` to run execution mode.
- This plan does not resume paused compliance hard-delete work.

## Progress

- [x] Task 1: Add deterministic `release.capacity_drill` planner and Mix task wrapper
- [x] Task 2: Implement feed/channel/live capacity probes with focused verification tests
- [x] Task 3: Wire capacity drill into release gates and runbooks; finalize verification and tracking updates

### Task 1: Add Deterministic `release.capacity_drill` Planner And Mix Task Wrapper (Current Batch)

**Files:**
- Create: `lib/live_canvas/release/capacity_drill.ex`
- Create: `lib/mix/tasks/release.capacity_drill.ex`
- Create: `test/live_canvas/release/capacity_drill_test.exs`
- Create: `test/live_canvas/release/capacity_drill_task_test.exs`
- Modify: `mix.exs`
- Modify: `docs/plans/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for command-plan ordering, option validation, and task output/error contracts
- [x] Step 2: Run focused release-task tests to verify RED
- [x] Step 3: Implement minimal planner/run module + Mix task wrapper (`--dry-run`, `--confirm`, threshold args)
- [x] Step 4: Run focused release-task tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Step 1 details:**

Add tests that prove:
- `LC.Release.CapacityDrill.command_plan/1` returns deterministic ordered steps:
  - feed query load probe
  - channel fanout probe
  - live-session concurrency probe
- `LC.Release.CapacityDrill.run/1` enforces confirmation outside test env.
- `mix release.capacity_drill` renders dry-run output and fails fast on invalid args.

**Step 2 command:**

```bash
mix test test/live_canvas/release/capacity_drill_test.exs test/live_canvas/release/capacity_drill_task_test.exs
```

Expected: FAIL because module/task are not implemented yet.

**Step 3 implementation notes:**

- Follow existing release-drill patterns (`LC.Release.LiveRuntimeDrill`, `Mix.Tasks.Release.LiveRuntimeDrill`) for dry-run and confirmation semantics.
- Keep step formatting explicit so operator output can be copied into release tickets.
- Add concise comments for non-obvious guardrails (confirmation and deterministic ordering).

**Step 4 command:**

```bash
mix test test/live_canvas/release/capacity_drill_test.exs test/live_canvas/release/capacity_drill_task_test.exs
```

Expected: PASS.

**Step 5 commands + commit:**

```bash
mix compile
mix typecheck
git add lib/live_canvas/release/capacity_drill.ex lib/mix/tasks/release.capacity_drill.ex test/live_canvas/release/capacity_drill_test.exs test/live_canvas/release/capacity_drill_task_test.exs mix.exs docs/plans/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md
git commit -m "feat: add release capacity drill planner and mix task"
```

Verification evidence (2026-03-05):

- `mix test test/live_canvas/release/capacity_drill_test.exs test/live_canvas/release/capacity_drill_task_test.exs` -> RED first (`6 tests, 6 failures`) and GREEN after implementation (`6 tests, 0 failures`)
- `mix compile` -> PASS
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 2: Implement Feed/Channel/Live Capacity Probes And Focused Tests

**Files:**
- Modify: `lib/live_canvas/release/capacity_drill.ex`
- Modify: `lib/mix/tasks/release.capacity_drill.ex`
- Create: `test/integration/release/capacity_drill_feed_test.exs`
- Create: `test/integration/release/capacity_drill_channel_test.exs`
- Create: `test/integration/release/capacity_drill_live_concurrency_test.exs`
- Modify: `test/live_canvas/release/capacity_drill_test.exs`
- Modify: `docs/plans/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing probe tests for feed latency thresholds, channel fanout delivery/latency thresholds, and live join concurrency thresholds
- [x] Step 2: Run focused release-capacity tests to verify RED
- [x] Step 3: Implement deterministic probe execution with threshold validation and structured report output
- [x] Step 4: Run focused release-capacity tests to verify GREEN
- [x] Step 5: Run touched release/integration slices + `mix typecheck`, update checklist progress, and commit milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/release/capacity_drill_test.exs test/live_canvas/release/capacity_drill_task_test.exs test/integration/release/capacity_drill_feed_test.exs test/integration/release/capacity_drill_channel_test.exs test/integration/release/capacity_drill_live_concurrency_test.exs` -> RED first (`12 tests, 6 failures`) and GREEN after implementation + threshold-option validation coverage (`14 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

### Task 3: Wire Capacity Drill Into Release Gates And Runbooks, Then Finalize Tracking

**Files:**
- Modify: `lib/live_canvas/release/gates.ex`
- Modify: `lib/mix/tasks/release.gates.ex`
- Modify: `docs/release/deployment-gates.md`
- Create: `docs/release/performance-capacity-verification.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/release/2026-03-05-phase5-capacity-verification-and-launch-gates.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing gate/runbook-link tests (if applicable) for capacity drill inclusion in preflight sequencing
- [x] Step 2: Run focused release gate tests to verify RED
- [x] Step 3: Add capacity drill gate step + runbook docs with evidence template and threshold override guidance
- [x] Step 4: Run release gate tests and command dry-runs to verify GREEN
- [x] Step 5: Run final verification (`mix compile`, focused `mix test`, `mix typecheck`, `mix precommit`), update roadmap/index, mark checklist completion, and commit final milestone

Verification evidence (2026-03-05):

- `mix test test/live_canvas/release/gates_test.exs` -> RED first (`3 tests, 2 failures`) after asserting the new capacity gate step, then GREEN after gate wiring (`3 tests, 0 failures`)
- `mix release.gates --dry-run` -> PASS; dry-run order now includes `mix release.capacity_drill --confirm` after `mix boundary.spec`
- `MIX_ENV=test mix release.capacity_drill --dry-run` -> PASS with deterministic feed/channel/live probe step ordering

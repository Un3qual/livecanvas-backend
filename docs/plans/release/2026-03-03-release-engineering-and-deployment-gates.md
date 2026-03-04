# Release Engineering And Deployment Gates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a reproducible pre-deploy release gate plus migration/rollback rehearsal tooling and runbooks so production rollouts have explicit go/no-go criteria.

**Architecture:** Keep release orchestration inside additive `LC.Release` modules and thin Mix tasks so deployment checks remain versioned with application code. Pair executable gates (`mix release.gates`, `mix release.migration_drill`) with concrete operator runbooks in `docs/release/` so the same workflow is available to local developers and CI.

**Tech Stack:** Elixir 1.15, Mix tasks, Ecto migrations, PostgreSQL, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified before selecting this plan so we do not assume missing implementation from checklist state alone:

1. **Deterministic release preflight command**: **Missing**.
   - Evidence: `mix.exs` has no `release.*` aliases/tasks, only `setup`, `test`, `typecheck`, and `precommit` aliases (`mix.exs` lines 127-151).
2. **Migration rehearsal + rollback drill workflow**: **Missing**.
   - Evidence: no release drill modules/tasks exist under `lib/` (`rg -n "release\\.migration|migration_drill|release\\.gates" lib` -> no matches).
3. **Deployment gates + staged rollout runbooks**: **Missing**.
   - Evidence: `docs/release/` does not exist and roadmap still lists release engineering as a planning hole (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).
4. **Backup/restore and rollback operator playbook**: **Missing/underspecified**.
   - Evidence: only high-level bullets exist in roadmap Phase 5; no executable checklist doc is present.

## Why This Is The Next Batch

`ARCHITECTURE.md` requires a single deployable release per Kubernetes pod and treats background work + migrations as first-class production concerns. After auth hardening, observability, runtime ownership, and webhook async delivery, release engineering gates are the highest-leverage remaining blocker before launch-readiness work can be executed safely.

## Scope And Assumptions

- Keep this slice repository-local and CI-friendly; do not depend on external orchestration tools in this batch.
- Do not alter domain behavior. Changes are limited to release tooling and operator documentation.
- Use non-destructive rehearsal in `MIX_ENV=test` for migration drill logic.
- Keep gate output concise and machine-readable enough for CI logs.

## Progress

- [x] Task 1: Add deterministic preflight gate orchestration (`mix release.gates`)
- [ ] Task 2: Add migration rehearsal + rollback drill command (`mix release.migration_drill`)
- [ ] Task 3: Add release runbooks (deployment gates, staged rollout, rollback/restore)
- [ ] Task 4: Run full verification, update roadmap hole tracking, and finalize milestone

### Task 1: Deterministic Preflight Gate (`mix release.gates`)

**Files:**
- Create: `lib/live_canvas/release/gates.ex`
- Create: `lib/mix/tasks/release.gates.ex`
- Create: `test/live_canvas/release/gates_test.exs`
- Modify: `mix.exs`
- Modify: `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for gate pipeline ordering, fail-fast behavior, and `--dry-run` output
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement `LC.Release.Gates` + `mix release.gates` wrapper and alias wiring
- [x] Step 4: Run focused tests and the task itself to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit milestone

**Step 1 behavior targets:**
- Default pipeline runs: `compile --warnings-as-errors`, `test`, `typecheck`, `boundary.spec`.
- On first failure, execution halts and returns non-zero.
- `mix release.gates --dry-run` prints ordered steps without executing them.

**Step 2 command:**

```bash
mix test test/live_canvas/release/gates_test.exs
```

Expected: FAIL because release gate module/task does not exist yet.

**Step 4 commands:**

```bash
mix test test/live_canvas/release/gates_test.exs
mix release.gates --dry-run
```

Expected: PASS with deterministic ordered output.

**Step 5 commit:**

```bash
git add lib/live_canvas/release/gates.ex \
  lib/mix/tasks/release.gates.ex \
  test/live_canvas/release/gates_test.exs \
  mix.exs \
  docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md
git commit -m "feat: add deterministic release preflight gate task"
```

### Task 2: Migration Rehearsal + Rollback Drill (`mix release.migration_drill`)

**Files:**
- Create: `lib/live_canvas/release/migration_drill.ex`
- Create: `lib/mix/tasks/release.migration_drill.ex`
- Create: `test/live_canvas/release/migration_drill_test.exs`
- Modify: `mix.exs`
- Modify: `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing tests for migration drill command-plan generation and rollback safety checks
- [ ] Step 2: Run focused tests to verify RED
- [ ] Step 3: Implement rehearsal pipeline + Mix task wrapper
- [ ] Step 4: Run focused tests and rehearsal command to verify GREEN
- [ ] Step 5: Run `mix test` + `mix typecheck`, update checklist, and commit milestone

**Task 2 behavior targets:**
- Rehearsal pipeline (default `MIX_ENV=test`) runs:
  1. `ecto.create --quiet`
  2. `ecto.migrate --quiet`
  3. `ecto.rollback --step 1 --quiet`
  4. `ecto.migrate --quiet`
- Task supports `--step N` override for rollback depth.
- Task requires explicit `--confirm` flag when `MIX_ENV` is not `test`.

**Step 2 command:**

```bash
mix test test/live_canvas/release/migration_drill_test.exs
```

Expected: FAIL before module/task implementation.

**Step 4 commands:**

```bash
mix test test/live_canvas/release/migration_drill_test.exs
MIX_ENV=test mix release.migration_drill --step 1
```

Expected: PASS.

**Step 5 commit:**

```bash
git add lib/live_canvas/release/migration_drill.ex \
  lib/mix/tasks/release.migration_drill.ex \
  test/live_canvas/release/migration_drill_test.exs \
  mix.exs \
  docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md
git commit -m "feat: add migration rehearsal and rollback drill task"
```

### Task 3: Release Runbooks (Deployment Gates + Staged Rollout + Rollback/Restore)

**Files:**
- Create: `docs/release/deployment-gates.md`
- Create: `docs/release/staged-rollout.md`
- Create: `docs/release/rollback-and-restore.md`
- Modify: `README.md`
- Modify: `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`

**Task 3 Step Progress:**
- [ ] Step 1: Draft deployment gate checklist mapped to `mix release.gates` and `mix release.migration_drill`
- [ ] Step 2: Draft staged rollout procedure (dogfood -> beta -> GA) with explicit rollback triggers
- [ ] Step 3: Draft rollback/restore runbook with DB-safe sequencing and ownership handoff notes
- [ ] Step 4: Link new runbooks from `README.md` and run markdown quality checks (`mix format` for code blocks in Elixir files only if touched)
- [ ] Step 5: Run `mix precommit`, update checklist, and commit milestone

**Task 3 documentation targets:**
- Every gate has owner, command, success criterion, and blocker severity.
- Rollout doc defines abort thresholds and exactly which command/state checks gate promotion.
- Rollback doc includes migration rollback order, runtime scale-down expectations, and restore validation checks.

**Step 5 commit:**

```bash
git add docs/release/deployment-gates.md \
  docs/release/staged-rollout.md \
  docs/release/rollback-and-restore.md \
  README.md \
  docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md
git commit -m "docs: add release deployment and rollback runbooks"
```

### Task 4: Final Verification + Roadmap Alignment

**Files:**
- Modify: `docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 4 Step Progress:**
- [ ] Step 1: Run full verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 2: Update roadmap planning-hole notes to mark release-engineering planning gap resolved and list remaining gaps
- [ ] Step 3: Mark all completed checklist items and commit final milestone

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
git add docs/plans/release/2026-03-03-release-engineering-and-deployment-gates.md \
  docs/plans/2026-03-03-backend-release-readiness-roadmap.md
git commit -m "chore: finalize release engineering deployment-gates plan"
```

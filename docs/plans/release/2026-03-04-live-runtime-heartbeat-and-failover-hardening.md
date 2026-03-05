# Live Runtime Heartbeat And Failover Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden distributed live-session runtime ownership by adding lease heartbeats, deterministic failover behavior, and reconnect-safe routing checks.

**Architecture:** Keep the existing lease table (`live_session_runtime_owners`) and remote-routing contract, then add periodic ownership refresh from the runtime lifecycle so active owners do not silently expire. Treat lease-refresh failure as a split-brain safety signal: stop local runtime ownership and force callers onto the existing local-start-or-remote-route path. Validate the behavior through focused live/distributed/channel tests that exercise lease expiry and takeover timing with short test-only intervals.

**Tech Stack:** Elixir 1.15, OTP GenServer/Supervisor, Ecto/Postgres, Phoenix Channels, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-04)

Verified directly in `lib/`, `test/`, and runtime config before selecting this batch:

1. **Periodic lease heartbeat for active runtime owners:** **Not implemented**.
   - Evidence: `LC.Live.SessionOwnership.refresh/3` exists, but no production call sites outside tests (`rg -n "SessionOwnership\\.refresh" lib test` only returns `session_ownership.ex` and `session_ownership_test.exs`).
2. **Automatic runtime stop when ownership can no longer be refreshed:** **Not implemented**.
   - Evidence: `LC.Live.SessionServer` has no `handle_info` heartbeat loop and no ownership-refresh callback path (`lib/live_canvas/live/session_server.ex`).
3. **Failover/reconnect regression coverage for heartbeat-driven lease continuity:** **Missing**.
   - Evidence: existing distributed tests only cover claim/takeover routing and remote error mapping, not periodic refresh continuity or runtime shutdown on lost lease (`test/live_canvas/live/distributed_runtime_test.exs`, `test/live_canvas/live/session_supervisor_test.exs`).
4. **Operational guidance for this hardening slice in roadmap/plan index:** **Missing**.
   - Evidence: active-plan index currently says no implementation plan is in progress (`docs/plans/README.md`), and roadmap Phase 3 still lists heartbeat/failover follow-up as remaining (`docs/plans/2026-03-03-backend-release-readiness-roadmap.md`).

## Why This Is The Next Batch

`ARCHITECTURE.md` calls out stronger live-session recovery/scaling in later phases, and the release roadmap explicitly identifies heartbeat/lease-refresh and failover consistency as Phase 3 follow-ups after distributed ownership baseline delivery. This slice closes that concrete runtime reliability gap without broadening `Content` scope.

## Scope And Assumptions

- Scope only distributed runtime ownership hardening (heartbeat continuity, ownership-loss behavior, reconnect/failover safety checks).
- Keep current schema and public API contracts additive/compatible.
- Use test-time config overrides for short TTL/heartbeat intervals; keep conservative defaults for non-test environments.
- Preserve existing client error mapping (`session_unavailable`) for remote runtime failures.

## Progress

- [x] Task 1: Add runtime lease heartbeat loop and ownership-loss shutdown behavior
- [x] Task 2: Harden supervisor/live routing semantics for heartbeat-driven failover
- [x] Task 3: Expand distributed/channel regression coverage for takeover and reconnect safety
- [x] Task 4: Run full verification, update roadmap/index tracking, and finalize milestone

### Task 1: Runtime Lease Heartbeat Loop

**Files:**
- Modify: `lib/live_canvas/live/session_server.ex`
- Modify: `lib/live_canvas/live/session_supervisor.ex`
- Modify: `config/config.exs`
- Test: `test/live_canvas/live/session_server_test.exs`
- Test: `test/live_canvas/live/session_supervisor_test.exs`
- Modify: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests for lease heartbeat refresh cadence and runtime shutdown when refresh loses ownership
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement `SessionServer` heartbeat timer/callback seam and supervisor-provided lease refresh callback
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix compile` + `mix typecheck`, update checklist, and commit milestone

**Task 1 implementation notes:**
- Keep heartbeat logic in the runtime lifecycle (not ad-hoc external polling).
- Add non-obvious comments documenting split-brain invariant: if lease refresh fails, local runtime must stop.
- Make heartbeat interval configurable from app env (default value in `config/config.exs`).

**Step 2 command:**

```bash
mix test test/live_canvas/live/session_server_test.exs test/live_canvas/live/session_supervisor_test.exs
```

Expected: FAIL before implementation.

**Step 5 commit:**

```bash
git add lib/live_canvas/live/session_server.ex \
  lib/live_canvas/live/session_supervisor.ex \
  config/config.exs \
  test/live_canvas/live/session_server_test.exs \
  test/live_canvas/live/session_supervisor_test.exs \
  docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md
git commit -m "feat: add live runtime lease heartbeat loop"
```

### Task 2: Supervisor/Live Failover Semantics

**Files:**
- Modify: `lib/live_canvas/live/session_supervisor.ex`
- Modify: `lib/live_canvas/live.ex`
- Test: `test/live_canvas/live/distributed_runtime_test.exs`
- Test: `test/live_canvas/live_test.exs`
- Modify: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for lookup/join behavior when local runtime loses ownership and remote takeover occurs
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal lookup/join adjustments to prefer current lease truth and recover via existing ensure/start-or-remote path
- [x] Step 4: Run focused tests for GREEN
- [x] Step 5: Run `mix typecheck`, update checklist, and commit milestone

**Task 2 behavior targets:**
- No stale-local ownership leakage after heartbeat loss.
- Join path remains deterministic (`local`, `remote`, or restart ownership claim) under lease transition races.
- Remote routing keeps stable error atoms already exposed today.

### Task 3: Distributed + Channel Regression Coverage

**Files:**
- Test: `test/live_canvas/live/distributed_runtime_test.exs`
- Test: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `config/test.exs`
- Modify: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing regression tests for short-TTL takeover and reconnect-safe channel join behavior after ownership transitions
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement test-only configuration seams needed for deterministic timing (no production debug paths)
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix test` on touched slices + `mix typecheck`, update checklist, and commit milestone

**Task 3 test targets:**
- Local owner keeps lease alive while runtime is healthy.
- Runtime shutdown on lease-refresh failure leads to takeover/rejoin behavior without leaking node internals.
- Channel join continues returning client-safe `"session_unavailable"` for transient remote handoff windows.

### Task 4: Final Verification And Tracking Updates

**Files:**
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Modify: `docs/plans/release/2026-03-04-live-runtime-heartbeat-and-failover-hardening.md`

**Task 4 Step Progress:**
- [x] Step 1: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [x] Step 2: Update roadmap/plan-index notes for delivered heartbeat+failover hardening scope and remaining launch gaps
- [x] Step 3: Mark completed checklist items and commit final milestone

# Observability And Launch Ops Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a production-grade observability baseline for core runtime flows by emitting structured Telemetry events from domain and realtime paths, then exposing launch-operation guidance for instrumentation-backed runbooks.

**Architecture:** Keep domain behavior inside boundaries (`LC.Live`, `LC.Chat`, `LC.Accounts`) while emitting non-invasive Telemetry events at boundary entry/exit points and critical decision branches. Adapter layers (`LCWeb` channels/controllers) should forward normalized reason codes and request context metadata only; no secrets in event metadata.

**Tech Stack:** Elixir 1.15, Phoenix, Telemetry, ExUnit, Dialyzer

---

## Candidate Status Verification (2026-03-03)

Verified directly in `lib/`, `test/`, and release roadmap docs before selecting this plan:

1. **Live session lifecycle Telemetry events (`start/join/end`)**: **Not implemented**.
   - Evidence: `LC.Live` contains no `:telemetry.execute/3` calls (`rg -n "telemetry\\.execute|:telemetry\\.execute" lib/live_canvas/live.ex` -> no matches).
2. **Channel join failure Telemetry (`not_authorized`, `rate_limited`, `session_ended`)**: **Not implemented**.
   - Evidence: `LCWeb.LiveSessionChannel` contains no Telemetry instrumentation (`rg -n "telemetry\\.execute|:telemetry\\.execute" lib/live_canvas_web/channels/live_session_channel.ex` -> no matches).
3. **Auth attempt Telemetry parity with persisted auth audit events**: **Not implemented**.
   - Evidence: `LC.Accounts` persists audit events but does not emit runtime Telemetry (`rg -n "telemetry\\.execute|:telemetry\\.execute" lib/live_canvas/accounts.ex` -> no matches).
4. **Launch-ops observability/runbook checklist tied to concrete event names**: **Not implemented**.
   - Evidence: no dedicated observability launch-op plan/checklist exists in `docs/plans/release/` beyond roadmap mention.

## Progress

- [x] Task 1: Instrument `LC.Live` lifecycle outcomes with structured Telemetry events
- [x] Task 2: Instrument live channel join/message failure paths with structured Telemetry events
- [ ] Task 3: Instrument auth lifecycle outcomes with Telemetry parity to audit events
- [ ] Task 4: Add launch-ops observability checklist + event contract notes and run final verification

### Task 1: Instrument `LC.Live` Lifecycle Outcomes

**Files:**
- Modify: `lib/live_canvas/live.ex`
- Modify: `test/live_canvas/live_test.exs`
- Modify: `docs/plans/release/2026-03-03-observability-and-launch-ops.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing tests that assert Telemetry events for `start_live_session/2`, `join_live_session/3`, and `end_live_session/2`
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal Telemetry instrumentation in `LC.Live`
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist progress, and commit milestone

**Step 1 details:**
Add tests proving these events are emitted with stable metadata (IDs/status/reason only):
- `[:live_canvas, :live, :session, :start]`
- `[:live_canvas, :live, :session, :join]`
- `[:live_canvas, :live, :session, :end]`

Constraints:
- Never emit secrets or raw auth tokens.
- Keep event metadata bounded to scalar IDs, roles, statuses, and error reasons.

**Step 2 command:**

```bash
mix test test/live_canvas/live_test.exs
```

Expected: FAIL because no lifecycle events are currently emitted.

**Step 3 implementation notes:**
- Emit events on both success and failure outcomes.
- Keep measurements minimal (`count: 1`), with outcome in metadata (`:ok` / `:error` + reason).
- Add concise comments for non-obvious invariants (best-effort observability should not alter domain outcomes).

**Step 4 command:**

```bash
mix test test/live_canvas/live_test.exs
```

Expected: PASS.

**Step 5 commands + commit:**

```bash
mix typecheck
```

Then commit:

```bash
git add lib/live_canvas/live.ex test/live_canvas/live_test.exs docs/plans/release/2026-03-03-observability-and-launch-ops.md
git commit -m "feat: add live session lifecycle telemetry baseline"
```

### Task 2: Instrument Live Channel Join/Message Failure Paths

**Files:**
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/release/2026-03-03-observability-and-launch-ops.md`

**Task 2 Step Progress:**
- [x] Step 1: Add failing channel tests for join/message Telemetry events
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Emit Telemetry for join and chat send outcomes in channel handlers
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run `mix typecheck`, update checklist progress, and commit milestone

### Task 3: Instrument Auth Lifecycle Outcome Telemetry

**Files:**
- Modify: `lib/live_canvas/accounts.ex`
- Modify: `test/live_canvas/accounts/auth_event_test.exs`
- Modify: `docs/plans/release/2026-03-03-observability-and-launch-ops.md`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing tests asserting Telemetry events for login/token lifecycle outcomes
- [ ] Step 2: Run focused tests to verify RED
- [ ] Step 3: Emit Telemetry alongside existing auth audit persistence (best-effort, non-blocking)
- [ ] Step 4: Run focused tests to verify GREEN
- [ ] Step 5: Run `mix typecheck`, update checklist progress, and commit milestone

### Task 4: Launch Ops Checklist, Event Contract Notes, Final Verification

**Files:**
- Modify: `docs/plans/release/2026-03-03-observability-and-launch-ops.md`
- Modify: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`

**Task 4 Step Progress:**
- [ ] Step 1: Document event names/metadata contracts and rollout caveats for dashboards/alerts
- [ ] Step 2: Add launch-op checklist entries for alert thresholds, on-call runbooks, and log correlation
- [ ] Step 3: Run final verification (`mix compile`, `mix test`, `mix typecheck`, `mix precommit`)
- [ ] Step 4: Mark tasks complete and commit final milestone

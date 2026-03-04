# Live Session Participant Leave Reconciliation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep live participant state accurate by marking `left_at` on disconnects and removing disconnected users from runtime participant maps.

**Architecture:** `LC.Live` remains the owner of persisted live participation facts and runtime session orchestration. Add a public, idempotent `leave_live_session/2` boundary API that updates durable participant rows and best-effort prunes in-memory runtime membership. Then wire `LCWeb.LiveSessionChannel` terminate flow to call that boundary API so channel disconnects reconcile durable and ephemeral state.

**Tech Stack:** Elixir 1.15, Ecto, Phoenix Channels, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add `LC.Live` leave API for durable/runtime participant reconciliation
- [x] Task 2: Wire live channel disconnect handling through the new leave API
- [x] Task 3: Run verification, update checklist progress, and commit the milestone

### Task 1: Add `LC.Live` Leave API For Durable/Runtime Participant Reconciliation

**Files:**
- Modify: `lib/live_canvas/live.ex`
- Modify: `test/live_canvas/live_test.exs`
- Verify: `lib/live_canvas/live/session_server.ex`

**Task 1 Step Progress:**
- [x] Step 1: Write failing context tests for leave behavior
- [x] Step 2: Run focused tests to verify RED
- [x] Step 3: Implement minimal `leave_live_session/2` and helper queries
- [x] Step 4: Run focused tests to verify GREEN
- [x] Step 5: Run typing checks for touched context code and commit

**Step 1: Write failing context tests for leave behavior**

Add `LC.Live` context tests that assert:
- `leave_live_session/2` sets `left_at` for an active participant row.
- `leave_live_session/2` removes the participant from `SessionServer.snapshot/1`.
- repeated `leave_live_session/2` calls are idempotent and return `:ok`.

**Step 2: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/live_test.exs
```

Expected: FAIL with undefined function errors for `Live.leave_live_session/2`.

**Step 3: Implement minimal `leave_live_session/2` and helper queries**

In `LC.Live`:
- add a public `leave_live_session/2` function with a public typespec.
- mark the active participant (`left_at IS NULL`) as left using `update_all` and a single `now_utc()` timestamp.
- set `updated_at` explicitly in the same `update_all` write.
- if a runtime session server exists, call `SessionServer.leave/2`; if missing, treat as no-op.
- keep behavior idempotent by always returning `:ok`.

Add concise comments only where reconciliation behavior is non-obvious.

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/live_test.exs
```

Expected: PASS.

**Step 5: Run typing checks for touched context code and commit**

Run:

```bash
mix check.typespecs --strict
mix typecheck
```

Then commit:

```bash
git add lib/live_canvas/live.ex test/live_canvas/live_test.exs docs/plans/2026-03-03-live-session-participant-leave-reconciliation.md
git commit -m "feat: reconcile live participant leaves in context"
```

### Task 2: Wire Live Channel Disconnect Handling Through The New Leave API

**Files:**
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Verify: `lib/live_canvas/live.ex`

**Task 2 Step Progress:**
- [x] Step 1: Write failing channel disconnect test coverage
- [x] Step 2: Run focused channel tests to verify RED
- [x] Step 3: Implement minimal terminate callback wiring
- [x] Step 4: Run focused channel tests to verify GREEN
- [x] Step 5: Commit Task 2 milestone

**Step 1: Write failing channel disconnect test coverage**

Add a channel test that:
- joins `live_session:<id>` as an authorized viewer.
- closes the socket.
- asserts the participant row is marked with non-nil `left_at`.
- asserts the runtime participant snapshot no longer contains that viewer.

**Step 2: Run focused channel tests to verify RED**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: FAIL because disconnect currently does not call any leave path.

**Step 3: Implement minimal terminate callback wiring**

In `LCWeb.LiveSessionChannel`:
- store joined session/user structs in socket assigns needed for terminate cleanup.
- add `terminate/2` callback that calls `Live.leave_live_session/2` when both assignments are present.
- keep callback fault-tolerant (do not crash terminate path on leave errors).

**Step 4: Run focused channel tests to verify GREEN**

Run:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/live_test.exs
```

Expected: PASS.

**Step 5: Commit Task 2 milestone**

```bash
git add lib/live_canvas_web/channels/live_session_channel.ex test/live_canvas_web/channels/live_session_channel_test.exs docs/plans/2026-03-03-live-session-participant-leave-reconciliation.md
git commit -m "feat: reconcile live participant disconnects in channel"
```

### Task 3: Verification, Plan Progress, And Milestone Commit

**Files:**
- Modify: `docs/plans/2026-03-03-live-session-participant-leave-reconciliation.md`
- Verify: `lib/live_canvas/live.ex`
- Verify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Verify: `test/live_canvas/live_test.exs`
- Verify: `test/live_canvas_web/channels/live_session_channel_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Mark completed checklist items in this plan file
- [x] Step 2: Run required verification suite
- [x] Step 3: Commit the final milestone state with related code/test changes

**Step 2: Run required verification suite**

Run:

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix check.typespecs --strict
mix typecheck
```

Expected: PASS.

**Step 3: Commit final milestone**

Do not make a docs-only commit. Bundle plan checkbox updates with Task 2 code/test changes if no additional code changes are needed.

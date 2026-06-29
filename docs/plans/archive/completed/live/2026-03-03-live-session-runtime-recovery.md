# Live Session Runtime Recovery Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure live session runtime state can be reconstructed after `SessionServer` process loss by rehydrating active participants from durable `live_participants` records.

**Architecture:** Keep durable facts in Postgres and runtime membership in `SessionServer`, but bootstrap runtime membership from persisted participant rows whenever a missing session server is recreated. Preserve boundary ownership: `LC.Live` coordinates data access and process startup, `LC.Live.SessionSupervisor` starts runtime processes, and `LC.Live.SessionServer` remains a process-local state holder.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Rehydrate runtime participant state when a session server is recreated
- [x] Task 2: Run focused verification, type checks, and commit the milestone

### Task 1: Rehydrate Runtime Participant State When A Session Server Is Recreated

**Files:**
- Modify: `test/live_canvas/live_test.exs`
- Modify: `lib/live_canvas/live.ex`
- Modify: `lib/live_canvas/live/session_supervisor.ex`
- Modify: `lib/live_canvas/live/session_server.ex`
- Modify: `test/live_canvas/live/session_server_test.exs`
- Modify: `docs/plans/2026-03-03-live-session-runtime-recovery.md`

**Task 1 Step Progress:**
- [x] Step 1: Add failing recovery tests for recreated session servers
- [x] Step 2: Run focused live tests to verify RED
- [x] Step 3: Implement minimal runtime rehydration across `Live`/`SessionSupervisor`/`SessionServer`
- [x] Step 4: Run focused live tests to verify GREEN

**Step 1: Add failing recovery tests for recreated session servers**

Add coverage that proves runtime participant maps survive server loss by reconstructing from DB state:
- In `test/live_canvas/live_test.exs`, add a test that joins one participant, kills the runtime server, joins a second participant, and asserts the recreated server snapshot includes both participants.
- In `test/live_canvas/live/session_server_test.exs`, add a focused test that `initial_participants` passed at startup are present in the initial snapshot.

**Step 2: Run focused live tests to verify RED**

Run:

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs
```

Expected: FAIL because recreated servers currently start with an empty participant map.

**Step 3: Implement minimal runtime rehydration across `Live`/`SessionSupervisor`/`SessionServer`**

Implement:
- `LC.Live`: when `ensure_session_server/1` detects no server, query active `live_participants` (`left_at IS NULL`) for that session and pass a bootstrapped participant map into session server startup.
- `LC.Live.SessionSupervisor`: extend `start_session_server/1` to accept an optional `initial_participants` map.
- `LC.Live.SessionServer`: accept `initial_participants` in `start_link/1` and seed state in `init/1`.

Implementation notes:
- Keep ordering deterministic in the participant bootstrap query.
- Keep comments concise and only for non-obvious crash-recovery intent.
- Preserve existing behavior for fresh sessions (`initial_participants` defaults to `%{}`).

**Step 4: Run focused live tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs
```

Expected: PASS with the new recovery assertions.

### Task 2: Verify Typed Surface, Update Plan Progress, And Commit

**Files:**
- Modify: `docs/plans/2026-03-03-live-session-runtime-recovery.md`
- Verify: `lib/live_canvas/live.ex`
- Verify: `lib/live_canvas/live/session_supervisor.ex`
- Verify: `lib/live_canvas/live/session_server.ex`
- Verify: `test/live_canvas/live_test.exs`
- Verify: `test/live_canvas/live/session_server_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Mark completed checklist items in this plan
- [x] Step 2: Run verification commands for tests and typing
- [x] Step 3: Commit the milestone with code, tests, and plan updates together

**Step 2: Run verification commands for tests and typing**

Run:

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs
mix check.typespecs --strict
mix typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add lib/live_canvas/live.ex lib/live_canvas/live/session_supervisor.ex lib/live_canvas/live/session_server.ex test/live_canvas/live_test.exs test/live_canvas/live/session_server_test.exs docs/plans/2026-03-03-live-session-runtime-recovery.md
git commit -m "feat: rehydrate live session runtime participants"
```

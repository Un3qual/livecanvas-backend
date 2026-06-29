# Live Session Channel State And Presence Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the missing realtime live-room state surface so authorized clients can join a `live_session:<id>` topic, receive an initial aggregate session snapshot, and stay updated as viewer participation and lifecycle state change.

**Architecture:** Keep `LC.Live` as the owner of runtime live-session state by exposing a small aggregate snapshot API that derives viewer counts from the existing session runtime instead of inventing a second source of truth. Reuse the existing Phoenix channel topic for live rooms and broadcast bounded aggregate state payloads from the adapters that already observe successful join, leave, go-live, and end transitions. Preserve authorization and privacy by publishing only aggregate counts and status, not participant rosters or raw user IDs.

**Tech Stack:** Elixir 1.15, Phoenix Channels, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. `LCWeb.LiveSessionChannel` currently authorizes joins, persists chat messages, and handles disconnect control, but it still returns an empty join payload and never broadcasts aggregate live-session state or participation changes (`lib/live_canvas_web/channels/live_session_channel.ex`, `test/live_canvas_web/channels/live_session_channel_test.exs`).
2. `LC.Live.SessionServer` already keeps an in-memory participant map keyed by user ID, but `LC.Live` does not expose any public API that adapters can use to read an aggregate runtime snapshot for a live room (`lib/live_canvas/live/session_server.ex`, `lib/live_canvas/live.ex`).
3. `LCGQL.Live.Resolver` emits persisted chat system events and disconnect control messages for `goLiveSession` / `endLiveSession`, but it does not broadcast a channel-facing state update when a session becomes live or ends (`lib/live_canvas_gql/live/live_resolver.ex`, `test/live_canvas_gql/live/live_mutations_test.exs`).
4. The chat system-event slice intentionally left participant join/leave history out of durable chat because reconnects and ownership handoff would make persisted per-viewer events noisy; the safe next step is an ephemeral channel-level aggregate state contract instead (`docs/plans/chat/2026-03-17-chat-system-events.md`).

## Scope Decisions

- Reuse the existing `live_session:<id>` topic; do not introduce a second topic just for presence or state.
- Publish aggregate state only: `status`, `visibility`, and `viewer_count`. Do not expose participant rosters, user IDs, or raw runtime snapshots in channel payloads.
- Treat `viewer_count` as runtime state owned by `LC.Live`, with durable `live_participants` rows used only as a fallback when runtime ownership or lookup races occur.
- Keep countdown timers, host media controls, and persisted join/leave chat history out of this slice.

## Progress

- [x] Task 1: Add aggregate live-session state snapshot helpers in `LC.Live`
- [x] Task 2: Publish join/leave state updates on `LCWeb.LiveSessionChannel`
- [x] Task 3: Broadcast lifecycle state transitions and refresh plan tracking

### Task 1: Add Aggregate Live-Session State Snapshot Helpers In `LC.Live`

**Files:**
- Modify: `lib/live_canvas/live.ex`
- Modify: `test/live_canvas/live_test.exs`
- Modify: `test/live_canvas/live/distributed_runtime_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing `LC.Live` tests for a public aggregate state helper that reports persisted `status` / `visibility` plus runtime `viewer_count` for a live session
- [x] Step 2: Add failing distributed-runtime coverage proving remote-owner lookup still returns a bounded aggregate snapshot instead of leaking runtime-routing details to adapters
- [x] Step 3: Implement the public helper and any remote-call shim needed to read aggregate participant counts through the existing runtime ownership path
- [x] Step 4: Keep ended-session and missing-runtime cases deterministic by falling back to zero viewers or active durable participant counts only where the runtime race requires it
- [x] Step 5: Run `mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs` and commit the aggregate snapshot slice

**Task 1 behavior targets:**

- Fresh sessions report `viewer_count: 0`.
- Viewer joins and leaves update the aggregate snapshot without exposing participant identities.
- Remote runtime ownership still yields the same aggregate shape as local ownership.
- Ended sessions report `status: :ended` with `viewer_count: 0`.

**Suggested verification command:**

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs
```

Expected: PASS.

### Task 2: Publish Join/Leave State Updates On `LCWeb.LiveSessionChannel`

**Files:**
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing channel tests that the join ack includes the current aggregate session state for an authorized viewer
- [x] Step 2: Add failing channel tests proving additional joins and disconnect-driven leaves broadcast a bounded aggregate state update to subscribed viewers on the same topic
- [x] Step 3: Implement channel helpers that fetch the aggregate state from `LC.Live`, include it in the join response, and rebroadcast it after successful join/leave transitions
- [x] Step 4: Preserve existing auth, rate-limit, chat-send, and disconnect cleanup semantics while keeping the new state payload contract additive
- [x] Step 5: Run `mix test test/live_canvas_web/channels/live_session_channel_test.exs` and commit the channel state slice

**Task 2 behavior targets:**

- Joining `live_session:<id>` returns a non-empty snapshot with `status`, `visibility`, and `viewer_count`.
- Successful joins and leaves rebroadcast the refreshed aggregate state on the same topic.
- Other sessions do not receive cross-room state updates.
- Unauthorized viewers still fail the join without learning room state.

**Suggested verification command:**

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: PASS.

### Task 3: Broadcast Lifecycle State Transitions And Refresh Plan Tracking

**Files:**
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Modify: `docs/plans/backend/NOW.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing GraphQL/channel coverage proving `goLiveSession` and `endLiveSession` rebroadcast aggregate state changes to already-joined viewers
- [x] Step 2: Implement resolver-level state broadcasts after successful lifecycle transitions, keeping the end-of-session state update ahead of the existing disconnect fanout
- [x] Step 3: Run `mix compile`
- [x] Step 4: Run `mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs`
- [x] Step 5: Run `mix typecheck`
- [x] Step 6: Update this checklist plus `docs/plans/backend/NOW.md`, then report any required coordinator updates to `docs/plans/INDEX.md` / `docs/plans/NOW.md`

**Task 3 behavior targets:**

- `goLiveSession` rebroadcasts the session’s updated lifecycle state to joined viewers.
- `endLiveSession` rebroadcasts the terminal state before viewers are disconnected.
- Channel state updates remain additive and do not replace persisted chat system events or disconnect control behavior.
- Tracking docs advance cleanly once the realtime state slice is complete.

**Suggested verification command:**

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs
mix typecheck
```

Expected: PASS.

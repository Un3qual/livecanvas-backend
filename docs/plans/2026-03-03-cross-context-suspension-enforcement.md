# Cross-Context Suspension Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend account suspension moderation beyond authentication so suspended users cannot appear in feed discovery surfaces or participate in live/chat session flows.

**Architecture:** Keep `LC.Accounts` as the owner of suspension state while enforcing moderation policy inside each consuming context (`LC.Feed`, `LC.Live`, `LC.Chat`) with adapter-thin channel behavior in `LCWeb`.

**Tech Stack:** Elixir 1.15+, Ecto, PostgreSQL, ExUnit, Phoenix Channels

---

## Status Verification Snapshot (2026-03-03)

- Verified complete in code:
  - `users.suspended_at` persistence exists with microsecond precision.
  - `LC.Accounts` exposes `suspend_user/1`, `unsuspend_user/1`, and `suspended?/1`.
  - Authentication/session lookup flows reject suspended users.
- Verified incomplete in code:
  - `LC.Feed.home_feed_query/1` does not filter suspended post authors.
  - `LC.Feed.live_now_query/1` does not filter suspended session hosts.
  - `LC.Live.start_live_session/2` and `LC.Live.join_live_session/3` do not gate on suspension.
  - `LC.Chat.authorize_join/2` does not gate on suspension.
  - Live channel join/message flows rely on those context checks and therefore currently allow suspended users when a stale in-memory `current_user` is present.

## Progress

- [x] Task 1: Add failing moderation tests for suspended feed/live/chat behavior
- [x] Task 2: Implement suspension guards in feed, live, and chat contexts
- [x] Task 3: Run focused verification, update checklist progress, and commit milestone

### Task 1: Add Failing Moderation Tests For Suspended Feed/Live/Chat Behavior

**Files:**
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas/live_test.exs`
- Modify: `test/live_canvas/chat_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/2026-03-03-cross-context-suspension-enforcement.md`

**Task 1 Step Progress:**
- [x] Step 1: Add feed context and GraphQL tests excluding suspended creators/hosts
- [x] Step 2: Add live/chat tests denying suspended host/viewer participation
- [x] Step 3: Add channel-level test proving suspended users are denied joins
- [x] Step 4: Run focused tests to verify RED

### Task 2: Implement Suspension Guards In Feed, Live, And Chat Contexts

**Files:**
- Modify: `lib/live_canvas/feed.ex`
- Modify: `lib/live_canvas/live.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `docs/plans/2026-03-03-cross-context-suspension-enforcement.md`

**Task 2 Step Progress:**
- [x] Step 1: Filter suspended authors and hosts in feed SQL queries
- [x] Step 2: Gate live session start/join for suspended host/viewer state
- [x] Step 3: Gate chat join authorization for suspended host/viewer state
- [x] Step 4: Add concise comments for non-obvious moderation ordering
- [x] Step 5: Run focused tests to verify GREEN

### Task 3: Final Verification And Milestone Commit

**Files:**
- Modify: `docs/plans/2026-03-03-cross-context-suspension-enforcement.md`
- Verify: `lib/live_canvas/feed.ex`
- Verify: `lib/live_canvas/live.ex`
- Verify: `lib/live_canvas/chat.ex`
- Verify: `test/live_canvas/feed_test.exs`
- Verify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Verify: `test/live_canvas/live_test.exs`
- Verify: `test/live_canvas/chat_test.exs`
- Verify: `test/live_canvas_web/channels/live_session_channel_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Mark completed checklist items in this plan file
- [x] Step 2: Run required verification commands
- [x] Step 3: Commit code, tests, and plan updates together

**Step 2: Run required verification commands**

Run:

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas/live_test.exs test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
```

Expected: PASS.

# Chat Mute Join Authorization Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent viewers from joining live chat for hosts they have muted.

**Architecture:** Keep relationship policy ownership in `LC.Social` and apply mute-aware authorization at the `LC.Chat` boundary before visibility checks. The mute rule remains directional (`viewer -> host`) and must not block joins when only the host muted the viewer.

**Tech Stack:** Elixir 1.15, Ecto, Phoenix Channels, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add failing mute-aware chat join authorization tests
- [x] Task 2: Implement directional mute authorization in `LC.Chat`
- [x] Task 3: Run verification, update checklist progress, and commit

### Task 1: Add Failing Mute-Aware Chat Join Authorization Tests

**Files:**
- Modify: `test/live_canvas/chat_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/2026-03-03-chat-mute-join-authorization.md`

**Task 1 Step Progress:**
- [x] Step 1: Add context test denying join when viewer muted host
- [x] Step 2: Add context test allowing join when host muted viewer
- [x] Step 3: Add channel test rejecting muted viewer joins
- [x] Step 4: Run focused tests to verify RED

**Step 4: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs --trace
```

Expected: FAIL because `LC.Chat.authorize_join/2` does not yet apply mute checks.

### Task 2: Implement Directional Mute Authorization In `LC.Chat`

**Files:**
- Modify: `lib/live_canvas/chat.ex`
- Modify: `docs/plans/2026-03-03-chat-mute-join-authorization.md`

**Task 2 Step Progress:**
- [x] Step 1: Deny join when `Social.muted?(viewer, host)` is true
- [x] Step 2: Keep block and visibility semantics intact
- [x] Step 3: Add concise comment for directional mute intent
- [x] Step 4: Run focused tests to verify GREEN

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs --trace
```

Expected: PASS with mute-aware authorization behavior and no regressions.

### Task 3: Final Verification, Plan Tracking, And Commit

**Files:**
- Modify: `docs/plans/2026-03-03-chat-mute-join-authorization.md`
- Verify: `lib/live_canvas/chat.ex`
- Verify: `test/live_canvas/chat_test.exs`
- Verify: `test/live_canvas_web/channels/live_session_channel_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Mark completed checklist items in this plan file
- [x] Step 2: Run verification commands
- [x] Step 3: Commit related code + tests + plan updates together

**Step 2: Run verification commands**

Run:

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs --trace
mix check.typespecs --strict
mix typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add lib/live_canvas/chat.ex test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs docs/plans/2026-03-03-chat-mute-join-authorization.md
git commit -m "feat: enforce mute-aware live chat joins"
```

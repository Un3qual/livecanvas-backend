# Chat History Pagination Implementation Plan

> **For agentic workers:** Use this only after it is promoted from
> `docs/plans/mobile/NOW.md`. Keep implementation mobile-owned.

**Goal:** Let viewers and retained hosts load older retained chat timeline
events from the watch screen.

**Architecture:** Keep Relay as the durable source for retained history and keep
Phoenix Channels responsible only for realtime events. Use a focused older-page
fetch path that reuses the existing `LiveSession.timelineEvents` shape, then
merge older rows through the existing chat timeline reducer.

**Tech Stack:** Expo React Native, Relay, existing timeline reducer, Bun tests.

---

## Executor Brief

The watch screen initially loads a retained timeline window, but users cannot
page further back. Add a visible "Load older messages" path for retained chat
history without changing the backend schema and without returning to the stale
`chatMessages` API.

## Context

- Watch query and operations live in
  `mobile/src/live/watch/liveSessionWatchOperations.ts`.
- Timeline rows are normalized by
  `mobile/src/live/liveSessionTimelineHistory.ts`.
- Retained and realtime rows merge through
  `mobile/src/live/chat/liveSessionChatTimelineReducer.ts`.
- Chat UI renders in `mobile/src/live/chat/LiveSessionChatPanel.tsx`.

## Tasks

### Task 1: Expose older-page state in chat presentation

**Files:**
- Modify:
  `mobile/src/live/chat/liveSessionChatPanelPresentation.ts`
- Modify: `mobile/src/live/chat/LiveSessionChatPanel.tsx`
- Test: `mobile/tests/live/LiveSessionChatPanel.test.ts`

Acceptance criteria:
- The panel model exposes whether older history can be loaded.
- The panel shows a secondary `Load older messages` button above the timeline
  when `hasPreviousPage` is true.
- While an older page is loading, the button is disabled and labelled
  `Loading older messages...`.
- If older-page loading fails, the panel shows a viewer-safe retry message.

Implementation notes:
- Add explicit props rather than reading pagination state from reducer internals:
  `canLoadOlder`, `isLoadingOlder`, `olderLoadError`, and `onLoadOlder`.
- Keep composer disabled logic unchanged.

Focused verification:
- From `mobile/`:
  `bun test tests/live/LiveSessionChatPanel.test.ts`

### Task 2: Add a retained timeline page reader

**Files:**
- Modify: `mobile/src/live/liveSessionTimelineHistory.ts`
- Modify: `mobile/tests/live/liveSessionTimelineHistory.test.ts`

Acceptance criteria:
- The reader returns normalized rows plus `startCursor` and `hasPreviousPage`.
- Empty, malformed, and future timeline event rows keep the current safe
  behavior.
- Cursor data is read from Relay `pageInfo` only; do not invent client cursors.

Implementation notes:
- Keep the existing `readLiveSessionTimelineHistory` export stable.
- Add `readLiveSessionTimelinePage` and make the existing function delegate to
  it if that keeps duplication low.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionTimelineHistory.test.ts`

### Task 3: Fetch older retained timeline pages

**Files:**
- Modify:
  `mobile/src/live/watch/liveSessionWatchOperations.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Test: `mobile/tests/live/useLiveSessionWatchController.test.ts`

Acceptance criteria:
- The watch screen fetches older rows with `timelineLast` and
  `timelineBefore` using the current Relay live-session ID.
- A successful fetch dispatches the reducer action that prepends older rows
  without duplicating existing rows.
- A failed fetch leaves existing chat rows intact and shows a viewer-safe retry
  message.
- Stale older-page responses for a previous live session are ignored.

Implementation notes:
- Use `useRelayEnvironment` plus `fetchQuery` so older pages do not remount the
  whole watch screen.
- Keep `INITIAL_TIMELINE_HISTORY_COUNT` as the first page size and introduce a
  named `OLDER_TIMELINE_HISTORY_COUNT` if the older page size differs.
- Do not add infinite scroll in this slice; use an explicit button.

Focused verification:
- From `mobile/`:
  `bun test tests/live/useLiveSessionWatchController.test.ts`

### Task 4: Verify retained and realtime merge behavior

**Files:**
- Modify:
  `mobile/tests/live/liveSessionChatTimelineReducer.test.ts`

Acceptance criteria:
- Older retained rows prepend before current rows.
- Duplicate IDs from older pages are ignored.
- Realtime rows that arrive while an older page is loading stay visible after
  the older page completes.
- Session changes clear stale pagination state.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionChatTimelineReducer.test.ts`

## Final Verification

From `mobile/`:

- `bun test tests/live/LiveSessionChatPanel.test.ts`
- `bun test tests/live/liveSessionTimelineHistory.test.ts`
- `bun test tests/live/liveSessionChatTimelineReducer.test.ts`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Handoff

After this lands, automatic scroll-position preservation can be considered as a
separate UI polish slice. Keep this plan focused on explicit pagination.

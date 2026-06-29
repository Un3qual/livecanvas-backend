# Mobile Chat Realtime And Retained History Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile live-session chat that reads retained timeline history from Relay and merges Phoenix Channel timeline events into the watch screen.

**Architecture:** The backend GraphQL schema currently exposes retained history through `LiveSession.timelineEvents`, not the older `chatMessages` contract name. Mobile should keep Relay as the durable source for retained history, normalize realtime payloads through the existing live-session event boundary, and keep channel/socket code behind a small injectable client so UI tests stay pure.

**Tech Stack:** Expo React Native, TypeScript, Relay, Phoenix Channels, Bun tests, Relay compiler.

---

## Source Of Truth

- Lane pointer: `docs/plans/mobile/NOW.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current schema: `mobile/schema.graphql`
- Retained history contract: `docs/contracts/mobile-graphql-chat-history.md`
- Realtime contract: `docs/contracts/mobile-live-session-realtime.md`
- Watch screen: `mobile/src/live/LiveSessionWatchScreen.tsx`

## Shared Decisions

- Use `LiveSession.timelineEvents(last, before, first, after)`.
- Initial retained history loads the newest retained events with `last`.
- Older scrollback uses `last` plus `before: pageInfo.startCursor`.
- Missed-event catch-up can use `first` plus `after: pageInfo.endCursor`.
- Merge retained and realtime events by opaque Relay event `id`; never decode IDs.
- Treat `timeline:event_updated` as an in-place replacement by `event.id`.
- Treat `timeline:event_removed` as removal by opaque event ID.
- Send chat with Phoenix Channel push `timeline:chat_message:send` and payload `{body}`.

## Task 1: Retained Timeline History Presentation

**Files:**

- Modify: `docs/contracts/mobile-graphql-chat-history.md`
- Modify: `docs/contracts/mobile-live-session-graphql.md`
- Create: `mobile/src/live/liveSessionTimelineHistory.ts`
- Create: `mobile/src/live/liveSessionTimelineHistory.test.ts`

- [x] **Step 1: Repair contract wording to match the checked-in schema**

  Replace stale `chatMessages`/`ChatMessage` language with `timelineEvents` and `ChatMessageEvent`.

- [x] **Step 2: Write failing tests for retained connection normalization**

  Cover nullable connection edges, nullable event nodes, `ChatMessageEvent`, `LiveSessionStartedEvent`, `LiveSessionEndedEvent`, pageInfo preservation, chronological order preservation, and future `__typename` fallback.

- [x] **Step 3: Implement minimal retained timeline helpers**

  Add pure types and helpers that:

  - read nullable Relay connection edges into `{event, cursor}` rows
  - preserve `pageInfo`
  - normalize chat rows with `body`, `edited`, `editCount`, and `editedAt`
  - normalize lifecycle rows with no chat body
  - format compact viewer-facing labels for system lifecycle events

- [x] **Step 4: Verify Task 1**

  Run:

  ```bash
  bun test mobile/src/live/liveSessionTimelineHistory.test.ts
  ```

  Evidence:

  - Red run before implementation failed with missing `./liveSessionTimelineHistory`.
  - `bun test mobile/src/live/liveSessionTimelineHistory.test.ts` passed 3 tests.
  - `bun test mobile/src/live/liveSessionTimelineHistory.test.ts mobile/src/live/liveSessionRealtimeEvents.test.ts mobile/src/relay/readConnectionNodes.test.ts` passed 17 tests.

## Task 2: Chat Reducer State And Realtime Merges

**Files:**

- Create: `mobile/src/live/liveSessionChatReducer.ts`
- Create: `mobile/src/live/liveSessionChatReducer.test.ts`

- [x] **Step 1: Write failing reducer tests**

  Cover:

  - session change resets state
  - retained initial page loads newest retained events
  - older retained page prepends without duplicate IDs
  - newer retained catch-up appends without duplicate IDs
  - realtime event appends or replaces by ID
  - realtime update replaces by ID without changing order
  - realtime removal deletes by ID
  - stale session actions are ignored
  - send started/succeeded/failed state stays scoped to the active session

- [x] **Step 2: Implement reducer and selectors**

  Keep state immutable and keyed by opaque event ID. Store ordered IDs separately from event map. Expose selectors for visible rows, pagination cursors, channel status, and send status.

- [x] **Step 3: Verify Task 2**

  Run:

  ```bash
  bun test mobile/src/live/liveSessionChatReducer.test.ts mobile/src/live/liveSessionTimelineHistory.test.ts
  ```

  Evidence:

  - Red run before implementation failed with missing `./liveSessionChatReducer`.
  - `bun test mobile/src/live/liveSessionChatReducer.test.ts mobile/src/live/liveSessionTimelineHistory.test.ts mobile/src/live/liveSessionRealtimeEvents.test.ts` passed 25 tests.
  - `cd mobile && pnpm exec tsc --noEmit` passed.

## Task 3: Phoenix Channel Client Boundary

**Files:**

- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Create: `mobile/src/realtime/phoenixSocket.ts`
- Create: `mobile/src/realtime/phoenixSocket.test.ts`
- Create: `mobile/src/live/liveSessionChannelClient.ts`
- Create: `mobile/src/live/liveSessionChannelClient.test.ts`

- [x] **Step 1: Add the Phoenix JavaScript dependency**

  Use pnpm so the existing lockfile remains authoritative:

  ```bash
  cd mobile
  pnpm add phoenix
  ```

- [x] **Step 2: Write failing tests for socket creation and channel events**

  Cover:

  - socket params call `getAccessToken` at connect time and send `{token}`
  - no Relay ID parsing is performed for topics
  - join ack `session_state` is normalized
  - `timeline:event`, `timeline:event_updated`, and `timeline:event_removed` invoke callbacks with normalized events
  - `timeline:chat_message:send` pushes `{body}` and normalizes successful replies
  - push failures return viewer-safe reason strings

- [x] **Step 3: Implement the socket and channel boundary**

  Keep Phoenix imports isolated to `mobile/src/realtime/phoenixSocket.ts`. Keep `liveSessionChannelClient.ts` testable with an injected channel factory so tests do not need a real socket.

- [x] **Step 4: Verify Task 3**

  Run:

  ```bash
  bun test mobile/src/realtime/phoenixSocket.test.ts mobile/src/live/liveSessionChannelClient.test.ts mobile/src/live/liveSessionRealtimeEvents.test.ts
  ```

  Evidence:

  - `pnpm add phoenix` updated `mobile/package.json` and `mobile/pnpm-lock.yaml`.
  - Red runs before implementation failed on the missing channel/socket boundary.
  - `bun test mobile/src/realtime/phoenixSocket.test.ts mobile/src/live/liveSessionChannelClient.test.ts mobile/src/live/liveSessionRealtimeEvents.test.ts` passed after the injectable channel client was implemented.
  - Follow-up review hardening added `session:state` callback coverage and a compile-time proof that `createPhoenixSocket` satisfies the channel socket boundary.
  - `cd mobile && pnpm exec tsc --noEmit` passed.

## Task 4: Watch Screen Chat Panel Integration

**Files:**

- Create: `mobile/src/live/LiveSessionChatPanel.tsx`
- Modify: `mobile/src/live/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/__generated__/LiveSessionWatchScreenQuery.graphql.ts`

- [x] **Step 1: Write failing presentation/integration tests**

  Add pure tests for chat panel props where possible. If TSX tests need mocks, avoid module mocks that leak into unrelated tests.

- [x] **Step 2: Extend the watch query**

  Query:

  - `timelineEvents(last: $timelineLast, before: $timelineBefore)`
  - `edges { cursor node { __typename id eventType occurredAt actor { id } ... on ChatMessageEvent { body edited editCount editedAt } } }`
  - `pageInfo { startCursor endCursor hasNextPage hasPreviousPage }`

  Keep the existing live-session metadata fields.

- [x] **Step 3: Render the chat panel**

  Show retained timeline rows, lifecycle rows, empty state, join/channel status, composer disabled states, pending send state, and viewer-safe send errors. Preserve existing join/leave controls.

- [x] **Step 4: Run Relay compiler and verify Task 4**

  Run:

  ```bash
  cd mobile
  pnpm relay
  cd ..
  bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host
  ```

  Evidence:

  - Red run before implementation failed with missing `./LiveSessionChatPanel`.
  - `cd mobile && pnpm relay` passed after Watchman sandbox escalation.
  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host` passed 94 tests.
  - `cd mobile && pnpm exec tsc --noEmit` passed.
  - Post-review hardening preserved realtime rows across retained refreshes, disables chat on channel close/error/session-ended, closes same-render duplicate sends with an in-memory token, and clears pending chat sends during channel cleanup.
  - `bun test mobile/src/live/liveSessionChatReducer.test.ts mobile/src/live/liveSessionChannelClient.test.ts mobile/src/live/LiveSessionChatPanel.test.ts` passed 24 tests after the channel-cleanup fix.
  - `cd mobile && pnpm exec tsc --noEmit` passed after the channel-cleanup fix.

## Task 5: Status Closure And Final Verification

**Files:**

- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/INDEX.md`

- [x] **Step 1: Mark completed steps in this plan**

  Check off completed task steps with evidence summaries.

- [x] **Step 2: Update lane status**

  Mark the mobile lane idle when implementation and verification are complete. Keep backend lane idle.

- [x] **Step 3: Run final verification**

  Run:

  ```bash
  bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host
  cd mobile
  pnpm relay
  pnpm exec tsc --noEmit
  ```

  Evidence:

  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host` passed 98 tests.
  - `cd mobile && pnpm relay` passed after Watchman sandbox escalation.
  - `cd mobile && pnpm exec tsc --noEmit` passed.
  - `test -x scripts/check-docs.sh && scripts/check-docs.sh || test ! -e scripts/check-docs.sh` passed.
  - `git diff --check` passed.

- [x] **Step 4: Commit, push, and open PR**

  Commit scoped milestones as tasks finish. After final verification, push `codex/mobile-chat-realtime-history` and open a PR unless the user explicitly redirects.

  Evidence:

  - Branch pushed to `origin/codex/mobile-chat-realtime-history`.
  - PR opened: https://github.com/Un3qual/livecanvas-backend/pull/99

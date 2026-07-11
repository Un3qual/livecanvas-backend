# Live-Chat Message Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an active-session message author edit their own message and let the session host remove a message while all connected clients converge on one timeline.

**Architecture:** Existing Relay mutations and Phoenix timeline update/removal broadcasts remain server-authoritative. Mobile adds small control operations and state, applies confirmed mutation payloads through the same idempotent timeline merge boundary used by realtime events, and derives action visibility from opaque viewer, host, actor, and session state already returned by the watch query.

**Tech Stack:** Elixir, Absinthe Relay, Phoenix Channels, ExUnit, Expo React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 4.
- Execute only after Media Post Publishing closes and this plan is promoted through the lane `NOW.md` files.
- Edit is available only to the message actor while the session is not `ENDED`.
- Remove is available only to the live-session host. General viewer deletion remains deferred.
- Server authorization is authoritative; mobile action visibility is usability, not an authorization boundary.
- Mutation responses and channel broadcasts may arrive in either order and must remain idempotent.
- Retained-history pagination, send behavior, and opaque IDs/cursors must remain unchanged.
- Mobile tests stay under `mobile/tests/**`.
- Backend production code changes only if Task 1 reproduces a contract or broadcast defect.

---

## Executor Brief

Prove the backend mutation/broadcast matrix first. Build pure control state and
Relay operations before modifying the chat panel. Keep mutation reconciliation
inside the existing timeline reducer instead of maintaining a second message
list. Commit each task with its focused tests.

## File Structure

- Backend proof: existing GraphQL and channel mutation tests.
- Relay boundary: `mobile/src/live/chat/liveSessionChatControlOperations.ts`.
- Pure state: `mobile/src/live/chat/liveSessionChatControlsState.ts`.
- Controller: `mobile/src/live/chat/useLiveSessionChatControls.ts`.
- Reconciliation: `mobile/src/live/chat/liveSessionChatTimelineReducer.ts`.
- Presentation: `mobile/src/live/chat/LiveSessionChatPanel.tsx` and its presentation helper.
- Screen wiring: `mobile/src/live/watch/LiveSessionWatchScreen.tsx` and existing watch query IDs.

### Task 1: Prove Backend Authorization And Broadcast Semantics

**Files:**
- Modify: `test/live_canvas_gql/chat/chat_mutations_test.exs`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify only on reproduced failure: `lib/live_canvas/chat.ex`
- Modify only on reproduced failure: `lib/live_canvas_gql/chat/chat_resolver.ex`

**Interfaces:**
- Consumes: `editLiveChatMessage`, `removeLiveChatMessageEvent`, `timeline:event_updated`, and `timeline:event_removed`.
- Produces: a verified response/broadcast contract for mobile reconciliation.

- [ ] Complete the focused matrix for actor edit success, different-actor rejection, ended-session rejection, host remove success, non-host rejection, repeated remove, hidden actor/host relationship state, malformed/wrong-type IDs, and unauthenticated access.
- [ ] Assert edit success returns the complete `ChatMessageEvent` projection (`id`, `body`, `edited`, `editCount`, `editedAt`, `actor { id }`) and broadcasts the same opaque event ID.
- [ ] Assert remove success returns `removedTimelineEventId`, broadcasts only on the first transition, and repeated removal returns the existing viewer-safe not-found shape without a second broadcast.
- [ ] Run `mix test test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`; expected result is all tests passing without backend production changes.
- [ ] If a contract defect is reproduced, repair only the action-specific `LC.Chat` or resolver path, keep public typespecs current, then run `mix typecheck`.
- [ ] Run formatting checks on touched backend files and commit with `test: prove live chat control contract`.

### Task 2: Add Relay Operations And Pure Per-Row Control State

**Files:**
- Create: `mobile/src/live/chat/liveSessionChatControlOperations.ts`
- Create: `mobile/src/live/chat/liveSessionChatControlsState.ts`
- Create: `mobile/tests/live/liveSessionChatControlsState.test.ts`
- Generate: `mobile/src/__generated__/liveSessionChatControlOperationsEditMutation.graphql.ts`
- Generate: `mobile/src/__generated__/liveSessionChatControlOperationsRemoveMutation.graphql.ts`

**Interfaces:**
- Produces: `liveSessionChatEditMutation`, `liveSessionChatRemoveMutation`, `LiveSessionChatControlsState`, `liveSessionChatControlsReducer`, `canEditChatRow`, and `canRemoveChatRow`.
- Consumed by: Tasks 3-4.

- [ ] Define edit and remove operations using only opaque `chatMessageEventId` inputs; edit selects the full row projection and remove selects the removed opaque ID plus payload errors.
- [ ] Track at most one pending operation per event ID as `{action: 'edit' | 'remove', attemptId}` and row errors as a map keyed by event ID. Reject any same-tick edit or remove while that row has either action pending, while allowing a new action after the prior attempt settles.
- [ ] Implement `canEditChatRow({viewerId, row, sessionStatus})` as actor equality plus non-ended status, and `canRemoveChatRow({viewerId, hostId, row})` as host equality plus a chat-message row.
- [ ] Reject stale mutation completions by row-scoped `attemptId`; removal success tombstones the event ID and invalidates every edit attempt for that row, so a late edit response or error cannot replace, resurrect, or clear the removed row.
- [ ] Map `not_authorized`, `session_ended`, `not_found`, invalid input, unauthenticated, and transport failures to viewer-safe row-level copy.
- [ ] Cover eligibility, pending isolation across rows, same-action duplicates, conflicting edit/remove attempts by a host-author, removal tombstones, stale completion, success/error clearing, and ended-session transitions in focused Bun tests.
- [ ] Run `cd mobile && bun run relay`, `bun test tests/live/liveSessionChatControlsState.test.ts`, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: add live chat control state`.

### Task 3: Reconcile Mutation Results Through The Timeline Reducer

**Files:**
- Create: `mobile/src/live/chat/useLiveSessionChatControls.ts`
- Modify: `mobile/src/live/chat/liveSessionChatTimelineReducer.ts`
- Modify: `mobile/src/live/chat/liveSessionChatTimelineMerge.ts`
- Create: `mobile/tests/live/useLiveSessionChatControls.rntl.tsx`
- Modify: `mobile/tests/live/liveSessionChatTimelineReducer.test.ts`

**Interfaces:**
- Produces: `useLiveSessionChatControls({dispatchTimeline, hostId, sessionStatus, viewerId})` with `editMessage(eventId, body)`, `removeMessage(eventId)`, `controlsState`, and `clearRowError(eventId)`.
- Extends the timeline reducer with `mutation_update_confirmed` and `mutation_remove_confirmed` actions that delegate to existing update/remove merge helpers.

- [ ] Make a confirmed edit merge by opaque event ID, preserving cursor and ordering while replacing body/edit metadata exactly once.
- [ ] Make a confirmed removal delete the row through the existing removal helper. A later duplicate `timeline:event_removed` must be a no-op.
- [ ] Ensure a channel update arriving before the mutation response makes the later identical response a no-op; a later older edit projection must not overwrite a higher `editCount`.
- [ ] Keep the controller's same-tick pending ref independent from React render timing and clear it on completion, auth loss, or unmount.
- [ ] Treat payload errors as row-local failures and provide a refresh/retry path; never clear retained history or the chat composer on control failure.
- [ ] Test response-before-broadcast, broadcast-before-response, duplicate removal, higher-edit-count wins, transport failure, auth loss, and unmount callbacks.
- [ ] Run the focused controller and reducer tests plus `bun run typecheck` and `bun run typecheck:tests`; commit with `feat: reconcile live chat mutations`.

### Task 4: Add Edit And Host Remove Actions To The Chat Panel

**Files:**
- Modify: `mobile/src/live/chat/LiveSessionChatPanel.tsx`
- Modify: `mobile/src/live/chat/liveSessionChatPanelPresentation.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/tests/live/LiveSessionChatPanel.test.ts`
- Create: `mobile/tests/live/LiveSessionWatchScreen.rntl.tsx`

**Interfaces:**
- Consumes: viewer ID, host ID, session status, row actor IDs, Task 3's controller, and existing timeline dispatch.
- Produces: inline author editing and host removal without regressing history/send behavior.

- [ ] Add an Edit action only to eligible authored chat rows. Editing replaces the row body with a bounded text input, Save, and Cancel; Save trims the body and uses the backend's existing length validation.
- [ ] Add Remove only for the host and require a deliberate confirmation press before committing; disable both actions only for the affected row while pending.
- [ ] Show row-local error copy and Retry/Refresh without hiding the row. Ended-session updates must close any edit form and remove Edit immediately.
- [ ] Wire mutation success into timeline dispatch and preserve current send draft, send status, load-older state, scroll identity, and lifecycle rows.
- [ ] Cover author/non-author/host action visibility, edit cancel/save, host removal confirmation, payload/transport errors, ended-session closure, duplicate taps, and response/broadcast races in RNTL tests.
- [ ] Run `cd mobile && bun test tests/live/liveSessionChatControlsState.test.ts tests/live/useLiveSessionChatControls.rntl.tsx tests/live/liveSessionChatTimelineReducer.test.ts tests/live/LiveSessionChatPanel.test.ts tests/live/LiveSessionWatchScreen.rntl.tsx`.
- [ ] Run `cd mobile && bun run test:quality`, then `git diff --check`; commit with `feat: add live chat message controls`.

## Completion And Handoff

- Close this batch only after the backend mutation/channel proof and full mobile quality gate pass.
- After implementation closes, hand back to the coordinator; the coordinator owns the explicitly assigned shared lane-pointer update that promotes `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md` as Batch 5.
- Do not broaden the batch into general viewer deletion, reactions, or chat administration.

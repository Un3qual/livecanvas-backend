# Chat System Events Implementation Plan

**Goal:** Add a bounded, durable system-event layer to live chat so important session lifecycle and moderation changes appear consistently in both realtime delivery and retained chat history.

**Architecture:** Reuse the existing `chat_messages.kind = :system_event` seam instead of creating a second event store. Keep `LC.Chat` as the owner of event persistence and payload normalization, but avoid a `LC.Live -> LC.Chat` dependency cycle by emitting system events from adapter boundaries that already observe successful session transitions (`LCGQL.Live`, `LCWeb.LiveSessionChannel`, and chat moderation adapters).

**Tech Stack:** Elixir 1.15, Phoenix Channels, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Execution Summary

- Status: active
- Track: `docs/plans/chat/TRACK.md`
- Current batch: `Task 3`
- Start after: `docs/plans/chat/2026-03-17-chat-moderation-actions.md` is complete unless dependencies are explicitly revalidated
- Depends on: the shared Relay `ChatMessage` history surface created by the earlier chat slices
- Advance to: this plan's `Task 3`

## Candidate Status Verification (2026-03-17)

Verified directly in active code and tests before writing this plan:

1. **A system-event persistence seam already exists, but it is unused.**
   - Evidence: `chat_messages.kind` supports `:system_event` in `lib/live_canvas_schemas/chat/chat_message.ex` and `lib/live_canvas/chat/chat_message.ex`, but active chat creation only uses default user messages in `LC.Chat.create_message/3`.
2. **Important live-session transitions already exist in adapters.**
   - Evidence: `LCGQL.Live.Resolver` handles go-live and end-live mutations in `lib/live_canvas_gql/live/live_resolver.ex`, and `LCWeb.LiveSessionChannel` already handles join, terminate, and chat-send flow in `lib/live_canvas_web/channels/live_session_channel.ex`.
3. **Channel clients only receive user-authored chat messages today.**
   - Evidence: `"chat:message"` payloads are built only from user-authored `ChatMessage` rows in `LCWeb.LiveSessionChannel`.
4. **GraphQL has no typed system-event projection yet.**
   - Evidence: the planned chat GraphQL surface does not exist yet, and no current GraphQL type exposes a `systemEventType` or similar field.
5. **Per-viewer join/leave events are not yet safe to ship by default.**
   - Evidence: channel termination is best-effort and can race with session shutdown in `LCWeb.LiveSessionChannel`, while runtime ownership/handoff logic already has reconnect-sensitive behavior in `LC.Live`; naive participant events would risk duplicate/noisy history.

## Scope And Assumptions

- Keep the first event set intentionally low-noise and deterministic:
  - session goes live
  - session ends
  - message removed by moderation
- Do not ship participant join/leave system events in this slice unless implementation research proves they can be deduplicated across reconnects and runtime ownership changes without noisy history spam.
- Persist system events in `chat_messages` so history queries and realtime broadcasts converge on one message model.
- Keep the system-event payload vocabulary bounded and typed.
- Assume the chat history plan lands first so the Relay `ChatMessage` node/connection already exists.

## Progress

- [x] Task 1: Add a bounded system-event vocabulary and persistence API in `LC.Chat`
- [x] Task 2: Emit and broadcast lifecycle/moderation system events from existing adapters
- [x] Task 3: Expose typed system-event projections in GraphQL history and finalize verification

### Task 1: Add A Bounded System-Event Vocabulary And Persistence API In `LC.Chat`

**Files:**
- Create: `lib/live_canvas/chat/system_events.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas/chat/chat_message.ex`
- Modify: `lib/live_canvas_schemas/chat.ex`
- Modify as needed: `lib/live_canvas_schemas/chat/chat_message.ex`
- Modify: `test/live_canvas/chat_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing Chat tests for standardized system-event creation
- [x] Step 2: Add failing Chat tests for bounded event-type validation
- [x] Step 3: Run focused Chat tests to verify RED
- [x] Step 4: Implement a normalized system-event builder and `record_system_event/3`
- [x] Step 5: Re-run focused Chat tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- `LC.Chat.record_system_event/3` persists a `chat_messages` row with `kind: :system_event` and a bounded event-type vocabulary.
- System-event rows share the same ordering and history query path as user-authored chat messages.
- The event builder rejects unknown event types instead of storing unbounded metadata contracts.

**Suggested TDD details:**

Step 1 should add coverage for:
- recording a `session_live` event
- recording a `session_ended` event
- recording a `message_removed` event tied to a moderated message

Step 2 should add coverage for:
- rejecting unknown event types
- normalizing event payload metadata into a consistent shape for downstream GraphQL/channel projection

Step 3 command:

```bash
mix test test/live_canvas/chat_test.exs
```

Expected: FAIL because system-event recording helpers and event-type validation do not exist yet.

Step 4 implementation notes:
- Prefer a dedicated internal module such as `LC.Chat.SystemEvents` for event-type normalization.
- Keep payload metadata compact and explicit; do not dump arbitrary resolver assigns or socket payloads into persisted metadata.
- Add a concise comment explaining why the first event set excludes participant join/leave.

Step 6 commands:

```bash
mix compile
mix test test/live_canvas/chat_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add lib/live_canvas/chat/system_events.ex lib/live_canvas/chat.ex lib/live_canvas/chat/chat_message.ex lib/live_canvas_schemas/chat.ex lib/live_canvas_schemas/chat/chat_message.ex test/live_canvas/chat_test.exs docs/plans/chat/2026-03-17-chat-system-events.md
git commit -m "feat: add bounded chat system event helpers"
```

### Task 2: Emit And Broadcast Lifecycle/Moderation System Events From Existing Adapters

**Files:**
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`
- Modify: `test/live_canvas_gql/chat/chat_mutations_test.exs`
- Modify as needed: `test/integration/live_session_flow_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing tests for `session_live` and `session_ended` system-event emission
- [x] Step 2: Add failing tests for moderation-triggered `message_removed` system events
- [x] Step 3: Run focused adapter/integration tests to verify RED
- [x] Step 4: Emit system events after successful live lifecycle and moderation transitions
- [x] Step 5: Broadcast persisted system events over the existing chat channel contract
- [x] Step 6: Re-run focused adapter/integration tests to verify GREEN
- [x] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- A successful go-live transition records and broadcasts one persisted `session_live` system event.
- A successful end-live transition records and broadcasts one persisted `session_ended` system event.
- A successful message-removal moderation action records and broadcasts one persisted `message_removed` system event.
- Event emission avoids a `LC.Live -> LC.Chat` boundary dependency by happening in adapters after successful boundary calls.

**Suggested TDD details:**

Step 1 should add coverage for:
- `goLiveSession` causing a system-event row plus channel-facing broadcast
- `endLiveSession` causing a system-event row plus channel-facing broadcast

Step 2 should add coverage for:
- `removeLiveChatMessage` causing a system-event row plus broadcast after the moderation state transition completes

Step 3 command:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
```

Expected: FAIL because no adapter currently records or broadcasts persisted system events.

Step 4 implementation notes:
- Emit events only after the underlying boundary action succeeds to avoid phantom system messages.
- Reuse the existing `"chat:message"` event with a payload that can represent both user and system messages, rather than introducing a parallel channel topic for system events.
- Add a concise comment where event emission occurs in adapters to document the boundary-cycle avoidance decision.

Step 7 commands:

```bash
mix compile
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
mix typecheck
```

Expected: PASS.

Step 7 commit:

```bash
git add lib/live_canvas_gql/live/live_resolver.ex lib/live_canvas_web/channels/live_session_channel.ex lib/live_canvas_gql/chat/chat_resolver.ex test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs docs/plans/chat/2026-03-17-chat-system-events.md
git commit -m "feat: emit chat lifecycle system events"
```

### Task 3: Expose Typed System-Event Projections In GraphQL History And Finalize Verification

**Files:**
- Modify: `lib/live_canvas_gql/chat/chat_types.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Modify: `docs/plans/chat/2026-03-17-chat-system-events.md`
- Modify: `docs/plans/chat/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [x] Step 1: Add failing GraphQL history tests for typed system-event projection
- [x] Step 2: Run focused GraphQL Chat tests to verify RED
- [x] Step 3: Expose system-event type and metadata fields on `ChatMessage`
- [x] Step 4: Re-run focused GraphQL Chat tests to verify GREEN
- [x] Step 5: Run final verification, update plan/index tracking, and commit the milestone

**Task 3 behavior targets:**

- GraphQL history returns both user messages and system events through one connection.
- System events expose a typed `systemEventType` field (or equivalent) instead of forcing clients to parse raw metadata.
- User-authored messages and system events remain compatible with the same bidirectional history connection.

Verification evidence (2026-03-17):

- `mix test test/live_canvas_gql/chat/chat_queries_test.exs` -> RED first (`4 tests, 1 failure`) and GREEN after implementation (`4 tests, 0 failures`)
- `mix compile` -> PASS
- `mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs` -> PASS (`59 tests, 0 failures`)
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`)

**Suggested TDD details:**

Step 1 should add coverage for:
- a history connection containing both user and system messages in deterministic order
- `systemEventType` resolving for system messages and returning `nil` for user-authored messages

Step 2 command:

```bash
mix test test/live_canvas_gql/chat/chat_queries_test.exs
```

Expected: FAIL because the GraphQL Chat surface does not yet expose typed system-event projections.

Step 3 implementation notes:
- Keep the connection contract additive; do not split user and system messages into separate lists.
- Preserve the same canonical ascending ordering so system events participate in bidirectional pagination without special cases.

Step 5 commands:

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
mix typecheck
```

Expected: PASS.

Step 5 commit:

```bash
git add lib/live_canvas_gql/chat/chat_types.ex lib/live_canvas_gql/chat/chat_resolver.ex test/live_canvas_gql/chat/chat_queries_test.exs docs/plans/chat/2026-03-17-chat-system-events.md docs/plans/README.md
git commit -m "docs: finalize chat system events plan tracking"
```

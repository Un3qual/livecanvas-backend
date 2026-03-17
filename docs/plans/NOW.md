# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-system-events.md`
- Batch: `Task 2: Emit and broadcast lifecycle/moderation system events from existing adapters`
- Why now: Task 1 landed the bounded `LC.Chat.record_system_event/3` seam, so the next unblocked chat milestone is wiring successful live lifecycle and moderation adapters to emit durable system messages over the shared Relay `ChatMessage` model.

## Do This Now

- Add failing tests for `session_live` and `session_ended` system-event emission from the existing live adapters.
- Add failing tests for moderation-triggered `message_removed` system-event emission plus channel broadcasts.
- Emit system events after successful live lifecycle and moderation transitions, then reuse the existing `"chat:message"` transport for persisted system-event broadcasts.
- Run the Task 2 verification commands from `docs/plans/chat/2026-03-17-chat-system-events.md` and mark Task 2 progress as it lands.

## Verification Scope

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
mix compile
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
mix typecheck
```

## Next Up

- `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 3: Expose typed system-event projections in GraphQL history and finalize verification`

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

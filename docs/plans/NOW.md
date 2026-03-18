# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-system-events.md`
- Batch: `Task 3: Expose typed system-event projections in GraphQL history and finalize verification`
- Why now: Task 2 landed durable lifecycle and moderation system-event emission plus shared channel broadcasts, so the next unblocked chat milestone is exposing typed system-event projections through the Relay chat history surface.

## Do This Now

- Add failing GraphQL history tests for mixed user/system-message connections and typed `systemEventType` projection.
- Expose additive typed system-event fields on the shared `ChatMessage` Relay node without splitting history into parallel lists.
- Re-run the focused GraphQL chat history tests, then the Task 3 final verification commands from `docs/plans/chat/2026-03-17-chat-system-events.md`.
- Mark Task 3 progress as it lands and refresh plan/index tracking when the task is complete.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs
mix typecheck
```

## Next Up

- Re-evaluate `docs/plans/chat/TRACK.md` and refresh plan/index tracking after Task 3 closes.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

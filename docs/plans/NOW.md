# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-system-events.md`
- Batch: `Task 1: Add a bounded system-event vocabulary and persistence API in LC.Chat`
- Why now: the moderation batch is complete, and the next unblocked chat milestone is the bounded system-event vocabulary that lifecycle and moderation adapters need before they can emit durable system messages through the shared Relay `ChatMessage` model.

## Do This Now

- Add failing Chat tests for standardized `system_event` creation through `LC.Chat.record_system_event/3`.
- Add failing Chat tests that reject unknown event types and normalize event metadata into a bounded shape.
- Implement the normalized system-event builder plus `record_system_event/3` in `LC.Chat`.
- Run the Task 1 verification commands from `docs/plans/chat/2026-03-17-chat-system-events.md` and mark Task 1 progress as it lands.

## Verification Scope

```bash
mix test test/live_canvas/chat_test.exs
mix compile
mix test test/live_canvas/chat_test.exs
mix typecheck
```

## Next Up

- `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 2: Emit and broadcast lifecycle/moderation system events from existing adapters`

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

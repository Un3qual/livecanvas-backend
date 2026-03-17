# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-moderation-actions.md`
- Batch: `Task 3: Broadcast Realtime Moderation Updates And Finalize Verification`
- Why now: the GraphQL moderation surface is verified, and the next unblocked slice is the realtime reconciliation path for already-joined viewers.

## Do This Now

- Add the failing channel tests for moderation update broadcasts.
- Implement the stable realtime moderation update event in `LCWeb.LiveSessionChannel`.
- Run the Task 3 verification commands from `docs/plans/chat/2026-03-17-chat-moderation-actions.md`.
- Mark Task 3 complete in the plan once the verification evidence is fresh.

## Verification Scope

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix typecheck
```

## Next Up

- `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 1: Add a bounded system-event vocabulary and persistence API in LC.Chat`

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

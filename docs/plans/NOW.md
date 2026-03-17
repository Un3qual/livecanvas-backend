# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-moderation-actions.md`
- Batch: `Task 2: Expose Host-Scoped Moderation Mutations And Moderated Message Reads In GraphQL`
- Why now: chat-history is complete, moderation persistence already landed, and the next unblocked slice is the GraphQL moderation surface.

## Do This Now

- Add the failing GraphQL tests for `removeLiveChatMessage`, moderated history/node redaction, and moderation rate limiting.
- Implement the Chat GraphQL mutation wiring and moderation-aware `ChatMessage` projections.
- Run the Task 2 verification commands from `docs/plans/chat/2026-03-17-chat-moderation-actions.md`.
- Mark Task 2 complete in the plan once the verification evidence is fresh.

## Verification Scope

```bash
mix test test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix compile
mix typecheck
```

## Next Up

- `docs/plans/chat/2026-03-17-chat-moderation-actions.md` -> `Task 3: Broadcast realtime moderation updates and finalize verification`
- `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 1: Add a bounded system-event vocabulary and persistence API in LC.Chat`

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

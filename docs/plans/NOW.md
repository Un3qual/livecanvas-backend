# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-history-query-api.md`
- Batch: `Task 3: Publish The Chat-History Client Contract And Run Verification`
- Why now: the approved chat sequence is history first, then moderation, then system events.

## Do This Now

- Create `docs/contracts/mobile-graphql-chat-history.md`.
- Run the Task 3 verification commands from `docs/plans/chat/2026-03-17-chat-history-query-api.md`.
- Mark Task 3 complete in the plan once the verification evidence is fresh.
- After the milestone commit, advance this file to the next unblocked batch.

## Verification Scope

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix compile
mix typecheck
```

## Next Up

- `docs/plans/chat/2026-03-17-chat-moderation-actions.md` -> `Task 1: Add moderation persistence and host-authority APIs in LC.Chat`
- `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 1: Add a bounded system-event vocabulary and persistence API in LC.Chat`

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

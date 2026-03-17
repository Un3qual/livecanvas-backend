# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `chat`
- Plan: `docs/plans/chat/2026-03-17-chat-moderation-actions.md`
- Batch: `Task 3: Broadcast Realtime Moderation Updates For PR #11 And Finalize Verification`
- Why now: PR `#11` is blocked on a correctness gap where `removeLiveChatMessage` redacts persisted history but leaves already-joined viewers rendering the stale abusive message until they refetch or reconnect.

## Do This Now

- Add the failing GraphQL/channel integration coverage for `removeLiveChatMessage` broadcasting `"chat:message_updated"` to the owning live-session topic only.
- Implement the moderation update broadcast from the successful GraphQL removal path and keep the payload reconcilable with the existing channel message envelope.
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

# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `read_policy`
- Plan: `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
- Batch: `Task 3: Reuse the shared policy helpers in chat/social boundary authorization and verify Relay/auth safety`
- Why now: Task 2 completed locally, so the next unblocked product-facing batch is reusing the shared visibility helper in boundary authorization without weakening Relay or viewer auth guarantees.

## Do This Now

- Identify the remaining chat/social visibility checks that still reconstruct block, mute, and follow/public policy instead of calling `LC.ReadPolicy`.
- Refactor `LC.Chat.authorize_visible_session_access/2` and the relevant `LC.Social` predicates so they reuse the shared helper without weakening viewer-scoped authorization.
- Verify the boundary-side reuse with the focused chat/social Relay and auth slice, plus `mix typecheck` for any typed public API touched during the refactor.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas/social_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs
mix typecheck
```

## Next Up

- Once Task 3 is green and committed, repair `NOW.md` from `docs/plans/INDEX.md` to choose the next unblocked product-facing batch.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

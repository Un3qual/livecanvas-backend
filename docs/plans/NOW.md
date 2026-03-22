# Current Execution

Last reviewed: 2026-03-22
Status: active

## Current Batch

- Track: `profile_content_live_entry`
- Plan: `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Batch: `Task 2: Publish Relay user profile content/live fields in LCGQL.Accounts`
- Why now: Task 1 is complete in `LC.Feed`, so the next unblocked product-facing gap is exposing those viewer-scoped profile content/live read models on the existing Relay `User` node.

## Do This Now

- Add failing GraphQL tests for `viewer` and `node(id:)` profile reads that request `posts`, `storyFeed`, `currentLiveSession`, and `replayFeed` from the Relay `User` node.
- Extend `LCGQL.Accounts` to publish those fields on the existing Relay `User` type and delegate into the new `LC.Feed` profile read models.
- Re-apply child-field authorization so globally refetchable `User` IDs cannot bypass private/follower-only visibility.
- Verify only the Task 2 boundary slice with `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`.

## Verification Scope

```bash
mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

## Next Up

- Once Task 2 is green and committed, move to Task 3 in `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` for slice verification and plan tracking updates.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

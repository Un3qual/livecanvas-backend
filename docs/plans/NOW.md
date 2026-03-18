# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `graphql`
- Plan: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Batch: `Task 2: Migrate the highest-fanout field resolvers to dataloader-backed fetches`
- Why now: Task 1 is complete, and Task 2 is the next unblocked batch in the active GraphQL dataloader plan.

## Do This Now

- Add query-count coverage for repeated user/media lookups across the targeted list and edge resolvers.
- Convert the hot child resolvers to dataloader-backed fetches without weakening existing viewer authorization or fallback semantics.
- Re-run the focused Task 2 GraphQL suites and commit the batching milestone once the repeated lookups are flattened.

## Verification Scope

```bash
mix test test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs
```

## Next Up

- Continue with `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 3` once Task 2 is complete.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

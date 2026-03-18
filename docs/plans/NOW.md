# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `graphql`
- Plan: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Batch: `Task 3: Tighten remaining direct lookups and verify Relay/auth behavior`
- Why now: Task 2 is complete, and Task 3 is the next unblocked batch in the active GraphQL dataloader plan.

## Do This Now

- Add the authorization regression coverage for Relay node fetches and loader-backed child fields.
- Remove any remaining repeated child-field lookups that still bypass the request-scoped loader.
- Re-run the Task 3 compile, GraphQL, and typecheck verification before the auth-preservation milestone commit.

## Verification Scope

```bash
mix compile
mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs
mix typecheck
```

## Next Up

- Complete `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` once Task 3 passes verification.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

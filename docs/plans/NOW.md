# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `read_policy`
- Plan: `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
- Batch: `Task 2: Extract reusable viewer-visibility query helpers and refactor feed queries`
- Why now: Task 1 is complete and committed locally, so the next unblocked product-facing batch is extracting the shared feed visibility helper before boundary-side reuse.

## Do This Now

- Write the Task 2 feed baseline expectation first, then extract a shared read-policy helper for blocked, muted, and follow/public visibility.
- Refactor `LC.Feed.home_feed_query/1`, `live_now_query/1`, and `replay_feed_query/1` to compose the helper without changing visible rows or ordering.
- Run the focused Task 2 feed verification slice once the helper is wired through all three feed query builders.

## Verification Scope

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs
```

## Next Up

- Start `docs/plans/2026-03-18-query-policy-composition-and-reuse.md` Task 3 once the shared feed read-policy helper is green and committed.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

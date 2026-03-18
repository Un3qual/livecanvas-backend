# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `read_policy`
- Plan: `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
- Batch: `Task 1: Baseline the repeated policy matrix and lock behavior with focused tests`
- Why now: the GraphQL dataloader/auth track is complete through Task 3, and this is the next queued product-facing batch in `docs/plans/INDEX.md`.

## Do This Now

- Add or tighten focused feed/social/chat tests that lock the shared blocked, muted, reverse-mute, and follower/public visibility matrix in place.
- Add a regression test that exercises the same visibility rules through GraphQL feed and social surfaces.
- Run the Task 1 feed/social/chat verification slice before extracting shared policy helpers.

## Verification Scope

```bash
mix test \
  test/live_canvas/feed_test.exs \
  test/live_canvas/social_test.exs \
  test/live_canvas/chat_test.exs \
  test/live_canvas_gql/feed/feed_queries_test.exs \
  test/live_canvas_gql/social/social_queries_test.exs \
  test/live_canvas_gql/chat/chat_queries_test.exs \
  test/integration/feed_visibility_flow_test.exs
```

## Next Up

- Start `docs/plans/2026-03-18-query-policy-composition-and-reuse.md` Task 2 once the Task 1 baseline tests are green and committed.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

# Backend Lane NOW

Last reviewed: 2026-07-09
Status: Batch 2 profile-content Relay contract proof complete

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Completed task: Task 1 proved `User.posts`, `User.storyFeed`, and
  `User.replayFeed` cursor ordering, filtering, and authorization.
- Write scope: `test/live_canvas_gql/relay/node_queries_test.exs`.
- Conditional production scope: `lib/live_canvas/feed.ex` and
  `lib/live_canvas_gql/accounts/user_resolver.ex` only if the focused test
  reproduces a real defect.
- Result: deterministic profile connection tests pass without widening viewer
  visibility or accepting raw IDs; no backend production change was required.

## Verification

- `mix format --check-formatted test/live_canvas_gql/relay/node_queries_test.exs`
- `mix test test/live_canvas_gql/relay/node_queries_test.exs`
- Result: 30 tests, 0 failures.

## Next Action

Backend work is complete for Batch 2. The mobile lane now executes Task 2.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Completed Batch 1 plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`

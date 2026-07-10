# Backend Lane NOW

Last reviewed: 2026-07-09
Status: Batch 2 profile-content Relay contract proof active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Current task: Task 1, prove `User.posts`, `User.storyFeed`, and
  `User.replayFeed` cursor ordering, filtering, and authorization.
- Write scope: `test/live_canvas_gql/relay/node_queries_test.exs`.
- Conditional production scope: `lib/live_canvas/feed.ex` and
  `lib/live_canvas_gql/accounts/user_resolver.ex` only if the focused test
  reproduces a real defect.
- Done condition: deterministic profile connection tests pass without widening
  viewer visibility or accepting raw IDs.

## Verification

- `mix format --check-formatted test/live_canvas_gql/relay/node_queries_test.exs`
- `mix test test/live_canvas_gql/relay/node_queries_test.exs`
- `mix typecheck` only if typed backend production code changes.

## Next Action

Execute implementation-plan Task 1 before mobile refactoring. If the tests pass
against existing production code, record that no backend change was needed and
hand off to the mobile lane.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Completed Batch 1 plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`

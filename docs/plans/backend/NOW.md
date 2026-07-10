# Backend Lane NOW

Last reviewed: 2026-07-09
Status: Batch 1 reversible social-control contract active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

- Approved design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Current task: Task 1, add directional and idempotent unfollow/unblock domain
  operations; Task 2 then exposes the Relay GraphQL contract.
- Write scope:
  - `lib/live_canvas/social.ex`
  - `lib/live_canvas_gql/social/**`
  - focused social domain/GraphQL tests
  - `mobile/schema.graphql` only for the exported contract
- Done condition: viewer-scoped `unfollowUser` and `unblockUser` are
  idempotent; `isBlockedByViewer` reports only an outbound block; invalid and
  unauthenticated states remain payload-safe; the focused backend suite and
  typecheck pass.
- Verification:
  - `mix test test/live_canvas/social_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/social/social_queries_test.exs`
  - `mix typecheck`
  - `mix absinthe.schema.sdl --schema LCGQL.Schema mobile/schema.graphql`
  - `git diff --check`

## Next Action

Execute implementation-plan Task 1 with a failing domain test before writing
the domain operations. Do not start mobile Task 3 until backend Task 2 exports
the updated schema.

## References

- Previous completed backend batch:
  `docs/plans/moderation/2026-07-08-report-moderation-operations.md`
- Mobile lane dependency: `docs/plans/mobile/NOW.md`

# Backend Lane NOW

Last reviewed: 2026-07-09
Status: Batch 1 reversible social-control contract complete

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and shared contracts require explicit assignment.

## Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Implementation:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Delivered directional, idempotent `unfollowUser` and `unblockUser` mutations
  plus outbound-only `isBlockedByViewer`.
- Preserved Relay IDs, viewer-derived authorization, reverse relationship rows,
  and payload-safe invalid/authentication failures.

## Verification

- Batch files pass `mix format --check-formatted` when checked explicitly.
- Focused social domain/GraphQL suite: 49 tests, 0 failures.
- `mix typecheck`: 0 errors.
- `mix absinthe.schema.sdl --schema LCGQL.Schema mobile/schema.graphql`: passed
  with no resulting schema diff.
- Repository-wide `mix format --check-formatted` remains blocked by seven
  pre-existing, untouched files outside this batch; no unrelated formatting
  churn was included.

## Next Action

No backend batch is executable. Await an approved Batch 2 Profile Content
Surfaces implementation plan and promote backend work only if that plan names a
backend contract or data dependency.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Previous backend batch:
  `docs/plans/moderation/2026-07-08-report-moderation-operations.md`

# Backend Lane NOW

Last reviewed: 2026-07-09
Status: directional block-privacy fix active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

- Source plan:
  `docs/superpowers/plans/2026-07-09-directional-block-privacy.md`
- Task: make a user who blocked the viewer indistinguishable from a missing
  account across public GraphQL profile, social, request, and contact surfaces.
- Write scope: `lib/live_canvas/social.ex`, relevant `lib/live_canvas_gql/**`,
  focused backend tests, and this lane pointer.
- Done condition: hidden and missing users have identical reads/errors;
  viewer-owned blocks remain direction-safe; user-bearing projections omit
  blockers; symmetric content/chat policy and staff moderation remain intact.
- Verification:
  - Focused Social, Relay node, contact, and GraphQL mutation/query tests named
    in the source plan.
  - `mix typecheck`
  - `git diff --check`

## Next Action

Execute Task 1 test-first: add the directional Social predicate and query
filtering, prove RED, then implement the minimal domain policy.

## References

- Previous completed backend foundation:
  `docs/plans/archive/completed/backend/2026-06-04-live-media-runtime-foundation.md`
- Mobile product-gap batch: `docs/plans/mobile/NOW.md`

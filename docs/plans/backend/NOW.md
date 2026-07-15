# Backend Lane NOW

Last reviewed: 2026-07-15
Status: mobile magic-link delivery complete; release QA pending

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Completed scope: Task 1 replaced the placeholder magic-link URL with a
  configured fragment-only HTTPS landing and added its minimal public endpoint.
- Result: sign-in and sign-up challenge emails use the trusted origin,
  raw tokens never reach request paths or queries, and the hardened landing
  emits only the matching custom-scheme handoff.

## Verification

- Landing asset tests: 5 passed.
- Repository-wide formatting and the production asset build pass.
- `mix typecheck`: zero Dialyzer errors.
- Full backend suite: 1,023 tests, zero failures, one excluded.

## Next Action

Stand by for operator/device email-link QA findings; no backend implementation
is queued from this completed batch.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active magic-link plan:
  `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Active mobile QA gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

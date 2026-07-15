# Backend Lane NOW

Last reviewed: 2026-07-15
Status: mobile magic-link delivery contract active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Current scope: Task 1 only—replace the placeholder magic-link URL with a
  configured fragment-only HTTPS landing and add its minimal public endpoint.
- Write scope: `LCGQL.Accounts.AuthResolver`, public magic-link
  controller/template/routes, dedicated landing assets, and focused tests.
- Done condition: sign-in and sign-up challenge emails use the trusted origin,
  raw tokens never reach request paths or queries, and the hardened landing
  emits only the matching custom-scheme handoff.

## Verification

- Run focused resolver/controller/asset tests, changed-file formatting,
  warnings-as-errors compilation, `mix typecheck`, the full backend suite, and
  patch hygiene.

## Next Action

Implement Task 1, record its evidence, then hand off to mobile Tasks 2-4.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active magic-link plan:
  `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Active mobile QA gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

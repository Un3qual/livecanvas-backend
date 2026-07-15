# Backend Lane NOW

Last reviewed: 2026-07-15
Status: basic profile identity active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-basic-profile-identity-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-basic-profile-identity.md`
- Current scope: Tasks 1-2—nullable identity persistence, canonical validation,
  authorized public fields, and viewer-scoped atomic editing.
- Done condition: handles are canonical and race-safe unique, existing users
  remain valid, and Relay cannot bypass blocked-viewer policy or ownership.

## Verification

- Run migration reset, focused Accounts/GraphQL/node tests, formatting,
  warnings-as-errors compilation, `mix typecheck`, full tests, and patch hygiene.

## Next Action

Implement Task 1, then expose and export the Task 2 Relay contract for mobile.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active identity plan:
  `docs/superpowers/plans/2026-07-15-basic-profile-identity.md`
- Active mobile QA gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

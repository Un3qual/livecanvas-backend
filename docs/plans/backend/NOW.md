# Backend Lane NOW

Last reviewed: 2026-07-15
Status: native contact bulk import active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Cross-lane mobile contract work must name its backend write scope explicitly.
- Shared coordinator docs and contracts require explicit assignment.

## Current Batch

- Design: `docs/superpowers/specs/2026-07-15-native-contact-import-design.md`
- Source plan: `docs/superpowers/plans/2026-07-15-native-contact-import.md`
- Current scope: Task 1 only—viewer-scoped atomic bulk upsert over the existing
  contact normalization and matching model.
- Done condition: 1-100 entries validate before one transaction, retries remain
  idempotent, and GraphQL never accepts a target user ID.

## Verification

- Run focused Accounts/GraphQL contact tests, repository-wide formatting,
  warnings-as-errors compilation, `mix typecheck`, the full suite, and patch
  hygiene.

## Next Action

Implement Task 1 and hand the bounded mutation contract to mobile Tasks 2-3.

## References

- Mobile lane: `docs/plans/mobile/NOW.md`
- Active contact-import plan:
  `docs/superpowers/plans/2026-07-15-native-contact-import.md`
- Active mobile QA gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: release-depth Batch 1 host local preview active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: Batch 1 renders the already-acquired host camera stream in
  preflight without acquiring or owning a second stream.
- Write scope: `mobile/src/host/**`, `mobile/tests/host/**`, and this lane
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: ready/unavailable/late/cleanup paths pass focused tests and
  the host preview reuses the cached publishing stream.
- Verification: focused host Vitest and Jest/RNTL suites, mobile typechecks,
  lint, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Execute Batch 1. After its milestone commit, advance this pointer to Batch 2
live audience count.

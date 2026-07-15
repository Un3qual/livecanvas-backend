# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: release-depth Batch 2 live audience count active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: Batch 2 renders the existing realtime `viewerCount` as
  session-scoped live audience state, including zero and singular labels.
- Write scope: `mobile/src/live/watch/**`, `mobile/tests/live/**`, and this lane
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: realtime count updates render correctly and session changes
  or stale channel callbacks cannot leak audience state between broadcasts.
- Verification: focused live realtime Vitest and watch-screen Jest/RNTL suites,
  mobile typechecks, lint, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Execute Batch 2. After its milestone commit, advance this pointer to Batch 3
foreground/background recovery.

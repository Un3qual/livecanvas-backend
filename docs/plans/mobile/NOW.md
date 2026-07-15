# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: release-depth Batch 4 content media rendering active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Current scope: Batch 4 renders validated processed image and video assets in
  post/story cards while preserving processing, failure, and invalid-URL states.
- Write scope: `mobile/src/content/**`, `mobile/tests/content/**`, mobile package
  metadata, and this lane pointer. Promote backend work only if a focused
  contract test fails.
  pointer. Promote backend work only if a focused contract test fails.
- Done condition: processed images and videos render through shared components,
  load failures fall back safely, and unnormalized URLs never reach native UI.
- Verification: focused content RNTL suites, mobile typechecks, lint, frozen
  pnpm install, and patch hygiene.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Next Action

Execute Batch 4. After its milestone commit, advance this pointer to Batch 5
dedicated story viewer.

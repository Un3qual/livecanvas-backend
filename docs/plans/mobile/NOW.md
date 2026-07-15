# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: post attribution and author navigation active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Current Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-post-attribution-navigation-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-post-attribution-navigation.md`
- Write scope: post identity presentation, shared profile routing, Home/profile
  content author actions, dedicated story-viewer author navigation, generated
  Relay artifacts, and mobile lane documentation.
- Done condition: privacy-safe attribution replaces the generic creator copy,
  every post/story surface reaches self or other profiles through opaque Relay
  IDs, and the full local mobile closure matrix passes.
- Operator/device QA remains pending and is not completed by this batch.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Focused identity/navigation Vitest and content-surface RNTL suites.
- Relay generation, both TypeScript checks, lint, full mobile automated tests,
  `nix flake check`, and patch hygiene.

## Next Action

Execute Task 3 from the source plan. After batch closure, resume the
target-environment inventory and physical-device QA in
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`.

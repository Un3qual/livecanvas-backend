# Mobile Lane NOW

Last reviewed: 2026-07-14
Status: post attribution and author navigation complete; operator/device QA pending

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Consume explicitly promoted backend contracts recorded in the backend lane.
- Keep Relay IDs/cursors opaque and durable reads/writes Relay-first.

## Completed Batch

- Design:
  `docs/superpowers/specs/2026-07-14-mobile-post-attribution-navigation-design.md`
- Source plan:
  `docs/superpowers/plans/2026-07-14-mobile-post-attribution-navigation.md`
- Completed scope: privacy-safe post identity presentation, shared self/other
  profile routing, author actions across Home and profile content, and dedicated
  story-viewer author navigation.
- Pull request: #125.
- Operator/device QA remains pending and is not completed by this batch.

## Deferred Scope

- Native address-book import, bulk contact upload, multi-viewer scale, store
  submission, and other checklist-deferred follow-up remain out of scope.

## Verification

- Focused identity/navigation and content-surface suites pass.
- Relay generation, both TypeScript checks, lint, 77 Vitest files with 567
  tests, 28 Jest suites with 194 tests, `nix flake check`, and patch hygiene
  pass.

## Next Action

Resume the target-environment inventory and physical-device QA in
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`.

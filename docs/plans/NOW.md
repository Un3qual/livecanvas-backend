# Current Execution

Last reviewed: 2026-07-15
Status: mobile magic-link authentication active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Current design:
  `docs/superpowers/specs/2026-07-15-mobile-magic-link-auth-design.md`
- Current implementation:
  `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md`
- Current batch: configured fragment-only magic-link delivery, strict mobile
  handoff, request UI, and GraphQL redemption into the existing auth session.
- Completed milestones: all five release-depth batches are implemented and the
  full local closure matrix passes.
- Completed batch: post attribution and author-profile navigation in PR #125.
- Completed design:
  `docs/superpowers/specs/2026-07-14-mobile-post-attribution-navigation-design.md`
- Completed plan:
  `docs/superpowers/plans/2026-07-14-mobile-post-attribution-navigation.md`
- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Previous completed implementation:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 3 implementation plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 4 implementation plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 5 implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- All five approved product batches are complete.
- Release-candidate device QA resumes from
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: magic-link delivery and public landing are active in Task 1.
- Write scope: auth resolver URL construction, public magic-link landing,
  focused assets, routes, and tests only.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: magic-link handoff, request, and redemption Tasks 2-4 are active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: Relay generation, typechecks, lint, 77 Vitest files with 567
  tests, 28 Jest suites with 194 tests, `nix flake check`, and patch hygiene
  pass.

## Execution Rule

Execute `docs/superpowers/plans/2026-07-15-mobile-magic-link-auth.md` in order.
Do not mark operator or physical-device QA complete from local evidence.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Complete backend fragment-only delivery first, then the mobile credential
handoff, request action, and redemption route. Return to physical-device QA
after full local closure verification.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

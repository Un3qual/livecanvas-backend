# Current Execution

Last reviewed: 2026-07-14
Status: mobile release-depth Batch 4 active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Current sequence design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Current implementation plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Completed milestones: Batches 1-3 host preview, audience count, and
  foreground/background recovery.
- Current batch: Batch 4 post and story media rendering.
- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
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
- State: Batch 5 backend Tasks 1-3 complete; stand by only for defects found by
  release-candidate QA.
- Verification: neutral invite delivery, trusted public-origin configuration,
  endpoint-neutral public landing, focused GraphQL behavior, assets, types, and
  the 1,010-test backend suite pass.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: release-depth Batches 1-3 are complete; Batch 4 content media rendering
  is active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: configured-origin invite routing and the full mobile quality
  gate pass with 552 Vitest and 165 Jest tests; typechecks, lint, frozen pnpm
  install, and patch hygiene pass. Relay inputs were unchanged by the
  integration fixes.

## Execution Rule

Execute the five release-depth batches from
`docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md` in order.
Do not mark operator or physical-device QA complete from local evidence.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Complete Batch 4 media rendering, then advance the mobile lane to the dedicated
story viewer.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

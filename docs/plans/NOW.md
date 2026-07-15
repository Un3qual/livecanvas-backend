# Current Execution

Last reviewed: 2026-07-14
Status: mobile release-depth complete; operator/device QA pending

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Current sequence design:
  `docs/superpowers/specs/2026-07-14-mobile-release-depth-next-five-design.md`
- Current implementation plan:
  `docs/superpowers/plans/2026-07-14-mobile-release-depth-next-five.md`
- Completed milestones: all five release-depth batches are implemented and the
  full local closure matrix passes.
- Current batch: none; operator/device QA owns the next release gate.
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
- State: release-depth Batches 1-5 and local closure verification are complete;
  device/operator QA is pending.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: frozen pnpm install, Relay generation, typechecks, lint, 76
  Vitest files with 563 tests, 27 Jest suites with 182 tests, `nix flake check`,
  and patch hygiene pass.

## Execution Rule

Do not start another implementation batch until device/operator QA reproduces a
defect or the coordinator explicitly promotes new work. Do not mark operator or
physical-device QA complete from local evidence.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

The release operator should confirm the target-environment inventory and run
the physical-device checklist. Promote reproduced defects to the owning lane.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

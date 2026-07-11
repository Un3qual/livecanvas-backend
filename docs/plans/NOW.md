# Current Execution

Last reviewed: 2026-07-11
Status: Batches 1-2 complete; Batches 3-5 planned; Batch 3 awaiting approval

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Batch 3 implementation plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 4 implementation plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 5 implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- Remaining order after Batch 2: media post publishing, live-chat message
  controls, then end-to-end contact invitations.
- Release-candidate device QA remains deferred until all five batches close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: Batch 3 planning-only; backend upload finalization, processed-only
  attachment, and schema-privacy work is defined, but no implementation batch
  is active.
- Verification: 30 node-query tests, 0 failures.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 3 planning-only; no mobile implementation batch is active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: 13 focused Bun, 54 focused Jest, 464 full Bun, and 104 full
  Jest tests passed; Relay generation, typechecks, lint, and patch hygiene pass.

## Execution Rule

No implementation batch is active. Review Batch 3's implementation plan before
promoting either lane. Batches 4-5 stay queued even though their plans now exist.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Review and approve Batch 3, Media Post Publishing. After approval, promote its
explicit backend lifecycle and mobile implementation scopes into the lane
pointers without activating Batches 4-5.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

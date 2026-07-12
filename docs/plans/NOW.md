# Current Execution

Last reviewed: 2026-07-11
Status: Batch 4 complete; Batch 5 End-to-End Contact Invitations active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 3 implementation plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 4 implementation plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 5 implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- Remaining product batch: end-to-end contact invitations.
- Release-candidate device QA remains deferred until all five batches close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: Batch 5 Task 1 recipient-bound one-time consumption is next.
- Verification: Batch 4's 53 focused and 980 full backend tests pass;
  typecheck and warnings-as-errors compilation pass.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 4 Tasks 2-4 complete; wait for Batch 5 backend Tasks 1-3 before
  executing mobile Tasks 4-5.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: 33 focused Bun, 11 focused Jest, 508 full Bun, and 142 full
  Jest tests passed; Relay generation, typechecks, lint, and patch hygiene pass.

## Execution Rule

Execute Batch 5 from
`docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`. Complete
backend Tasks 1-3 before mobile Tasks 4-5.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Execute Batch 5 Task 1, Add Recipient-Bound One-Time Consumption.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

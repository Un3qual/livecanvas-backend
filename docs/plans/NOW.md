# Current Execution

Last reviewed: 2026-07-11
Status: Batch 3 complete; Batch 4 Live-Chat Message Controls active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 3 implementation plan:
  `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- Batch 4 implementation plan:
  `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- Batch 5 implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- Remaining order after Batch 3: live-chat message controls, then end-to-end
  contact invitations.
- Release-candidate device QA remains deferred until all five batches close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: Batch 4 Task 1 backend authorization/broadcast proof is next.
- Verification: Batch 3 backend lifecycle verification and the 966-test backend
  regression suite pass.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 3 Tasks 2-4 complete; wait for Batch 4 backend Task 1 before
  executing mobile Tasks 2-4.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: 27 focused Bun, 23 focused Jest, 490 full Bun, and 126 full
  Jest tests passed; Relay generation, typechecks, lint, and patch hygiene pass.

## Execution Rule

Execute Batch 4 from
`docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`. Complete
backend Task 1 before mobile Tasks 2-4. Batch 5 remains queued.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Complete Batch 4, Live-Chat Message Controls, then close both lane pointers and
promote Batch 5, End-to-End Contact Invitations.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

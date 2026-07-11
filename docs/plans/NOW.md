# Current Execution

Last reviewed: 2026-07-09
Status: Batch 2 Profile Content Surfaces complete; Batch 3 planning next

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Latest completed implementation:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- Remaining order after Batch 2: media post publishing, live-chat message
  controls, then end-to-end contact invitations.
- Release-candidate device QA remains deferred until all five batches close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: closed for Batch 2; no backend production change was required.
- Verification: 30 node-query tests, 0 failures.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: closed for Batch 2; no mobile implementation batch is active.
- Track: `docs/plans/mobile/TRACK.md`
- Verification: 13 focused Bun, 54 focused Jest, 464 full Bun, and 104 full
  Jest tests passed; Relay generation, typechecks, lint, and patch hygiene pass.

## Execution Rule

No implementation batch is active. Prepare Batch 3 design and execution plan
without starting code or promoting a lane until the user approves it.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Design and plan Batch 3, Media Post Publishing. Do not execute or activate the
batch until that plan is approved.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

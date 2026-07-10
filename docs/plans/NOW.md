# Current Execution

Last reviewed: 2026-07-09
Status: Batch 2 Profile Content Surfaces active

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Approved Sequence

- Sequence design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Batch 2 design:
  `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`
- Current implementation:
  `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`
- Batch 1 reversible social controls is complete in stacked base PR #115.
- Remaining order after Batch 2: media post publishing, live-chat message
  controls, then end-to-end contact invitations.
- Release-candidate device QA remains deferred until all five batches close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: Batch 2 existing-contract proof complete with no production change.
- Verification: 30 node-query tests, 0 failures.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active for implementation-plan Task 4.
- Track: `docs/plans/mobile/TRACK.md`
- Current tasks: implementation-plan Tasks 4-6.

## Execution Rule

Execute Batch 2 in the implementation plan's task and commit order. Do not
change backend production code unless Task 1 reproduces a contract defect. Do
not activate Batches 3-5.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Action

Execute mobile Task 4. After final gates pass, close both lanes and make Batch 3,
Media Post Publishing, the next planning action.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

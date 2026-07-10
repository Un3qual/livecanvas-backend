# Current Execution

Last reviewed: 2026-07-09
Status: next-five-product-batches sequence active; Batch 1 reversible social controls selected

## Purpose

This is the coordinator dashboard. Lane `NOW.md` files own executable details.

## Active Sequence

- Approved design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Current implementation plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Batch order: reversible social controls, profile content surfaces, media post
  publishing, live-chat message controls, then end-to-end contact invitations.
- Release-candidate device QA remains deferred until the five product batches
  close.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: active for Batch 1 domain and GraphQL contracts.
- Current task: implementation-plan Task 1, directional domain operations.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active for Batch 1 presentation and profile controls after the backend
  schema lands.
- Track: `docs/plans/mobile/TRACK.md`
- Dependency: implementation-plan Tasks 1-2 must finish before mobile Tasks
  3-4 consume the schema.

## Execution Rule

Open the relevant lane pointer first. Execute Batch 1 in the implementation
plan's task and commit order. Batches 2-5 remain queued design scope, not
simultaneously executable work.

## Cross-Lane Policy

Do not defer a reproduced backend contract, resolver, runtime, or data issue
solely because the visible surface is mobile. Promote it into the backend lane,
state the write scope, and verify both affected sides.

## Next Coordinator Decision

Execute Batch 1 only. After its final gates pass, close both lane pointers and
create the implementation plan for Batch 2, Profile Content Surfaces.

## Repair Conditions

Repair this dashboard when a lane pointer or status stops matching its lane
`NOW.md`, another lane is reprioritized, or shared ownership policy changes.

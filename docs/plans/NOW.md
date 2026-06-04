# Current Execution

Last reviewed: 2026-06-03
Status: active

## Purpose

This file is the coordinator dashboard only. It names the active lanes and points
to the lane `NOW.md` files. The lane `NOW.md` owns executable current-batch
details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: active; live media signaling contract is selected as the next product
  batch
- Scope: backend code and backend planning docs
- Source plan: `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: idle; host broadcast native capability/preflight is complete
- Scope: `mobile/` and `docs/plans/mobile/**`

## Execution Rule

For ordinary work, open the relevant lane pointer and execute from that file.
Use `docs/plans/INDEX.md` only if a lane pointer is stale, blocked, empty, or
explicitly asks for registry/backlog lookup.

## Shared File Policy

Only a coordinator-assigned task edits `docs/plans/NOW.md`,
`docs/plans/INDEX.md`, `AGENTS.md`, `ARCHITECTURE.md`, or shared contract/schema
docs. Lane workers update their lane `NOW.md`, source detailed plan, and lane
track docs.

## Next Coordinator Decision

Execute the backend lane Task 1 from `docs/plans/backend/NOW.md`. After the
backend media signaling contract plan closes, choose exactly one follow-up:

1. Mobile media integration against the backend signaling contract.
2. Backend Membrane/WebRTC media runtime implementation.
3. Mobile chat realtime stream plus retained history, if media remains
   intentionally deferred.

## Repair Conditions

Repair this dashboard when:

- a lane pointer is wrong
- lane status no longer matches the lane `NOW.md`
- another lane is explicitly reprioritized
- shared ownership policy changes

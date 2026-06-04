# Current Execution

Last reviewed: 2026-06-04
Status: idle

## Purpose

This file is the coordinator dashboard only. It names the active lanes and points
to the lane `NOW.md` files. The lane `NOW.md` owns executable current-batch
details.

## Lane Pointers

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: idle; live media runtime foundation is complete
- Scope: backend code and backend planning docs
- Completed source plan:
  `docs/plans/backend/2026-06-04-live-media-runtime-foundation.md`

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: idle; chat realtime stream plus retained history is complete
- Scope: `mobile/` and `docs/plans/mobile/**`
- Completed source plan:
  `docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md`

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

Select the next product-completeness batch. If the mobile lane remains the
priority, promote testing, beta distribution, and release readiness from
`docs/plans/mobile/TRACK.md`.

## Repair Conditions

Repair this dashboard when:

- a lane pointer is wrong
- lane status no longer matches the lane `NOW.md`
- another lane is explicitly reprioritized
- shared ownership policy changes

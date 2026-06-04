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
- State: idle; no backend implementation batch is currently selected
- Scope: backend code and backend planning docs

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active; host broadcast native capability/preflight is in progress
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

After the mobile host broadcast preflight closes, choose whether the next product
batch is backend media signaling contract planning or an explicitly deferred
mobile chat batch.

## Repair Conditions

Repair this dashboard when:

- a lane pointer is wrong
- lane status no longer matches the lane `NOW.md`
- another lane is explicitly reprioritized
- shared ownership policy changes

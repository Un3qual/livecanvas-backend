# Live Replay Track Summary

Use this file to navigate the live replay planning set without reopening `ARCHITECTURE.md` on every execution turn.

## Goal

Deliver durable live-session recording linkage first, then layer any replay discovery surfaces on top of the same Relay `LiveSession` and `MediaAsset` contract.

## Ordered Plans

1. `docs/plans/live/2026-03-17-live-session-recording-linkage.md`
   - Status: active
   - Current batch: `Task 1`
   - Why first: the architecture requires replay/recording linkage at session end, but the current schemas, `LC.Live`, and GraphQL live-session surface still have no durable recording reference

## Shared Constraints

- Keep `LC.Live` responsible for lifecycle transitions and end-of-session linkage.
- Reuse existing `media_assets` as the recording resource; do not invent a parallel recording table in this slice.
- Keep the GraphQL surface Relay-first and additive on the existing `LiveSession` node.
- Preserve ownership checks so hosts can link only their own recording assets.

## Source Rationale

- Architecture: `ARCHITECTURE.md`
- Current pointer: `docs/plans/NOW.md`

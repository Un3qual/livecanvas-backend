# Live Replay Track Summary

Use this file to navigate the live replay planning set without reopening `ARCHITECTURE.md` on every execution turn.

## Goal

Deliver durable live-session recording linkage first, then layer any replay discovery surfaces on top of the same Relay `LiveSession` and `MediaAsset` contract.

## Ordered Plans

1. `docs/plans/archive/completed/live/2026-03-17-live-session-recording-linkage.md`
   - Status: completed
   - Why first: the architecture required durable replay/recording linkage at session end before any replay discovery surface could reuse the existing `LiveSession` and `MediaAsset` contracts
2. `docs/plans/live/2026-03-18-live-replay-feed-surfaces.md`
   - Status: active
   - Current batch: `Task 1`
   - Why next: replay metadata is now persisted on ended sessions, but Feed still lacks replay discovery and Relay live-session node fetches are not viewer-scoped

## Shared Constraints

- Keep `LC.Live` responsible for lifecycle transitions and end-of-session linkage.
- Reuse existing `media_assets` as the recording resource; do not invent a parallel recording table in this slice.
- Keep the GraphQL surface Relay-first and additive on the existing `LiveSession` node.
- Preserve ownership checks so hosts can link only their own recording assets.
- Re-apply session visibility when replay surfaces or node refetches follow durable live-session IDs.

## Source Rationale

- Architecture: `ARCHITECTURE.md`
- Current pointer: `docs/plans/NOW.md`

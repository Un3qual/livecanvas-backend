# Live Replay Track Summary

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

Use this file to navigate the live replay planning set without reopening `ARCHITECTURE.md` on every execution turn.

## Goal

Deliver durable live-session recording linkage first, then layer any replay discovery surfaces on top of the same Relay `LiveSession` and `MediaAsset` contract.

## Track Status

- Status: completed
- Completed on: `2026-03-18`
- Next backend batch at track close: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 1`

## Ordered Plans

1. `docs/plans/archive/completed/live/2026-03-17-live-session-recording-linkage.md`
   - Status: completed
   - Why first: the architecture required durable replay/recording linkage at session end before any replay discovery surface could reuse the existing `LiveSession` and `MediaAsset` contracts
2. `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md`
   - Status: completed
   - Why next: replay metadata was persisted on ended sessions, and this slice completed replay discovery in Feed plus viewer-scoped Relay live-session refetches

## Shared Constraints

- Keep `LC.Live` responsible for lifecycle transitions and end-of-session linkage.
- Reuse existing `media_assets` as the recording resource; do not invent a parallel recording table in this slice.
- Keep the GraphQL surface Relay-first and additive on the existing `LiveSession` node.
- Preserve ownership checks so hosts can link only their own recording assets.
- Re-apply session visibility when replay surfaces or node refetches follow durable live-session IDs.

## Source Rationale

- Architecture: `ARCHITECTURE.md`
- Coordinator dashboard after track close: `docs/plans/NOW.md`

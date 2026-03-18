# Plans Index

Use this file only when `docs/plans/NOW.md` is stale, blocked, or empty.

## Active Tracks

### GraphQL Batching And N+1 Reduction

- Plan: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Status: active
- Current batch: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 1`
- Next queued batch: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 2`
- Notes: add request-scoped dataloader support in LCGQL first, then batch the highest-fanout child lookups without weakening Relay or viewer-scoped auth checks

### Release Roadmap And Planning Holes

- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Status: reference-only for now
- Notes: use this roadmap when there is no runnable product track or queued implementation batch in `NOW.md`; it is not the per-turn execution pointer

## Queued Candidate Work

### Shared Read-Policy Query Composition

- Plan: `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
- Status: queued
- Notes: centralizes repeated block/mute/follow/visibility query composition across Feed, Chat, and Social so future read surfaces reuse one policy vocabulary

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- Chat product surface track is complete through `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 3`.
- Live replay and recording track is complete through `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md` -> `Task 3`.
- Checklist-complete plans belong in `docs/plans/archive/completed/`.
- Archived plans are historical context, not the default starting point for a new execution turn.

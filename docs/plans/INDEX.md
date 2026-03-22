# Plans Index

Use this file only when `docs/plans/NOW.md` is stale, blocked, or empty.

## Active Tracks

### Live Session Channel State And Presence

- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Status: active
- Current batch: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 1`
- Next queued batch: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 2`
- Notes: closes the remaining architecture gap around channel-level live-room state by publishing bounded aggregate status/viewer-count updates on the existing `live_session:<id>` topic

### Release Roadmap And Planning Holes

- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Status: reference-only for now
- Notes: use this roadmap when there is no runnable product track or queued implementation batch in `NOW.md`; it is not the per-turn execution pointer

## Queued Candidate Work

- No additional queued candidate work is currently staged ahead of the active live-session state/presence track.


### Mobile Expo Frontend Planning Track

- Source: `docs/plans/mobile/TRACK.md`
- Status: bootstrap complete
- Notes: the initial Expo `blank-typescript` scaffold and isolated `mobile/flake.nix` now exist; continue with detailed mobile slices here when frontend work is explicitly reprioritized

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- User Profile Content And Live Entry is complete through `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` -> `Task 3`.
- Post Media Attachments And Story Feed is complete through `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md` -> `Task 3`.
- Shared Read-Policy Query Composition is complete through `docs/plans/2026-03-18-query-policy-composition-and-reuse.md` -> `Task 3`.
- GraphQL batching and N+1 reduction is complete through `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 3`.
- Chat product surface track is complete through `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 3`.
- Live replay and recording track is complete through `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md` -> `Task 3`.
- Checklist-complete plans belong in `docs/plans/archive/completed/`.
- Archived plans are historical context, not the default starting point for a new execution turn.

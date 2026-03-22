# Plans Index

Use this file only when a lane-specific `NOW.md` is stale, blocked, or empty, or when `docs/plans/NOW.md` needs coordinator repair.

## Execution Lanes

### Backend Lane

- Lane pointer: `docs/plans/backend/NOW.md`
- Status: active for planning
- Current track: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Current batch: create the next detailed backend implementation plan
- Next queued batch: the first executable batch from the new backend plan
- Notes: backend lane owns backend code and backend planning docs only; shared dashboard/index updates stay with the coordinator

### Mobile Lane

- Lane pointer: `docs/plans/mobile/NOW.md`
- Status: active for execution
- Current track: `docs/plans/mobile/TRACK.md`
- Current batch: `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md` -> `Task 1`
- Next queued batch: `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md` -> `Task 2`
- Notes: mobile lane owns `mobile/` and `docs/plans/mobile/**` only; report backend contract dependencies instead of editing backend code directly

## Track Status

### Live Session Channel State And Presence

- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Status: completed
- Current batch: completed through `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 3`
- Next queued batch: none; backend lane returns to roadmap-driven planning
- Notes: closed the remaining architecture gap around channel-level live-room state by publishing bounded aggregate status/viewer-count updates on the existing `live_session:<id>` topic

### Release Roadmap And Planning Holes

- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- Status: active for backend planning
- Notes: this roadmap is now the backend lane's planning source until the next executable product batch is written

## Queued Candidate Work

- The active backend lane remains on the live-session state/presence track unless another slice is explicitly reprioritized.

### Development Seed Data

- Plan: `docs/plans/2026-03-22-development-seed-data.md`
- Status: queued
- Notes: add deterministic development-only seed accounts, social graph edges, feed posts, and a local live-session fixture through `priv/repo/seeds.exs` so backend and mobile work stop depending on manual data setup.

### Mobile Expo Frontend Planning Track

- Source: `docs/plans/mobile/TRACK.md`
- Status: bootstrap complete; the mobile lane is executing the next post-bootstrap shell batch
- Notes: the initial Expo `blank-typescript` scaffold and isolated `mobile/flake.nix` now exist; the next mobile step is to lock the app shell topology before auth, Relay, or realtime work lands

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- User Profile Content And Live Entry is complete through `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` -> `Task 3`.
- Post Media Attachments And Story Feed is complete through `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md` -> `Task 3`.
- Shared Read-Policy Query Composition is complete through `docs/plans/2026-03-18-query-policy-composition-and-reuse.md` -> `Task 3`.
- GraphQL batching and N+1 reduction is complete through `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 3`.
- Chat product surface track is complete through `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 3`.
- Live session channel state/presence is complete through `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 3`.
- Live replay and recording track is complete through `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md` -> `Task 3`.
- Checklist-complete plans belong in `docs/plans/archive/completed/`.
- Archived plans are historical context, not the default starting point for a new execution turn.

# Plans Index

Use this file only when a lane-specific `NOW.md` is stale, blocked, or empty, or when `docs/plans/NOW.md` needs coordinator repair.

## Execution Lanes

### Backend Lane

- Lane pointer: `docs/plans/backend/NOW.md`
- Status: `GEN-001` chat timeline/event-object backend implementation complete; no unblocked backend implementation batch remains
- Current track: none active after `GEN-001` closeout
- Current batch: none
- Next queued batch: none selected
- Notes: backend lane owns backend code and backend planning docs only; shared dashboard/index updates stay with the coordinator unless explicitly assigned

### Mobile Lane

- Lane pointer: `docs/plans/mobile/NOW.md`
- Status: active for execution
- Current track: `docs/plans/mobile/TRACK.md`
- Current batch: `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md` -> `Task 1`
- Next queued batch: `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md` -> `Task 2`
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
- Status: paused; no active backend implementation batch is selected
- Notes: return to this roadmap only after the backend lane is explicitly reprioritized again

### Backend Code Quality Cleanup

- Plan: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- Status: cleanup-stage implementation complete
- Current batch: none
- Notes: `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-006`, `GQL-007`, `GQL-008`, `GQL-009`, `GEN-002`, `WEB-001`, `ECTO-001`, `CTX-001`, `SOCK-002`, `SOCK-003`, `LIVE-001`, and `DOC-001` have Stage 8 complete; `SOCK-001` was merged into `SOCK-002`; `GEN-001` is now explicitly started as a separate redesign rather than through the cleanup-stage flow

### GEN-001 Chat Timeline/Event Object Redesign

- Source: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- Implementation plan: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Status: implementation complete
- Current batch: none
- Next queued batch: none
- Notes: this work is intentionally separate from the completed code-quality cleanup stages

## Queued Candidate Work

### Development Seed Data

- Plan: `docs/plans/2026-03-22-development-seed-data.md`
- Status: completed through Task 2
- Notes: deterministic development-only seed accounts, social graph edges, feed posts, and a local live-session fixture are implemented and documented.

### Mobile Expo Frontend Planning Track

- Source: `docs/plans/mobile/TRACK.md`
- Status: live discovery plus viewer watch flow plan ready for execution
- Notes: the shell, Relay/auth session lifecycle, and profiles/social basics plans are complete; the next mobile step is the Relay-first live discovery and durable viewer watch flow

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- User Profile Content And Live Entry is complete through `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` -> `Task 3`.
- Post Media Attachments And Story Feed is complete through `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md` -> `Task 3`.
- Shared Read-Policy Query Composition is complete through `docs/plans/2026-03-18-query-policy-composition-and-reuse.md` -> `Task 3`.
- GraphQL batching and N+1 reduction is complete through `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 3`.
- Chat product surface track is complete through `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 3`.
- Live session channel state/presence is complete through `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` -> `Task 3`.
- Live session client contract stabilization is complete through `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` -> `Task 3`.
- Post reporting is complete through `docs/plans/content/2026-04-24-post-reporting.md` -> `Task 2`.
- Development seed data is complete through `docs/plans/2026-03-22-development-seed-data.md` -> `Task 2`.
- Live replay and recording track is complete through `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md` -> `Task 3`.
- Checklist-complete plans belong in `docs/plans/archive/completed/`.
- Archived plans are historical context, not the default starting point for a new execution turn.

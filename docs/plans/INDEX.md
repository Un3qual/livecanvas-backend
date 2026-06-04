# Plans Index

This file is a registry and backlog map. It does not own executable current-batch
state; lane `NOW.md` files do.

Use this file when:

- a lane `NOW.md` is stale, blocked, or empty
- a new plan needs registry placement
- the coordinator dashboard needs repair
- a lane needs backlog context before promoting new work

## Lane Registry

### Backend Lane

- Pointer: `docs/plans/backend/NOW.md`
- State: idle; no backend implementation batch is selected
- Active track: none
- Selection source when resumed: product priority in `ARCHITECTURE.md`, this
  registry, and any user-directed backend track
- Notes: backend lane owns backend code and backend planning docs only

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: active
- Track: `docs/plans/mobile/TRACK.md`
- Current product theme: host broadcast native capability/preflight
- Notes: the lane now has an opaque `LiveSession.channelTopic`; do not decode
  Relay IDs client-side

## Track Registry

### Mobile Expo Frontend Planning Track

- Track: `docs/plans/mobile/TRACK.md`
- State: active
- Current theme: host broadcast/native media preflight
- Next dependency after preflight: backend media signaling contract planning,
  unless the coordinator explicitly defers media and selects mobile chat

### Backend Code Quality Cleanup

- Plan: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- State: complete
- Notes: all valid or partially valid cleanup issues have completed implementation
  stages; `SOCK-001` was merged into `SOCK-002`; `GEN-001` was split into its own
  completed redesign track

### GEN-001 Chat Timeline/Event Object Redesign

- Design: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- Implementation: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- State: complete
- Notes: first-class timeline events, timeline GraphQL, timeline channel
  broadcasts, and data-governance handling are implemented

### Live Session Channel State And Presence

- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- State: complete
- Notes: bounded aggregate room state and viewer-count updates are implemented on
  the existing live-session topic

### Release Roadmap And Planning Holes

- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- State: paused
- Notes: return to this roadmap only after the backend lane is explicitly
  reprioritized

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- User Profile Content And Live Entry:
  `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Post Media Attachments And Story Feed:
  `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md`
- Shared Read-Policy Query Composition:
  `docs/plans/2026-03-18-query-policy-composition-and-reuse.md`
- GraphQL batching and N+1 reduction:
  `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Chat product surface:
  `docs/plans/chat/2026-03-17-chat-system-events.md`
- Live session client contract stabilization:
  `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md`
- Post reporting:
  `docs/plans/content/2026-04-24-post-reporting.md`
- Development seed data:
  `docs/plans/2026-03-22-development-seed-data.md`
- Live replay and recording:
  `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md`

Checklist-complete plans belong in `docs/plans/archive/completed/`.

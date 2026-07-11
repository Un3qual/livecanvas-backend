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
- State: Batch 1 reversible social-control contract complete; no executable
  backend batch
- Last completed source plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Notes: backend lane owns backend code and backend planning docs, and should be
  promoted when active frontend/mobile product work exposes a verified backend
  contract, resolver, runtime, or data issue.

### Mobile Lane

- Pointer: `docs/plans/mobile/NOW.md`
- State: Batch 1 reversible social controls complete; no executable mobile
  batch
- Track: `docs/plans/mobile/TRACK.md`
- Last completed source plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Latest completed product theme: Batch 1 reversible social controls
- Latest completed detailed plans: account settings and recovery, existing
  social controls, contact discovery, post owner controls, and profile
  connection lists
- Notes: mobile has Relay prepare/go-live retry wiring, tested media channel
  payload normalization, and a completed backend media runtime foundation. The
  completed chat batch adds retained timeline history and live chat channel
  integration. Frontend structure, TypeScript readability, and XState live
  workflow cleanup are complete. The queued feature follow-ups through the July
  8 product-gap batch and reversible unfollow/unblock are complete for their
  selected scopes; release-candidate manual QA remains deferred.

## Track Registry

### Cross-Lane Product Week

- Plan: `docs/plans/2026-07-01-cross-lane-product-week.md`
- State: complete for the July 8 product-gap batch
- Handoff: superseded by the approved Next Five Product Batches design
- Notes: release-candidate manual QA, compliance hard-delete enablement, and
  backend starter-kit extraction remain outside this week unless explicitly
  resumed

### Next Five Product Batches

- Design:
  `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
- Last completed implementation:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- State: Batch 1 reversible social controls complete; Batch 2 Profile Content
  Surfaces is the next planning target
- Queue: profile content surfaces, media post publishing, live-chat message
  controls, and end-to-end contact invitations
- Notes: batches execute sequentially. Release-candidate device QA follows the
  five product batches and remains deferred.

### Product Gap Candidate Plans

- State: July 8 scopes and reversible social-control Tasks 3-4 complete
- Mobile account settings and recovery:
  `docs/plans/mobile/2026-07-08-mobile-account-settings-and-recovery.md`
- Mobile social controls:
  `docs/plans/mobile/2026-07-08-mobile-social-controls.md`
- Mobile contact discovery:
  `docs/plans/mobile/2026-07-08-mobile-contact-discovery.md`
- Mobile post owner controls:
  `docs/plans/mobile/2026-07-08-mobile-post-owner-controls.md`
- Mobile profile connection lists:
  `docs/plans/mobile/2026-07-08-mobile-profile-connection-lists.md`
- Backend report moderation operations:
  `docs/plans/moderation/2026-07-08-report-moderation-operations.md`
- Notes: account settings, contact discovery, post owner controls, profile
  connection lists, moderation operations, and the existing-contract portion
  of social controls are complete. Contact-invite delivery remains queued as
  Batch 5 because its
  emailed token URL still needs a real landing route.

### Backend Live Media Signaling Contract

- Plan: `docs/plans/archive/completed/backend/2026-06-03-live-media-signaling-contract.md`
- State: complete
- Current theme: native mobile host broadcasting backend signaling contract
- Notes: completed and handed off to mobile media signaling integration

### Backend Live Media Runtime Foundation

- Plan: `docs/plans/archive/completed/backend/2026-06-04-live-media-runtime-foundation.md`
- State: complete
- Current theme: durable media readiness, ICE/TURN credential provider, and
  negotiation-driven runtime readiness
- Notes: completed and handed off to the coordinator for the next product batch

### Mobile Expo Frontend Planning Track

- Track: `docs/plans/mobile/TRACK.md`
- State: Batch 1 reversible social controls complete; Batch 2 planning next
- Last completed implementation plan:
  `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- Latest completed theme: July 8 mobile product-gap batch

### Backend Code Quality Cleanup

- Plan: `docs/plans/archive/completed/backend/2026-05-22-code-quality-cleanup.md`
- State: complete
- Notes: all valid or partially valid cleanup issues have completed implementation
  stages; `SOCK-001` was merged into `SOCK-002`; `GEN-001` was split into its own
  completed redesign track

### GEN-001 Chat Timeline/Event Object Redesign

- Design: `docs/plans/archive/completed/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- Implementation: `docs/plans/archive/completed/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- State: complete
- Notes: first-class timeline events, timeline GraphQL, timeline channel
  broadcasts, and data-governance handling are implemented

### Live Session Channel State And Presence

- Plan: `docs/plans/archive/completed/live/2026-03-22-live-session-channel-state-and-presence.md`
- State: complete
- Notes: bounded aggregate room state and viewer-count updates are implemented on
  the existing live-session topic

### Release Roadmap And Planning Holes

- Source: `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
- State: paused
- Notes: return to this roadmap only after the backend lane is explicitly
  reprioritized; issue-driven backend fixes can still be promoted from active
  product work without reopening the whole roadmap

## Paused Or Deferred

- Compliance hard-delete enablement remains paused until explicitly resumed.

## Completed Work

- User Profile Content And Live Entry:
  `docs/plans/archive/completed/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Post Media Attachments And Story Feed:
  `docs/plans/archive/completed/content/2026-03-18-post-media-attachments-and-story-feed.md`
- Shared Read-Policy Query Composition:
  `docs/plans/archive/completed/backend/2026-03-18-query-policy-composition-and-reuse.md`
- GraphQL batching and N+1 reduction:
  `docs/plans/archive/completed/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Chat product surface:
  `docs/plans/archive/completed/chat/2026-03-17-chat-system-events.md`
- Live session client contract stabilization:
  `docs/plans/archive/completed/live/2026-03-27-live-session-client-contract-stabilization.md`
- Post reporting:
  `docs/plans/archive/completed/content/2026-04-24-post-reporting.md`
- Development seed data:
  `docs/plans/archive/completed/backend/2026-03-22-development-seed-data.md`
- Live replay and recording:
  `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md`
- Mobile feed/content discovery surface:
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`

Checklist-complete plans belong in `docs/plans/archive/completed/`.

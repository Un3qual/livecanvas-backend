# Mobile App Track

Use this file for mobile plan order and dependency context. Use
`docs/plans/mobile/NOW.md` for the executable current batch.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable
data, Phoenix Channels for realtime state, and supports auth, profiles, feed
and content discovery, live streaming, and chat.

## Status

- Track state: all five product batches complete; release-candidate QA active
- Lane pointer: `docs/plans/mobile/NOW.md`
- Latest completed implementation plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Current gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Last completed detailed plan:
  `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- Recent theme: end-to-end contact invitations now complete fragment-only HTTPS
  delivery, protected authentication handoff, one-time recipient-bound
  consumption, and explicit contact-row delivery state.
- Last completed workflow theme: mobile XState live workflow cleanup moved
  viewer membership, playback display state, chat channel/send status, and host
  preflight workflow state into feature-local machines while keeping IO in
  hooks/adapters.
- Last completed readability theme: mobile TypeScript cleanup reduced repeated
  manual live-broadcast types after the frontend folder split.
- Last completed structure theme: mobile frontend structure cleanup split route
  and screen files into nested feature folders while preserving public import
  shims.
- Last completed theme: pre-beta product completeness closed viewer setup, host
  publishing, viewer playback, and the one-host/one-viewer smoke checklist
- Backend channel-topic dependency: complete. Mobile receives opaque
  `LiveSession.channelTopic`; do not decode Relay IDs client-side.
- Backend media signaling dependency: complete. Mobile has prepare/go-live retry
  wiring and media channel payload normalization against the backend contract.
- Backend media runtime dependency: complete for host and active-viewer setup
  plus signaling-driven readiness. Mobile must use the returned opaque media
  signaling topic without constructing topics.
- Retained chat history implementation uses the current `LiveSession.timelineEvents`
  schema and `ChatMessageEvent` nodes.
- Beta distribution and release-candidate mechanics are unblocked. Task 1
  aligned local quality gate commands, Task 2 added internal EAS build profiles
  plus explicit native identifiers, and Task 3 added the release-candidate
  checklist with launch blockers separated from deferred follow-up.
- Frontend structure cleanup is archived at
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-frontend-structure-cleanup.md`; behavior
  stayed stable and public imports remain preserved.
- TypeScript readability cleanup is archived at
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-typescript-quality-readability.md`; public
  import shims stayed preserved and tests remained under `mobile/tests/**`.
- XState live workflow cleanup is archived at
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-xstate-live-workflows.md`.
- Feature follow-ups are archived through
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`.
- Feed section refresh and pagination detail evidence is archived at
  `docs/plans/archive/completed/mobile/2026-07-01-feed-section-refresh-pagination.md`.
- Release-candidate manual QA is active in
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`. No remote or
  authenticated EAS build/submit command is required by that checklist.

## Completed Detailed Plans

- `docs/plans/archive/completed/mobile/2026-03-19-mobile-expo-bootstrap.md`
- `docs/plans/archive/completed/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md`
- `docs/plans/archive/completed/mobile/2026-03-27-relay-auth-session-lifecycle.md`
- `docs/plans/archive/completed/mobile/2026-04-24-profiles-social-basics.md`
- `docs/plans/archive/completed/mobile/2026-06-01-live-discovery-viewer-watch-flow.md`
- `docs/plans/archive/completed/mobile/2026-06-01-live-channel-transport-contract-repair.md`
- `docs/plans/archive/completed/mobile/2026-06-02-host-broadcast-native-capability-preflight.md`
- `docs/plans/archive/completed/mobile/2026-06-04-host-broadcast-media-signaling-integration.md`
- `docs/plans/archive/completed/mobile/2026-06-04-chat-realtime-retained-history.md`
- `docs/plans/archive/completed/mobile/2026-06-24-pre-beta-product-completeness.md`
- `docs/plans/archive/completed/mobile/2026-06-05-testing-beta-release-readiness.md`
- `docs/plans/archive/completed/mobile/2026-06-27-mobile-frontend-structure-cleanup.md`
- `docs/plans/archive/completed/mobile/2026-06-27-mobile-typescript-quality-readability.md`
- `docs/plans/archive/completed/mobile/2026-06-27-mobile-xstate-live-workflows.md`
- `docs/plans/archive/completed/mobile/2026-06-29-host-in-session-controls.md`
- `docs/plans/archive/completed/mobile/2026-06-29-viewer-playback-recovery-controls.md`
- `docs/plans/archive/completed/mobile/2026-06-29-chat-history-pagination.md`
- `docs/plans/archive/completed/mobile/2026-06-29-post-live-recording-replay-affordance.md`
- `docs/plans/archive/completed/mobile/2026-06-29-release-diagnostics-screen.md`
- `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`
- `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- `docs/plans/mobile/2026-07-08-mobile-account-settings-and-recovery.md`
- `docs/plans/mobile/2026-07-08-mobile-contact-discovery.md`
- `docs/plans/mobile/2026-07-08-mobile-post-owner-controls.md`
- `docs/plans/mobile/2026-07-08-mobile-profile-connection-lists.md`
- `docs/plans/mobile/2026-07-08-mobile-social-controls.md`

## Recommended Plan Order

1. Mobile foundations: Expo boundary, routing, tooling, and shared UI primitives.
2. Relay data layer plus auth/session lifecycle.
3. Profiles and relationship-aware social basics.
4. Live discovery plus viewer watch flow.
5. Host broadcast flow and native media integration.
6. Chat realtime stream plus retained history.
7. Pre-beta product completeness: viewer setup contract, host publishing, and
   viewer playback.
8. Testing, beta distribution, and release readiness foundations.
9. Mobile frontend structure cleanup before continued feature follow-ups.
10. Mobile TypeScript readability cleanup for live broadcast code before deeper
    live-session feature work.
11. Mobile XState live workflow cleanup for complex live protocol state.
12. Host in-session controls.
13. Viewer playback recovery controls.
14. Chat history pagination.
15. Post-live recording replay affordance.
16. Release diagnostics screen.
17. Mobile feed and content discovery surface.
18. Mobile post composer over `createPost`.
19. Mobile account settings and recovery.
20. Existing-contract social controls: mute, unmute, and block.
21. Manual contact discovery; invite delivery is deferred pending a real landing route.
22. Mobile post owner controls.
23. Profile connection lists and pending follow requests.
24. Reversible social controls: direction-safe unfollow and unblock.
25. Profile content surfaces.
26. Media post publishing.
27. Live-chat message controls.
28. End-to-end contact invitations.
29. Release-candidate manual device QA using the one-host/one-viewer checklist.

## Active Gate And Completed Follow-Up Plans

Active release gate:

- `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Status: active; begin with local entry gates, then record manual device QA.

Recently completed product batch:

- `docs/superpowers/plans/2026-07-11-end-to-end-contact-invitations.md`
- `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md`
- `docs/superpowers/plans/2026-07-11-media-post-publishing.md`
- `docs/superpowers/plans/2026-07-09-reversible-social-controls.md`
- `docs/plans/mobile/2026-07-08-mobile-account-settings-and-recovery.md`
- `docs/plans/mobile/2026-07-08-mobile-social-controls.md`
- `docs/plans/mobile/2026-07-08-mobile-contact-discovery.md`
- `docs/plans/mobile/2026-07-08-mobile-post-owner-controls.md`
- `docs/plans/mobile/2026-07-08-mobile-profile-connection-lists.md`

All previously queued product follow-up plans are complete. No product batch is
queued ahead of the active release-candidate gate.

## Shared Constraints

- Mobile work owns `mobile/` and `docs/plans/mobile/**`.
- Backend Elixir/GraphQL code and shared contracts are out of scope unless
  explicitly assigned.
- Expo remains the app framework, but native media work uses a custom
  development build rather than Expo Go.
- Durable reads and writes should use the Relay-first GraphQL contract.
- Realtime live-session and chat behavior should integrate with Phoenix Channels.
- Product completeness for auth, profiles, feed/content discovery, live, and
  chat takes priority over non-product hardening until the core app loop is
  implemented.

## Source Rationale

- Overview design: `docs/plans/archive/completed/mobile/2026-03-18-mobile-app-overview-design.md`
- Bootstrap design:
  `docs/plans/archive/completed/mobile/2026-03-19-mobile-expo-bootstrap-design.md`
- Bootstrap implementation plan:
  `docs/plans/archive/completed/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Backend architecture: `ARCHITECTURE.md`
- Mobile GraphQL contract: `docs/contracts/mobile-graphql-phase2.md`
- Mobile chat-history contract: `docs/contracts/mobile-graphql-chat-history.md`
- Mobile live-session contract: `docs/contracts/mobile-live-session-graphql.md`

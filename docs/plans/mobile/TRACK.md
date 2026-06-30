# Mobile App Track

Use this file for mobile plan order and dependency context. Use
`docs/plans/mobile/NOW.md` for the executable current batch.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable
data, Phoenix Channels for realtime state, and supports auth, profiles, live
streaming, and chat.

## Status

- Track state: active; feature-completeness follow-ups active
- Lane pointer: `docs/plans/mobile/NOW.md`
- Last completed detailed plan:
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-xstate-live-workflows.md`
- Current theme: host in-session controls, followed by queued live-session
  product follow-ups before release-candidate device QA.
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
- Active product follow-up:
  `docs/plans/mobile/follow-ups/2026-06-29-host-in-session-controls.md`.
- Release-candidate manual QA remains tracked in
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`, but it is now
  the bottom-priority final gate after queued product follow-ups. No remote or
  authenticated EAS build/submit command is required by that checklist.
- Candidate tangible follow-up plans are staged under
  `docs/plans/mobile/follow-ups/` and should be promoted one at a time before
  reactivating release-candidate manual QA unless product explicitly defers
  them.

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
17. Release-candidate manual device QA using the one-host/one-viewer checklist.

## Active And Queued Follow-Up Plans

Promote these plans one at a time through `docs/plans/mobile/NOW.md`:

- Active:
  `docs/plans/mobile/follow-ups/2026-06-29-host-in-session-controls.md`
- Next:
  `docs/plans/mobile/follow-ups/2026-06-29-viewer-playback-recovery-controls.md`
- `docs/plans/mobile/follow-ups/2026-06-29-chat-history-pagination.md`
- `docs/plans/mobile/follow-ups/2026-06-29-post-live-recording-replay-affordance.md`
- `docs/plans/mobile/follow-ups/2026-06-29-release-diagnostics-screen.md`
- Final gate:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

## Shared Constraints

- Mobile work owns `mobile/` and `docs/plans/mobile/**`.
- Backend Elixir/GraphQL code and shared contracts are out of scope unless
  explicitly assigned.
- Expo remains the app framework, but native media work uses a custom
  development build rather than Expo Go.
- Durable reads and writes should use the Relay-first GraphQL contract.
- Realtime live-session and chat behavior should integrate with Phoenix Channels.
- Product completeness for auth, live, and chat takes priority over non-product
  hardening until the core app loop is implemented.

## Source Rationale

- Overview design: `docs/plans/archive/completed/mobile/2026-03-18-mobile-app-overview-design.md`
- Bootstrap design:
  `docs/plans/archive/completed/mobile/2026-03-19-mobile-expo-bootstrap-design.md`
- Bootstrap implementation plan:
  `docs/plans/archive/completed/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Backend architecture: `ARCHITECTURE.md`
- Mobile GraphQL contract: `docs/contracts/mobile-graphql-phase2.md`
- Mobile chat-history contract: `docs/contracts/mobile-graphql-chat-history.md`

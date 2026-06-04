# Mobile App Track

Use this file for mobile plan order and dependency context. Use
`docs/plans/mobile/NOW.md` for the executable current batch.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable
data, Phoenix Channels for realtime state, and supports auth, profiles, live
streaming, and chat.

## Status

- Track state: active
- Lane pointer: `docs/plans/mobile/NOW.md`
- Active detailed plan:
  `docs/plans/mobile/2026-06-02-host-broadcast-native-capability-preflight.md`
- Current theme: host broadcast native media preflight
- Backend channel-topic dependency: complete. Mobile receives opaque
  `LiveSession.channelTopic`; do not decode Relay IDs client-side.
- Backend media dependency: incomplete. True go-live remains blocked until
  backend media signaling, ICE/TURN configuration, and Membrane/WebRTC
  negotiation contracts are planned.

## Completed Detailed Plans

- `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md`
- `docs/plans/mobile/2026-03-27-relay-auth-session-lifecycle.md`
- `docs/plans/mobile/2026-04-24-profiles-social-basics.md`
- `docs/plans/mobile/2026-06-01-live-discovery-viewer-watch-flow.md`
- `docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md`

## Recommended Plan Order

1. Mobile foundations: Expo boundary, routing, tooling, and shared UI primitives.
2. Relay data layer plus auth/session lifecycle.
3. Profiles and relationship-aware social basics.
4. Live discovery plus viewer watch flow.
5. Host broadcast flow and native media integration.
6. Chat realtime stream plus retained history.
7. Testing, beta distribution, and release readiness.

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

- Overview design: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Bootstrap design:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap-design.md`
- Bootstrap implementation plan:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Backend architecture: `ARCHITECTURE.md`
- Mobile GraphQL contract: `docs/contracts/mobile-graphql-phase2.md`
- Mobile chat-history contract: `docs/contracts/mobile-graphql-chat-history.md`

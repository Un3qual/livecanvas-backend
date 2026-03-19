# Mobile App Track Summary

Use this file to navigate the mobile planning set without reopening the overview doc on every turn.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable data, Phoenix Channels for realtime state, and supports auth, simple profiles, and mostly feature-complete live streaming plus chat.

## Track Status

- Status: active
- Approved overview: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Bootstrap slice complete: `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap.md`
- `docs/plans/NOW.md` has returned to the interrupted backend batch until
  mobile work is explicitly reprioritized again.

## Recommended Detailed Plan Order

1. Mobile bootstrap: standalone Expo workspace and Nix shell
2. Mobile foundations: Expo boundary, routing, tooling, and shared UI
   primitives
3. Relay data layer plus auth/session lifecycle
4. Profiles and relationship-aware social basics
5. Live discovery plus viewer watch flow
6. Host broadcast flow and native media integration
7. Chat realtime stream plus retained history
8. Testing, beta distribution, and release readiness

## Shared Constraints

- The mobile code will live in `mobile/`, and the current bootstrap slice stops
  at a standalone Expo workspace plus a local Nix shell.
- Expo is the required app framework, but live media may require a custom dev client or `expo prebuild`.
- Durable client reads and writes should use the Relay-first GraphQL contract already documented by the backend.
- Realtime live-session and chat behavior should integrate with Phoenix Channels rather than inventing a parallel transport.
- Mobile UI must respect backend viewer-scoped authorization and fallback behavior, especially for `node(id:)`, profile visibility, live-session access, and chat history access.
- Product completeness for auth, live, and chat should take priority over non-product hardening until the core app loop is implemented.

## Source Rationale

- Overview design: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Bootstrap slice: `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Backend architecture: `ARCHITECTURE.md`
- Mobile GraphQL contract: `docs/contracts/mobile-graphql-phase2.md`
- Mobile chat-history contract: `docs/contracts/mobile-graphql-chat-history.md`

# Mobile App Track Summary

Use this file to navigate the mobile planning set without reopening the overview doc on every turn.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable data, Phoenix Channels for realtime state, and supports auth, simple profiles, and mostly feature-complete live streaming plus chat.

## Track Status

- Status: bootstrap complete; detailed implementation can proceed when
  explicitly prioritized
- Approved overview: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Approved bootstrap design:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap-design.md`
- Bootstrap plan:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Current global execution pointer remains `docs/plans/NOW.md`; the backend feed
  batch stays the default next slice unless mobile work is explicitly
  reprioritized again.

## Recommended Detailed Plan Order

1. Mobile foundations: Expo boundary, routing, tooling, and shared UI primitives
2. Relay data layer plus auth/session lifecycle
3. Profiles and relationship-aware social basics
4. Live discovery plus viewer watch flow
5. Host broadcast flow and native media integration
6. Chat realtime stream plus retained history
7. Testing, beta distribution, and release readiness

## Shared Constraints

- The mobile code now exists in `mobile/` with an Expo `blank-typescript`
  scaffold plus a local `flake.nix`.
- Expo is the required app framework, but live media may require a custom dev client or `expo prebuild`.
- Durable client reads and writes should use the Relay-first GraphQL contract already documented by the backend.
- Realtime live-session and chat behavior should integrate with Phoenix Channels rather than inventing a parallel transport.
- Mobile UI must respect backend viewer-scoped authorization and fallback behavior, especially for `node(id:)`, profile visibility, live-session access, and chat history access.
- Product completeness for auth, live, and chat should take priority over non-product hardening until the core app loop is implemented.

## Source Rationale

- Overview design: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Backend architecture: `ARCHITECTURE.md`
- Mobile GraphQL contract: `docs/contracts/mobile-graphql-phase2.md`
- Mobile chat-history contract: `docs/contracts/mobile-graphql-chat-history.md`

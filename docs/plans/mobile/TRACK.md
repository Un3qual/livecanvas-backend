# Mobile App Track Summary

Use this file to navigate the mobile planning set without reopening the overview doc on every turn.

## Goal

Deliver an Expo mobile app in `mobile/` that uses Relay-first GraphQL for durable data, Phoenix Channels for realtime state, and supports auth, simple profiles, and mostly feature-complete live streaming plus chat.

## Track Status

- Status: app shell complete; the mobile lane needs to plan the next slice (Relay data layer and auth/session lifecycle)
- Approved overview: `docs/plans/mobile/2026-03-18-mobile-app-overview-design.md`
- Approved bootstrap design:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap-design.md`
- Bootstrap plan:
  `docs/plans/mobile/2026-03-19-mobile-expo-bootstrap.md`
- Completed detailed plan:
  `docs/plans/mobile/2026-03-22-mobile-app-shell-routing-and-global-providers.md`
- Lane execution pointer: `docs/plans/mobile/NOW.md`
- Coordinator dashboard: `docs/plans/NOW.md`
- Next lane batch: create the next detailed plan for Relay data layer, auth, and session lifecycle (overview sections 2.1–2.2 and 3.1–3.3).

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
- In parallel execution, the mobile lane owns `mobile/` and
  `docs/plans/mobile/**`; do not edit backend Elixir/GraphQL code or
  coordinator-owned shared docs from this lane.
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

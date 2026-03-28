# Backend Lane Execution

Last reviewed: 2026-03-27
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `live_session_client_contract_stabilization`
- Source: `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md`
- Batch: `Task 1: Freeze the live-session GraphQL contract`
- Why now: The codebase already exposes live-session GraphQL writes plus realtime channel events, but only auth/social and chat-history flows are published backend contracts. The next unblocked backend slice is to publish and pin the live-session contract that upcoming mobile live/realtime work will depend on.

## Do This Now

- Use `docs/contracts/mobile-graphql-phase2.md`, `docs/contracts/mobile-graphql-chat-history.md`, and the live-session tests/code as the baseline for the missing live contract.
- Add focused GraphQL coverage that freezes the supported live-session mobile surface before writing the new contract doc.
- Write `docs/contracts/mobile-live-session-graphql.md` for the supported live-session reads and lifecycle mutations.
- Keep any implementation drift fixes confined to the GraphQL adapter layer unless the tests prove a deeper bug.
- Report required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

- `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- `mix compile`
- `mix typecheck`

## Next Up

- `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` -> `Task 2: Publish the live-session realtime channel contract`

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

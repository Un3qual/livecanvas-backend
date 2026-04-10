# Backend Lane Execution

Last reviewed: 2026-04-10
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `live_session_client_contract_stabilization`
- Source: `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md`
- Batch: `Task 2: Publish the live-session realtime channel contract`
- Why now: The GraphQL contract slice is now published and covered by focused tests, so the next unblocked backend dependency for mobile live work is to freeze the Phoenix Channel topic, join ack, and event payload contract on top of the already-stable transport behavior.

## Do This Now

- Use `docs/contracts/mobile-live-session-graphql.md`, `docs/contracts/mobile-graphql-chat-history.md`, and `test/live_canvas_web/channels/live_session_channel_test.exs` as the baseline for the missing realtime contract.
- Add focused channel/integration coverage that pins the mobile-facing topic contract for join success payloads, `session:state`, `chat:message`, `chat:message_updated`, `disconnect`, and the documented join failure reasons.
- Write `docs/contracts/mobile-live-session-realtime.md` describing topic naming, join prerequisites, join ack shape, event payloads, ordering guarantees that already exist, and client-safe failure reasons such as `session_unavailable`.
- Keep any implementation drift fixes confined to the transport layer unless the tests prove a deeper bug.
- Report required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

- `mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs`
- `mix compile`
- `mix typecheck`

## Next Up

- `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` -> `Task 3: Verify the contract slice and refresh backend lane tracking`

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

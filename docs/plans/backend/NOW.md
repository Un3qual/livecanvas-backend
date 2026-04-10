# Backend Lane Execution

Last reviewed: 2026-04-10
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `live_session_client_contract_stabilization`
- Source: `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md`
- Batch: `Task 3: Verify the contract slice and refresh backend lane tracking`
- Why now: The GraphQL and realtime contract slices are both published and covered by focused tests, so the next backend step is to run the full contract-slice verification set, refresh backend lane tracking, and report the required shared coordinator repairs without editing shared docs from this lane.

## Do This Now

- Use `docs/contracts/mobile-live-session-graphql.md`, `docs/contracts/mobile-live-session-realtime.md`, and the focused live-session test files as the verification baseline for the completed contract slice.
- Run the full contract-slice verification set from the source plan: `mix compile`, `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`, and `mix typecheck`.
- Update `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` and this lane file with the verification outcome once the full slice passes.
- Report required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` instead of editing those shared files directly.

## Verification Scope

- `mix compile`
- `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`
- `mix typecheck`

## Next Up

- After Task 3, report the required coordinator repairs to `docs/plans/INDEX.md` and `docs/plans/NOW.md`, then let the coordinator choose the next backend batch.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

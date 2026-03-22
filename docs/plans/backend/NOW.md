# Backend Lane Execution

Last reviewed: 2026-03-22
Status: active

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `live_session_channel_state_and_presence`
- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Batch: `Task 3: Broadcast lifecycle state transitions and refresh plan tracking`
- Why now: `Task 2 is complete, so the next unblocked backend batch is wiring lifecycle broadcasts into the same `live_session:<id>` topic and then advancing the plan tracking once verification is done.

## Do This Now

- Add failing GraphQL/channel coverage proving `goLiveSession` and `endLiveSession` rebroadcast aggregate state changes to already-joined viewers.
- Implement resolver-level state broadcasts after successful lifecycle transitions, keeping the end-of-session state update ahead of the existing disconnect fanout.
- Run `mix compile`.
- Run `mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs`.
- Run `mix typecheck`.
- Update `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`, then report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs
mix typecheck
```

## Next Up

- Once Task 3 is green and committed, advance this lane pointer to the next unblocked backend batch in `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

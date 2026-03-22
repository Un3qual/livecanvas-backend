# Current Execution

Last reviewed: 2026-03-22
Status: active

## Current Batch

- Track: `live_session_channel_state_and_presence`
- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Batch: `Task 1: Add aggregate live-session state snapshot helpers in LC.Live`
- Why now: `ARCHITECTURE.md` still calls for WebSockets to carry live-session state and presence, but the current `live_session:<id>` topic remains chat-only. The next unblocked product batch is the aggregate `LC.Live` snapshot helper that lets channels and GraphQL broadcast bounded realtime state without leaking participant rosters.

## Do This Now

- Add failing `LC.Live` tests for the aggregate session-state helper.
- Add distributed-runtime coverage for the remote-owner snapshot path.
- Implement the public aggregate snapshot helper in `LC.Live`.
- Run the focused live tests and update the new plan checklist.

## Verification Scope

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/live/distributed_runtime_test.exs
```

## Next Up

- Once Task 1 is green and committed, advance `docs/plans/NOW.md` to `Task 2` in `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

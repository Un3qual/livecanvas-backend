# Current Execution

Last reviewed: 2026-03-22
Status: active

## Current Batch

- Track: `live_session_channel_state_and_presence`
- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Batch: `Task 2: Publish join/leave state updates on LCWeb.LiveSessionChannel`
- Why now: `LC.Live` now exposes a bounded aggregate session snapshot, so the next unblocked product batch is wiring that state into the existing `live_session:<id>` topic for join acks and participation rebroadcasts.

## Do This Now

- Add failing channel tests that the join ack includes the current aggregate session state for an authorized viewer.
- Add failing channel tests proving additional joins and disconnect-driven leaves rebroadcast refreshed aggregate state on the same topic.
- Implement channel helpers that fetch `LC.Live.live_session_state_snapshot/1`, include it in the join response, and rebroadcast the additive state payload after successful joins and leaves.
- Run the focused channel tests and update the plan checklist.

## Verification Scope

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

## Next Up

- Once Task 2 is green and committed, advance `docs/plans/NOW.md` to `Task 3` in `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

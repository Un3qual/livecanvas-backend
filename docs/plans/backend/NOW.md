# Backend Lane Execution

Last reviewed: 2026-03-22
Status: active

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `live_session_channel_state_and_presence`
- Plan: `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`
- Batch: `Task 2: Publish join/leave state updates on LCWeb.LiveSessionChannel`
- Why now: `LC.Live` now exposes a bounded aggregate session snapshot, so the next unblocked backend batch is wiring that state into the existing `live_session:<id>` topic for join acks and participation rebroadcasts.

## Do This Now

- Add failing channel tests that the join ack includes the current aggregate session state for an authorized viewer.
- Add failing channel tests proving additional joins and disconnect-driven leaves rebroadcast a bounded aggregate state update to subscribed viewers on the same topic.
- Implement channel helpers that fetch the aggregate state from `LC.Live`, include it in the join response, and rebroadcast it after successful join/leave transitions.
- Run `mix test test/live_canvas_web/channels/live_session_channel_test.exs`.
- Update `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md` and `docs/plans/backend/NOW.md` for the next backend milestone.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.

## Verification Scope

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
```

## Next Up

- Once Task 2 is green and committed, advance this lane pointer to `Task 3` in `docs/plans/live/2026-03-22-live-session-channel-state-and-presence.md`.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

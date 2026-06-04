# Backend Lane NOW

Last reviewed: 2026-06-03
Status: active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Do not edit `mobile/` or `docs/plans/mobile/**` from this lane.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

Source plan: `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

Task: Task 1, define the mobile-facing media signaling contract and typed backend
boundary.

## Write Scope

- `docs/contracts/mobile-live-media-signaling.md`
- `docs/contracts/mobile-live-session-realtime.md`
- `lib/live_canvas/live/media_signaling.ex`
- `test/live_canvas/live/media_signaling_test.exs`

## Done Condition

- The mobile-facing media signaling contract names the GraphQL prepare mutation,
  ICE/TURN response shape, live-session signaling topic, and Phoenix channel
  media events.
- `LC.Live.MediaSignaling` exposes a pure, typed boundary for deterministic ICE
  server data and payload validation.
- Focused tests cover the boundary behavior.

## Verification

```bash
mix test test/live_canvas/live/media_signaling_test.exs
mix typecheck
```

## Next Action

Execute Task 1 from the source plan. Do not broaden into Membrane startup,
recording, viewer playback, or mobile implementation in this batch.

## References

- Cleanup inventory: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- GEN-001 design:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- GEN-001 implementation:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Live media signaling contract:
  `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

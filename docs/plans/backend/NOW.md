# Backend Lane NOW

Last reviewed: 2026-06-03
Status: active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Do not edit `mobile/` or `docs/plans/mobile/**` from this lane.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

Source plan: `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

Task: Task 3, add live-session channel validation and forwarding for media
signaling events.

## Write Scope

- `lib/live_canvas_web/channels/live_session_channel.ex`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

## Done Condition

- The existing authorized live-session channel accepts `media:offer`,
  `media:answer`, and `media:ice_candidate`.
- Payloads are validated through `LC.Live.MediaSignaling` via the `LC.Live`
  boundary, and malformed payloads return structured errors.
- Broadcast payloads include server-derived sender role metadata and do not trust
  client-provided role fields.

## Verification

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
```

## Next Action

Execute Task 3 from the source plan. Do not broaden into Membrane startup,
recording, viewer playback, go-live readiness gating, or mobile implementation
in this batch.

## References

- Cleanup inventory: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- GEN-001 design:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- GEN-001 implementation:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Live media signaling contract:
  `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

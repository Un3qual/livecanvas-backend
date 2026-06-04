# Backend Lane NOW

Last reviewed: 2026-06-03
Status: active

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Do not edit `mobile/` or `docs/plans/mobile/**` from this lane.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

Source plan: `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

Task: Task 5, close the backend batch and hand off the mobile integration
surface.

## Write Scope

- `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`
- `docs/plans/backend/NOW.md`
- `docs/contracts/mobile-live-media-signaling.md`
- `docs/contracts/mobile-live-session-graphql.md`

## Done Condition

- The source plan checklist is complete.
- Mobile-facing contract docs describe the prepare mutation, media channel
  events, and `goLiveSession` media-readiness error.
- The backend lane returns to idle or points at the next concrete media batch.

## Verification

```bash
mix test test/live_canvas/live/media_signaling_test.exs test/live_canvas/live/session_server_test.exs test/live_canvas/live/session_supervisor_test.exs test/live_canvas/live/session_ownership_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
mix boundary.spec
```

## Next Action

Execute Task 5 from the source plan. Do not broaden into Membrane startup,
recording, viewer playback, or mobile implementation in this batch.

## References

- Cleanup inventory: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- GEN-001 design:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- GEN-001 implementation:
  `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Live media signaling contract:
  `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`

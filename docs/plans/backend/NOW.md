# Backend Lane NOW

Last reviewed: 2026-06-30
Status: idle; completed backend plans archived

## Lane Scope

- Own backend Elixir/GraphQL code and backend planning docs.
- Do not edit `mobile/` or `docs/plans/mobile/**` from this lane.
- Shared coordinator docs and shared contracts require explicit assignment.

## Current Batch

- Source plan:
  `docs/plans/archive/completed/backend/2026-06-04-live-media-runtime-foundation.md`
- Track: live media runtime foundation
- Task: complete
- Write scope: backend live runtime code, backend tests, migrations, backend
  planning docs, and the media signaling contract
- Done condition: final verification passed for durable media readiness,
  provider-backed ICE/TURN setup, validated signaling-driven readiness, and
  `goLiveSession` retry semantics.

## Handoff Context

Completed prerequisite:
`docs/plans/archive/completed/backend/2026-06-03-live-media-signaling-contract.md`

Mobile integration:
`docs/plans/archive/completed/mobile/2026-06-04-host-broadcast-media-signaling-integration.md`

Mobile-facing contracts:

- `docs/contracts/mobile-live-media-signaling.md`
- `docs/contracts/mobile-live-session-graphql.md`

## Next Action

No backend lane batch is currently selected. The next documented product batch
is the mobile release-candidate one-host/one-viewer device QA final gate from
`docs/plans/mobile/NOW.md`, unless the coordinator explicitly reprioritizes a
new backend plan.

## References

- Cleanup inventory: `docs/plans/archive/completed/backend/2026-05-22-code-quality-cleanup.md`
- GEN-001 design:
  `docs/plans/archive/completed/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`
- GEN-001 implementation:
  `docs/plans/archive/completed/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`
- Live media signaling contract:
  `docs/plans/archive/completed/backend/2026-06-03-live-media-signaling-contract.md`

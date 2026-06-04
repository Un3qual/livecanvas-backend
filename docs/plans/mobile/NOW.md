# Mobile Lane NOW

Last reviewed: 2026-06-04
Status: idle

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: chat realtime stream plus retained history complete
- Write scope: none selected

## Do This Now

No mobile implementation batch is currently selected.

## Guardrails

- Do not add real mobile media publishing or viewer playback from this lane.
- Do not decode Relay IDs client-side.
- Backend live media runtime foundation is complete; keep true go-live behavior
  aligned with the backend media signaling contract.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

If the mobile lane remains the product priority, promote the next concrete
implementation batch from `docs/plans/mobile/TRACK.md`: testing, beta
distribution, and release readiness.

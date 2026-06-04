# Mobile Lane NOW

Last reviewed: 2026-06-04
Status: idle

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-04-host-broadcast-media-signaling-integration.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: complete
- Files:
  - `mobile/schema.graphql`
  - `mobile/src/host/**`
  - `mobile/src/live/liveSessionPresentation.*`
  - `mobile/src/live/liveSessionRealtimeEvents.*`

## Do This Now

Keep the mobile lane idle until the coordinator selects the next mobile product
batch.

## Guardrails

- Do not add real mobile media publishing, viewer playback, or full chat stream
  UI from this lane while it is idle.
- Do not decode Relay IDs client-side.
- Backend live media runtime foundation is complete; keep true go-live behavior
  aligned with the backend media signaling contract.

## Next Action

Promote the next explicitly selectable mobile batch: chat realtime stream plus
retained history from `docs/plans/mobile/TRACK.md`.

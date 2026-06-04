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

Keep the mobile lane idle until backend media runtime readiness is implemented
or explicitly deferred.

## Guardrails

- Do not add real mobile media publishing, viewer playback, or full chat stream
  UI from this lane while it is idle.
- Do not decode Relay IDs client-side.
- Keep true go-live blocked by backend runtime readiness until the backend live
  media runtime foundation plan is implemented.

## Next Action

Coordinate the backend media runtime foundation in
`docs/plans/backend/2026-06-04-live-media-runtime-foundation.md`. The next
explicitly selectable mobile batch after that blocker is handled or deferred is
chat realtime stream plus retained history.

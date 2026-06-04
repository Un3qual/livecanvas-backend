# Mobile Lane NOW

Last reviewed: 2026-06-03
Status: idle

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan: none selected
- Track: `docs/plans/mobile/TRACK.md`
- Task: none selected
- Files: none

## Do This Now

No mobile implementation batch is currently selected.

## Guardrails

- Do not enable mobile go-live, media publishing, viewer playback, or full chat
  stream UI in this batch.
- Do not decode Relay IDs client-side.
- Keep true media signaling blocked until backend ICE/TURN/WebRTC negotiation
  contracts are planned.

## Next Action

Coordinate the next product batch. True mobile go-live remains blocked until the
backend media signaling, ICE/TURN, and WebRTC negotiation contracts are planned.
The next explicitly selectable mobile batch is chat realtime stream plus
retained history.

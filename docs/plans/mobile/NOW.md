# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md`
- Source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 3 - host WebRTC publishing runtime
- Write scope:
  - `mobile/src/host/**`
  - focused shared mobile realtime helpers/tests only when required by host
    publishing
  - `docs/plans/mobile/**`
- Done condition: the host path creates a real peer connection from the prepared
  ICE servers, keeps local media tracks long enough to publish, joins the opaque
  media `signalingTopic`, pushes `media:offer` and local ICE candidates,
  consumes viewer answers/candidates, retries `goLiveSession` after backend
  readiness, and disposes runtime resources on exit.
- Verification:
  - `bun test mobile/src/host mobile/src/live/liveSessionRealtimeEvents.test.ts`
  - `cd mobile && ./node_modules/.bin/tsc --noEmit`

## Do This Now

Implement Task 3 in
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`.

## Guardrails

- Do not add viewer playback or beta build mechanics while implementing the
  host publishing task.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a host-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Implement host WebRTC publishing before viewer playback runtime work and before
returning to beta build mechanics.

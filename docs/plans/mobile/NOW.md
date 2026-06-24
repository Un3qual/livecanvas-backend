# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: blocked

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
- Task: Task 2 - viewer media setup contract
- Write scope: backend GraphQL/media-signaling contract work must be promoted by
  the coordinator before mobile implements playback; mobile lane write scope is
  limited to `mobile/**` and `docs/plans/mobile/**` until that happens.
- Blocker: viewers need an authorized Relay-first way to obtain the opaque media
  `signalingTopic` and ICE server list. The current mobile schema exposes
  `signalingTopic` only through the host-owned `prepareLiveMediaSession`
  mutation, and mobile must not construct media topics from Relay IDs.
- Done condition: a backend-supported viewer media setup contract is documented
  and available to mobile, or the product owner explicitly defers viewer
  playback from beta scope.
- Verification:
  - If backend scope is promoted:
    `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`
  - `mix typecheck`

## Do This Now

Promote or implement Task 2 in
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`.

## Guardrails

- Do not add real mobile media publishing or viewer playback from this lane.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation is complete, but the viewer setup path
  must be explicit before mobile playback work proceeds.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

After the viewer media setup contract exists, continue with host WebRTC
publishing and viewer playback runtime work before returning to beta build
mechanics.

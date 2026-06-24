# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md` Task 3
- Source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 4 - viewer playback runtime
- Write scope:
  - `mobile/src/live/LiveSessionWatchScreen.tsx`
  - new focused viewer WebRTC runtime module and tests under `mobile/src/live/`
  - `mobile/src/live/liveSessionChannelClient.ts`
  - `mobile/src/live/liveSessionChannelClient.test.ts`
  - `mobile/src/live/liveSessionRealtimeEvents.ts`
  - `mobile/src/live/liveSessionRealtimeEvents.test.ts`
  - `docs/plans/mobile/**`
- Done condition: joined viewers obtain media setup through the approved
  contract after `joinLiveSession`, join the opaque media `signalingTopic`,
  consume host `media:offer`, create and push `media:answer`, exchange ICE
  candidates, render the remote stream in the watch screen, and tear down
  playback on leave, unmount, channel close, or ended-session events.
- Verification:
  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime`
  - `cd mobile && ./node_modules/.bin/tsc --noEmit`

## Do This Now

Implement Task 4 in
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`.

## Guardrails

- Do not add beta build mechanics or device smoke work while implementing the
  viewer playback task.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Implement viewer playback runtime before device smoke work and before returning
to beta build mechanics.

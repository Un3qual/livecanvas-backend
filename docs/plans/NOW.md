# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `live`
- Plan: `docs/plans/live/2026-03-17-live-session-recording-linkage.md`
- Batch: `Task 2: Expose recording linkage through GraphQL live-session surfaces`
- Why now: Task 1 has landed with durable recording linkage and end-session validation in the Live/Content boundaries, so the next unblocked batch is exposing that linked recording through the Relay `endLiveSession` payload and `LiveSession` node.

## Do This Now

- Add failing GraphQL mutation coverage for `endLiveSession(recordingMediaAssetId:)`, including success, invalid Relay ID type, and foreign/disallowed asset rejection paths.
- Add failing Relay node coverage for `LiveSession.recordingMediaAsset`, including both linked-recording and nil-recording cases.
- Wire `recordingMediaAssetId` through the mutation/resolver into `LC.Live` and expose `recordingMediaAsset` on the Relay `LiveSession` node without duplicating media metadata.
- Re-run the focused GraphQL live/feed/relay tests, then the Task 2 verification commands from `docs/plans/live/2026-03-17-live-session-recording-linkage.md`.

## Verification Scope

```bash
mix compile
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs
mix typecheck
```

## Next Up

- Move to `Task 3` in `docs/plans/live/2026-03-17-live-session-recording-linkage.md` to run final verification and refresh plan tracking once the GraphQL slice lands.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

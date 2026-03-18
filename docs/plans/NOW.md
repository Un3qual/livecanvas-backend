# Current Execution

Last reviewed: 2026-03-17
Status: active

## Current Batch

- Track: `live`
- Plan: `docs/plans/live/2026-03-17-live-session-recording-linkage.md`
- Batch: `Task 1: Add durable recording linkage storage and end-session validation`
- Why now: The chat product surface track is complete, and the architecture still requires replay/recording linkage when a live session ends; current `live_sessions`, `LC.Live`, and GraphQL surfaces have no durable recording reference yet.

## Do This Now

- Add failing Live tests for linking a host-owned uploaded/processed media asset when a session ends, plus rejection coverage for foreign, pending-upload, and failed assets.
- Add the nullable `recording_media_asset_id` linkage and validation helpers in `LC.Live` / `LC.Content` without inventing a second recording store.
- Re-run the focused Live/Content tests, then the Task 1 verification commands from `docs/plans/live/2026-03-17-live-session-recording-linkage.md`.
- Mark Task 1 progress as it lands and refresh `NOW.md` when the next batch becomes current.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas/content_test.exs
mix typecheck
```

## Next Up

- Move to `Task 2` in `docs/plans/live/2026-03-17-live-session-recording-linkage.md` to expose the linked recording through `endLiveSession` and the Relay `LiveSession` node.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

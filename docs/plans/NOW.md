# Current Execution

Last reviewed: 2026-03-19
Status: active

## Current Batch

- Track: `profile_content_live_entry`
- Plan: `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Batch: `Task 1: Add viewer-scoped profile read models in LC.Feed`
- Why now: The story/media publication track is complete, and the next product-facing gap from `ARCHITECTURE.md` is profile/live entry on the existing Relay `User` node without introducing a separate profile type.

## Do This Now

- Add failing `LC.Feed` tests for viewer-scoped profile posts, active stories, current live session, and replay queries on a specific profile owner.
- Extend `LC.Feed` with author/host-scoped read models that reuse the existing follow/public/block/mute/suspension visibility rules and deterministic ordering.
- Verify only the Task 1 boundary slice with `mix test test/live_canvas/feed_test.exs`.

## Verification Scope

```bash
mix test test/live_canvas/feed_test.exs
```

## Next Up

- Once Task 1 is green and committed, move to Task 2 in `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` for the Relay `User` profile fields.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

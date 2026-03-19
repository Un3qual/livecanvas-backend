# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `content_story_surface`
- Plan: `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md`
- Batch: `Task 1: Add viewer-owned post media attachment primitives and story-kind foundation in LC.Content`
- Why now: The read-policy track is complete, and `ARCHITECTURE.md` still names stories as missing product-facing scope. The next unblocked batch is the content foundation that story feed and media-backed posts depend on.

## Do This Now

- Add focused `LC.Content` tests for viewer-owned post media attachment and story expiry validation.
- Extend the content boundary so `create_post/2` can safely attach viewer-owned durable media assets and support `kind: :story` with bounded expiry defaults.
- Add the supporting schema/type updates and story-query index migration, then verify only the focused content foundation slice.

## Verification Scope

```bash
mix test test/live_canvas/content_test.exs
```

## Next Up

- Once Task 1 is green and committed, advance to `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md` -> `Task 2`.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

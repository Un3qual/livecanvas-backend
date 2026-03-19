# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `content_story_surface`
- Plan: `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md`
- Batch: `Task 2: Add story-aware feed queries and visibility rules in LC.Feed`
- Why now: Task 1 is complete and verified, so the next unblocked batch is the read-model split that keeps stories out of `homeFeed` and makes expired story visibility consistent across feed and refetch paths.

## Do This Now

- Add focused feed and GraphQL query tests proving `home_feed` excludes stories, `story_feed` returns only active visible stories ordered newest-first, and expired stories disappear from direct post and Relay node lookups.
- Implement `LC.Feed.story_feed/2` plus kind-aware `home_feed_query/1` and visible-post filtering without weakening existing suspension, block, mute, or follower/public visibility rules.
- Verify only the focused feed and Relay visibility slice for Task 2.

## Verification Scope

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

## Next Up

- Once Task 2 is green and committed, advance to `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md` -> `Task 3`.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

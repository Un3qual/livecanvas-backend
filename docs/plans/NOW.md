# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `content_story_surface`
- Plan: `docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md`
- Batch: `Task 3: Publish Relay story/media GraphQL surfaces and verify node/auth behavior`
- Why now: Task 2 is complete and verified, so the next unblocked batch is the GraphQL publication slice that exposes story/media surfaces without weakening Relay node authorization.

## Do This Now

- Add failing GraphQL tests for `createPost(kind: STORY, mediaAssetIds: ...)`, `Post.mediaAssets`, and a Relay `storyFeed` connection.
- Extend the GraphQL content/feed surface so story creation, post media attachments, and the `storyFeed` connection are Relay-first and viewer-scoped.
- Re-apply node and child-field authorization so expired or unauthorized story IDs still resolve to `nil`, then run only the Task 3 verification slice.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

## Next Up

- Once Task 3 is green and committed, move this track to its next planned milestone or repair `NOW.md` from `docs/plans/INDEX.md` if priorities changed.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

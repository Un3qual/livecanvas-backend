# Post Media Attachments And Story Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver viewer-owned post media attachments and the first story feed surface by reusing the existing `posts` and `media_assets` model instead of inventing a separate story table.

**Architecture:** Extend `Post` so `kind: :story` is a first-class content row with a bounded `expires_at`, and attach already-uploaded viewer-owned `media_assets` through `post_id`. Keep `LC.Content` responsible for ownership-safe attachment and story validation, `LC.Feed` responsible for active story read queries, and `LCGQL` responsible for Relay-first story/media publication without weakening node-level visibility checks.

**Tech Stack:** Elixir 1.15, Ecto, Absinthe Relay, ExUnit, Dialyzer

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. `LC.Content` can create text posts and media-upload intents, but it has no boundary API for attaching viewer-owned media assets to posts (`lib/live_canvas/content.ex`, `lib/live_canvas/content/post.ex`, `lib/live_canvas/content/media_asset.ex`).
2. The database already has `posts.kind`, `posts.expires_at`, and `media_assets.post_id`, but the schema/types only allow `:standard` posts today (`priv/repo/migrations/20260303003000_create_content_tables.exs`, `lib/live_canvas_schemas/content.ex`, `lib/live_canvas_schemas/content/post.ex`).
3. `LC.Feed.home_feed_query/1` currently returns every visible post kind, so story rows would leak into the home timeline unless Feed becomes kind-aware (`lib/live_canvas/feed.ex`).
4. The GraphQL content/feed surface exposes `post`, `mediaAsset`, `createPost`, `updatePost`, `deletePost`, `homeFeed`, `liveNow`, and `replayFeed`, but there is no story query and `Post` has no media attachment field (`lib/live_canvas_gql/content/content_queries.ex`, `lib/live_canvas_gql/content/content_mutations.ex`, `lib/live_canvas_gql/content/content_types.ex`, `lib/live_canvas_gql/feed/feed_queries.ex`).
5. Existing tests cover post visibility and media uploads independently, but there is no regression coverage for post-media attachment ownership, story expiry, or a story feed surface (`test/live_canvas/content_test.exs`, `test/live_canvas_gql/content/content_mutations_test.exs`, `test/live_canvas_gql/feed/feed_queries_test.exs`).

## Scope Decisions

- Reuse `posts` for both standard posts and stories; do not create a parallel `stories` table in this slice.
- Reuse `media_assets.post_id` so post/story attachments continue to flow through the existing upload + finalize lifecycle.
- Keep stories Relay-first by reusing the `Post` node and adding a dedicated feed connection rather than a bespoke list shape.
- Filter stories out of `homeFeed`; story discovery belongs in a dedicated story feed query.
- Treat stories as active only while `expires_at > now`; expired story IDs must disappear from both feed queries and node refetch.
- Defer advanced story product features such as seen receipts, reactions, multi-author tray grouping, and story-specific analytics.

## Progress

- [ ] Task 1: Add viewer-owned post media attachment primitives and story-kind foundation in `LC.Content`
- [ ] Task 2: Add story-aware feed queries and visibility rules in `LC.Feed`
- [ ] Task 3: Publish Relay story/media GraphQL surfaces and verify node/auth behavior

### Task 1: Add Viewer-Owned Post Media Attachment Primitives And Story-Kind Foundation In `LC.Content`

**Files:**
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/content/post.ex`
- Modify: `lib/live_canvas/content/media_asset.ex`
- Modify: `lib/live_canvas_schemas/content.ex`
- Modify: `lib/live_canvas_schemas/content/post.ex`
- Modify: `lib/live_canvas_schemas/content/media_asset.ex`
- Modify: `test/live_canvas/content_test.exs`
- Create: `priv/repo/migrations/20260318210000_add_story_post_indexes.exs`

**Task 1 Step Progress:**
- [ ] Step 1: Add failing `LC.Content` tests for attaching viewer-owned uploaded media assets to a new post, rejecting assets owned by another user, and rejecting assets still in `:pending_upload` or `:failed`
- [ ] Step 2: Add failing `LC.Content` tests for `kind: :story` rows defaulting to a bounded expiry window and rejecting invalid explicit expirations
- [ ] Step 3: Extend `LCSchemas.Content.post_kind()` and `LCSchemas.Content.Post` so `:story` is a valid persisted post kind
- [ ] Step 4: Add the minimal migration/index support for story lookups (`posts.kind`, `posts.expires_at`, and any composite index needed for active story ordering)
- [ ] Step 5: Refactor `LC.Content.create_post/2` so it accepts viewer-scoped `media_asset_ids`, locks the candidate assets, verifies ownership + durable processing state, and associates them to the inserted post inside one transaction
- [ ] Step 6: Centralize story-specific validation in `LC.Content.Post` so story expiry defaults and invariants live in one place instead of the GraphQL layer
- [ ] Step 7: Run `mix test test/live_canvas/content_test.exs` and commit the content-foundation slice

**Task 1 behavior targets:**

- Standard posts keep working without media attachments.
- Uploaded or processed viewer-owned media assets can be attached to a newly created post/story.
- Cross-account or non-durable media assets cannot be hijacked into another viewer's post.
- Story rows have a consistent expiry policy that is enforced in the boundary, not only in GraphQL.

**Suggested verification command:**

```bash
mix test test/live_canvas/content_test.exs
```

Expected: PASS.

### Task 2: Add Story-Aware Feed Queries And Visibility Rules In `LC.Feed`

**Files:**
- Modify: `lib/live_canvas/feed.ex`
- Modify: `lib/live_canvas/read_policy.ex`
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing feed tests proving `home_feed` excludes `:story` rows while a new `story_feed` surface returns only active visible stories ordered newest-first
- [ ] Step 2: Add failing query tests proving expired stories disappear from direct post lookups and Relay node refetch even when the ID is otherwise valid
- [ ] Step 3: Implement `LC.Feed.story_feed/2` and `LC.Feed.story_feed_query/1` by composing the existing read-policy helper with an active-story filter
- [ ] Step 4: Tighten `LC.Feed.home_feed_query/1` and `LC.Feed.get_visible_post/2` so standard posts and active stories follow the intended split without changing block/mute/follow visibility semantics
- [ ] Step 5: Keep anonymous post lookups limited to active public content from non-suspended authors so expired/public story IDs cannot bypass viewer-scoped feed rules
- [ ] Step 6: Run the focused feed and Relay visibility slice, then commit the story-read-model refactor

**Task 2 behavior targets:**

- `homeFeed` remains a standard-post timeline.
- `storyFeed` returns only active story posts visible to the viewer.
- Expired stories disappear from both feed surfaces and direct node-style refetches.
- Story visibility continues to respect suspension, block, mute, and follow/public policy.

**Suggested verification command:**

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS.

### Task 3: Publish Relay Story/Media GraphQL Surfaces And Verify Node/Auth Behavior

**Files:**
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_queries.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `lib/live_canvas_gql/feed/feed_queries.ex`
- Modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for `createPost(kind: STORY, mediaAssetIds: ...)`, `Post.mediaAssets`, and a Relay `storyFeed` connection
- [ ] Step 2: Extend the GraphQL enums/input handling so `createPost` can accept `STORY` plus `mediaAssetIds` while keeping author identity viewer-scoped
- [ ] Step 3: Expose media attachments from the `Post` node in a Relay-safe way that can batch author/media lookups without bypassing ownership checks on raw media asset IDs
- [ ] Step 4: Publish `storyFeed` through the Feed GraphQL surface and keep cursor ordering deterministic for active stories
- [ ] Step 5: Re-apply node-level auth so expired stories or unauthorized story IDs resolve to `nil` instead of leaking through `node(id:)` or `post(id:)`
- [ ] Step 6: Run `mix compile`, the focused GraphQL/content/feed slice, and `mix typecheck`, then commit the public API milestone

**Task 3 behavior targets:**

- Clients can create story posts by attaching already-uploaded viewer-owned media assets.
- Relay post nodes expose attached media without falling back to raw database IDs.
- The new story feed is cursor-paginated and viewer-scoped like the rest of the API.
- Expired or unauthorized story IDs cannot be refetched through GraphQL nodes.

**Suggested verification command:**

```bash
mix compile
mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

Expected: PASS.

## Rollout Notes

- Favor one reusable post-attachment path in `LC.Content` instead of separate standard-post and story-specific insert flows.
- Keep story expiry calculations server-owned so clients cannot create effectively permanent stories by omission.
- If GraphQL attachment loading needs batching, prefer request-scoped dataloader paths instead of ad hoc `Repo` calls in child resolvers.
- Do not let story support weaken the existing Relay/auth guarantees for posts, media assets, or feed connections.

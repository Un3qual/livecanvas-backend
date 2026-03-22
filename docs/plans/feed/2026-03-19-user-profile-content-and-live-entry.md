# User Profile Content And Live Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose viewer-scoped user profile content and live-entry surfaces from the existing Relay `User` node so clients can load authored posts, active stories, the current live session, and recent replays without inventing a parallel profile type.

**Architecture:** Keep `LC.Feed` as the read-side owner for profile posts, stories, live-session entry, and replay lookups by extending the existing visibility-aware feed queries with author/host filters. Keep `LCGQL.Accounts` adapter-thin by publishing these surfaces as child fields on the existing `User` Relay node and re-applying visibility in every child resolver so globally refetchable user IDs cannot bypass private/follower-only rules.

**Tech Stack:** Elixir 1.15, Ecto, Absinthe Relay, ExUnit, Dialyzer

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. The Relay `User` node currently exposes identity/privacy plus follower/following connections, but it has no child fields for authored posts, active stories, current live session, or recent replays (`lib/live_canvas_gql/accounts/account_types.ex`, `lib/live_canvas_gql/accounts/account_queries.ex`).
2. `LC.Feed` currently only publishes global discovery read models (`home_feed_query/1`, `story_feed_query/1`, `live_now_query/1`, `replay_feed_query/1`) and lacks author/host-scoped profile queries that preserve the same visibility rules (`lib/live_canvas/feed.ex`).
3. User-profile GraphQL coverage exists for `viewer`, `followers`, and `following`, but there are no account or Relay node tests proving that user-profile content/live entry surfaces stay viewer-scoped (`test/live_canvas_gql/accounts/account_queries_test.exs`, `test/live_canvas_gql/relay/node_queries_test.exs`).
4. The completed story/media batch already delivered viewer-scoped `Post.mediaAssets`, `storyFeed`, and expired-story node protection, so the next product-facing gap is profile-oriented access to those existing content/live surfaces (`docs/plans/content/2026-03-18-post-media-attachments-and-story-feed.md`, `lib/live_canvas_gql/content/content_types.ex`, `lib/live_canvas_gql/feed/feed_queries.ex`).

## Scope Decisions

- Reuse the existing Relay `User` node as the profile entry surface; do not add a separate `Profile` GraphQL type in this slice.
- Publish profile child fields as empty connections or `nil` when the viewer lacks visibility; do not return authorization errors for ordinary private/follower-only misses.
- Keep author/host-scoped read queries in `LC.Feed` so profile discovery reuses the same block, mute, suspension, privacy, and active-story rules as the rest of the feed layer.
- Defer aggregate count fields and richer profile metadata/editing to a later simple-profile header slice; this plan is about content/live entry surfaces only.

## Progress

- [x] Task 1: Add viewer-scoped profile read models in `LC.Feed`
- [x] Task 2: Publish Relay user profile content/live fields in `LCGQL.Accounts`
- [ ] Task 3: Verify the profile surface slice and refresh plan tracking

### Task 1: Add Viewer-Scoped Profile Read Models In `LC.Feed`

**Files:**
- Modify: `lib/live_canvas/feed.ex`
- Modify: `test/live_canvas/feed_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing `LC.Feed` tests proving a viewer can only see profile standard posts, active stories, current live session, and replay rows when the same follow/public/block/mute/suspension rules already allow them
- [x] Step 2: Implement author-scoped post/story queries in `LC.Feed` by reusing the existing `visible_post_query/2` helper with explicit author filters and deterministic ordering
- [x] Step 3: Implement host-scoped current-live-session and replay queries in `LC.Feed` by composing the existing live/replay visibility rules with explicit host filters
- [x] Step 4: Keep private-account, blocked, muted, suspended, expired-story, and ended-session edge cases aligned with the existing discovery surfaces instead of adding profile-only policy branches
- [x] Step 5: Run `mix test test/live_canvas/feed_test.exs` and commit the profile read-model slice

**Task 1 behavior targets:**

- Profile post queries return only standard posts authored by the requested user and visible to the current viewer.
- Profile story queries return only active stories authored by the requested user and visible to the current viewer.
- Profile current-live-session lookups return only a joinable live session for the requested host, otherwise `nil`.
- Profile replay queries return only ended sessions with recordings for the requested host and only when the current viewer still has replay visibility.

**Suggested verification command:**

```bash
mix test test/live_canvas/feed_test.exs
```

Expected: PASS.

### Task 2: Publish Relay User Profile Content/Live Fields In `LCGQL.Accounts`

**Files:**
- Modify: `lib/live_canvas_gql/accounts/account_types.ex`
- Modify: `lib/live_canvas_gql/accounts/account_resolver.ex`
- Modify: `test/live_canvas_gql/accounts/account_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL tests for `viewer` and other-user profile reads that request `posts`, `storyFeed`, `currentLiveSession`, and `replayFeed` from the Relay `User` node
- [x] Step 2: Add the new `User` child fields as Relay-first connections/fields without introducing a separate profile query type or raw foreign-key arguments
- [x] Step 3: Implement the resolvers by delegating into the new `LC.Feed` profile read models and preserving deterministic pagination order
- [x] Step 4: Re-apply child-field authorization so `viewer`, `post`, or `node(id:)` access to a user cannot leak private/follower-only content or live sessions through globally refetchable user IDs (`CWE-639` / IDOR)
- [x] Step 5: Run `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs` and commit the GraphQL profile surface slice

**Task 2 behavior targets:**

- Clients can fetch authored posts, active stories, the current live session, and recent replays from the existing Relay `User` node.
- The same child fields work for `viewer` and `node(id:)` refetches when the viewer is authorized.
- Unauthorized viewers see empty connections or `nil` for child fields instead of leaking private content/live state.
- The new fields preserve Relay connection semantics and deterministic ordering.

**Suggested verification command:**

```bash
mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS.

### Task 3: Verify The Profile Surface Slice And Refresh Plan Tracking

**Files:**
- Modify: `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/NOW.md`

**Task 3 Step Progress:**
- [ ] Step 1: Run `mix compile`
- [ ] Step 2: Run `mix test test/live_canvas/feed_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- [ ] Step 3: Run `mix typecheck`
- [ ] Step 4: Update this checklist plus `docs/plans/INDEX.md` / `docs/plans/NOW.md`, then commit the profile surface milestone

**Task 3 behavior targets:**

- The new profile child fields compile cleanly and stay aligned with repo type/spec expectations.
- Boundary tests and GraphQL tests cover both positive profile reads and unauthorized/private fallbacks.
- Tracking docs move cleanly to the next unblocked batch once the slice is complete.

**Suggested verification command:**

```bash
mix compile
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

Expected: PASS.

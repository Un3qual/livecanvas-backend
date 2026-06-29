# Live Replay Feed Surfaces Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose visible ended live sessions with linked recordings through the Feed GraphQL surface while enforcing viewer-scoped `LiveSession` node refetch rules.

**Architecture:** Reuse the existing Relay `LiveSession` node as the replay card shape instead of inventing a new replay model. Add viewer-scoped replay queries in `LC.Feed` for ended sessions with `recording_media_asset_id`, then expose those queries through a new `replayFeed` connection while hardening `node(id:)` live-session lookups to re-apply join-or-history authorization based on the persisted session status.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Execution Summary

- Status: completed
- Track: `docs/plans/live/TRACK.md`
- Completed on: `2026-03-18`
- Depends on: `docs/plans/archive/completed/live/2026-03-17-live-session-recording-linkage.md`
- Advanced to: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 1`

## Candidate Status Verification (2026-03-18)

Verified directly in active code and tests before writing this plan:

1. **Replay discovery is still missing from the Feed read side.**
   - Evidence: `LC.Feed` exposes `home_feed` and `live_now` only, and `LCGQL.Feed.Queries` exposes `homeFeed` and `liveNow` only (`lib/live_canvas/feed.ex`, `lib/live_canvas_gql/feed/feed_queries.ex`).
2. **Ended sessions now have the durable recording link needed for replay cards.**
   - Evidence: `LC.Live.end_live_session/2` persists `recording_media_asset_id`, and the `LiveSession` GraphQL surface already exposes `recordingMediaAsset` through the existing Relay node (`lib/live_canvas/live.ex`, `lib/live_canvas_gql/feed/feed_types.ex`, `lib/live_canvas_gql/feed/feed_resolver.ex`).
3. **Relay `LiveSession` node fetch still bypasses viewer visibility at lookup time.**
   - Evidence: `fetch_live_session_node/1` returns `Live.get_live_session!/1` without resolution-scoped authorization, so global IDs are not filtered by join/history visibility rules (`lib/live_canvas_gql/schema.ex`).
4. **Current tests cover `liveNow` and recording child-field fallbacks, but not replay feed discovery or live-session node authorization.**
   - Evidence: `test/live_canvas/feed_test.exs` and `test/live_canvas_gql/feed/feed_queries_test.exs` have no replay assertions, and `test/live_canvas_gql/relay/node_queries_test.exs` checks child-field null fallbacks without requiring the unauthorized `LiveSession` node itself to disappear.

## Scope And Assumptions

- Reuse the existing `LiveSession` Relay node plus `recordingMediaAsset`; do not create a separate replay table or GraphQL type in this slice.
- Treat ended sessions with non-`nil` `recording_media_asset_id` as replay-eligible.
- Keep replay ordering deterministic with newest-ended sessions first (`ended_at`, then `inserted_at`, then `id`).
- Enforce the same suspension, mute, block, and follow-based visibility rules used for retained history and live access.
- Keep chat previews, replay ranking, and playback analytics out of scope for now.

## Progress

- [x] Task 1: Add replay discovery query primitives in Feed
- [x] Task 2: Expose replayFeed and harden Relay live-session fetches
- [x] Task 3: Run final verification and refresh tracking

### Task 1: Add Replay Discovery Query Primitives In Feed

**Files:**
- Modify: `lib/live_canvas/feed.ex`
- Modify: `test/live_canvas/feed_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing Feed tests for replay visibility and ordering
- [x] Step 2: Add failing Feed tests for unrecorded and unauthorized session exclusion
- [x] Step 3: Run focused Feed tests to verify RED
- [x] Step 4: Add `replay_feed/2` and `replay_feed_query/1` for visible ended sessions with recordings
- [x] Step 5: Re-run focused Feed tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- `Feed.replay_feed/2` returns visible ended sessions with linked recordings, newest-first.
- Sessions without a linked recording never appear in replay discovery.
- Suspended, blocked, muted, and unauthorized follower-only hosts stay hidden from replay discovery.
- Host self-visibility still works for the owner's own ended sessions.

**Suggested TDD details:**

Step 1 should add coverage for:
- public replay sessions appearing for unrelated viewers
- follower-visible replay sessions appearing for accepted followers
- replay ordering using the newest ended session first

Step 2 should add coverage for:
- excluding ended sessions with `recording_media_asset_id == nil`
- excluding blocked or muted hosts
- excluding suspended hosts
- excluding follower-only replays for non-followers

Step 3 command:

```bash
mix test test/live_canvas/feed_test.exs
```

Expected: FAIL because `LC.Feed` has no replay query API today.

Step 4 implementation notes:
- Mirror the visibility joins already used in `live_now_query/1` rather than pushing replay filtering into GraphQL.
- Filter to `status == :ended` plus non-`nil` `recording_media_asset_id`.
- Add a concise comment explaining that replay discovery mirrors retained-history visibility, not live-only presence.

Step 6 commands:

```bash
mix compile
mix test test/live_canvas/feed_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add lib/live_canvas/feed.ex test/live_canvas/feed_test.exs docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md
git commit -m "feat: add replay feed query primitives"
```

### Task 2: Expose replayFeed And Harden Relay Live-Session Fetches

**Files:**
- Modify: `lib/live_canvas_gql/feed/feed_queries.ex`
- Modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL tests for `replayFeed`
- [x] Step 2: Add failing Relay node tests for unauthorized live-session node refetch
- [x] Step 3: Run focused Feed and Relay node tests to verify RED
- [x] Step 4: Add the `replayFeed` connection and re-apply viewer authorization in live-session node fetches
- [x] Step 5: Re-run focused Feed and Relay node tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- `replayFeed` returns visible ended `LiveSession` nodes that already expose `recordingMediaAsset`.
- Missing auth scope returns an empty replay connection instead of leaking sessions or raising.
- `node(id:)` returns `nil` for unauthorized `LiveSession` lookups and still refetches authorized sessions.
- Active-session node fetches keep using live join visibility, while ended-session node fetches use retained-history visibility.

**Suggested TDD details:**

Step 1 should add coverage for:
- `replayFeed(first: ...)` returning public replay sessions with host and recording metadata
- follower-visible replay sessions appearing only for accepted followers
- replay connections excluding ended sessions without linked recordings

Step 2 should add coverage for:
- unauthorized follower-only ended sessions returning `nil` from `node(id:)`
- unauthorized follower-only active sessions returning `nil` from `node(id:)`
- authorized viewers still refetching visible replay sessions successfully

Step 3 command:

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: FAIL because GraphQL exposes no `replayFeed` field and live-session node fetch is not viewer-scoped today.

Step 4 implementation notes:
- Add `replayFeed` under `LCGQL.Feed.Queries` and resolve it through `LC.Feed.replay_feed_query/1`.
- Keep the GraphQL surface additive by returning the existing `:live_session` node type.
- In `LCGQL.Schema`, load the `LiveSession` first, then gate refetch with `Chat.authorize_join/2` for non-ended sessions and `Chat.authorize_history_access/2` for ended sessions.
- Add a concise comment explaining that globally refetchable live-session IDs must not bypass replay visibility (`CWE-639` / IDOR).

Step 6 commands:

```bash
mix compile
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add lib/live_canvas_gql/feed/feed_queries.ex lib/live_canvas_gql/feed/feed_resolver.ex lib/live_canvas_gql/schema.ex test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md
git commit -m "feat: expose replay feed discovery"
```

### Task 3: Run Final Verification And Refresh Tracking

**Files:**
- Modify: `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md`
- Modify: `docs/plans/live/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [x] Step 1: Run final verification on the touched Feed and GraphQL suites
- [x] Step 2: Update plan, track, index, and `NOW.md` tracking based on the next unblocked batch
- [x] Step 3: Commit the milestone

**Task 3 verification commands:**

```bash
mix compile
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

Expected: PASS.

Step 3 commit:

```bash
git add docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md docs/plans/live/TRACK.md docs/plans/INDEX.md docs/plans/NOW.md docs/plans/README.md
git commit -m "docs: track live replay feed work"
```

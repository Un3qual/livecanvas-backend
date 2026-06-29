# Feed Mute Visibility Alignment Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure feed read surfaces hide content from creators/hosts that the current viewer has muted.

**Architecture:** Keep mute ownership in `LC.Social` and apply mute filtering in `LC.Feed` read queries so GraphQL remains adapter-thin. Mute enforcement is directional (`muter -> muted`), so only the viewer's own mute rows should filter results.

**Tech Stack:** Elixir 1.15, Ecto, PostgreSQL, Absinthe Relay, ExUnit, Dialyzer

---

## Progress

- [x] Task 1: Add failing feed visibility tests for directional mute filtering
- [x] Task 2: Implement mute-aware feed query filtering
- [x] Task 3: Run verification, update plan progress, and commit

### Task 1: Add Failing Feed Visibility Tests For Directional Mute Filtering

**Files:**
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/integration/feed_visibility_flow_test.exs`
- Modify: `docs/plans/2026-03-03-feed-mute-visibility-alignment.md`

**Task 1 Step Progress:**
- [x] Step 1: Add context tests asserting muted creators/hosts are excluded
- [x] Step 2: Add GraphQL feed query tests asserting muted nodes are excluded
- [x] Step 3: Add integration feed visibility flow assertion for muted creators
- [x] Step 4: Run focused tests to verify RED

**Step 4: Run focused tests to verify RED**

Run:

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs --trace
```

Expected: FAIL because `LC.Feed` does not yet apply mute filtering.

### Task 2: Implement Mute-Aware Feed Query Filtering

**Files:**
- Modify: `lib/live_canvas/feed.ex`
- Modify: `docs/plans/2026-03-03-feed-mute-visibility-alignment.md`

**Task 2 Step Progress:**
- [x] Step 1: Add directional mute join/filter to `home_feed_query/1`
- [x] Step 2: Add directional mute join/filter to `live_now_query/1`
- [x] Step 3: Add concise comments for directional query intent
- [x] Step 4: Run focused tests to verify GREEN

**Step 4: Run focused tests to verify GREEN**

Run:

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs --trace
```

Expected: PASS with muted creators/hosts excluded and existing visibility behavior intact.

### Task 3: Final Verification, Plan Tracking, And Commit

**Files:**
- Modify: `docs/plans/2026-03-03-feed-mute-visibility-alignment.md`
- Verify: `lib/live_canvas/feed.ex`
- Verify: `test/live_canvas/feed_test.exs`
- Verify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Verify: `test/integration/feed_visibility_flow_test.exs`

**Task 3 Step Progress:**
- [x] Step 1: Mark all completed checklist items in this plan file
- [x] Step 2: Run verification commands
- [x] Step 3: Commit related code + tests + plan updates together

**Step 2: Run verification commands**

Run:

```bash
mix compile
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs --trace
mix check.typespecs --strict
mix typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add lib/live_canvas/feed.ex test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs docs/plans/2026-03-03-feed-mute-visibility-alignment.md
git commit -m "feat: enforce directional mutes in feed visibility"
```

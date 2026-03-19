# Query Policy Composition And Reuse Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize repeated LC read/query policy composition so feed, chat, and social surfaces share one source of truth for block, mute, follow, and visibility rules without weakening viewer authorization or Relay semantics.

**Architecture:** Keep GraphQL resolvers thin and Relay-first, but move duplicated visibility composition into a small internal policy module that can build reusable query fragments for viewer-scoped reads. Prefer policy helpers that compose into the existing Ecto queries rather than ad hoc joins in each caller, so efficiency gains and policy readability land together without changing node fetch authorization or cursor ordering.

**Tech Stack:** Elixir 1.15, Ecto, Absinthe Relay, ExUnit, Dialyzer

---

## Current State Verification

Verified directly in the codebase before drafting this plan:

1. `lib/live_canvas/feed.ex` repeats the same viewer-centric joins and filters across `home_feed_query/1`, `live_now_query/1`, and `replay_feed_query/1` for `Follow`, `Mute`, and `Block`.
2. `lib/live_canvas/chat.ex` re-implements visibility logic in `authorize_visible_session_access/2` by combining `active_user?/1`, `active_host/1`, `Social.muted?/2`, and `Social.relationship_state/2`.
3. `lib/live_canvas/social.ex` separately owns the lower-level social predicates (`muted?/2`, `relationship_state/2`, `can_view_user?/2`, `blocked_between?/2`, `follow_state/2`) that feed and chat also need conceptually.
4. `lib/live_canvas_gql/feed/feed_resolver.ex`, `lib/live_canvas_gql/social/social_resolver.ex`, and `lib/live_canvas_gql/chat/chat_resolver.ex` still act as boundary adapters, so any reuse must preserve their viewer auth checks and Relay pagination behavior.
5. Existing tests already encode the repeated policy matrix in multiple places: `test/live_canvas/feed_test.exs`, `test/live_canvas/social_test.exs`, `test/live_canvas/chat_test.exs`, `test/live_canvas_gql/feed/feed_queries_test.exs`, `test/live_canvas_gql/social/social_queries_test.exs`, `test/live_canvas_gql/chat/chat_queries_test.exs`, and `test/integration/feed_visibility_flow_test.exs`.

## Scope Decisions

- Centralize policy composition, not GraphQL schema shape.
- Keep viewer authorization checks at node fetchers and child field resolvers intact.
- Preserve Relay connection ordering, edges, cursors, and pageInfo semantics.
- Separate efficiency work from naming/readability work only if the helper shape benefits from a staged rollout.
- Do not broaden access; every refactor must preserve current block, mute, follow, and suspension behavior.

## Progress

- [x] Task 1: Baseline the repeated policy matrix and lock behavior with focused tests
- [x] Task 2: Extract reusable viewer-visibility query helpers and refactor feed queries
- [ ] Task 3: Reuse the shared policy helpers in chat/social boundary authorization and verify Relay/auth safety

### Task 1: Baseline The Repeated Policy Matrix And Lock Behavior With Focused Tests

**Files:**
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/live_canvas/chat_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Modify: `test/integration/feed_visibility_flow_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add or tighten tests that capture the shared viewer policy matrix for blocked creators/hosts, viewer-muted creators/hosts, reverse-mute cases, and follower/public visibility
- [x] Step 2: Add a regression test that exercises the same visibility rules through the GraphQL feed and social surfaces so the refactor cannot change the Relay contract
- [x] Step 3: Run the focused feed/social/chat test slice to establish the current baseline and verify the new assertions fail only where the refactor is still needed
- [x] Step 4: Confirm the tests describe the intended behavior in the smallest possible surface area and do not encode implementation details
- [x] Step 5: Commit the baseline test updates before extracting shared policy helpers

**Task 1 behavior targets:**

- Blocked users remain hidden from feed discovery and chat visibility checks.
- Viewer-issued mutes remain directional and hide the muted creator/host, while reverse mutes do not hide content.
- Public and accepted-follow visibility behavior stays unchanged.
- GraphQL connections still return Relay edges and cursors for only the visible rows.

**Suggested verification command:**

```bash
mix test \
  test/live_canvas/feed_test.exs \
  test/live_canvas/social_test.exs \
  test/live_canvas/chat_test.exs \
  test/live_canvas_gql/feed/feed_queries_test.exs \
  test/live_canvas_gql/social/social_queries_test.exs \
  test/live_canvas_gql/chat/chat_queries_test.exs \
  test/integration/feed_visibility_flow_test.exs
```

Expected: the current suite should remain behaviorally consistent while the new assertions document the policy matrix that the refactor must preserve.

### Task 2: Extract Reusable Viewer-Visibility Query Helpers And Refactor Feed Queries

**Files:**
- Create: `lib/live_canvas/read_policy.ex`
- Modify: `lib/live_canvas/feed.ex`
- Modify: `lib/live_canvas/social.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `test/live_canvas/feed_test.exs`
- Modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Modify: `test/integration/feed_visibility_flow_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Write a failing test or expectation that proves the shared query helper can express the same feed visibility outcomes without duplicating join logic in each feed query
- [x] Step 2: Introduce the shared read-policy helper module with small, composable functions for blocked-user hiding, directional mute hiding, and follow/public visibility checks
- [x] Step 3: Refactor `LC.Feed.home_feed_query/1`, `LC.Feed.live_now_query/1`, and `LC.Feed.replay_feed_query/1` to compose the helper instead of hand-writing the same join set three times
- [x] Step 4: Preserve query ordering, cursor stability, and the exact visible row set while reducing duplicated SQL construction
- [x] Step 5: Run the focused feed tests and GraphQL feed tests to verify the helper does not alter visible results
- [x] Step 6: Run `mix compile` and commit the efficiency-focused refactor once the query shape is stable

**Task 2 behavior targets:**

- The feed boundary uses one reusable visibility composition path instead of three near-identical query bodies.
- Block, mute, and follow predicates remain exact, but the query construction becomes easier to extend for future surfaces.
- The refactor should make it obvious where a new viewer-scoped visibility rule belongs.

**Efficiency targets:**

- Reduce repeated query construction for `Follow`, `Mute`, and `Block` joins across the three feed query builders.
- Prefer one composed policy helper per viewer/query shape instead of inlining the same join predicates repeatedly.
- Keep the resulting SQL shape predictable so the same policy fragment can be reused by other read surfaces later.

**Readability and extensibility targets:**

- Give the shared policy vocabulary names that match the domain terms users already understand: blocked, muted, followed, public, and accepted.
- Keep helper functions small enough that new callers can compose them without reading the feed implementation first.
- Add comments only where the policy ordering or directional mute semantics would otherwise be easy to misread.

**Suggested verification command:**

```bash
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/integration/feed_visibility_flow_test.exs
```

Expected: PASS with identical visible rows, ordering, and Relay pagination behavior.

### Task 3: Reuse The Shared Policy Helpers In Chat/Social Boundary Authorization And Verify Relay/Auth Safety

**Files:**
- Modify: `lib/live_canvas/chat.ex`
- Modify: `lib/live_canvas/social.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/social/social_resolver.ex`
- Modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Modify: `test/live_canvas/chat_test.exs`
- Modify: `test/live_canvas/social_test.exs`
- Modify: `test/live_canvas_gql/social/social_queries_test.exs`
- Modify: `test/live_canvas_gql/chat/chat_queries_test.exs`

**Task 3 Step Progress:**
- [ ] Step 1: Identify the remaining auth/read paths that still reconstruct the same visibility policy in boundary code instead of calling the shared helper
- [ ] Step 2: Refactor `LC.Chat.authorize_visible_session_access/2` and the relevant `LC.Social` predicates so they reuse the shared policy module without loosening session or user visibility rules
- [ ] Step 3: Keep GraphQL node fetchers and child field resolvers viewer-scoped, with no shortcut that lets a global ID or raw foreign key bypass ownership or visibility checks
- [ ] Step 4: Update the chat/social GraphQL tests to confirm the Relay contract and the auth fallback behavior remain unchanged
- [ ] Step 5: Run `mix compile`, `mix typecheck`, and the focused chat/social GraphQL suite to verify the refactor is safe for typed code and Relay edges
- [ ] Step 6: Commit the policy-reuse milestone once both the query-side and boundary-side reuse is green

**Task 3 behavior targets:**

- Chat history authorization continues to reject unauthorized viewers exactly as before.
- Social read-state and mute checks continue to derive from authenticated viewer scope.
- Relay node fetches and child resolvers remain the enforcement point for globally refetchable IDs.
- The new helper becomes the single place to reason about repeated viewer visibility composition.

**Suggested verification command:**

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas/social_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs
mix typecheck
```

Expected: PASS.

## Rollout Notes

- Keep the first extraction small enough that feed can adopt it without forcing a parallel GraphQL contract change.
- If a helper is too generic, split it by domain term rather than letting one module become a catch-all visibility bag.
- Prefer comments that explain why a policy exists, not how Ecto syntax works.
- Do not weaken viewer-scoped authorization just to reduce query code repetition.

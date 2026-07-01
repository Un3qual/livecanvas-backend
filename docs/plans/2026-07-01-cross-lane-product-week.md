# Cross-Lane Product Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current mobile feed/content surface, promote backend fixes
only when verified by that work, and prepare the next product-facing mobile
batch.

**Architecture:** Keep `docs/plans/mobile/NOW.md` as the executable pointer for
the active feed/content batch. Backend work is issue-driven: only promote a
backend lane task when frontend/mobile work exposes a concrete GraphQL contract,
resolver, runtime, or data issue. Shared coordinator docs own the week-level
sequence and must stay short enough to route execution quickly.

**Tech Stack:** Expo React Native, Relay, Bun, Absinthe Relay, Ecto, ExUnit,
Mix verification gates.

---

## Executor Brief

Planning horizon: Wednesday 2026-07-01 through Tuesday 2026-07-07, using the
repository's 2026-06-30 lane state as the starting point.

The next week should stay product-focused. Release-candidate manual device QA
remains deferred unless product explicitly resumes it. Compliance hard-delete
enablement remains paused. The backend starter-kit extraction plan is not part
of this product week.

## Context

- Active mobile plan:
  `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Active mobile task: Task 4, section refresh and pagination affordances.
- Backend lane state: issue-driven; no standalone backend batch selected.
- Feed contracts:
  - `docs/contracts/mobile-graphql-phase2.md`
  - `docs/contracts/mobile-live-session-graphql.md`
- Current backend feed resolver:
  `lib/live_canvas_gql/feed/feed_resolver.ex`
- Current backend feed tests:
  `test/live_canvas_gql/feed/feed_queries_test.exs`
- Current mobile feed screen:
  `mobile/src/feed/FeedHomeScreen.tsx`

## Week Schedule

1. 2026-07-01: Finish the mobile feed pagination/refresh design and failing
   screen tests.
2. 2026-07-02: Implement mobile Task 4, regenerate Relay artifacts if needed,
   and run focused mobile verification.
3. 2026-07-03: Run backend feed/reporting contract verification against the
   exact mobile surface; promote and fix backend issues only if reproduced.
4. 2026-07-06: Close the feed/content lane batch with evidence and run final
   mobile/backend gates that match the touched files.
5. 2026-07-07: Create or promote the next product-facing batch. Default
   candidate, if the feed lane closes cleanly, is a mobile post composer using
   the existing `createPost` and `requestMediaUpload` GraphQL contract.

## Tasks

### Task 1: Finish Mobile Feed Pagination And Refresh

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.test.tsx`
- Modify if Relay query text changes:
  `mobile/src/__generated__/FeedHomeScreenQuery.graphql.ts`

Acceptance criteria:
- [ ] Stories, home feed, and replays render explicit `Load more` buttons only
      when their `pageInfo.hasNextPage` is true.
- [ ] Each paginated section uses its own loading state and does not block
      live-now rows or the viewer current-session card.
- [ ] Combined refresh re-runs the home query without clearing local
      `reportPost` confirmation/error state for already visible posts.
- [ ] Pagination variables use Relay cursors from `pageInfo.endCursor`; the
      mobile client does not construct offsets or decode Relay IDs.
- [ ] The current `Report post` duplicate-tap behavior still passes.

Implementation notes:
- Start with `mobile/tests/feed/FeedHomeScreen.test.tsx`. Add fixtures where
  `storyFeed`, `homeFeed`, and `replayFeed` each have
  `pageInfo: { hasNextPage: true, endCursor: "<section>-cursor" }`.
- Prefer a small feed-local reducer for section pagination state:
  `stories`, `homeFeed`, and `replays` each track visible nodes, `endCursor`,
  `isLoadingMore`, and a viewer-safe error string.
- If the simplest Relay-supported approach is root-query variables, add
  section-specific `after` variables such as `storyAfter`, `feedAfter`, and
  `replayAfter`. Do not use count-only "increase first" pagination as the final
  implementation because it does not exercise cursors.
- Use `RefreshControl` on the existing `ScrollView` if React Native test
  doubles can support it cleanly; otherwise use an explicit refresh button in
  the home header for this batch and record that decision in the plan evidence.

Focused verification:
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run relay` if query variables or selection shape change.
- From repo root: `git diff --check`

Milestone commit:
- Commit mobile Task 4 implementation and its focused test updates together.

### Task 2: Verify Backend Feed And Reporting Contracts As Needed

**Files:**
- Verify or modify: `lib/live_canvas_gql/feed/feed_resolver.ex`
- Verify or modify: `test/live_canvas_gql/feed/feed_queries_test.exs`
- Verify or modify: `test/integration/feed_visibility_flow_test.exs`
- Verify or modify if reporting regresses:
  `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify only if the documented contract is wrong:
  - `docs/contracts/mobile-graphql-phase2.md`
  - `docs/contracts/mobile-live-session-graphql.md`

Acceptance criteria:
- [ ] `homeFeed(first, after)`, `storyFeed(first, after)`, and
      `replayFeed(first, after)` return stable Relay cursors for the mobile
      pagination path.
- [ ] Backend ordering matches the documented contracts:
      home/story feed visibility policy remains viewer scoped, and replay feed
      remains newest-ended first.
- [ ] `reportPost` remains viewer-scoped, idempotent per viewer/post pair, and
      returns payload errors rather than raw GraphQL errors for known client
      states.
- [ ] If backend code is touched, public functions keep typespecs and affected
      GraphQL node/child resolvers continue re-applying viewer authorization.
- [ ] If all backend checks pass without code changes, record that evidence in
      the active mobile plan instead of creating a backend implementation task.

Promotion rule:
- Promote a backend issue into `docs/plans/backend/NOW.md` only after a focused
  failing test or manual query reproduces it. The promoted entry must name write
  scope, verification commands, and the frontend/mobile behavior it unblocks.

Focused verification:
- From repo root:
  `mix test test/live_canvas_gql/feed/feed_queries_test.exs`
- From repo root, if report behavior is touched:
  `mix test test/live_canvas_gql/content/content_mutations_test.exs`
- From repo root, if typed backend code is touched:
  `mix typecheck`
- From repo root: `git diff --check`

Milestone commit:
- If backend code or contracts change, commit that backend fix separately from
  the mobile Task 4 commit. If no backend changes are needed, do not create a
  docs-only evidence commit unless lane closure is happening in the same pass.

### Task 3: Close The Feed/Content Discovery Lane

**Files:**
- Modify: `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/INDEX.md`

Acceptance criteria:
- [ ] Task 4 and Task 5 are checked off with concise command evidence.
- [ ] The source plan is archived under
      `docs/plans/archive/completed/mobile/` only after final verification
      passes.
- [ ] `docs/plans/mobile/NOW.md` either points at the next selected product
      batch or says mobile product direction is needed.
- [ ] `docs/plans/NOW.md` keeps release-candidate manual QA deferred unless
      product explicitly resumes it.
- [ ] The backend lane remains issue-driven unless Task 2 promoted a concrete
      backend follow-up.

Final verification:
- From `mobile/`: `bun test tests/feed/feedPresentation.test.ts`
- From `mobile/`: `bun test tests/feed/reportPostReducer.test.ts`
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run test:quality`
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

Milestone commit:
- Commit lane closure docs with the completed feed/content implementation
  evidence, or as a docs-only lane-closure commit if implementation was already
  committed.

### Task 4: Audit The Next Product Gap

**Files:**
- Create or modify:
  `docs/plans/2026-07-06-cross-lane-product-gap-audit.md`
- Read-only references:
  - `mobile/app/**`
  - `mobile/src/**`
  - `lib/live_canvas_gql/content/content_mutations.ex`
  - `lib/live_canvas_gql/content/content_resolver.ex`
  - `test/live_canvas_gql/content/content_mutations_test.exs`
  - `docs/contracts/mobile-graphql-phase2.md`

Acceptance criteria:
- [ ] The audit lists shipped mobile surfaces for auth, profiles, home feed,
      live watch, chat, replay, reporting, diagnostics, and host preflight.
- [ ] The audit lists missing product surfaces backed by existing backend
      contracts, starting with mobile post creation because backend
      `createPost`, `requestMediaUpload`, `updatePost`, and `deletePost`
      already exist while mobile has no composer route.
- [ ] The audit selects one next batch and records why it beats release-candidate
      manual QA for product completeness, or explicitly recommends resuming QA
      if no product gap remains.
- [ ] The audit names backend issues to promote only when backed by a contract
      mismatch or failing verification.

Focused verification:
- From repo root: `git diff --check`

Milestone commit:
- Commit the audit and any pointer updates together.

### Task 5: Promote The Next Product Batch

Default batch if Task 4 confirms the gap:
mobile post composer over the existing content GraphQL contract.

**Files:**
- Create: `docs/plans/mobile/2026-07-07-mobile-post-composer.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/INDEX.md`

Acceptance criteria:
- [ ] The next batch is small enough to complete independently: text-only
      `STANDARD` and `STORY` post creation first, with media upload either in a
      second task or explicitly deferred inside the same plan.
- [ ] The plan uses existing backend mutations before proposing backend schema
      changes: `createPost(input:)` and, only for media follow-up,
      `requestMediaUpload(input:)`.
- [ ] The first task has focused mobile tests under `mobile/tests/**`, not
      colocated under `mobile/src/**`.
- [ ] Backend work is only included if the mobile plan proves a missing contract
      or resolver behavior. Any such work is promoted to `docs/plans/backend/NOW.md`
      with verification.
- [ ] Release-candidate QA remains deferred unless product explicitly resumes it.

Focused verification:
- From repo root: `git diff --check`

Milestone commit:
- Commit the promoted plan and lane pointers as a planning commit.

## Out Of Scope This Week

- Compliance hard-delete enablement.
- Backend starter-kit extraction.
- Remote or authenticated EAS build/submit commands.
- Release-candidate manual device QA unless explicitly resumed.
- A broad backend roadmap reopen without a reproduced frontend/product need.

## Handoff

Start with `docs/plans/mobile/NOW.md` and finish Task 4 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`. Use this weekly
plan only to sequence the follow-up work after each milestone. If Task 1 or
Task 2 reveals a backend contract mismatch, promote that issue into
`docs/plans/backend/NOW.md` before editing backend code.

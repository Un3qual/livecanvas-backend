# Mobile Feed And Content Discovery Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first mobile-owned feed/content discovery surface so signed-in
viewers can browse visible posts, active stories, live sessions, and replayable
recordings from the existing backend GraphQL contract.

**Architecture:** Keep this as a Relay-first mobile product slice over the
current schema. `/home` becomes a product home that still preserves the current
host/profile/diagnostics actions and live-now entry, but adds read-only content
sections backed by `homeFeed`, `storyFeed`, and `replayFeed`. Post reporting uses
the existing `reportPost` mutation. Do not add post creation, media upload,
backend schema changes, or release-candidate QA in this batch.

**Tech Stack:** Expo React Native, Relay generated queries and mutations,
existing app UI primitives, Bun tests.

---

## Executor Brief

Mobile currently routes `/home` directly to live discovery. The checked-in
mobile schema already exposes `homeFeed`, `storyFeed`, `replayFeed`, `Post`,
`Post.mediaAssets`, and `reportPost`, but no mobile route or screen renders
those content surfaces. This batch should turn the backend-backed feed contract
into a real mobile product surface without expanding backend scope.

## Context

- Current home route: `mobile/app/(app)/home.tsx`
- Existing live home screen:
  `mobile/src/live/discovery/LiveDiscoveryScreen.tsx`
- Existing live/replay card primitive:
  `mobile/src/live/components/LiveSessionSummaryCard.tsx`
- Mobile schema source: `mobile/schema.graphql`
- Content/social contract: `docs/contracts/mobile-graphql-phase2.md`
- Live/replay contract: `docs/contracts/mobile-live-session-graphql.md`

## Tasks

### Task 1: Add feed presentation models

**Files:**
- Create: `mobile/src/feed/feedPresentation.ts`
- Test: `mobile/tests/feed/feedPresentation.test.ts`

Acceptance criteria:
- [x] `Post` card presentation handles `STANDARD` and `STORY` posts.
- [x] Empty or missing body text renders neutral fallback copy without throwing.
- [x] Media asset presentation distinguishes processed, processing, failed, and
      unavailable media.
- [x] Author presentation uses available profile fields and keeps missing email
      viewer-safe.
- [x] Story expiry and post visibility labels are derived in pure helpers so
      screen tests do not duplicate formatting logic.

Implementation notes:
- Keep helpers pure and typed against generated Relay query data where possible.
- Do not introduce local-only content IDs; preserve Relay IDs as opaque strings.

Focused verification:
- From `mobile/`: `bun test tests/feed/feedPresentation.test.ts`

Evidence:
- 2026-06-30: `bun test tests/feed/feedPresentation.test.ts` passes with 4
  tests after red/green implementation.

### Task 2: Replace live-only home with a product home surface

**Files:**
- Create: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/app/(app)/home.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [x] `/home` renders a signed-in product home with sections for stories, home
      feed posts, live now, replays, and the viewer's current live session when
      present.
- [x] Existing home actions remain reachable: host a live session when the
      viewer has no current session, open profile, and diagnostics.
- [x] `homeFeed(first:)`, `storyFeed(first:)`, `replayFeed(first:)`,
      `liveNow(first:)`, `viewer.id`, and `viewer.currentLiveSession` are
      queried from Relay.
- [x] Live and replay rows use `liveSessionHref(session.id)` rather than
      decoding Relay IDs.
- [x] Empty, loading, and query-error states are covered for the combined home
      surface.

Implementation notes:
- Move only the reusable parts of `LiveDiscoveryScreen` that the new home needs;
  leave the live-session watch and host flows untouched.
- Use the existing `AppHeader`, `AppCard`, `AppButton`, `ScreenState`, and
  `LiveSessionSummaryCard` primitives before adding new UI primitives.
- Keep section sizes bounded for first load; pagination is Task 4.

Focused verification:
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`

Evidence:
- 2026-06-30: `bun test tests/feed/FeedHomeScreen.test.tsx` passes with 5
  tests after red/green implementation and Relay codegen.

### Task 3: Add post reporting from feed cards

**Files:**
- Create: `mobile/src/feed/reportPostReducer.ts`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test:
  - `mobile/tests/feed/reportPostReducer.test.ts`
  - `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [x] Each visible post card offers a report action for non-owned visible posts
      when the backend data allows the action to be shown safely.
- [x] Reporting submits `reportPost(input: {postId, reason, details})` with the
      authenticated viewer implied by backend scope.
- [x] Supported reasons come from the schema enum values documented in
      `docs/contracts/mobile-graphql-phase2.md`.
- [x] Duplicate taps cannot start duplicate report mutations for the same post.
- [x] Payload errors such as `own_post`, `not_found`, and `unauthenticated` show
      viewer-safe copy and leave the card retryable.
- [x] A successful report shows a confirmation state without removing the post
      from the feed.

Implementation notes:
- A minimal inline report panel is enough for this batch; do not add a global
  moderation center or staff review workflow.
- Use `viewer.id` and `Post.author.id` to hide reporting on the viewer's own
  posts before submitting; keep backend `own_post` handling as the final guard.
- Keep report state local to the feed screen unless implementation discovers a
  real cross-screen need.

Focused verification:
- From `mobile/`:
  - `bun test tests/feed/reportPostReducer.test.ts`
  - `bun test tests/feed/FeedHomeScreen.test.tsx`

Evidence:
- 2026-06-30: `bun test tests/feed/reportPostReducer.test.ts tests/feed/FeedHomeScreen.test.tsx`
  passes with 10 tests after red/green implementation and Relay mutation
  codegen.

### Task 4: Add section refresh and pagination affordances

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Detailed task plan:
- `docs/plans/mobile/2026-07-01-feed-section-refresh-pagination.md`

Acceptance criteria:
- [x] Home feed, stories, and replays expose explicit load-more affordances when
      their Relay connections have a next page.
- [x] Loading older content is section-scoped and does not block live-now or the
      viewer current-session card.
- [x] Pull-to-refresh or retry refreshes the combined home query without losing
      already visible local report confirmation state.
- [x] Pagination uses Relay cursors and never constructs offsets or decodes
      Relay IDs client-side.

Implementation notes:
- Prefer the smallest Relay pagination pattern already supported by this
  codebase. If a pagination fragment is introduced, keep it local to the feed
  feature folder.
- Do not solve infinite scroll polish in this batch; explicit load-more buttons
  are acceptable.

Focused verification:
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`

Evidence:
- 2026-07-01: `bun test tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx`
  passes with 13 tests after section-scoped cursor loading and refresh.
- 2026-07-01: `bun test tests/feed/feedPresentation.test.ts tests/feed/reportPostReducer.test.ts tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx`
  passes with 20 feed tests.
- 2026-07-01: `bun run relay` completes with no generated file changes after
  the feed home cursor variable extraction.
- 2026-07-01: `bun run typecheck` and `bun run test:quality` pass after
  normalizing Relay page info and shared test mocks for refresh/fetch imports.

### Task 5: Close the lane batch

**Files:**
- Modify:
  - `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
  - `docs/plans/mobile/NOW.md`
  - `docs/plans/mobile/TRACK.md`
  - `docs/plans/NOW.md`
  - `docs/plans/INDEX.md`

Acceptance criteria:
- [x] Completed tasks are checked off with concise evidence.
- [x] The lane promotes the next non-QA product batch: mobile post composition
      over the existing `createPost` GraphQL contract.
- [x] Release-candidate manual QA remains deferred unless product explicitly
      resumes it.

Evidence:
- 2026-07-01: Tasks 1-4 were already complete with focused feed evidence,
  Relay codegen evidence, `bun run typecheck`, and `bun run test:quality`.
- 2026-07-01: Close-out verified `docs/plans/mobile/NOW.md` was stale on Task 4,
  archived the completed feed/content plans, and promoted
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md` as the next mobile
  product batch.

## Final Verification

From `mobile/`:

- `bun test tests/feed/feedPresentation.test.ts`
- `bun test tests/feed/reportPostReducer.test.ts`
- `bun test tests/feed/feedHomePagination.test.ts`
- `bun test tests/feed/FeedHomeScreen.test.tsx`
- `bun run relay`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Out Of Scope

- Post creation, editing, deletion, or media upload.
- In-app replay video playback beyond opening the existing live-session watch
  route for replay rows.
- Backend schema, resolver, migration, or shared contract changes.
- Release-candidate manual device QA, EAS build/submit, store metadata, and
  launch-gate certification.

## Handoff

Start with Task 1 and keep implementation inside `mobile/**` plus the mobile
lane docs. If the existing GraphQL contract cannot support a planned UI state,
stop and record the contract mismatch instead of editing backend code from this
lane.

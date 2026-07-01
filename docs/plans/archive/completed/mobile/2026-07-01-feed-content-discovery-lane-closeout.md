# Mobile Feed Content Discovery Lane Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. This is a
> single coordinator-owned docs close-out, so do not dispatch multiple workers
> into the same shared planning files. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Close the completed mobile feed/content discovery batch, archive its
plans, repair stale lane pointers, and promote the next product-facing mobile
batch.

**Architecture:** Treat this as a coordinator docs pass over already-verified
mobile code. Keep source-of-truth execution in `docs/plans/mobile/NOW.md`, keep
shared dashboard/index text short, and keep release-candidate manual QA
deferred. Promote mobile post composition as the next product batch because the
backend schema exposes `createPost` while mobile has no composer route.

**Tech Stack:** Markdown planning docs, Git, Bun verification gates, Relay
schema references.

---

## Executor Brief

Current live state:

- `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md` has Tasks 1-4
  complete with evidence, and Task 5 still open.
- `docs/plans/mobile/NOW.md` is stale because it still points at Task 4.
- `docs/plans/NOW.md` and `docs/plans/INDEX.md` still describe the feed/content
  batch as active.
- Backend remains issue-driven in `docs/plans/backend/NOW.md`; do not promote a
  backend task during this close-out unless a verification command produces a
  concrete backend failure.
- The next product-facing candidate is mobile post composition:
  `mobile/schema.graphql` exposes `createPost`, `requestMediaUpload`,
  `updatePost`, and `deletePost`; backend tests cover those mutations; mobile
  currently has no composer route or feed create surface.

## File Structure

- `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`
  becomes the archived completed source plan.
- `docs/plans/archive/completed/mobile/2026-07-01-feed-section-refresh-pagination.md`
  becomes the archived completed Task 4 detail plan.
- `docs/plans/archive/completed/mobile/2026-07-01-feed-content-discovery-lane-closeout.md`
  becomes the archived copy of this close-out plan after execution completes.
- `docs/plans/mobile/2026-07-01-mobile-post-composer.md` becomes the promoted
  next product batch plan.
- `docs/plans/mobile/NOW.md` points at the mobile post composer plan after
  close-out.
- `docs/plans/mobile/TRACK.md` records feed/content discovery as complete and
  post composer as active.
- `docs/plans/NOW.md` and `docs/plans/INDEX.md` reflect the new active mobile
  product batch while keeping backend issue-driven and QA deferred.

## Tasks

### Task 1: Verify Close-Out Inputs

**Files:**
- Read: `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Read: `docs/plans/mobile/NOW.md`
- Read: `docs/plans/mobile/TRACK.md`
- Read: `docs/plans/NOW.md`
- Read: `docs/plans/INDEX.md`
- Read: `mobile/schema.graphql`
- Read: `test/live_canvas_gql/content/content_mutations_test.exs`
- Read: `mobile/app/**`
- Read: `mobile/src/**`

- [ ] **Step 1: Verify the branch starts clean**

Run:

```bash
git status --short --branch
```

Expected: the branch line is present and there are no unstaged or untracked
files before the close-out edits begin.

- [ ] **Step 2: Confirm only Task 5 remains open in the feed source plan**

Run:

```bash
rg -n "^- \[ \]" docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md
```

Expected: only the three Task 5 acceptance criteria are returned. If any Task
1-4 checkbox is open, read the surrounding section and reconcile it with the
recorded Task 1-4 evidence before editing lane pointers.

- [ ] **Step 3: Confirm the stale executable pointer**

Run:

```bash
rg -n "Current task|Do This Now|Next Action|Task 4" docs/plans/mobile/NOW.md
```

Expected: `docs/plans/mobile/NOW.md` still names Task 4. This verifies the next
change is a pointer repair rather than more feed implementation.

- [ ] **Step 4: Confirm the post composer gap is real**

Run:

```bash
rg -n "createPost|requestMediaUpload|PostComposer|composer" mobile docs/contracts test/live_canvas_gql/content/content_mutations_test.exs
```

Expected:

- `mobile/schema.graphql` and backend tests mention `createPost` and
  `requestMediaUpload`.
- `mobile/src/live/chat/**` may mention chat composer state.
- No `mobile/app/**` route or `mobile/src/feed/**` screen implements a post
  composer.

### Task 2: Close And Archive The Feed Plans

**Files:**
- Modify then move:
  `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Move:
  `docs/plans/mobile/2026-07-01-feed-section-refresh-pagination.md`
- Move after Task 5 is complete:
  `docs/plans/mobile/2026-07-01-feed-content-discovery-lane-closeout.md`

- [ ] **Step 1: Replace the Task 5 section in the source plan**

In `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`, replace the
Task 5 section with:

```markdown
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
```

- [ ] **Step 2: Move the completed feed source plan to the archive**

Run:

```bash
git mv docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md
```

Expected: `git status --short` shows the source plan as renamed into
`docs/plans/archive/completed/mobile/`.

- [ ] **Step 3: Move the completed Task 4 detail plan to the archive**

Run:

```bash
git mv docs/plans/mobile/2026-07-01-feed-section-refresh-pagination.md docs/plans/archive/completed/mobile/2026-07-01-feed-section-refresh-pagination.md
```

Expected: `git status --short` shows the detail plan as renamed into
`docs/plans/archive/completed/mobile/`.

### Task 3: Create The Next Product Batch Plan

**Files:**
- Create: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`

- [ ] **Step 1: Create the post composer plan**

Create `docs/plans/mobile/2026-07-01-mobile-post-composer.md` with this
content:

```markdown
# Mobile Post Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in mobile viewers create text-only standard posts and
stories from the home surface using the existing Relay `createPost` mutation.

**Architecture:** Add a feed-local composer route and screen that owns draft
state, validation, mutation submission, and viewer-safe errors. Keep the first
batch text-only so it can land against `createPost(input:)` without introducing
native media picking or signed upload handling. Preserve Relay IDs as opaque
strings and refresh the home feed after successful creation.

**Tech Stack:** Expo Router, React Native, Relay mutations, feed-local pure
reducers, Bun tests, Relay compiler.

---

## Executor Brief

Backend contract already exists in `mobile/schema.graphql`:
`createPost(input: {kind, bodyText, visibility, mediaAssetIds})`. Backend tests
cover standard posts, stories, unauthenticated errors, and media attachment
paths in `test/live_canvas_gql/content/content_mutations_test.exs`.

This batch implements only text post creation in mobile. Media upload via
`requestMediaUpload` is a follow-up after the text create path is tested.

## Tasks

### Task 1: Add composer state helpers

**Files:**
- Create: `mobile/src/feed/postComposerState.ts`
- Test: `mobile/tests/feed/postComposerState.test.ts`

Acceptance criteria:
- [ ] Empty drafts cannot submit.
- [ ] Standard and story post kinds map to schema enum values `STANDARD` and
      `STORY`.
- [ ] Visibility defaults to `PUBLIC` unless the existing schema or product
      direction says otherwise before implementation.
- [ ] Payload errors such as `unauthenticated` render viewer-safe copy.

Focused verification:
- From `mobile/`: `bun test tests/feed/postComposerState.test.ts`

### Task 2: Add composer route and screen

**Files:**
- Create: `mobile/app/(app)/compose.tsx`
- Create: `mobile/src/feed/PostComposerScreen.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test: `mobile/tests/feed/PostComposerScreen.test.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [ ] `/home` exposes a create-post action that navigates to `/compose`.
- [ ] `/compose` renders body text input, standard/story kind selection, submit,
      and cancel/back affordances.
- [ ] The screen uses existing `AppHeader`, `AppCard`, `AppButton`, and
      `ScreenState` primitives before adding new UI primitives.

Focused verification:
- From `mobile/`:
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`

### Task 3: Wire Relay `createPost`

**Files:**
- Create: `mobile/src/feed/postComposerOperations.ts`
- Modify: `mobile/src/feed/PostComposerScreen.tsx`
- Modify after Relay codegen:
  `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`
- Test: `mobile/tests/feed/PostComposerScreen.test.tsx`

Acceptance criteria:
- [ ] Submit calls `createPost(input: {kind, bodyText, visibility})`.
- [ ] Duplicate taps cannot start duplicate create mutations.
- [ ] Successful creation shows confirmation and returns the viewer to `/home`
      or refreshes the feed in a tested way.
- [ ] Payload errors remain retryable without losing the draft body.

Focused verification:
- From `mobile/`: `bun test tests/feed/PostComposerScreen.test.tsx`
- From `mobile/`: `bun run relay`

### Task 4: Final verification and lane evidence

**Files:**
- Modify: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Modify if pointer state changes: `docs/plans/mobile/NOW.md`

Acceptance criteria:
- [ ] Focused composer and feed tests pass.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test:quality` passes, or any unrelated pre-existing failure is
      recorded with exact failing test names and no success claim.
- [ ] Backend remains unchanged unless a reproduced contract mismatch is
      promoted into `docs/plans/backend/NOW.md`.

Final verification:
- From `mobile/`: `bun test tests/feed/postComposerState.test.ts`
- From `mobile/`:
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`
```

### Task 4: Repair Lane, Dashboard, And Registry Pointers

**Files:**
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/INDEX.md`

- [ ] **Step 1: Rewrite `docs/plans/mobile/NOW.md`**

Update the mobile lane NOW file so it says:

- Status: mobile post composer product batch active; release-candidate QA
  deferred.
- Source plan:
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`.
- Latest completed plan:
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`.
- Write scope:
  `mobile/**` and `docs/plans/mobile/**`; backend only through promoted
  cross-lane issues.
- Do This Now: implement Task 1 of the post composer plan.
- Guardrails: keep release-candidate manual QA deferred, keep media upload out
  of the first composer task, do not change backend schema unless the active
  mobile work proves a mismatch and promotes it to backend NOW.

- [ ] **Step 2: Update `docs/plans/mobile/TRACK.md`**

Make these concrete changes:

- Set track state/current theme to mobile post composer over `createPost`.
- Add
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`
  to Completed Detailed Plans.
- Add
  `docs/plans/archive/completed/mobile/2026-07-01-feed-section-refresh-pagination.md`
  only as supporting completed detail evidence if the completed-plan list is
  already tracking task-level plans; otherwise keep it referenced from the
  archived feed source plan.
- Change Recommended Plan Order item 17 to completed feed/content discovery and
  insert mobile post composer before release-candidate manual QA.
- Change Active And Queued Follow-Up Plans so the active product batch is
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`; keep the release
  candidate checklist under the deferred QA gate.

- [ ] **Step 3: Update `docs/plans/NOW.md`**

Make these concrete changes:

- Set mobile lane state to active mobile post composer batch.
- Change current source plan to
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`.
- Change latest completed mobile source plan to the archived feed/content
  discovery plan.
- Keep backend lane issue-driven.
- Keep the cross-lane policy that backend issues may be promoted as needed.
- Keep release-candidate manual QA deferred.
- Update Next Coordinator Decision to execute from `docs/plans/mobile/NOW.md`
  for the post composer batch before any release-candidate QA resumes.

- [ ] **Step 4: Update `docs/plans/INDEX.md`**

Make these concrete changes:

- Set Mobile Lane current product theme to mobile post composer.
- Set Active detailed plan to
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`.
- Mention feed/content discovery as complete and archived.
- Set the Mobile Expo Frontend Planning Track active detailed plan to the post
  composer plan.
- Add the archived feed/content plan to Completed Work or the mobile completed
  track list, matching the surrounding registry style.

### Task 5: Verify, Commit, Push, And Archive This Close-Out Plan

**Files:**
- Move after all other steps pass:
  `docs/plans/mobile/2026-07-01-feed-content-discovery-lane-closeout.md`

- [ ] **Step 1: Run final mobile feed gates before claiming close-out**

Run from `mobile/`:

```bash
bun test tests/feed/feedPresentation.test.ts tests/feed/reportPostReducer.test.ts tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx
```

Expected: all feed tests pass.

Run from `mobile/`:

```bash
bun run typecheck
```

Expected: typecheck passes.

Run from `mobile/`:

```bash
bun run test:quality
```

Expected: the quality gate passes. If it fails for an unrelated pre-existing
reason, stop and record the exact failure before deciding whether the close-out
can proceed.

- [ ] **Step 2: Verify docs formatting and active pointers**

Run from repo root:

```bash
git diff --check
```

Expected: no whitespace errors.

Run from repo root:

```bash
rg -n "2026-06-30-mobile-feed-content-discovery|2026-07-01-feed-section-refresh-pagination|2026-07-01-mobile-post-composer" docs/plans/NOW.md docs/plans/INDEX.md docs/plans/mobile/NOW.md docs/plans/mobile/TRACK.md
```

Expected: active pointers reference the post composer plan; completed feed plans
reference archive paths.

- [ ] **Step 3: Archive this close-out plan**

Run:

```bash
git mv docs/plans/mobile/2026-07-01-feed-content-discovery-lane-closeout.md docs/plans/archive/completed/mobile/2026-07-01-feed-content-discovery-lane-closeout.md
```

Expected: this plan is no longer in the active mobile plans folder after its
execution is complete.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add docs/plans
git commit -m "Close mobile feed discovery lane"
git push
```

Expected: the existing PR branch is updated with the lane close-out docs and
next mobile product batch plan.

## Self-Review Checklist

- [ ] No active pointer references the archived feed/content source plan as the
      current batch.
- [ ] No current mobile lane file points at Task 4 after close-out.
- [ ] Release-candidate manual QA is still deferred.
- [ ] Backend lane is still issue-driven unless a concrete backend failure was
      promoted.
- [ ] The next mobile product batch is executable from
      `docs/plans/mobile/NOW.md`.

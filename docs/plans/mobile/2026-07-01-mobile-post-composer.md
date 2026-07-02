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
- [x] Empty drafts cannot submit.
- [x] Standard and story post kinds map to schema enum values `STANDARD` and
      `STORY`.
- [x] Visibility defaults to `FOLLOWERS`, matching the current backend resolver
      and post schema defaults, unless product explicitly changes this before
      implementation.
- [x] Payload errors such as `unauthenticated` render viewer-safe copy.

Focused verification:
- From `mobile/`: `bun test tests/feed/postComposerState.test.ts`

Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/postComposerState.test.ts` -> 4 pass, 0 fail,
  22 expect() calls.

### Task 2: Add composer route and screen

**Files:**
- Create: `mobile/app/(app)/compose.tsx`
- Create: `mobile/src/feed/PostComposerScreen.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Test: `mobile/tests/feed/PostComposerScreen.test.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Detail plan:
- `docs/plans/mobile/2026-07-01-post-composer-route-screen.md`

Acceptance criteria:
- [x] `/home` exposes a create-post action that navigates to `/compose`.
- [x] `/compose` renders body text input, standard/story kind selection, submit,
      and cancel/back affordances.
- [x] The screen uses existing `AppHeader`, `AppCard`, and `AppButton`
      primitives before adding new UI primitives.

Focused verification:
- From `mobile/`:
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`

Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
  -> 16 pass, 0 fail, 72 expect() calls.

### Task 3: Wire Relay `createPost`

**Files:**
- Create: `mobile/src/feed/postComposerOperations.ts`
- Modify: `mobile/src/feed/PostComposerScreen.tsx`
- Modify after Relay codegen:
  `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`
- Test: `mobile/tests/feed/PostComposerScreen.test.tsx`

Acceptance criteria:
- [x] Submit calls `createPost(input: {kind, bodyText, visibility})`.
- [x] Duplicate taps cannot start duplicate create mutations.
- [x] Successful creation shows confirmation and returns the viewer to `/home`
      or refreshes the feed in a tested way.
- [x] Payload errors remain retryable without losing the draft body.

Focused verification:
- From `mobile/`: `bun test tests/feed/PostComposerScreen.test.tsx`
- From `mobile/`: `bun run relay`

Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/PostComposerScreen.test.tsx` -> 10 pass, 0 fail,
  33 expect() calls.
- 2026-07-01: From `mobile/`, `bun run relay` -> passed; Relay compiler
  completed 20 reader, 20 normalization, and 20 operation text documents.

### Task 4: Final verification and lane evidence

**Files:**
- Modify: `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Modify if pointer state changes: `docs/plans/mobile/NOW.md`

Acceptance criteria:
- [x] Focused composer and feed tests pass.
- [x] `bun run typecheck` passes.
- [x] `bun run test:quality` passes, or any unrelated pre-existing failure is
      recorded with exact failing test names and no success claim.
- [x] Backend remains unchanged unless a reproduced contract mismatch is
      promoted into `docs/plans/backend/NOW.md`.

Final verification:
- From `mobile/`: `bun test tests/feed/postComposerState.test.ts`
- From `mobile/`:
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

Evidence:
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/postComposerState.test.ts` -> 4 pass, 0 fail,
  22 expect() calls.
- 2026-07-01: From `mobile/`,
  `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
  -> 20 pass, 0 fail, 84 expect() calls.
- 2026-07-01: From `mobile/`, `bun run typecheck` -> passed.
- 2026-07-01: From `mobile/`, `bun run test:quality` -> 445 pass,
  0 fail, 1637 expect() calls across 57 files.
- 2026-07-01: From repo root, `git diff --check` -> passed.
- 2026-07-01: No backend code, GraphQL schema, or shared contract changes were
  needed for this mobile batch.

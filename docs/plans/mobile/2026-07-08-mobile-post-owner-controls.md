# Mobile Post Owner Controls Implementation Plan

Date: 2026-07-08
Owner lane: mobile
Status: complete; review hardening verified 2026-07-09

## Executor Brief

Let signed-in viewers edit and delete their own feed posts from the mobile home
feed using the existing Relay `updatePost` and `deletePost` mutations. Determine
ownership only by comparing opaque Relay IDs already present in the feed query:
`viewer.id` and `post.author.id`.

The mobile lane selected and completed this batch. Review hardening serializes
owner-control transitions across every visible post, including stale controls
dispatched before a React rerender.

## Context

- Backend GraphQL tests already cover `updatePost` and `deletePost` ownership
  behavior.
- `mobile/src/feed/feedHomeOperations.ts` already requests viewer ID and post
  author ID for report suppression.
- `FeedHomeScreen` already computes whether a post belongs to the viewer in
  order to hide report actions.
- Do not decode Relay IDs or compare raw database IDs on the client.

## Tasks

### Task 1: Add owner-control state helpers

Files:
- Create: `mobile/src/feed/postOwnerControlsState.ts`
- Test: `mobile/tests/feed/postOwnerControlsState.test.ts`

Acceptance criteria:
- [x] Add `isViewerOwnedPost(viewerId, postAuthorId)` using opaque string
      equality only.
- [x] Add edit-state helpers for body text and visibility.
- [x] Build `updatePost` input with trimmed body text and selected visibility.
- [x] Block empty updates and body text over the current post length limit.
- [x] Map known mutation errors to viewer-safe copy.
- [x] Keep delete confirmation copy in one helper so screen tests do not
      duplicate strings.

Focused verification:
- From `mobile/`: `bun test tests/feed/postOwnerControlsState.test.ts`

### Task 2: Add Relay update and delete operations

Files:
- Modify: `mobile/src/feed/feedHomeOperations.ts`
- Create: `mobile/src/feed/postOwnerControlOperations.ts`
- Modify generated Relay files under `mobile/src/__generated__/**`
- Test if operation text is covered: relevant feed operation tests

Acceptance criteria:
- [x] Add an `updatePost` mutation returning the same post fields consumed by
      the feed row, including media assets if the feed query includes them.
- [x] Add a `deletePost` mutation returning `deletedPostId` and structured
      errors.
- [x] Keep operation fragments compatible with Relay compiler output.

Focused verification:
- From `mobile/`: `bun run relay`

### Task 3: Wire feed owner controls

Files:
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify if needed: `mobile/src/feed/FeedPostCard.tsx`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

Acceptance criteria:
- [x] Viewer-owned posts show edit and delete controls where non-owned posts
      show report controls.
- [x] Edit mode is inline and supports cancel/save without losing the current
      feed row.
- [x] Delete requires confirmation before committing.
- [x] In-flight update and delete actions disable duplicate submits.
- [x] Successful update updates local presentation or refetches in a tested
      way.
- [x] Successful delete removes the row through a local deleted-ID set or a
      Relay updater without mutating retained pagination data unsafely.
- [x] Mutation errors leave the row retryable.

## Evidence

- `bun test tests/feed/postOwnerControlsState.test.ts` -> 5 pass.
- `pnpm exec jest --config ./jest.config.js tests/feed/FeedHomeScreen.rntl.tsx --runInBand` -> 22 pass.
- `bun run relay` -> completed.
- `bun run typecheck` -> passed.
- `bun run typecheck:tests` -> passed.

Note: the component test in this repo is the existing Jest/RNTL
`tests/feed/FeedHomeScreen.rntl.tsx`, not a Bun `FeedHomeScreen.test.tsx` file.

Focused verification:
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`

## Final Verification

- From `mobile/`: `bun test tests/feed/postOwnerControlsState.test.ts`
- From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run typecheck:tests`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

## Handoff

This plan does not add media editing, story expiration changes, draft history,
or undo-after-delete. Those are product decisions that should follow after the
basic owner controls land cleanly.

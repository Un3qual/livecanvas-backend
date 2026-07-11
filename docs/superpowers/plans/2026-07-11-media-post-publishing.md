# Media Post Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated viewer publish a standard post or story with one image or video while preserving the existing text-only path.

**Architecture:** The existing Relay `requestMediaUpload`, viewer-scoped `mediaAsset`, and `createPost(mediaAssetIds:)` contracts remain authoritative. Mobile adds an injected picker/upload boundary, a pure publishing reducer, and a controller that requests a signed upload, uploads exactly the returned headers, polls the opaque media node until attachable, then submits the post.

**Tech Stack:** Elixir, Absinthe Relay, ExUnit, Expo SDK 55, Expo ImagePicker, React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 3.
- Support exactly one selected image or video. Multiple attachments remain deferred.
- Apply early mobile limits of 25 MiB for images and 100 MiB for videos when the picker reports `fileSize`; backend ownership and media-processing checks remain authoritative.
- Keep text-only post and story publishing available and unchanged.
- Treat Relay IDs as opaque; never derive storage keys or owner IDs on mobile.
- The signed HTTP request sends only the method and headers returned by `requestMediaUpload`; it must not attach the viewer bearer token to the storage URL.
- New retry attempts request a fresh signed upload. Never reuse a URL after expiry or an indeterminate upload failure.
- Cancellation aborts selection follow-up, upload, polling, and submission callbacks without mutating an unmounted composer.
- Mobile tests stay under `mobile/tests/**`.
- Backend production code changes only if Task 1 reproduces a contract defect.

---

## Executor Brief

Complete the backend contract proof before adding mobile dependencies. Tasks 2-3
build and test the native boundary plus pure workflow away from the screen. Task
4 integrates the workflow with the existing composer and runs the complete
mobile gate. Commit each completed task with its tests and update this plan's
checkboxes/evidence in the same milestone commit.

## File Structure

- Backend proof: `test/live_canvas_gql/content/content_mutations_test.exs` and `test/live_canvas_gql/content/content_queries_test.exs`.
- Native boundary: `mobile/src/content/mediaPostSelection.ts` owns picker normalization only.
- Pure workflow: `mobile/src/content/mediaPostPublishingState.ts` owns stages, stale-attempt rejection, retry, and cancellation decisions.
- Network boundary: `mobile/src/content/mediaPostUploadClient.ts` owns signed upload and polling helpers.
- Controller: `mobile/src/content/useMediaPostPublishing.ts` coordinates Relay commits, HTTP upload, polling, and cancellation.
- Composer: `mobile/src/feed/PostComposerScreen.tsx`, `mobile/src/content/postComposerState.ts`, and `mobile/src/feed/postComposerOperations.ts` expose the finished workflow.

### Task 1: Prove The Existing Media Ownership And Processing Contract

**Files:**
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify only on reproduced failure: `lib/live_canvas/content.ex`
- Modify only on reproduced failure: `lib/live_canvas_gql/content/content_resolver.ex`

**Interfaces:**
- Consumes: `requestMediaUpload(input: {mimeType})`, `mediaAsset(id:)`, and `createPost(input: {mediaAssetIds})`.
- Produces: a verified contract that only the owner can poll or attach an asset and that attachment requires `processingState: PROCESSED`.

- [ ] Add focused GraphQL tests covering one supported image MIME type, one supported video MIME type, unsupported MIME rejection, anonymous upload rejection, foreign-owner node lookup returning `null`, pending/failed asset attachment rejection, and processed owner asset attachment success.
- [ ] Assert the upload payload includes opaque asset ID, method, URL, exact headers, and expiry without exposing `storage_key`.
- [ ] Run `mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/content/content_queries_test.exs`; expected result is all tests passing without backend production changes.
- [ ] If a focused test fails, repair only the reproduced ownership or processing predicate, add typespecs to changed public functions, and run `mix typecheck`.
- [ ] Run `mix format --check-formatted` on touched backend files and commit with `test: prove media publishing contract`.

### Task 2: Add Native Selection And Pure Publishing State

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Create: `mobile/src/content/mediaPostSelection.ts`
- Create: `mobile/src/content/mediaPostPublishingState.ts`
- Create: `mobile/tests/content/mediaPostSelection.test.ts`
- Create: `mobile/tests/content/mediaPostPublishingState.test.ts`

**Interfaces:**
- Produces: `PickedPostMedia`, `pickPostMedia()`, `MediaPostPublishingState`, `mediaPostPublishingReducer`, and `canAttachSelectedMedia`.
- Consumed by: Tasks 3-4.

- [ ] Install the Expo SDK-compatible `expo-image-picker` package and configure photo-library permission copy; do not request camera permission from the post composer.
- [ ] Define `PickedPostMedia` as `{uri, mimeType, fileName, fileSize, mediaKind: 'image' | 'video'}` and normalize cancelled picker results to `null`.
- [ ] Reject selections without a supported `image/*` or `video/*` MIME type, images above 25 MiB, and videos above 100 MiB when `fileSize` is available; return viewer-safe messages rather than raw picker errors.
- [ ] Implement reducer stages exactly as `idle`, `selecting`, `selected`, `requesting`, `uploading`, `processing`, `ready`, `submitting`, `succeeded`, `failed`, and `cancelled`.
- [ ] Give every asynchronous attempt a monotonically increasing `attemptId`; reducer completions with an older ID must return the identical state object.
- [ ] Cover picker cancellation, invalid type/size, each legal transition, duplicate transition rejection, stale completions, retry reset, and cancellation in focused Bun tests.
- [ ] Run `cd mobile && bun test tests/content/mediaPostSelection.test.ts tests/content/mediaPostPublishingState.test.ts`, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: add media publishing workflow state`.

### Task 3: Implement Signed Upload, Polling, And Cancellation

**Files:**
- Modify: `mobile/src/feed/postComposerOperations.ts`
- Create: `mobile/src/content/mediaPostUploadClient.ts`
- Create: `mobile/src/content/useMediaPostPublishing.ts`
- Create: `mobile/tests/content/mediaPostUploadClient.test.ts`
- Create: `mobile/tests/content/useMediaPostPublishing.rntl.tsx`
- Generate: `mobile/src/__generated__/postComposerOperationsRequestMediaUploadMutation.graphql.ts`
- Generate: `mobile/src/__generated__/postComposerOperationsMediaAssetQuery.graphql.ts`
- Regenerate: `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`

**Interfaces:**
- Produces: `uploadSignedMedia({selection, signedUpload, signal})`, `pollMediaAssetUntilTerminal({assetId, signal, fetchAsset, delay})`, and `useMediaPostPublishing()`.
- `useMediaPostPublishing()` returns `{state, selectMedia, removeMedia, retryMedia, cancel, submit}` and accepts injected picker, upload, delay, and Relay commit functions in tests.

- [ ] Add Relay operations for `requestMediaUpload`, viewer-scoped `mediaAsset(id:)`, and `createPost` with `mediaAssetIds: [state.mediaAssetId]` only in the `ready` stage.
- [ ] Implement signed upload using the returned `PUT` or `POST`, exact returned headers, selected binary body, and an `AbortSignal`; treat non-2xx responses as retryable upload failures and never add app authorization headers.
- [ ] Poll every second for at most 60 attempts. Resolve only on `PROCESSED`, fail terminally on `FAILED` or a missing owner-scoped node, and return a retryable timeout after the final pending response.
- [ ] Abort the current controller on remove, retry, auth loss, unmount, or explicit cancel. Retry must discard the prior asset/URL and begin with a new `requestMediaUpload` mutation.
- [ ] Preserve a processed asset when `createPost` returns payload errors so the viewer can retry submission during the same mounted composer session.
- [ ] Test signed-header fidelity, absence of bearer authorization, non-2xx upload, expired-URL retry, processing success/failure/timeout, auth loss, unmount, and duplicate submit guards.
- [ ] Run `cd mobile && bun run relay`, the two focused tests, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: upload and process post media`.

### Task 4: Integrate Media Publishing Into The Composer

**Files:**
- Modify: `mobile/src/feed/PostComposerScreen.tsx`
- Modify: `mobile/src/content/postComposerState.ts`
- Modify: `mobile/tests/feed/PostComposerScreen.rntl.tsx`
- Modify: `mobile/tests/content/postComposerState.test.ts`

**Interfaces:**
- Consumes: Task 3's controller and existing `buildCreatePostInput`.
- Produces: a tested composer supporting text-only, image, and video publishing.

- [ ] Add Select media, Replace, Remove, Cancel upload, and Retry actions with a single selected-media preview summary and explicit requesting/uploading/processing/ready/failure copy.
- [ ] Permit submission when body text is valid, preserving existing text-only behavior; include the ready asset ID only when media exists.
- [ ] Disable kind/audience/body changes and duplicate submits only while the active stage requires it; picker cancellation must return to the unchanged composer.
- [ ] Verify failed post creation keeps the ready asset, successful creation resets all text/media state, and navigation still replaces the route with `/home` exactly once.
- [ ] Add RNTL coverage for successful image and video publishing, selection cancellation, upload retry, processing failure, auth loss, duplicate taps, remove/replace, and unchanged text-only submission.
- [ ] Run `cd mobile && bun test tests/content/mediaPostSelection.test.ts tests/content/mediaPostPublishingState.test.ts tests/content/mediaPostUploadClient.test.ts tests/content/useMediaPostPublishing.rntl.tsx tests/content/postComposerState.test.ts tests/feed/PostComposerScreen.rntl.tsx`.
- [ ] Run `cd mobile && bun run test:quality`, then `git diff --check`; commit with `feat: publish posts with media`.

## Completion And Handoff

- Close this batch only after backend contract tests and the full mobile quality gate pass.
- Update the lane pointers in the same milestone that closes Batch 3 and promote `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md` as Batch 4.
- Do not start Batch 4 in the same implementation commit.

# Media Post Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated viewer publish a standard post or story with one image or video while preserving the existing text-only path.

**Architecture:** The existing Relay `requestMediaUpload`, viewer-scoped `mediaAsset`, and `createPost(mediaAssetIds:)` contracts remain authoritative, with one missing lifecycle step made explicit: the public `LC.Content.finalize_media_upload/3` domain boundary verifies the object exists in server-owned storage before a row-locked transaction may move it from `PENDING_UPLOAD` to `UPLOADED` and insert a deduplicated job into the existing database-backed async queue. Upload requests are conditional write-once, so the verified key cannot be overwritten while its URL remains valid, and queued or webhook-driven processing accepts only finalized `UPLOADED` assets. The authenticated `finalizeMediaUpload` mutation decodes the opaque ID and delegates to that boundary. Mobile adds an injected picker/upload boundary, a pure publishing reducer, and a controller that requests a signed upload, uploads exactly the returned headers, finalizes the upload, polls the opaque media node to `PROCESSED`, then submits the post.

**Tech Stack:** Elixir, Absinthe Relay, ExUnit, Expo SDK 55, Expo ImagePicker, React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`, Batch 3.
- Support exactly one selected image or video. Multiple attachments remain deferred.
- Use one exact client/server MIME allowlist: `image/jpeg`, `image/png`, `image/webp`, and `video/mp4`. Wildcard `image/*` or `video/*` acceptance is forbidden.
- Apply early mobile limits of 25 MiB for images and 100 MiB for videos when the picker reports `fileSize`; backend ownership and media-processing checks remain authoritative.
- Keep text-only post and story publishing available and unchanged.
- Treat Relay IDs as opaque; never derive storage keys or owner IDs on mobile.
- A post may attach only an owner-scoped asset in `PROCESSED`; `PENDING_UPLOAD`, `UPLOADED`, and `FAILED` are never attachable.
- The signed HTTP request sends only the method and headers returned by `requestMediaUpload`; it must not attach the viewer bearer token to the storage URL.
- A successful client upload does not prove persistence. Every public/internal caller must pass through the storage-verifying `LC.Content.finalize_media_upload/3` boundary; the unverified database transition remains private.
- Every signed upload must enforce a write-once conditional request for its unique key. A second write to the same key must fail even while the original URL is unexpired, closing the finalize-to-worker overwrite window.
- Queued and webhook-driven processing must reject `PENDING_UPLOAD`; only a finalized `UPLOADED` asset may advance to `PROCESSED` or `FAILED`.
- Before a confirmed 2xx storage response, retry with a fresh asset and signed URL after expiry or an indeterminate upload failure. After a confirmed 2xx response, retain that asset and retry idempotent finalization; never create a replacement while finalization or processing may already have succeeded.
- Cancellation aborts selection follow-up, upload, polling, and submission callbacks without mutating an unmounted composer.
- Mobile tests stay under `mobile/tests/**`.

---

## Executor Brief

Complete the missing backend lifecycle contract before adding mobile dependencies. Tasks 2-3
build and test the native boundary plus pure workflow away from the screen. Task
4 integrates the workflow with the existing composer and runs the complete
mobile gate. Commit each completed task with its tests and update this plan's
checkboxes/evidence in the same milestone commit.

## File Structure

- Backend lifecycle: object-storage verification, Relay finalization, processed-only attachment, and schema privacy tests.
- Native boundary: `mobile/src/content/mediaPostSelection.ts` owns picker normalization only.
- Pure workflow: `mobile/src/content/mediaPostPublishingState.ts` owns stages, stale-attempt rejection, retry, and cancellation decisions.
- Network boundary: `mobile/src/content/mediaPostUploadClient.ts` owns signed upload and polling helpers.
- Controller: `mobile/src/content/useMediaPostPublishing.ts` coordinates Relay commits, HTTP upload, polling, and cancellation.
- Composer: `mobile/src/feed/PostComposerScreen.tsx`, `mobile/src/content/postComposerState.ts`, and `mobile/src/feed/postComposerOperations.ts` expose the finished workflow.

### Task 1: Complete And Prove The Media Upload Lifecycle Contract

**Files:**
- Modify: `config/config.exs`
- Modify: `config/runtime.exs`
- Modify: `config/test.exs`
- Modify: `lib/live_canvas/infra/object_storage.ex`
- Modify: `lib/live_canvas/infra/object_storage/configurable_adapter.ex`
- Modify: `lib/live_canvas/infra/object_storage/fake_adapter.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `lib/live_canvas/content/media_asset.ex`
- Modify: `lib/live_canvas/content/media_processing_job.ex`
- Modify: `lib/live_canvas_gql/content/content_mutations.ex`
- Modify: `lib/live_canvas_gql/content/content_resolver.ex`
- Modify: `lib/live_canvas_gql/content/content_types.ex`
- Modify: `test/live_canvas/infra/object_storage/configurable_adapter_test.exs`
- Modify: `test/live_canvas/infra/object_storage/fake_adapter_test.exs`
- Modify: `test/live_canvas/content_test.exs`
- Modify: `test/live_canvas_gql/content/content_mutations_test.exs`
- Modify: `test/live_canvas_gql/content/content_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify: `test/integration/media_webhook_async_flow_test.exs`
- Modify: `mobile/schema.graphql`

**Interfaces:**
- Consumes: the existing `requestMediaUpload(input: {mimeType})`, viewer-scoped `mediaAsset(id:)`, and `createPost(input: {mediaAssetIds})` contracts.
- Produces: `ObjectStorage.verify_upload/1`, storage-verifying `Content.finalize_media_upload/3`, and authenticated Relay `finalizeMediaUpload(input: {mediaAssetId})`, plus a verified processed-only attachment contract.

- [ ] Extend the object-storage behaviour with `verify_upload(%{key, mime_type})`. Give the configurable adapter a dedicated server-side verification origin, separate from the browser upload URL and public CDN origin; perform a production `Req.head` or `Req.request` against that verification URL, and accept only a 2xx response with a matching normalized content type. Use `Req.Test` only through test configuration/options. Never reuse a client upload signature for verification; support a server-only authorization header when the verification service requires it. Keep the fake adapter deterministic for tests.
- [ ] Make every signed upload conditional write-once for its unique storage key. Include the storage service's exact create-only precondition (for example, a signed `If-None-Match: *` header when supported) in the returned headers and require the upload origin to reject later writes to that key with a non-2xx response, including while the URL remains unexpired. Cover first-write success and same-key overwrite rejection in configurable and fake adapter tests.
- [ ] Move verification into the public `Content.finalize_media_upload/3` domain function: owner-scope the asset and verify its persisted storage key and MIME type through `ObjectStorage`, then enter one `Repo.transact`, lock the asset `FOR UPDATE`, re-check `PENDING_UPLOAD`, update it to `UPLOADED`, and call the existing database-backed `AsyncJobs.enqueue/3` with stable dedupe key `media_asset_processing:<asset-id>`. The state transition and durable job row must commit or roll back together; concurrent/repeated finalization of `UPLOADED` returns the existing deduplicated job without inserting another. No public helper may expose the unverified transition.
- [ ] Add `finalizeMediaUpload` as a Relay payload mutation. Decode the opaque media ID and delegate directly to the verified domain finalizer; do not duplicate or weaken storage verification in the resolver.
- [ ] Keep verification not-found, content-type mismatch, timeout, and storage-unavailable results retryable without changing the database state. Make repeated successful finalization idempotent and never permit a foreign owner to distinguish missing from inaccessible assets.
- [ ] Enforce the shared four-type MIME allowlist in the upload-request changeset before signing storage access. Test all four accepted values plus representative rejected image, video, and non-media values such as GIF, QuickTime, and octet-stream; adapt the existing unsupported-processing fixture so it does not rely on requesting a now-invalid upload.
- [ ] Tighten `create_post` attachment to accept only owner-scoped `PROCESSED` assets; update existing tests that currently treat `UPLOADED` as attachable.
- [ ] Gate `MediaProcessingJob` state transitions from both queue payloads and signed webhook payloads. Processing may advance only an `UPLOADED` asset; a callback for `PENDING_UPLOAD` must be dropped without changing the asset, and already terminal states remain idempotent. Keep this production path in Task 1's write scope.
- [ ] Remove both `storageKey` and raw `ownerId` from the GraphQL `MediaAsset` node itself, not merely from mobile selections. Add schema validation proving both fields are unqueryable while the opaque asset ID, MIME type, processing state, and public URL remain available as authorized.
- [ ] Add focused GraphQL tests covering all four supported MIME types, representative unsupported MIME rejection, anonymous upload/finalization rejection, foreign-owner lookup/finalization returning the same missing result, pending/uploaded/failed attachment rejection, and processed owner attachment success.
- [ ] Add direct domain and integration contract tests for request upload -> storage-verified finalization -> queued worker -> `PROCESSED` -> post attachment. Exercise the public finalizer rather than a resolver-only wrapper, and add verification-failure and forced-enqueue-failure cases proving no caller can trigger or strand a premature transition. Prove concurrent/repeated finalization yields one job, the conditional upload rejects a post-finalize overwrite, and a validly signed webhook cannot move an unfinalized asset to `PROCESSED` or `FAILED`.
- [ ] Export the changed backend schema with `mix absinthe.schema.sdl --schema LCGQL.Schema mobile/schema.graphql`, then prove the snapshot contains `finalizeMediaUpload` and omits `MediaAsset.storageKey` and `MediaAsset.ownerId` before mobile Relay generation.
- [ ] Run the focused object-storage, content, GraphQL, Relay schema, and media integration tests; run `mix typecheck` and focused formatting; commit with `feat: complete media upload lifecycle`.

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
- [ ] Accept only the shared four-type MIME allowlist; reject GIF, HEIC, QuickTime, arbitrary wildcard-matching image/video values, and non-media values. Enforce 25 MiB for allowed images and 100 MiB for MP4 when `fileSize` is available, returning viewer-safe messages rather than raw picker errors.
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
- Generate: `mobile/src/__generated__/postComposerOperationsFinalizeMediaUploadMutation.graphql.ts`
- Generate: `mobile/src/__generated__/postComposerOperationsMediaAssetQuery.graphql.ts`
- Regenerate: `mobile/src/__generated__/postComposerOperationsCreatePostMutation.graphql.ts`

**Interfaces:**
- Produces: `uploadSignedMedia({selection, signedUpload, signal})`, `pollMediaAssetUntilTerminal({assetId, signal, fetchAsset, delay})`, and `useMediaPostPublishing()`.
- `useMediaPostPublishing()` returns `{state, selectMedia, removeMedia, retryMedia, cancel, submit}` and accepts injected picker, upload, delay, and Relay commit functions in tests.

- [ ] Add Relay operations for `requestMediaUpload`, `finalizeMediaUpload`, viewer-scoped `mediaAsset(id:)`, and `createPost` with `mediaAssetIds: [state.mediaAssetId]` only in the `ready` stage.
- [ ] Implement signed upload using the returned `PUT` or `POST`, exact returned headers, selected binary as the raw request body, and an `AbortSignal`; never construct multipart/form-data or add form fields under this contract. An adapter that requires browser multipart POST must expose a different explicit contract rather than returning `POST` here. Treat non-2xx responses as retryable upload failures and never add app authorization headers.
- [ ] After a 2xx storage response, retain the asset ID and commit idempotent `finalizeMediaUpload` for the active attempt. On a timeout, transport loss, storage verification unavailable/not-yet-visible, or other ambiguous response, do not request a replacement upload: query the same owner-scoped asset, continue polling if it is `UPLOADED`/`PROCESSED`, retry finalization on the same asset if it remains `PENDING_UPLOAD`, and stop terminally on `FAILED` or a missing node.
- [ ] Poll every second for at most 60 attempts. Resolve only on `PROCESSED`, fail terminally on `FAILED` or a missing owner-scoped node, and return a retryable timeout after the final pending response.
- [ ] Abort the current controller on remove, auth loss, unmount, or explicit cancel. Retry before a confirmed storage 2xx discards the prior asset/URL and starts a new `requestMediaUpload`; retry after a confirmed 2xx keeps the same asset and resumes finalization/readback so a later-processed asset cannot be abandoned behind a replacement.
- [ ] Preserve a processed asset when `createPost` returns payload errors so the viewer can retry submission during the same mounted composer session.
- [ ] Test signed-header fidelity, raw-body PUT and POST behavior, absence of bearer authorization, non-2xx upload, expired-URL replacement before 2xx, lost/ambiguous finalization responses that reuse the same asset, pending finalization retry, already-uploaded/processed readback, processing failure/timeout, auth loss, unmount, and duplicate submit guards.
- [ ] Run `cd mobile && bun run relay`, `bun test tests/content/mediaPostUploadClient.test.ts`, `bun run test:jest -- --runTestsByPath tests/content/useMediaPostPublishing.rntl.tsx`, `bun run typecheck`, and `bun run typecheck:tests`; commit with `feat: upload and process post media`.

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
- [ ] Permit submission when either nonblank body text is valid or one media asset is in the `ready` stage. Preserve the existing text-only rules when no media is ready; for a media-only post/story, omit blank `bodyText` from the mutation input and include only the ready asset ID. Reject an empty body when media is absent or not yet ready.
- [ ] Disable kind/audience/body changes and duplicate submits only while the active stage requires it; picker cancellation must return to the unchanged composer.
- [ ] Verify failed post creation keeps the ready asset, successful creation resets all text/media state, and navigation still replaces the route with `/home` exactly once.
- [ ] Add state and RNTL coverage for successful media-only image and video publishing, mixed text/media publishing, empty-without-ready-media rejection, selection cancellation, upload retry, processing failure, auth loss, duplicate taps, remove/replace, and unchanged text-only submission.
- [ ] Run the pure suites with `cd mobile && bun test tests/content/mediaPostSelection.test.ts tests/content/mediaPostPublishingState.test.ts tests/content/mediaPostUploadClient.test.ts tests/content/postComposerState.test.ts`.
- [ ] Run the RNTL suites through their configured Jest runner with `cd mobile && bun run test:jest -- --runTestsByPath tests/content/useMediaPostPublishing.rntl.tsx tests/feed/PostComposerScreen.rntl.tsx`; do not pass `.rntl.tsx` files to Bun test filters.
- [ ] Run `cd mobile && bun run test:quality`, then `git diff --check`; commit with `feat: publish posts with media`.

## Completion And Handoff

- Close this batch only after backend contract tests and the full mobile quality gate pass.
- After implementation closes, hand back to the coordinator; the coordinator owns the explicitly assigned shared lane-pointer update that closes Batch 3 and promotes `docs/superpowers/plans/2026-07-11-live-chat-message-controls.md` as Batch 4.
- Do not start Batch 4 in the same implementation commit.

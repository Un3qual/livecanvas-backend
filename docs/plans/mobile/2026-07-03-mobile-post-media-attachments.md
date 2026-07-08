# Mobile Post Media Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in mobile viewers attach one picked image or video to a
standard post or story from `/compose` using the existing backend upload and
`createPost` contracts.

**Architecture:** Extend the feed-local composer with a single-attachment state
helper, native picker boundary, signed upload helper, and Relay
`requestMediaUpload` operation. Keep upload intent, file upload, and
`createPost(mediaAssetIds:)` sequencing in `PostComposerScreen` while pure
state transitions stay testable under `mobile/tests/feed/**`. Use the existing
backend GraphQL shape first and promote backend work only if Relay compilation
or focused verification proves a mismatch.

**Tech Stack:** Expo Router, React Native, Relay mutations, `expo-image-picker`,
`expo-file-system`, `expo/fetch`, Bun tests, pnpm dependency management.

---

## Executor Brief

Start from `docs/plans/mobile/NOW.md`. This batch was selected by
`docs/plans/2026-07-06-cross-lane-product-gap-audit.md` after the completed
text-only mobile post composer.

Backend contract evidence:

- `requestMediaUpload(input: {mimeType})` returns `mediaAsset`,
  `signedUpload`, and payload `errors`.
- `createPost(input:)` already accepts `mediaAssetIds`.
- Backend tests cover authenticated upload intents and story creation with
  viewer-owned media attachments in
  `test/live_canvas_gql/content/content_mutations_test.exs`.
- Feed cards already query and render post `mediaAssets` status rows.

Official Expo references checked during planning:

- Image Picker installation, config plugin, and
  `launchImageLibraryAsync({mediaTypes: ['images', 'videos']})`:
  https://docs.expo.dev/versions/latest/sdk/imagepicker/
- FileSystem current upload guidance: use `File` from `expo-file-system` with
  `fetch` from `expo/fetch`; legacy `FileSystem.uploadAsync` is deprecated:
  https://docs.expo.dev/versions/latest/sdk/filesystem/

## Out Of Scope

- Backend Elixir, GraphQL schema, or shared contract changes unless a focused
  mismatch is reproduced and promoted into `docs/plans/backend/NOW.md`.
- Multiple attachments, camera capture, cropping, filters, gallery management,
  and rich image/video feed previews beyond the existing media status rows.
- Post edit/delete owner controls.
- Release-candidate manual device QA or remote/authenticated EAS commands.

## Task 1: Add Composer Attachment State

**Files:**
- Create: `mobile/src/feed/postComposerAttachmentState.ts`
- Modify: `mobile/src/feed/postComposerState.ts`
- Test: `mobile/tests/feed/postComposerAttachmentState.test.ts`
- Test: `mobile/tests/feed/postComposerState.test.ts`

Acceptance criteria:

- [ ] Attachment state supports exactly one pending picked asset with local
      `uri`, `mimeType`, optional `fileName`, upload status, viewer-safe error
      copy, and optional Relay `mediaAssetId`.
- [ ] `buildCreatePostInput` includes `mediaAssetIds: [id]` only after the
      attachment reaches the ready state.
- [ ] Composer submission remains blocked while attachment upload is active or
      failed, and removing the attachment restores text-only submission.
- [ ] Text-only composer behavior and existing validation remain unchanged.

Implementation notes:

- Use explicit status strings:
  `empty`, `picked`, `requestingUpload`, `uploading`, `ready`, `failed`.
- Keep Relay IDs opaque. Store the backend-provided media asset ID as a string
  and pass it through to `createPost`.
- Add error copy for permission denied, picker unavailable, upload intent
  payload errors, upload HTTP failure, and upload network failure.

Focused verification:

- From `mobile/`:
  `bun test tests/feed/postComposerAttachmentState.test.ts tests/feed/postComposerState.test.ts`
- From repo root: `git diff --check`

Milestone commit:

- Commit state helpers and tests before wiring native picker or Relay upload.

## Task 2: Add Native Picker And Signed Upload Boundary

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Modify: `mobile/src/feed/postComposerOperations.ts`
- Modify after Relay codegen:
  `mobile/src/__generated__/postComposerOperationsRequestMediaUploadMutation.graphql.ts`
- Create: `mobile/src/feed/postComposerMediaPicker.ts`
- Create: `mobile/src/feed/postComposerMediaUpload.ts`
- Test: `mobile/tests/feed/postComposerMediaPicker.test.ts`
- Test: `mobile/tests/feed/postComposerMediaUpload.test.ts`

Acceptance criteria:

- [ ] `pnpm exec expo install expo-image-picker expo-file-system` updates the
      package and lockfile through the Expo SDK-compatible path.
- [ ] `mobile/app.json` configures the `expo-image-picker` plugin with a
      product-specific `photosPermission`, while preserving existing camera,
      microphone, router, Apple auth, and WebRTC config.
- [ ] The picker adapter requests media-library permission before opening the
      library and launches a single-select image/video picker.
- [ ] The upload helper receives a local picked asset plus backend
      `signedUpload`, uploads binary content with signed method and headers,
      and treats only 2xx responses as success.
- [ ] The helper uses `File` from `expo-file-system` plus `fetch` from
      `expo/fetch`; it does not use deprecated `FileSystem.uploadAsync`.
- [ ] Tests cover canceled picker results, missing assets, unsupported MIME
      values, signed header normalization, non-2xx upload responses, and
      network failures.

Implementation notes:

- Add this plugin entry without removing existing plugins:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "LiveCanvas uses your library so you can attach photos and videos to posts."
  }
]
```

- Add a Relay operation beside the existing create mutation:

```graphql
mutation postComposerOperationsRequestMediaUploadMutation(
  $input: RequestMediaUploadInput!
) {
  requestMediaUpload(input: $input) {
    mediaAsset {
      id
      mimeType
      processingState
    }
    signedUpload {
      method
      url
      expiresAt
      headers {
        name
        value
      }
    }
    errors {
      field
      message
    }
  }
}
```

Focused verification:

- From `mobile/`: `pnpm exec expo install expo-image-picker expo-file-system`
- From `mobile/`: `bun run relay`
- From `mobile/`:
  `bun test tests/feed/postComposerMediaPicker.test.ts tests/feed/postComposerMediaUpload.test.ts`
- From repo root: `git diff --check`

Milestone commit:

- Commit native dependency/config, operations, upload boundary, and focused
  tests together.

## Task 3: Wire Attachments Into `/compose`

**Files:**
- Modify: `mobile/src/feed/PostComposerScreen.tsx`
- Modify: `mobile/src/feed/postComposerState.ts`
- Modify: `mobile/src/feed/postComposerOperations.ts`
- Test: `mobile/tests/feed/PostComposerScreen.test.tsx`

Acceptance criteria:

- [ ] `/compose` exposes an attachment action with retryable viewer-safe copy
      for picker permission, upload intent, signed upload, and create errors.
- [ ] Picking an image or video requests an upload intent, uploads the file, and
      records the returned media asset ID before enabling submit.
- [ ] Submitting with a ready attachment calls `createPost` with
      `mediaAssetIds: [mediaAssetId]`; text-only posts still omit the field.
- [ ] Duplicate taps cannot start duplicate picker, upload, or create
      operations before React rerenders.
- [ ] Removing an attachment cancels further local state use for that
      attachment and restores text-only draft behavior.
- [ ] Successful media-backed creation returns to `/home` through the existing
      success path.

Implementation notes:

- Keep first-batch UI text simple: `Attach media`, `Remove media`, `Uploading
  media...`, `Media ready.`, and a filename or media-type fallback.
- Do not render picked image/video previews in this batch; feed status rows
  already handle post media states.
- Keep the existing body/kind/audience controls and accessibility assertions.

Focused verification:

- From `mobile/`: `bun test tests/feed/PostComposerScreen.test.tsx`
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

Milestone commit:

- Commit the composer integration and focused screen tests together.

## Task 4: Final Verification And Lane Evidence

**Files:**
- Modify: `docs/plans/mobile/2026-07-03-mobile-post-media-attachments.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify if lane status changes: `docs/plans/NOW.md`
- Modify if registry state changes: `docs/plans/INDEX.md`

Acceptance criteria:

- [ ] Source-plan tasks are checked off with concise command evidence.
- [ ] Mobile generated Relay artifacts are current after operation changes.
- [ ] Final mobile typecheck and quality gates pass, or unrelated pre-existing
      failures are recorded without claiming success.
- [ ] Backend lane remains issue-driven unless a concrete mismatch was promoted
      with focused failing evidence.
- [ ] Release-candidate manual QA remains deferred.

Final verification:

- From `mobile/`:
  `bun test tests/feed/postComposerAttachmentState.test.ts tests/feed/postComposerState.test.ts`
- From `mobile/`:
  `bun test tests/feed/postComposerMediaPicker.test.ts tests/feed/postComposerMediaUpload.test.ts`
- From `mobile/`: `bun test tests/feed/PostComposerScreen.test.tsx`
- From `mobile/`: `bun run relay`
- From `mobile/`: `bun run typecheck`
- From `mobile/`: `bun run test:quality`
- From repo root: `git diff --check`

Milestone commit:

- Commit final lane evidence and pointer updates after verification passes.

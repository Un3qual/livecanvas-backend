# Cross-Lane Product Gap Audit

Reviewed: 2026-07-03

## Executor Brief

The mobile post composer is complete for text-only standard posts and stories.
No standalone backend batch is selected. This audit selects the next
product-completeness batch using the current mobile surface and the existing
backend GraphQL content contract.

Release-candidate manual QA remains deferred. Backend work should be promoted
only after a focused mobile task proves a contract mismatch or failing backend
verification.

## Shipped Mobile Surfaces

- Auth: sign-in and sign-up routes use the mobile auth provider, token storage,
  authenticated fetch, session bootstrap, viewer bootstrap, and provider hooks.
- Profiles: `/profile` and `/profiles/[id]` cover viewer profile summaries,
  privacy mode updates, pending follow-request accept/decline actions, other
  user relationship state, and follow requests.
- Home feed: `/home` renders viewer current session, stories, home posts,
  live-now rows, replay rows, section pagination, manual refresh, create-post,
  profile, host, and diagnostics actions.
- Live watch: `/live-session` opens the watch screen with viewer join/leave,
  viewer playback preparation, host end controls when applicable, realtime
  status, and unavailable-session handling.
- Chat: the live watch screen includes realtime chat channel lifecycle,
  retained timeline history, older-message loading, send gating, and viewer-safe
  send failure handling.
- Replay: home includes replay discovery, and the watch screen surfaces live
  session recording metadata when a recording media asset exists.
- Reporting: home feed post cards call `reportPost`, preserve duplicate-tap
  guards, and keep confirmation/error state local to the visible post.
- Diagnostics: `/diagnostics` renders the release diagnostics screen and probes.
- Host preflight: `/host-broadcast` protects the route behind auth, renders host
  broadcast preflight, prepares media, handles local media controls, starts live
  sessions, and retains the host publishing session.

## Remaining Product Gaps

### 1. Media Attachments For Created Posts

Evidence:

- Backend content mutations expose `requestMediaUpload(input: {mimeType})`,
  signed upload instructions, and `createPost(input: {mediaAssetIds})`.
- Backend tests cover authenticated media upload requests and story creation
  with viewer-owned media attachments.
- Mobile `postComposerOperationsCreatePostMutation` already accepts generated
  `mediaAssetIds`, and the operation selects returned `mediaAssets`.
- Mobile feed query and presentation already read post `mediaAssets` and render
  media status rows for available, processing, failed, and unavailable assets.
- Mobile package dependencies do not currently include a native picker or file
  upload helper such as `expo-image-picker` or `expo-file-system`.

Impact:

This is the largest remaining product gap in the content loop. The app can now
create text posts and render feed media metadata, but mobile users cannot pick,
upload, attach, or publish media-backed posts through the existing backend
contract.

Recommended next batch:

Build a small media-attachment composer batch that adds a native picker
dependency, requests a viewer-scoped upload intent, uploads the selected media
to the signed URL, attaches the returned media asset ID to `createPost`, and
shows retryable attachment state in `/compose`. Keep backend schema unchanged
unless Relay or a focused backend test proves a mismatch.

### 2. Post Owner Edit And Delete Controls

Evidence:

- Backend content mutations expose `updatePost(input:)` and
  `deletePost(input:)` with viewer-owned authorization and structured payload
  errors.
- Mobile code has no `updatePost` or `deletePost` operation, route, action
  sheet, or feed card owner-controls path.

Impact:

Owner post management is important after content creation, but it is less core
than enabling the primary creation loop to produce media-backed LiveCanvas
content.

Recommended deferral:

Defer until media creation lands, then choose a focused owner-controls batch for
viewer-owned feed cards.

### 3. Rich Media Preview Rendering

Evidence:

- Feed cards read media `publicUrl`, `mimeType`, and `processingState`.
- Current feed rendering presents media as status rows rather than image/video
  preview components.

Impact:

This affects media inspection quality after uploads exist. It is best handled
after media attachment creation, because that batch will provide realistic
mobile-created media states to validate.

Recommended deferral:

Treat as a follow-up to the media attachment batch, unless the selected
attachment implementation can include a small processed-image preview without
expanding scope.

### 4. Full Social Connection Browsing

Evidence:

- Backend/mobile contract documents Relay-first `followers`, `following`, and
  `viewerPendingFollowRequests` connections.
- Mobile profile screens show previews and pending request actions, but not
  dedicated paginated follower/following/request list screens.

Impact:

This is a useful social completeness gap, but the shipped profile surface is
already functional enough for the current app loop.

Recommended deferral:

Keep behind content creation follow-ups.

## Selected Next Batch

Select **mobile media attachments for post creation**.

This beats release-candidate manual QA because the current app still cannot
produce media-backed mobile posts, despite already having backend upload intent
and create-with-media contracts. It also beats owner edit/delete controls
because richer creation is more central to the LiveCanvas product loop than
post management after creation.

Initial batch boundaries:

- Include native media selection, upload intent request, signed upload
  execution, attachment state, create-post `mediaAssetIds`, and focused tests
  under `mobile/tests/**`.
- Use existing backend contracts first:
  `requestMediaUpload`, signed upload fields, and `createPost.mediaAssetIds`.
- Keep feed preview rendering to the existing media status rows unless a tiny
  processed-image preview falls out naturally without changing the batch size.
- Defer owner edit/delete controls, full media gallery previews, multi-select
  polish, release-candidate device QA, and remote/authenticated EAS commands.

## Backend Promotion Decision

No backend issue is promoted by this audit.

The backend content contract already covers the selected batch, and the current
evidence did not reproduce a GraphQL contract, resolver, runtime, data, or
authorization mismatch. If implementation later finds a failing Relay compile,
upload payload mismatch, or backend test failure, promote that exact issue into
`docs/plans/backend/NOW.md` with write scope and verification before editing
backend code.

## Verification

- 2026-07-03: From repo root, `git diff --check` -> passed.

# Live Session Recording Linkage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Link a host-owned recording media asset to a live session when it ends and expose the linked recording through the Relay `LiveSession` surface.

**Architecture:** Reuse the existing `content.media_assets` table as the durable recording resource instead of inventing a second recording model. Add a nullable `recording_media_asset_id` foreign key on `live_sessions`, keep `LC.Live` responsible for validating and persisting the link during the end-session transition, and expose the linked asset additively through the existing `LiveSession` node so clients can fetch replay-safe metadata without a parallel read model.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Execution Summary

- Status: complete
- Track: `docs/plans/live/TRACK.md`
- Current batch: complete
- Depends on: completed media upload/finalize pipeline and existing Relay `live_session` / `media_asset` nodes
- Advance to: `docs/plans/archive/completed/live/2026-03-18-live-replay-feed-surfaces.md` -> `Task 1`

## Candidate Status Verification (2026-03-17)

Verified directly in active code and tests before writing this plan:

1. **Live sessions have no durable recording or replay reference today.**
   - Evidence: `LCSchemas.Live.LiveSession` only stores host/status/visibility/start-end fields and the `live_sessions` migration has no recording foreign key (`lib/live_canvas_schemas/live/live_session.ex`, `priv/repo/migrations/20260303013000_create_live_tables.exs`).
2. **The Live boundary cannot accept or validate recording linkage on session end.**
   - Evidence: `LC.Live.LiveSession.end_changeset/3` only handles `ended_reason`, and `LC.Live.end_live_session_with_transition/2` persists only status/ended metadata (`lib/live_canvas/live/live_session.ex`, `lib/live_canvas/live.ex`).
3. **GraphQL has no recording-aware live-session contract.**
   - Evidence: `endLiveSession` accepts only `liveSessionId`, and the `LiveSession` node exposes no recording or replay fields (`lib/live_canvas_gql/live/live_mutations.ex`, `lib/live_canvas_gql/feed/feed_types.ex`).
4. **Content already owns the durable media asset model needed for recording linkage.**
   - Evidence: `LC.Content` already handles media asset persistence, finalize-state transitions, and public URL generation, while GraphQL already exposes `MediaAsset` as a Relay node (`lib/live_canvas/content.ex`, `lib/live_canvas_gql/content/content_types.ex`).

## Scope And Assumptions

- Use one nullable `recording_media_asset_id` foreign key on `live_sessions`; do not create a second replay table in this slice.
- Allow linking only host-owned media assets in `:uploaded` or `:processed` state.
- Reject `:pending_upload` and `:failed` assets so ended sessions never point at a missing or terminally broken recording.
- Keep replay discovery and replay-feed listing out of scope for now; this slice only establishes durable linkage plus Relay node access on `LiveSession`.
- Preserve existing host-only `endLiveSession` authorization and keep recording linkage optional.

## Progress

- [x] Task 1: Add durable recording linkage storage and end-session validation
- [x] Task 2: Expose recording linkage through GraphQL live-session surfaces
- [x] Task 3: Run final verification and refresh tracking

### Task 1: Add Durable Recording Linkage Storage And End-Session Validation

**Files:**
- Create: `priv/repo/migrations/20260317224500_add_recording_media_asset_id_to_live_sessions.exs`
- Modify: `lib/live_canvas_schemas/live/live_session.ex`
- Modify: `lib/live_canvas/live/live_session.ex`
- Modify: `lib/live_canvas/live.ex`
- Modify: `lib/live_canvas/content.ex`
- Modify: `test/live_canvas/live_test.exs`
- Modify as needed: `test/live_canvas/content_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing Live tests for linking a host-owned recording asset when ending a session
- [x] Step 2: Add failing Live tests for rejecting foreign, pending-upload, and failed recording assets
- [x] Step 3: Run focused Live and Content tests to verify RED
- [x] Step 4: Add the nullable recording FK, schema and typespec fields, and `LC.Live` end-session validation and linkage
- [x] Step 5: Re-run focused Live and Content tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- Ending a live session can optionally persist `recording_media_asset_id`.
- Only the session host's own media assets can be linked.
- Only `:uploaded` or `:processed` assets can be linked.
- Repeated end calls keep the first persisted recording linkage intact.

**Suggested TDD details:**

Step 1 should add coverage for:
- ending a session with a host-owned `:uploaded` asset
- ending a session with a host-owned `:processed` asset
- keeping `recording_media_asset_id` `nil` when no recording asset is supplied

Step 2 should add coverage for:
- rejecting another user's media asset
- rejecting `:pending_upload` assets
- rejecting `:failed` assets
- preserving an already-linked recording during concurrent or repeated end calls

Step 3 command:

```bash
mix test test/live_canvas/live_test.exs test/live_canvas/content_test.exs
```

Expected: FAIL because live sessions currently have no recording linkage field or validation path.

Step 4 implementation notes:
- Add a foreign key from `live_sessions.recording_media_asset_id` to `media_assets`.
- Keep the validation decision in `LC.Live`; use `LC.Content` only for owner and state lookup helpers.
- Add a concise comment explaining why `:pending_upload` and `:failed` assets are excluded.

Step 6 commands:

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas/content_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add priv/repo/migrations/20260317224500_add_recording_media_asset_id_to_live_sessions.exs lib/live_canvas_schemas/live/live_session.ex lib/live_canvas/live/live_session.ex lib/live_canvas/live.ex lib/live_canvas/content.ex test/live_canvas/live_test.exs test/live_canvas/content_test.exs docs/plans/live/2026-03-17-live-session-recording-linkage.md
git commit -m "feat: link recordings to ended live sessions"
```

### Task 2: Expose Recording Linkage Through GraphQL Live-Session Surfaces

**Files:**
- Modify: `lib/live_canvas_gql/feed/feed_types.ex`
- Modify: `lib/live_canvas_gql/live/live_mutations.ex`
- Modify: `lib/live_canvas_gql/live/live_resolver.ex`
- Modify: `test/live_canvas_gql/live/live_mutations_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify as needed: `test/live_canvas_gql/feed/feed_queries_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL mutation tests for `endLiveSession(recordingMediaAssetId:)`
- [x] Step 2: Add failing Relay node tests for `LiveSession.recordingMediaAsset`
- [x] Step 3: Run focused GraphQL live and relay tests to verify RED
- [x] Step 4: Expose `recordingMediaAsset` on `LiveSession` and wire `recordingMediaAssetId` through `endLiveSession`
- [x] Step 5: Re-run focused GraphQL live and relay tests to verify GREEN
- [x] Step 6: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- `endLiveSession` can accept an optional Relay `recordingMediaAssetId`.
- The returned `LiveSession` payload includes the linked `recordingMediaAsset`.
- Relay node refetch of an ended `LiveSession` exposes the same linked recording metadata.
- Invalid IDs, foreign assets, and disallowed processing states return structured mutation errors instead of top-level crashes.

**Suggested TDD details:**

Step 1 should add coverage for:
- successful host-owned recording linkage via `endLiveSession`
- invalid Relay ID type handling for `recordingMediaAssetId`
- rejecting foreign or disallowed assets through the mutation error contract

Step 2 should add coverage for:
- `node(id: ...) { ... on LiveSession { recordingMediaAsset { id processingState publicUrl } } }`
- `recordingMediaAsset` returning `nil` on sessions without a linked recording

Step 3 command:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs
```

Expected: FAIL because GraphQL currently has no recording-aware live-session fields or mutation input.

Step 4 implementation notes:
- Keep the Relay surface additive by extending the existing `LiveSession` node.
- Reuse the existing `MediaAsset` node and `publicUrl` contract instead of copying storage metadata onto `LiveSession`.
- Add a concise comment where the resolver forwards recording IDs into `LC.Live` so the ownership and validation boundary remains explicit.

Step 6 commands:

```bash
mix compile
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add lib/live_canvas_gql/feed/feed_types.ex lib/live_canvas_gql/live/live_mutations.ex lib/live_canvas_gql/live/live_resolver.ex test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs docs/plans/live/2026-03-17-live-session-recording-linkage.md
git commit -m "feat: expose live session recording linkage in graphql"
```

### Task 3: Run Final Verification And Refresh Tracking

**Files:**
- Modify: `docs/plans/live/2026-03-17-live-session-recording-linkage.md`
- Modify: `docs/plans/live/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [x] Step 1: Run final verification on the touched Live, Content, and GraphQL suites
- [x] Step 2: Update plan, track, index, and `NOW.md` tracking based on the next unblocked batch
- [x] Step 3: Commit the milestone

**Task 3 verification commands:**

```bash
mix compile
mix test test/live_canvas/live_test.exs test/live_canvas/content_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/feed/feed_queries_test.exs
mix typecheck
```

Expected: PASS.

Step 3 commit:

```bash
git add docs/plans/live/2026-03-17-live-session-recording-linkage.md docs/plans/live/TRACK.md docs/plans/INDEX.md docs/plans/NOW.md docs/plans/README.md
git commit -m "docs: track live session recording linkage work"
```

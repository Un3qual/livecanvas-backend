# Mobile Lane NOW

Last reviewed: 2026-07-03
Status: mobile post media attachment batch selected; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not make speculative backend Elixir/GraphQL, shared contract, or
  coordinator-doc changes from this lane. If active mobile work exposes a
  verified backend contract, resolver, runtime, or data issue, promote it as
  cross-lane work and update the backend lane write scope before implementation.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-07-03-mobile-post-media-attachments.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: Task 1, add composer attachment state helpers.
- Current detail plan: none; execute directly from the source plan.
- Latest completed source plan:
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Latest completed feed/content plan:
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Selected-by audit:
  `docs/plans/2026-07-06-cross-lane-product-gap-audit.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-30-product-follow-up-queue-completion`
  records passing mobile quality gates after the completed feature queue and
  notes that preview build/device/account manual QA remains pending in this
  worker environment.
- Write scope:
  - `mobile/**`
  - `docs/plans/mobile/**`
- Done condition: signed-in mobile viewers can attach one picked image or video
  to a standard post or story from `/compose`, upload it through the existing
  `requestMediaUpload` signed upload contract, and submit the returned media
  asset ID through `createPost(mediaAssetIds:)`, with focused tests and final
  mobile gates recorded in the source plan.
- Verification:
  - From `mobile/`:
    `bun test tests/feed/postComposerAttachmentState.test.ts tests/feed/postComposerState.test.ts`
  - From `mobile/`:
    `bun test tests/feed/postComposerMediaPicker.test.ts tests/feed/postComposerMediaUpload.test.ts`
  - From `mobile/`: `bun test tests/feed/PostComposerScreen.test.tsx`
  - From `mobile/`: `bun run relay`
  - From `mobile/`: `bun run typecheck`
  - From `mobile/`: `bun run test:quality`
  - From repo root: `git diff --check`

## Do This Now

Implement Task 1 in
`docs/plans/mobile/2026-07-03-mobile-post-media-attachments.md`: add composer
attachment state helpers and focused tests under `mobile/tests/feed/**`.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not run release-candidate manual device QA from this handoff.
- Do not reactivate archived cleanup or completed live-session feature
  follow-up plans from this batch.
- Do not expand the release-candidate checklist into implementation.
- This batch explicitly promotes native media picking, signed upload, and media
  attachment UI. Keep the first implementation to one attachment and the
  existing backend contracts.
- Do not implement post edit/delete owner controls in this batch.
- Do not change GraphQL schema shape during this batch unless the active
  product work proves a backend contract mismatch that must be promoted into
  the backend lane.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a backend issue is reproduced and
  promoted with an explicit cross-lane scope.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Implement Task 1 from the source plan.

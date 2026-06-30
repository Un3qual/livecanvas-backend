# Mobile Lane NOW

Last reviewed: 2026-06-30
Status: mobile feed/content product batch active; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: Task 2, replace live-only home with a product home surface.
- Latest completed prerequisite:
  `docs/plans/archive/completed/mobile/2026-06-29-release-diagnostics-screen.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-30-product-follow-up-queue-completion`
  records passing mobile quality gates after the completed feature queue and
  notes that preview build/device/account manual QA remains pending in this
  worker environment.
- Write scope:
  - `mobile/**`
  - `docs/plans/mobile/**`
- Done condition: the mobile home surface renders backend-backed content and
  replay discovery plus post reporting from the existing GraphQL contract; the
  completed plan is archived or the lane is explicitly marked awaiting product
  direction for any contract mismatch.
- Verification:
  - From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
  - From `mobile/`: `bun test tests/feed/feedPresentation.test.ts`
  - From `mobile/`: `bun test tests/feed/reportPostReducer.test.ts`
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Implement Task 2 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`: replace the
live-only home route with a product home surface backed by the existing feed,
story, replay, live-now, and viewer-current-session GraphQL reads. Keep the
release-candidate checklist deferred until product explicitly resumes QA.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not run release-candidate manual device QA from this handoff.
- Do not reactivate archived cleanup or completed live-session feature
  follow-up plans from this batch.
- Do not expand the release-candidate checklist into implementation.
- Do not change GraphQL schema shape during this batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Implement Task 2 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`.

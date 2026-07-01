# Mobile Lane NOW

Last reviewed: 2026-06-30
Status: mobile feed/content product batch active; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not make speculative backend Elixir/GraphQL, shared contract, or
  coordinator-doc changes from this lane. If active mobile work exposes a
  verified backend contract, resolver, runtime, or data issue, promote it as
  cross-lane work and update the backend lane write scope before implementation.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: Task 4, add section refresh and pagination affordances.
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
- Done condition: the mobile home surface renders backend-backed content,
  replay discovery, post reporting, and section refresh/pagination affordances
  from the existing GraphQL contract; the completed plan is archived or the
  lane is explicitly marked awaiting product direction for any contract
  mismatch.
- Verification:
  - From `mobile/`: `bun test tests/feed/feedPresentation.test.ts`
  - From `mobile/`: `bun test tests/feed/FeedHomeScreen.test.tsx`
  - From `mobile/`: `bun test tests/feed/reportPostReducer.test.ts`
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Implement Task 4 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`: add section
refresh and pagination affordances for the home feed, stories, and replays.
Keep the release-candidate checklist deferred until product explicitly resumes
QA.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not run release-candidate manual device QA from this handoff.
- Do not reactivate archived cleanup or completed live-session feature
  follow-up plans from this batch.
- Do not expand the release-candidate checklist into implementation.
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

Implement Task 4 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`.

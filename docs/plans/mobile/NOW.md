# Mobile Lane NOW

Last reviewed: 2026-07-01
Status: mobile post composer product batch active; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not make speculative backend Elixir/GraphQL, shared contract, or
  coordinator-doc changes from this lane. If active mobile work exposes a
  verified backend contract, resolver, runtime, or data issue, promote it as
  cross-lane work and update the backend lane write scope before implementation.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-07-01-mobile-post-composer.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: Task 3, wire Relay `createPost`.
- Current detail plan:
  `docs/plans/mobile/2026-07-01-post-composer-create-post-relay.md`
- Latest completed source plan:
  `docs/plans/archive/completed/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Latest completed detail plan:
  `docs/plans/mobile/2026-07-01-post-composer-route-screen.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-30-product-follow-up-queue-completion`
  records passing mobile quality gates after the completed feature queue and
  notes that preview build/device/account manual QA remains pending in this
  worker environment.
- Write scope:
  - `mobile/**`
  - `docs/plans/mobile/**`
- Done condition: signed-in mobile viewers can create text-only standard posts
  and stories from the home surface through the existing Relay `createPost`
  mutation, with focused tests and final mobile gates recorded in the source
  plan.
- Verification:
  - From `mobile/`: `bun test tests/feed/postComposerState.test.ts`
  - From `mobile/`:
    `bun test tests/feed/PostComposerScreen.test.tsx tests/feed/FeedHomeScreen.test.tsx`
  - From `mobile/`: `bun run typecheck`
  - From `mobile/`: `bun run test:quality`
  - From repo root: `git diff --check`

## Do This Now

Implement Task 3 in `docs/plans/mobile/2026-07-01-mobile-post-composer.md`:
wire the existing Relay `createPost` mutation into the composer screen using
`docs/plans/mobile/2026-07-01-post-composer-create-post-relay.md`. Keep native
media picking, signed upload, media attachment UI, and release-candidate
checklist work out of this task unless a verified issue is promoted by the
active implementation.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not run release-candidate manual device QA from this handoff.
- Do not reactivate archived cleanup or completed live-session feature
  follow-up plans from this batch.
- Do not expand the release-candidate checklist into implementation.
- Do not implement native media picking, signed upload, or media attachment UI
  in the first composer task.
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

Implement Task 3 using
`docs/plans/mobile/2026-07-01-post-composer-create-post-relay.md`.

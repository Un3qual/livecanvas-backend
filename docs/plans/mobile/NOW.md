# Mobile Lane NOW

Last reviewed: 2026-06-30
Status: feature-completeness follow-ups complete; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/TRACK.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: select or write the next non-QA product-completeness batch.
- Latest completed prerequisite:
  `docs/plans/archive/completed/mobile/2026-06-29-release-diagnostics-screen.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-30-product-follow-up-queue-completion`
  records passing mobile quality gates after the completed feature queue and
  notes that preview build/device/account manual QA remains pending in this
  worker environment.
- Write scope:
  - `docs/plans/mobile/**`
  - `mobile/**` only after a concrete product-completeness plan is promoted
- Done condition: the next non-QA product-completeness batch is promoted into
  this file with source plan, write scope, done condition, and verification; or
  the lane is explicitly marked awaiting product direction.
- Verification:
  - From repo root: `git diff --check`

## Do This Now

Review the mobile track and product goals, then promote or write the next
non-QA product-completeness plan. Keep the release-candidate checklist deferred
until product explicitly resumes QA.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not run release-candidate manual device QA from this handoff.
- Do not reactivate archived cleanup or feature follow-up plans from this QA
  handoff.
- Do not expand the release-candidate checklist into implementation.
- Do not change GraphQL schema shape during this planning batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Review the mobile track and product goals, then promote or write the next
non-QA product-completeness plan.

# Mobile Lane NOW

Last reviewed: 2026-06-29
Status: XState live workflow cleanup complete; release-candidate QA active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: run the one-host/one-viewer release-candidate device QA pass.
- Latest completed prerequisite:
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-xstate-live-workflows.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-29-local-entry-gate-pass`
  records passing local entry gates and notes that preview build/device/account
  manual QA remains pending in this worker environment.
- Write scope:
  - `docs/plans/mobile/**`
  - `mobile/**` only for reproduced launch-blocker fixes
- Done condition: entry criteria and manual device/simulator checks are recorded
  as passing, or launch blockers are promoted into scoped follow-up plans.
- Verification:
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Start with the release-candidate checklist entry criteria, then run the auth,
profiles, live discovery/watch, host preflight, media signaling/WebRTC, realtime
chat, retained replay, and cleanup checks for the one-host/one-viewer beta
scope.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this local
  docs handoff.
- Do not expand the completed release-candidate checklist into implementation
  unless a launch blocker is reproduced and promoted.
- Do not reactivate archived cleanup plans from this QA handoff.
- Do not change GraphQL schema shape during the QA batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Confirm the `preview` build installs, cold-launches, and reaches the configured
API and websocket endpoints on the target beta device.

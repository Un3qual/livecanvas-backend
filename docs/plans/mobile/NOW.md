# Mobile Lane NOW

Last reviewed: 2026-06-30
Status: feature-completeness follow-ups active; release-candidate QA deferred

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/follow-ups/2026-06-29-host-in-session-controls.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current task: implement host in-session microphone and camera controls.
- Latest completed prerequisite:
  `docs/plans/archive/completed/mobile/2026-06-27-mobile-xstate-live-workflows.md`
- Latest QA evidence:
  `docs/plans/mobile/2026-06-25-release-candidate-checklist.md#2026-06-29-local-entry-gate-pass`
  records passing local entry gates and notes that preview build/device/account
  manual QA remains pending in this worker environment. Treat that QA as the
  final gate after queued product follow-ups, not as the current batch.
- Write scope:
  - `docs/plans/mobile/**`
  - `mobile/**`
- Done condition: host-owned live sessions with retained publishing resources
  expose tested mic and camera toggles, viewer/ended sessions do not expose
  them, and the source plan verification passes.
- Verification:
  - From `mobile/`: `bun test tests/host/hostBroadcastLocalMediaControls.test.ts`
  - From `mobile/`: `bun test tests/host/hostBroadcastPublishingSession.test.ts`
  - From `mobile/`: `bun test tests/host/useHostBroadcastPublishingController.test.ts`
  - From `mobile/`: `bun test tests/live/liveSessionWatchHostControls.test.ts`
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Do This Now

Start Task 1 of the host in-session controls plan: add local media control
helpers that can safely inspect and toggle audio/video tracks for retained host
publishing resources.

## Guardrails

- Do not run remote or authenticated EAS build/submit commands from this lane
  handoff.
- Do not reactivate release-candidate manual QA until the queued product
  follow-ups are implemented or explicitly deferred.
- Do not reactivate archived cleanup plans from this feature handoff.
- Do not change GraphQL schema shape during this mobile feature batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Create `mobile/src/host/publishing/hostBroadcastLocalMediaControls.ts` and
`mobile/tests/host/hostBroadcastLocalMediaControls.test.ts` from the source
plan's Task 1.

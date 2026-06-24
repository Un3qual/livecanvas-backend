# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md` Task 4
- Source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 5 - device smoke and beta mechanics return
- Write scope:
  - `docs/plans/mobile/**`
  - focused mobile smoke checklist or test-support files needed by Task 5
- Done condition: add a concise device or simulator smoke checklist for one
  host and one viewer covering auth, live discovery, host preflight, media
  publish, viewer playback, chat send/receive, retained chat replay, leave, and
  end; re-run the focused mobile gates; update this lane and track with exact
  evidence; then promote beta release readiness if product blockers are closed
  or explicitly deferred.
- Verification:
  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host`
  - `cd mobile && ./node_modules/.bin/tsc --noEmit`
  - `git diff --check`

## Do This Now

Implement Task 5 in
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`.

## Guardrails

- Do not add beta build mechanics until the smoke checklist captures the core
  host/viewer media loop evidence or the product owner explicitly defers it.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Add the host/viewer device smoke checklist and then decide whether to return to
beta release mechanics.

# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md` Task 5
- Source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 1 - quality gate command alignment
- Write scope:
  - `docs/plans/mobile/**`
  - `mobile/package.json`
  - `mobile/tsconfig.json`
  - `mobile/relay.config.js`
  - focused mobile test, Relay, or package config files needed to expose the
    quality gate commands
- Done condition: mobile package scripts expose repeatable test and typecheck
  commands, the current live/relay/realtime/host suite still passes, and the
  source plan plus this lane NOW record exact verification evidence.
- Verification:
  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host`
  - `cd mobile && ./node_modules/.bin/tsc --noEmit`

## Do This Now

Implement Task 1 in
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`.

## Guardrails

- Do not add beta build mechanics until Task 1 aligns the local quality gate
  commands.
- Do not change GraphQL schema shape in the quality gate alignment batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Verify the current mobile package manager, TypeScript, Relay, and Bun test
entrypoints from `mobile/package.json`, `mobile/tsconfig.json`, and
`mobile/relay.config.js`, then add or adjust package scripts for Task 1.

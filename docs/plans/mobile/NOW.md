# Mobile Lane NOW

Last reviewed: 2026-06-05
Status: ready

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-04-chat-realtime-retained-history.md`
- Source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 1 - quality gate command alignment
- Write scope: `mobile/package.json`, `mobile/pnpm-lock.yaml`,
  `mobile/tsconfig.json`, `mobile/relay.config.js`, mobile test/config files as
  needed, `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`, and
  this lane NOW file.
- Done condition: mobile package scripts expose repeatable test and typecheck
  commands, the current live/relay/realtime/host suite still passes, and the
  source plan plus lane NOW record the verification evidence.
- Verification:
  - `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host`
  - From `mobile/`: `./node_modules/.bin/tsc --noEmit`

## Do This Now

Execute Task 1 in
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`.

## Guardrails

- Do not add real mobile media publishing or viewer playback from this lane.
- Do not decode Relay IDs client-side.
- Backend live media runtime foundation is complete; keep true go-live behavior
  aligned with the backend media signaling contract.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

After Task 1 is verified, continue to the beta build path task in the same
source plan.

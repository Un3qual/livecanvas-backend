# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready for next mobile batch

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md` Task 1
- Source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 1 - quality gate command alignment (complete on 2026-06-24)
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
  Met on 2026-06-24.
- Verification:
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Task 1 Evidence

- `mobile/package.json` uses `packageManager: pnpm@10.32.1`; `relay` remains
  `relay-compiler`; `test:quality` and `typecheck` are the executor-facing
  package scripts for this gate.
- `mobile/tsconfig.json` extends `expo/tsconfig.base`, keeps `strict: true`,
  and excludes test/spec files from the app typecheck.
- `mobile/relay.config.js` still targets `./src` and `./schema.graphql` with
  TypeScript output and the existing generated-file excludes.
- `bun run test:quality` passed on 2026-06-24: 141 tests across 23 files,
  0 failures, 457 `expect()` calls.
- `bun run typecheck` passed on 2026-06-24: `./node_modules/.bin/tsc --noEmit`
  exited 0 with no diagnostics.
- `git diff --check` exited 0 on 2026-06-24.

## Do This Now

Task 1 is complete. Do not start Task 2 in this Task 1 batch; the next mobile
implementation turn can pick up Task 2 - beta build path from
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

Pick up Task 2 - beta build path in the source plan without changing the Task 1
quality gate scripts unless the package entrypoints drift again.

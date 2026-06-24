# Mobile Testing, Beta Distribution, And Release Readiness

Status: active/ready on 2026-06-24. The pre-beta product completeness blockers
that deferred this plan were closed by
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`: viewer media
setup, host WebRTC publishing, viewer playback, and the one-host/one-viewer
device smoke checklist are complete.

Executor brief: turn the completed mobile auth/live/chat loop into a repeatable
release-candidate workflow. Keep the first batch focused on local quality gates
before adding distribution or app-store release scope.

## Task 1: Quality Gate Command Alignment

- [x] Verify the current mobile package manager, TypeScript, Relay, and Bun test
      entrypoints from `mobile/package.json`, `mobile/tsconfig.json`, and
      `mobile/relay.config.js`.
- [x] Add or adjust package scripts so executors have one obvious command for
      mobile tests and one obvious command for mobile typechecking.
- [x] Keep any Relay codegen command aligned with the existing generated files;
      do not change GraphQL schema shape in this batch.
- [x] Run the focused mobile quality gate and record the exact evidence in this
      plan and `docs/plans/mobile/NOW.md`.

Done condition: mobile package scripts expose repeatable test and typecheck
commands, the current live/relay/realtime/host suite still passes, and the
source plan plus lane NOW record the verification evidence.

Verification:

- From `mobile/`: `bun run test:quality`
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

Evidence on 2026-06-24:

- `mobile/package.json` declares `packageManager: pnpm@10.32.1`; the existing
  `relay` script remains `relay-compiler`, and the added package scripts are
  `test:quality` and `typecheck`.
- `mobile/tsconfig.json` extends `expo/tsconfig.base`, keeps `strict: true`,
  and excludes test/spec files from the app typecheck.
- `mobile/relay.config.js` still points Relay at `src: './src'`,
  `schema: './schema.graphql'`, TypeScript output, eager ES modules, and the
  existing node_modules, mock, and generated-file excludes.
- `bun run test:quality` ran `bun test src/live src/relay src/realtime src/host`
  and passed: 141 tests across 23 files, 0 failures, 457 `expect()` calls.
- `bun run typecheck` ran `./node_modules/.bin/tsc --noEmit` and exited 0 with
  no diagnostics.
- `git diff --check` exited 0.

## Task 2: Beta Build Path

- [ ] Decide the internal beta distribution path for the Expo custom dev build
      versus release candidate builds.
- [ ] Document required local secrets, native identifiers, and build
      prerequisites without committing secret values.
- [ ] Verify app config identifiers and platform metadata are explicit enough
      for a repeatable beta build handoff.

## Task 3: Release Candidate Checklist

- [ ] Create a concise release-candidate checklist covering auth, profiles,
      live discovery/watch, host preflight, media signaling, realtime chat, and
      retained chat replay.
- [ ] Include manual device/simulator checks that are not covered by unit tests.
- [ ] Record known deferred items separately from launch blockers.

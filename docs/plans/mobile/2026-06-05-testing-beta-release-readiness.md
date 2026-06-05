# Mobile Testing, Beta Distribution, And Release Readiness

Executor brief: turn the completed mobile auth/live/chat loop into a repeatable
release-candidate workflow. Keep the first batch focused on local quality gates
before adding distribution or app-store release scope.

## Task 1: Quality Gate Command Alignment

- [ ] Verify the current mobile package manager, TypeScript, Relay, and Bun test
      entrypoints from `mobile/package.json`, `mobile/tsconfig.json`, and
      `mobile/relay.config.js`.
- [ ] Add or adjust package scripts so executors have one obvious command for
      mobile tests and one obvious command for mobile typechecking.
- [ ] Keep any Relay codegen command aligned with the existing generated files;
      do not change GraphQL schema shape in this batch.
- [ ] Run the focused mobile quality gate and record the exact evidence in this
      plan and `docs/plans/mobile/NOW.md`.

Done condition: mobile package scripts expose repeatable test and typecheck
commands, the current live/relay/realtime/host suite still passes, and the
source plan plus lane NOW record the verification evidence.

Verification:

- `bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host`
- From `mobile/`: `./node_modules/.bin/tsc --noEmit`

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

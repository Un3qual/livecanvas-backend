# Mobile Testing, Beta Distribution, And Release Readiness

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

Status: complete on 2026-06-25. The pre-beta product completeness blockers
that deferred this plan were closed by
`docs/plans/mobile/2026-06-24-pre-beta-product-completeness.md`: viewer media
setup, host WebRTC publishing, viewer playback, and the one-host/one-viewer
device smoke checklist are complete. Task 3 added the release-candidate
checklist at
`docs/plans/mobile/2026-06-25-release-candidate-checklist.md`.

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

Maintenance update on 2026-06-27:

- Mobile Bun tests now live under `mobile/tests/<domain>/`; `mobile/src` has no
  `.test` or `.spec` files.
- `test:quality` now runs
  `bun test tests/live tests/relay tests/realtime tests/host`, preserving the
  existing live/relay/realtime/host quality-gate scope after the test layout
  move.
- Moved auth/profile/config tests were verified separately with
  `bun test tests/auth tests/profile tests/config`.

## Task 2: Beta Build Path

- [x] Decide the internal beta distribution path for the Expo custom dev build
      versus release candidate builds.
- [x] Document required local secrets, native identifiers, and build
      prerequisites without committing secret values.
- [x] Verify app config identifiers and platform metadata are explicit enough
      for a repeatable beta build handoff.

Done condition: mobile has explicit native identifiers plus a repeatable local
EAS profile handoff for internal development-client builds and internal
release-candidate builds. The source plan and lane NOW record prerequisites,
secrets handling, and local verification evidence without committing secret
values or running authenticated EAS commands.

Beta build path:

- Native media QA uses the `development` EAS build profile. It creates a custom
  development-client build with `developmentClient: true` and
  `distribution: internal`; Expo Go is not a valid beta path because the app
  uses `expo-dev-client` and `react-native-webrtc`.
- Release-candidate device QA uses the `preview` EAS build profile. It extends
  the production profile, keeps `distribution: internal`, and omits
  `developmentClient` so testers exercise a closer-to-release binary.
- Store/TestFlight handoff stays separate from this local config task:
  TestFlight or Play Console internal-track submission should be driven by EAS
  Submit after the app records exist and the required credentials are available.

Native identifiers and metadata:

- Expo name: `LiveCanvas Mobile`; slug: `livecanvas-mobile`; scheme:
  `livecanvas-mobile`.
- iOS bundle identifier: `com.livecanvas.mobile`; build number: `1`.
- Android package: `com.livecanvas.mobile`; version code: `1`.
- Camera and microphone usage strings remain present for iOS, and Android keeps
  `CAMERA` plus `RECORD_AUDIO` permissions for native media.

Prerequisites and secrets:

- Required local tooling: Expo account, authenticated EAS CLI, and the existing
  mobile package install from `mobile/`.
- iOS internal distribution requires a paid Apple Developer account. Ad hoc
  distribution requires registered tester UDIDs unless the team uses an
  enterprise distribution path.
- Android internal distribution produces a directly installable APK for the
  `preview` and `development` profiles by default.
- EAS remote jobs do not read local `.env` or `.env.local` files. Configure
  build-time values in EAS environments instead; `EXPO_PUBLIC_API_BASE_URL`,
  `EXPO_PUBLIC_WEBSOCKET_URL`, `EXPO_PUBLIC_BOOT_SESSION_STATE`, and
  `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values are client-readable and must be
  treated as public.
- Do not commit store credentials or API keys. If Android submission needs a
  Play Console service-account file for a local EAS Submit run, keep it at
  `mobile/secrets/google-play-service-account.json`; `mobile/.gitignore`
  explicitly ignores that file pattern.

Verification:

- From `mobile/`: `node -e "for (const file of ['app.json', 'eas.json']) JSON.parse(require('fs').readFileSync(file, 'utf8'))"`
- From `mobile/`: `bun run test:quality`
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

Evidence on 2026-06-24:

- `mobile/app.json` now declares the iOS bundle identifier/build number and
  Android package/version code alongside the existing name, slug, scheme,
  permissions, and usage strings.
- `mobile/eas.json` defines `production`, `preview`, and `development` build
  profiles. `preview` is the internal release-candidate profile, while
  `development` inherits that internal distribution and enables the custom
  development client.
- `mobile/.gitignore` now ignores the documented local Play Console
  service-account JSON path.
- Local JSON validation passed for `mobile/app.json` and `mobile/eas.json`.
- `bun run test:quality` ran `bun test src/live src/relay src/realtime src/host`
  and passed: 141 tests across 23 files, 0 failures, 457 `expect()` calls.
- `bun run typecheck` ran `./node_modules/.bin/tsc --noEmit` and exited 0 with
  no diagnostics.
- `git diff --check` exited 0.
- No remote or authenticated EAS build/submit commands were run.

## Task 3: Release Candidate Checklist

- [x] Create a concise release-candidate checklist covering auth, profiles,
      live discovery/watch, host preflight, media signaling, realtime chat, and
      retained chat replay.
- [x] Include manual device/simulator checks that are not covered by unit tests.
- [x] Record known deferred items separately from launch blockers.

Done condition: the mobile lane has a focused release-candidate checklist that
separates launch blockers from deferred follow-up, names the local quality
gates, keeps `development` and `preview` EAS profile usage distinct, and covers
manual device/simulator checks for auth, profiles, live discovery/watch, host
preflight, media signaling, realtime chat, retained chat replay, app
background/foreground recovery, and ended-session cleanup.

Checklist:

- `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

Verification:

- From repo root: `git diff --check`

Evidence on 2026-06-25:

- `git diff --check` exited 0.
- No mobile app code, package, or config files changed for Task 3.
- No remote or authenticated EAS build/submit commands were run.

Release-candidate handoff:

- Use `preview` for internal release-candidate device QA.
- Use `development` only for custom development-client native-media debugging.
- Do not run remote or authenticated EAS build/submit commands from this local
  docs handoff.
- Treat any launch blocker in the checklist as a beta-release blocker until it
  is fixed or explicitly descoped by product.

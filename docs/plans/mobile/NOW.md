# Mobile Lane NOW

Last reviewed: 2026-06-24
Status: ready for next mobile batch

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Last completed source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md` Task 2
- Source plan:
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 2 - beta build path (complete on 2026-06-24)
- Write scope:
  - `docs/plans/mobile/**`
  - `mobile/app.json`
  - `mobile/eas.json`
  - `mobile/.gitignore`
- Done condition: mobile has explicit native identifiers plus a repeatable
  local EAS profile handoff for internal development-client builds and internal
  release-candidate builds. The source plan plus this lane NOW record
  prerequisites, secrets handling, and local verification evidence without
  committing secret values or running authenticated EAS commands.
  Met on 2026-06-24.
- Verification:
  - From `mobile/`: `node -e "for (const file of ['app.json', 'eas.json']) JSON.parse(require('fs').readFileSync(file, 'utf8'))"`
  - From `mobile/`: `bun run test:quality`
  - From `mobile/`: `bun run typecheck`
  - From repo root: `git diff --check`

## Task 2 Evidence

- Beta development builds use the `development` EAS profile: a custom
  development-client build with `distribution: internal` for native-media QA.
  Expo Go is not a valid path because the app uses `expo-dev-client` and
  `react-native-webrtc`.
- Release-candidate device QA uses the `preview` EAS profile:
  `distribution: internal` without `developmentClient`.
- Store/TestFlight submission stays separate from this local config task and
  requires EAS Submit plus platform credentials after the app records exist.
- `mobile/app.json` declares name `LiveCanvas Mobile`, slug
  `livecanvas-mobile`, scheme `livecanvas-mobile`, iOS bundle identifier
  `com.livecanvas.mobile`, iOS build number `1`, Android package
  `com.livecanvas.mobile`, and Android version code `1`.
- Required prerequisites are an Expo account, authenticated EAS CLI, installed
  mobile dependencies, a paid Apple Developer account for iOS device builds, and
  registered UDIDs for ad hoc iOS distribution.
- Build-time values must be configured in EAS environments. Client-side
  `EXPO_PUBLIC_*` values are readable in the app; local `.env` and `.env.local`
  files are not available to remote EAS jobs.
- `mobile/.gitignore` ignores `mobile/secrets/google-play-service-account*.json`
  for local Play Console service-account files.
- Local JSON validation passed for `mobile/app.json` and `mobile/eas.json`.
- `bun run test:quality` passed on 2026-06-24: 141 tests across 23 files,
  0 failures, 457 `expect()` calls.
- `bun run typecheck` passed on 2026-06-24: `./node_modules/.bin/tsc --noEmit`
  exited 0 with no diagnostics.
- `git diff --check` exited 0 on 2026-06-24.
- No remote or authenticated EAS build/submit commands were run.

## Do This Now

Task 2 is complete. Do not start Task 3 in this Task 2 batch; the next mobile
implementation turn can pick up Task 3 - release candidate checklist from
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`.

## Guardrails

- Do not create the release-candidate checklist until Task 3.
- Do not run remote or authenticated EAS build/submit commands from this local
  config handoff.
- Do not change GraphQL schema shape in the quality gate alignment batch.
- Do not decode Relay IDs client-side.
- Do not construct media signaling topics client-side.
- Backend live media runtime foundation and the viewer setup contract are
  complete; do not change backend code unless a viewer-runtime blocker is
  reproduced and promoted.
- Implement retained history against the current `LiveSession.timelineEvents`
  schema, not the stale removed `chatMessages` API.

## Next Action

Pick up Task 3 - release candidate checklist in the source plan without
changing the Task 2 beta build profiles unless Expo platform requirements drift.

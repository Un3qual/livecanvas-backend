# Mobile Lane NOW

Last reviewed: 2026-06-03
Status: active

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**`.
- Do not edit backend Elixir/GraphQL code, shared contract docs, or coordinator
  docs unless explicitly assigned.

## Current Batch

- Source plan:
  `docs/plans/mobile/2026-06-02-host-broadcast-native-capability-preflight.md`
- Track: `docs/plans/mobile/TRACK.md`
- Task: Task 1, add the native development-build and WebRTC dependency boundary.
- Files: `mobile/package.json`, `mobile/pnpm-lock.yaml`, `mobile/app.json`,
  `mobile/index.ts`.

## Do This Now

1. Install native/development dependencies in `mobile/`:
   `pnpm exec expo install expo-dev-client expo-keep-awake`
2. Add WebRTC dependencies in `mobile/`:
   `pnpm add react-native-webrtc @config-plugins/react-native-webrtc`
3. Import `expo-dev-client` before `expo-router/entry` in `mobile/index.ts`.
4. Add the WebRTC config plugin plus explicit camera/microphone permission copy
   in `mobile/app.json`, preserving existing metadata.
5. Run focused verification:
   `pnpm exec expo config --type public`
   `./node_modules/.bin/tsc --noEmit`
6. Mark Task 1 complete in the source plan and commit the dependency-boundary
   change.

## Done Condition

Task 1 is done when package files, app config, and entrypoint are updated, Expo
public config resolves, TypeScript passes, and the source plan records the
completed task.

## Guardrails

- Do not enable mobile go-live, media publishing, viewer playback, or full chat
  stream UI in this batch.
- Do not decode Relay IDs client-side.
- Keep true media signaling blocked until backend ICE/TURN/WebRTC negotiation
  contracts are planned.

## Next Action

After Task 1, continue the same source plan with the pure TypeScript host
preflight and host session state tasks before building the UI route.

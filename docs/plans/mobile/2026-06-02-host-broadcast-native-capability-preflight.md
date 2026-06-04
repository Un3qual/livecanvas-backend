# Host Broadcast Native Capability And Preflight Plan

**Goal:** Add the mobile host-broadcast preflight foundation without enabling
real media publishing before backend signaling exists.

**Architecture:** Keep durable live-session state Relay-first and ephemeral
session state on Phoenix Channels. Use an Expo custom development build with
`react-native-webrtc` as the client-side media boundary. Keep go-live disabled
until backend ICE/TURN and WebRTC negotiation contracts are planned.

**Tech Stack:** Expo SDK 55, Expo Router, React Native, TypeScript, Relay,
Phoenix Channels, `react-native-webrtc`, Bun tests, Relay Compiler, `tsc`.

---

## Executor Brief

- Lane pointer: `docs/plans/mobile/NOW.md`
- Track: `docs/plans/mobile/TRACK.md`
- Current batch: Task 1
- Write scope: `mobile/` and `docs/plans/mobile/**`
- Out of scope: backend Elixir/GraphQL code, shared contracts, real go-live,
  media publishing, viewer playback, and Relay ID decoding

Execute tasks in order. Task 1 is the dependency boundary for all later host
media work. Tasks 2-4 are pure TypeScript model/adapter tasks. Task 5 adds the
route and UI entry point. Task 6 verifies and closes the lane handoff.

## Context

- Mobile live discovery and viewer watch flow are complete.
- Channel transport contract repair is complete; mobile receives opaque
  `LiveSession.channelTopic`.
- Backend media signaling is not yet defined. The mobile app has no contract for
  ICE servers, TURN configuration, SDP offer/answer, ICE candidates, publish
  endpoint, viewer playback endpoint, or recording handoff.
- `LC.Live.MediaSession.start_for_session/1` is still a backend seam, not a
  mobile-visible signaling contract.

## Progress

- [x] Task 1: Add the native development-build and WebRTC dependency boundary
- [x] Task 2: Add host preflight state and permission gating
- [x] Task 3: Add a mockable native media adapter boundary
- [x] Task 4: Add host session lifecycle state with media-contract gating
- [x] Task 5: Build the host preflight route and home entry point
- [ ] Task 6: Verify, close lane docs, and hand off backend media signaling

## Task 1: Native Development-Build And WebRTC Boundary

**Files**

- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Modify: `mobile/index.ts`

**Steps**

1. In `mobile/`, install Expo-native development dependencies:
   `pnpm exec expo install expo-dev-client expo-keep-awake`
2. In `mobile/`, install WebRTC dependencies:
   `pnpm add react-native-webrtc @config-plugins/react-native-webrtc`
3. Import `expo-dev-client` before `expo-router/entry` in `mobile/index.ts`.
4. Add `@config-plugins/react-native-webrtc` to `mobile/app.json` plugins.
5. Add explicit iOS camera and microphone usage descriptions.
6. Add Android `CAMERA` and `RECORD_AUDIO` permissions.
7. Preserve existing app metadata, icon, splash, scheme, web favicon, adaptive
   icon, and predictive-back settings.

**Verification**

Run in `mobile/`:

```bash
pnpm exec expo config --type public
./node_modules/.bin/tsc --noEmit
```

Task 1 is complete when both commands exit 0 and the public Expo config includes
the WebRTC plugin plus camera/microphone permission copy.

## Task 2: Host Preflight State And Permission Gating

**Files**

- Create: `mobile/src/host/hostBroadcastPreflight.test.ts`
- Create: `mobile/src/host/hostBroadcastPreflight.ts`

**Model**

Create a pure reducer/model for:

- camera permission: `unknown | granted | denied | blocked`
- microphone permission: `unknown | granted | denied | blocked`
- native media readiness
- backend media contract readiness

Expose helpers for:

- initial state creation
- reducer transitions
- `canCreateHostPreflightSession`
- `canGoLiveFromHostPreflight`
- blocker reporting with these reasons:
  `camera_permission`, `microphone_permission`, `native_media`,
  `backend_media_contract`

**Required Test Cases**

- session creation is blocked until camera, microphone, and native media are
  ready
- go-live remains blocked until backend media negotiation is available
- denied or blocked permissions remain user-actionable blockers

**Verification**

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastPreflight.test.ts
```

## Task 3: Native Media Adapter Boundary

**Files**

- Create: `mobile/src/host/hostBroadcastNative.test.ts`
- Create: `mobile/src/host/hostBroadcastNative.ts`

**Model**

Create a mockable native boundary with:

- `requestPermissions()`
- `preparePreview()`
- `dispose()`
- `normalizeHostBroadcastPermission(value)`
- `createUnavailableHostBroadcastNative()`

The unavailable fallback should never throw during preflight. It should return
unknown permissions and a `native_media_unavailable` preview result.

**Required Test Cases**

- permission normalization handles booleans and known string states
- unknown permission values normalize to `unknown`
- unavailable fallback returns safe defaults and disposable no-op behavior

**Verification**

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastNative.test.ts
```

## Task 4: Host Session Lifecycle State

**Files**

- Create: `mobile/src/host/hostBroadcastSession.test.ts`
- Create: `mobile/src/host/hostBroadcastSession.ts`

**Model**

Create a pure reducer for preflight session lifecycle:

- `idle`
- `creating`
- `starting`
- `ending`
- `ended`

Track `liveSessionId` and viewer-safe error text. Expose
`canRequestHostGoLive(state, backendMediaReady)` so go-live is impossible without
both a created live session and backend media readiness.

**Required Test Cases**

- start request moves to `creating`
- start success stores the Relay live-session ID and moves to `starting`
- start failure returns to `idle` with safe error text
- go-live remains blocked without backend media readiness
- end request and end success clear session state

**Verification**

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastSession.test.ts
```

## Task 5: Host Preflight Route And Home Entry Point

**Files**

- Create: `mobile/src/host/HostBroadcastPreflightScreen.tsx`
- Create: `mobile/app/(modals)/host-broadcast.tsx`
- Modify: `mobile/src/live/LiveDiscoveryScreen.tsx`

**Behavior**

- Add an Expo Router modal route for host broadcast preflight.
- Add a signed-in live discovery entry point labeled for hosting a live session.
- Render camera, microphone, native media, and media signaling readiness.
- Use the unavailable native adapter until real media preview work is safe.
- Show backend media signaling as pending.
- Keep the "Go live" action disabled unless
  `canGoLiveFromHostPreflight(state)` is true.
- Provide a back action.

**Verification**

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastNative.test.ts src/host/hostBroadcastSession.test.ts
./node_modules/.bin/tsc --noEmit
```

## Task 6: Verify And Close Mobile Handoff

**Files**

- Modify:
  `docs/plans/mobile/2026-06-02-host-broadcast-native-capability-preflight.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`

**Steps**

1. Run final focused mobile verification.
2. Run repository whitespace verification.
3. Mark completed tasks in this plan.
4. Update `docs/plans/mobile/NOW.md` to idle or to the next selected mobile
   batch.
5. Update `docs/plans/mobile/TRACK.md` so this plan is completed and the next
   dependency is clear.
6. Record that true media signaling is still blocked by backend contract work,
   unless that contract has been explicitly planned by then.

Do not edit `docs/plans/NOW.md` or `docs/plans/INDEX.md` during lane closure
unless the user assigns coordinator repair.

## Final Verification

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastNative.test.ts src/host/hostBroadcastSession.test.ts src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
pnpm exec expo config --type public
```

Then run at repository root:

```bash
git diff --check
```

If Relay Compiler fails only because Watchman cannot update state inside the
sandbox, rerun the same command outside the sandbox after approval.

## Backend Media Signaling Handoff

The next backend/media plan must define:

- ICE server and TURN configuration delivery
- SDP offer/answer exchange
- ICE candidate exchange
- whether signaling uses the existing live-session Phoenix Channel or a new
  media endpoint
- how backend negotiation marks a session `LIVE`
- viewer playback contract
- recording-to-`MediaAsset` handoff for ended sessions

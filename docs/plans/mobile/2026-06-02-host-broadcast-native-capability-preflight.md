# Host Broadcast Native Capability And Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile host-broadcast preflight foundation: select the native media boundary, add the WebRTC-capable Expo development-build setup, model camera/microphone readiness, and give hosts a safe preflight route before real media publish work begins.

**Architecture:** Keep durable live-session state Relay-first and keep ephemeral session events on Phoenix Channels. Use an Expo-led custom development build for native media modules, with `react-native-webrtc` as the client-side WebRTC boundary because backend architecture already points to Membrane/WebRTC media orchestration. Do not mark sessions live or publish media until a backend signaling/media contract exists.

**Tech Stack:** Expo SDK 55, Expo Router, React Native, TypeScript, Relay, Phoenix Channels contract docs, `react-native-webrtc`, `@config-plugins/react-native-webrtc`, Bun unit tests, Relay Compiler, `tsc`.

---

## Current State Verification

Verified before drafting this plan:

1. `docs/plans/mobile/NOW.md` says channel transport contract repair is complete and host broadcast native capability plus preflight planning is next.
2. `docs/plans/mobile/TRACK.md` lists host broadcast flow and native media integration as the next detailed plan after live discovery/watch and channel transport repair.
3. `ARCHITECTURE.md` says v1 live streaming uses Membrane/WebRTC inside the main Phoenix application runtime, with optional dedicated media pods only if later fanout or latency requires it.
4. `LC.Live.MediaSession.start_for_session/1` is a placeholder seam and `LC.RealtimeRuntime.SessionServer` can fail startup when media bootstrap fails, but there is no mobile-visible media signaling contract yet.
5. `docs/contracts/mobile-live-session-graphql.md` exposes Relay live-session lifecycle mutations and `LiveSession.channelTopic`, but it does not expose SDP offer/answer, ICE candidates, TURN configuration, or a publish endpoint.
6. `docs/contracts/mobile-live-session-realtime.md` documents Phoenix Channel state/timeline events, not media packets or WebRTC signaling.
7. `mobile/package.json` has Expo, Expo Router, Relay, auth, and secure storage dependencies but no native media, dev-client, camera/microphone, keep-awake, or WebRTC dependency.
8. `mobile/src/providers/AppProviders.tsx` already has a provider seam for future channel providers outside the router tree.
9. `mobile/src/live/LiveSessionWatchScreen.tsx` already requests `channelTopic`, joins/leaves by Relay mutations, and intentionally has no Phoenix socket or media layer.
10. `mobile/app/(app)/home.tsx` owns the signed-in home surface where the first host-broadcast entry point can be added.

## External Source Check

Use these primary docs during implementation:

- Expo development builds: `https://docs.expo.dev/develop/development-builds/use-development-builds/`
  - Native-code dependencies require rebuilding the development client.
- React Native WebRTC: `https://github.com/react-native-webrtc/react-native-webrtc`
  - The module supports audio/video on iOS and Android and documents Expo usage through `expo-dev-client` plus `@config-plugins/react-native-webrtc`.
- React Native WebRTC getting started: `https://react-native-webrtc.github.io/handbook/guides/intro/getting-started.html`
  - Install with `pnpm install react-native-webrtc` and follow platform-specific extra steps.
- LiveKit Expo quickstart: `https://docs.livekit.io/transport/sdk-platforms/expo/`
  - Useful only as a comparison point: it confirms an Expo WebRTC SDK path needs a dev client and config plugins, but adopting LiveKit would be a backend architecture change.

## Approach Comparison

### Recommended: Expo development build plus direct WebRTC boundary

Install a custom development-build setup and add `react-native-webrtc` behind a small mobile-owned adapter. This matches the current Membrane/WebRTC backend architecture, keeps Expo as the project shell, and lets mobile prove native camera/microphone capability before backend media signaling exists.

Tradeoff: Expo Go stops being enough for host-broadcast work. Executors will need a development build after native dependency changes.

### Alternative: LiveKit client SDK

LiveKit has a React Native and Expo path, but it requires a LiveKit server/token contract. That would replace or wrap the current Membrane/WebRTC architecture and needs backend planning first.

Tradeoff: faster media-product surface if backend also adopts LiveKit, but too broad for this mobile lane batch.

### Alternative: RTMP/ingest publisher SDK

An RTMP-style mobile publisher could support one-way broadcast, but the backend architecture currently names WebRTC and the live session lifecycle expects low-latency negotiation before the session becomes `LIVE`.

Tradeoff: potentially simpler broadcast ingestion, but it diverges from the v1 architecture and would need new backend infrastructure.

## Scope Decisions

- Add the native dependency/build boundary for a WebRTC-capable Expo development build.
- Add explicit camera and microphone permission copy in app config.
- Add a host-broadcast feature folder under `mobile/src/host/`.
- Add pure state-machine coverage for permissions, native readiness, preflight session state, and backend-media-contract gating.
- Add a host preflight route and home entry point.
- Allow the host preflight UI to prepare and validate local native capability.
- Do not publish media, exchange SDP/ICE, or call `goLiveSession` in this batch.
- Do not decode Relay IDs client-side.
- Do not edit backend Elixir, GraphQL schema, Phoenix Channel code, shared contract docs, `docs/plans/NOW.md`, or `docs/plans/INDEX.md` from this mobile lane batch unless explicitly reassigned.
- If implementation discovers that a backend media signaling contract already exists, verify it from code before enabling `goLiveSession`; otherwise keep go-live unavailable and document the backend handoff.

## Backend Contract Gaps To Preserve

This plan intentionally stops before real publishing because the current backend/mobile contract does not yet define:

- how a mobile host receives ICE server/TURN configuration
- how the mobile host sends WebRTC offers, answers, or ICE candidates
- whether media signaling flows through the existing live-session Phoenix Channel or a separate media endpoint
- how backend Membrane/WebRTC media negotiation marks a session `LIVE`
- what viewer playback endpoint or subscription contract consumes the host stream
- how recording output becomes a durable `MediaAsset` suitable for `endLiveSession(recordingMediaAssetId:)`

The next backend/media-signaling plan should resolve those before mobile enables a real "Go live" action.

## File Structure

- `mobile/package.json`: add native media/development-build dependencies and preserve existing scripts.
- `mobile/pnpm-lock.yaml`: update from the dependency install.
- `mobile/app.json`: add WebRTC config plugin plus explicit camera/microphone permission text.
- `mobile/index.ts`: import `expo-dev-client` before `expo-router/entry`.
- `mobile/src/host/hostBroadcastPreflight.ts`: pure permission, device, and go-live gate model.
- `mobile/src/host/hostBroadcastPreflight.test.ts`: Bun coverage for the preflight model.
- `mobile/src/host/hostBroadcastNative.ts`: mockable native media adapter boundary and unavailable fallback.
- `mobile/src/host/hostBroadcastNative.test.ts`: Bun coverage for fallback behavior and result normalization.
- `mobile/src/host/hostBroadcastSession.ts`: pure reducer for Relay session creation/end cleanup and media-contract gating.
- `mobile/src/host/hostBroadcastSession.test.ts`: Bun coverage for lifecycle state.
- `mobile/src/host/HostBroadcastPreflightScreen.tsx`: Expo Router screen for host preflight UI.
- `mobile/app/(modals)/host-broadcast.tsx`: modal route that renders the preflight screen.
- `mobile/src/live/LiveDiscoveryScreen.tsx`: add the signed-in home entry point for hosting.
- `docs/plans/mobile/NOW.md`: track the active task and close the plan after implementation.
- `docs/plans/mobile/TRACK.md`: mark this detailed plan active/completed as the lane advances.

## Progress

- [ ] Task 1: Add the native development-build and WebRTC dependency boundary
- [ ] Task 2: Add host preflight state and permission gating
- [ ] Task 3: Add a mockable native media adapter boundary
- [ ] Task 4: Add host session lifecycle state with media-contract gating
- [ ] Task 5: Build the host preflight route and home entry point
- [ ] Task 6: Verify, close docs, and hand off backend media signaling

### Task 1: Add The Native Development-Build And WebRTC Dependency Boundary

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Modify: `mobile/app.json`
- Modify: `mobile/index.ts`

- [ ] **Step 1: Install native/development dependencies**

Run:

```bash
cd mobile
pnpm exec expo install expo-dev-client expo-keep-awake
pnpm add react-native-webrtc @config-plugins/react-native-webrtc
```

Expected: `mobile/package.json` includes `expo-dev-client`, `expo-keep-awake`, `react-native-webrtc`, and `@config-plugins/react-native-webrtc`; `mobile/pnpm-lock.yaml` is updated.

- [ ] **Step 2: Register development-build error context**

Change `mobile/index.ts` to:

```ts
import 'expo-dev-client';
import 'expo-router/entry';
```

- [ ] **Step 3: Configure native permissions and WebRTC plugin**

Modify `mobile/app.json` so the Expo config includes the WebRTC plugin and explicit camera/microphone permission copy:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-apple-authentication",
      "@config-plugins/react-native-webrtc"
    ],
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "Allow LiveCanvas Mobile to access your camera so you can host live sessions.",
        "NSMicrophoneUsageDescription": "Allow LiveCanvas Mobile to access your microphone so viewers can hear your live session."
      }
    },
    "android": {
      "permissions": ["CAMERA", "RECORD_AUDIO"],
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    }
  }
}
```

Preserve all existing app metadata, icon, splash, scheme, and web favicon fields.

- [ ] **Step 4: Verify Expo config and TypeScript**

Run:

```bash
cd mobile
pnpm exec expo config --type public
./node_modules/.bin/tsc --noEmit
```

Expected: both commands exit 0. The Expo config output includes the added permissions and plugin.

- [ ] **Step 5: Commit Task 1**

```bash
git add mobile/package.json mobile/pnpm-lock.yaml mobile/app.json mobile/index.ts
git commit -m "chore(mobile): add host broadcast native boundary"
```

### Task 2: Add Host Preflight State And Permission Gating

**Files:**
- Create: `mobile/src/host/hostBroadcastPreflight.test.ts`
- Create: `mobile/src/host/hostBroadcastPreflight.ts`

- [ ] **Step 1: Write failing preflight model tests**

Create `mobile/src/host/hostBroadcastPreflight.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightReducer,
  readHostPreflightBlockingReasons,
} from './hostBroadcastPreflight';

describe('hostBroadcastPreflight', () => {
  test('blocks session creation until camera, microphone, and native media are ready', () => {
    const initial = createHostBroadcastPreflightState();

    expect(canCreateHostPreflightSession(initial)).toBe(false);
    expect(readHostPreflightBlockingReasons(initial)).toEqual([
      'camera_permission',
      'microphone_permission',
      'native_media',
    ]);

    const ready = hostBroadcastPreflightReducer(initial, {
      type: 'permissions_resolved',
      camera: 'granted',
      microphone: 'granted',
    });

    const nativeReady = hostBroadcastPreflightReducer(ready, {
      type: 'native_media_ready',
    });

    expect(canCreateHostPreflightSession(nativeReady)).toBe(true);
    expect(readHostPreflightBlockingReasons(nativeReady)).toEqual([
      'backend_media_contract',
    ]);
  });

  test('keeps go-live blocked until backend media negotiation is available', () => {
    const ready = hostBroadcastPreflightReducer(
      hostBroadcastPreflightReducer(createHostBroadcastPreflightState(), {
        type: 'permissions_resolved',
        camera: 'granted',
        microphone: 'granted',
      }),
      { type: 'native_media_ready' },
    );

    expect(canCreateHostPreflightSession(ready)).toBe(true);
    expect(canGoLiveFromHostPreflight(ready)).toBe(false);

    const contractReady = hostBroadcastPreflightReducer(ready, {
      type: 'media_contract_ready',
    });

    expect(canGoLiveFromHostPreflight(contractReady)).toBe(true);
  });

  test('treats denied permissions as user-actionable blockers', () => {
    const denied = hostBroadcastPreflightReducer(
      createHostBroadcastPreflightState(),
      {
        type: 'permissions_resolved',
        camera: 'denied',
        microphone: 'blocked',
      },
    );

    expect(canCreateHostPreflightSession(denied)).toBe(false);
    expect(readHostPreflightBlockingReasons(denied)).toEqual([
      'camera_permission',
      'microphone_permission',
      'native_media',
    ]);
  });
});
```

- [ ] **Step 2: Run preflight tests and verify RED**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastPreflight.test.ts
```

Expected: FAIL because `src/host/hostBroadcastPreflight.ts` does not exist.

- [ ] **Step 3: Implement preflight model**

Create `mobile/src/host/hostBroadcastPreflight.ts`:

```ts
export type HostBroadcastPermissionState =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked';

export type HostBroadcastPreflightBlockingReason =
  | 'camera_permission'
  | 'microphone_permission'
  | 'native_media'
  | 'backend_media_contract';

export type HostBroadcastPreflightState = {
  readonly cameraPermission: HostBroadcastPermissionState;
  readonly microphonePermission: HostBroadcastPermissionState;
  readonly nativeMediaReady: boolean;
  readonly mediaContractReady: boolean;
};

export type HostBroadcastPreflightAction =
  | {
      readonly type: 'permissions_resolved';
      readonly camera: HostBroadcastPermissionState;
      readonly microphone: HostBroadcastPermissionState;
    }
  | { readonly type: 'native_media_ready' }
  | { readonly type: 'native_media_unavailable' }
  | { readonly type: 'media_contract_ready' }
  | { readonly type: 'media_contract_unavailable' };

export function createHostBroadcastPreflightState(): HostBroadcastPreflightState {
  return {
    cameraPermission: 'unknown',
    microphonePermission: 'unknown',
    nativeMediaReady: false,
    mediaContractReady: false,
  };
}

export function hostBroadcastPreflightReducer(
  state: HostBroadcastPreflightState,
  action: HostBroadcastPreflightAction,
): HostBroadcastPreflightState {
  switch (action.type) {
    case 'permissions_resolved':
      return {
        ...state,
        cameraPermission: action.camera,
        microphonePermission: action.microphone,
      };
    case 'native_media_ready':
      return { ...state, nativeMediaReady: true };
    case 'native_media_unavailable':
      return { ...state, nativeMediaReady: false };
    case 'media_contract_ready':
      return { ...state, mediaContractReady: true };
    case 'media_contract_unavailable':
      return { ...state, mediaContractReady: false };
  }
}

export function canCreateHostPreflightSession(
  state: HostBroadcastPreflightState,
): boolean {
  return (
    state.cameraPermission === 'granted' &&
    state.microphonePermission === 'granted' &&
    state.nativeMediaReady
  );
}

export function canGoLiveFromHostPreflight(
  state: HostBroadcastPreflightState,
): boolean {
  return canCreateHostPreflightSession(state) && state.mediaContractReady;
}

export function readHostPreflightBlockingReasons(
  state: HostBroadcastPreflightState,
): ReadonlyArray<HostBroadcastPreflightBlockingReason> {
  const reasons: HostBroadcastPreflightBlockingReason[] = [];

  if (state.cameraPermission !== 'granted') {
    reasons.push('camera_permission');
  }

  if (state.microphonePermission !== 'granted') {
    reasons.push('microphone_permission');
  }

  if (!state.nativeMediaReady) {
    reasons.push('native_media');
  }

  if (
    state.cameraPermission === 'granted' &&
    state.microphonePermission === 'granted' &&
    state.nativeMediaReady &&
    !state.mediaContractReady
  ) {
    reasons.push('backend_media_contract');
  }

  return reasons;
}
```

- [ ] **Step 4: Re-run preflight tests**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastPreflight.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add mobile/src/host/hostBroadcastPreflight.ts mobile/src/host/hostBroadcastPreflight.test.ts
git commit -m "feat(mobile): model host broadcast preflight readiness"
```

### Task 3: Add A Mockable Native Media Adapter Boundary

**Files:**
- Create: `mobile/src/host/hostBroadcastNative.test.ts`
- Create: `mobile/src/host/hostBroadcastNative.ts`

- [ ] **Step 1: Write failing native adapter tests**

Create `mobile/src/host/hostBroadcastNative.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  createUnavailableHostBroadcastNative,
  normalizeHostBroadcastPermission,
} from './hostBroadcastNative';

describe('hostBroadcastNative', () => {
  test('normalizes native permission values into preflight states', () => {
    expect(normalizeHostBroadcastPermission(true)).toBe('granted');
    expect(normalizeHostBroadcastPermission(false)).toBe('denied');
    expect(normalizeHostBroadcastPermission('granted')).toBe('granted');
    expect(normalizeHostBroadcastPermission('denied')).toBe('denied');
    expect(normalizeHostBroadcastPermission('blocked')).toBe('blocked');
    expect(normalizeHostBroadcastPermission('future')).toBe('unknown');
    expect(normalizeHostBroadcastPermission(null)).toBe('unknown');
  });

  test('unavailable fallback reports missing native media without throwing', async () => {
    const native = createUnavailableHostBroadcastNative();

    await expect(native.requestPermissions()).resolves.toEqual({
      camera: 'unknown',
      microphone: 'unknown',
    });
    await expect(native.preparePreview()).resolves.toEqual({
      ok: false,
      reason: 'native_media_unavailable',
    });
    await expect(native.dispose()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run adapter tests and verify RED**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastNative.test.ts
```

Expected: FAIL because `src/host/hostBroadcastNative.ts` does not exist.

- [ ] **Step 3: Implement the adapter contract and unavailable fallback**

Create `mobile/src/host/hostBroadcastNative.ts`:

```ts
import type { HostBroadcastPermissionState } from './hostBroadcastPreflight';

export type HostBroadcastPermissionResult = {
  readonly camera: HostBroadcastPermissionState;
  readonly microphone: HostBroadcastPermissionState;
};

export type HostBroadcastPreviewResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'native_media_unavailable'
        | 'permission_denied'
        | 'preview_failed';
    };

export type HostBroadcastNative = {
  readonly requestPermissions: () => Promise<HostBroadcastPermissionResult>;
  readonly preparePreview: () => Promise<HostBroadcastPreviewResult>;
  readonly dispose: () => Promise<void>;
};

export function normalizeHostBroadcastPermission(
  value: unknown,
): HostBroadcastPermissionState {
  if (value === true || value === 'granted') {
    return 'granted';
  }

  if (value === false || value === 'denied') {
    return 'denied';
  }

  if (value === 'blocked') {
    return 'blocked';
  }

  return 'unknown';
}

export function createUnavailableHostBroadcastNative(): HostBroadcastNative {
  return {
    async requestPermissions() {
      return {
        camera: 'unknown',
        microphone: 'unknown',
      };
    },
    async preparePreview() {
      return {
        ok: false,
        reason: 'native_media_unavailable',
      };
    },
    async dispose() {},
  };
}
```

- [ ] **Step 4: Re-run adapter tests**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastNative.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add mobile/src/host/hostBroadcastNative.ts mobile/src/host/hostBroadcastNative.test.ts
git commit -m "feat(mobile): add host broadcast native adapter seam"
```

### Task 4: Add Host Session Lifecycle State With Media-Contract Gating

**Files:**
- Create: `mobile/src/host/hostBroadcastSession.test.ts`
- Create: `mobile/src/host/hostBroadcastSession.ts`

- [ ] **Step 1: Write failing host session state tests**

Create `mobile/src/host/hostBroadcastSession.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  canRequestHostGoLive,
  createHostBroadcastSessionState,
  hostBroadcastSessionReducer,
} from './hostBroadcastSession';

describe('hostBroadcastSession', () => {
  test('tracks preflight session creation lifecycle', () => {
    const creating = hostBroadcastSessionReducer(
      createHostBroadcastSessionState(),
      { type: 'start_requested' },
    );

    expect(creating).toEqual({
      error: null,
      liveSessionId: null,
      status: 'creating',
    });

    const created = hostBroadcastSessionReducer(creating, {
      type: 'start_succeeded',
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
    });

    expect(created).toEqual({
      error: null,
      liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      status: 'starting',
    });
  });

  test('does not allow go-live without backend media readiness', () => {
    const created = hostBroadcastSessionReducer(
      createHostBroadcastSessionState(),
      {
        type: 'start_succeeded',
        liveSessionId: 'TGl2ZVNlc3Npb246MQ==',
      },
    );

    expect(canRequestHostGoLive(created, false)).toBe(false);
    expect(canRequestHostGoLive(created, true)).toBe(true);
  });

  test('stores viewer-safe lifecycle errors', () => {
    const failed = hostBroadcastSessionReducer(
      createHostBroadcastSessionState(),
      {
        type: 'start_failed',
        error: 'Sign in again to host a live session.',
      },
    );

    expect(failed).toEqual({
      error: 'Sign in again to host a live session.',
      liveSessionId: null,
      status: 'idle',
    });
  });
});
```

- [ ] **Step 2: Run host session tests and verify RED**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastSession.test.ts
```

Expected: FAIL because `src/host/hostBroadcastSession.ts` does not exist.

- [ ] **Step 3: Implement host session state**

Create `mobile/src/host/hostBroadcastSession.ts`:

```ts
export type HostBroadcastSessionStatus =
  | 'idle'
  | 'creating'
  | 'starting'
  | 'ending'
  | 'ended';

export type HostBroadcastSessionState = {
  readonly error: string | null;
  readonly liveSessionId: string | null;
  readonly status: HostBroadcastSessionStatus;
};

export type HostBroadcastSessionAction =
  | { readonly type: 'start_requested' }
  | { readonly type: 'start_succeeded'; readonly liveSessionId: string }
  | { readonly type: 'start_failed'; readonly error: string }
  | { readonly type: 'end_requested' }
  | { readonly type: 'end_succeeded' }
  | { readonly type: 'end_failed'; readonly error: string };

export function createHostBroadcastSessionState(): HostBroadcastSessionState {
  return {
    error: null,
    liveSessionId: null,
    status: 'idle',
  };
}

export function hostBroadcastSessionReducer(
  state: HostBroadcastSessionState,
  action: HostBroadcastSessionAction,
): HostBroadcastSessionState {
  switch (action.type) {
    case 'start_requested':
      return { ...state, error: null, status: 'creating' };
    case 'start_succeeded':
      return {
        error: null,
        liveSessionId: action.liveSessionId,
        status: 'starting',
      };
    case 'start_failed':
      return { error: action.error, liveSessionId: null, status: 'idle' };
    case 'end_requested':
      return { ...state, error: null, status: 'ending' };
    case 'end_succeeded':
      return { error: null, liveSessionId: null, status: 'ended' };
    case 'end_failed':
      return { ...state, error: action.error, status: 'starting' };
  }
}

export function canRequestHostGoLive(
  state: HostBroadcastSessionState,
  backendMediaReady: boolean,
): boolean {
  return state.status === 'starting' && Boolean(state.liveSessionId) && backendMediaReady;
}
```

- [ ] **Step 4: Re-run host session tests**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastSession.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add mobile/src/host/hostBroadcastSession.ts mobile/src/host/hostBroadcastSession.test.ts
git commit -m "feat(mobile): gate host broadcast session lifecycle"
```

### Task 5: Build The Host Preflight Route And Home Entry Point

**Files:**
- Create: `mobile/src/host/HostBroadcastPreflightScreen.tsx`
- Create: `mobile/app/(modals)/host-broadcast.tsx`
- Modify: `mobile/src/live/LiveDiscoveryScreen.tsx`

- [ ] **Step 1: Add the modal route**

Create `mobile/app/(modals)/host-broadcast.tsx`:

```tsx
import { HostBroadcastPreflightScreen } from '../../src/host/HostBroadcastPreflightScreen';

export default function HostBroadcastModal() {
  return <HostBroadcastPreflightScreen />;
}
```

- [ ] **Step 2: Add the preflight screen**

Create `mobile/src/host/HostBroadcastPreflightScreen.tsx` with a screen that:

- requests permissions through `createUnavailableHostBroadcastNative()` for now
- shows camera, microphone, and native media readiness
- shows that backend media signaling is still required before real go-live
- exposes a disabled "Go live" action until `canGoLiveFromHostPreflight(state)` returns true
- provides a back action through `useRouter().back()`

Minimum implementation shape:

```tsx
import { useEffect, useReducer } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { useAppTheme } from '../providers/ThemeProvider';
import { spacing, typography } from '../theme/tokens';
import { createUnavailableHostBroadcastNative } from './hostBroadcastNative';
import {
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightReducer,
  readHostPreflightBlockingReasons,
} from './hostBroadcastPreflight';

const nativeBroadcast = createUnavailableHostBroadcastNative();

export function HostBroadcastPreflightScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [state, dispatch] = useReducer(
    hostBroadcastPreflightReducer,
    createHostBroadcastPreflightState(),
  );

  useEffect(() => {
    let cancelled = false;

    void nativeBroadcast.requestPermissions().then((permissions) => {
      if (cancelled) return;

      dispatch({
        type: 'permissions_resolved',
        camera: permissions.camera,
        microphone: permissions.microphone,
      });
    });

    void nativeBroadcast.preparePreview().then((result) => {
      if (cancelled) return;

      dispatch({
        type: result.ok ? 'native_media_ready' : 'native_media_unavailable',
      });
      dispatch({ type: 'media_contract_unavailable' });
    });

    return () => {
      cancelled = true;
      void nativeBroadcast.dispose();
    };
  }, []);

  const blockers = readHostPreflightBlockingReasons(state);
  const canGoLive = canGoLiveFromHostPreflight(state);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Host"
        title="Broadcast preflight"
        subtitle="Check local device readiness before the media signaling contract is enabled."
      />
      <AppCard>
        <View style={styles.stack}>
          <StatusRow label="Camera" value={state.cameraPermission} />
          <StatusRow label="Microphone" value={state.microphonePermission} />
          <StatusRow
            label="Native media"
            value={state.nativeMediaReady ? 'ready' : 'unavailable'}
          />
          <StatusRow
            label="Media signaling"
            value={state.mediaContractReady ? 'ready' : 'pending backend contract'}
          />
        </View>
      </AppCard>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>
        {blockers.length > 0
          ? `Blocked by: ${blockers.join(', ')}.`
          : 'Preflight checks are ready.'}
      </Text>
      <AppButton disabled={!canGoLive} label="Go live" onPress={() => {}} />
      <AppButton label="Back" onPress={() => router.back()} variant="secondary" />
    </ScrollView>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={styles.statusRow}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  stack: {
    gap: spacing.sm,
  },
  statusRow: {
    gap: spacing.xs,
  },
  label: typography.label,
  body: typography.body,
});
```

Executors may refine copy and layout, but must keep the go-live action disabled while backend media signaling is unavailable.

- [ ] **Step 3: Add home entry point**

In `mobile/src/live/LiveDiscoveryScreen.tsx`, add a host action above the profile button:

```tsx
function openHostBroadcast() {
  router.push('/host-broadcast');
}
```

Then render:

```tsx
<AppButton
  label="Host a live session"
  onPress={openHostBroadcast}
  style={styles.profileAction}
/>
```

Keep the existing "Open profile" action as a secondary button.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastNative.test.ts src/host/hostBroadcastSession.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit Task 5**

```bash
git add mobile/app/'(modals)'/host-broadcast.tsx mobile/src/host/HostBroadcastPreflightScreen.tsx mobile/src/live/LiveDiscoveryScreen.tsx
git commit -m "feat(mobile): add host broadcast preflight entry"
```

### Task 6: Verify, Close Docs, And Hand Off Backend Media Signaling

**Files:**
- Modify: `docs/plans/mobile/2026-06-02-host-broadcast-native-capability-preflight.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`

- [ ] **Step 1: Run full focused mobile verification**

Run:

```bash
cd mobile
bun test src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastNative.test.ts src/host/hostBroadcastSession.test.ts src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
pnpm exec expo config --type public
```

Expected: all commands exit 0. If Relay Compiler fails only because Watchman cannot update state inside the sandbox, rerun it with the same command outside the sandbox after approval.

- [ ] **Step 2: Run repository whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Update this plan progress**

Mark all completed tasks in this plan as checked. Add a short note under this task with:

- verification commands run
- whether native development-build commands were run locally or only config/typecheck was verified
- whether true media signaling is still blocked by backend contract work

- [ ] **Step 4: Close mobile lane docs**

Update `docs/plans/mobile/NOW.md`:

- status: `host broadcast native capability/preflight complete; backend media signaling handoff is next`
- source: none active
- batch: none
- next up: create backend/media signaling contract plan before enabling mobile go-live or viewer playback

Update `docs/plans/mobile/TRACK.md`:

- add this plan to completed detailed plans
- set current detailed plan to none
- set next lane batch to backend/media signaling contract planning or mobile chat only if backend media signaling is explicitly deferred by the coordinator

Do not edit `docs/plans/NOW.md` or `docs/plans/INDEX.md` from this lane closure unless the user explicitly assigns coordinator repair.

- [ ] **Step 5: Commit Task 6**

```bash
git add docs/plans/mobile/2026-06-02-host-broadcast-native-capability-preflight.md docs/plans/mobile/NOW.md docs/plans/mobile/TRACK.md
git commit -m "docs(mobile): close host broadcast preflight batch"
```

## Final Verification Command Set

Run before handing off or opening review:

```bash
cd mobile
bun test src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastNative.test.ts src/host/hostBroadcastSession.test.ts src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
pnpm exec expo config --type public
cd ..
git diff --check
```

## Execution Handoff

Use subagent-driven development for implementation. Dispatch Task 1 first because all later host media work depends on the native dependency boundary. Keep later workers in disjoint scopes:

- Task 2 and Task 4 can be implemented independently after Task 1 because both are pure TypeScript state files.
- Task 3 depends on Task 1 for dependency context but can be implemented independently from UI.
- Task 5 depends on Tasks 2-4.
- Task 6 must run after all implementation tasks.

All subagents for this track should use `gpt-5.5` with `xhigh` reasoning when explicitly dispatched.

# Host In-Session Controls Implementation Plan

> **For agentic workers:** Use this only after it is promoted from
> `docs/plans/mobile/NOW.md`. Keep implementation mobile-owned.

**Goal:** Let a host control microphone and camera publishing state after a
session is live.

**Architecture:** Keep media-track mutation inside the host publishing boundary
instead of the watch screen. The watch screen should only read retained host
publishing controls for the active live session and dispatch explicit
audio/video enablement requests. Do not add camera switching in this slice; the
native media boundary does not expose alternate camera selection yet.

**Tech Stack:** Expo React Native, `react-native-webrtc`, Relay, existing host
publishing session store, Bun tests.

---

## Executor Brief

The app can retain host publishing resources after go-live, but the live screen
has no host controls beyond ending the session. Add host-owned mute/unmute and
camera on/off controls for the retained publishing resource. Keep the beta
one-host/one-viewer assumption and do not change backend GraphQL or media
signaling contracts.

## Context

- Host media tracks are created by
  `mobile/src/host/hostBroadcastNative.ts`.
- Publishing resources are retained by
  `mobile/src/host/publishing/hostBroadcastPublishingSessionStore.ts`.
- The host reaches the live screen through
  `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`.
- Host-owned live controls render in
  `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`.
- Tests live under `mobile/tests/**`.

## Tasks

### Task 1: Add local media control helpers

**Files:**
- Create: `mobile/src/host/publishing/hostBroadcastLocalMediaControls.ts`
- Test: `mobile/tests/host/hostBroadcastLocalMediaControls.test.ts`

Acceptance criteria:
- Audio and video tracks are discovered from `track.kind`.
- `setAudioEnabled(false)` disables all audio tracks without touching video.
- `setVideoEnabled(false)` disables all video tracks without touching audio.
- Missing audio or video tracks report unavailable state instead of throwing.
- Stopped or malformed tracks are ignored safely.

Implementation notes:
- Define a minimal track type locally:
  `kind?: string | null`, `enabled?: boolean`, and optional `readyState`.
- Return a snapshot with `audio.available`, `audio.enabled`,
  `video.available`, and `video.enabled`.
- Treat a group as enabled only when every available track in that group has
  `enabled !== false`.

Focused verification:
- From `mobile/`:
  `bun test tests/host/hostBroadcastLocalMediaControls.test.ts`

### Task 2: Retain controls with host publishing resources

**Files:**
- Modify:
  `mobile/src/host/publishing/hostBroadcastPublishingSessionStore.ts`
- Modify:
  `mobile/tests/host/hostBroadcastPublishingSession.test.ts`

Acceptance criteria:
- `HostBroadcastPublishingResource` can carry optional
  `localMediaControls`.
- The session store exposes `controlsFor(liveSessionId)` and returns null when
  no current retained resource exists.
- Replacing or releasing a resource invalidates access to stale controls.
- Disposal behavior remains unchanged: release still disposes runtime and
  disconnects the socket exactly once.

Implementation notes:
- Do not make controls required; existing tests can keep simple resources.
- Keep the store as the single lookup point so the watch screen does not hold
  raw publishing resources.

Focused verification:
- From `mobile/`:
  `bun test tests/host/hostBroadcastPublishingSession.test.ts`

### Task 3: Attach controls when host publishing starts

**Files:**
- Modify:
  `mobile/src/host/preflight/hooks/useHostBroadcastPublishingController.ts`
- Modify:
  `mobile/tests/host/useHostBroadcastPublishingController.test.ts`

Acceptance criteria:
- When publishing starts with a local stream, the retained resource includes
  controls created from that same local stream.
- If controls cannot be created, publishing still starts and the live screen
  simply hides the toggles.
- Cleanup paths keep their current behavior for failed start, auth loss,
  channel close, and host end.

Implementation notes:
- Build controls once per local stream with
  `createHostBroadcastLocalMediaControls(localStream)`.
- Attach controls to the `HostBroadcastPublishingResource` passed into the
  preflight controller.

Focused verification:
- From `mobile/`:
  `bun test tests/host/useHostBroadcastPublishingController.test.ts`

### Task 4: Render host controls on the live screen

**Files:**
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify:
  `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`
- Test: `mobile/tests/live/liveSessionWatchHostControls.test.ts`

Acceptance criteria:
- Host-owned sessions with retained publishing controls show microphone and
  camera toggle buttons.
- Viewer sessions never show host publishing controls.
- Ended sessions never show host publishing controls.
- Toggle labels reflect the current state: `Mute mic`, `Unmute mic`,
  `Turn camera off`, `Turn camera on`.
- Toggling updates local media track state immediately and keeps the live
  session active.

Implementation notes:
- Add a small props object to `LiveSessionWatchControlsCard` rather than
  letting the card read the host publishing store directly.
- Keep UI state derived from the control snapshot after each toggle.
- If only one media type is available, show only that control.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionWatchHostControls.test.ts`

## Final Verification

From `mobile/`:

- `bun test tests/host/hostBroadcastLocalMediaControls.test.ts`
- `bun test tests/host/hostBroadcastPublishingSession.test.ts`
- `bun test tests/host/useHostBroadcastPublishingController.test.ts`
- `bun test tests/live/liveSessionWatchHostControls.test.ts`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Handoff

After this lands, camera switching can be planned as a separate native-boundary
slice. Do not fold camera switching into this plan.

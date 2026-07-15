# Mobile Release Depth: Next Five Batches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver host preview, live audience state, app-lifecycle recovery,
actual content media, and a dedicated story viewer as five independently
reviewable mobile milestones.

**Architecture:** Extend the existing host-native, live-channel, playback, and
content-card boundaries rather than adding parallel state owners. Batch 5 builds
on the shared media surface from Batch 4; all other batches are independently
testable.

**Tech Stack:** Expo SDK 55, React Native 0.83, React 19, Relay, Phoenix
Channels, XState, react-native-webrtc, expo-image, expo-video, pnpm, Vitest,
Jest/RNTL.

## Global Constraints

- Use existing Relay and Phoenix Channel contracts; do not decode global IDs or
  construct server topics in mobile code.
- Keep native imports behind adapters and keep tests in `mobile/tests/**`.
- Preserve host publishing ownership across navigation and app-state changes.
- Record local verification only; do not mark device QA complete.

---

### Task 1: Host Local Preview

**Files:**
- Modify: `mobile/src/host/hostBroadcastNative.ts`
- Modify: `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
- Modify: `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`
- Modify: `mobile/src/host/preflight/hostBroadcastPreflightScreenStyles.ts`
- Create: `mobile/src/host/preflight/components/HostPreviewCard.tsx`
- Test: `mobile/tests/host/hostBroadcastNative.test.ts`
- Test: `mobile/tests/host/useHostBroadcastPreflightController.test.ts`
- Test: `mobile/tests/host/HostPreviewCard.rntl.tsx`

**Interfaces:** `HostBroadcastMediaStream.toURL?(): string` feeds a nullable
`previewStreamUrl` controller result; `HostPreviewCard` receives only that URL
and readiness state.

- [x] Add a failing native/controller test proving the cached preview stream
  supplies one URL without a second `getUserMedia` call.
- [x] Add a failing RNTL test for ready and unavailable preview presentation.
- [x] Implement the stream URL/controller/card path with stale async result and
  cleanup guards.
- [x] Run `pnpm exec vitest run tests/host/hostBroadcastNative.test.ts tests/host/useHostBroadcastPreflightController.test.ts` and `pnpm exec jest --config ./jest.config.js --runInBand tests/host/HostPreviewCard.rntl.tsx`.
- [x] Commit `feat: show host camera preview`.

### Task 2: Live Audience Count

**Files:**
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`
- Test: `mobile/tests/live/LiveSessionWatchScreen.rntl.tsx`
- Test: `mobile/tests/live/liveSessionRealtimeEvents.test.ts`

**Interfaces:** The existing `LiveSessionRealtimeSessionStateEvent.viewerCount`
becomes a session-scoped `number | null` passed to `LiveSessionHero`.

- [x] Add failing screen tests for zero, singular, plural, reset, and stale
  channel callbacks.
- [x] Implement audience state without changing the backend/channel payload.
- [x] Run the focused realtime parser and watch-screen suites.
- [x] Commit `feat: show live audience count`.

### Task 3: Foreground And Background Recovery

**Files:**
- Create: `mobile/src/live/watch/liveSessionAppState.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Test: `mobile/tests/live/liveSessionAppState.test.ts`
- Test: `mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts`
- Test: `mobile/tests/live/LiveSessionWatchScreen.rntl.tsx`

**Interfaces:** A lifecycle hook returns `isActive` and a monotonically
increasing `resumeGeneration`. Playback sync accepts `isAppActive`; the watch
channel effect depends on the same state.

- [x] Add failing lifecycle tests for active-to-background-to-active and
  duplicate/noisy AppState events.
- [x] Add failing playback/channel tests proving suspension disposes transient
  resources, resume starts one fresh generation, and no join/leave mutation is
  issued.
- [x] Implement app-state gating, pending-send cancellation, network-only
  refetch on resume, and generation-safe playback restart.
- [x] Run all focused live watch, playback, chat lifecycle, and app-state tests.
- [x] Commit `feat: recover live sessions after app resume`.

### Task 4: Post And Story Media Rendering

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Create: `mobile/src/content/ContentMediaAssetView.tsx`
- Modify: `mobile/src/content/ContentPostCard.tsx`
- Test: `mobile/tests/content/ContentMediaAssetView.rntl.tsx`
- Test: `mobile/tests/content/ContentPostCard.rntl.tsx`

**Interfaces:** `ContentMediaAssetPresentation` remains the validated input.
The view selects image, video, or status fallback and never accepts an
unnormalized URL.

- [x] Add failing component tests for processed image/video and every fallback
  state.
- [x] Install the Expo SDK 55-compatible image and video packages through
  `expo install`.
- [x] Implement image/video rendering, accessibility labels, native controls,
  and load-error fallback.
- [x] Run focused content tests plus `pnpm typecheck` and frozen installation.
- [x] Commit `feat: render post and story media`.

### Task 5: Dedicated Story Viewer

**Files:**
- Create: `mobile/app/(app)/stories/[id].tsx`
- Create: `mobile/src/content/story/StoryViewerScreen.tsx`
- Create: `mobile/src/content/story/storyViewerOperations.ts`
- Create: `mobile/src/content/story/storyViewerState.ts`
- Modify: `mobile/src/content/ContentPostCard.tsx`
- Modify: `mobile/src/content/ContentSection.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/src/profile/ProfileContentPreviewSection.tsx`
- Modify: `mobile/src/profile/ProfileContentListScreen.tsx`
- Test: `mobile/tests/content/storyViewerState.test.ts`
- Test: `mobile/tests/content/StoryViewerScreen.rntl.tsx`
- Test: affected feed/profile component suites

**Interfaces:** `storyViewerOperationsQuery(id:)` returns the selected Post and
the author's active `storyFeed`; state selects the initial opaque ID and exposes
previous/next/progress without persisting seen state.

- [x] Add failing pure tests for selected-ID lookup, previous/next boundaries,
  expiry, and replacement data.
- [x] Add failing RNTL tests for loading, unavailable, first/middle/last story,
  close, and media presentation.
- [x] Implement the Relay route and wire story-card entry from feed and profile
  surfaces without changing normal post cards.
- [x] Run Relay generation and all focused story/feed/profile tests.
- [x] Commit `feat: add dedicated story viewer`.

### Task 6: Close The Five-Batch Lane

**Ownership:** Coordinator-owned. Worker agents hand off completion evidence;
they do not edit the shared dashboard or registry files in this task.

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/plans/mobile/2026-06-25-release-candidate-checklist.md`

- [x] Record each batch's completed commit and focused evidence, return the
  mobile lane to operator/device QA, and leave backend lane state unchanged.
- [x] Run `CI=true pnpm install --frozen-lockfile`, `pnpm relay`,
  `pnpm test:quality`, `nix flake check`, and `git diff --check`.
- [x] Commit `docs: close mobile release depth batches`.

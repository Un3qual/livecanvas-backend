# Viewer Playback Recovery Controls Implementation Plan

> **For agentic workers:** Use this only after it is promoted from
> `docs/plans/mobile/NOW.md`. Keep implementation mobile-owned.

**Goal:** Give viewers a clear retry path when live video playback disconnects
or fails.

**Architecture:** Keep playback lifecycle state in the existing viewer playback
controller and machine. The UI should render a retry action only for recoverable
viewer playback states and should not rejoin the live session unless membership
was actually lost.

**Tech Stack:** Expo React Native, `react-native-webrtc`, XState-backed local
workflow state, Bun tests.

---

## Executor Brief

The watch screen currently shows status text for playback failures, but users
do not get a concrete recovery action. Add a retry button for closed and errored
viewer playback states. The retry should restart viewer media preparation and
runtime setup for the active joined session without decoding Relay IDs or
constructing signaling topics.

## Context

- Playback hook:
  `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Playback machine:
  `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
- Playback runtime:
  `mobile/src/live/playback/liveSessionViewerPlaybackRuntime.ts`
- Playback surface:
  `mobile/src/live/watch/components/LiveSessionViewerPlaybackSurface.tsx`

## Tasks

### Task 1: Model retry eligibility

**Files:**
- Modify:
  `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
- Modify:
  `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`

Acceptance criteria:
- `closed` and `errored` playback states are recoverable when the viewer is
  still joined to an enterable session.
- Retry resets playback display state to preparing/connecting through the
  existing lifecycle path.
- Retry from `idle`, `preparing`, `connecting`, `waiting_for_host`, or
  `playing` is ignored.

Implementation notes:
- Add an explicit machine event such as `RETRY_REQUESTED`.
- Keep stale generation protection intact; retry should create a new generation
  instead of reviving an old runtime.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionViewerPlaybackMachine.test.ts`

### Task 2: Expose a retry command from the playback hook

**Files:**
- Modify:
  `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Modify:
  `mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts`

Acceptance criteria:
- The hook returns `retryViewerPlayback`.
- Calling retry while joined and recoverable disposes stale playback resources
  and starts a fresh prepare/connect sequence.
- Calling retry after unmount, after leave, or for a stale session does nothing.
- Existing automatic start behavior remains unchanged.

Implementation notes:
- Reuse the same preparation path used when a joined session first becomes
  eligible.
- Continue using `prepareLiveMediaSession`; do not cache old ICE servers or old
  signaling topics across retry attempts.

Focused verification:
- From `mobile/`:
  `bun test tests/live/useLiveSessionViewerPlaybackController.test.ts`

### Task 3: Add retry UI to the playback surface

**Files:**
- Modify:
  `mobile/src/live/watch/components/LiveSessionViewerPlaybackSurface.tsx`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Test: `mobile/tests/live/liveSessionViewerPlaybackSurface.test.tsx`

Acceptance criteria:
- The live video card shows `Retry video` when playback is closed or errored
  and the viewer is still joined.
- The retry control is hidden before join, while connecting, while playing, and
  after the session has ended.
- Pressing retry calls the hook command exactly once.
- Existing status copy remains visible so users know why retry is available.

Implementation notes:
- Pass a small `recovery` prop object into
  `LiveSessionViewerPlaybackSurface`.
- Keep the component presentation-only; do not import Relay or auth state in the
  surface component.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionViewerPlaybackSurface.test.tsx`

### Task 4: Protect cleanup semantics

**Files:**
- Modify:
  `mobile/tests/live/useLiveSessionWatchController.test.ts`
- Modify:
  `mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts`

Acceptance criteria:
- Leaving the session while a retry is pending still disposes playback once.
- Ended-session events suppress retry and stop playback.
- Channel termination during retry transitions to a recoverable state only when
  the session remains joined and enterable.

## Final Verification

From `mobile/`:

- `bun test tests/live/liveSessionViewerPlaybackMachine.test.ts`
- `bun test tests/live/useLiveSessionViewerPlaybackController.test.ts`
- `bun test tests/live/liveSessionViewerPlaybackSurface.test.tsx`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Handoff

This plan does not add automatic backoff, network diagnostics, or background
resume policy. Those can follow after manual device QA identifies real failure
patterns.

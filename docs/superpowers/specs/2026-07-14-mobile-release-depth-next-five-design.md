# Mobile Release Depth: Next Five Batches Design

Date: 2026-07-14
Status: approved
Owner: mobile lane

## Goal

Close the next five product-visible gaps exposed by release-candidate review
without claiming operator-owned device QA is complete. The sequence deepens the
existing host, viewer, content, and story loops before expanding into new auth,
search, notification, or contact-import surfaces.

## Sequence Decision

1. host local preview
2. live audience count
3. foreground/background live recovery
4. post and story media rendering
5. dedicated story viewer

This release-depth sequence wins over growth breadth because the current app
already uploads media and negotiates live sessions but does not show a host
preview, drops the channel's viewer count, has no explicit app-lifecycle
recovery, and renders uploaded media as text. It wins over provider and backend
expansion because those alternatives require new product policy or external
service choices.

## Shared Constraints

- Keep durable reads and writes Relay-first; global IDs and cursors remain
  opaque.
- Keep Phoenix Channels authoritative for live room state and use GraphQL to
  refresh durable state after foreground recovery.
- Reuse the one cached host media stream. Preview rendering must not acquire a
  second camera/microphone stream or take ownership away from the publishing
  session.
- Keep native runtime imports behind the existing adapter boundaries so Jest
  and non-native environments retain deterministic fallbacks.
- Keep tests under `mobile/tests/**`.
- Do not mark physical-device or operator release-candidate checks complete;
  record only local automated evidence.

## Batch 1: Host Local Preview

The preflight screen renders the cached local camera stream before the host
creates or publishes a session. `HostBroadcastNative` exposes a safe stream URL
from the same stream already acquired during permission/readiness checks. A
focused preview card owns presentation only; the existing native/publishing
lifecycle continues to stop tracks on abandonment and retain them after a
successful go-live handoff. Unsupported native environments and unavailable
streams render an explicit fallback rather than a blank frame.

Done means controller, adapter, and component tests cover ready, unavailable,
late, and cleanup paths without a second `getUserMedia` call.

## Batch 2: Live Audience Count

The watch screen keeps a session-scoped audience snapshot from the existing
`session:state.viewer_count` channel payload. The hero shows a singular/plural
viewer label for hosts and viewers, resets on session changes, and ignores
events from a closed or replaced channel generation. No new GraphQL field or
backend counter is introduced.

Done means parser, channel lifecycle, and screen tests cover zero, one, many,
session changes, ended sessions, and stale callbacks.

## Batch 3: Foreground/Background Live Recovery

A small app-state adapter exposes active versus suspended state to the watch
surface. Suspending cancels pending chat sends, closes the watch/chat channel,
and disposes viewer playback resources without issuing a durable leave.
Foregrounding performs a network-only session refetch, reconnects the channel,
and restarts viewer media preparation for a still-joined active session. The
retained host publishing resource remains owned by its provider and Phoenix
socket reconnect behavior; the watch surface must not dispose it merely because
the app became inactive.

Done means deterministic lifecycle tests prove stale pre-background callbacks
cannot overwrite the resumed generation, ended sessions stay ended, and viewer
recovery does not duplicate join or leave mutations.

## Batch 4: Post And Story Media Rendering

Processed image and video assets render inside `ContentPostCard` through a
shared media presentation component. Images use `expo-image`; videos use the
Expo-supported video package with native controls. The component
consumes only the already-normalized HTTP(S) URL and preserves processing,
failed, unavailable, load-error, and native-module-unavailable states. Feed and
profile surfaces inherit the behavior through the shared card.

Done means component tests cover image, video, invalid/unavailable, processing,
failure, and playback fallback states, with the full quality gate and frozen
install passing.

## Batch 5: Dedicated Story Viewer

Story cards open `/stories/[id]`. The viewer refetches the selected story and
the visible active story feed for that author, starts at the selected opaque ID,
and provides previous, next, and close controls with stable progress copy.
Expired or inaccessible stories fail closed; media presentation reuses Batch 4.
This batch intentionally does not add durable seen-state, reactions, or
automatic timers.

Done means route, Relay selection, navigation-state, expiry, authorization
fallback, and component tests cover entry from feed and both profile surfaces.

## Verification And Release Handoff

Each batch gets focused red/green coverage and a milestone commit. The final
branch runs the frozen pnpm install, Relay generation when operations change,
`pnpm test:quality`, `nix flake check`, and `git diff --check`. The mobile release
checklist returns to operator/device QA after local evidence is recorded.

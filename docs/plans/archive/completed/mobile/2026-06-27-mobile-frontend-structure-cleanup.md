# Mobile Frontend Structure Cleanup Implementation Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the mobile frontend into smaller nested modules so screens, routes, presentation components, styles, Relay operations, and runtime helpers no longer collect in oversized files.

**Architecture:** Keep Expo Router route files thin. Keep stable public imports at the existing feature entrypoints, then move implementations into nested folders under each feature. Start with presentation/style extraction because it has the lowest behavioral risk, then extract native media, socket, and mutation lifecycle hooks in a later milestone.

**Tech Stack:** Expo Router, React Native, Relay, Bun test, TypeScript.

---

## Target Folder Shape

- `mobile/app/**`: route adapters only. These files parse route params, handle route-level auth redirects, and render a source module.
- `mobile/src/auth/screens/**`: sign-in/sign-up screen composition shared by the auth route files.
- `mobile/src/profile/components/**`: reusable profile cards, avatars, preview lists, empty states, and styles.
- `mobile/src/profile/viewer/**`: viewer-profile query, mutations, controller state, and screen composition.
- `mobile/src/profile/other/**`: other-user profile query, mutation state, and screen composition.
- `mobile/src/live/watch/**`: watch-screen composition, cards, styles, RTC view resolution, and later viewer playback/chat hooks.
- `mobile/src/live/chat/**`: later home for chat panel, chat reducer, chat channel lifecycle, retained history, and chat presentation.
- `mobile/src/live/realtime/**`: later home for Phoenix event normalization, realtime status, subscription policy, and ended-session cleanup.
- `mobile/src/live/playback/**`: later home for viewer playback runtime and lifecycle helpers.
- `mobile/src/host/preflight/**`: preflight screen composition, status cards, styles, status helpers, and later native-readiness hook.
- `mobile/src/host/publishing/**`: later home for host publishing runtime/session-store helpers.
- `mobile/tests/<domain>/**`: tests stay outside `mobile/src`.

## Task 1: Auth Route Screen Extraction

**Files:**
- Create: `mobile/src/auth/screens/AuthEntryScreen.tsx`
- Modify: `mobile/app/(auth)/sign-in.tsx`
- Modify: `mobile/app/(auth)/sign-up.tsx`

- [x] Extract shared auth form layout, OAuth buttons, error banner, return-to handling, and alternate-screen link into `AuthEntryScreen`.
- [x] Leave route files as thin wrappers that pass `mode="signIn"` or `mode="signUp"`.
- [x] Verify with `cd mobile && bun run typecheck`.

## Task 2: Profile Presentation Extraction

**Files:**
- Create: `mobile/src/profile/components/profileScreenStyles.ts`
- Create: `mobile/src/profile/components/ProfileAvatar.tsx`
- Create: `mobile/src/profile/components/ProfileCards.tsx`
- Create: `mobile/src/profile/components/ProfilePreviewList.tsx`
- Create: `mobile/src/profile/viewer/ViewerProfileScreen.tsx`
- Create: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify: `mobile/src/profile/ViewerProfileScreen.tsx`
- Modify: `mobile/src/profile/OtherUserProfileScreen.tsx`

- [x] Move viewer and other-user profile screen implementations into nested folders while preserving the existing public entrypoint files as re-exports.
- [x] Move repeated profile UI into shared profile components.
- [x] Keep Relay query/mutation names and generated artifact imports stable.
- [x] Verify with `cd mobile && bun test tests/profile`.

## Task 3: Live Watch Presentation Extraction

**Files:**
- Create: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Create: `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`
- Create: `mobile/src/live/watch/components/LiveSessionViewerPlaybackSurface.tsx`
- Create: `mobile/src/live/watch/liveSessionRtcView.ts`
- Create: `mobile/src/live/watch/liveSessionWatchScreenStyles.ts`
- Create: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/src/live/LiveSessionWatchScreen.tsx`

- [x] Move the watch-screen implementation under `live/watch` and keep the existing top-level entrypoint as a re-export.
- [x] Extract the details card, controls card, hero card, recording metadata, RTC view resolution, playback state types, and styles.
- [x] Leave mutation handlers and socket/media lifecycles in the screen module for this milestone.
- [x] Verify with `cd mobile && bun test tests/live`.

## Task 4: Host Preflight Presentation Extraction

**Files:**
- Create: `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`
- Create: `mobile/src/host/preflight/components/HostPreflightCards.tsx`
- Create: `mobile/src/host/preflight/hostBroadcastPreflightScreenStyles.ts`
- Create: `mobile/src/host/preflight/hostBroadcastPreflightScreenTypes.ts`
- Modify: `mobile/src/host/HostBroadcastPreflightScreen.tsx`

- [x] Move the preflight screen implementation under `host/preflight` and keep the existing top-level entrypoint as a re-export.
- [x] Extract readiness card, controls card, status rows, status label helpers, shared status types, and styles.
- [x] Leave native readiness and publishing runtime effects in the screen module for this milestone.
- [x] Verify with `cd mobile && bun test tests/host`.

## Task 5: Lane Docs And Final Verification

**Files:**
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`

- [x] Record this cleanup batch in the mobile lane docs.
- [x] Run `cd mobile && bun run test:quality`.
- [x] Run `cd mobile && bun test tests/auth tests/profile tests/config`.
- [x] Run `cd mobile && bun run typecheck`.
- [x] Run `git diff --check`.
- [x] Commit the milestone.

## Task 6: Remaining UI Module Organization

**Files:**
- Create: `mobile/src/auth/screens/authEntryScreenStyles.ts`
- Create: `mobile/src/live/discovery/LiveDiscoveryScreen.tsx`
- Create: `mobile/src/live/components/LiveSessionSummaryCard.tsx`
- Create: `mobile/src/live/chat/LiveSessionChatPanel.tsx`
- Create: `mobile/src/live/chat/liveSessionChatPanelPresentation.ts`
- Modify: top-level compatibility shims in `mobile/src/components/**` and `mobile/src/live/**`

- [x] Move auth-entry styles next to the extracted auth-entry screen.
- [x] Move live discovery, live summary card, and live chat panel UI modules
  into nested folders while preserving the old public imports as re-exports.
- [x] Keep deeper reducers, channel clients, and native/media runtimes in their
  current modules until a behavior-risk batch can split them with targeted
  regression coverage.
- [x] Run the full mobile quality gates before committing.

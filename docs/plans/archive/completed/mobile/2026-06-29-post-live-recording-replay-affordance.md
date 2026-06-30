# Post-Live Recording Replay Affordance Implementation Plan

> **For agentic workers:** Use this only after it is promoted from
> `docs/plans/mobile/NOW.md`. Keep implementation mobile-owned.

**Goal:** Turn existing live-session recording metadata into an actionable
post-live replay affordance.

**Architecture:** Keep this as a read-only mobile UI slice over the current
`LiveSession.recordingMediaAsset` GraphQL contract. The app should open a
processed recording URL when available and otherwise show clear processing or
failure state. Do not add recording upload, export, editing, or sharing.

**Tech Stack:** Expo React Native, Relay-generated live-session query,
`Linking.openURL`, Bun tests.

---

## Executor Brief

The watch details card already reads `recordingMediaAsset`, but it only prints
metadata. Add a small replay affordance for processed recordings so a viewer or
host can open the recording after the session ends.

## Context

- Recording fields are already selected in
  `mobile/src/live/watch/liveSessionWatchOperations.ts`.
- Recording metadata renders in
  `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`.
- Generated GraphQL types already include `recordingMediaAsset`.

## Tasks

### Task 1: Add recording presentation helpers

**Files:**
- Create: `mobile/src/live/recording/liveSessionRecordingPresentation.ts`
- Test: `mobile/tests/live/liveSessionRecordingPresentation.test.ts`

Acceptance criteria:
- `PROCESSED` with a nonblank `publicUrl` returns an available replay action.
- `PENDING_UPLOAD` and `UPLOADED` return processing copy.
- `FAILED` returns failed copy.
- Unknown processing states return unavailable copy without throwing.
- Blank or missing public URLs never produce an open action.

Implementation notes:
- Return a model with `statusLabel`, `body`, `canOpen`, and `publicUrl`.
- Keep raw URLs out of the primary body copy; display them only as optional
  secondary metadata if already shown.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionRecordingPresentation.test.ts`

### Task 2: Render actionable recording state

**Files:**
- Modify:
  `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`
- Test: `mobile/tests/live/liveSessionWatchRecordingCard.test.tsx`

Acceptance criteria:
- Recording details show processing, processed, failed, and unavailable states
  with viewer-safe copy.
- A processed recording with a public URL shows `Open recording`.
- Sessions without `recordingMediaAsset` do not render the recording section.
- The existing session details metadata remains intact.

Implementation notes:
- Keep `RecordingMetadata` small by delegating model construction to
  `liveSessionRecordingPresentation.ts`.
- Use `AppButton` with secondary variant for the recording action.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionWatchRecordingCard.test.tsx`

### Task 3: Open processed recording URLs

**Files:**
- Modify:
  `mobile/src/live/watch/components/LiveSessionWatchCards.tsx`
- Test: `mobile/tests/live/liveSessionWatchRecordingCard.test.tsx`

Acceptance criteria:
- Pressing `Open recording` calls `Linking.openURL(publicUrl)`.
- If `openURL` rejects, the card shows a viewer-safe error message.
- The button stays enabled after failure so the user can retry.
- Non-HTTP custom schemes are not opened unless the existing platform supports
  them through `Linking.canOpenURL`.

Implementation notes:
- Keep URL opening in the component layer; do not put React Native `Linking`
  calls in the pure presentation helper.
- Add a small local state variable for open failures.

Focused verification:
- From `mobile/`:
  `bun test tests/live/liveSessionWatchRecordingCard.test.tsx`

### Task 4: Keep replay scoped out of live playback

**Files:**
- Modify:
  `docs/plans/archive/completed/mobile/2026-06-29-post-live-recording-replay-affordance.md`
  only if implementation discovers a real contract mismatch.

Acceptance criteria:
- No new video player is added.
- No recording export/share route is added.
- No backend code, schema, or mutation changes are made.

## Final Verification

From `mobile/`:

- `bun test tests/live/liveSessionRecordingPresentation.test.ts`
- `bun test tests/live/liveSessionWatchRecordingCard.test.tsx`
- `bun run test:quality`
- `bun run typecheck`

From repo root:

- `git diff --check`

## Handoff

If product wants in-app replay playback instead of opening the public URL, write
a separate plan after choosing the playback surface and route ownership.

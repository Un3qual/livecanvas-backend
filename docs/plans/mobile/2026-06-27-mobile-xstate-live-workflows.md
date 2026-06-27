# Mobile XState Live Workflow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce XState for the mobile app's complex live broadcast workflows so large screens stop hand-rolling protocol state with scattered booleans, refs, reducer actions, and lifecycle guards.

**Architecture:** Keep Relay as the server-state layer and keep small component-local state in React. Use XState v5 only for feature-local workflows with explicit transitions: viewer membership, viewer playback, chat channel/send status, and host preflight/go-live. Keep Relay mutations, Phoenix channels, WebRTC runtime creation, auth token access, and navigation as injected adapters or hook-owned side effects.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, Relay, Phoenix Channels, react-native-webrtc, XState v5, `@xstate/react`, Bun tests, pnpm.

---

## Activation Note

The current mobile lane still points at release-candidate QA in `docs/plans/mobile/NOW.md`. Do not move that pointer just to land this plan. Activate this work only after the QA batch is complete, explicitly paused, or this XState cleanup is selected as the next mobile batch.

## Plan Style

This is an implementation guide, not a transcript of code to paste. It names the files, boundaries, expected behavior, and verification gates. Executors should use the existing code shape and tests to choose the exact TypeScript, keeping changes small and reviewable.

## Decision Record

- Use **XState** for workflow state where illegal transitions are the main source of complexity.
- Do **not** introduce Redux Toolkit in this batch. Relay already owns server data, and RTK would mostly centralize the same workflow guards rather than simplify them.
- Do **not** introduce a broad Zustand store in this batch. Zustand may be useful later for shared client resource registries, but it does not provide first-class statechart semantics for join/leave/playback/go-live protocols.
- Keep machines feature-local under `live/watch`, `live/chat`, and `host/preflight`.
- Keep external resources out of machine context: no Phoenix socket objects, channel clients, WebRTC peer connections, media streams, Relay commit functions, router objects, or auth callbacks in XState context.
- Keep timeline row merging in reducers/helpers. Timeline data is collection reconciliation, not workflow state.

## Target Folder Shape

- `mobile/src/live/watch/state/liveSessionWatchMachine.ts`
  Viewer membership, host-end, and auto-leave workflow state.
- `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
  Viewer playback status and display selectors.
- `mobile/src/live/watch/hooks/useLiveSessionWatchController.ts`
  React/Relay orchestration for join, leave, end, unmount cleanup, and same-tick command guards.
- `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
  Existing playback lifecycle hook updated to report status through a playback machine.
- `mobile/src/live/chat/state/liveSessionChatChannelMachine.ts`
  Chat channel connection and send status. Retained history and event rows stay in the existing chat modules.
- `mobile/src/host/preflight/state/hostBroadcastPreflightMachine.ts`
  Host create/prepare/publish/go-live/end workflow state.
- `mobile/tests/live/*Machine.test.ts`
  Machine-level transition tests.
- `mobile/tests/live/*Controller.test.ts`
  Hook/controller tests that verify Relay/socket/WebRTC side effects still happen at the right boundaries.
- `mobile/tests/host/*Machine.test.ts`
  Host preflight transition tests.

## Cross-Cutting Rules

- New tests stay under `mobile/tests/**`.
- Use `setup(...)` and typed events in XState v5.
- Use selectors for UI-facing state instead of reading machine internals directly from screens.
- Preserve existing public UI strings and error formatting via `formatLiveMutationErrors`.
- Preserve existing Relay operation files and generated artifacts.
- Preserve existing behavior first; smaller files and clearer transitions are the deliverable.
- Commit at each completed task boundary.

## Task 1: Add XState And Establish The Local Convention

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`

**Implementation Notes:**
- Add `xstate` and `@xstate/react` as mobile runtime dependencies with `pnpm`.
- Do not add XState globally to app providers in this task.
- Do not create any global store or top-level actor registry.

**Verification:**
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

**Done When:**
- The dependency install is committed by itself.
- Existing mobile typecheck still passes before any workflow migration starts.

## Task 2: Pilot Viewer Watch Membership As A Feature-Local Machine

**Files:**
- Create: `mobile/src/live/watch/state/liveSessionWatchMachine.ts`
- Create: `mobile/tests/live/liveSessionWatchMachine.test.ts`
- Keep initially: `mobile/src/live/liveSessionWatchReducer.ts`
- Keep initially: `mobile/tests/live/liveSessionWatchReducer.test.ts`

**Current Behavior To Preserve:**
- Session route changes reset membership state for the new session.
- Join request enters a pending joining state and disables duplicate join attempts.
- Stale join, leave, end, and membership-loss completions from old sessions are ignored.
- Join success marks the viewer joined and enables auto-leave-on-unmount.
- Leave success clears joined state and disables auto-leave.
- Leave failure keeps joined state so cleanup can be retried.
- Channel membership loss clears joined state and disables auto-leave.
- Host end success clears joined state and disables auto-leave.

**Implementation Notes:**
- Model membership as explicit states rather than an `isJoined` plus `submission` flag pair.
- Include active session id and viewer-safe error text in context.
- Represent the pending command kind in context so event handlers can close same-render double-tap gaps with the actor snapshot.
- Export selectors for UI needs: joined state, visible submission, visible error, join eligibility, and auto-leave requirement.
- Keep the old reducer during this task so the machine tests can be compared against current reducer expectations.

**Tests To Add:**
- Join request and success.
- Stale join completion after route session change.
- Leave failure keeping joined state.
- Membership loss clearing joined state.
- Ended-session cleanup disabling auto-leave.
- Same-tick command guard after a join request.

**Verification:**
- From `mobile/`: `bun test tests/live/liveSessionWatchMachine.test.ts tests/live/liveSessionWatchReducer.test.ts`
- From `mobile/`: `bun run typecheck`

**Done When:**
- The new machine passes transition tests.
- The old reducer tests still pass.
- No screen behavior has been changed yet.

## Task 3: Move Watch-Screen Join Leave End Orchestration Into A Controller Hook

**Files:**
- Create: `mobile/src/live/watch/hooks/useLiveSessionWatchController.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/tests/live/LiveDiscoveryScreen.test.ts` only if current mocks need new hook boundaries.
- Delete when unused: `mobile/src/live/liveSessionWatchReducer.ts`
- Delete when unused: `mobile/tests/live/liveSessionWatchReducer.test.ts`

**Current Behavior To Preserve:**
- Join, leave, and end Relay mutations use the same operation files and variables.
- Failed mutations show the same viewer-safe error text.
- A successful join after unmount still triggers detached leave cleanup.
- Leave starts by stopping viewer playback.
- End success releases retained host publishing resources and stops viewer playback.
- Realtime ended-session events release host publishing resources, stop viewer playback, close chat, and suppress detached leave.
- The screen still renders the same cards and `LiveSessionChatPanel` props.

**Implementation Notes:**
- The controller hook should own the XState actor, pending mutation ref, detached leave mutation guard, and unmount cleanup.
- The screen should send domain events to the controller instead of dispatching reducer actions.
- Keep side-effect callbacks injected from the screen for playback stop and retained host publishing release. The machine should not know those resources exist.
- Read the actor snapshot synchronously in press handlers before sending command events.
- Delete the old watch reducer only after `rg` confirms no source consumers remain.

**Tests To Add Or Update:**
- Controller-level tests for duplicate join prevention.
- Controller-level tests for stale mutation completion after session change.
- Controller-level tests for detached leave after join completes post-unmount.
- Existing live screen tests should continue to cover rendered states.

**Verification:**
- From `mobile/`: `bun test tests/live/liveSessionWatchMachine.test.ts tests/live/LiveDiscoveryScreen.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionChatReducer.test.ts`
- From `mobile/`: `bun test tests/live`
- From `mobile/`: `bun run typecheck`

**Done When:**
- `LiveSessionWatchScreen.tsx` no longer owns join/leave/end reducer plumbing.
- Watch membership state comes from XState selectors.
- Old reducer files are removed if unused.
- Focused live tests pass.

## Task 4: Move Viewer Playback Status Into A Machine

**Files:**
- Create: `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
- Create: `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`
- Modify: `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Modify: `mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts`

**Current Behavior To Preserve:**
- Playback starts only when viewer is authenticated, joined, not leaving, live session id is present, and session status is not ended.
- Preparing media failure reports the same formatted mutation error.
- Missing peer-connection support reports the existing unavailable-on-device text.
- Runtime start success moves to waiting-for-host until a remote stream URL exists.
- Remote stream arrival moves to playing.
- Channel termination moves to closed without showing an error.
- Runtime errors move to errored and dispose current resources.
- Generation invalidation prevents stale continuations from overwriting newer playback state.

**Implementation Notes:**
- Use XState for display status only: idle, preparing, connecting, waiting for host, playing, closed, errored.
- Keep generation refs, runtime refs, socket disconnect, and WebRTC disposal outside machine context.
- Convert existing `setViewerPlaybackState` updates into machine events.
- Keep the hook API stable for the screen: it should still expose `viewerPlaybackState` and stop functions.

**Tests To Add Or Update:**
- Machine transition tests for preparing, connecting, waiting, playing, closed, errored, and reset.
- Existing controller lifecycle tests for generation invalidation, stale prepare completion, runtime disposal, and remote stream update.

**Verification:**
- From `mobile/`: `bun test tests/live/liveSessionViewerPlaybackMachine.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionViewerPlaybackRuntime.test.ts`
- From `mobile/`: `bun run typecheck`

**Done When:**
- Playback display state is selected from the playback machine.
- WebRTC resources remain outside machine context.
- Existing playback behavior tests pass.

## Task 5: Move Chat Channel And Send Status Into A Machine

**Files:**
- Create: `mobile/src/live/chat/state/liveSessionChatChannelMachine.ts`
- Create: `mobile/tests/live/liveSessionChatChannelMachine.test.ts`
- Modify: `mobile/src/live/chat/liveSessionChatState.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/tests/live/liveSessionChatReducer.test.ts`
- Modify: `mobile/tests/live/LiveSessionChatPanel.test.ts`

**Current Behavior To Preserve:**
- Retained initial history still loads into visible chat rows.
- Realtime timeline events are still merged and ordered by existing helpers.
- Channel status still renders idle, joining, joined, errored, and closed states.
- Sending is allowed only when the channel is joined and no send is already pending.
- Send success clears pending send status.
- Send failure stores the same viewer-safe error text.
- Channel close or error fails an active send with the existing disconnect text.
- Unmount cancellation clears pending send without creating an erroneous visible failure.

**Implementation Notes:**
- Move only channel and send status to XState.
- Leave event-row merging, retained history, page info, and visible row selectors in the existing chat modules.
- Keep `LiveSessionChatPanel` props unchanged.
- Consider renaming the remaining reducer module after migration if it no longer owns channel/send state.

**Tests To Add Or Update:**
- Machine transition tests for channel joining, joined, closed, errored.
- Machine transition tests for send started, succeeded, failed, cancelled.
- Reducer tests proving retained history and realtime row merging still work.
- Panel tests proving prop-driven rendering is unchanged.

**Verification:**
- From `mobile/`: `bun test tests/live/liveSessionChatChannelMachine.test.ts tests/live/liveSessionChatReducer.test.ts tests/live/LiveSessionChatPanel.test.ts tests/live/liveSessionChatChannelLifecycle.test.ts`
- From `mobile/`: `bun run typecheck`

**Done When:**
- Chat channel/send status no longer lives in the timeline reducer.
- Timeline row behavior is unchanged.
- Chat panel props and UI behavior are unchanged.

## Task 6: Move Host Preflight Workflow Into A Machine

**Files:**
- Create: `mobile/src/host/preflight/state/hostBroadcastPreflightMachine.ts`
- Create: `mobile/tests/host/hostBroadcastPreflightMachine.test.ts`
- Modify: `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
- Modify: `mobile/tests/host/useHostBroadcastPreflightController.test.ts`
- Modify: `mobile/tests/host/hostBroadcastPreflight.test.ts`
- Modify: `mobile/tests/host/hostBroadcastSession.test.ts`

**Current Behavior To Preserve:**
- Native permission/readiness checks still feed the readiness card.
- Create session starts only when no session is active or creating.
- Prepare media requires a started session and no existing prepared media.
- Go live requires host readiness, backend media readiness, prepared media, and no go-live request in flight.
- Retryable media-readiness go-live failures keep prepared media so the host can retry.
- Non-retryable go-live failures clear prepared media.
- If go-live succeeds but publishing resource retention fails, the backend live session is ended.
- Back press and unmount cleanup still end abandoned preflight sessions where needed.
- Native resources are disposed only when no retained publishing resource exists.

**Implementation Notes:**
- Start by modeling the session and action status states. Leave prepared media payload data in React state because publishing runtime consumes it as external operation data.
- Keep host publishing runtime and retained resource store outside the machine.
- Derive card props through selectors so `HostBroadcastPreflightScreen.tsx` remains presentation-oriented.
- Preserve the existing controller lifecycle tests while swapping internal state ownership.

**Tests To Add Or Update:**
- Machine tests for create, prepare, publishing ready, go live success.
- Machine tests for retryable and non-retryable go-live failures.
- Machine tests for end requested, success, and failure.
- Controller tests for abandoned cleanup on unmount and retain failure cleanup.

**Verification:**
- From `mobile/`: `bun test tests/host/hostBroadcastPreflightMachine.test.ts tests/host/useHostBroadcastPreflightController.test.ts tests/host/useHostBroadcastPublishingController.test.ts tests/host/hostBroadcastPreflight.test.ts tests/host/hostBroadcastSession.test.ts`
- From `mobile/`: `bun run typecheck`

**Done When:**
- Host preflight action state is selected from the machine.
- Prepared media and publishing resources remain outside machine context.
- Host focused tests pass.

## Task 7: Final Cleanup And Quality Gate

**Files:**
- Modify/delete only after consumer search: `mobile/src/live/liveSessionWatchReducer.ts`
- Modify/delete only after consumer search: `mobile/tests/live/liveSessionWatchReducer.test.ts`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/src/live/chat/liveSessionChatState.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify only when this batch is active or closing: `docs/plans/mobile/NOW.md`
- Modify if lane ordering changes: `docs/plans/mobile/TRACK.md`

**Implementation Notes:**
- Search before deleting compatibility code.
- Delete wrapper-only or reducer-only modules that no longer own meaningful behavior.
- Keep public route/screen entrypoints only where Expo Router or tests still depend on them.
- Update lane docs only if this plan was promoted to the current mobile batch.

**Verification:**
- From `mobile/`: `bun run test:quality`
- From `mobile/`: `bun run typecheck`
- From repo root: `git diff --check`

**Done When:**
- Full mobile test and typecheck gates pass.
- The branch has no stale reducer files for migrated workflows.
- Lane docs accurately reflect whether this work was executed or remains queued.

## Final Acceptance Criteria

- `LiveSessionWatchScreen.tsx` has materially less mutation and lifecycle state plumbing.
- Viewer playback status is state-machine driven while WebRTC resources remain ref-owned outside machine context.
- Chat channel/send status is state-machine driven while timeline rows remain reducer/helper-owned.
- Host preflight workflow state is state-machine driven while native/media/publishing resources remain external.
- XState is used only in complex workflow areas, not as a blanket replacement for Relay or local React state.
- `cd mobile && bun run test:quality` passes.
- `cd mobile && bun run typecheck` passes.
- `git diff --check` passes.

## Stop Conditions

- If Task 2 or Task 3 makes the viewer watch flow harder to understand, stop before playback/chat/host migration and revise the architecture.
- If XState types require broad casts in screen or controller code, stop and simplify the machine boundary before continuing.
- If a machine starts storing sockets, channels, peer connections, streams, or Relay commit functions in context, stop and move those resources back behind hook-owned adapters.

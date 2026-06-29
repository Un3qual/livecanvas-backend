# Mobile XState Live Workflow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce XState for the mobile app's complex live broadcast workflows so large screens stop hand-rolling protocol state with scattered booleans, refs, reducer actions, and lifecycle guards.

**Architecture:** Keep Relay as the server-state layer and keep small component-local state in React. Use XState v5 only for feature-local workflows with explicit transitions: viewer membership, viewer playback, chat channel/send status, and host preflight/go-live. Keep Relay mutations, Phoenix channels, WebRTC runtime creation, auth token access, and navigation as injected adapters or hook-owned side effects.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, Relay, Phoenix Channels, react-native-webrtc, XState v5, `@xstate/react`, Bun tests, pnpm.

---

## Activation Note

The current mobile lane still points at release-candidate QA in `docs/plans/mobile/NOW.md`. Do not move that pointer just to land this plan. Activate this work only after the QA batch is complete, explicitly paused, or this XState cleanup is selected as the next mobile batch.

## Plan Style

This plan is intentionally detailed about architecture, ownership, invariants, and verification. It is not a source-file script to paste. Executors should use the existing code shape, tests, and XState APIs to implement the design in the smallest coherent changes.

## Why This Work Exists

The mobile app is small, but the live/host flows are already workflow-heavy. The problem is not global app state, and it is not server data caching. The problem is that several screens and hooks currently encode protocol state by combining local reducers, multiple booleans, refs, async callbacks, cleanup flags, and stale-continuation guards.

This plan targets the code paths where that complexity is meaningful:

- `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
  Coordinates Relay query data, join/leave/end mutations, realtime ended-session cleanup, retained host publishing release, chat channel lifecycle, detached leave cleanup, and playback state.
- `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
  Coordinates playback preparation, socket/runtime creation, generation invalidation, resource disposal, and display status.
- `mobile/src/live/liveSessionChatReducer.ts`
  Currently combines retained timeline row reconciliation with channel/send status.
- `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
  Coordinates native readiness, session creation, media preparation, host publishing readiness, go-live, retained publishing resources, navigation, and abandoned cleanup.

The goal is to make workflow transitions explicit and testable without spreading a global state library through the rest of the app.

## Decision Record

- Use **XState** for workflow state where illegal transitions are the main source of complexity.
- Do **not** introduce Redux Toolkit in this batch. Relay already owns server data, and RTK would mostly centralize the same workflow guards rather than simplify them.
- Do **not** introduce a broad Zustand store in this batch. Zustand may be useful later for shared client resource registries, but it does not provide first-class statechart semantics for join/leave/playback/go-live protocols.
- Keep machines feature-local under `live/watch`, `live/chat`, and `host/preflight`.
- Keep external resources out of machine context: no Phoenix socket objects, channel clients, WebRTC peer connections, media streams, Relay commit functions, router objects, or auth callbacks in XState context.
- Keep timeline row merging in reducers/helpers. Timeline data is collection reconciliation, not workflow state.
- Add XState incrementally. The viewer watch membership migration is the pilot; do not continue to playback, chat, or host preflight if that first migration makes the flow harder to reason about.

## Non-Goals

- Do not replace Relay.
- Do not introduce RTK Query, React Query, Apollo, or another server-state cache.
- Do not move auth entry forms, profile button state, theme, startup gate, or simple screen-local input state into XState.
- Do not persist XState snapshots across app launches.
- Do not create an app-wide actor registry or global store.
- Do not rewrite Phoenix channel clients, WebRTC runtimes, or Relay operation files as part of this plan.
- Do not perform release-candidate manual device QA in this batch unless the lane is explicitly reactivated for QA.

## XState Integration Conventions

### Machine Placement

Machines should live beside the feature they describe:

- viewer watch membership: `mobile/src/live/watch/state/`
- viewer playback status: `mobile/src/live/watch/state/`
- chat channel/send status: `mobile/src/live/chat/state/`
- host preflight/go-live: `mobile/src/host/preflight/state/`

Avoid `mobile/src/state`, `mobile/src/stores`, or other global folders for this work.

### Machine Context

Context may contain:

- active session ids;
- viewer-safe error text;
- pending command kind;
- workflow flags that are part of the statechart;
- simple serializable display data such as remote stream URL strings.

Context must not contain:

- Relay commit functions;
- Phoenix sockets or channels;
- WebRTC peer connections;
- media streams or native handles;
- router/navigation objects;
- auth callback functions;
- mutable maps of retained runtime resources.

Those resources stay in hooks, adapters, or existing stores and are driven by machine events or selectors.

### Events And Selectors

Prefer domain events named around what happened, not around React implementation details. Examples of event families:

- session route changed;
- join requested, succeeded, failed;
- membership lost;
- playback preparation requested;
- runtime started, closed, failed;
- chat channel joined, closed, errored;
- send started, succeeded, failed, cancelled;
- host media prepared;
- publishing ready or failed;
- go-live requested, succeeded, failed.

Export selectors for screen and component consumption. Screens should not inspect nested XState values directly. Selectors should answer UI/domain questions such as:

- is the viewer joined?
- what submission should be visible?
- can the join button submit now?
- should unmount issue a detached leave?
- what playback state should the surface render?
- can chat send start?
- can host go live?

### Side Effects

State machines should own transition decisions, not IO. Use hooks/controllers to perform side effects:

- Relay mutations stay in watch/preflight controller hooks.
- Phoenix channel creation and cleanup stay in channel lifecycle/client modules.
- WebRTC runtime creation and disposal stay in playback/publishing runtime hooks.
- Retained host publishing resources stay in `hostBroadcastPublishingSessionStore`.
- Navigation stays in screen/controller callbacks.

When a side effect completes, the hook sends a success/failure event to the machine.

### Testing

Each machine needs direct transition tests that do not render React. Each React controller/hook needs tests around side-effect boundaries and stale async behavior. Existing runtime tests should remain focused on WebRTC/Phoenix behavior rather than machine internals.

Machine tests should cover legal transitions, stale-session ignores, duplicate-submit guards, cleanup transitions, and error transitions. Controller tests should prove the right Relay/socket/WebRTC side effects still occur.

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
- `mobile/tests/live/liveSessionWatchMachine.test.ts`
- `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`
- `mobile/tests/live/liveSessionChatChannelMachine.test.ts`
- `mobile/tests/host/hostBroadcastPreflightMachine.test.ts`
- Existing focused controller/runtime tests remain under `mobile/tests/live/**` and `mobile/tests/host/**`.

## Migration Sequence

Implement in this order:

1. Dependency and local conventions.
2. Viewer watch membership machine without screen integration.
3. Viewer watch controller integration.
4. Viewer playback status machine.
5. Chat channel/send status machine.
6. Host preflight machine.
7. Cleanup, docs, and full quality gate.

This order is deliberate. Viewer watch membership is the smallest useful pilot because it already has reducer tests and clear transition semantics. Playback and host preflight have more side effects, so they should only move after the membership pattern has proven readable.

## Task 1: Add XState And Establish The Local Convention

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`

**Scope:**
- Add `xstate` and `@xstate/react` as runtime dependencies from `mobile/`.
- Do not wire XState into app providers.
- Do not create machines yet unless a tiny dependency smoke test is needed to satisfy tooling.
- Do not touch mobile source behavior in this commit.

**Executor Notes:**
- Use the package manager already declared by `mobile/package.json`.
- Keep the lockfile change isolated so dependency review is easy.
- If install changes unrelated lockfile sections, inspect before committing.

**Verification:**
- `cd mobile && bun run typecheck`
- `git diff --check`

**Commit Boundary:**
- Commit only the dependency and lockfile update.

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
- End failure stores a viewer-safe error without pretending the session ended.

**Machine Boundary:**
- Owns membership state, active session id, visible submission, viewer-safe error text, and auto-leave policy.
- Does not own Relay mutation calls.
- Does not own playback stop, chat channel close, host publishing resource release, or router navigation.
- Exposes selectors for screen/controller consumption.

**State Shape Guidance:**
- Model membership as explicit states rather than a loose `isJoined` plus submission flag pair.
- Include a representation of the pending command so press handlers can close same-tick duplicate-submit gaps.
- Treat stale events as no-ops when their session id does not match the active session id.
- Make ended-session cleanup an explicit event path rather than a side effect hidden in React cleanup.

**Tests To Add:**
- Join request and success for the active session.
- Join failure with formatted viewer-safe error.
- Stale join success/failure after route session change.
- Leave success clearing joined state.
- Leave failure keeping joined state and retry eligibility.
- Membership lost clearing joined state.
- End requested, succeeded, and failed.
- Session ended clearing joined state and disabling auto-leave.
- Same-tick join guard visible from a snapshot immediately after join is requested.

**Verification:**
- `cd mobile && bun test tests/live/liveSessionWatchMachine.test.ts tests/live/liveSessionWatchReducer.test.ts`
- `cd mobile && bun run typecheck`

**Commit Boundary:**
- Commit after the machine and tests pass while the old reducer still exists.

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
- Duplicate join/leave/end taps do not issue duplicate mutations.
- Leave starts by stopping viewer playback.
- End success releases retained host publishing resources and stops viewer playback.
- Realtime ended-session events release host publishing resources, stop viewer playback, close chat, and suppress detached leave.
- Channel close/error membership loss clears joined state and stops playback.
- The screen still renders the same cards and `LiveSessionChatPanel` props.

**Controller Boundary:**
- Owns the XState actor.
- Owns pending mutation refs that close same-render duplicate-submit gaps.
- Owns detached leave cleanup on unmount.
- Receives injected callbacks for side effects that belong outside the machine: stop playback, release retained publishing resource, close chat channel, and navigate when needed.
- Sends domain events to the machine when Relay mutation callbacks complete.

**Screen Boundary:**
- Continues to read Relay query data.
- Continues to create Relay mutation commit functions.
- Continues to own realtime status map until a later cleanup explicitly moves it.
- Delegates membership command handling to the controller hook.
- Uses selectors/controller return values for UI props.

**Migration Notes:**
- Move one path at a time: join, then leave, then end, then realtime membership loss/ended-session events.
- Keep UI props stable during the migration so existing component tests remain useful.
- After each path moves, run focused live tests before deleting reducer code.
- Delete the old reducer only after searching `mobile/src` and `mobile/tests` for every exported helper and type.

**Tests To Add Or Update:**
- Controller test for duplicate join prevention.
- Controller test for stale mutation completion after session change.
- Controller test for detached leave after join completes post-unmount.
- Controller test for leave failure preserving joined/cleanup retry semantics.
- Controller test for end success invoking retained host publishing release and playback stop callbacks.
- Existing live screen tests should continue to cover rendered loading/error/success states.

**Verification:**
- `cd mobile && bun test tests/live/liveSessionWatchMachine.test.ts tests/live/LiveDiscoveryScreen.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionChatReducer.test.ts`
- `cd mobile && bun test tests/live`
- `cd mobile && bun run typecheck`

**Commit Boundary:**
- Commit after the screen uses the controller and focused live tests pass.
- If deleting the old reducer is non-trivial, use a separate cleanup commit after the controller migration is stable.

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
- Stop with reset clears displayed playback state; stop without reset disposes resources without unnecessary UI churn.

**Machine Boundary:**
- Owns display status: idle, preparing, connecting, waiting for host, playing, closed, errored.
- Owns display error text and remote stream URL string.
- Does not own generation counters, runtime refs, sockets, peer connections, or disposal functions.

**Controller Boundary:**
- Continues to own generation invalidation.
- Continues to own runtime/socket creation and disposal.
- Sends playback events when prepare, connect, runtime start, remote stream, close, error, or stop events occur.
- Keeps the current hook API stable for `LiveSessionWatchScreen`.

**Tests To Add Or Update:**
- Machine transition tests for prepare, connect, waiting, playing, closed, errored, and reset paths.
- Existing controller lifecycle tests for stale prepare completion.
- Existing controller lifecycle tests for stale runtime completion after a new generation starts.
- Existing controller lifecycle tests for runtime disposal and socket disconnect.
- Existing controller lifecycle tests for remote stream URL update.

**Verification:**
- `cd mobile && bun test tests/live/liveSessionViewerPlaybackMachine.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionViewerPlaybackRuntime.test.ts`
- `cd mobile && bun run typecheck`

**Commit Boundary:**
- Commit after playback display state is machine-driven and controller/runtime tests pass.

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
- Retained refresh rows still merge without duplicating or dropping events.
- Realtime timeline events are still merged and ordered by existing helpers.
- Realtime event updates/removals still route through the existing timeline merge semantics.
- Channel status still renders idle, joining, joined, errored, and closed states.
- Sending is allowed only when the channel is joined and no send is already pending.
- Send success clears pending send status.
- Send failure stores the same viewer-safe error text.
- Channel close or error fails an active send with the existing disconnect text.
- Unmount cancellation clears pending send without creating an erroneous visible failure.

**Machine Boundary:**
- Owns chat channel status, channel error, send status, and send error.
- Does not own timeline rows, page info, retained history cursors, or realtime event merge data.
- Does not own the channel client object or socket disconnect function.

**Reducer Boundary After Migration:**
- The existing chat reducer remains responsible for retained history, realtime rows, ordering, and page info.
- If the remaining reducer name becomes misleading, rename it in the same task or defer that rename to final cleanup with tests.

**Watch Screen Integration:**
- Keep `LiveSessionChatPanel` props unchanged.
- Replace channel/send reducer actions with machine events.
- Keep chat channel lifecycle helper behavior unchanged.
- Keep pending send token/ref logic outside the machine if it still protects async send completion ordering.

**Tests To Add Or Update:**
- Machine transition tests for joining, joined, closed, errored.
- Machine transition tests for send started, succeeded, failed, cancelled.
- Machine test for channel close/error failing a pending send.
- Reducer tests proving retained history and realtime row merging still work.
- Panel tests proving prop-driven rendering is unchanged.
- Existing channel lifecycle tests proving socket/channel cleanup remains correct.

**Verification:**
- `cd mobile && bun test tests/live/liveSessionChatChannelMachine.test.ts tests/live/liveSessionChatReducer.test.ts tests/live/LiveSessionChatPanel.test.ts tests/live/liveSessionChatChannelLifecycle.test.ts`
- `cd mobile && bun run typecheck`

**Commit Boundary:**
- Commit after channel/send status is machine-driven and chat tests pass.

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
- Prepare-media failure clears prepared media and shows the same viewer-safe error text.
- Go live requires host readiness, backend media readiness, prepared media, and no go-live request in flight.
- Retryable media-readiness go-live failures keep prepared media so the host can retry.
- Non-retryable go-live failures clear prepared media.
- If go-live succeeds but publishing resource retention fails, the backend live session is ended.
- Back press and unmount cleanup still end abandoned preflight sessions where needed.
- Native resources are disposed only when no retained publishing resource exists.
- Auth-loss publishing cleanup behavior remains in the existing publishing modules.

**Machine Boundary:**
- Owns session/action workflow state: idle, creating, starting, preparing media, ready to publish, going live, live, ending, ended, errored where useful.
- Owns viewer-safe error text and simple readiness flags that drive card props.
- Does not own prepared media payload objects, native media handles, retained publishing resources, sockets, WebRTC runtimes, or navigation functions.

**Controller Boundary:**
- Continues to request native permissions and preview readiness.
- Continues to call Relay mutations for start, prepare, go-live, and end.
- Continues to call publishing controller methods for prepared media and retained resources.
- Sends machine events when mutation/native/publishing results arrive.
- Derives card props from selectors instead of several independent local booleans.

**Tests To Add Or Update:**
- Machine tests for create session requested/succeeded/failed.
- Machine tests for media prepare requested/succeeded/failed.
- Machine tests for publishing ready/failed.
- Machine tests for go-live requested/succeeded.
- Machine tests for retryable go-live failure preserving prepared-media eligibility.
- Machine tests for non-retryable go-live failure clearing prepared-media eligibility.
- Machine tests for end requested/succeeded/failed.
- Controller tests for abandoned cleanup on unmount.
- Controller tests for retain failure causing backend session end.
- Controller tests for native disposal when no retained publishing resource exists.

**Verification:**
- `cd mobile && bun test tests/host/hostBroadcastPreflightMachine.test.ts tests/host/useHostBroadcastPreflightController.test.ts tests/host/useHostBroadcastPublishingController.test.ts tests/host/hostBroadcastPreflight.test.ts tests/host/hostBroadcastSession.test.ts`
- `cd mobile && bun run typecheck`

**Commit Boundary:**
- Commit after host focused tests pass.

## Task 7: Final Cleanup And Quality Gate

**Files:**
- Modify/delete only after consumer search: `mobile/src/live/liveSessionWatchReducer.ts`
- Modify/delete only after consumer search: `mobile/tests/live/liveSessionWatchReducer.test.ts`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/src/live/chat/liveSessionChatState.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify only when this batch is active or closing: `docs/plans/mobile/NOW.md`
- Modify if lane ordering changes: `docs/plans/mobile/TRACK.md`

**Cleanup Checklist:**
- Search for old watch reducer exports before deleting them.
- Search for now-obsolete chat channel/send reducer actions before deleting them.
- Remove unused type aliases from `liveSessionWatchScreenTypes.ts`.
- Delete wrapper-only files that no longer preserve a route/test import contract.
- Keep public route/screen entrypoints only where Expo Router or tests still depend on them.
- Update lane docs only if this plan was promoted to the current mobile batch.

**Verification:**
- `cd mobile && bun run test:quality`
- `cd mobile && bun run typecheck`
- `git diff --check`

**Commit Boundary:**
- Commit final cleanup only after the full mobile quality gate passes.

## Coverage Map

This plan addresses:

- viewer membership and mutation flow: Tasks 2 and 3;
- detached leave and unmount cleanup: Task 3;
- realtime membership loss and ended-session cleanup: Task 3;
- viewer playback status and stale generation safety: Task 4;
- chat channel/send status: Task 5;
- retained chat timeline and realtime row merging preservation: Task 5;
- host preflight create/prepare/go-live/end workflow: Task 6;
- retained host publishing resource boundaries: Tasks 3 and 6;
- dependency and local convention setup: Task 1;
- stale reducer/wrapper cleanup and full gates: Task 7.

This plan intentionally leaves these areas alone:

- Relay environment and generated artifacts;
- auth provider/session bootstrap;
- profile screens;
- app routing;
- native WebRTC runtime internals except where playback/preflight controllers already integrate them.

## Review Checkpoints

At each commit boundary, review for:

- machine context contains only serializable workflow state;
- side effects remain in hooks/adapters;
- screens consume selectors or controller return values instead of raw machine internals;
- tests cover both legal transitions and rejected/stale transitions;
- no broad `as` casts were introduced to force XState types through;
- no second server-state system was introduced;
- no tests moved back into `mobile/src/**`;
- no unrelated UI redesign or copy changes were included.

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
- If any focused test failure exposes behavior drift rather than outdated test setup, stop and preserve the old behavior unless the user explicitly approves a product behavior change.

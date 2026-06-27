# Mobile TypeScript Quality And Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce hand-written TypeScript ceremony in the mobile app, especially live broadcasts, by moving boundary validation, generated Relay shapes, native runtime adapters, and state-machine plumbing into focused modules with clear conventions.

**Architecture:** Keep strict TypeScript. Keep `unknown` and runtime shape checks at external boundaries only: Relay payload readers, Phoenix payload normalizers, native WebRTC adapters, and raw fetch response readers. Screens should compose typed controllers and presentation models, not define long chains of generated types, ref-backed lifecycle state, callback payload shapes, or native shim types. Preserve the existing public import shims because Bun mocks and route modules rely on those seams.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, Relay, Phoenix Channels, react-native-webrtc, Bun tests.

---

## Audit Summary

The mobile live/host code is strict and generally avoids `any`, which is good. The readability issue is not unsound typing; it is too much manual boundary typing living in files that also implement user flows.

Largest live/host files after the structure split:

- `mobile/src/live/watch/LiveSessionWatchScreen.tsx`: 1419 lines.
- `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`: 851 lines.
- `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`: 728 lines.
- `mobile/src/live/liveSessionChatReducer.ts`: 677 lines.
- `mobile/src/host/hostBroadcastPublishingRuntime.ts`: 525 lines.
- `mobile/src/host/hostBroadcastPublishingSession.ts`: 379 lines.
- `mobile/src/live/liveSessionRealtimeEvents.ts`: 334 lines.

The most type-heavy files by quick pattern count are:

- `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`: 58 matches for `unknown`, `ReadonlyArray`, `Record`, utility types, and casts.
- `mobile/src/live/watch/LiveSessionWatchScreen.tsx`: 53 matches.
- `mobile/src/live/liveSessionChatReducer.ts`: 37 matches.
- `mobile/src/host/hostBroadcastMediaSignaling.ts`: 36 matches.
- `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`: 29 matches.
- `mobile/src/host/hostBroadcastPublishingRuntime.ts`: 26 matches.
- `mobile/src/live/liveSessionRealtimeEvents.ts`: 26 matches.

This is expected around Phoenix and WebRTC boundaries. The cleanup target is to contain that complexity and remove repeated local variants.

## Findings

1. Shared live media payload code is duplicated between host and viewer.

   `mobile/src/host/hostBroadcastMediaSignaling.ts:4` defines prepare-media source types, ICE server types, offer payload builders, ICE candidate payload builders, optional string/integer readers, and record guards. `mobile/src/live/liveSessionViewerPlaybackRuntime.ts:8` repeats the same concepts for the viewer side, including ICE server normalization at `mobile/src/live/liveSessionViewerPlaybackRuntime.ts:611` and candidate normalization at `mobile/src/live/liveSessionViewerPlaybackRuntime.ts:673`.

   The role-specific difference is mostly offer vs answer plus host-only channel-topic validation. The common pieces should be shared.

2. Native WebRTC adapter types are mixed into runtime logic.

   `mobile/src/live/liveSessionViewerPlaybackRuntime.ts:153`, `mobile/src/host/hostBroadcastPublishingRuntime.ts:96`, and `mobile/src/host/hostBroadcastNative.ts:43` each declare a local `ReactNativeWebRtcModule` shape and `require('react-native-webrtc')` boundary. That typing belongs in a small adapter module so runtime files can focus on negotiation.

3. Screens are still controller-heavy.

   `mobile/src/live/watch/LiveSessionWatchScreen.tsx:481` through `mobile/src/live/watch/LiveSessionWatchScreen.tsx:712` owns viewer playback preparation, WebSocket creation, runtime creation, generation tracking, and disposal. `mobile/src/live/watch/LiveSessionWatchScreen.tsx:714` through `mobile/src/live/watch/LiveSessionWatchScreen.tsx:968` owns chat channel lifecycle and ended-session cleanup. Mutation handlers then run from `mobile/src/live/watch/LiveSessionWatchScreen.tsx:970` through `mobile/src/live/watch/LiveSessionWatchScreen.tsx:1368`.

   `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx:191` through `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx:203` sets up many lifecycle refs, and `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx:624` through `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx:813` owns host publishing runtime setup. These are state machines; they should become controller hooks or service modules with typed command/result APIs.

4. Phoenix payload normalization is central but too broad.

   `mobile/src/live/liveSessionRealtimeEvents.ts:67` is the right boundary for `unknown` Phoenix payloads, but it mixes session state, retained timeline events, media offer/answer, ICE candidates, viewer-ready events, and primitive guard helpers in one module. That encourages other files to consume broad event unions and then re-check `event.kind` and `senderRole`.

5. Chat reducer owns reducer state, selectors, ordering, retained refresh reconciliation, realtime row mapping, and page-info merging.

   `mobile/src/live/liveSessionChatReducer.ts:31` defines the action union; `mobile/src/live/liveSessionChatReducer.ts:273` through `mobile/src/live/liveSessionChatReducer.ts:677` contains collection, ordering, realtime mapping, and page-info helpers. This makes the reducer hard to scan and makes small changes look riskier than they are.

6. Relay-generated types leak into feature screen shape definitions.

   `mobile/src/live/watch/liveSessionWatchScreenTypes.ts:7` aliases `LiveSessionWatchScreenQuery['response']`, then derives `LiveSessionNode` with `Extract<NonNullable<...>>` at `mobile/src/live/watch/liveSessionWatchScreenTypes.ts:19`. That is type-safe, but it pushes generated artifact mechanics into screen-level code. Generated types should be consumed in operation/reader modules, then converted to feature-owned domain shapes.

7. Tests duplicate complex fake runtime contracts.

   `mobile/tests/live/liveSessionViewerPlaybackRuntime.test.ts:19` and `mobile/tests/host/hostBroadcastPublishingRuntime.test.ts:19` duplicate `FakePush`, `FakeChannel`, and deferred promise helpers. Both test suites also hand-model peer connection shapes. Shared test support under `mobile/tests/live/support/**` or `mobile/tests/host/support/**` would reduce noise while preserving coverage.

## Conventions To Adopt

- **Use `unknown` only at input boundaries.** Allowed boundary files: Phoenix payload normalizers, raw fetch response readers, native module adapters, WebRTC `toJSON()` readers, and Relay payload readers. Screen and presentation files should not introduce new `unknown` types except in `catch (error: unknown)`.
- **Prefer feature-owned domain types over generated type expressions in screens.** Generated Relay artifacts should be read by `*.operations.ts` or `*.readers.ts` modules that export small domain shapes.
- **Name runtime contracts once.** Shared WebRTC types should live in one module, then host/viewer runtimes should import role-specific aliases when needed.
- **Keep type guards with the external format they validate.** Snake-case Phoenix payload validation belongs in realtime/media payload modules; camel-case UI/domain rows belong in feature presentation or reducer modules.
- **Use discriminated result objects for async work.** Continue returning `{ status: 'started' } | { status: 'error'; reason: string }` for non-throwing UI paths, but define shared result types instead of repeating them.
- **Avoid utility-type chains in component props.** If a component needs `Extract<...>` or `NonNullable<...>`, create a named feature type in a reader/type module and import that.
- **Keep compatibility shims.** Existing top-level files in `mobile/src/live/**`, `mobile/src/host/**`, and `mobile/src/components/**` should continue re-exporting moved modules until tests and routes are migrated intentionally.
- **Keep tests out of source.** New coverage belongs under `mobile/tests/**`.

## Target Folder Shape

- `mobile/src/live/media/liveMediaTypes.ts`
  Shared `LiveMediaSessionDescription`, `LiveMediaIceCandidate`, `LiveMediaIceServer`, `LiveMediaPreparationBase`, `LiveMediaStartResult`, and WebRTC-facing config shapes.
- `mobile/src/live/media/liveMediaPayloads.ts`
  Shared offer/answer/ICE payload builders, snake-case/camel-case candidate normalization, optional string/integer readers, and primitive guards.
- `mobile/src/live/media/liveMediaPreparation.ts`
  Shared prepare-media payload readers plus host/viewer role-specific wrappers.
- `mobile/src/live/media/liveWebRtcAdapter.ts`
  One `react-native-webrtc` module boundary for `RTCPeerConnection` and `mediaDevices`.
- `mobile/src/live/realtime/liveSessionRealtimeMediaEvents.ts`
  Media-specific Phoenix event normalization currently inside `liveSessionRealtimeEvents.ts`.
- `mobile/src/live/realtime/liveSessionRealtimeTimelineEvents.ts`
  Timeline/session-state event normalization currently inside `liveSessionRealtimeEvents.ts`.
- `mobile/src/live/playback/liveSessionViewerPlaybackRuntime.ts`
  Viewer runtime orchestration only, importing shared media types/payload helpers.
- `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
  Query/mutation-driven viewer playback lifecycle currently inside the watch screen.
- `mobile/src/live/watch/hooks/useLiveSessionChatChannelController.ts`
  Chat channel lifecycle currently inside the watch screen.
- `mobile/src/live/chat/liveSessionChatState.ts`
  Chat action/state/result types and reducer entrypoint.
- `mobile/src/live/chat/liveSessionChatTimelineMerge.ts`
  Retained/realtime merge, ordering, and page-info helpers.
- `mobile/src/live/chat/liveSessionChatSelectors.ts`
  Selectors and `canStartLiveSessionChatSend`.
- `mobile/src/host/publishing/hostBroadcastPublishingRuntime.ts`
  Host runtime orchestration only, importing shared media/WebRTC types.
- `mobile/src/host/publishing/hostBroadcastPublishingSessionStore.ts`
  Retained publishing resource store and disposal helpers.
- `mobile/src/host/publishing/hostBroadcastPublishingAuthCleanup.ts`
  Auth-loss GraphQL cleanup and raw response validation.
- `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
  Native readiness, create/prepare/go-live/end handlers, and navigation-safe cleanup state.
- `mobile/src/host/preflight/hooks/useHostBroadcastPublishingController.ts`
  Host publishing runtime effect currently inside the preflight screen.
- `mobile/tests/live/support/fakeLiveSessionChannel.ts`
  Shared fake Phoenix channel/push fixtures.
- `mobile/tests/live/support/fakeWebRtcPeerConnection.ts`
  Shared fake peer connection/deferred helpers for host and viewer runtime tests.

## Implementation Plan

### Task 1: Extract Shared Live Media Payload Contracts

**Files:**
- Create: `mobile/src/live/media/liveMediaTypes.ts`
- Create: `mobile/src/live/media/liveMediaPayloads.ts`
- Modify: `mobile/src/host/hostBroadcastMediaSignaling.ts`
- Modify: `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`
- Modify: `mobile/tests/host/hostBroadcastMediaSignaling.test.ts`
- Modify: `mobile/tests/live/liveSessionViewerPlaybackRuntime.test.ts`

- [x] Add shared `LiveMediaSessionDescription`, `LiveMediaIceCandidateSource`, `LiveMediaIceCandidatePayload`, `LiveMediaIceServerSource`, and `LiveMediaIceServer` types.
- [x] Move `isRecord`, `isNonBlankString`, `readOptionalString`, `readOptionalNonNegativeInteger`, candidate `toJSON()` handling, and ICE server normalization into shared media files.
- [x] Keep host/viewer public exports in place by re-exporting or wrapping shared helpers with existing names.
- [x] Run `cd mobile && bun test tests/host/hostBroadcastMediaSignaling.test.ts tests/live/liveSessionViewerPlaybackRuntime.test.ts`.
- [x] Run `cd mobile && bun run typecheck`.
- [x] Commit with a message like `Extract mobile live media payload helpers`.

### Task 2: Centralize WebRTC Adapter Types

**Files:**
- Create: `mobile/src/live/media/liveWebRtcAdapter.ts`
- Modify: `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`
- Modify: `mobile/src/host/hostBroadcastPublishingRuntime.ts`
- Modify: `mobile/src/host/hostBroadcastNative.ts`
- Modify: `mobile/tests/live/liveSessionViewerPlaybackRuntime.test.ts`
- Modify: `mobile/tests/host/hostBroadcastPublishingRuntime.test.ts`
- Modify: `mobile/tests/host/hostBroadcastNative.test.ts`

- [x] Move the local `ReactNativeWebRtcModule` declarations and guarded `require('react-native-webrtc')` loading into `liveWebRtcAdapter.ts`.
- [x] Export narrow factory functions for peer connection creation and media device lookup.
- [x] Keep runtime constructor injection for tests; only default factory loading should move.
- [x] Run `cd mobile && bun test tests/live/liveSessionViewerPlaybackRuntime.test.ts tests/host/hostBroadcastPublishingRuntime.test.ts tests/host/hostBroadcastNative.test.ts`.
- [x] Run `cd mobile && bun run typecheck`.
- [x] Commit with a message like `Centralize mobile WebRTC adapter typing`.

### Task 3: Split Viewer Playback Runtime From Viewer Playback Controller

**Files:**
- Create: `mobile/src/live/playback/liveSessionViewerPlaybackRuntime.ts`
- Create: `mobile/src/live/playback/liveSessionViewerPlaybackPreparation.ts`
- Create: `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Modify: `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/tests/live/liveSessionViewerPlaybackRuntime.test.ts`

- [ ] Move pure preparation readers and payload builders out of the runtime module while preserving current public exports from `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`.
- [ ] Move `startViewerPlayback`, generation checks, resource disposal, and mutation callback plumbing from the watch screen into `useLiveSessionViewerPlaybackController`.
- [ ] The hook should expose `{ viewerPlaybackState, start/stop behavior through effects }` or a similarly small typed API, so the screen no longer carries WebRTC lifecycle details.
- [ ] Keep the current watch screen UI and behavior unchanged.
- [ ] Run `cd mobile && bun test tests/live/liveSessionViewerPlaybackRuntime.test.ts tests/live/LiveDiscoveryScreen.test.ts`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Commit with a message like `Extract viewer playback controller`.

### Task 4: Split Host Publishing Runtime And Preflight Controller

**Files:**
- Create: `mobile/src/host/publishing/hostBroadcastPublishingRuntime.ts`
- Create: `mobile/src/host/publishing/hostBroadcastPublishingSessionStore.ts`
- Create: `mobile/src/host/publishing/hostBroadcastPublishingAuthCleanup.ts`
- Create: `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
- Create: `mobile/src/host/preflight/hooks/useHostBroadcastPublishingController.ts`
- Modify: `mobile/src/host/hostBroadcastPublishingRuntime.ts`
- Modify: `mobile/src/host/hostBroadcastPublishingSession.ts`
- Modify: `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`
- Modify: `mobile/tests/host/hostBroadcastPublishingRuntime.test.ts`
- Modify: `mobile/tests/host/hostBroadcastPublishingSession.test.ts`

- [ ] Move retained resource store and auth-loss raw GraphQL response validation out of `hostBroadcastPublishingSession.ts`.
- [ ] Move host runtime implementation under `host/publishing`, leaving the top-level file as a public shim.
- [ ] Move native readiness, start/prepare/go-live/end handlers, and cleanup refs into preflight hooks with explicit typed return values for card props.
- [ ] Keep route navigation and card rendering in `HostBroadcastPreflightScreen.tsx`.
- [ ] Run `cd mobile && bun test tests/host`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Commit with a message like `Extract host publishing controllers`.

### Task 5: Split Realtime Event Normalization

**Files:**
- Create: `mobile/src/live/realtime/liveSessionRealtimeTypes.ts`
- Create: `mobile/src/live/realtime/liveSessionRealtimePayloadGuards.ts`
- Create: `mobile/src/live/realtime/liveSessionRealtimeMediaEvents.ts`
- Create: `mobile/src/live/realtime/liveSessionRealtimeTimelineEvents.ts`
- Modify: `mobile/src/live/liveSessionRealtimeEvents.ts`
- Modify: `mobile/src/live/liveSessionChannelClient.ts`
- Modify: `mobile/src/host/hostBroadcastPublishingRuntime.ts`
- Modify: `mobile/src/live/liveSessionViewerPlaybackRuntime.ts`
- Modify: `mobile/tests/live/liveSessionRealtimeEvents.test.ts`
- Modify: `mobile/tests/live/liveSessionChannelClient.test.ts`

- [ ] Split the current broad normalizer into media, timeline, session-state, and primitive guard modules.
- [ ] Keep `normalizeLiveSessionRealtimeEvent` as the public compatibility entrypoint until callers are migrated.
- [ ] Add role-specific helpers such as `readHostMediaOfferEvent` and `readViewerMediaAnswerEvent` so runtimes do not repeat `event.kind` plus `senderRole` checks inline.
- [ ] Run `cd mobile && bun test tests/live/liveSessionRealtimeEvents.test.ts tests/live/liveSessionChannelClient.test.ts tests/host/hostBroadcastPublishingRuntime.test.ts tests/live/liveSessionViewerPlaybackRuntime.test.ts`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Commit with a message like `Split live realtime event normalizers`.

### Task 6: Split Chat Reducer Helpers And Selectors

**Files:**
- Create: `mobile/src/live/chat/liveSessionChatState.ts`
- Create: `mobile/src/live/chat/liveSessionChatTimelineMerge.ts`
- Create: `mobile/src/live/chat/liveSessionChatSelectors.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/tests/live/liveSessionChatReducer.test.ts`

- [ ] Keep the public reducer import working from `mobile/src/live/liveSessionChatReducer.ts`.
- [ ] Move merge/order/page-info helpers into `liveSessionChatTimelineMerge.ts`.
- [ ] Move selectors and send-start predicates into `liveSessionChatSelectors.ts`.
- [ ] Keep action/state types in one state module so reducer tests can import stable names.
- [ ] Run `cd mobile && bun test tests/live/liveSessionChatReducer.test.ts tests/live/LiveSessionChatPanel.test.ts`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Commit with a message like `Split live chat reducer helpers`.

### Task 7: Introduce Relay Reader Modules For Live Screens

**Files:**
- Create: `mobile/src/live/watch/liveSessionWatchOperations.ts`
- Create: `mobile/src/live/watch/liveSessionWatchData.ts`
- Create: `mobile/src/host/preflight/hostBroadcastPreflightOperations.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/src/host/preflight/HostBroadcastPreflightScreen.tsx`
- Modify: `mobile/tests/live/liveSessionTimelineHistory.test.ts`

- [ ] Move GraphQL documents and generated artifact imports out of the main screen files where doing so does not break Relay compiler expectations.
- [ ] Add reader/domain modules that export screen-owned types such as `LiveSessionWatchModel` instead of exposing `Extract<NonNullable<Query['response']['node']>>` in screen code.
- [ ] Keep generated artifact imports close to the GraphQL documents or reader modules.
- [ ] Run `cd mobile && bun run relay` if GraphQL documents move.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Run `cd mobile && bun test tests/live/liveSessionTimelineHistory.test.ts`.
- [ ] Commit with a message like `Move live Relay screen readers`.

### Task 8: Extract Shared Runtime Test Fixtures

**Files:**
- Create: `mobile/tests/live/support/fakeLiveSessionChannel.ts`
- Create: `mobile/tests/live/support/fakeWebRtcPeerConnection.ts`
- Modify: `mobile/tests/live/liveSessionViewerPlaybackRuntime.test.ts`
- Modify: `mobile/tests/host/hostBroadcastPublishingRuntime.test.ts`

- [ ] Move duplicated `FakePush`, `FakeChannel`, and deferred promise helpers into support files under `mobile/tests/**`.
- [ ] Move common fake peer-connection behavior into a shared fixture with role-specific offer/answer defaults.
- [ ] Keep assertions in the runtime test files; only test plumbing should move.
- [ ] Run `cd mobile && bun test tests/live/liveSessionViewerPlaybackRuntime.test.ts tests/host/hostBroadcastPublishingRuntime.test.ts`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Commit with a message like `Share mobile live runtime test fixtures`.

### Task 9: Final Verification And Docs

**Files:**
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`

- [ ] Update this plan's checkboxes as tasks are completed.
- [ ] Run `cd mobile && bun run test:quality`.
- [ ] Run `cd mobile && bun test tests/auth tests/profile tests/config`.
- [ ] Run `cd mobile && bun run typecheck`.
- [ ] Run `git diff --check`.
- [ ] Commit the final docs/checklist update.

## Execution Notes

- Do not combine all tasks into one commit. Each task has enough surface area to deserve its own milestone commit.
- Preserve public import shims while moving implementation files. Recent Bun tests mocked public modules and failed when nested imports bypassed those public seams.
- This plan intentionally starts with shared media payload helpers before hooks. That gives the screen extraction a smaller, clearer type surface.
- Do not introduce a validation library yet. The duplicated guards are simple enough to consolidate without adding runtime dependencies.
- Do not change backend GraphQL schema, media signaling topics, Relay ID handling, or Phoenix event names in this cleanup batch.

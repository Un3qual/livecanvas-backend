# Mobile Pre-Beta Product Completeness

Last reviewed: 2026-06-24

Executor brief: beta distribution was premature until the app could prove the
core live product loop on device. The mobile app now has auth, profiles, live
discovery/watch shell, host preflight, host/viewer media setup preparation,
go-live retry handling, realtime chat, retained chat history, host WebRTC
publishing, viewer playback, and a repeatable one-host/one-viewer smoke
checklist.

This plan is complete. Return to
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md` for beta
quality-gate and build mechanics work.

## Write Scope

- Mobile lane docs: `docs/plans/mobile/**`
- Mobile app code: `mobile/**`
- Backend/shared contract docs only when a promoted backend lane batch changes
  the mobile-facing media API
- Backend Elixir/GraphQL code is out of mobile-lane scope unless the coordinator
  explicitly promotes a backend batch

## Product Blockers

Closed by this plan:

- Viewer playback: closed by Task 4 with media signaling setup, answer
  creation, ICE exchange, remote rendering, disconnect cleanup, and
  ended-session teardown.
- Device smoke path: closed by Task 5 with the checklist below.
- Beta mechanics: unblocked for
  `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`; do not
  implement those mechanics in this completed pre-beta plan.

## Progress

- [x] Task 1: Reclassify the active lane from beta release mechanics to
  pre-beta product completeness and record the blocking evidence.
- [x] Task 2: Promote or implement viewer media setup contract.
- [x] Task 3: Implement host WebRTC publishing runtime.
- [x] Task 4: Implement viewer playback runtime.
- [x] Task 5: Add device smoke coverage and return to beta release mechanics.

## Task 1: Lane Reclassification And Blocker Evidence

Status: complete in this docs pass.

Evidence checked on 2026-06-24:

- `mobile/src/host/HostBroadcastPreflightScreen.tsx` creates host sessions,
  prepares media setup, and retries `goLiveSession`, but does not create a
  peer connection, push `media:offer`, or consume viewer answers.
- `mobile/src/host/hostBroadcastNative.ts` obtains and disposes a local preview
  stream, but does not expose tracks to a publishing runtime.
- `mobile/src/live/LiveSessionWatchScreen.tsx` joins/leaves sessions and wires
  realtime chat, but does not join media signaling or render remote media.
- `mobile/schema.graphql` exposes `signalingTopic` only on
  `prepareLiveMediaSession`.
- `lib/live_canvas_gql/live/live_resolver.ex` now authorizes
  `prepare_live_media_session/3` for hosts and active joined viewers, with
  current join authorization rechecked before returning media setup.
- `lib/live_canvas_web/channels/live_session_channel.ex` marks media readiness
  only after a backend-observed host offer and viewer answer on the authorized
  media-signaling topic.

Verification for this docs pass:

```bash
git diff --check
```

## Task 2: Viewer Media Setup Contract

Status: complete on 2026-06-24.

Goal: give viewers an authorized media setup path before mobile implements
playback.

Decision: extend the existing Relay-style `prepareLiveMediaSession` mutation so
it remains the single setup contract for both hosts and active joined viewers.
Hosts can prepare their own non-ended sessions. Non-host viewers can prepare
only after they have an active live participant row, and the viewer path
rechecks current join authorization before returning `signalingTopic` or ICE
servers.

Completion evidence:

- `test/live_canvas_gql/live/live_mutations_test.exs` covers host success,
  unauthenticated access, malformed and wrong-type Relay IDs, active joined
  viewer success, non-joined viewer rejection, hidden foreign session rejection,
  stale host and viewer suspension rejection, ICE provider failures, and
  ended-session rejection.
- `docs/contracts/mobile-live-media-signaling.md` documents that mobile clients
  must use the returned opaque `signalingTopic` and must not construct or parse
  media topics client-side.
- `mobile/schema.graphql` and generated Relay artifacts did not need refresh
  because the schema shape did not change.
- No remaining lifecycle blocker was found for setup: `joinLiveSession` and the
  live-session channel can create active participant rows before `LIVE`; media
  readiness still requires a backend-observed host offer plus viewer answer.

Verification:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
# 69 tests, 0 failures
mix typecheck
# Total errors: 0, Skipped: 0, Unnecessary Skips: 0
```

Resolved decision context:

- Either add a backend-supported viewer setup mutation/field that returns the
  opaque media `signalingTopic` and ICE server list for authorized joined
  viewers, or intentionally extend the existing mutation contract so
  non-host active participants can prepare viewer media.

Mobile constraints:

- Do not decode Relay IDs.
- Do not construct `live_session_media:<id>` in mobile code.
- Do not join media signaling from `LiveSession.channelTopic`; the media topic
  is separate.
- Preserve viewer authorization on every globally refetchable path.

Likely backend write scope if promoted:

- `lib/live_canvas_gql/live/live_mutations.ex`
- `lib/live_canvas_gql/live/live_resolver.ex`
- `test/live_canvas_gql/live/live_mutations_test.exs`
- `docs/contracts/mobile-live-media-signaling.md`
- `mobile/schema.graphql` and generated Relay artifacts after schema refresh

Done condition: mobile has a documented, Relay-first, viewer-authorized setup
contract for obtaining media signaling setup, and the lane can implement viewer
playback without parsing backend topic internals.

Verification if backend scope is promoted:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
```

## Task 3: Host WebRTC Publishing Runtime

Status: complete on 2026-06-24.

Goal: make the host actually publish local audio/video through the completed
media signaling contract.

Completion evidence:

- `mobile/src/host/hostBroadcastNative.ts` exposes the cached preview stream so
  the publishing runtime reuses the same local tracks and keeps disposal
  idempotent.
- `mobile/src/host/hostBroadcastMediaSignaling.ts` validates host offer and ICE
  payloads before pushes and keeps ICE candidate keys in the backend signaling
  contract's snake_case shape.
- `mobile/src/host/hostBroadcastPublishingRuntime.ts` joins the opaque
  `signalingTopic`, creates an injected peer connection from prepared ICE
  servers, attaches local tracks, pushes host offers and local ICE candidates,
  applies viewer answers and viewer ICE candidates, reports negotiation
  readiness after a viewer answer is applied, and disposes the channel, peer
  connection, and native media cleanup path once.
- `mobile/src/host/HostBroadcastPreflightScreen.tsx` starts host publishing
  after media preparation and only marks backend media readiness for
  `goLiveSession` retry after the publishing runtime applies a viewer answer.
- `mobile/src/host/HostBroadcastPublishingSessionProvider.tsx` retains the host
  publishing resource across the preflight-to-live route replacement, and
  `mobile/src/live/LiveSessionWatchScreen.tsx` releases any retained host
  publishing resource after successful leave or when the live session is
  observed as ended.
- `mobile/src/host/hostBroadcastPublishingRuntime.ts` also reports
  media-signaling channel termination so retained hosts who have not joined the
  viewer channel still release publishing resources when backend session control
  closes the media channel.

TDD evidence:

- Red: `bun test mobile/src/host/hostBroadcastNative.test.ts` failed with
  `native.getPreviewStream is not a function`.
- Red: `bun test mobile/src/host/hostBroadcastMediaSignaling.test.ts` failed
  with missing host payload helper exports.
- Red: `bun test mobile/src/host/hostBroadcastPublishingRuntime.test.ts` failed
  because `hostBroadcastPublishingRuntime` did not exist.
- Green: focused host tests passed after each implementation step.

Expected mobile write scope:

- `mobile/src/host/hostBroadcastNative.ts`
- `mobile/src/host/hostBroadcastNative.test.ts`
- `mobile/src/host/hostBroadcastMediaSignaling.ts`
- `mobile/src/host/hostBroadcastMediaSignaling.test.ts`
- new focused host WebRTC runtime module and tests under `mobile/src/host/`
- `mobile/src/host/HostBroadcastPreflightScreen.tsx`

Behavior:

- Preserve the local preview stream long enough to attach tracks to a peer
  connection.
- Join the opaque `signalingTopic` returned by media setup.
- Create a peer connection from the returned ICE server list.
- Push a validated `media:offer` from the host.
- Push local ICE candidates as `media:ice_candidate`.
- Consume viewer `media:answer` and viewer ICE candidates.
- Retry `goLiveSession` only after the viewer answer path has made backend
  readiness observable.
- Dispose tracks, channel subscriptions, and peer connection state when the host
  backs out or the session ends.

Verification:

```bash
bun test mobile/src/host mobile/src/live/liveSessionRealtimeEvents.test.ts
cd mobile && ./node_modules/.bin/tsc --noEmit
git diff --check
```

## Task 4: Viewer Playback Runtime

Status: complete on 2026-06-24.

Goal: make joined viewers receive and render host media.

Completion evidence:

- `mobile/src/live/liveSessionViewerPlaybackRuntime.ts` validates the viewer
  prepare-media payload, preserves the opaque `signalingTopic`, joins the media
  signaling channel, answers host `media:offer` events, pushes viewer
  `media:answer`, exchanges ICE candidates, reports remote streams, and
  disposes channel and peer-connection resources idempotently.
- `mobile/src/live/LiveSessionWatchScreen.tsx` prepares viewer media only after
  `joinLiveSession` succeeds, starts viewer playback with the returned
  `signalingTopic`, renders the remote stream through `RTCView`, and tears down
  playback on explicit leave, unmount/auto-leave, channel termination, or ended
  session state while preserving the existing host publishing release hooks.
- `mobile/src/live/__generated__/LiveSessionWatchScreenPrepareMediaMutation.graphql.ts`
  was generated from the new viewer prepare-media operation.

TDD evidence:

- Red: `bun test mobile/src/live/liveSessionViewerPlaybackRuntime.test.ts`
  failed because `liveSessionViewerPlaybackRuntime` did not exist.
- Green: the focused viewer runtime test passed with 10 tests covering prepare
  payload normalization, viewer answer and ICE payloads, opaque signaling topic
  join, host offer handling, local and remote ICE, remote stream delivery,
  channel termination cleanup, and disposed-during-answer race behavior.

Verification:

```bash
bun test mobile/src/live/liveSessionViewerPlaybackRuntime.test.ts
# 10 pass, 0 fail
bun test mobile/src/live
# 86 pass, 0 fail
bun test mobile/src/live mobile/src/relay mobile/src/realtime
# 92 pass, 0 fail
cd mobile && ./node_modules/.bin/tsc --noEmit
# exit 0
git diff --check
# exit 0
```

Expected mobile write scope:

- `mobile/src/live/LiveSessionWatchScreen.tsx`
- new focused viewer WebRTC runtime module and tests under `mobile/src/live/`
- `mobile/src/live/liveSessionChannelClient.ts`
- `mobile/src/live/liveSessionChannelClient.test.ts`
- `mobile/src/live/liveSessionRealtimeEvents.ts`
- `mobile/src/live/liveSessionRealtimeEvents.test.ts`

Behavior:

- After a successful `joinLiveSession`, obtain viewer media setup through the
  approved contract from Task 2.
- Join the opaque media signaling topic.
- Consume host `media:offer`.
- Create and push a viewer `media:answer`.
- Push local ICE candidates and consume host ICE candidates.
- Render the remote media stream in the watch screen.
- Tear down playback on leave, unmount, channel close, or ended-session events.

Verification:

```bash
bun test mobile/src/live mobile/src/relay mobile/src/realtime
cd mobile && ./node_modules/.bin/tsc --noEmit
```

## Task 5: Device Smoke And Beta Mechanics Return

Status: complete on 2026-06-24.

Goal: move back to beta release readiness only after the core media loop exists.

Completion evidence:

- Tasks 2-4 closed the viewer setup contract, host publishing runtime, and
  viewer playback runtime blockers.
- The checklist below captures the minimum manual device/simulator smoke path
  for one host and one viewer before beta build mechanics resume.
- `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md` is active
  again, with Task 1 promoted as the next executable batch.

Smoke checklist for one host and one viewer:

1. Host auth: launch the custom development build on the host device or
   simulator, sign in as the host account, and confirm the authenticated home
   state is visible.
2. Viewer auth: launch the custom development build on the viewer device or
   simulator, sign in as a different viewer account, and confirm the
   authenticated home state is visible.
3. Host preflight and permissions: start the host broadcast flow, allow camera
   and microphone permissions, and confirm the local preview renders before
   publishing.
4. Live discovery: from the viewer account, open live discovery and confirm the
   host session appears with the expected title/host metadata.
5. Host media publish and readiness retry: start publishing from preflight,
   verify the app prepares media with the returned opaque signaling topic, and
   let the `goLiveSession` retry path continue until backend media readiness is
   observed after the viewer answer.
6. Viewer join and playback: join the session from live discovery, confirm the
   viewer media setup succeeds after `joinLiveSession`, and confirm remote host
   audio/video renders in the watch screen.
7. Chat send/receive: send one message from the viewer and one from the host;
   confirm each account sees both messages in realtime.
8. Retained chat replay: have the viewer leave and rejoin the same live
   session, then confirm the prior chat messages replay from retained history.
9. Viewer leave: leave from the viewer watch screen and confirm remote playback
   stops, the viewer returns out of the session, and the host session remains
   active.
10. Host/session end and ended cleanup: end the session from the host, then
    confirm any viewer watch state observes the ended session, media/chat
    resources are cleaned up, and the ended session no longer appears as live in
    discovery.

Verification on 2026-06-24:

```bash
bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host
# 141 pass, 0 fail; 457 expect() calls; ran 141 tests across 23 files
cd mobile && ./node_modules/.bin/tsc --noEmit
# exit 0, no diagnostics
git diff --check
# exit 0
```

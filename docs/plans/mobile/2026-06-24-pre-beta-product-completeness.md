# Mobile Pre-Beta Product Completeness

Last reviewed: 2026-06-24

Executor brief: beta distribution is premature until the app can prove the core
live product loop on device. The current mobile app has auth, profiles, live
discovery/watch shell, host preflight, host media setup preparation, go-live
retry handling, realtime chat, and retained chat history. It does not yet have
real host WebRTC publishing or viewer playback. The GraphQL setup path now
exposes the media signaling topic through `prepareLiveMediaSession` for hosts
and active joined viewers.

Keep this plan ahead of beta build mechanics. Return to
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md` only after the
launch blockers below are closed or explicitly deferred by the product owner.

## Write Scope

- Mobile lane docs: `docs/plans/mobile/**`
- Mobile app code: `mobile/**`
- Backend/shared contract docs only when a promoted backend lane batch changes
  the mobile-facing media API
- Backend Elixir/GraphQL code is out of mobile-lane scope unless the coordinator
  explicitly promotes a backend batch

## Product Blockers

Treat these as launch blockers unless the product owner explicitly defers one:

- Host media publishing: the host path needs a real `RTCPeerConnection`, local
  media tracks, signaling-channel join, offer push, ICE push, answer handling,
  and go-live retry after backend readiness.
- Viewer playback: joined viewers need media signaling setup, remote track
  rendering, answer creation, ICE exchange, disconnect cleanup, and ended-session
  teardown.
- Device smoke path: host and viewer behavior needs a repeatable simulator or
  device checklist after the runtime path exists.
- Beta mechanics: package scripts, build identifiers, secrets handoff, and
  release-candidate checklist should run after the core media blockers.

## Progress

- [x] Task 1: Reclassify the active lane from beta release mechanics to
  pre-beta product completeness and record the blocking evidence.
- [x] Task 2: Promote or implement viewer media setup contract.
- [ ] Task 3: Implement host WebRTC publishing runtime.
- [ ] Task 4: Implement viewer playback runtime.
- [ ] Task 5: Add device smoke coverage and return to beta release mechanics.

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

Goal: make the host actually publish local audio/video through the completed
media signaling contract.

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
```

## Task 4: Viewer Playback Runtime

Goal: make joined viewers receive and render host media.

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

Goal: move back to beta release readiness only after the core media loop exists.

Steps:

1. Add a concise device or simulator smoke checklist for one host and one
   viewer covering auth, live discovery, host preflight, media publish,
   viewer playback, chat send/receive, retained chat replay, leave, and end.
2. Re-run the focused mobile test and typecheck gates.
3. Update this plan, `docs/plans/mobile/TRACK.md`, and
   `docs/plans/mobile/NOW.md` with exact evidence.
4. Promote `docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`
   after product blockers are closed or explicitly deferred.

Verification:

```bash
bun test mobile/src/live mobile/src/relay mobile/src/realtime mobile/src/host
cd mobile && ./node_modules/.bin/tsc --noEmit
git diff --check
```

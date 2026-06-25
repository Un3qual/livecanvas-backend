# Mobile Release Candidate Checklist

Last reviewed: 2026-06-25

Source plan:
`docs/plans/mobile/2026-06-05-testing-beta-release-readiness.md`

Scope: internal release-candidate signoff for LiveCanvas Mobile after the local
quality gates pass and before widening beta tester access. Native-media
debugging can use the `development` EAS profile, but release-candidate device
QA should use the `preview` profile so testers exercise an internal
distribution build without `developmentClient`.

No remote or authenticated EAS build or submit command is required by this
checklist.

## Entry Criteria

- From `mobile/`, `bun run test:quality` passes.
- From `mobile/`, `bun run typecheck` passes.
- From the repo root, `git diff --check` passes.
- EAS environment values are configured for the target API and websocket
  endpoints. Do not rely on local `.env` or `.env.local` files for remote EAS
  jobs.
- At least two test accounts exist: one host account and one separate viewer
  account.
- A physical host device with camera and microphone is available. A physical
  viewer device is preferred for WebRTC validation; a simulator can supplement
  non-media checks.
- The beta scope is one host and one viewer. Broader viewer scale or long soak
  testing belongs in deferred follow-up unless product explicitly expands the
  release-candidate scope.

## Launch Blockers

Any item in this section blocks beta release until fixed or explicitly removed
from the release scope.

- The `preview` build cannot install, cold-launch, or reach the configured API
  and websocket endpoints on a target beta platform.
- A user cannot sign up, sign in, restore an authenticated session after
  relaunch, or recover cleanly after sign out.
- The viewer profile, privacy mode, other-user profile, or follow/request flows
  fail to render usable profile state for authenticated users.
- Host preflight cannot request camera and microphone permissions, render the
  local preview on a physical device, or show actionable blocked-permission
  state after denial.
- A host cannot create a live session, prepare media, and reach `LIVE` through
  the go-live retry path after viewer media negotiation completes.
- A viewer cannot discover the host session, join it, prepare viewer media, and
  render remote host audio/video in the watch screen.
- Media signaling uses a decoded Relay ID, a client-constructed topic, or any
  topic other than the opaque `signalingTopic` returned by
  `prepareLiveMediaSession`.
- Realtime chat messages do not appear for both host and viewer, or sends fail
  without viewer-safe error recovery.
- Retained chat replay does not reload prior `LiveSession.timelineEvents`
  `ChatMessageEvent` rows after reload, app relaunch, or leave/rejoin.
- Backgrounding and foregrounding either participant during an active session
  leaves unrecoverable media, chat, or session state.
- Viewer leave, host end, or ended-session realtime cleanup leaves stale live
  discovery rows, retained media resources, or a stuck joined watch state.

## Manual Device And Simulator Checks

### Auth

- Install the `preview` build on the target device and cold-launch it.
- Sign up or sign in with the configured password or OAuth provider for the
  host account.
- Kill and relaunch the app, then confirm `ViewerBootstrapQuery` restores the
  authenticated viewer state.
- Sign out, relaunch, and confirm the app returns to the unauthenticated route
  without leaking the previous viewer.
- Repeat sign-in for a separate viewer account on the second device or
  simulator.

### Profiles

- Open the viewer profile and confirm email, privacy mode, follower preview,
  following preview, pending requests, and current live-session state render.
- Toggle public/private privacy mode and confirm success state survives a
  reload.
- Open another user's profile and confirm relationship state, muted state, and
  follow/request action render for the viewer.
- If a pending follow request exists, accept and decline paths should update the
  row without exposing backend error internals.

### Live Discovery And Watch

- With no active session, confirm live discovery renders an empty or populated
  state without blocking navigation.
- From the host account, open host broadcast from discovery.
- From the viewer account, refresh live discovery after host session creation
  and confirm the host session appears with expected host metadata.
- Open the watch screen from discovery and confirm the route uses the opaque
  Relay live-session ID without client-side decoding.

### Host Preflight

- On a physical host device, grant camera and microphone permissions and confirm
  local preview renders.
- Deny at least one permission on a fresh install or reset-permission run and
  confirm the screen shows an actionable blocked state.
- Create a host session, prepare media, and confirm preflight remains blocked
  until media signaling readiness is observed.

### Media Signaling And WebRTC

- Run a one-host/one-viewer session with the host on a physical device.
- Confirm host media preparation receives `channelTopic`, `signalingTopic`, and
  ICE servers from `prepareLiveMediaSession`.
- Confirm the host publishing runtime joins the returned `signalingTopic`,
  attaches local tracks, and publishes an offer.
- Join from the viewer account, confirm viewer media setup succeeds only after
  `joinLiveSession`, and confirm the viewer answers the host offer.
- Confirm the host go-live retry reaches `LIVE` only after viewer answer based
  readiness.
- Confirm the viewer watch screen renders remote audio/video, then rotate
  between app background and foreground on both participants for a short
  interval and verify the session can continue or recover by leave/rejoin.

### Realtime Chat And Retained Replay

- Send one chat message from the viewer and one from the host.
- Confirm both participants receive both messages in realtime through the live
  session channel.
- Reload the watch screen or relaunch the app and re-enter the same session.
- Confirm the prior messages replay from retained
  `LiveSession.timelineEvents` / `ChatMessageEvent` history, not from a stale
  in-memory-only chat list.
- Leave and rejoin as the viewer, then confirm retained history and realtime
  sends still merge without duplicates.

### Cleanup

- Leave from the viewer watch screen and confirm remote playback stops, chat
  closes, and the host session remains active.
- End the session from the host and confirm the viewer observes ended-session
  state, media resources are released, and live discovery no longer shows the
  ended session as live.
- Relaunch both apps after session end and confirm neither account is stuck in
  a joined or publishing state for the ended session.

## Local Unit Coverage Reference

The release-candidate manual pass complements, but does not replace, the local
unit suites:

- Auth session bootstrap, token refresh, forced logout, OAuth/password mutation
  payload handling, and auth UI state.
- Profile privacy, relationship, follow request, and presentation reducers.
- Live discovery presentation, opaque live-channel topics, watch reducer state,
  realtime event normalization, chat reducer merging, retained timeline
  history, viewer playback lifecycle, and ended-session cleanup.
- Host preflight reducers, native media boundary normalization, media signaling
  payload validation, publishing runtime negotiation, and retained publishing
  session cleanup.

## Deferred Non-Blocking Follow-Up

These are not launch blockers for the one-host/one-viewer internal beta as long
as every launch blocker above passes.

- Running authenticated remote EAS build or EAS Submit commands from a release
  operator environment.
- TestFlight, Play Console internal-track submission, store metadata, and store
  screenshot preparation.
- Automated end-to-end coverage for the manual checklist.
- Multi-viewer scale testing, long-running live-session soak testing, and poor
  network/ICE fallback matrix coverage beyond the one-host/one-viewer beta
  target.
- Crash reporting, analytics, and operational dashboard polish that does not
  affect the product loop above.
- Recording playback/export or post-live replay features outside the current
  live watch and retained chat replay scope.

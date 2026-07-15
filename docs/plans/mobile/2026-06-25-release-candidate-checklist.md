# Mobile Release Candidate Checklist

Last reviewed: 2026-07-14

Source plan:
`docs/plans/archive/completed/mobile/2026-06-05-testing-beta-release-readiness.md`

Scope: internal release-candidate signoff for LiveCanvas Mobile after the local
quality gates pass and before widening beta tester access. Native-media
debugging can use the `development` EAS profile, but release-candidate device
QA should use the `preview` profile so testers exercise an internal
distribution build without `developmentClient`.

No remote or authenticated EAS build or submit command is required by this
checklist.

Current status: local entry gates pass after completion of all five approved
product batches. Use `docs/plans/mobile/NOW.md` for the executable gate pointer.
Remote EAS state, beta identities, delivered-email access, and physical-device
work still require the listed operator prerequisites.

## Entry Criteria

- From `mobile/`, `pnpm test:quality` passes.
- From `mobile/`, `pnpm typecheck` passes.
- From the repo root, `git diff --check` passes.
- EAS environment values are configured for the target API and websocket
  endpoints. Do not rely on local `.env` or `.env.local` files for remote EAS
  jobs.
- Backend `LIVE_CANVAS_PUBLIC_ORIGIN` and mobile
  `EXPO_PUBLIC_APP_ORIGIN` are configured to the same normalized, non-placeholder
  HTTPS origin. The API origin is a separate value and must not substitute for
  the public app origin.
- At least two test accounts exist: one host account and one separate viewer
  account.
- An email address not yet associated with LiveCanvas and an inbox accessible
  from the recipient device are available for the delivered-invite flow.
- A physical host device with camera and microphone is available. A physical
  viewer device is preferred for WebRTC validation; a simulator can supplement
  non-media checks.
- The beta scope is one host and one viewer. Broader viewer scale or long soak
  testing belongs in deferred follow-up unless product explicitly expands the
  release-candidate scope.

## QA Evidence

### 2026-06-29 Local Entry Gate Pass

- `mobile/`: `bun run test:quality` passes after restoring the committed
  pnpm dependency set with `pnpm install --frozen-lockfile`; the suite reported
  app typecheck, test typecheck, lint, and 332 Bun tests passing.
- `mobile/`: `bun run typecheck` passes.
- Repo root: `git diff --check` passes.
- Local config inspection only, with no remote EAS command run:
  `mobile/eas.json` defines a `preview` profile with internal distribution
  extending `production`, plus a `development` profile that enables
  `developmentClient`; `mobile/app.json` includes camera/microphone permissions
  and the WebRTC config plugin.
- The mobile runtime reads `EXPO_PUBLIC_API_BASE_URL` and
  `EXPO_PUBLIC_WEBSOCKET_URL`, falling back to localhost values in local
  builds. Target remote EAS environment values, preview build availability,
  beta test accounts, and physical host/viewer devices were not available in
  this local worker environment, so the manual device QA sections below remain
  pending and the full release-candidate device QA is not marked complete.

### 2026-06-30 Product Follow-Up Queue Completion

- The product follow-up queue above release-candidate QA is complete in the
  current checkout: host in-session controls, viewer playback recovery controls,
  chat history pagination, post-live recording replay affordance, and the
  release diagnostics screen are implemented and covered by mobile tests.
- `mobile/`: `bun run test:quality` passes with typecheck, test typecheck,
  lint, and 411 Bun tests passing.
- `mobile/`: `bun run typecheck` passes.
- Repo root: `git diff --check` passes.
- Target remote EAS environment values, preview build availability, beta test
  accounts, and physical host/viewer devices were not available in this local
  worker environment, so the manual device QA sections below remain pending and
  the full release-candidate device QA is not marked complete.

### 2026-07-11 Five Product Batch Closure

- All five approved product batches are complete, including end-to-end contact
  invitation delivery and authenticated one-time consumption.
- Whole-branch review fixes keep delivered invite copy neutral, reject reserved
  placeholder origins, require exact configured-origin HTTPS handoff on mobile,
  and prevent the public landing endpoint from running GraphQL session/viewer
  context.
- Backend: a fresh test database reset and all migrations pass; `mix test`
  reports 1,010 tests, zero failures, and one excluded; typecheck, warnings-as-errors
  compilation, changed-file formatting, typespec checks, asset build, and the
  public invite parser suite pass.
- Mobile: the integration fixes did not change the GraphQL schema or Relay
  operations, so regeneration was not required. `bun run test:quality` passes
  with both typechecks, lint, 548 Bun tests, and 160 Jest tests. Jest retains
  the existing non-failing worker force-exit warning.
- Repo root: `git diff --check` passes for the complete Batch 5 branch.
- Target EAS environment values, preview-build availability, beta accounts, and
  physical host/viewer devices still require release-operator confirmation, so
  the manual device sections remain pending.

### 2026-07-14 Post-Batch Local Entry Gate Pass

- The gate ran from merged `main` at `aeac169`; after the test-runtime migration,
  `pnpm install --frozen-lockfile` restores the updated committed dependency
  graph without lockfile changes.
- `mobile/`: `pnpm test:quality` passes with app typecheck, test typecheck,
  lint, 74 Vitest files containing 552 tests, and 24 Jest suites containing 165
  tests. Jest retains the existing non-failing worker force-exit warning.
- `mobile/`: the separately required `pnpm typecheck` passes.
- The active mobile toolchain no longer requires Bun: pnpm owns every public
  command, Vitest owns unit tests, and Jest/Expo retains the RNTL suite.
- Repo root: `git diff --check` passes.
- Committed config still defines `preview` as an internal-distribution profile
  without `developmentClient`; the native app config includes camera and
  microphone permission copy plus the WebRTC config plugin.
- The committed app config does not contain an EAS owner or project ID, so
  project linkage and any existing preview artifact cannot be proven locally.
- No local `.env*` file is present in the isolated worktree. No remote or
  authenticated EAS command was run, so target environment values and preview
  artifact availability remain operator-confirmed state rather than local
  evidence.

### 2026-07-14 Mobile Release-Depth Five-Batch Closure

- Host local preview (`078e501`) renders the cached preflight stream without
  taking ownership of it or requesting a second capture stream.
- Live audience count (`5abdffa`) preserves session-scoped room state and
  rejects stale callbacks after a session change.
- App lifecycle recovery (`43ea54b`) suspends transient viewer resources in the
  background and creates one fresh generation on a real resume without issuing
  a durable leave mutation or disrupting retained host publishing.
- Post and story media (`0abc077`) use SDK-compatible `expo-image` and
  `expo-video` rendering behind validated media presentation data, with explicit
  processing, unavailable, and load-failure states.
- The dedicated story viewer (`e790acf`) uses opaque Relay IDs, active-story
  validation, bounded previous/next navigation, and the shared media renderer.
- `CI=true pnpm install --frozen-lockfile` and Relay generation pass without
  lockfile or generated-artifact drift. The full mobile quality gate passes app
  and test typechecks, lint, 76 Vitest files containing 563 tests, and 27 Jest
  suites containing 182 tests.
- `nix flake check`, branch-wide `git diff --check`, and post-verification
  worktree hygiene pass. No remote EAS or physical-device command was run, so
  the operator prerequisites and manual QA below remain pending.

## Remaining Operator Prerequisites

The local gate is complete. Before manual device QA starts, a release operator
must confirm all of the following as one target-environment inventory:

- The EAS `preview` environment provides non-localhost
  `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WEBSOCKET_URL`, and
  `EXPO_PUBLIC_APP_ORIGIN` values reachable from the target devices.
- Backend `LIVE_CANVAS_PUBLIC_ORIGIN` exactly matches the normalized mobile
  `EXPO_PUBLIC_APP_ORIGIN`; the configured HTTPS landing is publicly reachable.
- The mobile app is linked to the intended EAS project, or the release operator
  is ready to establish that association before building.
- An installable `preview` artifact exists for the target beta platform, or an
  authenticated release operator is ready to create one.
- Separate host and viewer identities are available, along with an unmatched
  recipient email inbox that can receive the real invitation delivery.
- A physical camera/microphone-capable host device is available. A second
  physical viewer device is preferred; a simulator may supplement only the
  non-media checks.

Until those items are confirmed, every manual device section below remains
pending and the release candidate is not signed off.

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

### Contact Invitations

- From an authenticated inviter, send an invite to an unmatched email contact
  and inspect the actual delivered email. Confirm the copy is neutral, does not
  disclose the inviter's email, and links to the configured public app origin at
  `/invites#token=...`.
- Open that HTTPS link on the recipient device, confirm the neutral landing page
  offers the LiveCanvas app handoff, and continue through the app without the raw
  token appearing in visible navigation state.
- Complete sign-in or account creation for the invited email, return through the
  opaque handoff route, and confirm the invitation is consumed once. A forwarded
  invite opened by an account that does not own the recipient email must remain
  in the generic invalid state.

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

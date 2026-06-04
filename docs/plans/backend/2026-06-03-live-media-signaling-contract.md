# Live Media Signaling Contract Implementation Plan

Last reviewed: 2026-06-03

## Executor Brief

Build the first backend product contract for native host broadcasting without
attempting the full Membrane/WebRTC media pipeline in this batch. Define the
mobile-facing signaling shape, add a typed signaling boundary, expose
host-authorized prepare data through GraphQL, and validate/forward ephemeral
media signaling events on the existing authorized live-session channel.

Required sub-skill for agentic execution: use
`superpowers:subagent-driven-development` only if splitting the work into
disjoint worktrees. Do not send multiple workers into the same files.

## Current Context

- Mobile host broadcast native capability/preflight is complete, but true
  mobile go-live is still blocked by backend media signaling, ICE/TURN delivery,
  and WebRTC negotiation contracts.
- `LC.Live.MediaSession.start_for_session/1` is currently a placeholder seam used
  by the live session runtime.
- Durable live-session reads and mutations are GraphQL/Relay-first. Ephemeral
  live-session state is already carried over Phoenix Channels.
- Live-session topic construction and parsing belongs in
  `LCTransport.LiveSessionTopics`; do not duplicate topic string rules.

## Progress

- [x] Task 1: Define the mobile-facing media signaling contract and typed backend
  boundary.
- [x] Task 2: Expose host prepare data through a Relay-first GraphQL mutation.
- [x] Task 3: Add live-session channel validation and forwarding for media
  signaling events.
- [ ] Task 4: Tie negotiation readiness into lifecycle behavior without starting
  a real media pipeline.
- [ ] Task 5: Close the backend batch and hand off the mobile integration
  surface.

## Task 1: Contract Doc And Typed Boundary

Goal: make the signaling API shape executable before wiring it into GraphQL or
channels.

Write scope:

- Create `docs/contracts/mobile-live-media-signaling.md`.
- Create `lib/live_canvas/live/media_signaling.ex`.
- Add focused tests in `test/live_canvas/live/media_signaling_test.exs`.
- Update `docs/contracts/mobile-live-session-realtime.md` only to link to the new
  media signaling contract.

Implementation notes:

- The contract should define `prepareLiveMediaSession`, ICE server fields, the
  live-session signaling topic, and Phoenix channel event names/payloads.
- The first code boundary should be pure and typed. It should return
  deterministic ICE server data and validate offer/answer/candidate payload
  shapes, but it must not start Membrane.
- Keep TURN credential delivery as a configurable contract shape. Do not persist
  TURN secrets in this batch.

Verification:

```bash
mix test test/live_canvas/live/media_signaling_test.exs
mix typecheck
```

## Task 2: GraphQL Prepare Mutation

Goal: let an authenticated host obtain media setup metadata through a Relay
payload mutation.

Write scope:

- Update live GraphQL schema/mutation modules under `lib/live_canvas_gql/live/`.
- Extend resolver tests in `test/live_canvas_gql/live/live_mutations_test.exs`.

Contract:

- Add `prepareLiveMediaSession(input: {liveSessionId: ID!})`.
- Return the authorized `liveSession`, `signalingTopic`, `iceServers`, and
  `errors`.
- Reuse existing global ID decoding, host ownership checks, and session-state
  validation.
- Reject unauthenticated users, non-host users, invalid IDs, hidden/foreign
  sessions, and sessions in terminal states.

Verification:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs
mix typecheck
```

## Task 3: Channel Signaling Events

Goal: make the existing authorized live-session channel carry ephemeral media
negotiation messages.

Write scope:

- Update the live-session channel implementation and tests under
  `test/live_canvas_web/channels/`.
- Reuse `LCTransport.LiveSessionTopics` for topic behavior.
- Reuse the typed validation functions from `LC.Live.MediaSignaling`.

Contract:

- Accept and broadcast `media:offer`, `media:answer`, and
  `media:ice_candidate` events with validated payloads.
- Include sender role metadata derived server-side; do not trust a
  client-provided role.
- Keep authorization consistent with existing live-session channel joins.
- Return structured validation errors for malformed payloads.

Verification:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
```

## Task 4: Negotiation Readiness And Lifecycle Guard

Goal: prevent the lifecycle API from implying media readiness when negotiation
has not happened.

Write scope:

- Update the live media boundary and live resolver/service tests.
- Keep the implementation as an in-process contract seam unless existing runtime
  ownership requires a session-process callback.

Contract:

- Define a typed readiness result such as `:ready | {:not_ready, reason}`.
- Ensure `goLiveSession` can surface a stable, user-facing media-not-ready error
  once the readiness guard is connected.
- Do not implement a real WebRTC peer connection or Membrane pipeline here.

Verification:

```bash
mix test test/live_canvas/live/media_session_test.exs test/live_canvas_gql/live/live_mutations_test.exs
mix typecheck
```

## Task 5: Closure And Handoff

Goal: leave the next mobile executor with a clear, tested backend contract.

Write scope:

- Update this plan's checklist.
- Update `docs/plans/backend/NOW.md`.
- Update mobile contract references if the returned GraphQL fields or channel
  payloads changed during implementation.
- Update shared dashboard/index docs only if lane state changes.

Done condition:

- Backend tests for the signaling boundary, prepare mutation, channel events, and
  lifecycle guard pass.
- `mix typecheck` passes after typed code changes.
- The backend lane either points to the next concrete media batch or returns to
  idle with a mobile handoff note.

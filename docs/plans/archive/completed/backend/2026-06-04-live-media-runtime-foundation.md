# Live Media Runtime Foundation Implementation Plan

Last reviewed: 2026-06-04

## Executor Brief

Build the backend product batch that turns the completed mobile-facing signaling
contract into a runtime-capable media foundation. Keep the implementation
focused on readiness, ICE/TURN delivery, and negotiation ownership; do not mix in
viewer playback UI or recording product work.

Required sub-skill for implementation: use `superpowers:test-driven-development`
for each backend behavior slice. Use subagents only if splitting into disjoint
worktrees for schema/runtime/channel tasks.

## Initial Context

- Completed contract plan:
  `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`
- Mobile integration plan:
  `docs/plans/mobile/2026-06-04-host-broadcast-media-signaling-integration.md`
- Backend readiness started as an in-process v1 marker that could reset on
  runtime restart.
- `prepareLiveMediaSession` initially returned deterministic STUN data; this
  plan adds the provider boundary for production TURN credential delivery.
- `goLiveSession` stays intentionally blocked by retryable `media_not_ready`
  until runtime readiness is marked.

## Progress

- [x] Task 1: Add durable media readiness storage and a typed backend boundary.
- [x] Task 2: Add configurable ICE/TURN credential provider behavior.
- [x] Task 3: Connect signaling/channel negotiation events to runtime readiness.
- [x] Task 4: Rewire `goLiveSession` to durable readiness and preserve
  retryable `media_not_ready` semantics.
- [x] Task 5: Verify, update contracts if needed, and hand off the next mobile
  lane batch.

## Task 1: Durable Media Readiness Storage

Goal: make media readiness survive process restarts and give lifecycle code a
single source of truth.

Write scope:

- Add a migration for a relational media-readiness table tied to
  `live_sessions`.
- Use backend conventions: `bigint` primary key, Postgres-generated
  `:entropy_id` UUIDv7, and `:utc_datetime_usec` timestamps.
- Add a typed context/boundary under `lib/live_canvas/live/`.
- Add focused tests for create, mark-ready, reset/not-ready, terminal-session
  handling, and host ownership assumptions.

Verification:

```bash
mix test test/live_canvas/live/media_session_test.exs
mix typecheck
```

## Task 2: ICE/TURN Credential Provider

Goal: replace deterministic STUN-only setup with a configurable provider that
can return short-lived TURN credentials without persisting secrets.

Write scope:

- Extend the `LC.Live.MediaSignaling` boundary behind existing GraphQL fields.
- Add config-backed provider behavior and deterministic test provider.
- Keep TURN credentials ephemeral and response-scoped.

Verification:

```bash
mix test test/live_canvas/live/media_signaling_test.exs test/live_canvas_gql/live/live_mutations_test.exs
mix typecheck
```

## Task 3: Runtime Readiness From Negotiation Events

Goal: make validated signaling events advance backend readiness through a typed
runtime boundary instead of manual in-process markers.

Write scope:

- Reuse existing channel validation for `media:offer`, `media:answer`, and
  `media:ice_candidate`.
- Add explicit readiness transition rules that do not trust client-provided
  roles.
- Keep channel joins and event pushes authorized through existing live-session
  policy.

Verification:

```bash
mix test test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/live/media_session_test.exs
mix typecheck
```

## Task 4: Lifecycle Integration

Goal: let `goLiveSession` succeed only after durable media readiness exists and
keep all non-ready states retryable.

Write scope:

- Update resolver/service tests for `media_not_ready`, success after readiness,
  restart-safe lookup, terminal sessions, and non-host attempts.
- Preserve Relay payload error shape and mobile contract copy.

Verification:

```bash
mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas/live/session_server_test.exs
mix typecheck
```

## Task 5: Closure And Handoff

Goal: close this backend runtime-foundation batch with exact mobile handoff
instructions.

Write scope:

- Update this plan checklist.
- Update `docs/plans/backend/NOW.md`.
- Update `docs/contracts/mobile-live-media-signaling.md` only if the mobile API
  shape changes.
- Update coordinator/index docs only for lane-state changes.

Final verification:

```bash
mix test test/live_canvas/live/media_signaling_test.exs test/live_canvas/live/media_session_test.exs test/live_canvas/live/session_server_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
mix typecheck
mix boundary.spec
git diff --check
```

Closure handoff:

- Backend media runtime foundation is complete for durable readiness,
  provider-backed ICE/TURN setup, validated signaling-driven readiness, and
  `goLiveSession` retry semantics.
- The mobile-facing GraphQL and channel API shape did not change; contract text
  now documents provider-backed ICE/TURN behavior.
- The next currently documented mobile-lane batch is chat realtime stream plus
  retained history from `docs/plans/mobile/TRACK.md`.

# Host Broadcast Media Signaling Integration Plan

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

Last reviewed: 2026-06-04

## Executor Brief

Integrate the completed backend live media signaling contract into the mobile
host-broadcast preflight surface without enabling full native publishing or
viewer playback. Keep durable state Relay-first, keep Phoenix Channel media
messages as typed payload boundaries, and leave actual socket/WebRTC runtime
wiring for the backend runtime foundation batch.

Required sub-skill for implementation: use `superpowers:test-driven-development`
for pure behavior changes. Use subagents only for disjoint worktrees; this batch
is single-lane mobile scope.

## Context

- Backend plan `docs/plans/backend/2026-06-03-live-media-signaling-contract.md`
  is complete.
- `prepareLiveMediaSession` returns the host-authorized session, opaque
  signaling topic, and ICE server list.
- `goLiveSession` can return retryable `media_not_ready` until backend runtime
  marks negotiation ready.
- Mobile still does not own a Phoenix socket client or a real WebRTC peer
  connection runtime in this batch.

## Progress

- [x] Task 1: Refresh the mobile Relay schema and generated artifacts for
  `prepareLiveMediaSession`.
- [x] Task 2: Add a tested host media prepare adapter that preserves opaque
  topics and validates ICE server payloads.
- [x] Task 3: Add tested media offer/answer/ICE broadcast normalization to the
  live-session realtime event boundary.
- [x] Task 4: Wire the host preflight screen through create-session,
  prepare-media, and go-live retry handling.
- [x] Task 5: Run focused verification, update lane pointers, and close the
  mobile batch.

## Write Scope

- `mobile/schema.graphql`
- `mobile/src/host/**`
- `mobile/src/live/liveSessionPresentation.*`
- `mobile/src/live/liveSessionRealtimeEvents.*`
- `docs/plans/mobile/**`

Out of scope: backend Elixir code, real Membrane/WebRTC publishing, viewer
playback, chat UI, and new shared contract changes.

## Verification

Run in `mobile/`:

```bash
bun test src/host/hostBroadcastMediaSignaling.test.ts src/host/hostBroadcastPreflight.test.ts src/host/hostBroadcastSession.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts
./node_modules/.bin/relay-compiler
./node_modules/.bin/tsc --noEmit
```

Run at repository root:

```bash
git diff --check
```

## Handoff

After this mobile batch closes, the next product-critical blocker is backend
media runtime foundation: durable readiness beyond the in-process marker,
TURN/ICE credential delivery, and a runtime boundary that can make
`goLiveSession` succeed after negotiation.

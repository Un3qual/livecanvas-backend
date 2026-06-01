# Mobile Lane Execution

Last reviewed: 2026-06-01
Status: channel transport contract repair plan ready for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md` unless explicitly assigned.

## Current Batch

- Track: `docs/plans/mobile/TRACK.md`
- Source: `docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md`
- Batch: `Task 1: Pin the repaired mobile realtime contract`
- Why now: the live discovery/watch flow is complete, but the published mobile realtime contract still describes the old `chat:message` channel surface and exposes no client-safe topic derived from a Relay `LiveSession`. Repair this before host broadcast/native media planning or chat channel implementation.
- Scope: shared contract docs, backend GraphQL/channel contract code, mobile schema snapshot, mobile generated Relay artifacts, and narrow mobile topic/event helper tests. Do not start media capture, playback, or full Phoenix Channel client UI in this batch.

## Verification Scope

- Backend focused tests: `mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`.
- Backend compile/type checks if typed code changes: `mix compile`; `mix typecheck`.
- Mobile focused tests: `cd mobile && bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts`.
- Relay: `cd mobile && ./node_modules/.bin/relay-compiler`.
- TypeScript: `cd mobile && ./node_modules/.bin/tsc --noEmit`.
- Whitespace: `git diff --check`.
- Nix note: the Nix-wrapped Relay and TypeScript commands were blocked in this environment by `/nix/var/nix/daemon-socket/socket: Connection refused` during the prior mobile closeout; use the local mobile toolchain unless the Nix daemon is available.

## Next Up

- After channel transport contract repair lands, create or activate the host broadcast native capability and preflight planning plan.
- Do not decode Relay IDs client-side.
- Do not add media capture, playback, or full chat stream UI before the repaired channel contract is implemented and verified.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- another mobile slice is explicitly reprioritized ahead of channel transport contract repair
- the selected next plan no longer matches the codebase

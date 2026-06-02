# Mobile Lane Execution

Last reviewed: 2026-06-02
Status: channel transport contract repair Task 3 ready for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md` unless explicitly assigned.

## Current Batch

- Track: `docs/plans/mobile/TRACK.md`
- Source: `docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md`
- Batch: `Task 3: Refresh Mobile Relay Schema And Request The Topic`
- Why now: Task 2 exposed an authorized opaque `LiveSession.channelTopic` from backend GraphQL; the next blocker is refreshing the mobile Relay schema and requesting the field in the mobile live-session queries.
- Scope: mobile Relay schema and generated artifacts plus the live discovery/watch query selections listed in the plan. Do not start mobile helper work, media capture, playback, or full Phoenix Channel client UI in this batch.

## Verification Scope

- Backend focused tests: `mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`.
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

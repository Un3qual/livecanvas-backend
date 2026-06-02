# Mobile Lane Execution

Last reviewed: 2026-06-02
Status: channel transport contract repair Task 4 ready for execution

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md` unless explicitly assigned.

## Current Batch

- Track: `docs/plans/mobile/TRACK.md`
- Source: `docs/plans/mobile/2026-06-01-live-channel-transport-contract-repair.md`
- Batch: `Task 4: Add Mobile Topic And Realtime-Event Helpers`
- Why now: Task 3 refreshed the mobile schema snapshot, requested `LiveSession.channelTopic` in live discovery/watch reads, and regenerated Relay artifacts. The next blocker is adding pure mobile helpers for the opaque topic and current `timeline:*` realtime payloads.
- Scope: create the Task 4 mobile helper modules and their Bun tests only. Do not start Phoenix Channel socket lifecycle, media capture, playback, or chat stream UI in this batch.

## Verification Scope

- Mobile focused tests: `cd mobile && bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts`.
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

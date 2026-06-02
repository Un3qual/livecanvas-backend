# Mobile Lane Execution

Last reviewed: 2026-06-02
Status: channel transport contract repair complete

## Lane Scope

- Own `mobile/` and `docs/plans/mobile/**` only.
- Do not edit backend Elixir/GraphQL code or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md` unless explicitly assigned.

## Current Batch

- Track: `docs/plans/mobile/TRACK.md`
- Source: none active
- Batch: none; channel transport contract repair is complete
- Handoff: create or activate the host broadcast native capability and preflight planning plan before starting media capture, playback, socket lifecycle, or chat stream UI work.

## Completed Verification Scope

- Backend focused tests: `mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/live/live_resolver_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`.
- Backend compile/typecheck: `mix compile` and `mix typecheck`.
- Mobile focused tests: `cd mobile && bun test src/live/liveSessionChannelTopic.test.ts src/live/liveSessionRealtimeEvents.test.ts src/live/liveSessionPresentation.test.ts src/live/liveSessionNavigation.test.ts src/live/liveSessionWatchReducer.test.ts`.
- Relay and TypeScript: `cd mobile && ./node_modules/.bin/relay-compiler` and `cd mobile && ./node_modules/.bin/tsc --noEmit`.
- Contract stale-surface search: `rg -n "chat:message|chat:message_updated|removed_timeline_event_id|timeline:event|channelTopic" docs/contracts docs/plans/mobile mobile/src/live lib/live_canvas_web/channels test/live_canvas_web/channels`.
- Whitespace: `git diff --check`.
- Relay note: Relay compiler passed after an unsandboxed rerun because Watchman could not update its local state inside the sandbox.

## Next Up

- Create or activate the host broadcast native capability and preflight planning plan.
- Do not decode Relay IDs client-side.
- Do not add media capture, playback, or full chat stream UI before host broadcast/native media planning.

## Repair Conditions

Repair this lane pointer from `docs/plans/mobile/TRACK.md` and `docs/plans/INDEX.md` when:

- another mobile slice is explicitly reprioritized ahead of host broadcast/native media planning
- the selected next plan no longer matches the codebase

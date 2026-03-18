# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `live`
- Plan: `docs/plans/live/2026-03-18-live-replay-feed-surfaces.md`
- Batch: `Task 2: Expose replayFeed and harden Relay live-session fetches`
- Why now: Feed now exposes replay discovery primitives, so the next unblocked batch is wiring them through GraphQL and closing the live-session Relay auth gap.

## Do This Now

- Add failing GraphQL tests for `replayFeed` and failing Relay node tests for unauthorized `LiveSession` refetches.
- Implement the `replayFeed` connection in GraphQL and re-apply viewer authorization in `LiveSession` node fetches.
- Run the Task 2 verification commands, update `docs/plans/live/2026-03-18-live-replay-feed-surfaces.md`, and commit the milestone.

## Verification Scope

```bash
mix test test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

## Next Up

- Run final verification for the touched Feed and GraphQL suites and refresh the live replay tracking docs.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

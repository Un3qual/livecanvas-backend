# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `live`
- Plan: `docs/plans/live/2026-03-18-live-replay-feed-surfaces.md`
- Batch: `Task 1: Add replay discovery query primitives in Feed`
- Why now: durable recording linkage is complete, so the next unblocked product batch is replay discovery over ended sessions with linked recordings.

## Do This Now

- Add failing `LC.Feed` tests for replay visibility, ordering, and exclusion of unrecorded or unauthorized sessions.
- Implement `LC.Feed.replay_feed/2` and `LC.Feed.replay_feed_query/1` for visible ended sessions with linked recordings.
- Run the task verification commands, update `docs/plans/live/2026-03-18-live-replay-feed-surfaces.md`, and commit the milestone.

## Verification Scope

```bash
mix test test/live_canvas/feed_test.exs
```

## Next Up

- Expose `replayFeed` in GraphQL and lock Relay `LiveSession` node refetch to viewer-scoped visibility rules.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

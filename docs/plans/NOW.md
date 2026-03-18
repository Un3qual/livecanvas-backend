# Current Execution

Last reviewed: 2026-03-18
Status: active

## Current Batch

- Track: `graphql`
- Plan: `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md`
- Batch: `Task 1: Add request-scoped dataloader plumbing to the GraphQL context`
- Why now: the live replay track is complete, and the GraphQL dataloader plan is the next unblocked queued batch in `docs/plans/INDEX.md`.

## Do This Now

- Add failing request-context coverage that proves every GraphQL request gets a fresh loader in Absinthe context.
- Add the focused node/query coverage needed to prove the loader is available during field resolution without dropping auth scope.
- Implement `LCGQL.Dataloader` plus the minimum context/schema wiring, then rerun the focused tests and commit the Task 1 milestone.

## Verification Scope

```bash
mix test test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/relay/node_queries_test.exs
```

## Next Up

- Continue with `docs/plans/graphql/2026-03-18-lcgql-dataloader-and-n-plus-one.md` -> `Task 2` once Task 1 is complete.

## Repair Conditions

Repair `NOW.md` from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another active track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

# Backend Lane Execution

Last reviewed: 2026-03-22
Status: active

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `profile_content_live_entry`
- Plan: `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md`
- Batch: `Task 3: Verify the profile surface slice and refresh plan tracking`
- Why now: Task 2 is complete, so the next unblocked backend batch is the slice-level compile/test/typecheck pass plus lane-local plan tracking for the finished Relay user profile fields.

## Do This Now

- Run `mix compile`.
- Run `mix test test/live_canvas/feed_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`.
- Run `mix typecheck`.
- Update `docs/plans/feed/2026-03-19-user-profile-content-and-live-entry.md` and `docs/plans/backend/NOW.md` for the next backend milestone.
- Report any required coordinator updates to `docs/plans/INDEX.md` and `docs/plans/NOW.md` in the completion summary instead of editing those shared files directly.

## Verification Scope

```bash
mix compile
mix test test/live_canvas/feed_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix typecheck
```

## Next Up

- Once Task 3 is green and committed, choose the next unblocked backend batch from `docs/plans/INDEX.md` and the relevant `TRACK.md`, then update this lane pointer.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant `TRACK.md` when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

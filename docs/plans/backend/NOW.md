# Backend Lane Execution

Last reviewed: 2026-05-22
Status: active for code-quality triage

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `backend_code_quality_cleanup`
- Source: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- Batch: `Post-Stage-6 handoff: continue Stage 2 discussion or begin Stage 7 planning`
- Why now: The user explicitly made sloppy code, code quality, and tech debt cleanup the new top backend priority. Stage 2 through Stage 6 are complete for the first discussed issue and the Stage 4 scan candidates, so the next run should either continue user-led discussion at the next undecided reported issue or start fix/prevention planning for the first valid issue without a plan.

## Do This Now

- Open `docs/plans/backend/2026-05-22-code-quality-cleanup.md`.
- If continuing issue discussion, resume Stage 2 with the next undecided user-reported issue, starting with `GQL-002` unless it is already marked discussed.
- If continuing planning, start Stage 7 with the first valid issue that does not yet have a fix/prevention plan, starting with `GQL-001` unless it is already planned.
- For one issue at a time, update the issue's status before moving on.
- Do not edit implementation code unless the user explicitly asks to enter Stage 8.
- Report shared dashboard/index repairs instead of editing `docs/plans/NOW.md` or `docs/plans/INDEX.md` from the backend lane.

## Verification Scope

- Stage 2 is discussion and documentation only.
- Stage 3 and Stage 6 scans should use focused `rg` searches first, then code reads for matched areas.
- Stage 7 planning should record the intended fix, prevention checks, verification scope, and Stage 6 watchpoints before implementation.
- Stage 8 implementation batches must define and run focused verification for each issue; if typed code is touched, run `mix typecheck`.

## Completed Batch Evidence

- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 1 completed on 2026-05-22.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-001`; `GQL-002` is the next undecided user-reported issue.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-001`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 4 discovered `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 5 and Stage 6 completed for the Stage 4 candidates.
- Initial checks: `git status --short --branch`, `docs/plans/NOW.md`, `docs/plans/backend/NOW.md`, source conventions doc, and targeted reads/searches across GraphQL resolvers/types, live channel/topic code, chat system events, runtime ownership, and schema files.
- `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` Task 3 passed on 2026-04-24.
- `mix compile` -> PASS.
- `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs` -> PASS (`82 tests, 0 failures`).
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`).
- `docs/plans/content/2026-04-24-post-reporting.md` Task 1 passed on 2026-04-24.
- `mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> PASS (`81 tests, 0 failures`).
- `docs/plans/content/2026-04-24-post-reporting.md` Task 2 passed on 2026-04-24.
- `mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs` -> PASS (`40 tests, 0 failures`).

## Next Up

- Continue Stage 2 in `docs/plans/backend/2026-05-22-code-quality-cleanup.md` at `GQL-002`, or start Stage 7 planning at `GQL-001` if the user asks for planning.

## Required Shared Coordinator Repairs

- `docs/plans/NOW.md`: update the backend lane current batch to `docs/plans/backend/2026-05-22-code-quality-cleanup.md` -> post-Stage-6 handoff: next work is either Stage 2 discussion for `GQL-002` or Stage 7 planning for valid issues starting at `GQL-001`.
- `docs/plans/INDEX.md`: add `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` to completed backend work through Task 3.
- `docs/plans/INDEX.md`: add `docs/plans/content/2026-04-24-post-reporting.md` to completed backend work through Task 2.
- `docs/plans/INDEX.md`: remove or update stale queued-candidate notes for `docs/plans/2026-03-22-development-seed-data.md`, because that plan is already checklist-complete.
- `docs/plans/INDEX.md`: remove the stale note that the active backend lane remains on the live-session state/presence track.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

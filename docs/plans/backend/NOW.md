# Backend Lane Execution

Last reviewed: 2026-04-24
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `content_post_report_review_and_actioning`
- Source: `docs/plans/content/2026-04-24-post-report-review-and-actioning.md`
- Batch: `Task 2: Add post moderation state and hide removed posts from reads`
- Why now: Task 1 added the fresh staff-role authorization gate needed by the moderation workflow. The next prerequisite is durable post moderation state so actioned reports can hide posts from feed, profile, top-level query, and Relay node reads without hard deletion.

## Do This Now

- Execute Task 2 from `docs/plans/content/2026-04-24-post-report-review-and-actioning.md`.
- Stay in backend code and backend planning docs only.
- Use TDD for the post moderation read model: write removed-post visibility tests, verify the expected failure, implement the migration/schema/context/feed changes, then verify green.
- Do not edit `docs/plans/NOW.md`, `docs/plans/INDEX.md`, `mobile/`, `docs/plans/mobile/**`, or shared contract/schema docs from this backend lane.

## Verification Scope

- Task 2 focused verification:
  - `mix test test/live_canvas/content_test.exs test/live_canvas/feed_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
  - `mix compile`
  - `mix typecheck`
- Broaden verification only if Task 2 touches additional shared behavior unexpectedly.

## Completed Batch Evidence

- `docs/plans/content/2026-04-24-post-report-review-and-actioning.md` Task 1 passed on 2026-04-24.
- RED verification: `mix test test/live_canvas/accounts_test.exs` failed with 2 expected failures for missing `LC.Accounts.update_user_role/2` and role schema support.
- `mix test test/live_canvas/accounts_test.exs` -> PASS (`85 tests, 0 failures`; existing telemetry handler error logs were emitted by unrelated account password/reset tests).
- `mix compile` -> PASS.
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`).
- `docs/plans/content/2026-04-24-post-report-review-and-actioning.md` planning batch completed on 2026-04-24.
- Planning verification inspected:
  - `docs/plans/2026-03-03-backend-release-readiness-roadmap.md`
  - `docs/plans/content/2026-04-24-post-reporting.md`
  - `docs/contracts/mobile-graphql-phase2.md`
  - `ARCHITECTURE.md`
  - content/feed/report/moderation-adjacent code under `lib/live_canvas*`, `test/live_canvas*`, and `priv/repo/migrations`
- No code tests were run for the planning-only batch; the new plan defines focused verification for each executable task.
- `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` Task 3 passed on 2026-04-24.
- `mix compile` -> PASS.
- `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs` -> PASS (`82 tests, 0 failures`).
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`).
- `docs/plans/content/2026-04-24-post-reporting.md` Task 1 passed on 2026-04-24.
- `mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> PASS (`81 tests, 0 failures`).
- `docs/plans/content/2026-04-24-post-reporting.md` Task 2 passed on 2026-04-24.
- `mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs` -> PASS (`40 tests, 0 failures`).

## Next Up

- After Task 2 passes and is committed, continue with Task 3 from `docs/plans/content/2026-04-24-post-report-review-and-actioning.md`: add the moderation context report-review workflow.

## Required Shared Coordinator Repairs

- `docs/plans/NOW.md`: update the backend lane to `docs/plans/backend/NOW.md` -> `Task 2: Add post moderation state and hide removed posts from reads` and refresh review metadata if desired.
- `docs/plans/INDEX.md`: add `docs/plans/content/2026-04-24-post-report-review-and-actioning.md` as the active backend product plan.
- `docs/plans/INDEX.md`: add `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` to completed backend work through Task 3.
- `docs/plans/INDEX.md`: add `docs/plans/content/2026-04-24-post-reporting.md` to completed backend work through Task 2.
- `docs/plans/INDEX.md`: remove or update stale queued-candidate notes for `docs/plans/2026-03-22-development-seed-data.md`, because that plan is already checklist-complete.
- `docs/plans/INDEX.md`: remove the stale note that the active backend lane remains on the live-session state/presence track.
- Shared contract docs: after implementation, document `postReportQueue`, `reviewPostReport`, staff-only `PostReport` refetch, post-removal visibility semantics, and moderator/admin provisioning expectations if the coordinator assigns shared-contract updates.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

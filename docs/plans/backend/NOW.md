# Backend Lane Execution

Last reviewed: 2026-04-24
Status: active for execution

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `post_reporting`
- Source: `docs/plans/content/2026-04-24-post-reporting.md`
- Batch: `Task 2: Publish the post-reporting mobile contract and refresh lane tracking`
- Why now: Task 1 added the product-facing `reportPost` persistence, Relay node, GraphQL mutation, and moderation rate-limit classification. The remaining backend-owned step is to publish the mobile contract/tracking documentation for that new content-reporting surface.

## Do This Now

- Use `docs/plans/content/2026-04-24-post-reporting.md` as the source plan.
- Document `reportPost`, supported report reasons, idempotency, visibility rules, and stable user errors in the mobile GraphQL contract only if this lane is explicitly allowed to touch shared contract docs; otherwise report that coordinator/shared-contract update as required follow-up.
- Run the focused Task 2 verification from the source plan after any docs changes.
- Update `docs/plans/content/2026-04-24-post-reporting.md` and this lane file with the outcome.
- Report shared dashboard/index repairs instead of editing `docs/plans/NOW.md` or `docs/plans/INDEX.md` from the backend lane.

## Verification Scope

- `mix test test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`

## Completed Batch Evidence

- `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` Task 3 passed on 2026-04-24.
- `mix compile` -> PASS.
- `mix test test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs` -> PASS (`82 tests, 0 failures`).
- `mix typecheck` -> PASS (`Total errors: 0, Skipped: 0, Unnecessary Skips: 0`).
- `docs/plans/content/2026-04-24-post-reporting.md` Task 1 passed on 2026-04-24.
- `mix test test/live_canvas/content_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs` -> PASS (`81 tests, 0 failures`).

## Next Up

- After Task 2, return to roadmap-driven backend planning unless another product-focused backend slice is explicitly prioritized.

## Required Shared Coordinator Repairs

- `docs/plans/NOW.md`: keep the backend lane aligned to `docs/plans/backend/NOW.md` -> `Task 2: Publish the post-reporting mobile contract and refresh lane tracking` and refresh review metadata if desired.
- `docs/plans/INDEX.md`: add `docs/plans/live/2026-03-27-live-session-client-contract-stabilization.md` to completed backend work through Task 3.
- `docs/plans/INDEX.md`: add `docs/plans/content/2026-04-24-post-reporting.md` as active backend work completed through Task 1, with Task 2 as the next queued backend batch.
- `docs/plans/INDEX.md`: remove or update stale queued-candidate notes for `docs/plans/2026-03-22-development-seed-data.md`, because that plan is already checklist-complete.
- `docs/plans/INDEX.md`: remove the stale note that the active backend lane remains on the live-session state/presence track.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

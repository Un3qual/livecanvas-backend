# Backend Lane Execution

Last reviewed: 2026-05-23
Status: active for code-quality planning

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `backend_code_quality_cleanup`
- Source: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- Batch: `Cleanup stage status audited after GQL-005 Stage 7; implementation requires explicit Stage 8 request`
- Why now: The user selected the owner-only private-field approach for `GQL-005`, then requested a full status audit. The inventory now explicitly records per-issue stage progress and applicability, including Stage 7 plans for `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, and `GQL-008`, with no Stage 8 implementation started.

## Do This Now

- Open `docs/plans/backend/2026-05-22-code-quality-cleanup.md`.
- If the user continues `GQL-005`, enter Stage 8 implementation only if they explicitly ask for `GQL-005` implementation.
- If the user asks to continue Stage 7 planning generally, the next valid or partially valid issue without a Stage 7 plan is `GEN-002`.
- If the user asks to continue Stage 2 discussion instead, the next undecided user-reported issue is `GQL-006`.
- If the user redirects to another issue, preserve the one-issue-at-a-time rule and update that issue's status before moving again.
- If entering implementation, start Stage 8 only for the issue the user explicitly names or requests; `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, and `GQL-008` now all have Stage 7 plans, but implementation code remains explicit-request only.
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
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-001` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 4 discovered `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 5 and Stage 6 completed for the Stage 4 candidates.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-002` on 2026-05-23; user marked it partially valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-002` on 2026-05-23; exact cleanup scope remains concentrated in `LCGQL.Chat.Resolver`, with related but separate input-normalization and transport-shaping boundaries in `LC.Chat.SystemEvents` and `LC.Chat.Broadcasts`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-002` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-003` on 2026-05-23; user marked it valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-003` on 2026-05-23; exact duplicate scope is `LCGQL.Live.Resolver.camelize_lower/1` and `LCGQL.Accounts.Resolver.camelize_lower/1`, with related but contract-sensitive field-name formatters in Accounts, Content, and Social.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-003` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-004` on 2026-05-23; user marked it valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-004` on 2026-05-23; exact cleanup scope includes duplicated `{field, message}` mutation error construction, duplicate changeset interpolation, duplicate field/message formatting, and duplicate context-specific GraphQL error objects, while preserving auth-specific `{field, code, message}` contracts.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-004` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-005` on 2026-05-23; marked partially valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-005` on 2026-05-23; exact cleanup scope is User-node direct private/session fields and `user_identities/3`, while preserving profile/feed/social child fields that already re-apply parent-plus-viewer visibility.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-005` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-008` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` per-issue stage progress and the next-run handoff prompt audited on 2026-05-23; no implementation code touched.
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

- Next for this issue is `GQL-005` Stage 8 only if the user explicitly asks to implement `GQL-005`: add owner-only `User.email`, remove token fields from User, owner-gate `user_identities/3`, and update focused tests. If the user wants more Stage 7 planning, continue with `GEN-002`. If the user wants discussion instead, continue Stage 2 with `GQL-006`.

## Required Shared Coordinator Repairs

- `docs/plans/NOW.md`: update the backend lane current batch to `docs/plans/backend/2026-05-22-code-quality-cleanup.md` -> `GQL-005` is partially valid, scanned, and planned; next issue-local step is Stage 8 only if the user explicitly asks to implement `GQL-005`, while `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, and `GQL-008` also have Stage 7 plans for later explicit implementation.
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

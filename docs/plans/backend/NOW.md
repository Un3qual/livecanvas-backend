# Backend Lane Execution

Last reviewed: 2026-05-30
Status: active for code-quality discussion/planning

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: `backend_code_quality_cleanup`
- Source: `docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- Batch: `GQL-001` Stage 8 complete; awaiting the next explicit issue selection
- Why now: The cleanup inventory is the source of truth for per-issue stage status. `GQL-001` Stage 8 is complete with resolver-only GraphQL timestamp formatting removed, `DOC-001` Stage 8 is complete with docs-only conventions cleanup, `GQL-005` Stage 8 is complete with User-node privacy cleanup, Stage 8 has not started for any other issue, and additional implementation code/schema files remain untouched until the user explicitly requests Stage 8 for a named issue or explicitly starts the dedicated `GEN-001` redesign.
- Current status:
  - Stage 1 is complete for all user-reported issues.
  - `GQL-001`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; resolver-only timestamp formatting has been removed from GraphQL fields.
  - `GQL-002`, `GQL-003`, `GQL-004`, `GQL-006`, `GQL-007`, `ECTO-001`, and `CTX-001`: Stage 2, Stage 3, and Stage 7 complete; Stage 8 not started.
  - `GQL-005`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; User-node private fields now require parent-plus-viewer authorization and token fields are removed from the User node.
  - `SOCK-001`: Stage 2 complete and merged into `SOCK-002`; `SOCK-002` owns both live-session topic generation and parsing cleanup.
  - `SOCK-002`: Stage 2, Stage 3, and Stage 7 complete; Stage 8 not started.
  - `SOCK-003`: Stage 2 and Stage 3 complete with a partially-valid decision; Stage 7 complete; Stage 8 not started.
  - `LIVE-001`: Stage 2 complete with a valid OTP-native ownership redesign decision; Stage 3 complete; Stage 7 complete; Stage 8 not started.
  - `DOC-001`: Stage 2 complete and marked valid; Stage 3 complete; Stage 7 complete; Stage 8 complete with no implementation code touched.
  - `GEN-001`: Stage 2 complete with a deferred-valid decision and a required future fix through a dedicated chat timeline/event-object redesign.
  - Stage 4 is complete.
  - `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009`: Stage 5 and Stage 6 complete.
  - `GQL-008`, `GEN-002`, and `WEB-001`: Stage 7 complete; Stage 8 not started.
  - `GQL-009`: Stage 7 deferred; revisit only if the user explicitly asks to plan that deferred structural cleanup.

## Do This Now

- Open `docs/plans/backend/2026-05-22-code-quality-cleanup.md`.
- For one issue at a time, update the issue's status before moving on.
- If the user explicitly requests Stage 8 for a named issue, follow that issue's Stage 7 plan and run the focused verification recorded there.
- If the user explicitly requests Stage 8 for `SOCK-002`, follow the `SOCK-002` Stage 7 plan and keep the implementation scoped to the transport topic boundary.
- If the user explicitly requests Stage 8 for `SOCK-003`, follow the `SOCK-003` Stage 7 plan and keep the implementation scoped to live-session socket reason-code formatting.
- If the user explicitly requests Stage 8 for `LIVE-001`, follow the `LIVE-001` Stage 7 plan and keep the implementation scoped to replacing Postgres-backed live runtime ownership with the finalized layered `LC.RealtimeRuntime` design: `libcluster` discovery, strict shard ownership, local runtime supervisors, Syn for directory/groups only, and Horde only for soft duplicate-tolerant workers.
- `DOC-001` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GQL-005` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- For `GEN-001`, do not start a cleanup-stage scan by default. The issue is deferred-valid with a required future fix; start a dedicated chat timeline/event-object redesign only if the user explicitly asks.
- If the user asks to continue Stage 7 planning generally, do not start `GQL-009` unless they explicitly ask to revisit that deferred structural cleanup.
- `SOCK-001` is complete for Stage 2 and should not get separate Stage 3, Stage 7, or Stage 8 work; `SOCK-002` owns the combined live-session topic generation and parsing cleanup.
- If the user redirects to another issue, preserve the one-issue-at-a-time rule.
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
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-001` on 2026-05-30; resolver-only GraphQL timestamp formatting was removed, token and signed-upload payloads now return timestamp values for GraphQL scalar serialization, and the convention doc records the prevention rule.
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
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-005` on 2026-05-29; User-node `email` and `userIdentities` now re-apply parent-plus-viewer authorization, User-node token fields were removed, and token payload fields remain on auth/token mutations.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-008` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GEN-002` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `WEB-001` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-006` on 2026-05-23; user marked it partially valid and included removing positive-ID guard checks from the node refetch path, with zero/negative IDs allowed to fall through to DB/query no-result behavior.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-006` on 2026-05-23; exact cleanup scope is struct-based `resolve_type` for Ecto-backed nodes, preserving synthetic contact-match projection handling, removing repeated schema local-ID cast/positive-guard boilerplate, and removing node-path delegated positive-ID guards while preserving authorization-aware fetch boundaries.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-006` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-007` on 2026-05-23; user marked it partially valid and requested a future-framework note for reusable authorization and Relay connection handling.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-007` on 2026-05-23; exact simple wrapper candidates are `chat_message_sender/3`, `host/3`, `follow_request_follower/3`, and `author/3`, while authorization, Relay connection, sorting, and durable-media wrappers remain out of scope for this cleanup.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-007` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `ECTO-001` on 2026-05-23; user marked it valid with tight scope for concise schema-contract summaries covering unique indexes, check constraints, important foreign-key delete behavior, deliberate exceptions, and only behaviorally important non-unique indexes.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `ECTO-001` on 2026-05-23; the scan found 26 persisted schema modules with no schema-local table-contract summaries and identified the migration-backed unique indexes, check constraints, delete semantics, deliberate `users_tokens` UUID-primary-key exception, and behaviorally important non-unique indexes to plan around.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `ECTO-001` on 2026-05-23; no implementation/schema files touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GEN-001` on 2026-05-23; user accepted deferred-valid and emphasized the system-event model must be fixed later through a dedicated chat timeline/event-object redesign.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `CTX-001` on 2026-05-23; user accepted partially valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `CTX-001` on 2026-05-23; the exact cleanup target is hidden app-config runtime-RPC module selection in `LC.Live.runtime_rpc_module/1`, while preserving the explicit `LC.Live.RuntimeRPC` adapter boundary and focused context-test fake adapter.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `CTX-001` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-001` on 2026-05-23; user chose to merge it into `SOCK-002`, so topic parsing cleanup will be handled with shared topic generation cleanup rather than as a separate scan/plan.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` per-issue stage progress and the next-run handoff prompt audited on 2026-05-24; no implementation code touched.
- `docs/plans/backend/NOW.md` aligned with the cleanup inventory status snapshot on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-002` on 2026-05-24; marked valid; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `SOCK-002` on 2026-05-24; topic generation, parsing, broadcast, subscription, telemetry-hint, and test call sites scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `SOCK-002` on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-003` on 2026-05-24; marked partially valid; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `SOCK-003` on 2026-05-24; channel error reason formatting, telemetry reason normalization, runtime redaction, disconnect reason payloads, and tests scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `SOCK-003` on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `LIVE-001` on 2026-05-24; user selected option #2 and marked it valid for replacing Postgres-backed runtime ownership with an OTP-native ownership design; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `LIVE-001` on 2026-05-24; ownership claims, runtime process lifecycle, remote routing, viewer snapshots, peer-node partition behavior, release drills, and data-governance references scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan finalized for `LIVE-001` on 2026-05-29; planned implementation replaces Postgres-backed runtime owner leases with a layered `LC.RealtimeRuntime` design using `libcluster`, strict shard ownership, local runtime supervisors, Syn for directory/groups only, and Horde only for soft duplicate-tolerant workers; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `DOC-001` on 2026-05-29; marked valid because `docs/architecture/conventions.md` still mixes durable backend standards with a progress checklist and planned-refactor tracking; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `DOC-001` on 2026-05-29; exact cleanup scope is `docs/architecture/conventions.md` lines 3-13 and 36-38, while convention-plan and backend-lane status docs are intentionally out of scope; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `DOC-001` on 2026-05-29; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `DOC-001` on 2026-05-29; `docs/architecture/conventions.md` now removes task/status tracking, preserves durable standards, and adds documentation-hygiene rules; no implementation code touched.
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

- Await explicit user selection:
  - Stage 8 implementation for a named issue with a completed Stage 7 plan, including `SOCK-002` or `SOCK-003` if explicitly requested.
  - Stage 8 implementation for `LIVE-001` if explicitly requested, following the finalized `LC.RealtimeRuntime` shard-ownership plan.
  - Dedicated `GEN-001` chat timeline/event-object redesign.
  - Explicit deferred Stage 7 planning for `GQL-009`.

## Required Shared Coordinator Repairs

- `docs/plans/NOW.md`: update the backend lane current batch to `docs/plans/backend/2026-05-22-code-quality-cleanup.md` -> `GQL-001` Stage 2, Stage 3, Stage 7, and Stage 8 complete with resolver-only GraphQL timestamp formatting removed; `SOCK-001` Stage 2 complete and merged into `SOCK-002`; `SOCK-002` Stage 2, Stage 3, and Stage 7 complete with Stage 8 not started; `SOCK-003` Stage 2, Stage 3, and Stage 7 complete with Stage 8 not started; `LIVE-001` Stage 2, Stage 3, and Stage 7 complete with Stage 8 not started and finalized around the layered `LC.RealtimeRuntime` shard-ownership design; `DOC-001` Stage 2, Stage 3, Stage 7, and Stage 8 complete with no implementation code touched; `GQL-005` Stage 2, Stage 3, Stage 7, and Stage 8 complete with User-node private field cleanup; `CTX-001` Stage 7 complete and Stage 8 not started; `GEN-001` Stage 2 complete with a deferred-valid decision and required future chat timeline/event-object fix; `ECTO-001` Stage 7 complete and Stage 8 not started; `GQL-007` Stage 7 is complete and Stage 8 not started; `GQL-002`, `GQL-003`, `GQL-004`, `GQL-006`, `GQL-008`, `GEN-002`, and `WEB-001` are planned; Stage 8 remains explicit-request only for a named issue.
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

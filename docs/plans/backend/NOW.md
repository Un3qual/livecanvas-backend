# Backend Lane Execution

Last reviewed: 2026-05-31
Status: `GEN-001` chat timeline/event-object backend implementation complete; no unblocked backend implementation batch remains

## Lane Scope

- Own backend code and backend planning docs only.
- Do not edit `mobile/`, `docs/plans/mobile/**`, or coordinator-owned shared docs such as `docs/plans/NOW.md` and `docs/plans/INDEX.md`.

## Current Batch

- Track: none active after `GEN-001` closeout.
- Source: `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-redesign.md`; `docs/plans/backend/2026-05-31-gen-001-chat-timeline-event-implementation-plan.md`; `docs/plans/backend/2026-05-22-code-quality-cleanup.md` remains background only.
- Batch: no active backend implementation batch remains.
- Why now: `GEN-001` was explicitly started as a dedicated chat timeline/event-object redesign and is now implemented and verified.
- Current status:
  - Stage 1 is complete for all user-reported issues.
  - `GQL-001`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; resolver-only timestamp formatting has been removed from GraphQL fields.
  - `GQL-002`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; resolver-local generic chat projection helpers have been moved to shared domain/context and focused GraphQL boundary modules.
  - `GQL-003`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; resolver-local field-name casing helpers now delegate to `LCGQL.FieldNames`.
  - `GQL-004`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; common GraphQL mutation error construction and changeset interpolation now live in shared `LCGQL` modules.
  - `GQL-006`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; Relay node type resolution now matches concrete schema structs and non-positive node-local IDs fall through to scoped lookup queries.
  - `GQL-007`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; simple child association fields now use inline Absinthe dataloader declarations while auth/sorting/connection fields remain resolver-backed.
  - `GQL-008`: Stage 4, Stage 5, Stage 6, Stage 7, and Stage 8 complete; contact-match GraphQL projection now flattens scalar fields once so connection, mutation, and Relay node paths can use direct fields.
  - `GEN-002`: Stage 4, Stage 5, Stage 6, Stage 7, and Stage 8 complete; async/webhook/job fixed-key payload extraction now uses `LC.Infra.Payload`, and observability socket context handling no longer converts strings to atoms.
  - `WEB-001`: Stage 4, Stage 5, Stage 6, Stage 7, and Stage 8 complete; GraphQL and metrics HTTP Authorization Bearer parsing now delegate to `LCTransport.BearerAuth`.
  - `ECTO-001`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; persisted schema modules now include concise table-contract summaries.
  - `CTX-001`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; hidden runtime-RPC app-config module selection was removed in favor of explicit per-call adapter injection.
  - `GQL-005`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; User-node private fields now require parent-plus-viewer authorization and token fields are removed from the User node.
  - `SOCK-001`: Stage 2 complete and merged into `SOCK-002`; `SOCK-002` owns both live-session topic generation and parsing cleanup.
  - `SOCK-002`: Stage 2, Stage 3, Stage 7, and Stage 8 complete; live-session topic generation and parsing now live in `LCTransport.LiveSessionTopics`.
  - `SOCK-003`: Stage 2 and Stage 3 complete with a partially-valid decision; Stage 7 complete; Stage 8 complete; client-facing live-session socket reason strings now live in `LCTransport.LiveSessionReasons`.
  - `LIVE-001`: Stage 2 complete with a valid OTP-native ownership redesign decision; Stage 3 complete; Stage 7 complete; Stage 8 complete; live-session runtime ownership now routes through `LC.RealtimeRuntime` shard ownership and shard-local runtime supervision. The first slice kept the existing `DNSCluster` discovery path instead of adding `libcluster`.
  - `DOC-001`: Stage 2 complete and marked valid; Stage 3 complete; Stage 7 complete; Stage 8 complete with no implementation code touched.
  - `GEN-001`: dedicated chat timeline/event-object backend implementation complete; old chat-message system-event coupling has been replaced with first-class timeline events, timeline GraphQL, timeline channel broadcasts, and data-governance timeline handling.
  - Stage 4 is complete.
  - `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009`: Stage 5 and Stage 6 complete.
  - `GQL-009`: Stage 7 complete; Stage 8 complete. Contact responsibilities live in `LCGQL.Accounts.ContactResolver`, data-governance responsibilities live in `LCGQL.Accounts.DataGovernanceResolver`, user/profile/identity responsibilities live in `LCGQL.Accounts.UserResolver`, auth/recovery/token responsibilities live in `LCGQL.Accounts.AuthResolver`, and the old `LCGQL.Accounts.Resolver` module has been removed.

## Do This Now

- No unblocked backend implementation batch remains in this lane.
- No further cleanup-stage implementation is currently unblocked in `docs/plans/backend/2026-05-22-code-quality-cleanup.md`.
- If shared coordinator docs still point at active backend `GEN-001` work, report that dashboard repair is needed instead of editing `docs/plans/NOW.md` or `docs/plans/INDEX.md` from the backend lane unless explicitly assigned.
- `SOCK-002` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `SOCK-003` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `LIVE-001` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GQL-008` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GEN-002` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `WEB-001` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `DOC-001` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GQL-005` Stage 8 is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GEN-001` is complete; do not reopen it unless the user explicitly asks for a follow-up adjustment.
- `GQL-009` has been explicitly revisited by the user; keep scope to the Accounts resolver structural split and do not broaden into unrelated Accounts behavior changes.
- `SOCK-001` is complete for Stage 2 and should not get separate Stage 3, Stage 7, or Stage 8 work; `SOCK-002` owns the combined live-session topic generation and parsing cleanup.
- If the user redirects to another issue, preserve the one-issue-at-a-time rule.
- Do not edit implementation code for blocked/deferred cleanup issues.
- Shared dashboard/index repair is coordinator-owned; report future shared-doc repairs instead of editing `docs/plans/NOW.md` or `docs/plans/INDEX.md` from the backend lane unless explicitly assigned.

## Verification Scope

- No active backend implementation batch is selected.
- Stage 2 is discussion and documentation only.
- Stage 3 and Stage 6 scans should use focused `rg` searches first, then code reads for matched areas.
- Stage 7 planning should record the intended fix, prevention checks, verification scope, and Stage 6 watchpoints before implementation.
- Stage 8 implementation batches must define and run focused verification for each issue; if typed code is touched, run `mix typecheck`.
- Final `GEN-001` verification passed with the focused chat/live/relay/data-governance test suite, `mix compile`, `mix typecheck`, `git diff --check`, broad stale-surface search, and precise stale-surface search.

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
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-002` on 2026-05-30; resolver-local visible-body and system-event projection helpers were removed, redaction now delegates through `LC.Chat.visible_body/1`, and `LCGQL.Chat.SystemEventProjection` owns persisted metadata projection into GraphQL values.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-003` on 2026-05-23; user marked it valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-003` on 2026-05-23; exact duplicate scope is `LCGQL.Live.Resolver.camelize_lower/1` and `LCGQL.Accounts.Resolver.camelize_lower/1`, with related but contract-sensitive field-name formatters in Accounts, Content, and Social.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-003` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-003` on 2026-05-30; duplicated resolver-local `camelize_lower/1` helpers were removed, `LCGQL.FieldNames.lower_camel/1` now owns shared GraphQL field-name formatting, and existing live/auth mutation error field contracts were preserved.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-004` on 2026-05-23; user marked it valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-004` on 2026-05-23; exact cleanup scope includes duplicated `{field, message}` mutation error construction, duplicate changeset interpolation, duplicate field/message formatting, and duplicate context-specific GraphQL error objects, while preserving auth-specific `{field, code, message}` contracts.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-004` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-004` on 2026-05-30; common GraphQL mutation error map construction and changeset interpolation moved to `LCGQL.MutationErrors`, shared `:user_error` and `:auth_error` schema types moved to `LCGQL.MutationErrorTypes`, content/social mutation payloads now use `:user_error`, and resolver-local duplicated mutation error builders were removed while preserving field/message contracts.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-005` on 2026-05-23; marked partially valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-005` on 2026-05-23; exact cleanup scope is User-node direct private/session fields and `user_identities/3`, while preserving profile/feed/social child fields that already re-apply parent-plus-viewer visibility.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-005` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-005` on 2026-05-29; User-node `email` and `userIdentities` now re-apply parent-plus-viewer authorization, User-node token fields were removed, and token payload fields remain on auth/token mutations.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-008` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-008` on 2026-05-30; contact-match connection, mutation, and Relay node paths now reuse `contact_match_node/1` projection, direct `contactName`/`birthday` fields preserve output, and resolver-only nested scalar/date field resolvers were removed.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GEN-002` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GEN-002` on 2026-05-30; `LC.Infra.Payload` now owns fixed known-key payload lookup and positive-integer extraction, async/webhook/data-governance handlers delegate duplicate id parsing, observability socket context no longer uses `String.to_atom/1`, and focused helper plus atom-key integration tests cover the contract.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `WEB-001` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `WEB-001` on 2026-05-30; `LCTransport.BearerAuth` centralizes HTTP Authorization Bearer parsing, GraphQL request context and metrics auth delegate to it, malformed bearer headers remain authoritative for GraphQL, and focused parser/caller tests cover casing, whitespace, malformed headers, and metrics authorization.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-006` on 2026-05-23; user marked it partially valid and included removing positive-ID guard checks from the node refetch path, with zero/negative IDs allowed to fall through to DB/query no-result behavior.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-006` on 2026-05-23; exact cleanup scope is struct-based `resolve_type` for Ecto-backed nodes, preserving synthetic contact-match projection handling, removing repeated schema local-ID cast/positive-guard boilerplate, and removing node-path delegated positive-ID guards while preserving authorization-aware fetch boundaries.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-006` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-006` on 2026-05-30; `LCGQL.Schema` now resolves Ecto-backed Relay nodes by concrete schema structs, preserves the synthetic contact-match projection, centralizes node-local ID casting, lets non-positive local IDs reach authorization-aware lookup queries, removes delegated node-refetch positive-ID guards, and records the convention.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GQL-007` on 2026-05-23; user marked it partially valid and requested a future-framework note for reusable authorization and Relay connection handling.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `GQL-007` on 2026-05-23; exact simple wrapper candidates are `chat_message_sender/3`, `host/3`, `follow_request_follower/3`, and `author/3`, while authorization, Relay connection, sorting, and durable-media wrappers remain out of scope for this cleanup.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `GQL-007` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `GQL-007` on 2026-05-30; the four resolver-only association wrappers were replaced with inline Absinthe dataloader declarations, auth/sorting/connection fields remain resolver-backed, and the convention doc records the dataloader-wrapper rule.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `ECTO-001` on 2026-05-23; user marked it valid with tight scope for concise schema-contract summaries covering unique indexes, check constraints, important foreign-key delete behavior, deliberate exceptions, and only behaviorally important non-unique indexes.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `ECTO-001` on 2026-05-23; the scan found 26 persisted schema modules with no schema-local table-contract summaries and identified the migration-backed unique indexes, check constraints, delete semantics, deliberate `users_tokens` UUID-primary-key exception, and behaviorally important non-unique indexes to plan around.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `ECTO-001` on 2026-05-23; no implementation/schema files touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `ECTO-001` on 2026-05-30; all 26 persisted schema modules now have concise `@moduledoc` table-contract summaries, the `users_tokens` UUID-primary-key exception remains explicit, historical `users.email` and `(context, token)` contracts were excluded, and the convention doc records the schema-contract summary rule.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `GEN-001` on 2026-05-23; user accepted deferred-valid and emphasized the system-event model must be fixed later through a dedicated chat timeline/event-object redesign.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `CTX-001` on 2026-05-23; user accepted partially valid.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `CTX-001` on 2026-05-23; the exact cleanup target is hidden app-config runtime-RPC module selection in `LC.Live.runtime_rpc_module/1`, while preserving the explicit `LC.Live.RuntimeRPC` adapter boundary and focused context-test fake adapter.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `CTX-001` on 2026-05-23; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `CTX-001` on 2026-05-30; `LC.Live` no longer reads `runtime_rpc` from app config, runtime RPC adapter selection is explicit through per-call opts, channel tests no longer mutate `LC.Live` app config for fake RPC outcomes, and the convention doc records the runtime-boundary/test-seam rule.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-001` on 2026-05-23; user chose to merge it into `SOCK-002`, so topic parsing cleanup will be handled with shared topic generation cleanup rather than as a separate scan/plan.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` per-issue stage progress and the next-run handoff prompt audited on 2026-05-24; no implementation code touched.
- `docs/plans/backend/NOW.md` aligned with the cleanup inventory status snapshot on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-002` on 2026-05-24; marked valid; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `SOCK-002` on 2026-05-24; topic generation, parsing, broadcast, subscription, telemetry-hint, and test call sites scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `SOCK-002` on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `SOCK-002` on 2026-05-30; `LCTransport.LiveSessionTopics` now owns live-session topic generation/parsing, GraphQL and channel call sites delegate to it, and chat broadcasts receive prebuilt transport topics.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `SOCK-003` on 2026-05-24; marked partially valid; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `SOCK-003` on 2026-05-24; channel error reason formatting, telemetry reason normalization, runtime redaction, disconnect reason payloads, and tests scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `SOCK-003` on 2026-05-24; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `SOCK-003` on 2026-05-30; `LCTransport.LiveSessionReasons` now owns client-facing live-session socket reason strings, channel join/chat error payloads and GraphQL lifecycle disconnect broadcasts delegate to it, and telemetry reason normalization remains channel-local.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `LIVE-001` on 2026-05-24; user selected option #2 and marked it valid for replacing Postgres-backed runtime ownership with an OTP-native ownership design; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `LIVE-001` on 2026-05-24; ownership claims, runtime process lifecycle, remote routing, viewer snapshots, peer-node partition behavior, release drills, and data-governance references scanned; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan finalized for `LIVE-001` on 2026-05-29; planned implementation replaces Postgres-backed runtime owner leases with a layered `LC.RealtimeRuntime` design using `libcluster`, strict shard ownership, local runtime supervisors, Syn for directory/groups only, and Horde only for soft duplicate-tolerant workers; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `LIVE-001` on 2026-05-30; live-session runtime ownership now routes through `LC.RealtimeRuntime` shard ownership and shard-local runtime supervision, the Postgres runtime-owner schema/table path is removed by a drop migration, lease heartbeat configuration/tests were removed, remote/unavailable routing stays fail-closed, release/data-governance docs no longer use lease-owner language, and the first slice kept the existing `DNSCluster` discovery path instead of adding `libcluster`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 2 completed for `DOC-001` on 2026-05-29; marked valid because `docs/architecture/conventions.md` still mixes durable backend standards with a progress checklist and planned-refactor tracking; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 3 completed for `DOC-001` on 2026-05-29; exact cleanup scope is `docs/architecture/conventions.md` lines 3-13 and 36-38, while convention-plan and backend-lane status docs are intentionally out of scope; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 7 fix/prevention plan written for `DOC-001` on 2026-05-29; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` Stage 8 completed for `DOC-001` on 2026-05-29; `docs/architecture/conventions.md` now removes task/status tracking, preserves durable standards, and adds documentation-hygiene rules; no implementation code touched.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` `GQL-009` Stage 8 Task 2 completed on 2026-05-31; `LCGQL.Accounts.DataGovernanceResolver` now owns data-export/account-deletion query and mutation responsibilities, data-governance ID decoding, option filtering, and error mapping. Verification: `mix test test/live_canvas_gql/accounts/data_governance_resolver_test.exs`, `mix test test/live_canvas_gql/accounts/account_mutations_test.exs`, `mix compile`, and `mix typecheck`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` `GQL-009` Stage 8 Task 3 completed on 2026-05-31; `LCGQL.Accounts.UserResolver` now owns viewer lookup, private user email, profile child connections, user identity fields, profile/privacy mutations, identity unlinking, owner re-authorization helpers, and identity ID/error mapping. Verification: `mix test test/live_canvas_gql/accounts/user_resolver_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`, `mix compile`, and `mix typecheck`.
- `docs/plans/backend/2026-05-22-code-quality-cleanup.md` `GQL-009` Stage 8 Task 4 completed on 2026-05-31; `LCGQL.Accounts.AuthResolver` now owns auth challenge/sign-up/login, viewer token issue/refresh/revoke, password reset request/reset, deterministic auth URL builders, auth validation, token projection, and auth-entry payload projection. The old `LCGQL.Accounts.Resolver` module was removed after schema references moved to focused resolver modules. Verification: `mix test test/live_canvas_gql/accounts/auth_resolver_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs test/integration/accounts_login_flow_test.exs`, `mix compile`, and `mix typecheck`.
- `GEN-001` dedicated chat timeline/event-object redesign implementation completed on 2026-05-31. Verification: `mix test test/live_canvas/chat_timeline_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_retention_test.exs` passed with 126 tests and 0 failures; `mix compile` passed; `mix typecheck` passed with `Total errors: 0, Skipped: 0, Unnecessary Skips: 0`; `git diff --check` passed; precise stale-surface search across `config lib test docs/architecture` returned no exact legacy table/API/broadcast hits.
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

- No unblocked backend implementation batch remains in this lane.
- If the shared coordinator dashboard still lists active backend `GEN-001` implementation, report it as stale and leave repair to a coordinator-assigned pass.

## Completed Shared Coordinator Repairs

- `docs/plans/NOW.md`: repaired on 2026-05-31 to point the backend lane at active `GQL-009` cleanup work.
- `docs/plans/INDEX.md`: repaired on 2026-05-31 to add completed live-session client-contract and post-reporting entries, mark development seed data complete, remove the stale active live-session lane note, and point the backend lane at active `GQL-009` cleanup work.
- `docs/plans/NOW.md`: repaired on 2026-05-31 to point the backend lane at the explicitly requested dedicated `GEN-001` chat timeline/event-object redesign.
- `docs/plans/INDEX.md`: repaired on 2026-05-31 to mark backend code-quality cleanup implementation complete and add the explicitly requested `GEN-001` redesign track.
- `docs/plans/NOW.md`: repaired on 2026-05-31 after `GEN-001` closeout to report no active backend implementation batch.
- `docs/plans/INDEX.md`: repaired on 2026-05-31 after `GEN-001` closeout to mark the redesign implementation complete and clear the backend queued batch.

## Repair Conditions

Repair this lane pointer from `docs/plans/INDEX.md` and the relevant source plan when:

- the current batch is already complete
- the current batch is blocked
- another backend track is explicitly reprioritized ahead of it
- the selected plan no longer matches the codebase

# Backend Code Quality Cleanup Inventory

Last reviewed: 2026-05-29
Status: `DOC-001` Stage 7 complete; Stage 8 not started
Owner lane: backend

## Purpose

This document is the handoff point for the staged code quality cleanup. The user has made fixing sloppy code, unnecessary complexity, and avoidable duplication the top backend priority. No implementation changes should happen until the relevant issue has been discussed and marked valid or partially valid.

## Stage Model

Use this same stage language for every issue.

- [x] Stage 1: Capture and initially analyze the user-reported issues.
- [x] Stage 2: Discuss each user-reported issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [ ] Stage 3: For each valid or partially valid user-reported issue, scan the codebase for the same or similar patterns and attach the findings to that issue.
- [x] Stage 4: Using the valid or partially valid user-reported issues as calibration, perform an agent-led quality scan for additional slop, anti-patterns, repetition, hard-to-read code, poor documentation, and unnecessary complexity.
- [x] Stage 5: Discuss each newly discovered issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [x] Stage 6: For each valid or partially valid newly discovered issue, scan for same or similar patterns and attach the findings.
- [ ] Stage 7: For each valid or partially valid issue, write a detailed fix and prevention plan, including standards or docs needed to keep it from returning.
- [ ] Stage 8: Fix each valid or partially valid issue one at a time with focused verification.

Applicability note: Stages 1-3 apply to user-reported issues. Stage 4 is one global agent-led scan. Stages 5-6 apply to issues discovered during Stage 4. Stages 7-8 apply to every issue once it has been marked valid or partially valid and scanned.

## Current Handoff

Stage status was audited on 2026-05-29 after `DOC-001` Stage 7 planning. `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-006`, `GQL-007`, `ECTO-001`, `CTX-001`, `SOCK-002`, `SOCK-003`, `LIVE-001`, and `DOC-001` have Stage 2, Stage 3, and Stage 7 complete. `SOCK-001` has Stage 2 complete with a merge-into-`SOCK-002` decision: the duplicate live-session topic-id parsing concern is real, but topic parsing should be fixed with the same shared topic-boundary work as topic generation. `SOCK-003` Stage 7 keeps the public socket reason-string contract and plans an explicit transport-owned reason-code boundary. `LIVE-001` Stage 7 now chooses a layered Kubernetes runtime architecture: `libcluster` handles BEAM cluster discovery, strict shard ownership is the authoritative boundary, local `Registry`/`DynamicSupervisor` trees host session/chat/game/media runtimes, Syn may be used for directory/process-group metadata, Horde is allowed only for soft restartable workers, and Postgres/Swarm remain excluded from runtime ownership. `DOC-001` Stage 7 plans a docs-only conventions cleanup: remove the `Progress` checklist and `Planned Refactors` section from `docs/architecture/conventions.md`, keep durable standards, and add a short documentation-hygiene rule that keeps task/status tracking in plan and lane-status docs. `GEN-001` has Stage 2 complete with a deferred-valid decision: the client-facing system-event model must be fixed later, but the fix requires a dedicated chat timeline/event-object redesign rather than an implicit code-quality cleanup pass. Stage 5 and Stage 6 are complete for Stage 4 candidates: `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009` have been discussed and scanned. `GQL-008`, `GEN-002`, and `WEB-001` also have Stage 7 complete. No Stage 8 implementation has started for any cleanup issue. Continue next by entering Stage 8 implementation for `DOC-001`, `LIVE-001`, or another planned issue only if the user explicitly asks for that named issue, starting the dedicated `GEN-001` chat timeline/event-object redesign only if the user explicitly asks, or revisiting deferred `GQL-009` Stage 7 only if the user explicitly asks to plan that deferred structural cleanup. Keep the discussion/planning issue-by-issue. Do not edit implementation code until the user explicitly asks to enter Stage 8.

Initial repository checks performed on 2026-05-22:

- `git status --short --branch` showed a detached `HEAD` and no listed local changes.
- `docs/plans/backend/NOW.md` was in planning mode before this inventory.
- `docs/plans/NOW.md` is coordinator-owned and should not be edited by backend-lane workers.
- Source convention doc checked: `docs/architecture/conventions.md`.

## Discussion Queue

User-reported issues:

1. `GQL-001` - Timestamp string resolvers and string timestamp fields.
2. `GQL-002` - Chat resolver presentation and data-shaping helpers.
3. `GQL-003` - Duplicate and hacky `camelize_lower/1`.
4. `GQL-004` - Duplicated GraphQL mutation error helpers.
5. `GQL-005` - Viewer-specific data on the User node.
6. `GQL-006` - `schema.ex` node resolution and type resolution.
7. `GQL-007` - Resolver wrappers that only dataload associations.
8. `ECTO-001` - Ecto schema files do not summarize constraints and indexes.
9. `GEN-001` - System events are modeled as chat messages instead of client-facing event objects.
10. `CTX-001` - `runtime_rpc_module/1` indirection.
11. `SOCK-001` - `parse_session_id/1` and `parse_session_id_hint/1`.
12. `SOCK-002` - Topic name generators duplicated across GraphQL, chat, and channel modules.
13. `SOCK-003` - Channel error reason formatters.
14. `LIVE-001` - Live session runtime ownership stored in Postgres.
15. `DOC-001` - Task-specific information in general convention docs.

Stage 5 candidate issues discovered by the Stage 4 scan:

1. `GQL-008` - Contact-match field resolvers only project nested contact-entry data.
2. `GEN-002` - Repeated atom/string payload extraction helpers across webhook and job handlers.
3. `WEB-001` - Duplicate bearer Authorization header parsing in GraphQL and metrics plugs.
4. `GQL-009` - Accounts GraphQL resolver has accumulated unrelated API responsibilities.

## Current Stage Snapshot

User-reported issue status:

- `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-006`, `GQL-007`, `ECTO-001`, and `CTX-001`: Stage 1 complete, Stage 2 complete, Stage 3 complete, Stage 7 complete, Stage 8 not started.
- `GEN-001`: Stage 1 complete, Stage 2 complete with a deferred-valid decision; Stage 3 and Stage 7 deferred until a dedicated chat timeline/event-object redesign is explicitly started; Stage 8 blocked until that redesign is planned and implementation is explicitly requested.
- `SOCK-001`: Stage 1 complete, Stage 2 complete with a merge-into-`SOCK-002` decision; no separate Stage 3, Stage 7, or Stage 8 work should run.
- `SOCK-002`: Stage 1 complete, Stage 2 complete and marked valid, Stage 3 complete, Stage 7 complete; Stage 8 blocked until implementation is explicitly requested.
- `SOCK-003`: Stage 1 complete, Stage 2 complete and marked partially valid, Stage 3 complete, Stage 7 complete; Stage 8 blocked until implementation is explicitly requested.
- `LIVE-001`: Stage 1 complete, Stage 2 complete and marked valid, Stage 3 complete, Stage 7 complete; Stage 8 blocked until implementation is explicitly requested.
- `DOC-001`: Stage 1 complete, Stage 2 complete and marked valid, Stage 3 complete, Stage 7 complete; Stage 8 blocked until implementation is explicitly requested.

Stage 4 candidate issue status:

- `GQL-008`: Stage 4 complete, Stage 5 complete, Stage 6 complete, Stage 7 complete, Stage 8 not started.
- `GEN-002`: Stage 4 complete, Stage 5 complete, Stage 6 complete, Stage 7 complete, Stage 8 not started.
- `WEB-001`: Stage 4 complete, Stage 5 complete, Stage 6 complete, Stage 7 complete, Stage 8 not started.
- `GQL-009`: Stage 4 complete, Stage 5 complete with a deferred-valid decision, Stage 6 complete, Stage 7 deferred until narrower cleanup work is planned or fixed, Stage 8 blocked until Stage 7 is written and implementation is explicitly requested.

## Issues

### GQL-001 - Timestamp String Resolvers And String Timestamp Fields

**User concern:** GraphQL schema code has dedicated resolvers that convert timestamps to strings. Absinthe can serialize timestamps, so these fields should not need resolver functions.

**Initial assessment:** Valid. The schema can keep timestamp fields exposed as `:string`; the issue is the dedicated resolver functions that only convert Ecto `%DateTime{}` values into strings. Absinthe string serialization can own that conversion, and it is acceptable if the output uses Elixir's `DateTime` string formatting rather than explicit ISO8601 formatting.

**Stage 2 decision:** Marked valid on 2026-05-22. Keep the public GraphQL schema contract as `:string`, remove resolver functions whose only behavior is timestamp-to-string conversion, and avoid migrating these fields to a datetime scalar as part of this issue.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_types.ex` defines `moderated_at` and `inserted_at` as `:string` with resolver functions.
- `lib/live_canvas_gql/chat/chat_resolver.ex` has `chat_message_moderated_at/3` and `chat_message_inserted_at/3`.
- `lib/live_canvas_gql/social/social_resolver.ex` has `follow_request_requested_at/3`.
- `lib/live_canvas_gql/accounts/account_resolver.ex` has `iso8601_datetime/1` and data-export/account-deletion timestamp resolvers.
- `lib/live_canvas_gql/content/content_resolver.ex` formats signed upload `expires_at`.
- Many timestamp fields in `lib/live_canvas_gql/**/*_types.ex` are declared as `:string`.

**What likely needs to change:**

- Keep the existing `:string` GraphQL field contract for timestamp values.
- Replace unnecessary timestamp resolver functions with direct field declarations where Absinthe can serialize the Ecto timestamp value.
- Update tests to assert the API contract rather than resolver implementation details.
- Keep any transport-only manual formatting, such as raw Phoenix channel JSON payloads, separate from GraphQL cleanup.

**Stage 3 scan findings:**

Scan commands run on 2026-05-22:

- `rg -n "DateTime\\.to_iso8601|iso8601_datetime|to_iso8601\\(" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "field :[a-zA-Z0-9_]*(at|At|time|Time|expires|Expires|purge|Purge)[a-zA-Z0-9_]*, (non_null\\()?:(string|id)" lib/live_canvas_gql`
- `rg -n "@spec .*_at\\(|def .*_at\\(|requested_at|completed_at|moderated_at|inserted_at|expires_at|scheduled_purge_at" lib/live_canvas_gql`

Direct resolver-only timestamp conversions to remove in Stage 8:

- `lib/live_canvas_gql/chat/chat_types.ex`: `moderated_at` and `inserted_at` fields are `:string` fields with dedicated resolver functions.
- `lib/live_canvas_gql/chat/chat_resolver.ex`: `chat_message_moderated_at/3` and `chat_message_inserted_at/3` only convert `%DateTime{}` values with `DateTime.to_iso8601/1` plus nil/default fallbacks.
- `lib/live_canvas_gql/social/social_types.ex`: `requested_at` on `:follow_request` is a `:string` field with a dedicated resolver function.
- `lib/live_canvas_gql/social/social_resolver.ex`: `follow_request_requested_at/3` only converts `%DateTime{}` with `DateTime.to_iso8601/1` plus a default fallback.
- `lib/live_canvas_gql/accounts/account_types.ex`: data-export `requested_at`/`completed_at` and account-deletion `requested_at`/`scheduled_purge_at`/`completed_at` are `:string` fields with dedicated resolver functions.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `data_export_requested_at/3`, `data_export_completed_at/3`, `account_deletion_requested_at/3`, `account_deletion_scheduled_purge_at/3`, and `account_deletion_completed_at/3` only pass fields through `iso8601_datetime/1` plus nil/default fallbacks.

Related GraphQL payload-shaping conversions to review during Stage 7:

- `lib/live_canvas_gql/accounts/account_resolver.ex`: `token_view/1` pre-formats `user_token.inserted_at` through `iso8601_datetime/1` before returning the GraphQL token object. This is not a field resolver, but it is the same unnecessary GraphQL-layer DateTime-to-string conversion if the payload can safely return the DateTime value.
- `lib/live_canvas_gql/content/content_resolver.ex`: `signed_upload_view/1` pre-formats `upload.expires_at` with `DateTime.to_iso8601/1` before returning the GraphQL signed-upload object. This is not Ecto-backed, but it is a similar GraphQL payload-shaping conversion and should be consciously kept or removed in the fix plan.

Already-direct timestamp string fields found during the scan:

- `lib/live_canvas_gql/feed/feed_types.ex`: `started_at`, `ended_at`, and `inserted_at` are direct `:string` fields with no timestamp formatting resolver.
- `lib/live_canvas_gql/accounts/account_types.ex`: `User.inserted_at`, `UserIdentity.inserted_at`, and token timestamp fields are direct `:string` fields with no timestamp formatting field resolver.
- `lib/live_canvas_gql/content/content_types.ex`: media/post/user-media/comment `inserted_at` and post `expires_at` fields are direct `:string` fields with no timestamp formatting resolver.

Related test expectation:

- `test/live_canvas_gql/chat/chat_queries_test.exs` currently computes expected `moderated_at` with `DateTime.to_iso8601/1`; Stage 8 should update the assertion if the field output changes to Elixir's default DateTime string format.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep every public GraphQL field in this issue typed as `:string` or `non_null(:string)`. Do not introduce a datetime scalar and do not rename any GraphQL field.
- In `lib/live_canvas_gql/chat/chat_types.ex`, change `moderated_at` and `inserted_at` to direct field declarations with the same nullability. Remove `chat_message_moderated_at/3` and `chat_message_inserted_at/3` plus their specs from `lib/live_canvas_gql/chat/chat_resolver.ex`.
- In `lib/live_canvas_gql/social/social_types.ex`, change `requested_at` on `:follow_request` to a direct field declaration with the same nullability. Remove `follow_request_requested_at/3` plus its spec from `lib/live_canvas_gql/social/social_resolver.ex`.
- In `lib/live_canvas_gql/accounts/account_types.ex`, change data-export `requested_at`/`completed_at` and account-deletion `requested_at`/`scheduled_purge_at`/`completed_at` to direct field declarations with the same nullability. Remove `data_export_requested_at/3`, `data_export_completed_at/3`, `account_deletion_requested_at/3`, `account_deletion_scheduled_purge_at/3`, and `account_deletion_completed_at/3` plus their specs from `lib/live_canvas_gql/accounts/account_resolver.ex`.
- Review the two related payload-shaping conversions while editing the same resolver family. Prefer returning the original timestamp values from `token_view/1` and `signed_upload_view/1` so the GraphQL field serializer owns string output; keep explicit formatting only if a focused test proves these non-Ecto payload maps cannot be serialized directly.
- If Stage 8 returns timestamp values from `token_view/1` or `signed_upload_view/1`, update the related local typespecs and type aliases (`@type token_view`, `@spec token_view/1`, `@type signed_upload_view`, and `@spec signed_upload_view/1`) so `mix typecheck` validates the new payload shape.
- Remove `iso8601_datetime/1` from `lib/live_canvas_gql/accounts/account_resolver.ex` only after its last caller is gone.
- Do not touch Phoenix channel payload formatting, chat broadcast payloads, storage URL generation, global ID formatting, or direct timestamp fields that already have no resolver.

Focused test updates:

- Update `test/live_canvas_gql/chat/chat_queries_test.exs` so moderated chat assertions no longer compute `DateTime.to_iso8601/1`; assert the GraphQL string contract and that the value represents the removed message timestamp under the direct-field output.
- Keep existing account data-governance, social follow-request, content signed-upload, and node-query assertions focused on string presence/nullability unless the Stage 8 change reveals an exact output contract that needs to be pinned.
- Do not broaden this issue into `GQL-008`; contact-match birthday formatting remains tracked separately.

Prevention checks:

- Add a durable convention note during Stage 8, preferably in `docs/architecture/conventions.md`, that GraphQL fields must not use resolver functions whose only behavior is timestamp-to-string conversion; direct fields should own simple scalar serialization.
- After editing, run `rg -n "chat_message_(moderated|inserted)_at|follow_request_requested_at|data_export_.*_at|account_deletion_.*_at|iso8601_datetime" lib/live_canvas_gql test/live_canvas_gql` and expect no hits for `GQL-001` helpers.
- Run `rg -n "DateTime\\.to_iso8601|to_iso8601\\(" lib/live_canvas_gql test/live_canvas_gql` and account for any remaining hits as either non-`GQL-001` work, a justified explicit transport/API formatting boundary, or follow-up issue scope.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- `mix typecheck`

**Where to look first:**

- `lib/live_canvas_gql/chat/chat_types.ex`
- `lib/live_canvas_gql/chat/chat_resolver.ex`
- `lib/live_canvas_gql/social/social_types.ex`
- `lib/live_canvas_gql/social/social_resolver.ex`
- `lib/live_canvas_gql/accounts/account_types.ex`
- `lib/live_canvas_gql/accounts/account_resolver.ex`
- `lib/live_canvas_gql/content/content_types.ex`
- `lib/live_canvas_gql/content/content_resolver.ex`
- `lib/live_canvas_gql/feed/feed_types.ex`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-002 - Chat Resolver Presentation And Data-Shaping Helpers

**User concern:** `chat_resolver.ex` contains formatting and manual result shaping helpers such as `metadata/1`, `value_for/2`, `cast_system_event_type/1`, `visible_body/1`, and `system_event_type/1`. Structured rendering should be universal under `live_canvas_gql`, and enum/string conversion should not live in context-specific resolvers.

**Initial assessment:** Likely valid, with one important design dependency: the larger system-event model in `GEN-001` may supersede much of the current `ChatMessage` field projection. The current resolver parses map keys, accepts both string and atom enum values, manually converts system event metadata into GraphQL fields, and duplicates visible-body behavior already present in `LC.Chat.ChatMessage.visible_body/1` for broadcast payloads.

**Stage 2 decision:** Marked partially valid on 2026-05-23. The resolver-local metadata lookup, atom/string enum casting, and duplicated body redaction are real cleanup targets. Not every field resolver is inherently wrong: GraphQL still needs a boundary for Relay global IDs in `system_event_details`, and the broader `GEN-001` event-object design may replace this projection instead of just relocating it. A first cleanup should remove resolver-local generic parsing/rendering without redesigning durable chat events in this issue.

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "defp? (metadata|value_for|cast_.*type|.*system_event.*|visible_body|.*_details|.*_payload|.*_view|normalize_metadata|kind_string|status_string)|Map\\.get\\([^\\n]+Atom\\.to_string|Atom\\.to_string\\(|to_global_id\\(:chat_message|chat_message_entropy_id|chat_message_id" lib/live_canvas_gql lib/live_canvas lib/live_canvas_web test/live_canvas_gql/chat test/live_canvas_web/channels/live_session_channel_test.exs`
- `rg -n "chat_message_(body|system_event_type|system_event_details)|system_event_details|systemEventDetails|visible_body|metadata\\(|value_for\\(|cast_system_event_type|message_payload\\(|normalize_metadata" lib test`

Findings:

- Exact `GQL-002` cleanup scope remains concentrated in `lib/live_canvas_gql/chat/chat_resolver.ex`: `chat_message_body/3`, `chat_message_system_event_type/3`, and `chat_message_system_event_details/3` delegate to resolver-local `visible_body/1`, `metadata/1`, `value_for/2`, `cast_system_event_type/1`, `system_event_type/1`, and `system_event_details/1`.
- The resolver-local `visible_body/1` duplicates part of `LC.Chat.ChatMessage.visible_body/1`, but handles string `"removed"` while the domain helper currently treats only atom `:removed` as removed. Stage 7 should decide whether GraphQL can rely on schema-normalized atoms or whether the domain helper should own both representations before the resolver duplicate is removed.
- `LC.Chat.SystemEvents` has a separate `value_for/2` for atom/string metadata lookup when accepting insert metadata, and stores durable system-event metadata with string keys. This is a legitimate input-normalization boundary, but Stage 7 should avoid preserving duplicate lookup semantics independently in GraphQL.
- `LC.Chat.Broadcasts.message_payload/1` and `LC.Chat.message_payload/1` are related transport shaping, not GraphQL shaping. They should stay out of the first `GQL-002` fix except where a shared domain helper such as visible-body redaction already exists.
- `LCGQL.Live.Resolver` and `LCGQL.Chat.Resolver` both emit lifecycle/removal system events and then broadcast them. This overlap is event-production orchestration, not the same presentation/data-shaping issue; keep it out of `GQL-002` unless `GEN-001` later redesigns system events.
- `test/live_canvas_gql/chat/chat_queries_test.exs` has focused coverage for mixed user/system history and typed `systemEventDetails` projection, including Relay global ID output for `chatMessageId`. Stage 8 should preserve that API contract or update it only under a deliberate GraphQL schema change.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep the current public GraphQL shape for this issue: `ChatMessage` remains the node type, `body` remains nullable string, `systemEventType` remains `:chat_system_event_type`, and `systemEventDetails` remains `:chat_system_event_details` with Relay global `chatMessageId` output. Do not introduce the `GEN-001` event interface/object redesign in this issue.
- Keep the persisted chat model unchanged: `chat_messages.kind`, `chat_messages.status`, and `chat_messages.metadata` stay as they are. Do not add migrations, new tables, or new durable event schemas for `GQL-002`.
- In `lib/live_canvas/chat/chat_message.ex`, make `LC.Chat.ChatMessage.visible_body/1` the single redaction helper used by GraphQL and socket payloads. Update the private removed-status predicate so it treats both `:removed` and `"removed"` as removed, then delete the resolver-local duplicate instead of preserving two redaction implementations.
- In `lib/live_canvas_gql/chat/chat_resolver.ex`, alias `LC.Chat.ChatMessage` as the changeset/projection helper and change `chat_message_body/3` to return `ChatMessageChanges.visible_body(chat_message)`. Remove private `visible_body/1` and its spec from the resolver.
- Add a small GraphQL boundary module, preferably `lib/live_canvas_gql/chat/system_event_projection.ex`, to own projection from persisted chat-message system-event metadata into GraphQL values. Give it public `event_type/1` and `details/1` functions with typespecs.
- In the new projection module, read the stored metadata shape explicitly: `"event_type"` under `metadata`, `"details"` under `metadata`, and `"chat_message_id"` / `"chat_message_entropy_id"` under details. Do not carry over a generic atom/string `value_for/2` helper into GraphQL. Durable system events are already stored with string keys by `LC.Chat.SystemEvents`.
- Keep Relay global ID creation in the GraphQL projection module. `details/1` should convert a positive integer `"chat_message_id"` into `Absinthe.Relay.Node.to_global_id(:chat_message, id, LCGQL.Schema)` and should copy only a binary `"chat_message_entropy_id"`. Return `nil` for empty or invalid detail payloads so clients keep the current nullable field semantics.
- Map only the current stored event-type strings `"message_removed"`, `"session_ended"`, and `"session_live"` to atoms accepted by the Absinthe enum. Unknown or missing event types should return `nil`; do not accept new event types as part of this cleanup.
- In `lib/live_canvas_gql/chat/chat_resolver.ex`, delegate `chat_message_system_event_type/3` and `chat_message_system_event_details/3` to the new projection module. Remove resolver-local `metadata/1`, `value_for/2`, `cast_system_event_type/1`, `system_event_type/1`, and `system_event_details/1`, plus the now-local `@type chat_system_event_details` if the new projection module owns that type.
- Do not touch `LC.Chat.SystemEvents.value_for/2` in this issue. That helper is an input-normalization boundary for accepting insert metadata and is also related to `GEN-002`; `GQL-002` should only remove GraphQL resolver-local parsing/presentation helpers.
- Do not touch `LC.Chat.Broadcasts.message_payload/1` or `LC.Chat.message_payload/1` except through the shared `LC.Chat.ChatMessage.visible_body/1` behavior. Socket payload string formatting remains transport-specific and outside this GraphQL cleanup.
- Do not touch `chat_message_sender/3`; simple association-loader wrappers are tracked under `GQL-007`.
- Do not touch `mutation_error/2`, `error_field/2`, or `error_message/1`; GraphQL mutation error helpers are tracked under `GQL-004`.
- Do not touch `chat_message_moderated_at/3` or `chat_message_inserted_at/3`; timestamp resolver cleanup is tracked under `GQL-001`.

Focused test updates:

- In `test/live_canvas_schemas/chat/chat_message_test.exs`, extend the `visible_body/1` test so an input map or `%ChatMessage{}` with status `"removed"` is redacted the same as status `:removed`. This guards the shared helper before the GraphQL resolver delegates to it.
- In `test/live_canvas_gql/chat/chat_queries_test.exs`, keep the existing mixed user/system history test asserting `systemEventType: "MESSAGE_REMOVED"` and Relay-formatted `systemEventDetails.chatMessageId`. If Stage 8 extracts a projection module without changing behavior, this test should remain the main API regression guard.
- Add a focused GraphQL query assertion, either by extending the mixed history test or adding a small separate test, that a user message with ordinary metadata still returns `systemEventType: nil` and `systemEventDetails: nil`. This protects the projection module from treating arbitrary metadata as a system event.
- If the new projection module is easy to exercise only through GraphQL, do not add resolver-private unit tests. Prefer public GraphQL tests and the existing domain helper test over testing private parsing details.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: GraphQL resolvers may authorize, paginate, and adapt domain data to GraphQL-specific IDs, but generic scalar/body redaction and reusable projection/parsing should live in domain helpers or focused `LCGQL` boundary modules rather than resolver-private helper clusters.
- After editing, run `rg -n "defp (metadata|value_for|cast_system_event_type|visible_body|system_event_type|system_event_details)" lib/live_canvas_gql/chat/chat_resolver.ex` and expect no hits.
- Run `rg -n "SystemEventProjection|ChatMessageChanges.visible_body" lib/live_canvas_gql/chat/chat_resolver.ex` and confirm the resolver delegates to the new projection module and shared visible-body helper.
- Run `rg -n "Map\\.get\\([^\\n]+Atom\\.to_string|defp value_for|cast_system_event_type" lib/live_canvas_gql/chat` and account for any remaining GraphQL-side atom/string metadata lookup. The expected Stage 8 result is no generic atom/string lookup in `lib/live_canvas_gql/chat`.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_schemas/chat/chat_message_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve Relay global ID output for `systemEventDetails.chatMessageId`; clients should not receive raw database IDs from GraphQL.
- Preserve nil behavior for non-system messages and invalid/missing system-event details.
- Keep socket transport formatting and durable system-event persistence out of this issue.
- Keep the larger `GEN-001` event-object/interface redesign separate.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_resolver.ex` contains the exact helper list and manual system-event projection.
- `lib/live_canvas/chat/system_events.ex` also has `value_for/2` for atom/string metadata lookup.
- `lib/live_canvas/chat/broadcasts.ex` manually formats chat transport payloads and enum strings for sockets.
- `lib/live_canvas_schemas/chat/chat_message.ex` currently stores `kind`, `status`, and `metadata` on one `chat_messages` row type.

**What likely needs to change:**

- Decide whether GraphQL keeps a `ChatMessage` node temporarily or moves directly toward a chat event interface.
- Move generic GraphQL response/error rendering into `LCGQL` helpers if this behavior remains needed.
- Stop accepting atom/string enum variants in GraphQL resolvers unless there is a specific boundary reason.
- Keep domain validation and transport payload shaping outside GraphQL resolvers.

**Where to look first:**

- `lib/live_canvas_gql/chat/chat_resolver.ex`
- `lib/live_canvas_gql/chat/chat_types.ex`
- `lib/live_canvas/chat/system_events.ex`
- `lib/live_canvas/chat/broadcasts.ex`
- `lib/live_canvas/chat/chat_message.ex`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-003 - Duplicate And Hacky `camelize_lower/1`

**User concern:** `camelize_lower/1` is duplicated in two GraphQL resolver files, is not needed in both, and is written in a hacky way.

**Initial assessment:** Valid. The duplicate implementation appears in `LCGQL.Live.Resolver` and `LCGQL.Accounts.Resolver`. It performs atom-to-string, `Macro.camelize/1`, and manual first-character lowercasing. Field-name conversion should either use a shared GraphQL helper or be avoided by letting Absinthe/adapters own external names.

**Stage 2 decision:** Marked valid on 2026-05-23, with narrow scope. The duplicated local implementation is real slop, and the manual first-character lowercasing is fragile compared with a shared GraphQL field-name helper or framework-aligned naming adapter. The cleanup should not decide the broader mutation-error model by itself: `GQL-004` owns whether changeset traversal and mutation error payloads become universal. For `GQL-003`, the likely fix is to centralize external field-name formatting and replace resolver-local copies where the current API contract still wants lower-camel field paths.

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "camelize_lower|Macro\\.camelize|prefixed_auth_field|format_.*field|field_name|error_field|to_string\\(field\\)|Atom\\.to_string\\(field\\)|field: .*field" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "traverse_errors|format_changeset_errors|format_auth_changeset_errors|changeset_errors|mutation_error\\(|social_error\\(|post_mutation_error\\(|auth_error\\(" lib/live_canvas_gql`
- `rg -n "\\\"field\\\" => \\\"[A-Za-z0-9_.]+\\\"|field\\\" =>|\\\"field\\\"" test/live_canvas_gql/accounts test/live_canvas_gql/live test/live_canvas_gql/content test/live_canvas_gql/social test/live_canvas_gql/chat`
- `rg -n "Absinthe\\.Adapter|adapter|camelize|underscore|to_camel|camel" config lib test`

Findings:

- Exact duplicate scope is limited to `lib/live_canvas_gql/live/live_resolver.ex` and `lib/live_canvas_gql/accounts/account_resolver.ex`: both define the same private `camelize_lower/1` implementation using `Atom.to_string/1`, `Macro.camelize/1`, and manual first-codepoint lowercasing.
- `LCGQL.Live.Resolver.format_changeset_errors/1` uses `camelize_lower/1` for changeset field names. The same resolver also has explicit field mappings for invalid IDs, such as `"liveSessionId"` and `"recordingMediaAssetId"`, through `error_field/2`.
- `LCGQL.Accounts.Resolver.format_auth_changeset_errors/2` uses `prefixed_auth_field/2`, which delegates to `camelize_lower/1`, for auth-path fields such as `"password.passwordConfirmation"`, `"magicLink.token"`, and `"oauth.idToken"`.
- `LCGQL.Accounts.Resolver.format_changeset_errors/1` intentionally returns `to_string(field)` for ordinary account changeset errors today. Tests currently assert snake_case account fields such as `"password_confirmation"`, so Stage 7 must not blindly change all account mutation error fields to lower camel case.
- Similar but not identical local field-name formatters exist outside the exact duplicate: `LCGQL.Content.Resolver.format_post_field/1` maps `:media_asset_ids` and `:post_id` to lower-camel API names, and `LCGQL.Social.Resolver.format_field/1` maps relationship ID fields to lower-camel API names with an `Atom.to_string/1` fallback.
- No Absinthe adapter/helper for this project-specific mutation-error `field` payload was found in config or code. Stage 7 should decide whether to add a focused `LCGQL` helper instead of expecting Absinthe field adapters to format arbitrary error payload strings.
- Tests pin a mixed public contract: Live errors assert lower-camel fields, auth errors assert dotted lower-camel field paths, Content/Social invalid ID errors assert lower-camel fields, and ordinary Accounts changeset errors assert snake_case fields. Stage 8 should preserve that contract unless `GQL-004` deliberately changes mutation error semantics.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Add a focused GraphQL naming helper module, preferably `lib/live_canvas_gql/field_names.ex`, to own conversion from internal atom field names to external lower-camel GraphQL field names. Keep it small and public enough for resolver modules to share; suggested API: `LCGQL.FieldNames.lower_camel/1`.
- Implement the helper using a clear string transformation rather than hand-rolled first-codepoint logic in each resolver. Prefer an implementation that converts atom keys through the same conceptual casing Absinthe exposes to clients, for example atom -> string -> `Macro.camelize/1` -> `String.replace_prefix(..., first, String.downcase(first))`, or a similarly explicit helper with tests. Do not introduce a dependency for this small conversion.
- Add typespecs to the new helper. Since this is new public typed code, Stage 8 must run `mix typecheck`.
- Replace `camelize_lower/1` in `lib/live_canvas_gql/live/live_resolver.ex` with `LCGQL.FieldNames.lower_camel/1` inside `format_changeset_errors/1`, then remove the private `camelize_lower/1` and its spec from that resolver.
- Replace `camelize_lower/1` in `lib/live_canvas_gql/accounts/account_resolver.ex` by changing `prefixed_auth_field/2` to call `LCGQL.FieldNames.lower_camel/1`, then remove the private `camelize_lower/1` and its spec from that resolver.
- Keep `LCGQL.Accounts.Resolver.format_changeset_errors/1` returning `to_string(field)` for ordinary account changeset errors during `GQL-003`; tests currently pin snake_case fields such as `"password_confirmation"`. Any decision to normalize all mutation error fields belongs to `GQL-004`.
- Do not change explicit public error field strings such as `"liveSessionId"`, `"recordingMediaAssetId"`, `"password.passwordConfirmation"`, `"magicLink.token"`, `"oauth.idToken"`, `"postId"`, `"followedId"`, or `"mutedId"`.
- Do not refactor `format_changeset_errors/1`, `format_auth_changeset_errors/2`, `mutation_error/2`, `post_mutation_error/2`, or `social_error/2` beyond replacing duplicated field-name conversion. Those helper-shape decisions are tracked under `GQL-004`.
- Do not change Content or Social resolver field-name formatters in the first Stage 8 pass unless the new helper can replace their exact lower-camel mappings without changing fallback behavior. If touched, keep it limited to replacing explicit lower-camel conversion, not restructuring error builders.

Focused test updates:

- Add a focused unit test for the new helper, preferably `test/live_canvas_gql/field_names_test.exs`, covering at least `:live_session_id -> "liveSessionId"`, `:recording_media_asset_id -> "recordingMediaAssetId"`, `:password_confirmation -> "passwordConfirmation"`, `:id_token -> "idToken"`, and `:challenge_token -> "challengeToken"`.
- Keep the existing Live mutation assertions that pin lower-camel fields, especially `"liveSessionId"` and `"recordingMediaAssetId"`, as regression coverage for `LCGQL.Live.Resolver`.
- Keep the existing Accounts auth mutation assertions that pin dotted field paths, especially `"password.passwordConfirmation"`, `"magicLink.token"`, and `"oauth.idToken"`, as regression coverage for `LCGQL.Accounts.Resolver`.
- Keep ordinary Accounts changeset tests that assert snake_case fields, such as `"password_confirmation"`, unchanged unless `GQL-004` later changes the API contract.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: when GraphQL payloads need external field-name strings, use the shared `LCGQL.FieldNames` helper instead of resolver-local casing functions; do not silently change existing mutation error field contracts while doing helper cleanup.
- After editing, run `rg -n "camelize_lower|Macro\\.camelize" lib/live_canvas_gql test/live_canvas_gql` and expect no resolver-local `camelize_lower/1` or GraphQL-side `Macro.camelize/1` hits outside the shared helper/test.
- Run `rg -n "prefixed_auth_field|FieldNames\\.lower_camel|field: .*lower_camel" lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/live/live_resolver.ex` and confirm both resolver call sites use the shared helper.
- Run `rg -n "\\\"password_confirmation\\\"|\\\"password\\.passwordConfirmation\\\"|\\\"magicLink\\.token\\\"|\\\"oauth\\.idToken\\\"|\\\"recordingMediaAssetId\\\"|\\\"liveSessionId\\\"" test/live_canvas_gql/accounts test/live_canvas_gql/live` and confirm the contract-sensitive assertions remain present.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/field_names_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve the mixed current public contract: Live and auth-path fields use lower camel case, while ordinary Accounts changeset fields remain snake_case.
- Keep `GQL-003` limited to field-name casing duplication; do not pull in `GQL-004` mutation error helper consolidation.
- Avoid relying on Absinthe adapters for arbitrary strings in mutation error payloads; these are data values, not schema field identifiers.
- If Content or Social field-name formatters are considered for the shared helper, verify their existing tests and do not change fallback semantics in this issue.

Additional Stage 2 notes:

- `LCGQL.Live.Resolver.format_changeset_errors/1` uses `camelize_lower/1` for changeset field names, while its hand-written invalid-ID fields already use explicit external names such as `"liveSessionId"` and `"recordingMediaAssetId"`.
- `LCGQL.Accounts.Resolver.format_changeset_errors/1` currently leaves ordinary account changeset fields as `to_string(field)`, but `format_auth_changeset_errors/2` uses `prefixed_auth_field/2` plus `camelize_lower/1` for auth field paths such as `"password.passwordConfirmation"`, `"magicLink.token"`, and `"oauth.idToken"`.
- The current public API has mixed field-name conventions across mutation families. `GQL-003` should remove the duplicate helper without silently changing all mutation error field contracts.

**Evidence seen:**

- `lib/live_canvas_gql/live/live_resolver.ex` defines `camelize_lower/1` for changeset error fields.
- `lib/live_canvas_gql/accounts/account_resolver.ex` defines the same helper for auth field prefixes.

**What likely needs to change:**

- Decide whether mutation errors should expose external field names at all.
- If yes, centralize field-name formatting in one `LCGQL` module and use an implementation aligned with Absinthe naming.
- Remove resolver-local duplicates.

**Where to look first:**

- `lib/live_canvas_gql/live/live_resolver.ex`
- `lib/live_canvas_gql/accounts/account_resolver.ex`
- Any future shared error module created for `GQL-004`.

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-004 - Duplicated GraphQL Mutation Error Helpers

**User concern:** Resolver-local helpers like `error_field/2` and `mutation_error/2` are unneeded and duplicated. If GraphQL responses need structured errors, that should be universal, not attached to specific contexts.

**Initial assessment:** Likely valid. Error payloads are currently split across `user_error`, `content_error`, `social_error`, and `auth_error`, while resolvers each carry local formatting helpers. Some differences are real API contract differences, such as `auth_error.code`, but the common `{field, message}` shape is duplicated.

**Stage 2 decision:** Marked valid on 2026-05-23. The duplication is real: multiple resolvers independently build `%{field: ..., message: ...}` errors, traverse changesets, replace `%{key}` placeholders, map raw internal fields to public GraphQL field strings, and stringify atom reasons. However, not every helper is unneeded or interchangeable. Accounts auth errors include `code`, several resolvers intentionally preserve different field-name contracts, and `GQL-003` already owns shared field-name casing. A first fix should centralize common GraphQL mutation error construction and changeset message interpolation while preserving each mutation family's public field names and auth-specific `code`.

Additional Stage 2 notes:

- `LCGQL.Chat.Resolver.mutation_error/2`, `LCGQL.Live.Resolver.mutation_error/2`, `LCGQL.Content.Resolver.post_mutation_error/2`, and `LCGQL.Social.Resolver.social_error/2` all produce a `%{field: ..., message: ...}`-style payload.
- `LCGQL.Accounts.Resolver` has many one-off `%{field: ..., message: ...}` helpers for contacts, data governance, identities, invites, password reset, and refresh tokens, plus separate `%{field: ..., code: ..., message: ...}` auth errors.
- `LCGQL.Live.Resolver`, `LCGQL.Content.Resolver`, and `LCGQL.Accounts.Resolver` each traverse changeset errors and duplicate the same interpolation logic for `%{key}` placeholders.
- `LCGQL.Social.Resolver.format_error_message/1`, `LCGQL.Chat.Resolver.error_message/1`, and other helpers repeatedly convert atom reasons to public message strings, with local exceptions such as invalid IDs becoming `"is invalid"`.
- `GQL-004` should coordinate with `GQL-003` and `GQL-009`: field-name casing should use the future shared field-name helper, and large Accounts module splitting should wait until shared error helpers exist.

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "\b(mutation_error|post_mutation_error|social_error|auth_error|user_error|content_error|chat_error)\b" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "\b(format_changeset_errors|traverse_errors|format_auth_changeset_errors|changeset\.errors|Ecto\.Changeset)\b" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "\b(error_field|format_field|format_post_field|format_auth_field|camelize_lower|field_name|format_error_message|error_message)\b" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n '%\{field:.*message:|field: nil, message:|field: "[^"]+", message:' lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "\bobject\(:.*error|field :errors|non_null\(:.*error|:auth_error|:user_error|:content_error|:social_error\b" lib/live_canvas_gql`

Common schema error object duplication:

- `lib/live_canvas_gql/accounts/account_types.ex`: `object :user_error` exposes the generic `{field, message}` shape used by Accounts, Chat, and Live mutation payloads.
- `lib/live_canvas_gql/content/content_types.ex`: `object :content_error` duplicates the same `{field, message}` shape under a content-specific name.
- `lib/live_canvas_gql/social/social_types.ex`: `object :social_error` duplicates the same `{field, message}` shape under a social-specific name.
- `lib/live_canvas_gql/accounts/account_types.ex`: `object :auth_error` is related but intentionally different because auth entry/challenge payloads include a required `code` field.

Resolver-local common error builders:

- `lib/live_canvas_gql/chat/chat_resolver.ex`: `mutation_error/2`, `error_field/2`, and `error_message/1` build `{field, message}` errors for `remove_live_chat_message/3`.
- `lib/live_canvas_gql/live/live_resolver.ex`: `mutation_error/2`, `error_field/2`, and `error_message/1` build the same shape for live session mutations.
- `lib/live_canvas_gql/content/content_resolver.ex`: `post_mutation_error/2` and `format_post_field/1` build the same shape for post mutations, while `create_post/3` and media-upload fallbacks also still construct literal `%{field: ..., message: ...}` maps inline.
- `lib/live_canvas_gql/social/social_resolver.ex`: `social_error/2`, `format_field/1`, and `format_error_message/1` build the same shape for follow/block/mute mutations.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `contact_upsert_error/1`, `data_export_error/1`, `account_deletion_error/1`, `unlink_identity_error/1`, `invite_delivery_error/1`, `reset_password_error/1`, `refresh_auth_error/1`, and several inline maps all build the same non-auth `{field, message}` shape.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `auth_error/3`, `passkey_challenge_error/1`, `require_auth_field/3`, and `format_auth_changeset_errors/2` should share low-level message/field formatting where possible, but must keep the public `{field, code, message}` auth error contract.

Duplicated changeset formatting:

- `lib/live_canvas_gql/live/live_resolver.ex`: `format_changeset_errors/1` traverses changesets, interpolates `%{key}` placeholders, lower-camelizes fields, and emits mutation error maps.
- `lib/live_canvas_gql/content/content_resolver.ex`: `format_changeset_errors/1` repeats the same traversal and placeholder interpolation, but keeps fields as `to_string(field)`.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `format_changeset_errors/1` repeats the same traversal and placeholder interpolation for `:user_error` payloads.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `format_auth_changeset_errors/2` repeats the traversal/interpolation again, then prefixes/lower-camelizes fields and wraps them in auth errors with `code: :invalid_input`.

Message and field formatting differences to preserve during Stage 7/8:

- Chat and Live currently translate invalid Relay ID/type failures to field-specific lower-camel names and message `"is invalid"`; other reasons use `Atom.to_string/1`.
- Content post ID/media-asset ID failures currently use lower-camel field names but message strings from `Atom.to_string/1`; content changeset errors keep raw snake_case field names.
- Social ID failures use lower-camel field names and atom-string messages such as `"invalid_id"`; tests assert this behavior.
- Accounts non-auth errors mix raw changeset field names, explicit lower-camel public input fields, `"is invalid"` messages, atom-string messages, and domain-specific messages such as `"export_unavailable"` and `"deletion_unavailable"`.
- `LCGQL.Context`, `LCGQL.Schema`, and `LCGQL.Dataloader` also mention `auth_error`, but those hits are request-context auth metadata and are not mutation error helper duplication.

Existing focused regression coverage for Stage 8:

- `test/live_canvas_gql/chat/chat_mutations_test.exs` covers `removeLiveChatMessage` success and structured error responses.
- `test/live_canvas_gql/live/live_mutations_test.exs` covers live session mutation error field/message payloads, including invalid IDs and changeset-backed recording asset errors.
- `test/live_canvas_gql/content/content_mutations_test.exs` covers content mutation error payloads and schema shape.
- `test/live_canvas_gql/social/social_mutations_test.exs` covers social mutation error field/message payloads, including current `"invalid_id"` message behavior.
- `test/live_canvas_gql/accounts/account_mutations_test.exs` covers both `UserError` and `AuthError` payload shapes, including auth-specific `code`.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Add a focused GraphQL helper module, preferably `lib/live_canvas_gql/mutation_errors.ex`, to own GraphQL mutation error map construction and changeset interpolation. This module should be the only GraphQL-layer place that knows how to build `%{field: ..., message: ...}` and `%{field: ..., code: ..., message: ...}` maps.
- Give the new helper public typespecs. Suggested API:

  ```elixir
  @type field_name :: String.t() | nil
  @type user_error :: %{field: field_name(), message: String.t()}
  @type auth_error_code :: atom()
  @type auth_error :: %{field: field_name(), code: auth_error_code(), message: String.t()}
  @type field_mapper :: (atom() -> field_name())

  @spec user_error(field_name(), String.t() | atom()) :: user_error()
  @spec invalid_error(field_name()) :: user_error()
  @spec changeset_errors(Ecto.Changeset.t(), field_mapper()) :: [user_error()]
  @spec auth_error(field_name(), auth_error_code(), String.t() | nil) :: auth_error()
  @spec auth_changeset_errors(Ecto.Changeset.t(), String.t(), field_mapper()) :: [auth_error()]
  ```

- Keep reason-to-message policy intentionally small in the shared helper: binary messages pass through, atom messages use `Atom.to_string/1`, and invalid Relay/global-ID errors use explicit caller choice through `invalid_error/1`. Do not add a global reason registry that hides domain-specific messages.
- Centralize changeset interpolation in the helper. The helper should call `Ecto.Changeset.traverse_errors/2`, replace `%{key}` placeholders with option values, flatten the traversed result, and apply the caller-provided field mapper. Preserve current field-name contracts by choosing the field mapper at each resolver call site.
- Add a focused GraphQL type module, preferably `lib/live_canvas_gql/mutation_error_types.ex`, for the shared schema error objects. Move `object :user_error`, `enum :auth_error_code`, and `object :auth_error` out of `lib/live_canvas_gql/accounts/account_types.ex` into this module, then import it from `lib/live_canvas_gql/schema.ex` before account/content/social mutation/type modules reference those types.
- Change content and social mutation payloads to use `:user_error` instead of their duplicated context-specific `:content_error` and `:social_error` object types. Remove `object :content_error` from `lib/live_canvas_gql/content/content_types.ex` and `object :social_error` from `lib/live_canvas_gql/social/social_types.ex`. Preserve each mutation's `errors { field message }` payload shape; the intentional schema change is the GraphQL object type name becoming universal.
- Keep `:auth_error` separate because auth challenge/sign-up/log-in payloads require `code`. Do not collapse auth errors into `:user_error`, and do not remove or rename auth error code enum values.
- Migrate resolvers by family after the helper tests exist. Replace local map construction first, then remove now-unused private helpers and imports:
  - `LCGQL.Chat.Resolver`: replace `mutation_error/2`, `error_field/2`, and `error_message/1` with `MutationErrors.user_error/2` and `MutationErrors.invalid_error/1` call sites for `remove_live_chat_message/3`.
  - `LCGQL.Live.Resolver`: replace `mutation_error/2`, `error_field/2`, `error_message/1`, and `format_changeset_errors/1` with the helper. For changesets, use a lower-camel mapper. If `GQL-003` has already added `LCGQL.FieldNames.lower_camel/1`, use it; otherwise keep the existing local mapper until `GQL-003` Stage 8 removes it.
  - `LCGQL.Content.Resolver`: replace `post_mutation_error/2`, `format_post_field/1`, literal unauthenticated/upload-unavailable maps, and `format_changeset_errors/1` with the helper. Preserve current raw snake_case changeset fields and lower-camel explicit input ID fields.
  - `LCGQL.Social.Resolver`: replace `social_error/2`, `format_field/1`, and `format_error_message/1` with the helper. Preserve existing social invalid-ID messages as `"invalid_id"` rather than changing them to `"is invalid"`.
  - `LCGQL.Accounts.Resolver`: replace `format_changeset_errors/1`, inline non-auth error maps, `contact_upsert_error/1`, `data_export_error/1`, `account_deletion_error/1`, `unlink_identity_error/1`, `invite_delivery_error/1`, `reset_password_error/1`, and `refresh_auth_error/1` so they delegate map construction to `MutationErrors.user_error/2` or `MutationErrors.invalid_error/1`. Domain-specific reason-to-field/message mapping can remain as small resolver functions where it improves readability.
  - `LCGQL.Accounts.Resolver`: replace `auth_error/3` and `format_auth_changeset_errors/2` with `MutationErrors.auth_error/3` and `MutationErrors.auth_changeset_errors/3`. Keep `passkey_challenge_error/1`, `require_auth_field/3`, and auth entry payload helpers only as domain flow helpers that call the shared error builder.
- Keep `GQL-004` separate from `GQL-009`: do not split the large Accounts resolver while implementing this issue. Only touch Accounts code needed to centralize mutation error construction and changeset interpolation.
- Keep `GQL-004` separate from `GQL-003`: do not introduce a second lower-camel field-name helper. If the shared `LCGQL.FieldNames` module exists, use it; if not, keep field mapping local and let `GQL-003` remove the casing duplicate later.

Focused test plan:

- Add `test/live_canvas_gql/mutation_errors_test.exs` for the new helper before migrating resolvers. Cover:
  - `user_error(nil, :unauthenticated)` returns `%{field: nil, message: "unauthenticated"}`.
  - `user_error("postId", :not_found)` returns `%{field: "postId", message: "not_found"}`.
  - `invalid_error("liveSessionId")` returns `%{field: "liveSessionId", message: "is invalid"}`.
  - `auth_error("password.email", :email_taken, "has already been taken")` returns a map with `code: :email_taken` and the custom message.
  - `auth_error(nil, :invalid_input, nil)` returns message `"invalid_input"`.
  - `changeset_errors/2` interpolates a message such as `"should be at least %{count} character(s)"` and applies the supplied field mapper.
  - `auth_changeset_errors/3` prefixes the formatted field path, sets `code: :invalid_input`, and interpolates the message.
- Keep the existing GraphQL mutation regression suites as the public contract tests:
  - `test/live_canvas_gql/chat/chat_mutations_test.exs`
  - `test/live_canvas_gql/live/live_mutations_test.exs`
  - `test/live_canvas_gql/content/content_mutations_test.exs`
  - `test/live_canvas_gql/social/social_mutations_test.exs`
  - `test/live_canvas_gql/accounts/account_mutations_test.exs`
- Add or adjust schema/introspection assertions only where existing tests pin payload object names. The accepted schema result after this cleanup is that content and social mutation `errors` fields use `[UserError!]!`; auth mutation `errors` fields still use `[AuthError!]!`.
- Do not update tests to normalize field names or messages unless a test currently asserts the context-specific error object type name. Existing field/message values are the compatibility contract for Stage 8.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: GraphQL mutation payloads should use the shared `LCGQL.MutationErrors` helper for `{field, message}` and `{field, code, message}` error maps; new generic mutation errors should use `:user_error` unless a payload needs extra fields such as auth `code`.
- After editing, run `rg -n "object :(content_error|social_error)|:content_error|:social_error" lib/live_canvas_gql test/live_canvas_gql` and expect no live schema/test references except historical docs.
- Run `rg -n "defp (mutation_error|post_mutation_error|social_error|auth_error|format_changeset_errors|format_auth_changeset_errors)|traverse_errors" lib/live_canvas_gql` and expect hits only in `lib/live_canvas_gql/mutation_errors.ex` or domain helper names that are deliberately not GraphQL mutation error builders.
- Run `rg -n '%\{field:.*message:|field: nil, message:|field: "[^"]+", message:' lib/live_canvas_gql` and account for every remaining hit. The expected implementation result is that resolver files call `LCGQL.MutationErrors` instead of constructing mutation error maps inline.
- Run `rg -n "MutationErrors\\." lib/live_canvas_gql/{accounts,chat,content,live,social}` and confirm every mutation resolver family delegates to the shared helper.
- Run `rg -n "\\\"is invalid\\\"|\\\"invalid_id\\\"|\\\"password_confirmation\\\"|\\\"password\\.passwordConfirmation\\\"|\\\"recordingMediaAssetId\\\"|\\\"followedId\\\"" test/live_canvas_gql` and confirm contract-sensitive assertions remain present.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/mutation_errors_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/social/social_mutations_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve auth error `code` behavior and enum values; these are part of the public auth contract.
- Preserve current field string contracts even where they are mixed: Live/auth explicit fields are lower camel or dotted lower camel, Content/Social ID fields are lower camel, and ordinary Accounts/Content changeset fields currently remain snake_case.
- Preserve current message strings, especially `"is invalid"` for Chat/Live invalid Relay ID/type errors and `"invalid_id"` for Social invalid ID errors.
- Do not replace authorization or domain error handling while editing resolver error helpers.
- Do not split `LCGQL.Accounts.Resolver` in this issue; `GQL-009` owns module decomposition after shared error helpers exist.
- Treat schema consolidation from `:content_error`/`:social_error` to `:user_error` as a deliberate GraphQL schema change. Keep it limited to identical `{field, message}` error objects.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_resolver.ex` has `mutation_error/2`, `error_field/2`, and `error_message/1`.
- `lib/live_canvas_gql/live/live_resolver.ex` has similar helpers plus changeset formatting.
- `lib/live_canvas_gql/content/content_resolver.ex` has `post_mutation_error/2`, `format_post_field/1`, and changeset formatting.
- `lib/live_canvas_gql/social/social_resolver.ex` has `social_error/2`, `format_field/1`, and `format_error_message/1`.
- `lib/live_canvas_gql/accounts/account_resolver.ex` has multiple local error builders and changeset formatters.

**What likely needs to change:**

- Define a GraphQL-wide mutation error helper for common user errors.
- Keep specialized auth errors only if the API contract needs `code`.
- Centralize changeset traversal, field formatting, and reason-to-message mapping.
- Replace resolver-local helpers gradually by mutation family.

**Where to look first:**

- `lib/live_canvas_gql/accounts/account_types.ex`
- `lib/live_canvas_gql/accounts/account_resolver.ex`
- `lib/live_canvas_gql/chat/chat_resolver.ex`
- `lib/live_canvas_gql/content/content_resolver.ex`
- `lib/live_canvas_gql/live/live_resolver.ex`
- `lib/live_canvas_gql/social/social_resolver.ex`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-005 - Viewer-Specific Data On The User Node

**User concern:** Fields on the User node have `viewer` in their name and derive the target user from context. User node fields should exist on all users, with authz deciding whether the current viewer can see that field for a given user.

**Initial assessment:** Needs discussion because the exact symptom may be stale or indirect. Initial inspection did not find field names containing `viewer` inside `node object(:user)`. The User node does contain `fresh_access_token` and `refresh_token`, which are viewer/session-specific and therefore suspicious on a globally refetchable User node even though the field names do not include `viewer`. Viewer-named queries and mutations exist outside the User node, which may be acceptable.

**Stage 2 decision:** Marked partially valid on 2026-05-23. The exact complaint that User-node fields are named `viewer...` appears stale: the current `node object(:user)` has no `viewer`-prefixed fields, and root `viewer` queries plus viewer-scoped mutations are legitimate API entry points. The underlying concern is valid, though: the globally refetchable User node still exposes session-specific token fields (`fresh_access_token`, `refresh_token`) that belong on auth/token mutation payloads, and private user data or child fields such as `email` and `user_identities` need explicit parent-user-plus-current-viewer authorization instead of direct field exposure. Profile/feed child fields already show the right pattern by using the parent user plus current viewer to enforce visibility.

Additional Stage 2 notes:

- `lib/live_canvas_gql/accounts/account_types.ex` exposes `fresh_access_token` and `refresh_token` directly on `node object(:user)`, while supported auth flows already return `access_token` and `refresh_token` on `signUp`, `logIn`, `issueViewerAuthTokens`, and `refreshAuthTokens` payloads.
- `lib/live_canvas_gql/schema.ex` currently refetches User nodes through `fetch_user_node/1` without viewer context; that makes every direct User field globally reachable unless the field itself re-applies authorization.
- `User.email` is currently a direct field, and `test/live_canvas_gql/relay/node_queries_test.exs` asserts anonymous `node(id:)` can read it. Stage 3 should verify whether that is still intended; if not, Stage 7 should plan a resolver that returns email only for the owning viewer.
- `Resolver.user_identities/3` currently builds a connection for the parent user without checking the current viewer. Stage 3 should include User-node child fields and not stop at scalar fields.
- `user_posts/3`, `user_story_feed/3`, `user_current_live_session/3`, and `user_replay_feed/3` already use the parent user plus current viewer visibility policy. They are examples to preserve, not targets just because they are viewer-sensitive.
- Root fields such as `viewer`, `viewerDataExportRequests`, and `viewerContactMatches`, and viewer-scoped mutations such as `updateViewerPrivacyMode`, are outside the invalid part of this concern because their root operation name accurately describes current-viewer scope.

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "viewer|fresh_access_token|refresh_token|field :.*viewer|node object\\(:user\\)|freshAccessToken|refreshToken" lib/live_canvas_gql/accounts test/live_canvas_gql/accounts test/live_canvas_gql/relay docs/architecture/conventions.md`
- `rg -n "defp fetch_user_node|defp fetch_user_identity_node|fresh_access_token|freshAccessToken|refreshToken|:fresh_access_token|:refresh_token" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "node_type: :user|field :[a-z_]+, (non_null\\()?:(user)|field :matched_users|:user\\) do|resolve\\(&.*user|author|host|follower|matched_users" lib/live_canvas_gql`
- `rg -n "node\\(id|\\.\\.\\. on User|email|privacyMode|freshAccessToken|refreshToken|userIdentities|followers|following|currentLiveSession|replayFeed|storyFeed|posts" test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/social test/live_canvas_gql/accounts/account_mutations_test.exs`

Exact `GQL-005` cleanup scope:

- `lib/live_canvas_gql/accounts/account_types.ex`: `node object(:user)` exposes direct `email`, `fresh_access_token`, and `refresh_token` fields. Because `lib/live_canvas_gql/schema.ex` `fetch_user_node/1` accepts a User global ID without viewer context, any direct User field is globally reachable unless the field has its own resolver.
- `lib/live_canvas/accounts.ex`: `Accounts.get_user!/1` hydrates the primary email before returning the User. This means `fetch_user_node/1` currently returns a User struct that has email loaded for direct GraphQL field exposure.
- `test/live_canvas_gql/relay/node_queries_test.exs`: the `node` test currently asserts anonymous `node(id:) { ... on User { email } }` returns the user's email. Stage 7 should plan an intentional contract change if email becomes owner-only.
- `lib/live_canvas_gql/accounts/account_resolver.ex`: `user_identities/3` builds a connection from the parent User through `Accounts.user_identities_query(user)` without checking the current viewer. That is inconsistent with `user_identity_user/3`, which only exposes an identity's User to the owning viewer.
- `lib/live_canvas_gql/accounts/account_mutations.ex` and `lib/live_canvas_gql/accounts/account_resolver.ex`: auth/token mutations already return access and refresh tokens through `signUp`, `logIn`, `issueViewerAuthTokens`, and `refreshAuthTokens`. Those payloads are the appropriate token boundary; the User node token fields are redundant and unsafe even if normally nil on refetched users.

Already-correct or mostly-correct User-node fields to preserve:

- `lib/live_canvas_gql/accounts/account_resolver.ex`: `user_posts/3`, `user_story_feed/3`, `user_current_live_session/3`, and `user_replay_feed/3` already combine the parent User with the current viewer before returning data. Keep this parent-plus-viewer pattern.
- `lib/live_canvas_gql/social/social_resolver.ex`: `followers/3` and `following/3` call `can_view_relationship_graph?/2`, allowing public users and using `Social.can_view_user?/2` for private users. Current tests cover private-account followers/following visibility for unauthenticated viewers, outsiders, owners, and accepted followers.
- `lib/live_canvas_gql/accounts/account_types.ex`: `privacy_mode` and `inserted_at` are direct User fields. Stage 3 did not find evidence that these are session-specific or private under the current public profile model, so leave them out of the first `GQL-005` fix unless Stage 7 deliberately changes User profile visibility.

Related paths affected by direct User field authorization:

- User objects are returned from multiple GraphQL paths, not only `viewer` and `node(id:)`: post `author`, live-session `host`, chat-message `sender`, follow-request `follower`, social `followers`/`following`, contact-match `matched_users`, and several mutation payloads return `:user`.
- Because these paths all resolve to the same `User` GraphQL object, a field-level `email` authorization fix on `User.email` is preferable to trying to patch each parent path separately.
- `test/live_canvas_gql/accounts/account_queries_test.exs` currently covers `viewer.email` and viewer-owned `viewer.userIdentities`, but Stage 3 did not find coverage proving non-owner `node(id:)` or non-viewer User-returning paths cannot request `email` or `userIdentities`.
- `test/live_canvas_gql/accounts/account_mutations_test.exs` uses `registerWithEmail { user { email } }`; Stage 7 should decide whether that legacy registration payload still returns a User with email or whether auth-entry payloads own private session/account data going forward.

Stage 3 watchpoints to carry into Stage 7:

- Preserve root `viewer` semantics: the current viewer should still be able to read their own email and identities through the viewer path.
- Preserve public profile fields and visibility-controlled profile/feed/social connections; do not hide `privacy_mode`, `inserted_at`, public profile content, or relationship graphs just because the parent is a globally refetchable User.
- Prefer field-level authorization for private User fields, because User objects can be reached through many parent paths.
- Remove token fields from the User node unless Stage 7 finds a current client dependency that cannot be replaced by existing auth/token payloads.
- Coordinate with `GQL-006` only where node fetch behavior matters. `GQL-005` should not redesign all node resolution or map-key type resolution.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Apply the approved owner-only contract for private User fields. `User.email` should return the current viewer's email only when the parent User id matches `current_scope.user.id`; it should return `nil` for anonymous viewers and non-owner viewers from every User-returning path.
- In `lib/live_canvas_gql/accounts/account_types.ex`, change `field :email, :string` to a resolver-backed field, for example `resolve(&Resolver.user_email/3)`.
- In `lib/live_canvas_gql/accounts/account_resolver.ex`, add a public `user_email/3` resolver with a typespec. It should authorize by comparing the parent User id with `viewer_from_resolution/1` or `viewer_id_from_resolution/1`, and return the current viewer's hydrated `email` when authorized. Because `User.email` is virtual and only some parent paths hydrate it, do not rely on `parent.email` as the source of truth when the current viewer is available.
- Keep the field nullable. Unauthorized, anonymous, malformed parent, or unhydrated-viewer cases should return `{:ok, nil}`, not a GraphQL execution error.
- In `lib/live_canvas_gql/accounts/account_types.ex`, remove `field :fresh_access_token, :token` and `field :refresh_token, :token` from `node object(:user)`.
- Do not remove the shared `object :token`, and do not remove token fields from auth/token mutation payloads. `signUp`, `logIn`, `issueViewerAuthTokens`, and `refreshAuthTokens` remain the supported token-returning GraphQL boundaries.
- In `lib/live_canvas_gql/accounts/account_resolver.ex`, update `user_identities/3` so it returns a connection only when the parent User id matches the authenticated viewer id. For anonymous or non-owner viewers, return `Absinthe.Relay.Connection.from_list([], args)` just like other hidden connection fields.
- Preserve `user_identity_user/3` ownership behavior. It already returns the identity's User only to the owning viewer and should not be weakened.
- Preserve `user_posts/3`, `user_story_feed/3`, `user_current_live_session/3`, `user_replay_feed/3`, `SocialResolver.followers/3`, and `SocialResolver.following/3`. Those fields already enforce parent-plus-viewer visibility and should not be collapsed into owner-only behavior.
- Preserve `privacy_mode` and `inserted_at` as direct User fields for now. They are not session-specific and are part of the current profile surface.
- Do not alter `LCGQL.Schema.fetch_user_node/1` in this issue. User nodes may remain globally refetchable; `GQL-005` fixes private field exposure at child-field resolution. Broader node fetch/type-resolution cleanup belongs to `GQL-006`.
- Treat `registerWithEmail { user { email } }`, contact-match `matchedUsers { email }`, post `author { email }`, live-session `host { email }`, chat-message `sender { email }`, follow-request `follower { email }`, and followers/following `node { email }` as covered by the same field-level resolver: only the owner sees email.

Focused test updates:

- Keep `test/live_canvas_gql/accounts/account_queries_test.exs` and `test/live_canvas_gql/relay/request_context_test.exs` coverage proving `viewer { email }` still returns the authenticated viewer email for session and bearer-token contexts.
- Update `test/live_canvas_gql/relay/node_queries_test.exs` so anonymous `node(id:) { ... on User { email } }` returns `email: nil` rather than the user's email.
- Add a `test/live_canvas_gql/relay/node_queries_test.exs` assertion that owner-scoped `node(id:) { ... on User { email } }` returns the owner email when the request has `context: %{current_scope: Accounts.scope_for_user(user)}`.
- Add or update a non-owner User-returning-path assertion so requesting `email` through another user's User object returns nil. Good focused candidates are contact-match `matchedUsers { email }` in `test/live_canvas_gql/accounts/contact_queries_test.exs` or `test/live_canvas_gql/accounts/account_mutations_test.exs`, because those tests currently assert matched users' emails are exposed to the contact owner.
- Update `test/live_canvas_gql/accounts/account_mutations_test.exs` for `registerWithEmail { user { email } }`. Since the legacy mutation does not establish viewer scope, either remove the `email` selection from the assertion or assert `email: nil`; keep the underlying Accounts assertion that the registered user record has the requested email.
- Add owner and non-owner coverage for `userIdentities` outside the root `viewer` path, preferably in `test/live_canvas_gql/accounts/account_queries_test.exs`: owner-scoped `node(id:) { ... on User { userIdentities(...) } }` returns identities, while anonymous or other-viewer node refetch returns an empty connection.
- Add a schema cleanup assertion that the `User` type no longer exposes `freshAccessToken` or `refreshToken`. Use a User-type-specific SDL or introspection check so auth payload `refreshToken` fields remain allowed.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: globally refetchable node objects may expose public/profile fields directly, but private viewer-owned fields must use child resolvers that compare the parent object with the current viewer; token/session secrets must only be returned from auth/token payloads.
- After editing, run `rg -n "fresh_access_token|field :refresh_token, :token|freshAccessToken" lib/live_canvas_gql/accounts test/live_canvas_gql/accounts test/live_canvas_gql/relay` and expect no User-node field references. Token payload references to `refresh_token` in mutations/resolvers/tests remain valid and should be accounted for separately.
- Run `rg -n "field :email, :string|user_email\\(" lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/accounts/account_resolver.ex` and confirm the User email field delegates to the owner-checking resolver.
- Run `rg -n "def user_identities|viewer_id_from_resolution|viewer_from_resolution" lib/live_canvas_gql/accounts/account_resolver.ex` and confirm `user_identities/3` enforces parent id equals current viewer id.
- Run `rg -n "matchedUsers.*email|\\\"email\\\" => matched|node\\(id: \\$id\\).*email|registerWithEmail" test/live_canvas_gql/accounts test/live_canvas_gql/relay` and confirm the old non-owner email expectations were removed or changed to `nil`.
- Run `rg -n "freshAccessToken|refreshToken" test/live_canvas_gql/accounts test/live_canvas_gql/relay` and confirm remaining `refreshToken` assertions are auth/token payload assertions, not `User` fields.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/social/social_queries_test.exs`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve root `viewer` email and identities for the current viewer.
- Preserve auth/token mutation payloads as the only token-returning GraphQL API.
- Preserve public/profile fields and visibility-controlled profile/feed/social connections.
- Keep User node refetch globally available; do not turn all User node fetches into owner-only node lookups in this issue.
- Ensure `User.email` authorization is field-level because User objects are returned from many parent paths.

**Evidence seen:**

- `lib/live_canvas_gql/accounts/account_types.ex` has `node object(:user)` with `email`, `privacy_mode`, `inserted_at`, content/social connections, `fresh_access_token`, and `refresh_token`.
- `lib/live_canvas_gql/accounts/account_queries.ex` has viewer-root fields such as `viewer`, `viewer_data_export_requests`, and `viewer_contact_matches`.
- `lib/live_canvas_gql/accounts/account_mutations.ex` has viewer-scoped mutation names.
- No initial `field :viewer...` hit was found inside the User node.
- `lib/live_canvas_gql/schema.ex` `fetch_user_node/1` returns a user by global ID without viewer context.
- `lib/live_canvas_gql/accounts/account_resolver.ex` has resolver-backed profile/feed fields that use parent plus viewer policy, but `user_identities/3` does not currently check viewer ownership.

**What likely needs to change:**

- Clarify whether the user meant stale field names, token fields, or context-derived resolvers on User node fields.
- If token fields are the issue, remove tokens from the globally refetchable User node and keep token data only on auth mutation payloads.
- For private User fields such as `email`, ensure resolver-level authz is based on the parent user plus current viewer, not by replacing the parent with context viewer.
- Scan all User-node direct and resolver-backed fields for globally refetchable data that needs field-level authz. Preserve public/profile fields and root viewer-scoped operations.

**Where to look first:**

- `lib/live_canvas_gql/accounts/account_types.ex`
- `lib/live_canvas_gql/accounts/account_resolver.ex`
- `test/live_canvas_gql/accounts/account_queries_test.exs`
- `test/live_canvas_gql/relay/node_queries_test.exs`
- `test/live_canvas_gql/relay/request_context_test.exs`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-006 - `schema.ex` Node Resolution And Type Resolution

**User concern:** `node field do ...` and `node interface do` should not resolve type based on map keys. For Ecto-backed nodes, resolve type by struct. There should not be dedicated fetch functions for each node type; use direct repo lookups where appropriate.

**Initial assessment:** Partially valid, but needs careful discussion because this intersects with the explicit backend convention that node fetchers must re-apply authorization to avoid IDOR. The map-key `resolve_type` clauses are fragile and should become struct-based where possible. The node fetch functions are verbose, but many intentionally route through context APIs like `Feed.get_visible_post/2`, `Content.get_user_media_asset/2`, and `Chat.get_history_message/2` to enforce visibility.

**Stage 2 decision:** Marked partially valid on 2026-05-23. The `node interface` map-key type resolution is valid cleanup: Ecto-backed node values should resolve by concrete schema structs instead of by coincidental field shapes. The repeated node-fetch ID casting and `when is_integer(local_id) and local_id > 0` guards are also valid cleanup targets; Stage 8 should remove positive-ID guard checks from the node refetch path so zero and negative database IDs fall through to repo/query no-result behavior. The request to remove dedicated fetch functions or use direct repo lookups is only partially valid because most current fetchers re-apply viewer ownership or visibility and must not be replaced with unauthenticated `Repo.get/2`.

Additional Stage 2 notes:

- For Stage 3, scan `schema.ex` for every map-key `resolve_type` clause and classify Ecto-backed structs separately from synthetic GraphQL projection maps such as contact matches.
- For Stage 3, scan every `fetch_*_node` helper for repeated `Ecto.Type.cast(:id, id)` plus `when is_integer(local_id) and local_id > 0` boilerplate. Treat positive-ID guards as removal targets in the schema fetchers and in any delegated context function clauses that would otherwise reject zero or negative integer IDs.
- Keep type casting only where needed to turn Relay local IDs into the database ID type or avoid non-castable input errors. Do not preserve separate `local_id > 0` checks merely to pre-filter DB misses; zero and negative IDs can query normally and return no rows.
- Preserve authorization-aware node fetches. `Feed.get_visible_post/2`, `Content.get_user_media_asset/2`, `Content.get_user_post_report/2`, `Chat.get_history_message/2`, `Social.get_pending_follow_request/2`, and account-scoped governance/contact helpers are intentional node refetch boundaries.
- Direct repo lookup is acceptable only where Stage 3 proves the node is public or field-level authorization fully covers private data. `User` may remain globally refetchable while `GQL-005` handles private user fields through child resolvers.

**Evidence seen:**

- `lib/live_canvas_gql/schema.ex` `node interface` resolves types by map keys like `provider_uid`, `privacy_mode`, `mime_type`, and `contact_entry`.
- `lib/live_canvas_gql/schema.ex` `node field` dispatches to one private `fetch_*_node/2` function per node type.
- Several fetchers cast IDs and re-apply viewer-specific access rules.
- The convention doc explicitly says GraphQL node fetch and child field resolver layers must re-apply authz.

**Stage 3 scan findings:**

Commands run:

- `rg -n "resolve_type|defp fetch_.*_node|Ecto.Type.cast\\(:id|when is_integer\\(local_id\\) and local_id > 0|when is_integer\\(id\\) and id > 0|global_id|node field" lib/live_canvas_gql/schema.ex`
- `rg -n "when is_integer\\([^\\)]*\\) and [^\\n]*> 0|Ecto.Type.cast\\(:id|def get_.*\\(.*id|def .*_node|Repo\\.get|Repo\\.one" lib/live_canvas lib/live_canvas_gql`
- `rg -n "node\\(|nodes\\(|resolve_type|global id|zero|negative|invalid|ContactMatch|FreshAccessToken|HistoryMessage|MediaAsset|Post|User" test/live_canvas_gql`
- `rg -n "get_visible_post|get_user_media_asset|get_user_post_report|get_live_session|get_pending_follow_request|get_history_message|get_user_data_export_request|get_user_account_deletion_request|get_user_contact_match|get_active_user_identity" lib/live_canvas_gql/schema.ex lib/live_canvas lib/live_canvas_gql`
- `rg -n "to_global_id\\([^\\n]*,\\s*(-?[0-9]+|\\$)|zero|negative|invalid.*global|missing node|nonexistent|not found" test/live_canvas_gql/relay test/live_canvas_gql/accounts test/live_canvas_gql/content test/live_canvas_gql/chat test/live_canvas_gql/social test/live_canvas_gql/live`

Findings:

- `lib/live_canvas_gql/schema.ex:77` has eleven map-key `resolve_type` clauses. Ten correspond to Ecto-backed structs and should become struct patterns: `%LCSchemas.Accounts.UserIdentity{}`, `%LCSchemas.Accounts.User{}`, `%LCSchemas.Content.Post{}`, `%LCSchemas.Content.MediaAsset{}`, `%LCSchemas.Content.PostReport{}`, `%LCSchemas.Infra.DataExportRequest{}`, `%LCSchemas.Infra.AccountDeletionRequest{}`, `%LCSchemas.Live.LiveSession{}`, `%LCSchemas.Social.Follow{state: :requested}`, and `%LCSchemas.Chat.ChatMessage{}`.
- `contact_match` is the one non-struct node value in this block. `Accounts.get_user_contact_match/2` returns a synthetic map built by `build_contact_match/2` with `:id`, `:contact_entry`, and `:matched_users`, so Stage 7 should keep a map/projection-specific type-resolution clause for contact matches unless it plans a dedicated projection struct.
- `lib/live_canvas_gql/schema.ex:163` through `lib/live_canvas_gql/schema.ex:313` repeat local-ID casting plus positive guards for `user_identity`, `post`, `media_asset`, `post_report`, `live_session`, `follow_request`, `chat_message`, `data_export_request`, `account_deletion_request`, and `contact_match` node fetchers. `fetch_user_node/1` is the only current node fetcher that does not use the repeated cast/positive-guard block.
- Node-path delegated functions with positive guards that would still pre-filter zero or negative IDs after schema-level guards are removed: `Accounts.get_active_user_identity/2`, `Feed.get_visible_post/2`, `Content.get_user_media_asset/2`, `Content.get_user_post_report/2`, `Social.get_pending_follow_request/2`, `Chat.get_history_message/2`, `Chat.history_message_query/1`, `Accounts.get_user_data_export_request/2`, `Accounts.get_user_account_deletion_request/2`, `DataGovernance.get_data_export_request/2`, `DataGovernance.get_account_deletion_request/2`, `Export.get/2`, `Deletion.get/2`, and `Accounts.get_user_contact_match/2`.
- `Live.get_live_session/1` already accepts any integer and delegates directly to `Repo.get/2`, so its delegated path does not need positive-guard removal beyond the schema fetcher.
- `LCGQL.Relay.decode_global_id/3` and `cast_local_id/1` also enforce positive local IDs, but that helper is used by mutation/input resolvers for structured invalid-ID errors. It is not part of Absinthe's `node(id:)` refetch path and should stay out of the first `GQL-006` implementation unless Stage 7 explicitly widens scope.
- `test/live_canvas_gql/relay/node_queries_test.exs` covers raw non-global IDs, unauthorized node lookups, valid refetches, and nil fallbacks for hidden resources, but the scan did not find coverage for zero or negative local IDs encoded inside otherwise valid Relay global IDs. Stage 7 should add focused node tests proving those IDs now return `node: nil` rather than decode or guard-filter errors.
- Existing node tests in `test/live_canvas_gql/relay/node_queries_test.exs`, `test/live_canvas_gql/accounts/account_queries_test.exs`, `test/live_canvas_gql/chat/chat_queries_test.exs`, and `test/live_canvas_gql/social/social_queries_test.exs` are useful regression coverage for preserving viewer-scoped authorization while the node fetch boilerplate is reduced.

Stage 3 watchpoints to carry into Stage 7:

- Keep authorization-aware context calls in place. This cleanup can remove repeated casts and positive guards without converting viewer-scoped node fetches to unauthenticated `Repo.get/2`.
- Do not remove the `is_integer/1` safety needed before interpolating IDs into Ecto queries. The requested change is to stop requiring `> 0` for database IDs on the node refetch path, not to allow non-castable values to reach query code.
- If Stage 7 centralizes local-ID casting, keep it node-path-local and do not reuse `LCGQL.Relay.decode_global_id/3` unchanged, because that helper currently returns `{:error, :invalid_id}` for non-positive IDs and is used outside node refetch.
- Update affected specs when implementations start: several delegated functions currently declare `pos_integer()` arguments even though the desired node-refetch behavior is to accept any integer and return no rows for missing IDs.
- Preserve `contact_match` as a synthetic GraphQL projection boundary or introduce an explicit projection struct; do not accidentally pattern-match it as a raw `UserContactEntry` unless the node object resolvers are also updated for the changed value shape.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- In `lib/live_canvas_gql/schema.ex`, convert `node interface` type resolution for Ecto-backed values from map-key clauses to schema struct clauses. Use explicit schema module names or aliases so the clauses are unambiguous:
  - `%LCSchemas.Accounts.UserIdentity{}` -> `:user_identity`
  - `%LCSchemas.Accounts.User{}` -> `:user`
  - `%LCSchemas.Content.Post{}` -> `:post`
  - `%LCSchemas.Content.MediaAsset{}` -> `:media_asset`
  - `%LCSchemas.Content.PostReport{}` -> `:post_report`
  - `%LCSchemas.Infra.DataExportRequest{}` -> `:data_export_request`
  - `%LCSchemas.Infra.AccountDeletionRequest{}` -> `:account_deletion_request`
  - `%LCSchemas.Live.LiveSession{}` -> `:live_session`
  - `%LCSchemas.Social.Follow{state: :requested}` -> `:follow_request`
  - `%LCSchemas.Chat.ChatMessage{}` -> `:chat_message`
- Preserve the `contact_match` node as an explicit synthetic projection case. The first Stage 8 pass should keep a map-pattern clause for `%{id: id, contact_entry: %LCSchemas.Accounts.UserContactEntry{}, matched_users: matched_users}` and return `:contact_match`, unless the implementation deliberately introduces a small projection struct and updates the contact-match resolvers to consume it.
- Add a private node-local ID cast helper inside `LCGQL.Schema`, for example `cast_node_local_id/1`, with this exact contract: `Ecto.Type.cast(:id, value)` returning an integer becomes `{:ok, local_id}` even when `local_id` is zero or negative; non-integer or non-castable values return `:error`.
- Replace the repeated `case Ecto.Type.cast(:id, id)` blocks in every `fetch_*_node` helper with `cast_node_local_id/1` plus the existing authorization-aware fetch call. Do not preserve `local_id > 0` checks in `fetch_user_identity_node/2`, `fetch_post_node/2`, `fetch_media_asset_node/2`, `fetch_post_report_node/2`, `fetch_live_session_node/2`, `fetch_follow_request_node/2`, `fetch_chat_message_node/2`, `fetch_data_export_request_node/2`, `fetch_account_deletion_request_node/2`, or `fetch_contact_match_node/2`.
- Route `fetch_user_node/1` through the same cast helper for consistency, but keep its public-refetch behavior aligned with `GQL-005`: user nodes may remain globally refetchable while private User fields are fixed at child-field resolution. Do not add viewer ownership checks to User node fetch in this issue.
- Keep the node fetchers explicit. Do not replace viewer-scoped fetches with unauthenticated `Repo.get/2`; preserve calls to `Accounts.get_active_user_identity/2`, `Feed.get_visible_post/2`, `Content.get_user_media_asset/2`, `Content.get_user_post_report/2`, `Live.get_live_session/1` plus `authorize_live_session_node_refetch/2`, `Social.get_pending_follow_request/2`, `Chat.get_history_message/2`, account data-governance helpers, and `Accounts.get_user_contact_match/2`.
- Remove positive-ID guards from delegated functions that are part of the node refetch path, so zero and negative IDs reach the query and naturally return no rows. Update these functions and their specs from `pos_integer()` to `integer()` where the changed argument is the node-refetch ID:
  - `LC.Accounts.get_active_user_identity/2`
  - `LC.Feed.get_visible_post/2`
  - `LC.Content.get_user_media_asset/2`
  - `LC.Content.get_user_post_report/2`
  - `LC.Social.get_pending_follow_request/2`
  - `LC.Chat.get_history_message/2` and private `history_message_query/1`
  - `LC.Accounts.get_user_data_export_request/2`
  - `LC.Accounts.get_user_account_deletion_request/2`
  - `LC.Infra.DataGovernance.get_data_export_request/2`
  - `LC.Infra.DataGovernance.get_account_deletion_request/2`
  - `LC.Infra.DataGovernance.Export.get/2`
  - `LC.Infra.DataGovernance.Deletion.get/2`
  - `LC.Accounts.get_user_contact_match/2`
- When touching `Export.get/2` and `Deletion.get/2`, remove the `> 0` checks from both `user_id` and `request_id` in the query function heads rather than adding replacement fallback clauses. These functions already constrain by both IDs in `Repo.get_by/2`, so non-positive values can return no rows through the database path.
- Leave unrelated positive-integer validation alone. Do not change mutation/input global-ID decoders in `LCGQL.Relay`, async job payload validation, pagination limits, session ownership, data-governance request/cancel commands, media processing payload extraction, release drill validation, or any positive guard outside the node refetch path.
- Do not change `LCGQL.Relay.decode_global_id/3` in this issue. It is used by mutation/input resolvers and should continue to return structured invalid-ID errors for non-positive local IDs until those APIs are discussed separately.

Focused test updates:

- In `test/live_canvas_gql/relay/node_queries_test.exs`, add a test that builds otherwise valid Relay global IDs with local ID `0` and `-1` for every node type handled by `LCGQL.Schema` and asserts `node(id:)` returns `nil` without GraphQL execution errors. Run the query with an authenticated viewer context so scoped fetchers execute their delegated lookup paths.
- In the same test module, keep or extend valid node refetch coverage for struct-based `resolve_type`. Existing tests already cover User, Post, ContactMatch, MediaAsset, PostReport, FollowRequest, ChatMessage, and LiveSession. Add focused valid refetch coverage for `DataExportRequest` and `AccountDeletionRequest` if Stage 8 changes their type-resolution clauses and no existing test covers them through `node(id:)`.
- Preserve existing unauthorized-node tests in `test/live_canvas_gql/relay/node_queries_test.exs`, `test/live_canvas_gql/accounts/account_queries_test.exs`, `test/live_canvas_gql/chat/chat_queries_test.exs`, and `test/live_canvas_gql/social/social_queries_test.exs`; those are the regression suite that proves explicit fetchers still enforce viewer authorization after boilerplate is reduced.
- Add a small assertion for the synthetic contact-match path if implementation changes the map pattern: `node(id:) { ... on ContactMatch { contactName matchedUsers { id } } }` should still resolve as `ContactMatch` and use the viewer-owned projection shape, not a raw `UserContactEntry`.

Prevention checks:

- Add a durable note during Stage 8 under `docs/architecture/conventions.md`, preferably in the GraphQL/Relay section: Ecto-backed node type resolution should match schema structs, synthetic GraphQL projection nodes must be explicitly documented, and node refetch helpers must keep authorization-aware lookup boundaries rather than using raw repo fetches for scoped resources.
- After editing, run `rg -n "%\\{provider_uid|%\\{privacy_mode|%\\{kind: _kind, visibility|%\\{mime_type|%\\{reason: _reason|%\\{status: _status|%\\{state: :requested|%\\{kind: _kind, metadata" lib/live_canvas_gql/schema.ex` and confirm old map-key type-resolution clauses are gone except the deliberate `contact_match` projection clause.
- Run `rg -n "when is_integer\\(local_id\\) and local_id > 0|Ecto.Type.cast\\(:id" lib/live_canvas_gql/schema.ex` and confirm schema node fetchers use the new helper and no positive local-ID guard remains.
- Run focused positive-guard searches on the delegated node-path functions and confirm only unrelated validation remains. Start with `rg -n "get_active_user_identity|get_visible_post|get_user_media_asset|get_user_post_report|get_pending_follow_request|get_history_message|get_user_data_export_request|get_user_account_deletion_request|get_data_export_request|get_account_deletion_request|get_user_contact_match|history_message_query" lib/live_canvas lib/live_canvas_gql`.
- Run `rg -n "decode_global_id\\(|cast_local_id" lib/live_canvas_gql/relay.ex lib/live_canvas_gql` and confirm mutation/input decoder semantics were not changed as part of `GQL-006`.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/relay/node_queries_test.exs test/live_canvas_gql/accounts/account_queries_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs`
- Add `test/live_canvas_gql/accounts/account_mutations_test.exs` to the focused run if new data-governance node test setup reuses account mutation helpers or modifies data-governance GraphQL types.
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve explicit authorization-aware fetch boundaries for scoped nodes.
- Remove positive-ID guards only from the node refetch path and its touched delegated query helpers; do not turn this into a repository-wide positive-integer validation cleanup.
- Preserve non-castable local-ID handling at the schema edge so malformed Relay global IDs return `node: nil` or the current Absinthe decode error rather than raising an Ecto query cast error.
- Keep synthetic contact-match projection behavior deliberate and tested.

**What likely needs to change:**

- Convert `resolve_type` to pattern match on schema structs for Ecto-backed nodes.
- Keep or improve authz for globally refetchable IDs; do not replace all fetchers with unauthenticated `Repo.get/2`.
- Consider a small shared node-fetch helper that decodes/casts IDs and delegates to explicit authorization-aware functions.
- Remove repeated positive-ID guards from the node refetch path, including delegated context function heads touched by the cleanup, so zero and negative IDs fall through to repo/query no-result behavior instead of being pre-filtered.
- Inline direct repo lookups only for node types that are truly public or already protected elsewhere.

**Where to look first:**

- `lib/live_canvas_gql/schema.ex`
- `lib/live_canvas_gql/relay.ex`
- `test/live_canvas_gql/relay/node_queries_test.exs`
- `docs/architecture/conventions.md`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-007 - Resolver Wrappers That Only Dataload Associations

**User concern:** Various node fields resolve to resolver functions where the function only loads an association with dataloader. Simple association loads should be inline, for example `field :posts, list_of(:post), resolve: dataloader(Blog)`.

**Initial assessment:** Likely valid for simple child fields. Some current wrappers only check preloaded association then call `LCGQL.Dataloader.load_assoc/4`; those can probably become inline dataloader declarations. Other fields include authorization, filtering, ordering, fallback behavior, or connection pagination and should stay resolver-backed.

**Stage 2 decision:** Marked partially valid on 2026-05-23. Simple resolver wrappers whose only responsibility is loading an association through dataloader are real cleanup targets. Resolver functions that re-apply authorization, build Relay connections, paginate, filter, sort, preserve nil/default semantics, or otherwise shape a contract-sensitive response should stay in place for now.

**Future framework note:** Authorization and Relay connection behavior should not remain indefinitely as one-off resolver code. A future cleanup should introduce a dedicated system or framework for reusable child-field authorization and connection construction so pagination, filtering, ordering, and visibility checks are consistent without burying them in ad hoc resolver functions. `GQL-007` should not build that framework; it should avoid deleting wrappers that currently own those behaviors.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_resolver.ex` has `chat_message_sender/3`.
- `lib/live_canvas_gql/feed/feed_resolver.ex` has simple host/recording-media style association loaders.
- `lib/live_canvas_gql/social/social_resolver.ex` has `follow_request_follower/3`.
- `lib/live_canvas_gql/content/content_resolver.ex` has `author/3`; `media_assets/3` is more than a simple association load because it sorts and documents visibility assumptions.
- `lib/live_canvas_gql/dataloader.ex` has a generic `load_assoc/4` wrapper.

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "LCGQL\\.Dataloader\\.load_assoc|Dataloader\\.load\\(|Absinthe\\.Resolution\\.Helpers\\.on_load" lib/live_canvas_gql`
- `rg -n "resolve\\(&Resolver\\.|resolve\\(&[A-Za-z]+Resolver\\." lib/live_canvas_gql/**/*_types.ex lib/live_canvas_gql/**/*_queries.ex lib/live_canvas_gql/**/*_mutations.ex`
- `rg -n "import Absinthe\\.Resolution\\.Helpers|dataloader\\(" lib/live_canvas_gql test/live_canvas_gql`
- `rg -n "from_query\\(|from_list\\(|authorize_|visible_profile_connection|can_view_relationship_graph\\?|profile_.*_query|history_query|pending_follow_requests_query|media_assets\\(" lib/live_canvas_gql`

Direct simple dataload-wrapper candidates for Stage 7 planning:

- `lib/live_canvas_gql/chat/chat_types.ex`: `ChatMessage.sender` delegates to `LCGQL.Chat.Resolver.chat_message_sender/3`.
- `lib/live_canvas_gql/chat/chat_resolver.ex`: `chat_message_sender/3` only returns a preloaded sender, loads `:sender` through `LCGQL.Dataloader.load_assoc/4` when `sender_id` is present, or returns nil.
- `lib/live_canvas_gql/feed/feed_types.ex`: `LiveSession.host` delegates to `LCGQL.Feed.Resolver.host/3`.
- `lib/live_canvas_gql/feed/feed_resolver.ex`: `host/3` only returns a preloaded host, loads `:host` through `LCGQL.Dataloader.load_assoc/4` when `host_id` is present, or returns nil.
- `lib/live_canvas_gql/social/social_types.ex`: `FollowRequest.follower` delegates to `LCGQL.Social.Resolver.follow_request_follower/3`.
- `lib/live_canvas_gql/social/social_resolver.ex`: `follow_request_follower/3` only returns a preloaded follower, loads `:follower` through `LCGQL.Dataloader.load_assoc/4` when `follower_id` is present, or returns nil.
- `lib/live_canvas_gql/content/content_types.ex`: `Post.author` delegates to `LCGQL.Content.Resolver.author/3`.
- `lib/live_canvas_gql/content/content_resolver.ex`: `author/3` only returns a preloaded author, loads `:author` through `LCGQL.Dataloader.load_assoc/4` when `author_id` is present, or returns nil.

Related dataloader and resolver patterns to preserve or defer:

- `lib/live_canvas_gql/accounts/account_resolver.ex`: `user_identity_user/3` also calls `LCGQL.Dataloader.load_assoc/4`, but it first checks that the resolved user matches the current viewer. This is an authorization boundary and should not become a plain inline dataloader field in `GQL-007`.
- `lib/live_canvas_gql/feed/feed_resolver.ex`: `recording_media_asset/3` uses Dataloader internally, but it re-applies retained-history authorization and filters to durable uploaded/processed media assets. Keep it resolver-backed until the future authorization/connection framework exists.
- `lib/live_canvas_gql/content/content_resolver.ex`: `media_assets/3` uses Dataloader internally, but it preserves an empty-list fallback and sorts by `{inserted_at, id}`. Keep it resolver-backed unless Stage 7 deliberately provides an equivalent sorting/defaulting approach.
- `lib/live_canvas_gql/chat/chat_resolver.ex`: `chat_messages/3` authorizes retained-history access and builds a Relay connection from a query; keep out of this dataload-wrapper cleanup.
- `lib/live_canvas_gql/feed/feed_resolver.ex`, `lib/live_canvas_gql/accounts/account_resolver.ex`, and `lib/live_canvas_gql/social/social_resolver.ex` contain multiple query-backed Relay connection resolvers. These are future authorization/connection framework candidates, not simple dataloader wrapper replacements.
- No existing `import Absinthe.Resolution.Helpers` or inline `dataloader(...)` call was found in `lib/live_canvas_gql` or `test/live_canvas_gql`, even though `Absinthe.Middleware.Dataloader` is configured in `LCGQL.Schema` and the request context installs a loader. Stage 8 should add the imports and helper calls explicitly in the touched type modules.
- `LCGQL.Dataloader.load_assoc/4` is currently used by the four simple wrappers above plus `user_identity_user/3`. Keep the helper while `user_identity_user/3` still uses it behind a viewer-ownership check.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep the public GraphQL schema shape unchanged. `ChatMessage.sender`, `LiveSession.host`, `FollowRequest.follower`, and `Post.author` keep the same field names, nullability, and return types.
- In each touched `*_types.ex` module, import Absinthe's dataloader helper explicitly with `import Absinthe.Resolution.Helpers, only: [dataloader: 1]` and alias `LC.Accounts` because all four association targets load through the existing `Accounts` dataloader source.
- In `lib/live_canvas_gql/chat/chat_types.ex`, change `ChatMessage.sender` from `resolve(&Resolver.chat_message_sender/3)` to inline dataloader resolution:

```elixir
field :sender, :user do
  resolve(dataloader(Accounts))
end
```

- In `lib/live_canvas_gql/feed/feed_types.ex`, change `LiveSession.host` from `resolve(&Resolver.host/3)` to inline dataloader resolution:

```elixir
field :host, non_null(:user) do
  resolve(dataloader(Accounts))
end
```

- In `lib/live_canvas_gql/social/social_types.ex`, change `FollowRequest.follower` from `resolve(&Resolver.follow_request_follower/3)` to inline dataloader resolution:

```elixir
field :follower, non_null(:user) do
  resolve(dataloader(Accounts))
end
```

- In `lib/live_canvas_gql/content/content_types.ex`, change `Post.author` from `resolve(&Resolver.author/3)` to inline dataloader resolution:

```elixir
field :author, non_null(:user) do
  resolve(dataloader(Accounts))
end
```

- Remove `chat_message_sender/3` plus its spec from `lib/live_canvas_gql/chat/chat_resolver.ex`. After that removal, remove `Accounts` from the `alias LC.{Accounts, Chat}` line because `LCGQL.Chat.Resolver` no longer needs it.
- Remove `host/3` plus its spec from `lib/live_canvas_gql/feed/feed_resolver.ex`. After that removal, remove `Accounts` from the `alias LC.{Accounts, Chat, Content, Feed}` line because `LCGQL.Feed.Resolver` no longer needs it.
- Remove `follow_request_follower/3` plus its spec from `lib/live_canvas_gql/social/social_resolver.ex`. Keep `Accounts` aliased there because `fetch_user/2` still uses `Accounts.get_user!/1`.
- Remove `author/3` plus its spec from `lib/live_canvas_gql/content/content_resolver.ex`. After that removal, remove `Accounts` from the `alias LC.{Accounts, Content, Feed}` line because `LCGQL.Content.Resolver` no longer needs it.
- Keep `LCGQL.Dataloader.load_assoc/4` in `lib/live_canvas_gql/dataloader.ex` during this issue because `LCGQL.Accounts.Resolver.user_identity_user/3` still uses it behind a viewer-ownership check. Removing or redesigning that helper belongs to a later auth-aware child-field framework pass.
- Do not touch `LCGQL.Accounts.Resolver.user_identity_user/3`, `LCGQL.Feed.Resolver.recording_media_asset/3`, `LCGQL.Content.Resolver.media_assets/3`, `LCGQL.Chat.Resolver.chat_messages/3`, or query-backed Relay connection resolvers in `LCGQL.Feed.Resolver`, `LCGQL.Accounts.Resolver`, and `LCGQL.Social.Resolver`.
- Do not add the future authorization/connection framework in this issue. The only Stage 8 implementation work should be replacing the four direct association wrappers and documenting the convention.

Focused test updates:

- Prefer existing public GraphQL tests over resolver-private tests. The behavior should stay observable through schema execution, not through the deleted resolver functions.
- Keep existing chat sender coverage in `test/live_canvas_gql/chat/chat_queries_test.exs` and `test/live_canvas_gql/chat/chat_mutations_test.exs`; these query `ChatMessage.sender.id` through history, node, and mutation payload paths.
- Keep existing feed host coverage in `test/live_canvas_gql/feed/feed_queries_test.exs`, especially `"batches repeated host lookups when liveNow requests hosts"`, because it protects both field behavior and dataloader batching.
- Keep existing social follower coverage in `test/live_canvas_gql/social/social_queries_test.exs` for `viewerPendingFollowRequests { follower { id } }`.
- Keep existing content author coverage in `test/live_canvas_gql/content/content_queries_test.exs` and `test/live_canvas_gql/content/content_mutations_test.exs` for `Post.author`.
- Keep `test/live_canvas_gql/relay/node_queries_test.exs` in the focused verification set because it exercises these association fields through globally refetchable node paths and protects against accidental authorization bypasses in nearby fields.
- Add a new test only if Stage 8 discovers that one of the four inline fields is not covered by the listed GraphQL paths. Do not add tests that assert the implementation detail that `dataloader/1` is used.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: simple child fields whose only behavior is association loading should use inline Absinthe dataloader declarations; fields that authorize, paginate, filter, sort, default, or shape a contract-sensitive payload should remain resolver-backed until a dedicated authorization/connection framework exists.
- After editing, run `rg -n "chat_message_sender|follow_request_follower|def host\\(|def author\\(|Resolver\\.host|Resolver\\.author|Resolver\\.chat_message_sender|Resolver\\.follow_request_follower" lib/live_canvas_gql` and expect no hits for the four removed wrappers or their type references.
- Run `rg -n "LCGQL\\.Dataloader\\.load_assoc" lib/live_canvas_gql` and expect only authorization-preserving usage, currently `LCGQL.Accounts.Resolver.user_identity_user/3`, unless Stage 8 introduces a deliberately equivalent auth-aware replacement.
- Run `rg -n "recording_media_asset\\(|media_assets\\(|chat_messages\\(|visible_profile_connection|can_view_relationship_graph\\?" lib/live_canvas_gql` and confirm the resolver-backed authorization, sorting, and Relay connection boundaries remain present.
- Run `rg -n "import Absinthe\\.Resolution\\.Helpers, only: \\[dataloader: 1\\]|resolve\\(dataloader\\(Accounts\\)\\)" lib/live_canvas_gql` and confirm only the intended type modules gained inline dataloader declarations.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/feed/feed_queries_test.exs test/live_canvas_gql/social/social_queries_test.exs test/live_canvas_gql/content/content_queries_test.exs test/live_canvas_gql/content/content_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve dataloader batching for repeated `LiveSession.host` lookups; the feed batching test should stay green.
- Do not convert `user_identity_user/3` into a plain inline dataloader because it re-checks current-viewer ownership before exposing the user behind a `UserIdentity`.
- Do not convert `recording_media_asset/3` because it re-applies retained-history visibility and filters non-durable media assets.
- Do not convert `media_assets/3` unless the implementation preserves the empty-list fallback and deterministic `{inserted_at, id}` ordering.
- Do not convert Relay connection resolvers as part of this issue. They belong to the future authorization/connection framework noted above.

**What likely needs to change:**

- Identify resolver functions whose only responsibility is a simple association load.
- Replace those field definitions with inline Absinthe dataloader usage.
- Keep resolver functions where authz, connection construction, filtering, sorting, or null/default semantics are required.
- Carry the future-framework note into Stage 8 so implementation does not flatten authorization or Relay connection behavior merely to remove a wrapper.

**Where to look first:**

- `lib/live_canvas_gql/chat/chat_types.ex`
- `lib/live_canvas_gql/feed/feed_types.ex`
- `lib/live_canvas_gql/social/social_types.ex`
- `lib/live_canvas_gql/content/content_types.ex`
- `lib/live_canvas_gql/dataloader.ex`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### ECTO-001 - Ecto Schema Files Do Not Summarize Constraints And Indexes

**User concern:** Ecto schema files need documentation or comments so readers do not have to search migrations to understand table constraints and unique indexes.

**Initial assessment:** Valid. Schema modules currently list fields and associations but generally do not summarize database constraints or indexes. Migrations show many unique indexes and check constraints that are not obvious from schema files.

**Stage 2 decision:** Marked valid with tight scope on 2026-05-23. Schema files should get concise table-contract summaries for database behavior readers need while working in the schema module: unique indexes, check constraints, important foreign-key delete behavior, and deliberate exceptions. Include non-unique indexes only when they explain important query/access behavior or performance-sensitive paths. Do not copy migrations wholesale, do not list every routine index by default, and keep the convention short enough that it can stay current.

**Evidence seen:**

- `lib/live_canvas_schemas/accounts/user.ex`, `lib/live_canvas_schemas/chat/chat_message.ex`, and `lib/live_canvas_schemas/live/live_session_runtime_owner.ex` have no table constraint/index summaries.
- Migrations define unique indexes such as `users.email`, `follows(follower_id, followed_id)`, `mutes(muter_id, muted_id)`, `live_participants(live_session_id, user_id)`, `live_session_runtime_owners(live_session_id)`, and `post_reports(reporter_id, post_id)`.
- Migrations define check constraints such as `post_reports_reason_check`, `post_reports_status_check`, and async job attempt constraints.

**What likely needs to change:**

- Choose a consistent schema-file documentation format for table constraints and indexes.
- Add concise comments or module attributes near each schema, not long migration copies.
- Include unique indexes, check constraints, important foreign key delete behavior, and intentional exceptions.
- Update conventions if this becomes the standard for new schemas.

**Where to look first:**

- `lib/live_canvas_schemas/**/*`
- `priv/repo/migrations/**/*`
- `docs/architecture/conventions.md`

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "schema \"" lib/live_canvas_schemas`
- `rg -n "@moduledoc|constraint|unique index|unique_index|table contract|indexes|indices|on_delete|foreign key|check" lib/live_canvas_schemas`
- `rg -n "^defmodule|schema \"|embedded_schema|@moduledoc|constraint|unique_index|index|references\\(|on_delete|create table|create constraint|create index" lib/live_canvas_schemas priv/repo/migrations`
- `rg -n "unique_index\\(|create index\\(|create unique_index\\(|create constraint\\(|references\\([^\\n]+on_delete|add .*references\\(" priv/repo/migrations`
- Focused migration reads for accounts identity, social graph, live, chat, content, post reports, webhooks/jobs, governance requests, auth events, user passkeys, and entropy-id migrations.

Current documentation gap:

- `lib/live_canvas_schemas` has 26 persisted `schema "..."` modules. None of those persisted schema modules has a table-contract summary for unique indexes, check constraints, important foreign-key delete behavior, or important access-pattern indexes.
- The only `@moduledoc` hits in `lib/live_canvas_schemas` are namespace/base modules with `@moduledoc false`; the scan found no schema-local contract docs.
- Namespace modules, enum/type modules, and `LCSchemas.Schema` are not direct per-table contract targets, but Stage 7 should consider using `docs/architecture/conventions.md` or `LCSchemas.Schema` to avoid repeating the common relational-table contract in every schema.
- The initial evidence item for `users.email` is historical now: `20260302000000_rebuild_accounts_identity_tables.exs` drops the `users.email` index/column after splitting addresses into `email_addresses` and join tables. Stage 7 should not document `users.email` as a current `users` table contract.

Schema modules needing contract summaries under the tight scope:

- Accounts identity tables:
  - `lib/live_canvas_schemas/accounts/user.ex`: common relational `entropy_id` unique contract; `users.suspended_at` has a non-unique index that matters only if Stage 7 decides staff/moderation or active-user query paths deserve schema-local mention.
  - `lib/live_canvas_schemas/accounts/email_address.ex`: unique `normalized_email` plus common `entropy_id`; table owns canonical normalized email identity.
  - `lib/live_canvas_schemas/accounts/phone_number.ex`: unique `normalized_e164` plus common `entropy_id`; table owns canonical normalized phone identity.
  - `lib/live_canvas_schemas/accounts/user_email_address.ex`: unique `(user_id, email_address_id)`, cascade-delete FKs to `users` and `email_addresses`, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_phone_number.ex`: unique `(user_id, phone_number_id)`, cascade-delete FKs to `users` and `phone_numbers`, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_identity.ex`: unique `(provider, provider_uid)`, cascade-delete FK to `users`, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_contact_entry.ex`: unique `(user_id, contact_client_id)`, cascade-delete FK to `users`, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`: unique `(user_contact_entry_id, email_address_id)`, cascade-delete FKs, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`: unique `(user_contact_entry_id, phone_number_id)`, cascade-delete FKs, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/user_token.ex`: explicit UUID-primary-key exception with no `entropy_id`; unique `(context, secret_hash)` in the current table, cascade-delete FK to `users`, and Postgres-owned UUIDv7 id generation. Historical `(context, token)` appears only in older/down migration paths and should not be documented as the current contract.
  - `lib/live_canvas_schemas/accounts/user_passkey.ex`: unique `credential_id`, unique `user_identity_id`, cascade-delete FKs to `users` and `user_identities`, plus common `entropy_id`.
  - `lib/live_canvas_schemas/accounts/auth_event.ex`: nilify-on-delete FK to `users`, common `entropy_id`, and audit/query indexes on `user_id`, `event_type`, and `inserted_at` if Stage 7 treats those as behaviorally important.
- Social graph tables:
  - `lib/live_canvas_schemas/social/follow.ex`: unique `(follower_id, followed_id)`, cascade-delete FKs to both users, and common `entropy_id`; follower/followed indexes support relationship lookup paths.
  - `lib/live_canvas_schemas/social/block.ex`: unique `(blocker_id, blocked_id)`, cascade-delete FKs to both users, and common `entropy_id`; blocker/blocked indexes support relationship lookup paths.
  - `lib/live_canvas_schemas/social/mute.ex`: unique `(muter_id, muted_id)`, cascade-delete FKs to both users, and common `entropy_id`; muter/muted indexes support relationship lookup paths.
- Live tables:
  - `lib/live_canvas_schemas/live/live_session.ex`: cascade-delete FK to host user, nilify-on-delete FK to `recording_media_asset_id`, common `entropy_id`, and status/recording indexes where they explain live/session history access.
  - `lib/live_canvas_schemas/live/live_participant.ex`: unique `(live_session_id, user_id)`, cascade-delete FKs to live session and user, plus common `entropy_id`.
  - `lib/live_canvas_schemas/live/live_session_runtime_owner.ex`: unique `live_session_id` enforcing one runtime owner per session, cascade-delete FK to live session, common `entropy_id`, and lease/owner indexes for runtime ownership claim and expiry paths.
- Chat table:
  - `lib/live_canvas_schemas/chat/chat_message.ex`: cascade-delete FKs to live session and sender, nilify-on-delete FK to moderator, common `entropy_id`, and the `(live_session_id, inserted_at, id)` index that supports retained-history pagination/order.
- Content tables:
  - `lib/live_canvas_schemas/content/post.ex`: cascade-delete FK to author, common `entropy_id`, and behaviorally important story/feed indexes on `kind`, `expires_at`, and `(kind, inserted_at)`; the migration explicitly documents the story-slice ordering index.
  - `lib/live_canvas_schemas/content/media_asset.ex`: cascade-delete FK to owner and optional cascade-delete FK to post, plus common `entropy_id`.
  - `lib/live_canvas_schemas/content/post_report.ex`: check constraints for `reason` and `status`, unique `(reporter_id, post_id)`, cascade-delete FKs to reporter and post, common `entropy_id`, and moderation queue index `(status, inserted_at)`.
- Infra tables:
  - `lib/live_canvas_schemas/infra/webhook_event.ex`: unique `(provider, external_event_id)` for webhook idempotency, common `entropy_id`, and `(status, received_at)` processing index.
  - `lib/live_canvas_schemas/infra/async_job.ex`: partial unique `dedupe_key` where non-null, check constraints for non-negative attempts and positive max attempts, common `entropy_id`, and claim index `(kind, status, scheduled_at)`.
  - `lib/live_canvas_schemas/infra/data_export_request.ex`: nilify-on-delete FK to `users`, common `entropy_id`, and `(user_id, inserted_at)` governance-history index if treated as behaviorally important.
  - `lib/live_canvas_schemas/infra/account_deletion_request.ex`: nilify-on-delete FK to `users`, common `entropy_id`, and `(user_id, inserted_at)` governance-history index if treated as behaviorally important.

Stage 7 planning constraints:

- Do not document every routine FK index by default. Mention non-unique indexes only when they explain an intentional query path, ordering contract, worker claim path, audit/history lookup, or expiry/cleanup path.
- Do not duplicate full migration text in schema files. The target is a compact table-contract summary that helps a reader understand invariants without opening migrations.
- Decide how to represent the common relational-table contract once: bigint `id`, Postgres-generated UUIDv7 `entropy_id`, unique `entropy_id`, and `:utc_datetime_usec` timestamps. Per-schema summaries should focus on table-specific invariants unless Stage 7 chooses an explicit "common contract applies" line.
- Keep `users_tokens` visibly exceptional because it uses the `:uuid_primary_key` schema mode and UUIDv7 primary key rather than relational bigint plus `entropy_id`.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep Stage 8 documentation/comment-only. Do not change migrations, schema fields, associations, changesets, queries, indexes, constraints, enum values, runtime behavior, or tests that assert runtime behavior.
- Add a durable convention note in `docs/architecture/conventions.md` under `Data And Security`:

```markdown
- Persisted Ecto schema modules should include a concise table-contract summary near the schema definition. Summaries should name table-specific unique indexes, check constraints, important foreign-key delete behavior, deliberate primary-key/identifier exceptions, and non-unique indexes only when they explain an intentional query path, ordering contract, worker claim path, audit/history lookup, or expiry/cleanup path. Do not copy migrations wholesale; keep common relational defaults in the convention and reference them briefly from each schema.
```

- Use module-level `@moduledoc` as the per-schema documentation format. Put it after aliases and before `@type` when a module already has aliases, or after `use LCSchemas.Schema, ...` when there are no aliases. Keep each summary short and use this shape:

```elixir
@moduledoc """
Schema for the `table_name` table.

Table contract:
- Uses the standard relational table contract: bigint `id`, database-generated UUIDv7 `entropy_id` with a unique index, and `:utc_datetime_usec` timestamps.
- Add only table-specific invariants here.
"""
```

- For `lib/live_canvas_schemas/accounts/user_token.ex`, use the exception format instead of the standard relational line:

```elixir
@moduledoc """
Schema for the `users_tokens` table.

Table contract:
- Deliberate identifier exception: UUIDv7 primary key generated by Postgres, no `entropy_id`.
- `(context, secret_hash)` is unique for persisted token secrets.
- Deleting a user cascades to their tokens.
"""
```

- Do not add table-contract docs to namespace modules (`lib/live_canvas_schemas/accounts.ex`, `chat.ex`, `content.ex`, `infra.ex`, `live.ex`, `social.ex`), enum/type modules, or `lib/live_canvas_schemas/schema.ex`.

Schema modules to update in Stage 8:

- Accounts:
  - `lib/live_canvas_schemas/accounts/user.ex`: standard relational contract; mention the `suspended_at` account-state index only if the final wording ties it to staff/moderation or active-account filtering.
  - `lib/live_canvas_schemas/accounts/email_address.ex`: standard relational contract; unique `normalized_email`.
  - `lib/live_canvas_schemas/accounts/phone_number.ex`: standard relational contract; unique `normalized_e164`.
  - `lib/live_canvas_schemas/accounts/user_email_address.ex`: standard relational contract; unique `(user_id, email_address_id)`; deleting either side cascades to the join row.
  - `lib/live_canvas_schemas/accounts/user_phone_number.ex`: standard relational contract; unique `(user_id, phone_number_id)`; deleting either side cascades to the join row.
  - `lib/live_canvas_schemas/accounts/user_identity.ex`: standard relational contract; unique `(provider, provider_uid)`; deleting a user cascades to identities.
  - `lib/live_canvas_schemas/accounts/user_contact_entry.ex`: standard relational contract; unique `(user_id, contact_client_id)`; deleting a user cascades to contact entries.
  - `lib/live_canvas_schemas/accounts/user_contact_entry_email_address.ex`: standard relational contract; unique `(user_contact_entry_id, email_address_id)`; deleting either side cascades to the join row.
  - `lib/live_canvas_schemas/accounts/user_contact_entry_phone_number.ex`: standard relational contract; unique `(user_contact_entry_id, phone_number_id)`; deleting either side cascades to the join row.
  - `lib/live_canvas_schemas/accounts/user_token.ex`: UUID-primary-key exception; unique `(context, secret_hash)`; user delete cascades to tokens; do not document historical `(context, token)`.
  - `lib/live_canvas_schemas/accounts/user_passkey.ex`: standard relational contract; unique `credential_id`; unique `user_identity_id`; deleting a user or identity cascades to passkeys.
  - `lib/live_canvas_schemas/accounts/auth_event.ex`: standard relational contract; deleting a user nilifies `user_id`; mention audit indexes on `user_id`, `event_type`, and `inserted_at`.
- Social:
  - `lib/live_canvas_schemas/social/follow.ex`: standard relational contract; unique `(follower_id, followed_id)`; deleting either user cascades; relationship lookup indexes on `follower_id` and `followed_id`.
  - `lib/live_canvas_schemas/social/block.ex`: standard relational contract; unique `(blocker_id, blocked_id)`; deleting either user cascades; relationship lookup indexes on `blocker_id` and `blocked_id`.
  - `lib/live_canvas_schemas/social/mute.ex`: standard relational contract; unique `(muter_id, muted_id)`; deleting either user cascades; relationship lookup indexes on `muter_id` and `muted_id`.
- Live:
  - `lib/live_canvas_schemas/live/live_session.ex`: standard relational contract; deleting the host user cascades to sessions; deleting a recording media asset nilifies `recording_media_asset_id`; mention status/recording indexes only as live/session-history access aids.
  - `lib/live_canvas_schemas/live/live_participant.ex`: standard relational contract; unique `(live_session_id, user_id)`; deleting session or user cascades to participants.
  - `lib/live_canvas_schemas/live/live_session_runtime_owner.ex`: standard relational contract; unique `live_session_id` enforces one runtime owner per session; deleting the live session cascades; `owner_node` and `lease_expires_at` indexes support ownership claim/expiry paths.
- Chat:
  - `lib/live_canvas_schemas/chat/chat_message.ex`: standard relational contract; deleting the live session or sender cascades to messages; deleting a moderator nilifies `moderated_by_id`; `(live_session_id, inserted_at, id)` supports retained-history pagination/order.
- Content:
  - `lib/live_canvas_schemas/content/post.ex`: standard relational contract; deleting the author cascades to posts; story/feed indexes on `kind`, `expires_at`, and `(kind, inserted_at)` support story filtering and ordering.
  - `lib/live_canvas_schemas/content/media_asset.ex`: standard relational contract; deleting the owner cascades; deleting the optional post cascades attached assets.
  - `lib/live_canvas_schemas/content/post_report.ex`: standard relational contract; check constraints for `reason` and `status`; unique `(reporter_id, post_id)`; deleting reporter or post cascades; `(status, inserted_at)` supports moderation queue ordering.
- Infra:
  - `lib/live_canvas_schemas/infra/webhook_event.ex`: standard relational contract; unique `(provider, external_event_id)` for webhook idempotency; `(status, received_at)` supports processing scans.
  - `lib/live_canvas_schemas/infra/async_job.ex`: standard relational contract; partial unique `dedupe_key` where non-null; check constraints for `attempts >= 0` and `max_attempts > 0`; `(kind, status, scheduled_at)` is the worker claim index.
  - `lib/live_canvas_schemas/infra/data_export_request.ex`: standard relational contract; deleting a user nilifies `user_id`; `(user_id, inserted_at)` supports user governance-history lookup.
  - `lib/live_canvas_schemas/infra/account_deletion_request.ex`: standard relational contract; deleting a user nilifies `user_id`; `(user_id, inserted_at)` supports user governance-history lookup.

Prevention checks:

- After editing, run `rg -n "Table contract:" lib/live_canvas_schemas` and expect exactly 26 hits, one for each persisted `schema "..."` module.
- Run `rg -n "schema \"" lib/live_canvas_schemas` and compare the 26 persisted schema modules against the `Table contract:` hits. Namespace modules, enum/type modules, and `LCSchemas.Schema` should remain excluded.
- Run `rg -n "users\\.email|\\(context, token\\)|\\[:context, :token\\]" lib/live_canvas_schemas` and expect no hits; those are historical contracts, not current schema docs.
- Run `rg -n "Table contract:|schema-local table contract|Persisted Ecto schema modules" docs/architecture/conventions.md lib/live_canvas_schemas` to confirm both the durable convention and per-schema summaries exist.
- Run `git diff --check`.

Verification for Stage 8:

- `mix compile`
- `mix typecheck`
- `git diff --check`

Stage 3 watchpoints to carry into Stage 8:

- Keep the wording concise. The goal is to surface invariants, not to reproduce migration files in comments.
- Keep common relational defaults consistent with `docs/architecture/conventions.md`: bigint primary key, database-generated UUIDv7 `entropy_id`, unique `entropy_id`, and `:utc_datetime_usec` timestamps.
- Keep `users_tokens` visibly exceptional and current: UUIDv7 primary key generated by Postgres, no `entropy_id`, unique `(context, secret_hash)`, and user-delete cascade.
- Do not document `users.email` or `(context, token)` as current contracts; both appear only in historical or down-migration paths.
- Mention non-unique indexes only when they explain a behaviorally important access path.

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GEN-001 - System Events Are Modeled As Chat Messages

**User concern:** System events should not be chat messages with no sender id. They should be special client-facing objects in a GraphQL interface and equivalent websocket event type. User-sent messages would be one event type, while moderator actions, join/leave, and gift events would be other event types. Moderator actions that update another message need later design discussion.

**Initial assessment:** Valid as a product/API architecture concern, but it is larger than a small cleanup. Current implementation persists system events as `chat_messages` rows with `kind: :system_event`, body text, metadata, and a sender id set to the acting host. That is not exactly "no sender id", but it still overloads chat message persistence and client projection.

**Stage 2 decision:** Marked deferred-valid on 2026-05-23. The architecture concern is real and must be fixed later: system events should become first-class client-facing timeline/event objects with matching GraphQL and websocket shapes. The "no sender id" detail is stale because current system events persist an acting host in `sender_id`, and the existing `ChatMessage` timeline design was intentional for history ordering, Relay pagination, and channel/GraphQL reconciliation. Do not treat this as a small cleanup or start Stage 3/7 inside this pass unless the user explicitly asks to begin the dedicated chat timeline/event-object redesign.

**Evidence seen:**

- `lib/live_canvas_schemas/chat/chat_message.ex` has `kind: [:user_message, :system_event]`, `metadata`, and `sender_id`.
- `lib/live_canvas/chat/system_events.ex` creates system event attrs as chat message rows with `sender_id: actor_id`.
- `lib/live_canvas_gql/chat/chat_types.ex` exposes a single `chat_message` node with `system_event_type` and `system_event_details` fields.
- `lib/live_canvas_gql/chat/chat_resolver.ex` parses system event metadata back into GraphQL fields.
- `test/live_canvas_gql/chat/*` and `test/live_canvas_web/channels/live_session_channel_test.exs` assert current system events as chat message payloads.

**What likely needs to change:**

- Design the client-facing chat timeline interface shape first.
- Decide persistence: separate event table, typed projection structs, or retained internal rows with a new external interface.
- Add GraphQL interface/union-like event types for user messages and non-message events.
- Add websocket payload/event shapes that mirror the GraphQL interface semantics.
- Decide how moderator actions that mutate an existing message appear in history and live updates.

**Where to look first:**

- `docs/plans/chat/2026-03-17-chat-system-events.md`
- `docs/plans/chat/TRACK.md`
- `lib/live_canvas_schemas/chat/chat_message.ex`
- `lib/live_canvas/chat/system_events.ex`
- `lib/live_canvas/chat/broadcasts.ex`
- `lib/live_canvas_gql/chat/chat_types.ex`
- `lib/live_canvas_gql/chat/chat_resolver.ex`
- `test/live_canvas_gql/chat/chat_queries_test.exs`
- `test/live_canvas_gql/chat/chat_mutations_test.exs`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked deferred-valid with a required future fix.
- Stage 3: Deferred until a dedicated chat timeline/event-object redesign is explicitly started.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Deferred until Stage 3 or a dedicated redesign plan is complete.
- Stage 8: Blocked until the redesign is planned and implementation is explicitly requested.

### CTX-001 - `runtime_rpc_module/1` Indirection

**User concern:** `runtime_rpc_module/1` is a function even though the module is never declared or changed in configuration and always uses the default.

**Initial assessment:** Needs discussion. The helper does read application config and per-call opts, and tests currently inject `FakeRuntimeRPC` through opts/config. In production, it appears to default to `LC.Live.RuntimeRPC`. If this is only a test seam, a better test strategy or explicit behaviour module may be preferable to hidden app-config indirection.

**Stage 2 decision:** Marked partially valid on 2026-05-23. The `LC.Live.RuntimeRPC` adapter boundary is useful and should stay: distributed runtime ownership needs deterministic coverage for remote lookup, join, snapshot, timeout, and not-found outcomes without requiring a live multi-node setup in every focused test. The cleanup target is the hidden module-selection seam in `LC.Live.runtime_rpc_module/1`, especially the undocumented `Application.get_env(:live_canvas, LC.Live)[:runtime_rpc]` fallback. Keep an explicit per-call adapter seam for context-level tests if needed, but remove or redesign the surprising app-config module swap and document the test-seam rule.

**Evidence seen:**

- `lib/live_canvas/live.ex` defines `runtime_rpc_module/1`, reading `Application.get_env(:live_canvas, LC.Live, [])` and `opts[:runtime_rpc]`.
- `lib/live_canvas/live/runtime_rpc.ex` is the default RPC adapter.
- Tests in `test/live_canvas/live/distributed_runtime_test.exs` pass `runtime_rpc: FakeRuntimeRPC`.
- Channel tests set `Application.put_env(:live_canvas, LC.Live, runtime_rpc: FakeRuntimeRPC)` for remote-owner scenarios.

**What likely needs to change:**

- Decide whether runtime RPC injection is useful enough to keep.
- If kept, make the seam explicit and documented rather than a surprising private helper.
- If removed, update tests to exercise `RuntimeRPC` directly or use another controlled boundary.

**Where to look first:**

- `lib/live_canvas/live.ex`
- `lib/live_canvas/live/runtime_rpc.ex`
- `test/live_canvas/live/distributed_runtime_test.exs`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

**Stage 3 scan findings:**

Scan commands run on 2026-05-23:

- `rg -n "runtime_rpc_module|runtime_rpc_timeout_ms|remote_lookup|remote_join|remote_live_session_state_snapshot|RuntimeRPC\\.call|runtime_rpc:|Application\\.(get_env|put_env).*LC\\.Live|FakeRuntimeRPC|defmodule LC\\.Live\\.RuntimeRPC|@callback call" lib test config`
- `rg -n "runtime_rpc:" config lib test --glob '!deps/**'`
- `rg -n "runtime_rpc_timeout_ms|runtime_rpc_timeout" . --glob '!deps/**' --glob '!_build/**'`
- `rg -n "Application\\.get_env\\(:live_canvas, __MODULE__|Application\\.get_env\\(:live_canvas, LC\\.|Application\\.get_env\\(:live_canvas, [A-Z][A-Za-z0-9_.]+" lib test config --glob '!deps/**'`
- `rg -n "peer_runtime|PeerRuntime|runtime_rpc|owned_by_remote|remote_runtime" test test/support lib docs/plans/backend/2026-05-22-code-quality-cleanup.md`

Findings:

- `runtime_rpc_module/1` exists only in `lib/live_canvas/live.ex`. It reads `Application.get_env(:live_canvas, LC.Live, [])[:runtime_rpc]`, then lets per-call opts override it, then silently falls back to `LC.Live.RuntimeRPC` for non-atom values.
- Only two public `LC.Live` entry points choose the adapter: `join_live_session/4` and `live_session_state_snapshot/2`.
- After the adapter is selected, the code already threads it explicitly through private runtime functions: `upsert_live_participant_for_runtime_join/6`, `join_runtime/5`, `join_runtime_with_retry/5`, `remote_lookup/3`, `remote_join/5`, `live_session_state_snapshot_from_runtime/2`, and `remote_live_session_state_snapshot/3`.
- `LC.Live.RuntimeRPC` already defines a concrete transport adapter and `@callback call/5`, so Stage 8 does not need to invent the boundary. The missing piece is making module selection explicit and non-surprising.
- No production `config/**` or `lib/**` code sets `runtime_rpc: ...` for `LC.Live`; the only `runtime_rpc:` call sites found are explicit test opts in `test/live_canvas/live/distributed_runtime_test.exs`.
- `test/live_canvas/live/distributed_runtime_test.exs` uses `runtime_rpc: FakeRuntimeRPC` explicitly in focused context tests. That seam is direct and should remain or be replaced with an equally explicit helper because it verifies remote lookup/join/snapshot error mapping without real distributed nodes.
- `test/live_canvas_web/channels/live_session_channel_test.exs` is the problematic use: `configure_live_runtime_rpc/1` mutates `Application.put_env(:live_canvas, LC.Live, runtime_rpc: FakeRuntimeRPC)` so channel tests can force `:remote_not_found` and `:remote_timeout` outcomes through the hidden app-config seam.
- `test/integration/live/runtime_partition_rejoin_test.exs` and `test/support/live/peer_runtime_helper.ex` already cover real peer-node behavior behind the optional `:peer_runtime` tag. That proves the repo has a higher-fidelity path for distributed runtime behavior, but it should not replace every focused fake-adapter unit test.
- `runtime_rpc_timeout_ms/0` is a separate timeout configuration knob used by the three remote RPC calls. It is not the same issue as module selection and should be left alone unless Stage 8 deliberately documents or validates timeout config.
- Similar `Application.get_env` usage in `LC.Live.SessionSupervisor`, `LC.Live.SessionOwnership`, rate limiting, object storage, and test support is ordinary scalar/service configuration or support-only configuration. Stage 3 did not find another runtime module-swap helper with the same shape as `runtime_rpc_module/1`.

Stage 3 watchpoints to carry into Stage 8:

- Do not remove `LC.Live.RuntimeRPC` or its `call/5` boundary; the cleanup is adapter selection, not the remote RPC abstraction.
- Avoid replacing the hidden app-config seam with a different hidden global test seam.
- Preserve explicit per-call adapter injection in `LC.Live` context tests unless Stage 8 introduces an equally clear local helper.
- Keep channel tests focused on channel behavior; move exact remote runtime outcome coverage to `LC.Live` tests where the adapter can be explicit.
- Do not widen into `LIVE-001` runtime ownership design or the optional peer-runtime integration test setup.
- Keep `runtime_rpc_timeout_ms/0` out of scope unless a small doc note is needed; timeout tuning is separate from module indirection.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep Stage 8 narrowly focused on `CTX-001`; do not redesign runtime ownership, leases, peer-node tests, or channel join flow beyond removing the hidden runtime-RPC module swap.
- In `lib/live_canvas/live.ex`:
  - Remove `runtime_rpc_module/1`.
  - Keep `@type runtime_rpc_module :: module()` or rename it to `runtime_rpc_adapter` only if the code touched nearby remains clearer and `mix typecheck` stays clean.
  - In `join_live_session/4`, select the adapter explicitly from the call opts with default `RuntimeRPC`, for example `runtime_rpc = Keyword.get(opts, :runtime_rpc, RuntimeRPC)`.
  - In `live_session_state_snapshot/2`, use the same explicit per-call default.
  - Do not read `Application.get_env(:live_canvas, LC.Live, [])[:runtime_rpc]` anywhere.
  - Continue passing the selected adapter through the existing private runtime functions.
  - Leave `runtime_rpc_timeout_ms/0` unchanged unless Stage 8 finds a compile/type issue; it is timeout config, not module selection.
- In `test/live_canvas/live/distributed_runtime_test.exs`:
  - Keep the explicit `runtime_rpc: FakeRuntimeRPC` context tests for remote lookup, join retry, failed remote join rollback, stale local runtime routing, and remote snapshot behavior.
  - Add a regression test proving `Application.put_env(:live_canvas, LC.Live, runtime_rpc: FakeRuntimeRPC)` no longer controls the runtime RPC adapter. Use a remote-owner lease whose node is not connected and assert the default adapter returns `{:error, :remote_unreachable}`; also assert the fake adapter did not receive a call if the fake records calls.
  - Keep the existing process-dictionary fake response setup if it remains the smallest local test seam.
- In `test/live_canvas_web/channels/live_session_channel_test.exs`:
  - Remove `configure_live_runtime_rpc/1` and the `Application.put_env(:live_canvas, LC.Live, runtime_rpc: FakeRuntimeRPC)` dependency.
  - Keep or adapt the existing remote-owned session test that naturally gets `:remote_unreachable` through the default `LC.Live.RuntimeRPC`; it still proves the channel maps remote transport failures to `"session_unavailable"` and emits telemetry with the reason it received.
  - Move exact `:remote_not_found` and `:remote_timeout` behavior assertions out of channel tests if they depend on the hidden config seam. Those reasons are owned by `LC.Live` context tests with explicit adapter injection.
  - Remove the channel-local `FakeRuntimeRPC` module if no channel test still uses it.
- Add a durable convention note in `docs/architecture/conventions.md`, preferably under a new `Runtime Boundaries And Test Seams` section:
  - Runtime or external-service adapters should be explicit boundaries with typed behavior callbacks.
  - Production module swaps through app config should exist only when the deployment actually supports changing the adapter and the convention/config is documented.
  - Test-only adapter swaps should use explicit per-call opts, support helpers, or local fakes instead of hidden app-config module indirection.

Prevention checks for Stage 8:

- `rg -n "runtime_rpc_module|runtime_rpc: FakeRuntimeRPC|Application\\.(get_env|put_env)\\(:live_canvas, (LC\\.)?Live" lib test`
  - Expected: no `runtime_rpc_module`; no `Application.get_env/put_env` for `LC.Live` runtime RPC; explicit `runtime_rpc: FakeRuntimeRPC` may remain only in `test/live_canvas/live/distributed_runtime_test.exs`.
- `rg -n "runtime_rpc_timeout_ms|runtime_rpc_timeout" lib/live_canvas/live.ex`
  - Expected: timeout helper still exists and remote RPC calls still pass a timeout.
- `rg -n "defmodule FakeRuntimeRPC|runtime_rpc: FakeRuntimeRPC" test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas/live/distributed_runtime_test.exs`
  - Expected: fake adapter remains only where explicit context tests need it; channel test file should not configure `LC.Live` with the fake.
- `rg -n "Runtime Boundaries And Test Seams|Test-only adapter swaps|app config" docs/architecture/conventions.md`
  - Expected: convention note exists.
- `git diff --check`

Verification for Stage 8:

- `mix test test/live_canvas/live/distributed_runtime_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`
- `mix typecheck`
- `git diff --check`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### SOCK-001 - `parse_session_id/1` And `parse_session_id_hint/1`

**User concern:** `live_session_channel.ex` has `parse_session_id/1` and `parse_session_id_hint/1`; these are not needed and are slop.

**Initial assessment:** Partially valid. The code does need to parse the `"live_session:" <> raw_session_id` topic suffix into an integer before calling `Live.fetch_joinable_session/1`, and the hint is used for telemetry on failed joins. The duplication and helper naming are still questionable; parsing could be simplified or centralized with topic parsing.

**Stage 2 decision:** Merged into `SOCK-002` on 2026-05-23. The narrow complaint is partially valid: topic-id parsing and telemetry hints are necessary, but `parse_session_id/1` and `parse_session_id_hint/1` duplicate the same `Integer.parse/1` logic. The fix should not run as a separate narrow cleanup. Instead, `SOCK-002` should own both live-session topic generation and topic parsing so the eventual shared web/channel topic boundary can build topics, parse topics, preserve invalid-topic responses, and provide a parsed session-id telemetry hint consistently.

**Evidence seen:**

- `lib/live_canvas_web/channels/live_session_channel.ex` calls `parse_session_id_hint/1` for telemetry and `parse_session_id/1` for join flow.
- Both helpers independently use `Integer.parse/1`.

**What likely needs to change:**

- Decide whether invalid topic IDs should be parsed inline, by a shared topic module, or by Phoenix route/topic pattern handling.
- Remove the duplicate parse path for telemetry if the join result can carry the parsed id or nil.
- Keep explicit invalid-session handling unless the API contract changes.

**Where to look first:**

- `lib/live_canvas_web/channels/live_session_channel.ex`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; merged into `SOCK-002`.
- Stage 3: Not applicable separately; `SOCK-002` owns the combined scan.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Not applicable separately; `SOCK-002` owns the combined plan.
- Stage 8: Not applicable separately; implement only through `SOCK-002` after its Stage 7 is written and implementation is explicitly requested.

### SOCK-002 - Topic Name Generators Duplicated Across GraphQL, Chat, And Channels

**User concern:** Functions like `session_control_topic/1` and all topic name generators should move out of GraphQL modules and domain contexts. Topic generation should be consistent across the app and live under sockets/channels-specific code.

**Initial assessment:** Valid. Topic string construction is duplicated in multiple modules, including GraphQL resolver code, channel code, and chat broadcast code. A shared transport-owned topic module would reduce drift and move transport naming out of GraphQL/domain modules.

**Stage 2 decision:** Marked valid on 2026-05-24. Topic naming is a transport boundary and is currently duplicated in GraphQL lifecycle mutation code, the live-session channel, chat broadcast code, and tests. `SOCK-002` should own the shared live-session topic boundary and should include the merged `SOCK-001` parsing concern. Stage 3 should scan generation, parsing, broadcast, subscription, telemetry-hint, and test call sites before Stage 7 decides the exact module boundary. The likely end state is a focused transport-owned topic boundary that can build live-session topics, build control topics, parse live-session join topics, and expose a parsed session-id hint without copying `Integer.parse/1` logic. Stage 7 must still decide whether domain-adjacent broadcast code moves to that transport boundary, receives topics from callers, or depends on a narrowly named topic module; do not solve that during Stage 2.

**Merged scope from `SOCK-001`:** `SOCK-002` also owns live-session topic parsing. The eventual shared topic boundary should replace duplicated generation helpers and the separate `parse_session_id/1` / `parse_session_id_hint/1` parsing path, while preserving client-safe invalid-topic responses and telemetry `session_id` hints.

**Stage 3 scan findings:**

Scan commands run on 2026-05-24:

- `rg -n 'defp? .*topic|session_control_topic|session_user_control_topic|live_session_topic|topic =' lib test --glob '!deps/**' --glob '!_build/**'`
- `rg -n '"live_session(:|_)|live_session_control|live_session_user_control|live_session:' lib test --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'parse_session_id|Integer\.parse\(|invalid_session_id|session_id_hint|join\("live_session:' lib/live_canvas_web test/live_canvas_web lib/live_canvas_gql test/live_canvas_gql --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'Phoenix\.PubSub\.(broadcast|subscribe)|Endpoint\.subscribe|broadcast!\(|handle_info\(%Broadcast|%Broadcast\{topic:' lib/live_canvas_gql lib/live_canvas_web lib/live_canvas test --glob '!deps/**' --glob '!_build/**'`

Findings:

- Exact topic-generation duplication exists in three production modules:
  - `lib/live_canvas_gql/live/live_resolver.ex`: private `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1` support lifecycle disconnect and session-state broadcasts from GraphQL mutations.
  - `lib/live_canvas_web/channels/live_session_channel.ex`: private `live_session_topic/1`, `session_control_topic/1`, and `session_user_control_topic/2` support session-state broadcasts and control-topic subscriptions for joined sockets.
  - `lib/live_canvas/chat/broadcasts.ex`: private `live_session_topic/1` supports chat message and chat message update broadcasts.
- The merged parsing scope is concentrated in `lib/live_canvas_web/channels/live_session_channel.ex`: both authenticated and unauthenticated `join/3` clauses match `"live_session:" <> raw_session_id`; `parse_session_id/1` and `parse_session_id_hint/1` duplicate `Integer.parse/1`; invalid parse still maps to `"invalid_session_id"` while telemetry uses a parsed `session_id` hint or nil.
- The only other `Integer.parse/1` hit in the scanned web/GQL paths is `lib/live_canvas_web/plugs/webhook_signature.ex`, which parses webhook timestamps and is unrelated to live-session topics.
- `lib/live_canvas_web/channels/user_socket.ex` declares the Phoenix channel route `channel "live_session:*", LCWeb.LiveSessionChannel`. Treat this as part of the socket boundary to preserve; Stage 7 can decide whether a shared prefix constant is useful, but Stage 8 should not obscure the Phoenix routing pattern.
- Tests hardcode the same public topic strings in three clusters:
  - `test/live_canvas_gql/live/live_mutations_test.exs`: subscribes to `"live_session:#{id}"`, `"live_session_control:#{id}"`, and `"live_session_control:#{id}:user:#{user_id}"` to verify lifecycle broadcasts/disconnects.
  - `test/live_canvas_gql/chat/chat_mutations_test.exs`: subscribes to `"live_session:#{id}"` for chat broadcasts.
  - `test/live_canvas_web/channels/live_session_channel_test.exs` and `test/integration/live_session_flow_test.exs`: build join topics and PubSub subscription topics directly, including invalid-topic examples such as `"live_session:not-a-session-id"`.
- `lib/live_canvas/release/capacity_drill.ex` uses an unrelated release probe topic (`"release-capacity-channel-..."`) and should stay out of `SOCK-002`.
- `LC.Chat.Broadcasts` is transport-adjacent despite living under `LC.Chat` because it already depends on `Phoenix.Socket.Broadcast` and `Phoenix.PubSub`. Stage 7 should decide whether to move this broadcast boundary, inject topics from callers, or allow a narrowly named web/channel topic module dependency; Stage 3 does not require changing the broader chat context.

Stage 3 watchpoints to carry into Stage 7:

- Preserve public socket topic formats unless Stage 7 intentionally records a client-visible contract change: `"live_session:#{session_id}"`, `"live_session_control:#{session_id}"`, and `"live_session_control:#{session_id}:user:#{user_id}"`.
- Preserve join behavior for invalid topics, missing sessions, ended sessions, remote runtime failures, and telemetry `session_id` hints.
- Keep topic generation/parsing under a socket/web boundary or another explicitly transport-owned boundary; do not introduce generic domain helpers for Phoenix topic names.
- Avoid making the `LC.Chat` domain layer depend casually on `LCWeb` without an explicit Stage 7 boundary decision.
- Update tests through the same shared topic boundary where practical, while keeping invalid-topic literals where they document client-facing rejection behavior.

**Evidence seen:**

- `lib/live_canvas_gql/live/live_resolver.ex` defines `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1`.
- `lib/live_canvas_web/channels/live_session_channel.ex` defines `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1`.
- `lib/live_canvas_web/channels/live_session_channel.ex` separately parses `"live_session:" <> raw_session_id` with both `parse_session_id/1` and `parse_session_id_hint/1`.
- `lib/live_canvas/chat/broadcasts.ex` defines `live_session_topic/1`.
- Tests directly assemble strings like `"live_session_control:#{live_session.id}"`.
- Focused Stage 2 evidence check on 2026-05-24 confirmed the duplicate helpers and found hardcoded live-session and control topics across `test/live_canvas_gql/live/live_mutations_test.exs`, `test/live_canvas_gql/chat/chat_mutations_test.exs`, and `test/live_canvas_web/channels/live_session_channel_test.exs`.

**What likely needs to change:**

- Create a shared topic helper under an explicit transport-owned boundary, for example `LCTransport.LiveSessionTopics`.
- Replace GraphQL, channel, chat broadcast, parsing, and tests with the shared helper.
- Decide whether domain modules like `LC.Chat.Broadcasts` should call a web module, move broadcasts to web, or receive topics from the caller.
- Preserve `"invalid_session_id"` join responses and telemetry `session_id` hints when parsing live-session topics.

**Stage 7 fix and prevention plan:** Written on 2026-05-24.

Boundary decision for Stage 8:

- Use an explicit transport-owned boundary instead of putting the shared helper under `LCWeb`. `LCWeb` currently depends on `LCGQL`, and `LCGQL` depends on `LC`; making GraphQL call an `LCWeb.*` helper would create the wrong dependency direction for a shared topic contract. The Stage 8 implementation should add a small top-level `LCTransport` boundary for Phoenix transport contracts shared by GraphQL lifecycle mutations, channels, and chat broadcast adapters.
- Keep `LCTransport.LiveSessionTopics` pure: it should build and parse topic strings only. It should not call Phoenix, subscribe, broadcast, inspect sockets, load sessions, authorize users, or emit telemetry.
- Do not move the Phoenix channel route declaration out of `lib/live_canvas_web/channels/user_socket.ex`. Keep the visible route literal `channel "live_session:*", LCWeb.LiveSessionChannel` unless Stage 8 proves Phoenix accepts an equally readable compile-time constant; preserving the literal is preferred because it documents the client socket contract.
- Do not make `LC.Chat` depend on `LCWeb`. For chat broadcasts, remove the private topic generator from `LC.Chat.Broadcasts` by injecting the already-built topic from transport callers, or move the broadcast adapter to an explicit transport module. The preferred first fix is topic injection because it removes duplicated topic construction without broadening this cleanup into the future chat timeline/event-object redesign.

Stage 8 fix scope:

- Add `lib/live_canvas_transport.ex` defining `LCTransport` as a top-level Boundary module. Export only the new topic module at first, for example:

```elixir
defmodule LCTransport do
  @moduledoc false

  use Boundary,
    top_level?: true,
    deps: [],
    exports: [LiveSessionTopics]
end
```

- Add `lib/live_canvas_transport/live_session_topics.ex` defining `LCTransport.LiveSessionTopics`. Suggested public API:

```elixir
@type parse_result :: {:ok, pos_integer()} | {:error, :invalid_session_id}

@spec live_session_topic(integer()) :: String.t()
def live_session_topic(session_id) when is_integer(session_id), do: "live_session:#{session_id}"

@spec session_control_topic(integer()) :: String.t()
def session_control_topic(session_id) when is_integer(session_id),
  do: "live_session_control:#{session_id}"

@spec session_user_control_topic(integer(), integer()) :: String.t()
def session_user_control_topic(session_id, user_id)
    when is_integer(session_id) and is_integer(user_id),
    do: "live_session_control:#{session_id}:user:#{user_id}"

@spec parse_live_session_topic(String.t()) :: parse_result()
def parse_live_session_topic("live_session:" <> raw_session_id),
  do: parse_session_id(raw_session_id)

def parse_live_session_topic(_topic), do: {:error, :invalid_session_id}

@spec session_id_hint(String.t()) :: pos_integer() | nil
def session_id_hint(topic) when is_binary(topic) do
  case parse_live_session_topic(topic) do
    {:ok, session_id} -> session_id
    {:error, :invalid_session_id} -> nil
  end
end

def session_id_hint(_topic), do: nil
```

- Keep the parser's accepted ID contract identical to the current channel parser: a decimal integer string with no trailing characters and `session_id > 0` returns `{:ok, session_id}`; everything else returns `{:error, :invalid_session_id}` or `nil` for hints.
- Update Boundary declarations so callers can use the transport helper without reverse dependencies:
  - In `lib/live_canvas_gql/live_canvas_gql.ex`, add `LCTransport` to `deps`.
  - In `lib/live_canvas_web.ex`, add `LCTransport` to `deps`.
  - Do not add `LCWeb` as a dependency of `LCGQL` or `LC`.
  - Do not add `LCTransport` to `LC` unless Stage 8 deliberately chooses to keep topic generation inside `LC.Chat.Broadcasts`; the preferred topic-injection path should not require `LC` to depend on transport.
- In `lib/live_canvas_gql/live/live_resolver.ex`, alias `LCTransport.LiveSessionTopics` and replace private `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1` calls with `LiveSessionTopics.session_control_topic/1`, `LiveSessionTopics.session_user_control_topic/2`, and `LiveSessionTopics.live_session_topic/1`. Remove the three private topic helpers and their specs.
- In `lib/live_canvas_web/channels/live_session_channel.ex`, alias `LCTransport.LiveSessionTopics`; replace `parse_session_id/1` with `LiveSessionTopics.parse_live_session_topic(topic)` by passing the full join topic, replace `parse_session_id_hint/1` with `LiveSessionTopics.session_id_hint(topic)`, and replace private topic-builder calls in session-state broadcasts and control subscriptions. Remove private `parse_session_id/1`, `parse_session_id_hint/1`, `live_session_topic/1`, `session_control_topic/1`, and `session_user_control_topic/2`.
- Preserve unauthenticated join semantics: an unauthenticated socket joining `"live_session:not-a-session-id"` should still return `"not_authorized"` while telemetry gets a nil session hint, because the current unauthenticated clause does not validate the ID before returning auth failure.
- In `lib/live_canvas/chat/broadcasts.ex`, remove private `live_session_topic/1`. Preferred first fix: change `broadcast_message/1` and `broadcast_message_update/1` to `broadcast_message/2` and `broadcast_message_update/2`, where the second argument is a prebuilt binary topic. Preserve the existing no-op behavior for malformed message maps, and return `:ok` without broadcasting when either `live_session_id` is missing/non-integer or the supplied topic is not a binary.
- In `lib/live_canvas/chat.ex`, update the public wrappers to accept the topic argument, for example `broadcast_message(chat_message, topic)` and `broadcast_message_update(chat_message, topic)`, and keep `message_payload/1` unchanged.
- In `lib/live_canvas_gql/chat/chat_resolver.ex`, alias `LCTransport.LiveSessionTopics`. When broadcasting a removed message update or a persisted removal system event, compute the topic from `removed_message.live_session_id` or `system_event.live_session_id` using `LiveSessionTopics.live_session_topic/1` and pass it to the updated `Chat.broadcast_message_update/2` or `Chat.broadcast_message/2`.
- In `lib/live_canvas_gql/live/live_resolver.ex`, update `broadcast_system_event/1` the same way for lifecycle system events. This keeps chat topic generation outside both `LC.Chat` and GraphQL-local private helpers while avoiding a broad broadcast-adapter move.
- Leave `LC.Chat.message_payload/1`, chat payload projection helpers, lifecycle event persistence, moderation redaction, and the `GEN-001` system-event object model unchanged.

Focused test updates:

- Add `test/live_canvas_transport/live_session_topics_test.exs` with pure unit coverage for:
  - `live_session_topic(123) == "live_session:123"`
  - `session_control_topic(123) == "live_session_control:123"`
  - `session_user_control_topic(123, 456) == "live_session_control:123:user:456"`
  - `parse_live_session_topic("live_session:123") == {:ok, 123}`
  - malformed, non-integer, zero, negative, and trailing-character topics return `{:error, :invalid_session_id}`
  - `session_id_hint/1` returns the positive integer for a valid join topic and nil for invalid topics.
- Update `test/live_canvas_gql/live/live_mutations_test.exs`, `test/live_canvas_gql/chat/chat_mutations_test.exs`, `test/live_canvas_web/channels/live_session_channel_test.exs`, and `test/integration/live_session_flow_test.exs` to use `LCTransport.LiveSessionTopics` for valid live-session, control, and user-control topic strings where the test is subscribing to or asserting production broadcasts.
- Keep literal invalid client topics in channel tests, such as `"live_session:not-a-session-id"`, because those literals document the public rejection behavior.
- Add or adjust channel telemetry assertions only if changing the join clause from raw ID parsing to full-topic parsing breaks existing coverage. The important invariant is still: valid topic hints record the parsed session ID, invalid topic hints record nil, and unauthenticated joins remain auth failures.
- Add a focused assertion around chat removal/update broadcasts only if existing GraphQL mutation tests no longer prove that `Chat.broadcast_message/2` and `Chat.broadcast_message_update/2` receive the same topic as before.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md`, preferably in a new short `Realtime Transport` subsection: live-session Phoenix topic strings and parsing live under `LCTransport.LiveSessionTopics`; GraphQL resolvers, channels, and chat broadcast adapters must not reimplement `"live_session:"` or `"live_session_control:"` string construction or duplicate `Integer.parse/1` topic parsing.
- After editing, run `rg -n 'defp? .*topic|session_control_topic|session_user_control_topic|live_session_topic|parse_session_id|parse_session_id_hint' lib/live_canvas_gql lib/live_canvas_web lib/live_canvas/chat lib/live_canvas_transport` and confirm the only live-session topic builders/parsers are in `LCTransport.LiveSessionTopics`, with call sites delegating to it.
- Run `rg -n '"live_session(:|_)|live_session_control|live_session:' lib test --glob '!deps/**' --glob '!_build/**'` and confirm remaining literals are either in `LCTransport.LiveSessionTopics`, `LCWeb.UserSocket`'s channel route, or invalid-topic tests that intentionally document the client-facing contract.
- Run `rg -n 'Integer\.parse\(' lib/live_canvas_gql lib/live_canvas_web lib/live_canvas/chat lib/live_canvas_transport test/live_canvas_transport --glob '!deps/**' --glob '!_build/**'` and confirm live-session topic parsing is centralized in the transport helper. The unrelated webhook timestamp parser must remain out of scope.
- Run `mix boundary.spec` after dependency updates and confirm `LCGQL` and `LCWeb` can depend on `LCTransport` without adding `LCWeb` dependencies to `LCGQL` or `LC`.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_transport/live_session_topics_test.exs test/live_canvas_gql/live/live_mutations_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/integration/live_session_flow_test.exs`
- `mix boundary.spec`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve public topic formats exactly: `"live_session:#{session_id}"`, `"live_session_control:#{session_id}"`, and `"live_session_control:#{session_id}:user:#{user_id}"`.
- Preserve channel join behavior for malformed IDs, missing sessions, ended sessions, remote runtime failures, rate limits, and unauthenticated sockets.
- Preserve telemetry `session_id` hints: valid join topics produce the parsed ID, invalid join topics produce nil, and unauthenticated invalid topics remain auth failures.
- Keep `LCWeb.UserSocket`'s route readable as the socket contract.
- Do not let `LC.Chat` depend on `LCWeb`, and do not start the `GEN-001` chat timeline/event-object redesign as part of this topic cleanup.

**Where to look first:**

- `lib/live_canvas_gql/live/live_resolver.ex`
- `lib/live_canvas_web/channels/live_session_channel.ex`
- `lib/live_canvas/chat/broadcasts.ex`
- `test/live_canvas_gql/live/live_mutations_test.exs`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request for `SOCK-002`.

### SOCK-003 - Channel Error Reason Formatters

**User concern:** `join_error_reason/1` and `message_error_reason/1` are mostly just atom-to-string conversion. Find a better way.

**Initial assessment:** Likely valid. The helpers flatten domain and transport reasons into string response payloads inside the channel. Some mappings are meaningful, such as remote-owner errors becoming `session_unavailable`, but many are simple atom conversions.

**Stage 2 decision:** Marked partially valid on 2026-05-24. The cleanup concern is real: `join_error_reason/1` and `message_error_reason/1` mix direct atom-to-string conversion, public socket contract formatting, changeset redaction, and semantic remapping of internal runtime failures inside `LCWeb.LiveSessionChannel`. However, the helpers are not merely needless conversion. The mobile realtime contract documents string `reason` payloads, remote runtime and ownership failures must collapse to client-safe `"session_unavailable"`, and telemetry should keep the internal atom reason separately from the client-facing response. The first cleanup should centralize and make explicit the socket/channel error-code boundary while preserving current public reason strings and avoiding any GraphQL mutation-error redesign owned by `GQL-004`.

Additional Stage 2 notes:

- `docs/contracts/mobile-live-session-realtime.md` pins join failure payloads as string reason codes, including `"invalid_session_id"`, `"session_not_found"`, `"session_ended"`, `"not_authorized"`, `"rate_limited"`, and `"session_unavailable"`.
- `LCWeb.LiveSessionChannel.join_error_reason/1` currently maps `:ended` and `:session_ended` to `"session_ended"`, `:not_found` to `"session_not_found"`, auth/rate-limit/parser failures to matching string codes, and remote ownership or remote RPC failures to `"session_unavailable"`.
- `LCWeb.LiveSessionChannel.message_error_reason/1` currently maps chat-send failures to string codes and hides `%Ecto.Changeset{}` details behind `"invalid_message"`.
- `LCWeb.LiveSessionChannel.channel_reason/1` separately normalizes telemetry metadata to low-cardinality atoms. Stage 3 should keep client-facing string reason formatting separate from telemetry reason normalization instead of merging them casually.
- `LC.Live.RuntimeRPC` and `LC.Live` already normalize remote transport and remote runtime errors before the channel sees them. `SOCK-003` should not move distributed runtime error normalization out of `LC.Live`; it should only decide where socket client-facing reason codes live.
- Keep `SOCK-003` scoped to socket/channel-facing error response formatting. Do not absorb GraphQL mutation error construction from `GQL-004`, topic construction/parsing from `SOCK-002`, or broader runtime-ownership design from `LIVE-001`.

**Stage 3 scan findings:**

Scan commands run on 2026-05-24:

- `rg -n 'defp .*error_reason|error_reason\(|channel_reason\(|%\{reason:|reason: "[^"]+"|Atom\.to_string\(reason\)|session_unavailable|invalid_message|join_failed|invalid_body' lib/live_canvas_web lib/live_canvas_gql lib/live_canvas test/live_canvas_web docs/contracts/mobile-live-session-realtime.md docs/release/observability-metrics.md`
- `rg -n 'defmodule .*Channel|use LCWeb, :channel|channel "' lib/live_canvas_web test/live_canvas_web`
- `rg -n 'remote_not_found|remote_timeout|remote_unreachable|owned_by_remote|normalize_remote_response|runtime_rpc_error|normalize_transport_error' lib/live_canvas test/live_canvas test/live_canvas_web/channels`
- `rg -n 'assert.*%\{reason:|assert_reply .*:error|assert_push "disconnect"|session_unavailable|invalid_session_id|invalid_message|invalid_body|rate_limited' test/live_canvas_web/channels test/integration`
- `rg -n 'invalid_message|join_failed|message_error_reason\(|join_error_reason\(|channel_reason\(|disconnect_live_session_channels|disconnect_live_session_user' lib test docs`
- `rg -n 'Broadcast\{topic: .*payload: %\{reason|payload: %\{reason: Atom\.to_string|event: "disconnect"|%\{reason: "viewer_left"|%\{reason: "session_ended"' lib test docs --glob '!deps/**' --glob '!_build/**'`

Findings:

- There is currently one Phoenix channel module in the repo: `lib/live_canvas_web/channels/live_session_channel.ex`, routed from `lib/live_canvas_web/channels/user_socket.ex` with `channel "live_session:*", LCWeb.LiveSessionChannel`. The exact reported formatter pattern is therefore concentrated in `LCWeb.LiveSessionChannel`.
- Exact cleanup target: `LCWeb.LiveSessionChannel.join_error_reason/1` and `message_error_reason/1`. They are private, untyped response-format helpers used only where the channel returns `{:error, %{reason: ...}}` for join failures and chat-send failures.
- `join_error_reason/1` has three kinds of behavior mixed together:
  - direct public string codes for parser/auth/rate-limit/session-status failures;
  - domain-to-public aliasing such as `:ended` and `:session_ended` both becoming `"session_ended"` and `:not_found` becoming `"session_not_found"`;
  - client-safe runtime failure redaction, where `{:owned_by_remote, _}`, `:remote_not_found`, `:remote_timeout`, and `:remote_unreachable` all become `"session_unavailable"`.
- `message_error_reason/1` has direct public string codes for `:session_ended`, `:not_authorized`, `:invalid_body`, and `:rate_limited`, plus `%Ecto.Changeset{}` redaction to `"invalid_message"`. It has no catch-all branch; this matches the currently typed chat-send error surface, but Stage 7 should decide whether an extracted formatter keeps a strict known-code contract or adds an explicit unknown fallback.
- `LCWeb.LiveSessionChannel.channel_reason/1` is a related but distinct telemetry normalizer. It maps `%Ecto.Changeset{}` to `:changeset`, atom tuple reasons to the atom, atom reasons to themselves, and everything else to `:unknown`. Stage 7 should keep telemetry reason normalization separate from client-facing reason string formatting, even if both live near each other.
- The mobile realtime contract pins the public string payloads for join failures and disconnects. Join reasons are documented as `"invalid_session_id"`, `"session_not_found"`, `"session_ended"`, `"not_authorized"`, `"rate_limited"`, and `"session_unavailable"`. Disconnect reasons are documented as `"session_ended"` and `"viewer_left"`.
- `test/live_canvas_web/channels/live_session_channel_test.exs` pins most current client-visible join/chat reason outputs and verifies that remote runtime outcomes return `"session_unavailable"` to clients while preserving the internal telemetry reason (`:remote_unreachable`, `:remote_not_found`, or `:remote_timeout`). It also pins chat-send `"rate_limited"` and `"invalid_body"`.
- No focused test currently exercises `%Ecto.Changeset{}` chat-send failure mapping to `"invalid_message"` or the `join_error_reason/1` `"join_failed"` fallback. Stage 7 should decide whether to add coverage while extracting the formatter, or whether those branches should become explicit unreachable/unknown mappings.
- Related socket-facing reason formatting exists in `LCGQL.Live.Resolver.disconnect_live_session_channels/2` and `disconnect_live_session_user/3`, which build `%Broadcast{event: "disconnect", payload: %{reason: Atom.to_string(reason)}}` for the public socket reasons `:session_ended` and `:viewer_left`. Tests in both GraphQL live mutations and channel tests pin those string payloads.
- Treat the GraphQL lifecycle disconnect payloads as a Stage 7 watchpoint, not automatic widening. If Stage 7 introduces a transport/channel reason-code module, it may be appropriate to use it for disconnect payload reasons as well; if Stage 7 keeps the first fix limited to error replies, leave disconnect payload formatting alone.
- `LC.Live.RuntimeRPC` and `LC.Live` already normalize distributed runtime transport failures to bounded internal atoms before the channel maps them to a client-safe reason. That normalization belongs outside `SOCK-003`.
- GraphQL mutation helpers such as `LCGQL.Live.Resolver.error_message/1`, `LCGQL.Chat.Resolver.error_message/1`, `LCGQL.Content.Resolver`, `LCGQL.Social.Resolver`, and `LCGQL.Accounts.Resolver` also convert atoms to strings, but they format GraphQL mutation payloads and remain owned by `GQL-004` or other GraphQL-specific cleanup. They should not be folded into `SOCK-003`.
- Non-socket internal reason-string conversions, such as auth-event metadata in `LC.Accounts` and async-job reason formatting in `LC.Infra.AsyncJobs.Worker`, are not related to this socket/channel cleanup.

Stage 3 watchpoints to carry into Stage 7:

- Preserve the public `%{reason: string}` socket error payload shape unless Stage 7 explicitly records a mobile contract change.
- Preserve remote runtime redaction: internal remote and owner-routing reasons must continue to return `"session_unavailable"` to clients without leaking node names or runtime details.
- Preserve telemetry reason behavior separately from response reason behavior. Tests should still prove clients get `"session_unavailable"` while telemetry retains the more specific internal remote atom.
- Avoid merging this with `SOCK-002`; topic construction/parsing and reason-code formatting are both transport-adjacent but solve different duplication problems.
- Avoid merging this with `GQL-004`; GraphQL mutation errors use different schema contracts and should not drive Phoenix Channel payloads.
- Include focused tests for any extracted reason formatter, especially changeset-to-`"invalid_message"` and unknown/fallback behavior if the extracted API keeps those cases.

**Evidence seen:**

- `lib/live_canvas_web/channels/live_session_channel.ex` defines `join_error_reason/1` and `message_error_reason/1`.
- Remote runtime errors are also normalized in `LC.Live`, then again in channel error reason formatting.
- GraphQL resolvers have separate reason-to-message helpers, which overlaps with `GQL-004`.

**What likely needs to change:**

- Decide on socket error payload shape: strings, atoms encoded by JSON, or structured error codes.
- Centralize channel error formatting if strings are still the public contract.
- Preserve meaningful semantic mappings like remote failures to `session_unavailable`.

**Stage 7 fix and prevention plan:** Written on 2026-05-24.

Boundary decision for Stage 8:

- Keep the public Phoenix Channel payload shape as `%{reason: string}`. The mobile realtime contract already documents string reason codes, so this cleanup should make the string-code boundary explicit rather than switching to atom payloads or structured error objects.
- Use an explicit transport-owned boundary for live-session socket reason codes. If `SOCK-002` Stage 8 has already created `LCTransport`, extend that boundary; otherwise create it during `SOCK-003` Stage 8 with only the reason-code module exported. The target module is `LCTransport.LiveSessionReasons`.
- Keep `LCTransport.LiveSessionReasons` pure. It should map already-normalized internal reasons to client-facing socket reason strings only; it must not call Phoenix, load sessions, authorize users, rate-limit, inspect sockets, emit telemetry, or normalize distributed runtime RPC failures.
- Keep telemetry normalization separate from client response formatting. `LCWeb.LiveSessionChannel.channel_reason/1` can remain channel-local because it produces low-cardinality atom metadata, not public socket response codes.
- Include GraphQL lifecycle disconnect broadcasts in this Stage 8 scope only for the socket-facing payload reason. `LCGQL.Live.Resolver.disconnect_live_session_channels/2` and `disconnect_live_session_user/3` currently produce Phoenix `disconnect` broadcasts with `%{reason: Atom.to_string(reason)}`; replacing that conversion with `LCTransport.LiveSessionReasons.disconnect_reason/1` belongs to this socket transport boundary. Do not touch GraphQL mutation payload error helpers such as `error_message/1`; those remain owned by `GQL-004` or GraphQL-specific cleanup.
- Preserve current runtime redaction: `{:owned_by_remote, _}`, `:remote_not_found`, `:remote_timeout`, and `:remote_unreachable` must still return `"session_unavailable"` to clients while telemetry retains the internal atom reason.

Stage 8 fix scope:

- Add or extend `lib/live_canvas_transport.ex`:

```elixir
defmodule LCTransport do
  @moduledoc false

  use Boundary,
    top_level?: true,
    deps: [],
    exports: [LiveSessionReasons]
end
```

  If `LCTransport.LiveSessionTopics` already exists from `SOCK-002`, preserve that export and add `LiveSessionReasons`; do not remove or rename topic APIs from the other plan.
- Add `lib/live_canvas_transport/live_session_reasons.ex` with a small public API:

```elixir
defmodule LCTransport.LiveSessionReasons do
  @moduledoc """
  Client-facing reason codes for live-session socket payloads.
  """

  @type chat_send_error_reason ::
          :session_ended | :not_authorized | :invalid_body | :rate_limited | Ecto.Changeset.t()

  @type disconnect_reason :: :session_ended | :viewer_left

  @spec join_error_reason(term()) :: String.t()
  def join_error_reason(:ended), do: "session_ended"
  def join_error_reason(:not_found), do: "session_not_found"
  def join_error_reason(:invalid_session_id), do: "invalid_session_id"
  def join_error_reason(:session_ended), do: "session_ended"
  def join_error_reason(:not_authorized), do: "not_authorized"
  def join_error_reason(:rate_limited), do: "rate_limited"
  def join_error_reason({:owned_by_remote, _owner_node}), do: "session_unavailable"

  def join_error_reason(reason)
      when reason in [:remote_not_found, :remote_timeout, :remote_unreachable],
      do: "session_unavailable"

  def join_error_reason(_reason), do: "join_failed"

  @spec chat_send_error_reason(chat_send_error_reason()) :: String.t()
  def chat_send_error_reason(:session_ended), do: "session_ended"
  def chat_send_error_reason(:not_authorized), do: "not_authorized"
  def chat_send_error_reason(:invalid_body), do: "invalid_body"
  def chat_send_error_reason(:rate_limited), do: "rate_limited"
  def chat_send_error_reason(%Ecto.Changeset{}), do: "invalid_message"

  @spec disconnect_reason(disconnect_reason()) :: String.t()
  def disconnect_reason(:session_ended), do: "session_ended"
  def disconnect_reason(:viewer_left), do: "viewer_left"
end
```

- Keep the join formatter's catch-all `"join_failed"` branch because it exists today and is the safest client-facing fallback for unexpected join failures.
- Keep chat-send formatting strict with no catch-all branch. That preserves current behavior: chat-send errors are a bounded surface, changesets are redacted to `"invalid_message"`, and unexpected internal errors are not silently converted into a misleading client code.
- Update Boundary declarations so callers can use the transport helper:
  - In `lib/live_canvas_web.ex`, add `LCTransport` to `deps`.
  - In `lib/live_canvas_gql/live_canvas_gql.ex`, add `LCTransport` to `deps` if using `disconnect_reason/1` in lifecycle broadcasts.
  - Do not add `LCWeb` as a dependency of `LCGQL` or `LC`, and do not move reason formatting into `LC.Live`.
- In `lib/live_canvas_web/channels/live_session_channel.ex`, alias `LCTransport.LiveSessionReasons`, replace `join_error_reason(reason)` with `LiveSessionReasons.join_error_reason(reason)`, replace `message_error_reason(reason)` with `LiveSessionReasons.chat_send_error_reason(reason)`, and remove the private `join_error_reason/1` and `message_error_reason/1` helpers.
- Leave `LCWeb.LiveSessionChannel.channel_reason/1`, `channel_result_metadata/1`, and telemetry assertions in place. Add a short comment only if needed to make clear that telemetry reason normalization is intentionally separate from public response code formatting.
- In `lib/live_canvas_gql/live/live_resolver.ex`, alias `LCTransport.LiveSessionReasons` and replace `Atom.to_string(reason)` inside `disconnect_live_session_channels/2` and `disconnect_live_session_user/3` with `LiveSessionReasons.disconnect_reason(reason)`. Do not change `error_message/1` or any GraphQL mutation error contract.

Focused test updates:

- Add `test/live_canvas_transport/live_session_reasons_test.exs` covering the extracted pure formatter:
  - join mappings: `:invalid_session_id`, `:not_found`, `:ended`, `:session_ended`, `:not_authorized`, and `:rate_limited`;
  - remote redaction: `{:owned_by_remote, :"node@host"}`, `:remote_not_found`, `:remote_timeout`, and `:remote_unreachable` all return `"session_unavailable"`;
  - unknown join fallback returns `"join_failed"`;
  - chat-send mappings: `:session_ended`, `:not_authorized`, `:invalid_body`, `:rate_limited`, and `%Ecto.Changeset{}` returning `"invalid_message"`;
  - disconnect mappings: `:session_ended` and `:viewer_left`.
- Keep existing channel tests in `test/live_canvas_web/channels/live_session_channel_test.exs` as integration coverage for public join/chat response payloads and telemetry. They should still prove that clients get `"session_unavailable"` while telemetry keeps `:remote_unreachable`, `:remote_not_found`, or `:remote_timeout`.
- Keep existing GraphQL lifecycle tests in `test/live_canvas_gql/live/live_mutations_test.exs` as integration coverage for `disconnect` broadcast payloads. They should still assert `%{reason: "session_ended"}` and `%{reason: "viewer_left"}`.
- Do not force a channel integration test for the changeset-to-`"invalid_message"` branch unless a clean existing path already produces a chat-send changeset failure. The pure formatter test is the focused coverage for that previously untested branch.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md`, preferably in a short `Realtime Transport` subsection: live-session Phoenix topic strings/parsing belong to `LCTransport.LiveSessionTopics` when that module exists, client-facing live-session socket reason strings belong to `LCTransport.LiveSessionReasons`, channel telemetry reason normalization remains separate, and GraphQL mutation errors remain under GraphQL-specific helpers.
- After editing, run `rg -n 'defp .*error_reason|join_error_reason|message_error_reason|chat_send_error_reason|disconnect_reason' lib/live_canvas_web lib/live_canvas_gql lib/live_canvas_transport` and confirm the only socket response reason formatter definitions are in `LCTransport.LiveSessionReasons`; channel and GraphQL call sites should delegate to it.
- Run `rg -n 'payload: %\{reason: Atom\.to_string\(reason\)|event: "disconnect".*reason' lib/live_canvas_gql lib/live_canvas_web lib/live_canvas_transport` and confirm live-session disconnect payload reason strings use `LCTransport.LiveSessionReasons.disconnect_reason/1`.
- Run `rg -n 'Atom\.to_string\(reason\)' lib/live_canvas_web lib/live_canvas_gql lib/live_canvas_transport` and explicitly classify any remaining matches. GraphQL mutation error helpers may remain; socket/channel response payload formatting should not.
- Run `mix boundary.spec` after dependency updates and confirm `LCWeb` and `LCGQL` can depend on `LCTransport` without introducing an `LCGQL -> LCWeb` or `LC -> LCTransport` dependency.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_transport/live_session_reasons_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/live/live_mutations_test.exs`
- `mix boundary.spec`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve the public `%{reason: string}` socket error payload shape.
- Preserve remote runtime redaction to `"session_unavailable"` for clients while telemetry retains internal remote reasons.
- Keep telemetry reason normalization separate from client-facing response reason formatting.
- Do not merge this with `SOCK-002` topic construction/parsing implementation, even if both modules live under `LCTransport`.
- Do not merge this with `GQL-004`; GraphQL mutation error helpers use different contracts.

**Where to look first:**

- `lib/live_canvas_web/channels/live_session_channel.ex`
- `lib/live_canvas_gql/live/live_resolver.ex`
- `test/live_canvas_web/channels/live_session_channel_test.exs`
- Any shared GraphQL error helper considered for `GQL-004`, to avoid diverging public error conventions.

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked partially valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request for `SOCK-003`.

### LIVE-001 - Live Session Runtime Ownership Stored In Postgres

**User concern:** Why is node ownership for sessions stored/handled with Postgres? Can this be done natively with OTP/Elixir features?

**Initial assessment:** Needs architecture discussion. Current code uses `live_session_runtime_owners` as a lease table to coordinate distributed session runtime ownership. OTP-native options may simplify this if deployment uses a single BEAM cluster and accepts the failure semantics of distributed Erlang primitives. Postgres leases provide durability and work across nodes that share the database, but they add complexity and may be unnecessary for the intended deployment.

**Stage 2 decision:** Marked valid on 2026-05-24. The user selected option #2: replace Postgres-backed live runtime ownership with an OTP-native ownership design. Stage 3 should scan the current ownership implementation and all dependent runtime behaviors before Stage 7 chooses the exact replacement. The fix must explicitly account for the semantics currently provided by the Postgres lease table rather than assuming a local process registry is a drop-in replacement.

Evidence/tradeoffs to carry into Stage 3:

- Current behavior depends on serialized row-lock claims, lease expiry and takeover, runtime heartbeats that stop a process after ownership loss, remote owner routing through runtime RPC, and durable participant rehydration when a runtime process is recreated.
- OTP-native mechanisms can simplify some deployments, but they do not match those semantics by default: local Registry is node-local, `:pg` is not a single-owner coordinator, `:global` and distributed Erlang require accepting their cluster membership and partition behavior, and purely in-memory ownership loses the shared-DB recovery semantics.
- Stage 3 must compare OTP-native options such as local Registry, distributed Erlang, `:global`, `:pg`, and supervised process ownership against current runtime join, lookup, failover, viewer count, remote snapshot, partition/rejoin, and cleanup behavior.
- Keep `LIVE-001` scoped to runtime ownership architecture. Do not absorb the hidden runtime RPC module-selection cleanup already owned by `CTX-001`, socket error formatting owned by `SOCK-003`, or live-session topic work owned by `SOCK-002`.

**Stage 3 scan findings:**

Scan commands run on 2026-05-24:

- `rg -n 'SessionOwnership|LiveSessionRuntimeOwner|live_session_runtime_owners|owned_by_remote|lease_|heartbeat|runtime_rpc|remote_(lookup|join|live_session_state_snapshot)|lookup_session_server|start_session_server|stop_session_server|join_session_server|SessionRegistry|SessionDynamicSupervisor|peer_runtime|runtime_partition|live_runtime_drill' lib test priv config docs --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'Registry|DynamicSupervisor|:global|:pg|Node\.|:erpc|PeerRuntimeHelper|disconnect_peer|await_peer_disconnected' lib test config --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'SessionOwnership\.(claim|refresh|release|get_owner)|LiveSessionRuntimeOwner|live_session_runtime_owners' lib test priv docs/release --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'lookup_session_server|start_session_server|stop_session_server|join_session_server|remote_lookup_session_server|remote_join_session_server|remote_live_session_state_snapshot|live_session_state_snapshot\(|active_runtime_participants|active_viewer_count' lib/live_canvas test/live_canvas test/live_canvas_web test/integration --glob '!deps/**' --glob '!_build/**'`
- `rg -n 'lease_ttl_seconds|lease_heartbeat_interval_ms|runtime_rpc_timeout_ms|peer_runtime|live_runtime_drill|owner heartbeat|lease owner|failover|partition' config lib test docs/release docs/plans/archive/completed/release --glob '!deps/**' --glob '!_build/**'`

Findings:

- The exact Postgres ownership target is concentrated in `LC.Live.SessionOwnership`, `LCSchemas.Live.LiveSessionRuntimeOwner`, and `priv/repo/migrations/20260303230000_create_live_session_runtime_owners.exs`. The table enforces one row per `live_session_id`, stores `owner_node`, `lease_expires_at`, and `heartbeat_at`, and uses a `FOR UPDATE` row lock during claims so two nodes cannot both win the same lease window.
- `LC.Live.SessionOwnership` exposes the current ownership protocol: `claim/3`, `refresh/3`, `release/2`, and `get_owner/2`. Stage 7 must replace or deliberately drop each semantic: first claim, active remote-owner rejection, expired-owner takeover, active-owner refresh, owner-scoped release, stale/expired owner lookup, and app-configured TTL.
- `LC.Live.SessionSupervisor` is the main coupling point between ownership and runtime processes. It claims ownership before starting a runtime child, releases ownership on stop/start failure, compares the local Registry process with the active owner lookup, terminates stale local runtimes when the owner no longer matches, and maps refresh failures to `:lost_ownership`.
- `LC.Live.SessionServer` is not Postgres-specific, but it consumes the lease heartbeat callback and stops itself with `:lost_ownership` when the callback can no longer prove ownership. An OTP-native design can probably keep the callback shape, but Stage 7 must decide what proof of ownership replaces `SessionOwnership.refresh/3`.
- The app already has a local OTP runtime registry: `LC.Live.SessionSupervisor` owns `LC.Live.SessionRegistry` and `LC.Live.SessionDynamicSupervisor`, and `LC.Live.SessionServer` registers via `{:via, Registry, {registry, session_id}}`. This is node-local only today; Stage 7 must not mistake it for a distributed single-owner mechanism by itself.
- The public `LC.Live` context depends on ownership in several behaviorally important paths:
  - `start_live_session/2` starts a runtime immediately after inserting the persisted session.
  - `ensure_session_server/1` routes to a local runtime, returns a remote target for `{:owned_by_remote, owner_node}`, or starts a new local runtime with `active_runtime_participants/1` rehydration when no runtime exists.
  - `join_live_session/4` couples durable participant upsert to successful local or remote runtime admission, including one retry for remote `:not_found`.
  - `leave_live_session/2` marks durable participants left and prunes local runtime membership on a best-effort basis.
  - `end_live_session_with_transition/2` tears down runtime state through `SessionSupervisor.stop_session_server/1`.
  - `live_session_state_snapshot/2` reads local runtime viewer counts, remote runtime snapshots, or durable active viewer rows depending on runtime availability and transport outcomes.
- Remote routing currently depends on `owner_node` string values plus `LC.Live.RuntimeRPC`. `RuntimeRPC` resolves `owner_node` against `[Node.self() | Node.list()]` and calls `LC.Live.remote_lookup_session_server/1`, `remote_join_session_server/3`, or `remote_live_session_state_snapshot/1` through `:erpc`. Stage 7 should decide whether an OTP-native ownership layer still needs explicit remote RPC calls, whether ownership directly returns pids, or whether call routing moves behind a new runtime locator.
- `CTX-001` owns the hidden runtime RPC module-selection cleanup. `LIVE-001` should preserve that boundary: Stage 7 can mention remote routing implications, but should not re-plan `runtime_rpc_module/1` unless `CTX-001` has already implemented or removed that seam.
- Test coverage that must be carried forward or deliberately rewritten:
  - `test/live_canvas/live/session_ownership_test.exs` covers first claim, active remote-owner rejection, expired takeover, refresh, owner-scoped release, and row cleanup.
  - `test/live_canvas/live/session_supervisor_test.exs` covers local claim/start, active remote-owner rejection, expired takeover, stale local runtime termination, release-on-stop, heartbeat refresh, and shutdown after ownership loss.
  - `test/live_canvas/live/distributed_runtime_test.exs` covers remote lookup/join routing, timeout/not-found normalization, retry on remote-not-found, no durable participant on failed remote join, stale local runtime routing to remote owner, and remote state snapshots.
  - `test/live_canvas/live_test.exs` covers runtime lookup after start, viewer-count snapshots, durable participant fallback when runtime is missing, runtime shutdown on end, participant rehydration when recreating a missing runtime, and leave cleanup.
  - `test/live_canvas_web/channels/live_session_channel_test.exs` covers remote-owned channel joins, remote not-found/timeout redaction, telemetry reasons, and runtime shutdown after lost ownership.
  - `test/integration/live/runtime_partition_rejoin_test.exs` plus `test/support/live/peer_runtime_helper.ex` cover real peer-node partition behavior, remote unreachability, manual lease removal, and local takeover/rejoin.
- Release and operator material currently assumes the lease model. `lib/live_canvas/release/live_runtime_drill.ex`, `lib/mix/tasks/release.live_runtime_drill.ex`, `docs/release/live-runtime-failover-drills.md`, and `docs/release/deployment-gates.md` refer to capturing lease owner, forcing owner flip, and verifying owner heartbeat. Stage 7 must plan matching operator evidence for the OTP-native design.
- Data/governance documentation currently includes `live_session_runtime_owners` in the Live data family (`docs/release/compliance-data-governance.md`). If Stage 8 removes the table, the implementation plan must include schema/data-retention doc updates, even though backend-lane workers should not edit shared/coordinator docs unless explicitly assigned.
- No existing production code uses `:global` or `:pg` for live-session ownership. The only current OTP ownership machinery is the local Registry/DynamicSupervisor pair and distributed Erlang calls through `:erpc`.
- Similar DB-lease patterns exist outside this issue only as general infrastructure, not live runtime ownership: `LC.Infra.AsyncJobs` uses row locks for due-job claiming. Stage 3 does not treat that as part of `LIVE-001`; it is a different durable work-queue pattern.

Stage 3 watchpoints to carry into Stage 7:

- Stage 7 must choose a concrete ownership primitive, not just say "OTP-native." It should compare at least local Registry-only, `:global`, `:pg` plus a separate single-owner process, and direct distributed Erlang process ownership.
- Preserve or explicitly replace these user-visible behaviors: no split-brain runtime admission, reconnect-safe join after owner loss, no durable participant row on failed remote runtime admission, viewer-count fallback semantics, ended-session zero viewers, channel error redaction, and remote snapshot behavior.
- Decide whether the product still supports independent BEAM nodes that share Postgres but are not in one connected Erlang cluster. If yes, a purely OTP-native owner cannot replace the current table without changing the deployment contract.
- Plan the migration/removal path for `live_session_runtime_owners` only in Stage 7/8. Stage 3 does not remove schemas, migrations, retention references, release runbooks, or tests.
- Keep release drill and peer-runtime verification in scope for the eventual Stage 8 plan. The old lease-owner drill cannot remain the final operator evidence if ownership is no longer stored in Postgres.

**Evidence seen:**

- `lib/live_canvas_schemas/live/live_session_runtime_owner.ex` models the ownership table.
- `lib/live_canvas/live/session_ownership.ex` claims, refreshes, releases, and looks up leases.
- `lib/live_canvas/live/session_supervisor.ex` uses ownership results to decide whether the local node can own a session.
- `lib/live_canvas/live.ex` handles `{:owned_by_remote, owner_node}` and calls remote runtime RPC.
- Tests cover remote ownership and partition/rejoin behavior.

**What likely needs to change:**

- Clarify deployment assumptions: single node, distributed BEAM cluster, multi-node with shared Postgres, or future autoscaling.
- Compare OTP-native options such as local Registry, distributed Erlang, `:global`, `:pg`, or a supervised process per session against current Postgres lease semantics.
- Write a replacement plan for ownership lookup, failover, viewer counts, remote state snapshots, operator drills, and any schema/data-governance cleanup needed if the Postgres table is removed.

**Stage 7 fix and prevention plan:** Written on 2026-05-24; finalized on 2026-05-29 after Kubernetes and future runtime-tree discussion.

Final production architecture choices:

- Remove Postgres-backed live runtime ownership from the realtime path. Do not replace it with Postgres advisory locks or another ownership table. Swarm is also excluded.
- Use `libcluster` as the default Kubernetes cluster-discovery dependency. The target deployment should use a headless Service, long node names, a shared Erlang cookie from Kubernetes Secret material, a fixed distribution port range, and NetworkPolicy that allows distribution traffic only between runtime-capable backend pods. `DNSCluster` remains an acceptable simpler fallback only if Stage 8 proves `libcluster` is unnecessary for the deployment.
- Do not globally register every live session, chat room, or game process. Per-session `:global` registration is too much global name churn for the future product and gives too little room for placement policy.
- Introduce a `LC.RealtimeRuntime` boundary as the product-owned runtime-control layer. It owns cluster discovery integration, shard ownership, runtime lookup, drain state, and routing to locally supervised runtime processes.
- Use strict shard ownership as the authoritative distributed boundary. Each shard owns a stable subset of live sessions, chat rooms, game rooms, and media-control processes. The first implementation may use `:global` for shard-owner processes, but `:global` should be limited to a small fixed shard-owner set, not one name per runtime.
- Under each shard owner, use ordinary local OTP building blocks: local `Registry`, `DynamicSupervisor`, and focused supervisors for session/chat/game/media children. Local child trees are cheaper, easier to test, and avoid distributed registry churn for every participant-facing process.
- Use Syn only for non-authoritative directory, metadata, and process-group use cases. Good candidates include runtime directory hints, feature scopes such as `:live`, `:games`, and `:media`, session process groups, chat membership metadata, and broadcast/routing hints. Syn must not be the only thing preventing two authoritative runtimes from existing.
- Use Horde only for soft, restartable, duplicate-tolerant work. Good candidates include media helper workers, matchmaking/lobby helpers, background runtime maintenance, and non-authoritative per-session adjunct workers. Do not put `SessionCoordinator`, authoritative `GameRuntime`, or any writer that can admit participants or commit game state directly under Horde unless a later plan adds explicit fencing/idempotency that makes duplicate owners harmless.
- Keep Phoenix PubSub and Presence as the fanout and socket presence layer. Chat delivery, socket subscriptions, and presence should not be funneled through one owner process when PubSub/Presence can do the transport fanout.
- Treat video media pipelines as local heavy workers coordinated by the runtime tree, not as globally movable ordinary GenServers. The BEAM runtime should own signaling/control and supervise or reference Membrane/WebRTC-style media workers; draining pods should stop admitting new media work and let existing pipelines end or reconnect according to product policy.
- Runtime failover is fail-closed and reconnect-driven for authoritative state. During partitions or uncertain ownership, authoritative sessions/games should reject admission or surface `session_unavailable` rather than accepting duplicate writers. Recovery should rehydrate safe durable state when a shard/routing owner is available again.

Target production process tree:

```text
LC.Application
  ClusterDiscovery
    libcluster topologies
    ClusterHealth / DrainState
  Phoenix.PubSub
  LCWeb.Endpoint
  LC.RealtimeRuntime.Supervisor
    ShardDirectory
    ShardOwnerSupervisor
      ShardOwner[0..N]
        LocalRuntimeRegistry
        LocalRuntimeDynamicSupervisor
          SessionRuntimeSupervisor(session_id)
            SessionCoordinator
            ChatRoomRuntime
            GameRuntime(s)
            MediaOrchestrator
            PresenceBridge
        SoftWorkerSupervisor
          Horde-managed duplicate-tolerant helpers only, if added
```

Stage 8 first-slice fix scope:

- Keep Stage 8 focused on replacing the current Postgres lease owner path for live-session runtimes. Do not attempt to build every future game/media feature in this cleanup issue.
- Add the minimum `libcluster` dependency and Kubernetes topology configuration needed for runtime-capable backend pods to form a connected BEAM cluster. If the deployment chooses `DNSCluster` instead, record the reason in this section before implementation.
- Add a small top-level `LC.RealtimeRuntime` boundary. The first slice should expose APIs equivalent to the current live-session runtime needs: start or ensure runtime, lookup runtime, join runtime, stop runtime, and state snapshot routing.
- Add a shard-owner abstraction even if the first implementation uses one shard. The API should make the shard key explicit so later game/chat/media work can add more shards without redesigning ownership again.
- Use strict shard ownership for the shard process. If `:global` is used in Stage 8, it should name only shard owners such as `{LC.RealtimeRuntime.ShardOwner, shard_id}`. Do not introduce `:global` names for every `session_id`.
- Move live-session runtime children under a shard-local registry and dynamic supervisor. The existing `LC.Live.SessionServer` can remain the first runtime child type, but its distributed identity must come through the shard directory/owner rather than a Postgres row or per-session global name.
- Replace `LC.Live.SessionOwnership.claim/3`, `refresh/3`, `release/2`, and `get_owner/2` call paths with `LC.RealtimeRuntime` routing. Remove Postgres lease calls from `LC.Live.SessionSupervisor` and any runtime heartbeat that only proves database lease ownership.
- Keep `LC.Live.ensure_session_server/1`, `join_live_session/4`, `leave_live_session/2`, `live_session_state_snapshot/2`, and channel error behavior public-compatible. Remote or uncertain ownership must still fail closed and avoid durable participant rows for failed runtime admission.
- Keep `LC.Live.RuntimeRPC` only if the first `LC.RealtimeRuntime` slice still needs explicit remote calls. Do not redesign the hidden runtime-RPC module-selection seam here; `CTX-001` owns that cleanup. If the new runtime layer makes `RuntimeRPC` obsolete, remove it and mark the `CTX-001` seam obsolete in this inventory.
- Remove `lib/live_canvas_schemas/live/live_session_runtime_owner.ex` from the runtime schema set and add a migration that drops `live_session_runtime_owners`. Keep the historical create migration file intact.
- Remove `config :live_canvas, LC.Live.SessionOwnership, lease_ttl_seconds: ...` and lease-heartbeat config that exists only for the Postgres owner model.
- Update release/operator material to verify cluster discovery, shard ownership, drain behavior, fail-closed joins during owner uncertainty, takeover/reconnect behavior, and absence of ghost participants. Do not leave lease-owner drill language as the final operator evidence.
- Update data-governance references in `docs/release/compliance-data-governance.md` to remove `live_session_runtime_owners` from the Live data family. If Stage 8 execution is not authorized to edit release/compliance docs, record the exact coordinator repair instead.

Focused test updates:

- Replace `test/live_canvas/live/session_ownership_test.exs` with focused `LC.RealtimeRuntime` ownership tests:
  - shard key calculation is stable for a session ID;
  - missing shard/runtime lookup returns `{:error, :not_found}`;
  - a locally owned shard can start and find a session runtime;
  - duplicate start for the same session routes to the existing local runtime;
  - uncertain or remote shard ownership returns a remote/unavailable result without starting a duplicate local runtime.
- Update `test/live_canvas/live/session_supervisor_test.exs` so it no longer mutates `LiveSessionRuntimeOwner` rows. Keep local runtime lifecycle coverage, but make the ownership setup go through the shard runtime layer.
- Remove Postgres lease heartbeat tests. If the shard owner has its own health assertion or drain behavior, test that directly under `LC.RealtimeRuntime`.
- Update `test/live_canvas/live/distributed_runtime_test.exs` to seed remote or unavailable shard ownership through the runtime layer instead of `SessionOwnership.claim/3`. Keep the existing API expectations: remote lookup/join routing, timeout/not-found normalization, retry on remote not found when still applicable, no durable participant row on failed remote join, and remote snapshot behavior.
- Update `test/live_canvas/live_test.exs` to preserve runtime lookup after start, viewer-count snapshots, durable participant fallback when runtime is missing, runtime shutdown on end, participant rehydration when recreating a missing runtime, and leave cleanup.
- Update `test/live_canvas_web/channels/live_session_channel_test.exs` to preserve remote/unavailable channel joins, remote not-found/timeout redaction, telemetry reasons, and shutdown/end-session behavior without DB lease setup.
- Rewrite `test/integration/live/runtime_partition_rejoin_test.exs` around shard ownership and Kubernetes-like peer behavior: a peer-owned shard/runtime accepts local routing through the runtime layer, a disconnected or draining owner fails closed and does not persist a participant, and takeover/reconnect rehydrates durable participants without duplicate runtime owners.
- Update `test/support/live/peer_runtime_helper.ex` only as needed to start runtime-capable peer nodes, wait for cluster discovery, wait for shard ownership, and simulate drain/partition behavior.

Prevention checks:

- Add a backend convention note during Stage 8, preferably under `docs/architecture/conventions.md`, stating that realtime runtime ownership is shard-owned and OTP-native: Postgres, Swarm, Syn, and Horde must not be used as the authoritative owner for live sessions or game rooms; Syn is directory/group metadata only; Horde is duplicate-tolerant worker supervision only.
- After editing, run `rg -n 'LiveSessionRuntimeOwner|live_session_runtime_owners|SessionOwnership\\.(claim|refresh|release|get_owner)|lease_ttl_seconds|lease_heartbeat' lib test config docs/release priv/repo/migrations --glob '!deps/**' --glob '!_build/**'`. Expected remaining hits should be limited to the historical create migration, the new drop migration, and explicitly retained historical references.
- Run `rg -n ':global|Horde|Syn|syn|LC\\.RealtimeRuntime|owned_by_remote' lib test config --glob '!deps/**' --glob '!_build/**'` and confirm `:global`, if present, is limited to shard ownership; Horde is not used for authoritative runtimes; Syn is not used as an ownership gate.
- Run `rg -n 'runtime_rpc_module\\(|RuntimeRPC|remote_(lookup|join|live_session_state_snapshot)' lib/live_canvas test/live_canvas --glob '!deps/**' --glob '!_build/**'` and account for whether `RuntimeRPC` remains a transitional routing adapter or has become obsolete.
- Run `mix ecto.migrate` in the test database path used by this repo before focused tests if the new drop-table migration changes schema setup behavior.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas/live/session_ownership_test.exs test/live_canvas/live/session_supervisor_test.exs test/live_canvas/live/session_server_test.exs test/live_canvas/live/distributed_runtime_test.exs test/live_canvas/live_test.exs test/live_canvas_web/channels/live_session_channel_test.exs`
- `mix test test/integration/live/runtime_partition_rejoin_test.exs --include peer_runtime`
- `mix test test/live_canvas/release/live_runtime_drill_test.exs`
- `mix boundary.spec`
- `mix typecheck`

Stage 3 watchpoints to carry into Stage 8:

- Preserve no split-brain admission for connected BEAM-cluster nodes by using strict shard ownership rather than eventually consistent per-runtime ownership.
- Preserve reconnect-safe join after owner loss by rehydrating active durable participants when no authoritative runtime exists.
- Preserve the invariant that failed remote or unavailable runtime admission does not leave a durable active participant row.
- Preserve viewer-count fallbacks: local runtime count when available, remote/runtime-layer snapshot when reachable, durable active viewer count when no runtime exists or remote runtime is not found, and deterministic zero when remote transport fails.
- Preserve ended-session zero-viewer behavior and channel error redaction. Client-facing remote or uncertain runtime failures should still collapse through `SOCK-003` rules to `"session_unavailable"`.
- Do not broaden into `SOCK-002` topic cleanup, `SOCK-003` reason-code formatting, `GEN-001` chat event redesign, or `CTX-001` hidden runtime-RPC module-selection cleanup except for deleting truly orphaned runtime-RPC code after ownership no longer calls it.

**Where to look first:**

- `lib/live_canvas/live/session_ownership.ex`
- `lib/live_canvas/live/session_supervisor.ex`
- `lib/live_canvas/live/runtime_rpc.ex`
- `lib/live_canvas/live.ex`
- `lib/live_canvas_schemas/live/live_session_runtime_owner.ex`
- `test/live_canvas/live/session_ownership_test.exs`
- `test/live_canvas/live/session_supervisor_test.exs`
- `test/live_canvas/live/distributed_runtime_test.exs`
- `test/integration/live/runtime_partition_rejoin_test.exs`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request for `LIVE-001`.

### DOC-001 - Task-Specific Information In General Convention Docs

**User concern:** Remove task-specific info from general files like `conventions.md`.

**Initial assessment:** Valid. The convention doc currently includes a `Progress` checklist and `Planned Refactors` section. Those are task/lane tracking concerns rather than durable conventions. The conventions file exists in this repo at `docs/architecture/conventions.md`, but DOC-001 changes should still wait for Stage 2 validation before editing that general standards document.

**Evidence seen:**

- `docs/architecture/conventions.md` contains a progress checklist.
- The same file has a `Planned Refactors` section pointing to remaining convention migrations.
- Durable rules such as timestamp type, token hashing, Relay-first GraphQL, and GraphQL authz should remain in a conventions doc.
- Rechecked on 2026-05-29: the current `docs/architecture/conventions.md` still contains a `Progress` section with completed task checkboxes and a `Planned Refactors` section that points to plan work, alongside durable backend standards.

**Stage 2 decision:** Marked valid on 2026-05-29. The core complaint is current and valid: `docs/architecture/conventions.md` should be a durable standards document, not a lane/task status document. The cleanup should remove or relocate completed-work checklist content and planned-refactor tracking while preserving stable backend standards such as timestamp type, token hashing, ID shape, typespec expectations, Relay-first GraphQL, and resolver authorization rules. Do not use this issue to rewrite the conventions themselves or to reopen completed convention-alignment work.

**What likely needs to change:**

- Move progress/checklist content out of general conventions into plan/status docs.
- Keep stable backend standards in conventions.
- Add any new standards from this cleanup only after discussion and validation.
- During Stage 3, scan only the conventions document and directly related status/plan references needed to decide whether the task-specific content should be deleted outright or moved into a plan/handoff doc.

**Stage 3 scan commands:**

- `rg --files docs/architecture docs/plans/conventions docs/plans/backend | sort`
- `rg -n "^## Progress$|^## Planned Refactors$|^- \\[[ xX]\\]|remaining convention|convention migrations|completed|TODO|Task|Stage|current batch|handoff|Status:" docs/architecture docs/plans/conventions docs/plans/backend --glob '*.md'`
- `sed -n '1,260p' docs/plans/conventions/2026-03-02-conventions-alignment-design.md`
- `sed -n '1,120p' docs/architecture/conventions.md`

**Stage 3 scan findings:**

- `docs/architecture/conventions.md` is the only general architecture/conventions file in scope.
- The exact task-specific content in that general document is `docs/architecture/conventions.md` lines 3-13 (`Progress` with completed work checkboxes) and lines 36-38 (`Planned Refactors` pointing readers to remaining convention migrations).
- `docs/plans/conventions/2026-03-02-conventions-alignment-design.md` also has planned-change language, but it is a dated design/plan record, so that status language belongs there and is not a `DOC-001` cleanup target.
- `docs/plans/backend/NOW.md` and this cleanup inventory contain status, stage, handoff, and checklist language by design. They are the appropriate places for task tracking and should not be treated as violations of `DOC-001`.
- `docs/plans/backend/2026-03-25-elixir-backend-starter-kit-extraction-plan.md` has an execution checklist, but it is a backend plan, not a durable conventions document.
- The durable standards currently mixed into `docs/architecture/conventions.md` are still legitimate convention content: SHA3 token hashing, `:utc_datetime_usec`, bigint plus `entropy_id`, `users_tokens` as the UUID-primary-key exception, public-function typespec expectations, `mix typecheck`, Relay-first GraphQL, and GraphQL authorization checks.

Stage 3 exact cleanup scope:

- Remove the `Progress` checklist from `docs/architecture/conventions.md`.
- Remove the `Planned Refactors` section from `docs/architecture/conventions.md` unless Stage 7 finds a durable, non-status replacement sentence is necessary.
- Preserve the durable `Data And Security`, `Types And Verification`, and `GraphQL And Relay` convention rules. Do not use this issue to rewrite those conventions.
- Do not move the completed checklist into another active handoff doc unless Stage 7 proves there is still live status that is not already captured by dated plan records or lane handoffs.

Stage 3 watchpoints to carry into Stage 7:

- Keep `docs/architecture/conventions.md` as a standards document, not a queue, migration tracker, or completion ledger.
- If Stage 7 adds a prevention note, make it a durable documentation-hygiene rule rather than a new task-specific checklist.
- Avoid editing coordinator-owned `docs/plans/NOW.md` or `docs/plans/INDEX.md`; report any shared repair instead.
- Keep `docs/plans/conventions/2026-03-02-conventions-alignment-design.md` as historical evidence unless Stage 7 identifies a specific stale pointer that must be corrected.

**Stage 7 fix and prevention plan:** Written on 2026-05-29.

Stage 8 fix scope:

- Keep the implementation docs-only. Do not edit backend implementation code, schema files, migrations, release runbooks, or coordinator-owned `docs/plans/NOW.md` / `docs/plans/INDEX.md` for `DOC-001`.
- In `docs/architecture/conventions.md`, remove the `## Progress` section and its completed-work checklist. Those items are a historical completion ledger, not durable backend standards.
- In the same file, remove the `## Planned Refactors` section and its pointer to convention-migration plans. Future work belongs in dated plans, lane `NOW.md` files, this cleanup inventory, or coordinator-owned planning docs.
- Preserve the durable `Data And Security`, `Types And Verification`, and `GraphQL And Relay` sections as standards content. Do not rewrite those conventions while fixing `DOC-001`.
- Add a short durable `Documentation Hygiene` section near the top of `docs/architecture/conventions.md` with rules equivalent to:
  - Keep architecture convention documents limited to stable standards, invariants, and cross-cutting rules.
  - Keep task status, completion ledgers, current batches, and planned-refactor tracking in `docs/plans/**` or lane `NOW.md` files.
- Do not move the removed checklist into another active handoff doc. The completed status is already represented by the dated convention plan history, this cleanup inventory, and lane status docs.
- Leave `docs/plans/conventions/2026-03-02-conventions-alignment-design.md` unchanged unless Stage 8 discovers a broken link caused by the conventions-doc edit.

Prevention checks:

- After editing, run `rg -n "^## Progress$|^## Planned Refactors$|^- \\[[ xX]\\]|remaining convention|convention migrations|completed|TODO|Task|Stage|current batch|handoff|Status:" docs/architecture/conventions.md` and expect no matches.
- Run `sed -n '1,80p' docs/architecture/conventions.md` and confirm the first sections are durable standards or documentation-hygiene rules, not task progress.
- Run `git diff --check docs/architecture/conventions.md docs/plans/backend/2026-05-22-code-quality-cleanup.md docs/plans/backend/NOW.md`.

Verification for Stage 8:

- No Mix compile or test run is required for this docs-only cleanup unless Stage 8 unexpectedly touches implementation code.
- If implementation code is touched despite the intended scope, stop and re-scope before continuing; typed code would require `mix typecheck` under `AGENTS.md`.

Stage 3 watchpoints to carry into Stage 8:

- Do not reintroduce task-tracking material into `docs/architecture/conventions.md` as a replacement paragraph.
- Keep coordinator-owned shared planning docs untouched from the backend lane; report any needed shared-dashboard repair instead.
- Preserve the convention standards exactly unless a separate issue's Stage 8 plan explicitly changes them.

**Where to look first:**

- `docs/architecture/conventions.md`
- `docs/plans/conventions/2026-03-02-conventions-alignment-design.md`
- `docs/plans/backend/NOW.md`

**Progress:**

- Stage 1: Complete.
- Stage 2: Complete; marked valid.
- Stage 3: Complete.
- Stage 4: Complete as the global agent-led scan; no per-issue action pending.
- Stage 5: Not applicable; this is a user-reported issue.
- Stage 6: Not applicable; this is a user-reported issue.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request for `DOC-001`.

## Stage 4 Agent-Led Quality Scan

Stage 4 was run on 2026-05-22 using `GQL-001` as the current valid calibration point: remove resolver-only formatting, avoid context-specific presentation helpers when the framework or a shared boundary can own them, and flag repeated shaping/parsing code that is likely to drift.

Scan commands:

- `rg -n "Date\\.to_iso8601|NaiveDateTime\\.to_iso8601|Time\\.to_iso8601|to_iso8601\\(" lib/live_canvas_gql lib/live_canvas lib/live_canvas_web lib/live_canvas_schemas`
- `rg -n "defp (format_|.*_view|.*_payload|.*_response|.*_details|.*_field|.*_error|.*_topic|.*_id|.*_key|camelize|value_for|metadata|visible_body|system_event|parse_)" lib/live_canvas_gql lib/live_canvas lib/live_canvas_web`
- `rg -n "DateTime\\.to_iso8601|Date\\.to_iso8601|Atom\\.to_string|to_string\\(|Macro\\.camelize|Map\\.get" lib/live_canvas_gql lib/live_canvas lib/live_canvas_web`
- `rg -n "Application\\.get_env|Application\\.put_env|Keyword\\.get\\(opts|opts\\[:|runtime_.*module|_module\\(opts|adapter|impl" lib/live_canvas test/live_canvas test/live_canvas_web`
- `rg -n "TODO|FIXME|HACK|temporary|workaround|for now|until|stub|fake|hardcod|slop|hack" lib test docs/plans/backend/2026-05-22-code-quality-cleanup.md`
- `wc -l lib/live_canvas_gql/*/*_resolver.ex lib/live_canvas/live.ex lib/live_canvas/accounts.ex lib/live_canvas/content/media_processing_job.ex lib/live_canvas/infra/data_governance/*.ex lib/live_canvas_web/channels/live_session_channel.ex`

### GQL-008 - Contact-Match Field Resolvers Only Project Nested Contact-Entry Data

**Stage 4 finding:** `contact_match` fields use dedicated GraphQL resolvers to pull nested fields from `contact_entry`; one also manually converts a `Date` to a string.

**Initial assessment:** Partially valid. This is similar to `GQL-001` because `contact_match_birthday/3` only handles nil and `Date.to_iso8601/1`, which Absinthe string serialization can own. It is not exactly the same issue, because the parent shape is a contact-match projection containing a nested `contact_entry`, so the GraphQL boundary still needs to flatten the domain view shape somewhere.

**Stage 5 decision:** Marked partially valid on 2026-05-22. Keep the Accounts context return shape as a domain contact-match map with nested `contact_entry`, but flatten `contact_name` and `birthday` into the GraphQL-facing contact-match node in `contact_match_node/1`. Then make the GraphQL fields direct `:string` fields and remove `contact_match_name/3` and `contact_match_birthday/3`.

**Evidence seen:**

- `lib/live_canvas_gql/accounts/account_types.ex` defines `contact_name` and `birthday` on `:contact_match` with resolver functions.
- `lib/live_canvas_gql/accounts/account_resolver.ex` has `contact_match_name/3` and `contact_match_birthday/3`; the birthday resolver only handles nil and calls `Date.to_iso8601/1`.

**Practical options recorded during Stage 5:**

- Keep the Accounts context shape unchanged.
- Flatten `contact_name` and `birthday` into the GraphQL-facing contact-match node in `contact_match_node/1`.
- Make `contact_name` and `birthday` direct `:string` fields and remove the dedicated field resolvers.

**Stage 6 scan findings:**

Scan commands run on 2026-05-22:

- `rg -n "Date\\.to_iso8601|def [a-zA-Z0-9_]+\\(%\\{[a-zA-Z0-9_]+: %\\{[a-zA-Z0-9_]+: [a-zA-Z0-9_]+\\}\\}|def [a-zA-Z0-9_]+\\(%\\{[a-zA-Z0-9_]+: %\\{id: _id\\}" lib/live_canvas_gql`
- `rg -n "field :[a-zA-Z0-9_]+, :string do|field :[a-zA-Z0-9_]+, non_null\\(:string\\) do|resolve\\(&Resolver\\.[a-zA-Z0-9_]+/3\\)" lib/live_canvas_gql/accounts/account_types.ex lib/live_canvas_gql/content/content_types.ex lib/live_canvas_gql/feed/feed_types.ex lib/live_canvas_gql/chat/chat_types.ex lib/live_canvas_gql/social/social_types.ex`

Findings:

- Exact `GQL-008` scope remains limited to contact-match projection: `contact_match_name/3` and `contact_match_birthday/3` are the only GraphQL resolvers found that simply project nested scalar data from a nested map and manually stringify a `Date`.
- Similar nested association resolvers found in `chat_message_sender/3`, `follow_request_follower/3`, `Feed.Resolver.host/3`, and `Content.Resolver.author/3` return associated user/media structs, not nested scalar fields. Treat those under `GQL-007` rather than this issue.
- Other `:string` fields with resolvers in the scan are already covered by `GQL-001` timestamp cleanup, ID/global-ID formatting, public URL generation, or chat/system-event projection.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Keep the Accounts context return shape unchanged. `LC.Accounts.list_user_contact_matches/1` and `LC.Accounts.get_user_contact_match/2` should continue returning the domain contact-match map with `:contact_entry` and `:matched_users`; do not move GraphQL projection into the Accounts context for this cleanup.
- Keep the public GraphQL API unchanged: `ContactMatch.contactName` and `ContactMatch.birthday` remain nullable string fields, `ContactMatch.matchedUsers` remains a non-null list of users, and contact-match Relay IDs continue to be based on the contact-entry id.
- In `lib/live_canvas_gql/accounts/account_types.ex`, change `field :contact_name, :string` and `field :birthday, :string` to direct field declarations. Remove the dedicated `resolve(&Resolver.contact_match_name/3)` and `resolve(&Resolver.contact_match_birthday/3)` blocks.
- In `lib/live_canvas_gql/accounts/account_resolver.ex`, make `contact_match_node/1` the single GraphQL projection point for contact-match nodes. It should preserve the existing `:id`, `:contact_entry`, and `:matched_users` data needed by current type resolution while adding top-level `:contact_name` and `:birthday` from `contact_entry`.
- Change `contact_match_node/1` from private to public so `lib/live_canvas_gql/schema.ex` can reuse the same projection for `node(id:)` refetches. Keep the public API narrow, with a typespec returning the existing `contact_match_node()` type.
- Update `@type contact_match_node` so typechecking reflects the flattened GraphQL shape: include `contact_name: String.t() | nil` and `birthday: Date.t() | nil`, keep `id: pos_integer()` and `matched_users: [User.t()]`, and keep `contact_entry: map()` while `schema.ex` still uses map-key type resolution for contact matches.
- In `lib/live_canvas_gql/schema.ex`, update `fetch_contact_match_node/2` so a successful `Accounts.get_user_contact_match/2` result is passed through the same contact-match projection before being returned. This is required because direct fields on `node(id:) { ... on ContactMatch }` will no longer reach through `contact_entry`.
- Remove `contact_match_name/3` and `contact_match_birthday/3` plus their specs from `lib/live_canvas_gql/accounts/account_resolver.ex`.
- Do not alter contact matching queries, contact-entry persistence, matched-user lookup, contact invite delivery, contact upsert validation, or the viewer-scoped authorization in `fetch_contact_match_node/2`.
- Do not change `LCGQL.Schema` contact-match `resolve_type` beyond what is necessary to keep the flattened map working; broader node/type resolution cleanup is tracked by `GQL-006`.
- Do not touch timestamp `DateTime.to_iso8601/1` resolver cleanup in this issue. `GQL-008` only removes the contact-match `Date.to_iso8601/1` field resolver by letting the direct `:string` field serialize the date value.

Focused test updates:

- In `test/live_canvas_gql/accounts/contact_queries_test.exs`, add `birthday` to the `viewerContactMatches` query and give at least one imported contact a birthday such as `"1990-02-15"`. Assert the GraphQL result still returns that string after the field becomes direct.
- In `test/live_canvas_gql/relay/node_queries_test.exs`, add `birthday` to the viewer-owned contact-match node refetch query and create the contact entry with a birthday. Assert both `contactName` and `birthday` survive the node refetch path.
- Keep the existing `test/live_canvas_gql/accounts/account_mutations_test.exs` coverage for `upsertViewerContactEntry` returning `contactMatch { contactName birthday matchedUsers }`; it remains the mutation-path regression guard.
- Do not add unit tests for resolver-private projection details unless the projection is moved to a dedicated public module. Prefer public GraphQL tests for this cleanup.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md` -> `GraphQL And Relay`: GraphQL field resolvers should not exist only to reach through a nested map and return a scalar, or only to stringify `Date`/`DateTime` values. Flatten GraphQL-facing projection data once at the boundary, then use direct fields when scalar serialization is sufficient.
- After editing, run `rg -n "contact_match_(name|birthday)|Date\\.to_iso8601" lib/live_canvas_gql/accounts test/live_canvas_gql/accounts test/live_canvas_gql/relay` and expect no `contact_match_name/3`, `contact_match_birthday/3`, or contact-match `Date.to_iso8601/1` hits.
- Run `rg -n "field :(contact_name|birthday), :string do|contactMatch.*birthday|birthday" lib/live_canvas_gql/accounts test/live_canvas_gql/accounts test/live_canvas_gql/relay` and confirm the schema fields are direct and the public GraphQL paths still assert birthday output.
- Run `rg -n "contact_match_node|fetch_contact_match_node" lib/live_canvas_gql/accounts/account_resolver.ex lib/live_canvas_gql/schema.ex` and confirm both viewer contact-match connections and Relay node refetches use the same projection.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_gql/accounts/contact_queries_test.exs test/live_canvas_gql/accounts/account_mutations_test.exs test/live_canvas_gql/relay/node_queries_test.exs`
- `mix typecheck`

Stage 6 watchpoints to carry into Stage 8:

- Preserve viewer ownership checks for contact-match connections and Relay node refetch. Contact-match IDs are globally refetchable Relay IDs, so `node(id:)` must still require the owning viewer context.
- Preserve the Accounts context/domain contact-match shape; only the GraphQL-facing projection should flatten nested contact-entry scalar fields.
- Preserve matched-user output and current Relay ID semantics. `ContactMatch.id` remains the contact-entry global ID.
- Keep nested associated-object loaders and simple dataload wrappers out of this issue; those belong to `GQL-007`.

**Progress:**

- Stage 1: Not applicable; this issue was discovered during Stage 4.
- Stage 2: Not applicable; Stage 5 is the validity discussion for Stage 4 candidates.
- Stage 3: Not applicable; Stage 6 is the similar-instance scan for Stage 4 candidates.
- Stage 4: Complete; discovered and initially analyzed.
- Stage 5: Complete; marked partially valid.
- Stage 6: Complete.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GEN-002 - Repeated Atom/String Payload Extraction Helpers Across Webhook And Job Handlers

**Stage 4 finding:** Multiple backend modules repeat the same `Map.get(map, atom_key) || Map.get(map, Atom.to_string(atom_key))` pattern for boundary payloads and job payloads.

**Initial assessment:** Partially valid as a maintainability issue. Accepting both atom and string keys is often useful at JSON, webhook, async job, and internal test boundaries, but the repeated helper shape makes it unclear where payload normalization is supposed to happen and increases drift risk.

**Stage 5 decision:** Marked partially valid on 2026-05-22. Scope the first cleanup to async job and webhook payload extraction. Add a small helper for fixed known-key lookup, using an atom key plus `Atom.to_string(key)` and avoiding `String.to_atom/1`; replace exact duplicated payload integer extraction where the semantics match. Keep legitimate local attr normalization out of the first fix unless Stage 6 proves it is an exact duplicate with the same semantics.

**Evidence seen:**

- `lib/live_canvas/content/media_processing_job.ex` repeats atom/string lookup in `maybe_put_integer_attr/3`, `extract_event_payload/1`, `maybe_use_payload_as_event_payload/1`, `extract_processing_state/1`, and `extract_payload_integer/2`.
- `lib/live_canvas/infra/data_governance/export.ex` defines `extract_payload_integer/2` with the same atom/string lookup pattern.
- `lib/live_canvas/infra/data_governance/deletion.ex` defines another `extract_payload_integer/2` with the same atom/string lookup pattern.
- Related variants exist in `lib/live_canvas/chat/system_events.ex`, `lib/live_canvas/live/live_session.ex`, `lib/live_canvas/accounts.ex`, and `lib/live_canvas_web/plugs/observability_context.ex`.

**Practical options recorded during Stage 5:**

- Add a small shared helper for fixed known-key atom/string lookup where dual-key support is intentionally required.
- Replace exact duplicated async job/webhook payload integer extraction where the semantics match.
- Avoid `String.to_atom/1` for request or payload maps; derive string keys from known atom keys instead.
- Keep context-local attr normalization where the accepted payload shape or defaulting behavior differs materially.

**Stage 6 watchpoints:**

- Separate exact duplicate payload extraction from broader local attr normalization; do not collapse helpers just because they all read atom/string keys.
- Verify whether each helper treats missing, nil, zero, negative, and wrongly typed values the same way before grouping it into a shared helper.
- Watch for `String.to_atom/1` on request or payload maps and prefer known atom keys plus `Atom.to_string/1`.
- Keep external JSON/webhook boundary normalization distinct from Ecto changeset/schema attr normalization unless the semantics are identical.

**Stage 6 scan findings:**

Scan command run on 2026-05-22:

- `rg -n "value_for|fetch_attr|extract_payload_integer|Atom\\.to_string\\(|String\\.to_atom\\(" lib test`

Exact duplicate cluster for the first cleanup:

- `lib/live_canvas/content/media_processing_job.ex`: `extract_payload_integer/2` accepts atom/string keys and requires a positive integer. It is used for `:media_asset_id` and `:webhook_event_id`.
- `lib/live_canvas/infra/data_governance/export.ex`: `extract_payload_integer/2` has the same atom/string positive-integer semantics for `:data_export_request_id`.
- `lib/live_canvas/infra/data_governance/deletion.ex`: `extract_payload_integer/2` has the same atom/string positive-integer semantics for `:account_deletion_request_id`.

Related payload-boundary helpers to review during Stage 7:

- `lib/live_canvas/content/media_processing_job.ex`: `extract_event_payload/1`, `maybe_use_payload_as_event_payload/1`, `extract_processing_state/1`, and `maybe_put_integer_attr/3` use fixed atom/string key lookup with slightly different validation/default behavior.
- `lib/live_canvas_web/plugs/observability_context.ex`: `value_for/2` uses `String.to_atom/1`; the key is internally fixed, but the replacement should still prefer known atom keys plus `Atom.to_string/1` if a shared helper lands.

Local attr normalization to keep out of the first fix unless Stage 7 proves identical semantics:

- `lib/live_canvas/chat/system_events.ex`, `lib/live_canvas/chat/chat_message.ex`, `lib/live_canvas/live/live_session.ex`, and `lib/live_canvas/accounts.ex` have atom/string lookup helpers for context/schema attrs with local defaulting and validation behavior.
- `lib/live_canvas/content.ex` and `lib/live_canvas/accounts/passkeys/wax_adapter.ex` have boundary-specific atom/string lookup variants.
- `test/support/passkey_test_support.ex` has test-only adapter input lookup and should not drive production helper design.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Add a small infrastructure helper module, preferably `lib/live_canvas/infra/payload.ex` as `LC.Infra.Payload`, to own fixed known-key lookup for boundary payload maps. Keep the helper intentionally narrow: it should accept an atom key, look up the atom key and `Atom.to_string(key)`, and never call `String.to_atom/1` on external input.
- Give the helper public typespecs. Suggested API: `value_for/2` returning `term() | nil` and `positive_integer/2` returning `{:ok, pos_integer()} | {:error, :invalid_payload}`.
- Implement `positive_integer/2` with the exact semantics shared by the current duplicate helpers: missing key, `nil`, zero, negative integers, binaries, floats, and other non-positive/non-integer values all return `{:error, :invalid_payload}`; positive integers under either atom or string key return `{:ok, value}`.
- In `lib/live_canvas/content/media_processing_job.ex`, replace only the private `extract_payload_integer/2` implementation with a delegation to `LC.Infra.Payload.positive_integer/2`, or remove the private helper and call the shared helper directly from `handle_media_processing/1` and `handle_webhook_processing/1`. Preserve the current `:invalid_payload` error contract and the idempotent `nil -> :ok` behavior after `Repo.get/2`.
- In `lib/live_canvas/infra/data_governance/export.ex`, replace the private `extract_payload_integer/2` with the shared positive-integer helper for `:data_export_request_id`. Preserve `handle/1` returning `{:error, :invalid_payload}` for malformed payloads and `:ok` for missing deleted requests.
- In `lib/live_canvas/infra/data_governance/deletion.ex`, replace the private `extract_payload_integer/2` with the shared positive-integer helper for `:account_deletion_request_id`. Preserve the current request status transitions and stubbed deletion behavior.
- In `lib/live_canvas_web/plugs/observability_context.ex`, consider replacing the private `value_for/2` with `LC.Infra.Payload.value_for(params, :request_id)` and `LC.Infra.Payload.value_for(params, :trace_id)` while leaving all request-id and trace-id normalization untouched. This is the only Stage 6 watchpoint that should be folded into the first fix, because it removes `String.to_atom/1` without changing accepted keys or broadening payload semantics.
- Do not change `maybe_put_integer_attr/3`, `extract_event_payload/1`, `maybe_use_payload_as_event_payload/1`, or `extract_processing_state/1` in `LC.Content.MediaProcessingJob` unless the implementation only swaps their raw lookup expression for `LC.Infra.Payload.value_for/2` without changing validation/defaulting behavior. Their map/nested-payload and metadata semantics are not the exact positive-integer duplicate.
- Do not change `LC.Chat.SystemEvents`, `LC.Chat.ChatMessage`, `LC.Live.LiveSession`, `LC.Accounts`, `LC.Content`, or `LC.Accounts.Passkeys.WaxAdapter` in the first `GEN-002` Stage 8 pass. Those helpers normalize context/schema or provider-specific attrs and have local defaulting/validation semantics.
- Do not change test-only lookup helpers in `test/support/passkey_test_support.ex`.

Focused test updates:

- Add `test/live_canvas/infra/payload_test.exs` for `LC.Infra.Payload`. Cover `positive_integer/2` with atom-key payloads, string-key payloads, missing keys, `nil`, `0`, negative integers, string numbers, floats, non-map payloads, and non-atom keys. Cover `value_for/2` with atom and string payload keys so future code does not reintroduce ad hoc atom/string lookup.
- Keep existing async/webhook integration coverage in `test/live_canvas/content_test.exs` and `test/integration/media_webhook_async_flow_test.exs`; add a small atom-key payload assertion only if it can exercise `LC.Content.MediaProcessingJob.handle/1` without making the test brittle around media-processing side effects.
- In `test/live_canvas/infra/data_governance_export_test.exs`, add focused coverage that `LC.Infra.DataGovernance.Export.handle/1` accepts an `AsyncJob` payload with atom key `:data_export_request_id` and still completes the request.
- In `test/live_canvas/infra/data_governance_deletion_test.exs`, add focused coverage that `LC.Infra.DataGovernance.Deletion.handle/1` accepts an `AsyncJob` payload with atom key `:account_deletion_request_id` and preserves the scheduled-request completion behavior.
- If `LCWeb.Plugs.ObservabilityContext` is updated, keep or extend `test/live_canvas_web/plugs/observability_context_test.exs` so socket params with atom keys and string keys still produce the same request and trace context.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md`, preferably near `Data And Security` or a new backend boundary-payload note: request/webhook/job payload helpers must use known atom keys plus `Atom.to_string/1`; do not convert external strings to atoms; keep context/schema attr normalization local unless semantics match the shared helper exactly.
- After editing, run `rg -n "extract_payload_integer" lib/live_canvas/content/media_processing_job.ex lib/live_canvas/infra/data_governance/export.ex lib/live_canvas/infra/data_governance/deletion.ex` and expect no private duplicate helper implementations. If a private wrapper remains for readability, it should be a one-line delegation to `LC.Infra.Payload.positive_integer/2`.
- Run `rg -n "String\\.to_atom\\(" lib/live_canvas lib/live_canvas_web test` and account for every remaining hit. The expected result is no `String.to_atom/1` in `LCWeb.Plugs.ObservabilityContext`; any remaining hit must be outside `GEN-002` scope and explicitly justified.
- Run `rg -n "Map\\.get\\([^\\n]+Atom\\.to_string|Atom\\.to_string\\(key\\)" lib/live_canvas/content/media_processing_job.ex lib/live_canvas/infra/data_governance/export.ex lib/live_canvas/infra/data_governance/deletion.ex lib/live_canvas_web/plugs/observability_context.ex` and confirm the exact duplicate payload-boundary lookups were removed or replaced by the shared helper.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas/infra/payload_test.exs test/live_canvas/content_test.exs test/integration/media_webhook_async_flow_test.exs test/live_canvas/infra/data_governance_export_test.exs test/live_canvas/infra/data_governance_deletion_test.exs test/live_canvas_web/plugs/observability_context_test.exs`
- `mix typecheck`

Stage 6 watchpoints to carry into Stage 8:

- Preserve the exact positive-integer validation contract for async job and webhook payload identifiers.
- Do not introduce `String.to_atom/1`, `String.to_existing_atom/1`, or dynamic atom creation for external payload keys.
- Keep local schema/context attr normalization out of the shared helper unless the caller needs the same fixed-key boundary payload semantics.
- Keep the helper small enough that future agents do not treat it as a universal deep payload parser.

**Progress:**

- Stage 1: Not applicable; this issue was discovered during Stage 4.
- Stage 2: Not applicable; Stage 5 is the validity discussion for Stage 4 candidates.
- Stage 3: Not applicable; Stage 6 is the similar-instance scan for Stage 4 candidates.
- Stage 4: Complete; discovered and initially analyzed.
- Stage 5: Complete; marked partially valid.
- Stage 6: Complete.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### WEB-001 - Duplicate Bearer Authorization Header Parsing In GraphQL And Metrics Plugs

**Stage 4 finding:** GraphQL request context and metrics authentication each implement the same bearer-token extraction and parsing logic.

**Initial assessment:** Valid. The duplication is small, but Authorization parsing is security-sensitive enough that two copies can drift in behavior, tests, and error handling.

**Stage 5 decision:** Marked valid on 2026-05-22. Move bearer header extraction/parsing into a small shared web helper. Keep each caller's authorization decision local: GraphQL still owns bearer-vs-session semantics and metrics still owns configured-token comparison.

**Evidence seen:**

- `lib/live_canvas_gql/context.ex` defines `bearer_token_from_authorization_header/1` and `parse_bearer_authorization/1`.
- `lib/live_canvas_web/plugs/metrics_auth.ex` defines the same two helpers with the same regex and trim behavior.

**Practical options recorded during Stage 5:**

- Move bearer header extraction/parsing into a small shared web auth helper.
- Keep GraphQL auth/session fallback and metrics token comparison outside the shared helper.
- Add focused tests around casing, whitespace, missing header, empty token, malformed header, and valid token behavior at the shared boundary.

**Stage 6 scan findings:**

Scan command run on 2026-05-22:

- `rg -n "bearer_token_from_authorization_header|parse_bearer_authorization|get_req_header\\([^\\n]+authorization|\\\"authorization\\\"\\)|Authorization|Bearer" lib test`

Findings:

- The only production copies of bearer Authorization extraction/parsing are in `lib/live_canvas_gql/context.ex` and `lib/live_canvas_web/plugs/metrics_auth.ex`.
- Tests already cover GraphQL bearer behavior in `test/live_canvas_gql/relay/request_context_test.exs` and metrics endpoint behavior in `test/live_canvas_web/controllers/metrics_endpoint_test.exs`.
- `test/live_canvas_gql/context_test.exs` and `test/live_canvas_web/plugs/observability_context_test.exs` use bearer headers for observability/leakage checks, but they do not add more parser implementations.
- Stage 7 should plan shared-helper tests for parser edge cases because neither existing caller-focused test suite fully owns shared parsing semantics.

**Stage 7 fix and prevention plan:** Written on 2026-05-23.

Stage 8 fix scope:

- Add a focused web helper module, preferably `lib/live_canvas_web/bearer_auth.ex` as `LCWeb.BearerAuth`, to own Authorization header extraction and Bearer parsing for HTTP plugs. Keep it web-specific rather than GraphQL-specific because metrics scraping and GraphQL request context both consume the same HTTP header contract.
- Give the helper public typespecs. Suggested API: `token_from_conn/1` returning `{:ok, String.t()} | :missing | :malformed`, and `parse_authorization/1` returning `{:ok, String.t()} | :malformed`.
- Preserve the current parser contract exactly: use the first `authorization` request header, accept case-insensitive `Bearer`, allow leading/trailing whitespace, trim the extracted token, return `:missing` only when the header is absent, and return `:malformed` when the header exists but is not a non-empty Bearer token after trimming.
- In `lib/live_canvas_gql/context.ex`, replace the private `bearer_token_from_authorization_header/1` call with `LCWeb.BearerAuth.token_from_conn/1`. Remove the private `bearer_token_from_authorization_header/1` and `parse_bearer_authorization/1` helpers from `LCGQL.Context`.
- Preserve GraphQL auth semantics: a valid parsed bearer token is authoritative and calls `Accounts.authenticate_access_token/1`; a missing header falls back to the session token; a malformed header returns `Accounts.empty_scope()` with `%{transport: :bearer, error: :invalid_token}` and must not fall back to session auth.
- In `lib/live_canvas_web/plugs/metrics_auth.ex`, replace the private `bearer_token_from_authorization_header/1` call with `LCWeb.BearerAuth.token_from_conn/1`. Remove the private `bearer_token_from_authorization_header/1` and `parse_bearer_authorization/1` helpers from `LCWeb.Plugs.MetricsAuth`.
- Preserve metrics semantics: endpoint enablement, configured-token normalization, `Plug.Crypto.secure_compare/2`, `cache-control`, content type, `401 invalid_metrics_token`, and `404 not_found` behavior stay local to `LCWeb.Plugs.MetricsAuth`. The shared helper must not know the configured metrics token or perform token comparison.
- Do not change session auth, `LCWeb.UserAuth`, GraphQL dataloader context setup, request observability metadata, or any auth token storage/hashing code in this issue.

Focused test updates:

- Add `test/live_canvas_web/bearer_auth_test.exs` for `LCWeb.BearerAuth`. Cover `token_from_conn/1` with no Authorization header, a valid `Bearer token` header, multiple Authorization headers where the first one wins, lowercase/mixed-case `bearer`, leading/trailing whitespace, an empty Bearer token, a non-Bearer scheme such as `Basic token`, and a malformed bare token.
- In the same test file, cover `parse_authorization/1` directly for parser edge cases that do not need a conn: `"Bearer abc"` -> `{:ok, "abc"}`, `"  bearer   abc  "` -> `{:ok, "abc"}`, `"Bearer   "` -> `:malformed`, `"Basic abc"` -> `:malformed`, and a non-binary value -> `:malformed`. Implement `parse_authorization(_other), do: :malformed` to make the public helper total.
- Keep `test/live_canvas_gql/relay/request_context_test.exs` as the main GraphQL caller regression suite. Add a focused test where a logged-in session sends a malformed Authorization header such as `"Basic not-bearer"`; `viewer` must resolve to `nil` and the request must not fall back to the session user.
- Keep `test/live_canvas_web/controllers/metrics_endpoint_test.exs` as the main metrics caller regression suite. Add focused assertions that a lower-case or whitespace-padded Bearer header still authorizes, and that a malformed non-Bearer Authorization header still returns `401`.
- Keep `test/live_canvas_gql/context_test.exs` and `test/live_canvas_web/plugs/observability_context_test.exs` focused on observability/no-leak behavior; they should not duplicate parser edge-case coverage.

Prevention checks:

- Add a durable convention note during Stage 8 under `docs/architecture/conventions.md`, preferably near `GraphQL And Relay` or a new web-auth subsection: HTTP Authorization Bearer parsing must go through `LCWeb.BearerAuth`; callers own authorization decisions after parsing, and must not reimplement local regex/header parsing.
- After editing, run `rg -n "bearer_token_from_authorization_header|parse_bearer_authorization" lib test` and expect no hits when the new helper uses the suggested `token_from_conn/1` and `parse_authorization/1` names.
- Run `rg -n "get_req_header\\([^\\n]+authorization|~r/\\^\\\\s\\*bearer|bearer\\\\s\\+\\(\\.\\+\\)" lib test` and confirm Authorization header extraction and bearer regex logic are centralized in `LCWeb.BearerAuth` and its focused tests.
- Run `rg -n "BearerAuth\\.token_from_conn" lib/live_canvas_gql/context.ex lib/live_canvas_web/plugs/metrics_auth.ex` and confirm both callers delegate to the shared helper.

Verification for Stage 8:

- `mix compile`
- `mix test test/live_canvas_web/bearer_auth_test.exs test/live_canvas_gql/relay/request_context_test.exs test/live_canvas_gql/context_test.exs test/live_canvas_web/controllers/metrics_endpoint_test.exs`
- `mix typecheck`

Stage 6 watchpoints to carry into Stage 8:

- Preserve first-header-wins behavior for duplicate Authorization headers.
- Preserve case-insensitive Bearer parsing and token trimming.
- Preserve GraphQL's no-session-fallback behavior when an Authorization header is present but malformed or invalid.
- Preserve metrics token comparison inside `LCWeb.Plugs.MetricsAuth`; the shared helper only parses.
- Do not broaden the accepted auth transports, add query-string tokens, or touch persisted token security.

**Progress:**

- Stage 1: Not applicable; this issue was discovered during Stage 4.
- Stage 2: Not applicable; Stage 5 is the validity discussion for Stage 4 candidates.
- Stage 3: Not applicable; Stage 6 is the similar-instance scan for Stage 4 candidates.
- Stage 4: Complete; discovered and initially analyzed.
- Stage 5: Complete; marked valid.
- Stage 6: Complete.
- Stage 7: Complete.
- Stage 8: Not started; requires an explicit implementation request.

### GQL-009 - Accounts GraphQL Resolver Has Accumulated Unrelated API Responsibilities

**Stage 4 finding:** `LCGQL.Accounts.Resolver` is much larger than the other GraphQL resolvers and mixes several separate API areas in one module.

**Initial assessment:** Valid as a maintainability concern, but deferred behind narrower cleanup. It should be treated as a structural cleanup only after narrower issues such as `GQL-001`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-008`, and `WEB-001` are discussed and planned. The module currently handles registration, password reset, identity unlinking, data export, account deletion, contact sync, invite delivery, auth challenges, sign-up, login, token refresh/revoke, user fields, contact-match fields, changeset formatting, token views, and field-name formatting.

**Stage 5 decision:** Marked valid but deferred on 2026-05-22. Split `LCGQL.Accounts.Resolver` by cohesive GraphQL API area only after narrower valid or partially valid helper/field cleanups have removed or centralized shared helpers, so the module split does not preserve current duplication under new filenames.

**Evidence seen:**

- `wc -l` reported `lib/live_canvas_gql/accounts/account_resolver.ex` at 1389 lines, compared with `chat_resolver.ex` at 251, `content_resolver.ex` at 407, `feed_resolver.ex` at 113, `live_resolver.ex` at 430, and `social_resolver.ex` at 295.
- `lib/live_canvas_gql/accounts/account_resolver.ex` contains public resolver groups and private helpers for auth, contacts, data export/account deletion, user child fields, mutation errors, token views, and field formatting.

**Practical options recorded during Stage 5:**

- Defer structural splitting until narrower valid or partially valid helper/field cleanups have a Stage 7 plan or implementation.
- Split by cohesive GraphQL API area later, such as auth, contacts, data governance, user fields, and identities.
- Avoid moving existing duplicated helpers into new modules before deciding whether they should become shared helpers.
- In the meantime, keep new Accounts resolver work out of the monolith when it naturally belongs to a smaller module.

**Stage 6 scan findings:**

Scan commands run on 2026-05-22:

- `wc -l lib/live_canvas_gql/**/*.ex lib/live_canvas_gql/accounts/*.ex`
- `rg -n "payload field|connection field|field :viewer|resolve\\(&Resolver" lib/live_canvas_gql/accounts/account_mutations.ex lib/live_canvas_gql/accounts/account_queries.ex lib/live_canvas_gql/accounts/account_types.ex`
- Focused reads of `lib/live_canvas_gql/accounts/account_resolver.ex` around public resolver groups and private helpers.

Findings:

- `LCGQL.Accounts.Resolver` remains the only GraphQL resolver module in the scan with this level of mixed responsibility: 1389 lines versus `live_resolver.ex` at 430, `content_resolver.ex` at 407, `social_resolver.ex` at 295, `chat_resolver.ex` at 251, and `feed_resolver.ex` at 113.
- `account_mutations.ex` routes 16 payload fields to one resolver module, and `account_queries.ex` routes three query/connection fields to that same module.
- Natural future split groups are visible:
  - auth/session entry: `begin_auth_challenge/3`, `sign_up/3`, `log_in/3`, `issue_viewer_auth_tokens/3`, `refresh_auth_tokens/3`, `revoke_refresh_token/3`, plus auth error/token helpers.
  - legacy/profile/identity basics: `register_with_email/3`, `attach_user_phone_number/3`, `update_viewer_privacy_mode/3`, `request_password_reset/3`, `reset_password/3`, `unlink_viewer_identity/3`, and user identity provider fields.
  - data governance: data export/account deletion mutations, viewer data export query, timestamp fields, decode helpers, and data-governance errors.
  - contacts: contact entry upsert, contact invite delivery, contact-match query/projection, and contact-specific errors.
  - user node child fields: `viewer/3`, profile feed/live-session/replay connections, `user_identities/3`, `user_identity_user/3`, and `visible_profile_connection/3`.
- This split should remain deferred until narrower shared-helper work is planned or fixed, because `GQL-001`, `GQL-003`, `GQL-004`, `GQL-008`, and `WEB-001` all touch helpers currently embedded in the module.

**Progress:**

- Stage 1: Not applicable; this issue was discovered during Stage 4.
- Stage 2: Not applicable; Stage 5 is the validity discussion for Stage 4 candidates.
- Stage 3: Not applicable; Stage 6 is the similar-instance scan for Stage 4 candidates.
- Stage 4: Complete; discovered and initially analyzed.
- Stage 5: Complete; marked valid but deferred.
- Stage 6: Complete.
- Stage 7: Deferred until narrower cleanup work is planned or fixed.
- Stage 8: Blocked until Stage 7 is written and implementation is explicitly requested.

## Prompt For Next Run

Use this prompt to continue:

```text
Continue the backend code quality cleanup from docs/plans/backend/2026-05-22-code-quality-cleanup.md.

Read AGENTS.md, docs/plans/backend/NOW.md, and the cleanup inventory. Treat this inventory as the source of truth for per-issue stage status; if docs/plans/backend/NOW.md lags behind these statuses, follow this inventory and update docs/plans/backend/NOW.md before continuing. Do not edit coordinator-owned docs/plans/NOW.md from the backend lane. Do not edit implementation code unless the user explicitly asks to enter Stage 8. Current status: Stage 1 and Stage 2 are complete for all user-reported issues; Stage 3 and Stage 7 are complete for `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-006`, `GQL-007`, `ECTO-001`, `CTX-001`, `SOCK-002`, `SOCK-003`, `LIVE-001`, and `DOC-001`; `DOC-001` Stage 7 plans a docs-only removal of task/status tracking from `docs/architecture/conventions.md` while preserving durable standards; `LIVE-001` Stage 7 plans a layered `LC.RealtimeRuntime` design that removes Postgres-backed runtime owner leases, uses `libcluster` for Kubernetes cluster discovery, uses strict shard ownership as the authoritative distributed boundary, keeps runtime children under local supervisors/registries, allows Syn only for directory/group metadata, and allows Horde only for soft duplicate-tolerant workers; `SOCK-001` Stage 2 is complete and merged into `SOCK-002`, which now owns both live-session topic generation and parsing cleanup; `GEN-001` Stage 2 is complete with a deferred-valid decision and a required future fix through a dedicated chat timeline/event-object redesign; Stage 4 is complete; Stage 5 and Stage 6 are complete for `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009`; Stage 7 plans are also written for `GQL-008`, `GEN-002`, and `WEB-001`; Stage 8 has not started for any issue. If entering implementation, start Stage 8 only for the issue the user explicitly names or requests and follow that issue's Stage 7 plan. If continuing `GEN-001`, do not start a cleanup-stage scan by default; start a dedicated chat timeline/event-object redesign only if the user explicitly asks. If continuing Stage 7 planning for other issues, do not start `GQL-009` unless the user explicitly asks to revisit that deferred structural cleanup. For one issue at a time, update the issue's status and move to the next issue only when the user asks.
```

## Shared Coordinator Repair To Report

The user explicitly reprioritized backend code quality cleanup as the new number 1 priority. `docs/plans/NOW.md` is coordinator-owned, so backend-lane workers should not edit it directly. A coordinator should update the backend lane summary there to point at this document, noting that `SOCK-001` Stage 2 is complete and merged into `SOCK-002`, `SOCK-002` Stage 2, Stage 3, and Stage 7 are complete with Stage 8 not started, `SOCK-003` Stage 2, Stage 3, and Stage 7 are complete with Stage 8 not started, `LIVE-001` Stage 2, Stage 3, and Stage 7 are complete with Stage 8 not started and now plans the finalized layered `LC.RealtimeRuntime` shard-ownership design, `DOC-001` Stage 2, Stage 3, and Stage 7 are complete with Stage 8 not started, `CTX-001` Stage 7 is complete and Stage 8 has not started, `GEN-001` Stage 2 is complete with a deferred-valid decision and required future chat timeline/event-object fix, `ECTO-001` Stage 7 is complete and Stage 8 has not started, `GQL-007` Stage 7 is complete and Stage 8 has not started, `GQL-001`, `GQL-002`, `GQL-003`, `GQL-004`, `GQL-005`, `GQL-006`, `GQL-008`, `GEN-002`, and `WEB-001` are discussed/scanned/planned where applicable, Stage 5 and Stage 6 are complete for Stage 4 candidates, and the next work is Stage 8 implementation for a named planned issue only if the user explicitly requests it, explicit dedicated redesign for `GEN-001` if the user asks to start it, or explicit deferred planning for `GQL-009`.

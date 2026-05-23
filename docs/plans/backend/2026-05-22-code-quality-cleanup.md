# Backend Code Quality Cleanup Inventory

Last reviewed: 2026-05-23
Status: `GQL-004` Stage 7 planned; awaiting next user direction
Owner lane: backend

## Purpose

This document is the handoff point for the staged code quality cleanup. The user has made fixing sloppy code, unnecessary complexity, and avoidable duplication the top backend priority. No implementation changes should happen until the relevant issue has been discussed and marked valid or partially valid.

## Stage Model

Use this same stage language for every issue.

- [x] Stage 1: Capture and initially analyze the user-reported issues.
- [ ] Stage 2: Discuss each user-reported issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [ ] Stage 3: For each valid or partially valid user-reported issue, scan the codebase for the same or similar patterns and attach the findings to that issue.
- [x] Stage 4: Using the valid or partially valid user-reported issues as calibration, perform an agent-led quality scan for additional slop, anti-patterns, repetition, hard-to-read code, poor documentation, and unnecessary complexity.
- [x] Stage 5: Discuss each newly discovered issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [x] Stage 6: For each valid or partially valid newly discovered issue, scan for same or similar patterns and attach the findings.
- [ ] Stage 7: For each valid or partially valid issue, write a detailed fix and prevention plan, including standards or docs needed to keep it from returning.
- [ ] Stage 8: Fix each valid or partially valid issue one at a time with focused verification.

## Current Handoff

Stage 2 has started and `GQL-001`, `GQL-002`, `GQL-003`, and `GQL-004` have been discussed. `GQL-001` Stage 3 and Stage 4 scans are complete, and its Stage 7 fix/prevention plan was written on 2026-05-23. Stage 5 and Stage 6 are complete for Stage 4 candidates: `GQL-008`, `GEN-002`, `WEB-001`, and `GQL-009` have been discussed and scanned. `GQL-002` was marked partially valid, scanned, and planned on 2026-05-23. `GQL-003` was marked valid, scanned, and planned on 2026-05-23. `GQL-004` was marked valid, scanned, and planned on 2026-05-23. Continue next by entering Stage 8 implementation for a planned issue only if the user explicitly asks for that issue, or switching issues only if the user asks. Keep the discussion/planning issue-by-issue. Do not edit implementation code until the user explicitly asks to enter Stage 8.

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

- [x] Stage 1 captured and initially analyzed.
- [x] Stage 2 validity/severity discussion complete.
- [x] Stage 3 similar-instance scan complete.
- [x] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [x] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

- [x] Stage 1 captured and initially analyzed.
- [x] Stage 2 validity/severity discussion complete.
- [x] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [x] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

- [x] Stage 1 captured and initially analyzed.
- [x] Stage 2 validity/severity discussion complete.
- [x] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [x] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

- [x] Stage 1 captured and initially analyzed.
- [x] Stage 2 validity/severity discussion complete.
- [x] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [x] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-005 - Viewer-Specific Data On The User Node

**User concern:** Fields on the User node have `viewer` in their name and derive the target user from context. User node fields should exist on all users, with authz deciding whether the current viewer can see that field for a given user.

**Initial assessment:** Needs discussion because the exact symptom may be stale or indirect. Initial inspection did not find field names containing `viewer` inside `node object(:user)`. The User node does contain `fresh_access_token` and `refresh_token`, which are viewer/session-specific and therefore suspicious on a globally refetchable User node even though the field names do not include `viewer`. Viewer-named queries and mutations exist outside the User node, which may be acceptable.

**Evidence seen:**

- `lib/live_canvas_gql/accounts/account_types.ex` has `node object(:user)` with `email`, `privacy_mode`, `inserted_at`, content/social connections, `fresh_access_token`, and `refresh_token`.
- `lib/live_canvas_gql/accounts/account_queries.ex` has viewer-root fields such as `viewer`, `viewer_data_export_requests`, and `viewer_contact_matches`.
- `lib/live_canvas_gql/accounts/account_mutations.ex` has viewer-scoped mutation names.
- No initial `field :viewer...` hit was found inside the User node.

**What likely needs to change:**

- Clarify whether the user meant stale field names, token fields, or context-derived resolvers on User node fields.
- If token fields are the issue, remove tokens from the globally refetchable User node and keep token data only on auth mutation payloads.
- For private User fields such as `email`, ensure resolver-level authz is based on the parent user plus current viewer, not by replacing the parent with context viewer.

**Where to look first:**

- `lib/live_canvas_gql/accounts/account_types.ex`
- `lib/live_canvas_gql/accounts/account_resolver.ex`
- `test/live_canvas_gql/accounts/account_queries_test.exs`
- `test/live_canvas_gql/relay/node_queries_test.exs`
- `test/live_canvas_gql/relay/request_context_test.exs`

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-006 - `schema.ex` Node Resolution And Type Resolution

**User concern:** `node field do ...` and `node interface do` should not resolve type based on map keys. For Ecto-backed nodes, resolve type by struct. There should not be dedicated fetch functions for each node type; use direct repo lookups where appropriate.

**Initial assessment:** Partially valid, but needs careful discussion because this intersects with the explicit backend convention that node fetchers must re-apply authorization to avoid IDOR. The map-key `resolve_type` clauses are fragile and should become struct-based where possible. The node fetch functions are verbose, but many intentionally route through context APIs like `Feed.get_visible_post/2`, `Content.get_user_media_asset/2`, and `Chat.get_history_message/2` to enforce visibility.

**Evidence seen:**

- `lib/live_canvas_gql/schema.ex` `node interface` resolves types by map keys like `provider_uid`, `privacy_mode`, `mime_type`, and `contact_entry`.
- `lib/live_canvas_gql/schema.ex` `node field` dispatches to one private `fetch_*_node/2` function per node type.
- Several fetchers cast IDs and re-apply viewer-specific access rules.
- The convention doc explicitly says GraphQL node fetch and child field resolver layers must re-apply authz.

**What likely needs to change:**

- Convert `resolve_type` to pattern match on schema structs for Ecto-backed nodes.
- Keep or improve authz for globally refetchable IDs; do not replace all fetchers with unauthenticated `Repo.get/2`.
- Consider a small shared node-fetch helper that decodes/casts IDs and delegates to explicit authorization-aware functions.
- Inline direct repo lookups only for node types that are truly public or already protected elsewhere.

**Where to look first:**

- `lib/live_canvas_gql/schema.ex`
- `lib/live_canvas_gql/relay.ex`
- `test/live_canvas_gql/relay/node_queries_test.exs`
- `docs/architecture/conventions.md`

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-007 - Resolver Wrappers That Only Dataload Associations

**User concern:** Various node fields resolve to resolver functions where the function only loads an association with dataloader. Simple association loads should be inline, for example `field :posts, list_of(:post), resolve: dataloader(Blog)`.

**Initial assessment:** Likely valid for simple child fields. Some current wrappers only check preloaded association then call `LCGQL.Dataloader.load_assoc/4`; those can probably become inline dataloader declarations. Other fields include authorization, filtering, ordering, fallback behavior, or connection pagination and should stay resolver-backed.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_resolver.ex` has `chat_message_sender/3`.
- `lib/live_canvas_gql/feed/feed_resolver.ex` has simple host/recording-media style association loaders.
- `lib/live_canvas_gql/social/social_resolver.ex` has `follow_request_follower/3`.
- `lib/live_canvas_gql/content/content_resolver.ex` has `author/3`; `media_assets/3` is more than a simple association load because it sorts and documents visibility assumptions.
- `lib/live_canvas_gql/dataloader.ex` has a generic `load_assoc/4` wrapper.

**What likely needs to change:**

- Identify resolver functions whose only responsibility is a simple association load.
- Replace those field definitions with inline Absinthe dataloader usage.
- Keep resolver functions where authz, connection construction, filtering, sorting, or null/default semantics are required.

**Where to look first:**

- `lib/live_canvas_gql/chat/chat_types.ex`
- `lib/live_canvas_gql/feed/feed_types.ex`
- `lib/live_canvas_gql/social/social_types.ex`
- `lib/live_canvas_gql/content/content_types.ex`
- `lib/live_canvas_gql/dataloader.ex`

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### ECTO-001 - Ecto Schema Files Do Not Summarize Constraints And Indexes

**User concern:** Ecto schema files need documentation or comments so readers do not have to search migrations to understand table constraints and unique indexes.

**Initial assessment:** Valid. Schema modules currently list fields and associations but generally do not summarize database constraints or indexes. Migrations show many unique indexes and check constraints that are not obvious from schema files.

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

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GEN-001 - System Events Are Modeled As Chat Messages

**User concern:** System events should not be chat messages with no sender id. They should be special client-facing objects in a GraphQL interface and equivalent websocket event type. User-sent messages would be one event type, while moderator actions, join/leave, and gift events would be other event types. Moderator actions that update another message need later design discussion.

**Initial assessment:** Valid as a product/API architecture concern, but it is larger than a small cleanup. Current implementation persists system events as `chat_messages` rows with `kind: :system_event`, body text, metadata, and a sender id set to the acting host. That is not exactly "no sender id", but it still overloads chat message persistence and client projection.

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

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### CTX-001 - `runtime_rpc_module/1` Indirection

**User concern:** `runtime_rpc_module/1` is a function even though the module is never declared or changed in configuration and always uses the default.

**Initial assessment:** Needs discussion. The helper does read application config and per-call opts, and tests currently inject `FakeRuntimeRPC` through opts/config. In production, it appears to default to `LC.Live.RuntimeRPC`. If this is only a test seam, a better test strategy or explicit behaviour module may be preferable to hidden app-config indirection.

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

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### SOCK-001 - `parse_session_id/1` And `parse_session_id_hint/1`

**User concern:** `live_session_channel.ex` has `parse_session_id/1` and `parse_session_id_hint/1`; these are not needed and are slop.

**Initial assessment:** Partially valid. The code does need to parse the `"live_session:" <> raw_session_id` topic suffix into an integer before calling `Live.fetch_joinable_session/1`, and the hint is used for telemetry on failed joins. The duplication and helper naming are still questionable; parsing could be simplified or centralized with topic parsing.

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

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### SOCK-002 - Topic Name Generators Duplicated Across GraphQL, Chat, And Channels

**User concern:** Functions like `session_control_topic/1` and all topic name generators should move out of GraphQL modules and domain contexts. Topic generation should be consistent across the app and live under sockets/channels-specific code.

**Initial assessment:** Valid. Topic string construction is duplicated in multiple modules, including GraphQL resolver code, channel code, and chat broadcast code. A shared web/channel topic module would reduce drift and move transport naming out of GraphQL/domain modules.

**Evidence seen:**

- `lib/live_canvas_gql/live/live_resolver.ex` defines `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1`.
- `lib/live_canvas_web/channels/live_session_channel.ex` defines `session_control_topic/1`, `session_user_control_topic/2`, and `live_session_topic/1`.
- `lib/live_canvas/chat/broadcasts.ex` defines `live_session_topic/1`.
- Tests directly assemble strings like `"live_session_control:#{live_session.id}"`.

**What likely needs to change:**

- Create a shared topic helper under the web/channel boundary, for example `LCWeb.LiveSessionTopics`.
- Replace GraphQL, channel, chat broadcast, and tests with the shared helper.
- Decide whether domain modules like `LC.Chat.Broadcasts` should call a web module, move broadcasts to web, or receive topics from the caller.

**Where to look first:**

- `lib/live_canvas_gql/live/live_resolver.ex`
- `lib/live_canvas_web/channels/live_session_channel.ex`
- `lib/live_canvas/chat/broadcasts.ex`
- `test/live_canvas_gql/live/live_mutations_test.exs`
- `test/live_canvas_web/channels/live_session_channel_test.exs`

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### SOCK-003 - Channel Error Reason Formatters

**User concern:** `join_error_reason/1` and `message_error_reason/1` are mostly just atom-to-string conversion. Find a better way.

**Initial assessment:** Likely valid. The helpers flatten domain and transport reasons into string response payloads inside the channel. Some mappings are meaningful, such as remote-owner errors becoming `session_unavailable`, but many are simple atom conversions.

**Evidence seen:**

- `lib/live_canvas_web/channels/live_session_channel.ex` defines `join_error_reason/1` and `message_error_reason/1`.
- Remote runtime errors are also normalized in `LC.Live`, then again in channel error reason formatting.
- GraphQL resolvers have separate reason-to-message helpers, which overlaps with `GQL-004`.

**What likely needs to change:**

- Decide on socket error payload shape: strings, atoms encoded by JSON, or structured error codes.
- Centralize channel error formatting if strings are still the public contract.
- Preserve meaningful semantic mappings like remote failures to `session_unavailable`.

**Where to look first:**

- `lib/live_canvas_web/channels/live_session_channel.ex`
- `test/live_canvas_web/channels/live_session_channel_test.exs`
- Any shared GraphQL error helper considered for `GQL-004`, to avoid diverging public error conventions.

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### LIVE-001 - Live Session Runtime Ownership Stored In Postgres

**User concern:** Why is node ownership for sessions stored/handled with Postgres? Can this be done natively with OTP/Elixir features?

**Initial assessment:** Needs architecture discussion. Current code uses `live_session_runtime_owners` as a lease table to coordinate distributed session runtime ownership. OTP-native options may simplify this if deployment uses a single BEAM cluster and accepts the failure semantics of distributed Erlang primitives. Postgres leases provide durability and work across nodes that share the database, but they add complexity and may be unnecessary for the intended deployment.

**Evidence seen:**

- `lib/live_canvas_schemas/live/live_session_runtime_owner.ex` models the ownership table.
- `lib/live_canvas/live/session_ownership.ex` claims, refreshes, releases, and looks up leases.
- `lib/live_canvas/live/session_supervisor.ex` uses ownership results to decide whether the local node can own a session.
- `lib/live_canvas/live.ex` handles `{:owned_by_remote, owner_node}` and calls remote runtime RPC.
- Tests cover remote ownership and partition/rejoin behavior.

**What likely needs to change:**

- Clarify deployment assumptions: single node, distributed BEAM cluster, multi-node with shared Postgres, or future autoscaling.
- Compare OTP-native options such as local Registry, distributed Erlang, `:global`, `:pg`, or a supervised process per session against current Postgres lease semantics.
- If OTP-native is chosen, write a replacement plan for ownership lookup, failover, viewer counts, and remote state snapshots.
- If Postgres stays, document why and simplify confusing seams such as `runtime_rpc_module/1`.

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

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### DOC-001 - Task-Specific Information In General Convention Docs

**User concern:** Remove task-specific info from general files like `conventions.md`.

**Initial assessment:** Valid. The convention doc currently includes a `Progress` checklist and `Planned Refactors` section. Those are task/lane tracking concerns rather than durable conventions. The conventions file exists in this repo at `docs/architecture/conventions.md`, but DOC-001 changes should still wait for Stage 2 validation before editing that general standards document.

**Evidence seen:**

- `docs/architecture/conventions.md` contains a progress checklist.
- The same file has a `Planned Refactors` section pointing to remaining convention migrations.
- Durable rules such as timestamp type, token hashing, Relay-first GraphQL, and GraphQL authz should remain in a conventions doc.

**What likely needs to change:**

- Move progress/checklist content out of general conventions into plan/status docs.
- Keep stable backend standards in conventions.
- Add any new standards from this cleanup only after discussion and validation.

**Where to look first:**

- `docs/architecture/conventions.md`
- `docs/plans/conventions/2026-03-02-conventions-alignment-design.md`
- `docs/plans/backend/NOW.md`

**Progress:**

- [x] Stage 1 captured and initially analyzed.
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

**Progress:**

- [x] Stage 4 discovered and initially analyzed.
- [x] Stage 5 validity/severity discussion complete.
- [x] Stage 6 related newly discovered issue scan complete, if valid or partially valid.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

**Progress:**

- [x] Stage 4 discovered and initially analyzed.
- [x] Stage 5 validity/severity discussion complete.
- [x] Stage 6 related newly discovered issue scan complete, if valid or partially valid.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

**Progress:**

- [x] Stage 4 discovered and initially analyzed.
- [x] Stage 5 validity/severity discussion complete.
- [x] Stage 6 related newly discovered issue scan complete, if valid or partially valid.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

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

- [x] Stage 4 discovered and initially analyzed.
- [x] Stage 5 validity/severity discussion complete.
- [x] Stage 6 related newly discovered issue scan complete, if valid or partially valid.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

## Prompt For Next Run

Use this prompt to continue:

```text
Continue the backend code quality cleanup from docs/plans/backend/2026-05-22-code-quality-cleanup.md.

Read AGENTS.md, docs/plans/backend/NOW.md, and the cleanup inventory. Treat this inventory as the source of truth for per-issue stage status; if docs/plans/backend/NOW.md lags behind these statuses, follow this inventory and update docs/plans/backend/NOW.md before continuing. Do not edit coordinator-owned docs/plans/NOW.md from the backend lane. Do not edit implementation code unless the user explicitly asks to enter Stage 8. `GQL-001` Stage 7 is planned, and Stage 5 and Stage 6 are complete for the Stage 4 candidates. If continuing issue discussion, resume Stage 2 with the next undecided user-reported issue, starting with `GQL-002` unless it is already marked discussed. If continuing planning, start Stage 7 with the first valid or partially valid issue that does not yet have a fix/prevention plan. If entering implementation, start Stage 8 for `GQL-001` only. For one issue at a time, update the issue's status and move to the next issue only when the user asks.
```

## Shared Coordinator Repair To Report

The user explicitly reprioritized backend code quality cleanup as the new number 1 priority. `docs/plans/NOW.md` is coordinator-owned, so backend-lane workers should not edit it directly. A coordinator should update the backend lane summary there to point at this document, noting that `GQL-001` is discussed/scanned/planned, Stage 5 and Stage 6 are complete for Stage 4 candidates, and the next work is either Stage 2 discussion for `GQL-002`, Stage 8 implementation for `GQL-001`, or Stage 7 planning for the next valid or partially valid issue.

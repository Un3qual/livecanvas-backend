# Backend Code Quality Cleanup Inventory

Last reviewed: 2026-05-22
Status: Stage 1 complete; Stage 2 discussion is next
Owner lane: backend

## Purpose

This document is the handoff point for the staged code quality cleanup. The user has made fixing sloppy code, unnecessary complexity, and avoidable duplication the top backend priority. No implementation changes should happen until the relevant issue has been discussed and marked valid.

## Stage Model

Use this same stage language for every issue.

- [x] Stage 1: Capture and initially analyze the user-reported issues.
- [ ] Stage 2: Discuss each user-reported issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [ ] Stage 3: For each valid user-reported issue, scan the codebase for the same or similar patterns and attach the findings to that issue.
- [ ] Stage 4: Using the valid user-reported issues as calibration, perform an agent-led quality scan for additional slop, anti-patterns, repetition, hard-to-read code, poor documentation, and unnecessary complexity.
- [ ] Stage 5: Discuss each newly discovered issue with the user and decide whether it is valid, partially valid, not valid, or deferred.
- [ ] Stage 6: For each valid newly discovered issue, scan for same or similar patterns and attach the findings.
- [ ] Stage 7: For each valid issue, write a detailed fix and prevention plan, including standards or docs needed to keep it from returning.
- [ ] Stage 8: Fix each valid issue one at a time with focused verification.

## Current Handoff

Start next at Stage 2 with `GQL-001`. Keep the discussion issue-by-issue. Do not start repo-wide scans or code changes during Stage 2 unless the user explicitly asks to skip ahead.

Initial repository checks performed on 2026-05-22:

- `git status --short --branch` showed a detached `HEAD` and no listed local changes.
- `docs/plans/backend/NOW.md` was in planning mode before this inventory.
- `docs/plans/NOW.md` is coordinator-owned and should not be edited by backend-lane workers.
- Source convention doc checked: `docs/architecture/conventions.md`.

## Discussion Queue

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

## Issues

### GQL-001 - Timestamp String Resolvers And String Timestamp Fields

**User concern:** GraphQL schema code has dedicated resolvers that convert timestamps to strings. Absinthe can serialize timestamps, so these fields should not need resolver functions.

**Initial assessment:** Likely valid. The schema currently exposes many timestamp fields as `:string`, and several resolvers explicitly call `DateTime.to_iso8601/1` or wrapper helpers. Before fixing, confirm whether the project should import/use Absinthe's datetime scalar for all DateTime fields and whether mobile clients expect GraphQL scalar names or plain strings.

**Evidence seen:**

- `lib/live_canvas_gql/chat/chat_types.ex` defines `moderated_at` and `inserted_at` as `:string` with resolver functions.
- `lib/live_canvas_gql/chat/chat_resolver.ex` has `chat_message_moderated_at/3` and `chat_message_inserted_at/3`.
- `lib/live_canvas_gql/social/social_resolver.ex` has `follow_request_requested_at/3`.
- `lib/live_canvas_gql/accounts/account_resolver.ex` has `iso8601_datetime/1` and data-export/account-deletion timestamp resolvers.
- `lib/live_canvas_gql/content/content_resolver.ex` formats signed upload `expires_at`.
- Many timestamp fields in `lib/live_canvas_gql/**/*_types.ex` are declared as `:string`.

**What likely needs to change:**

- Pick the GraphQL scalar standard for DateTime values in this app.
- Replace unnecessary timestamp resolver functions with direct field declarations where Absinthe can serialize the value.
- Update tests to assert the API contract rather than resolver implementation details.
- Keep any transport-only manual formatting, such as raw Phoenix channel JSON payloads, separate from GraphQL cleanup.

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
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-002 - Chat Resolver Presentation And Data-Shaping Helpers

**User concern:** `chat_resolver.ex` contains formatting and manual result shaping helpers such as `metadata/1`, `value_for/2`, `cast_system_event_type/1`, `visible_body/1`, and `system_event_type/1`. Structured rendering should be universal under `live_canvas_gql`, and enum/string conversion should not live in context-specific resolvers.

**Initial assessment:** Likely valid, with one important design dependency: the larger system-event model in `GEN-001` may supersede much of the current `ChatMessage` field projection. The current resolver parses map keys, accepts both string and atom enum values, manually converts system event metadata into GraphQL fields, and duplicates visible-body behavior already present in `LC.Chat.ChatMessage.visible_body/1` for broadcast payloads.

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
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-003 - Duplicate And Hacky `camelize_lower/1`

**User concern:** `camelize_lower/1` is duplicated in two GraphQL resolver files, is not needed in both, and is written in a hacky way.

**Initial assessment:** Valid. The duplicate implementation appears in `LCGQL.Live.Resolver` and `LCGQL.Accounts.Resolver`. It performs atom-to-string, `Macro.camelize/1`, and manual first-character lowercasing. Field-name conversion should either use a shared GraphQL helper or be avoided by letting Absinthe/adapters own external names.

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
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
- [ ] Stage 8 fixed and verified.

### GQL-004 - Duplicated GraphQL Mutation Error Helpers

**User concern:** Resolver-local helpers like `error_field/2` and `mutation_error/2` are unneeded and duplicated. If GraphQL responses need structured errors, that should be universal, not attached to specific contexts.

**Initial assessment:** Likely valid. Error payloads are currently split across `user_error`, `content_error`, `social_error`, and `auth_error`, while resolvers each carry local formatting helpers. Some differences are real API contract differences, such as `auth_error.code`, but the common `{field, message}` shape is duplicated.

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
- [ ] Stage 2 validity/severity discussion complete.
- [ ] Stage 3 similar-instance scan complete.
- [ ] Stage 4 calibration included in agent-led quality scan.
- [ ] Stage 5 related newly discovered issues discussed, if any.
- [ ] Stage 6 related newly discovered issue scan complete, if any.
- [ ] Stage 7 fix and prevention plan written.
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

## Prompt For Next Run

Use this prompt to continue:

```text
Continue the backend code quality cleanup from docs/plans/backend/2026-05-22-code-quality-cleanup.md.

Start at Stage 2. Read AGENTS.md, docs/plans/backend/NOW.md, and the cleanup inventory. Do not edit implementation code yet. Discuss the next undecided issue in the Discussion Queue with me, starting with GQL-001 unless it is already marked discussed. For that one issue, explain whether you think it is valid, partially valid, or not valid, why the code was probably written that way, the severity/blast radius, and the practical options. After we decide, update the issue's Stage 2 status and move to the next issue only when I ask.
```

## Shared Coordinator Repair To Report

The user explicitly reprioritized backend code quality cleanup as the new number 1 priority. `docs/plans/NOW.md` is coordinator-owned, so backend-lane workers should not edit it directly. A coordinator should update the backend lane summary there to point at this document and Stage 2 discussion.

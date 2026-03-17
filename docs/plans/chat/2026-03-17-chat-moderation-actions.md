# Chat Moderation Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bounded message-level moderation for retained live chat so session hosts can remove abusive messages and active clients can reconcile the change consistently.

**Architecture:** Keep moderation authority inside the existing Live/Chat ownership model: the acting user must be the host of the message's live session, while `LC.Chat` owns message state changes and `LCGQL.Chat` stays adapter-thin. Persist moderation state directly on `chat_messages`, expose it through the Relay `ChatMessage` node/connection, and broadcast a stable channel update event so realtime clients can remove or redact moderated messages without polling.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Execution Summary

- Status: queued
- Track: `docs/plans/chat/TRACK.md`
- First batch: `Task 1`
- Start after: `docs/plans/chat/2026-03-17-chat-history-query-api.md` -> `Task 3`
- Advance to: this plan's `Task 2`, then `Task 3`; after the plan is complete, move to `docs/plans/chat/2026-03-17-chat-system-events.md` -> `Task 1`

## Candidate Status Verification (2026-03-17)

Verified directly in active code and tests before writing this plan:

1. **Chat messages are durable but not moderatable.**
   - Evidence: `chat_messages` currently stores `body`, `kind`, and `metadata` in `lib/live_canvas_schemas/chat/chat_message.ex`, and `LC.Chat.create_message/3` only inserts messages in `lib/live_canvas/chat.ex`.
2. **Chat moderation authority does not exist yet.**
   - Evidence: there is no `LC.Chat` API for removing or redacting a message, and no migration or schema field describing message moderation state.
3. **Active chat clients only receive new-message broadcasts.**
   - Evidence: `LCWeb.LiveSessionChannel` broadcasts `"chat:message"` on `"chat:send"` but does not emit any update/remove event in `lib/live_canvas_web/channels/live_session_channel.ex`.
4. **GraphQL has no Chat mutation surface yet.**
   - Evidence: there is no `lib/live_canvas_gql/chat/chat_mutations.ex`, and no moderation mutation is routed through `LCGQL.Schema`.
5. **A moderation rate-limit bucket already exists for GraphQL writes.**
   - Evidence: `LCWeb.GraphQLMutationRateLimit` distinguishes `:moderation_action` buckets in `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`, and the behavior is covered in `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`.

## Scope And Assumptions

- Keep the first moderation slice deliberately small: session hosts may remove retained chat messages from their own live sessions.
- Do not introduce a broader staff/admin moderation role in this slice.
- Preserve the original message row for auditability, but expose moderated state through explicit fields and redacted client payloads.
- Keep moderation transport-safe: GraphQL mutations update durable state, and channels receive a stable update event that clients can reconcile immediately.
- Integrate with the existing Relay node/connection surface from the chat history plan rather than creating a separate moderation-only read model.

## Progress

- [x] Task 1: Add moderation persistence and host-authority APIs in `LC.Chat`
- [ ] Task 2: Expose host-scoped moderation mutations and moderated message reads in GraphQL
- [ ] Task 3: Broadcast realtime moderation updates and finalize verification

### Task 1: Add Moderation Persistence And Host-Authority APIs In `LC.Chat`

**Files:**
- Create: `priv/repo/migrations/<timestamp>_add_chat_message_moderation_fields.exs`
- Modify: `lib/live_canvas_schemas/chat.ex`
- Modify: `lib/live_canvas_schemas/chat/chat_message.ex`
- Modify: `lib/live_canvas/chat/chat_message.ex`
- Modify: `lib/live_canvas/chat.ex`
- Modify: `test/live_canvas/chat_test.exs`
- Create as needed: `test/live_canvas_schemas/chat/chat_message_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing schema and Chat tests for moderated message state
- [x] Step 2: Add failing Chat tests for host-only `remove_message/2` authority
- [x] Step 3: Run focused schema and Chat tests to verify RED
- [x] Step 4: Add additive moderation fields and implement `LC.Chat.remove_message/2`
- [x] Step 5: Re-run focused schema and Chat tests to verify GREEN
- [x] Step 6: Run `mix compile`, `MIX_ENV=test mix ecto.migrate --quiet`, and `mix typecheck`; then update checklist progress and commit milestone

**Task 1 behavior targets:**

- `chat_messages` gains explicit moderation state instead of overloading free-form metadata for core visibility rules.
- Only the host of the owning live session may remove a message.
- Removing a message is idempotent and preserves the row for history/audit use.
- Moderated messages can be projected as redacted to clients without losing server-side provenance.

**Suggested TDD details:**

Step 1 should add coverage for:
- new schema fields such as `status`, `moderated_at`, and `moderated_by_id`
- a redaction helper or payload projection path that hides the body once a message is removed

Step 2 should add coverage for:
- host removing a viewer-authored message in the host's session
- outsider and sender attempts failing when they do not own the session
- repeated removal calls returning the already-moderated record without duplicating state transitions

Step 3 command:

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_schemas/chat/chat_message_test.exs
```

Expected: FAIL because moderation fields and host-authority APIs do not exist yet.

Step 4 implementation notes:
- Keep the message row durable; do not hard-delete or physically purge in this slice.
- Prefer an enum-backed `status` field over boolean flags so future moderation states remain additive.
- Add a concise comment where authority derives from the live-session host rather than the message sender.

Step 6 commands:

```bash
MIX_ENV=test mix ecto.migrate --quiet
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_schemas/chat/chat_message_test.exs
mix typecheck
```

Expected: PASS.

Step 6 commit:

```bash
git add priv/repo/migrations lib/live_canvas_schemas/chat.ex lib/live_canvas_schemas/chat/chat_message.ex lib/live_canvas/chat/chat_message.ex lib/live_canvas/chat.ex test/live_canvas/chat_test.exs test/live_canvas_schemas/chat/chat_message_test.exs docs/plans/chat/2026-03-17-chat-moderation-actions.md
git commit -m "feat: add chat message moderation state"
```

### Task 2: Expose Host-Scoped Moderation Mutations And Moderated Message Reads In GraphQL

**Files:**
- Create: `lib/live_canvas_gql/chat/chat_mutations.ex`
- Modify: `lib/live_canvas_gql/chat/chat_types.ex`
- Modify: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Modify: `lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex`
- Create: `test/live_canvas_gql/chat/chat_mutations_test.exs`
- Modify: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/graphql_rate_limit_test.exs`

**Task 2 Step Progress:**
- [ ] Step 1: Add failing GraphQL tests for `removeLiveChatMessage` success, outsider denial, and repeated removal semantics
- [ ] Step 2: Add failing GraphQL tests for moderated messages appearing redacted in history and node reads
- [ ] Step 3: Add failing rate-limit tests proving chat moderation uses the existing `:moderation_action` bucket
- [ ] Step 4: Run focused GraphQL tests to verify RED
- [ ] Step 5: Implement Chat mutation schema/resolver wiring and moderation-aware message projections
- [ ] Step 6: Re-run focused GraphQL tests to verify GREEN
- [ ] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- `removeLiveChatMessage(input: { chatMessageId: ID! })` succeeds only for the host of the owning live session.
- Moderated messages remain in history and node reads, but their client-safe fields reflect removal state.
- Chat moderation mutations consume the existing GraphQL moderation rate-limit bucket rather than the generic mutation bucket.

**Suggested TDD details:**

Step 1 should add coverage for:
- a host removing a viewer-authored chat message
- the sender being denied when they are not the host
- a viewer from another session being denied

Step 2 should add coverage for:
- `status` or equivalent moderation fields being exposed on `ChatMessage`
- `body` being `nil` or replaced with a stable redaction placeholder after moderation
- `node(id:)` reflecting the same redacted projection as the history connection

Step 3 should add coverage for:
- `removeLiveChatMessage` returning HTTP `429` with the existing `RATE_LIMITED` contract once the moderation bucket is exhausted

Step 4 command:

```bash
mix test test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
```

Expected: FAIL because the Chat GraphQL mutation surface and moderation-aware projections do not exist yet.

Step 5 implementation notes:
- Keep the resolver viewer-scoped and derive the acting user from `current_scope.user`.
- Extend moderation mutation name detection in `LCWeb.GraphQLMutationRateLimit` so chat moderation lands in the dedicated bucket.
- Add concise comments around why moderated rows stay queryable instead of disappearing from the connection.

Step 7 commands:

```bash
mix compile
mix test test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix typecheck
```

Expected: PASS.

Step 7 commit:

```bash
git add lib/live_canvas_gql/chat/chat_mutations.ex lib/live_canvas_gql/chat/chat_types.ex lib/live_canvas_gql/chat/chat_resolver.ex lib/live_canvas_gql/schema.ex lib/live_canvas_web/plugs/graphql_mutation_rate_limit.ex test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs docs/plans/chat/2026-03-17-chat-moderation-actions.md
git commit -m "feat: expose chat moderation mutations"
```

### Task 3: Broadcast Realtime Moderation Updates And Finalize Verification

**Files:**
- Modify: `lib/live_canvas_web/channels/live_session_channel.ex`
- Modify: `test/live_canvas_web/channels/live_session_channel_test.exs`
- Modify: `docs/plans/chat/2026-03-17-chat-moderation-actions.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [ ] Step 1: Add failing channel tests for moderation update broadcasts
- [ ] Step 2: Run focused Chat/channel tests to verify RED
- [ ] Step 3: Broadcast a stable moderation update event for already-joined viewers
- [ ] Step 4: Re-run focused Chat/channel tests to verify GREEN
- [ ] Step 5: Run final verification, update plan/index tracking, and commit the milestone

**Task 3 behavior targets:**

- Active viewers receive a stable moderation update event when a retained message is removed.
- The event payload is sufficient for clients to reconcile existing message rows in-place instead of requiring a full history refetch.
- Realtime moderation updates do not change the existing `"chat:message"` contract for new-message delivery.

**Suggested TDD details:**

Step 1 should add coverage for:
- a joined viewer receiving a moderation update after a host removes one of the session's messages
- no cross-session broadcast leakage

Step 2 command:

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_web/channels/live_session_channel_test.exs
```

Expected: FAIL because the channel does not yet broadcast message update/removal events.

Step 3 implementation notes:
- Prefer a distinct event such as `"chat:message_updated"` so clients can handle message creation and message moderation as separate reconciliation paths.
- Keep the channel payload shape aligned with the GraphQL `ChatMessage` projection where practical.

Step 5 commands:

```bash
mix compile
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_mutations_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_web/channels/live_session_channel_test.exs test/live_canvas_gql/relay/graphql_rate_limit_test.exs
mix typecheck
```

Expected: PASS.

Step 5 commit:

```bash
git add lib/live_canvas_web/channels/live_session_channel.ex test/live_canvas_web/channels/live_session_channel_test.exs docs/plans/chat/2026-03-17-chat-moderation-actions.md docs/plans/README.md
git commit -m "feat: broadcast chat moderation updates"
```

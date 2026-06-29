# Chat History Query API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a Relay-first, viewer-scoped chat-history API for retained live-session messages with bidirectional pagination so clients can infinite scroll both older and newer messages.

**Architecture:** Extend `LC.Chat` with explicit history-access and ordered-query APIs instead of reusing live-only socket join semantics. Expose `ChatMessage` as a Relay node plus a `LiveSession.chatMessages` connection in GraphQL using `paginate: :both`, deterministic cursor ordering (`inserted_at`, then `id`), and ownership-safe node resolution.

**Tech Stack:** Elixir 1.15, Phoenix, Absinthe Relay, Ecto, ExUnit, Dialyzer

---

## Execution Summary

- Status: completed
- Track: `docs/plans/chat/TRACK.md`
- Current batch: none; plan complete
- Depends on: approved design in `docs/plans/chat/2026-03-17-chat-product-surface-design.md`; Tasks 1 and 2 are already complete
- Advance to: `docs/plans/chat/2026-03-17-chat-moderation-actions.md` -> `Task 2`

## Candidate Status Verification (2026-03-17)

Verified directly in active code before writing this plan:

1. **Retained chat messages already exist.**
   - Evidence: `LC.Chat.create_message/3` persists `chat_messages` rows and `LCWeb.LiveSessionChannel` broadcasts from those persisted rows.
2. **There is no durable Chat API surface yet.**
   - Evidence: `lib/live_canvas_gql/` has no `chat` files, and `LCGQL.Schema` imports Accounts/Content/Feed/Social only.
3. **Current chat access policy is join-only and rejects ended sessions.**
   - Evidence: `LC.Chat.authorize_join/2` returns `{:error, :session_ended}` and is tailored to socket joins rather than durable history access.
4. **Existing Relay connections are forward-only.**
   - Evidence: current connections such as `viewerPendingFollowRequests`, `followers`, `following`, `homeFeed`, and `liveNow` use `paginate: :forward`; no bidirectional pattern exists yet in this repo.

## Scope Decisions

- Expose chat history as a Relay connection on `LiveSession`.
- Add a Relay `ChatMessage` node so clients can refetch specific messages.
- Support both `first/after` and `last/before` pagination for infinite scroll in both directions.
- Keep history access viewer-scoped according to chat visibility policy, even for ended sessions.
- Do not add moderation or system-event behavior in this slice beyond the fields required to future-proof the node shape.

## Progress

- [x] Task 1: Add Chat context history access and deterministic ordering primitives
- [x] Task 2: Expose Relay `ChatMessage` node and bidirectional `LiveSession.chatMessages`
- [x] Task 3: Publish the chat-history client contract and run verification

### Task 1: Add Chat Context History Access And Deterministic Ordering Primitives

**Files:**
- Modify: `lib/live_canvas/chat.ex`
- Create: `lib/live_canvas/chat/history.ex`
- Modify: `test/live_canvas/chat_test.exs`

**Task 1 Step Progress:**
- [x] Step 1: Add failing context tests for authorized history access on live and ended sessions
- [x] Step 2: Add failing context tests for unauthorized outsiders, suspended users, and muted-viewer policy
- [x] Step 3: Add failing context tests for deterministic chronological ordering with `inserted_at`, then `id`
- [x] Step 4: Run focused context tests to verify RED
- [x] Step 5: Implement `authorize_history_access/2` and ordered history-query primitives in `LC.Chat`
- [x] Step 6: Re-run focused context tests to verify GREEN
- [x] Step 7: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 1 behavior targets:**

- History access uses chat visibility policy without the live-only `:session_ended` rejection.
- Owners can read their own session history.
- Suspended users and unauthorized outsiders cannot read history.
- Message ordering is stable for cursor generation: ascending `inserted_at`, then ascending `id`.

Verification commands:

```bash
mix test test/live_canvas/chat_test.exs
mix compile
mix typecheck
```

### Task 2: Expose Relay `ChatMessage` Node And Bidirectional `LiveSession.chatMessages`

**Files:**
- Create: `lib/live_canvas_gql/chat/chat_queries.ex`
- Create: `lib/live_canvas_gql/chat/chat_types.ex`
- Create: `lib/live_canvas_gql/chat/chat_resolver.ex`
- Modify: `lib/live_canvas_gql/feed/feed_types.ex`
- Modify: `lib/live_canvas_gql/schema.ex`
- Create: `test/live_canvas_gql/chat/chat_queries_test.exs`
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`

**Task 2 Step Progress:**
- [x] Step 1: Add failing GraphQL tests for `node(id: ...) { ... on LiveSession { chatMessages(...) } }` using `first/after`
- [x] Step 2: Add failing GraphQL tests for `last/before` pagination and `pageInfo.hasPreviousPage`
- [x] Step 3: Add failing GraphQL tests for `ChatMessage` node refetch and owner-safe unauthorized fallbacks
- [x] Step 4: Run focused GraphQL tests to verify RED
- [x] Step 5: Implement `ChatMessage` Relay types, node resolution, and `LiveSession.chatMessages` with `paginate: :both`
- [x] Step 6: Add concise comments around cursor ordering and ended-session history access invariants
- [x] Step 7: Re-run focused GraphQL tests to verify GREEN
- [x] Step 8: Run `mix compile` + `mix typecheck`, update checklist progress, and commit milestone

**Task 2 behavior targets:**

- `LiveSession.chatMessages` supports both `first/after` and `last/before`.
- `pageInfo` includes stable `startCursor`, `endCursor`, `hasNextPage`, and `hasPreviousPage`.
- `ChatMessage` nodes resolve only when the viewer is authorized to read the underlying session history.
- GraphQL field behavior is deterministic for unauthorized viewers; do not leak raw DB IDs or transport-specific errors.

Verification commands:

```bash
mix test test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix compile
mix typecheck
```

### Task 3: Publish The Chat-History Client Contract And Run Verification

**Files:**
- Create: `docs/contracts/mobile-graphql-chat-history.md`
- Modify: `docs/plans/chat/2026-03-17-chat-history-query-api.md`
- Modify: `docs/plans/README.md`

**Task 3 Step Progress:**
- [x] Step 1: Write the contract doc for the supported Chat history surface, including bidirectional pagination semantics
- [x] Step 2: Update the plans index so the new Chat history slice is discoverable from active work
- [x] Step 3: Run final verification on touched suites plus `mix compile` and `mix typecheck`
- [x] Step 4: Mark checklist completion and commit the milestone

**Task 3 contract targets:**

- Document the `ChatMessage` node fields.
- Document `LiveSession.chatMessages(first/after/last/before)` and its cursor guarantees.
- Document ended-session history behavior and viewer-scope access rules.
- Document that clients may infinite scroll in both directions without switching API shapes.

Verification commands:

```bash
mix test test/live_canvas/chat_test.exs test/live_canvas_gql/chat/chat_queries_test.exs test/live_canvas_gql/relay/node_queries_test.exs
mix compile
mix typecheck
```

# Chat Product Surface Design

Approved on 2026-03-17.

This design defines the next product-facing Chat work for the LiveCanvas
backend. It covers three bounded slices:

1. durable chat history queries
2. message-level moderation actions
3. richer system-event delivery and persistence

The canonical architecture constraints remain in [ARCHITECTURE.md](/Users/admin/.codex/worktrees/00a5/backend/ARCHITECTURE.md) and [conventions.md](/Users/admin/Desktop/Programming/projects/LiveCanvas/backend/docs/architecture/conventions.md).

## Current State

- Chat currently persists retained live-session messages in
  `chat_messages` through `LC.Chat.create_message/3`.
- Realtime delivery is channel-only through
  `LCWeb.LiveSessionChannel` and the `"chat:message"` event.
- GraphQL exposes `LiveSession` lifecycle mutations, but it does not expose a
  Relay-first `ChatMessage` node or connection.
- `Chat.authorize_join/2` already centralizes the effective viewer policy for
  live-session participation, including suspension, blocks, mutes, and
  followers-only access.
- `chat_messages.kind` already supports `:user_message` and `:system_event`,
  which is the preferred seam for richer product events.

## Shared Design Decisions

### Transport Split

- GraphQL owns durable chat reads and writes that mobile/web clients must be
  able to refetch.
- Phoenix Channels continue to own low-latency realtime delivery.
- New chat product work must keep those transports consistent instead of
  inventing separate policy or payload rules.

### Access Policy

- Chat history and message-level nodes are viewer-scoped.
- A viewer may read retained chat history only when that viewer could
  successfully join the live session under current `LC.Chat` policy.
- The GraphQL layer must reuse `LC.Chat` and `LC.Live` boundary APIs rather
  than reimplementing visibility rules.
- `node(id:)` for `ChatMessage` must return `nil` outside the authorized viewer
  scope, following the same ownership pattern used for follow requests,
  identities, exports, and deletion requests.

### Relay Contract And Pagination

- Durable chat history must be Relay-first: `ChatMessage` nodes, global IDs,
  connections, edges, and cursor pagination.
- The history connection must support both forward and backward pagination so
  clients can infinite scroll in either direction.
- The canonical message ordering is ascending by `inserted_at`, then `id`, so
  cursors stay deterministic even when messages share a timestamp.
- Clients should be able to request the latest window with `last`/`before`,
  fetch older history with `before`, and fetch newer messages with `after`
  without changing sort order between requests.

### Data Modeling

- `chat_messages` remains the durable source of truth for retained chat items.
- User-authored chat and system-generated chat should share the same
  persistence path whenever possible so the history API can expose one
  connection.
- Message moderation should prefer additive state on `chat_messages` over a new
  event store unless implementation research proves otherwise.
- System events should use the existing `kind = :system_event` seam with a
  bounded event-type vocabulary in metadata or adjacent fields.

## Slice Boundaries

### 1. Chat History / Query API

- Add a `ChatMessage` Relay node and a viewer-scoped connection for retained
  messages on `LiveSession`.
- Keep the history API focused on durable reads, payload normalization, and
  bidirectional pagination.
- Do not add message-level moderation behavior in this slice.

### 2. Moderator Actions On Chat Messages

- Add bounded message-level moderation operations for retained chat messages.
- The initial moderation authority should align with existing live-session
  ownership rules instead of introducing a broader staff or role system.
- Moderation state must be visible in durable history and must propagate to
  active channel subscribers through a stable transport contract.

### 3. Richer System Events

- Add product-facing system events on top of the existing system-event message
  seam so live-session lifecycle and moderation events can appear in both
  channel delivery and retained history.
- Keep the first event set intentionally small and low-noise. Join/leave events
  are in scope only if they can be recorded without creating reconnect spam or
  runtime ownership drift.

## Recommended Execution Order

1. `Chat history/query API`
2. `Moderator actions on chat messages`
3. `Richer system events in chat`

This order puts the Relay history contract first, gives moderation a stable
node/connection surface to operate on, and lets system events build on the same
durable message contract instead of inventing parallel payload shapes.

## Non-Goals

- Replacing the realtime channel transport
- Introducing a new chat service or external queue
- General-purpose trust-and-safety staff tooling
- Solving long-term analytics, retention hard-delete, or compliance-hold policy
- Expanding beyond live-session chat into DMs or room-based chat

# Chat Product Surface Design

> **Archive status:** Completed or historical plan retained for reference.
> Active execution starts from `docs/plans/NOW.md` and lane-specific `NOW.md` files.

Approved on 2026-03-17.

Day-to-day execution ordering now lives in the lane-specific `NOW.md` files plus `docs/plans/chat/TRACK.md`, with `docs/plans/NOW.md` acting as the coordinator dashboard. Use this document for rationale and approved design decisions.

This document captures the approved design for the next Chat planning set:

- retained chat history / query API
- host-owned moderator actions on chat messages
- richer system events in the chat stream

## Current State

The backend already supports live chat as a realtime channel flow:

- viewers join `live_session:*` topics through `LCWeb.LiveSessionChannel`
- `chat:send` persists a retained `chat_messages` row through `LC.Chat.create_message/3`
- joined clients receive `chat:message` broadcasts
- join/send policy already enforces suspension, follow visibility, mute rules, and throughput limits

What does not exist yet:

- no GraphQL Chat API
- no Relay `ChatMessage` node or connection
- no durable chat-history read surface
- no host-owned message moderation flow
- no richer system-event stream beyond the latent `chat_messages.kind = :system_event` seam

## Shared Design Decisions

### Transport Split

- Phoenix Channels remain the realtime transport for joining a live room and sending messages.
- GraphQL becomes the durable transport for reading retained chat history and invoking message moderation actions.
- Realtime updates and durable reads must describe the same underlying chat-message model so clients do not have to reconcile two incompatible payload shapes.

### Relay And Pagination

- Chat history is Relay-first.
- `ChatMessage` becomes a Relay node with global IDs.
- `LiveSession.chatMessages` is exposed as a Relay connection with `paginate: :both`.
- The connection must support `first/after` and `last/before` so clients can infinite scroll in both directions.
- Cursor ordering is deterministic by `inserted_at`, then `id`, with explicit tie-break handling in the query layer.

### History Access Policy

- History reads use the same viewer/host visibility and moderation policy as live chat access.
- Unlike socket joins, history access must still work for ended sessions; a durable history API cannot reject reads only because the session is no longer live.
- The implementation should therefore add a dedicated history-access policy instead of reusing the `:session_ended` branch in `authorize_join/2`.

### Message Moderation Authority

- The first moderation slice is host-owned.
- The session host can remove chat messages for that live session.
- Broader moderator/admin roles are out of scope for this planning set because the current data model does not define them.
- Sender self-delete or message restore is also out of scope for the initial moderation slice unless future product direction explicitly expands it.

### Moderation Persistence

- Message moderation is additive, not destructive.
- Moderated rows stay in `chat_messages`.
- The moderation slice should add explicit moderation state to `chat_messages` rather than overloading the existing `metadata` map with opaque transport-only values.
- Read surfaces can then omit or tombstone moderated rows deterministically without relying on best-effort channel state.

### System Event Modeling

- System events stay in the existing `chat_messages` table through `kind = :system_event`.
- To keep the slice additive, system events remain actor-backed instead of introducing senderless rows in the first pass.
- `sender_id` therefore continues to reference the real actor who caused the event:
  - host for start / go-live / end
  - viewer for join / leave
  - moderator for future moderation-generated events if that follow-up is added later
- Event-specific details live in structured `metadata`, with a stable event-type discriminator exposed through GraphQL and channel payloads.

### Producer Boundaries

- `LC.Live` remains the owner of lifecycle state transitions.
- Chat system-event persistence should be triggered from the same successful lifecycle paths that already own those transitions so channel disconnect paths and GraphQL lifecycle paths stay consistent.
- User-originated `chat:send` stays separate from lifecycle-generated system events, and the `:chat_send` limiter must not be reused for those system events.

## Sequence

Recommended execution order:

1. Chat history / query API
2. Host-owned message moderation actions
3. Richer system events in the chat stream

This order keeps the foundational durable read model in place before adding moderation or event expansion, and it ensures later slices can reuse the same `ChatMessage` Relay node and bidirectional connection instead of inventing parallel shapes.

## Non-Goals

- dedicated moderator/admin role modeling
- compliance hard-delete follow-up
- replacing channel sends with GraphQL mutations
- replay/content scope beyond retained live chat

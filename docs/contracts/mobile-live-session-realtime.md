# Mobile Live Session Realtime Contract

## Overview

This contract freezes the mobile-facing Phoenix Channel surface for ephemeral live-session updates. Use the GraphQL live-session contract for durable reads and lifecycle mutations, and use the chat-history contract for retained messages that must survive reconnects.

## Topic Naming And Join

- Join topic: `live_session:<session_id>`
- `session_id` is the current positive integer live-session identifier segment used by the transport. The realtime topic does not accept Relay/global IDs.
- Join params are currently ignored; authorization comes from the authenticated socket identity.

Join prerequisites:

- The socket must authenticate as an active viewer.
- The topic suffix must parse as a positive integer, or the join fails with `reason: "invalid_session_id"`.
- The session must exist and still be joinable. Missing sessions fail with `reason: "session_not_found"`. Ended sessions fail with `reason: "session_ended"`.
- Audience, mute, block, and suspension policies must allow the viewer to join, or the join fails with `reason: "not_authorized"`.
- Join attempts are rate-limited per viewer and fail with `reason: "rate_limited"` when exceeded.
- Remote-runtime lookup or handoff failures collapse to `reason: "session_unavailable"` instead of leaking runtime routing details.

Successful joins return the current aggregate session state as the join ack payload:

```json
{
  "session_state": {
    "status": "starting",
    "visibility": "public",
    "viewer_count": 1
  }
}
```

`session_state` is intentionally bounded:

- `status` is one of `starting`, `live`, or `ended`
- `visibility` is one of `public` or `followers`
- `viewer_count` is the aggregate active viewer count for the room

The join ack never includes participant rosters, user IDs, or other runtime-only internals.

## `session:state`

The joined topic broadcasts `session:state` with the same bounded payload shape as the join ack:

```json
{
  "session_state": {
    "status": "live",
    "visibility": "public",
    "viewer_count": 12
  }
}
```

`session:state` is rebroadcast after:

- a successful join
- a disconnect-driven leave reconciliation
- `goLiveSession`
- `endLiveSession`

The server re-reads persisted session state before publishing so lifecycle broadcasts reflect the durable session status and visibility rather than stale channel assigns.

## `chat:message`

`chat:message` broadcasts both user chat rows and bounded system events on the joined `live_session:<session_id>` topic.

Stable payload shape:

```json
{
  "message": {
    "id": 123,
    "body": "hello",
    "sender_id": 456,
    "inserted_at": "2026-04-10T23:17:09Z",
    "kind": "user_message",
    "status": "active",
    "moderated_at": null,
    "metadata": {}
  }
}
```

Field rules:

- `id` is the retained chat-message database identifier
- `body` is a string for visible messages and may be `null` for redacted content
- `sender_id` is the integer sender identifier and may be `null` when the backing message has no sender
- `inserted_at` and `moderated_at` are ISO 8601 UTC timestamp strings when present
- `kind` is currently `user_message` or `system_event`
- `status` is currently `active` or `removed`
- `metadata` is always a JSON object

Current bounded system-event cases delivered through `chat:message`:

- `metadata.event_type == "session_live"` for the host transition to live
- `metadata.event_type == "session_ended"` for the host terminal transition
- `metadata.event_type == "message_removed"` for the follow-up moderation system event after a chat redaction

## `chat:message_updated`

`chat:message_updated` rebroadcasts an in-place update for an existing retained message on the same joined topic.

Stable payload shape:

```json
{
  "message": {
    "id": 123,
    "body": null,
    "sender_id": 456,
    "inserted_at": "2026-04-10T23:17:09Z",
    "kind": "user_message",
    "status": "removed",
    "moderated_at": "2026-04-10T23:18:02Z",
    "metadata": {}
  }
}
```

The current mobile-facing use is moderation redaction: the original message keeps its ID and sender, `body` becomes `null`, and `status` becomes `removed`.

## Disconnect Control

The backend uses control-topic broadcasts to close already-joined channels when durable lifecycle mutations invalidate the current socket state.

Stable control events:

- Session-wide control topic: `live_session_control:<session_id>`
- Viewer-scoped control topic: `live_session_control:<session_id>:user:<viewer_id>`
- Event name: `disconnect`
- Payload shape: `{"reason": "<reason>"}` with currently documented reasons `session_ended` and `viewer_left`

Mobile clients do not join these control topics directly. The client-observable contract is:

- `endLiveSession` publishes the terminal `chat:message` system event first
- then publishes the terminal `session:state`
- only after those events does the server close already-joined viewers with `reason: "session_ended"`
- `leaveLiveSession` closes only the caller's joined channel with `reason: "viewer_left"`

Clients should treat the server-driven close as authoritative and reconcile durable state from GraphQL or retained chat history rather than trying to keep the old channel alive.

## Related Contracts

- Live-session GraphQL: `docs/contracts/mobile-live-session-graphql.md`
- Retained chat history: `docs/contracts/mobile-graphql-chat-history.md`

Any change to the topic naming, join error reasons, aggregate state shape, message payload fields, or disconnect ordering should be treated as a mobile API change and planned explicitly before landing downstream client work.

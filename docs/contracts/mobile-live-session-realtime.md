# Mobile Live Session Realtime Contract

## Overview

This contract freezes the mobile-facing Phoenix Channel surface for ephemeral live-session updates. Use the GraphQL live-session contract for durable reads and lifecycle mutations, and use the chat-history contract for retained messages that must survive reconnects.

## Topic Naming And Join

- Join topic: the exact `LiveSession.channelTopic` value returned by GraphQL.
- Clients must treat the topic as opaque and must not construct, parse, or persist topic identifier segments.
- Join params are currently ignored; authorization comes from the authenticated socket identity.

Join prerequisites:

- The socket must authenticate as an active viewer.
- The topic must be a server-issued live-session topic, or the join fails with `reason: "invalid_session_id"`.
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

## `timeline:event`

The joined topic broadcasts `timeline:event` whenever a visible timeline event is created.

Stable payload shape:

```json
{
  "event": {
    "__typename": "ChatMessageEvent",
    "id": "Q2hhdE1lc3NhZ2VFdmVudDoxMjM=",
    "event_type": "chat_message_sent",
    "body": "hello",
    "actor": {
      "id": "VXNlcjo0NTY="
    },
    "occurred_at": "2026-06-01T23:17:09Z",
    "edited": false,
    "edit_count": 0,
    "edited_at": null
  }
}
```

`event.id` is a Relay global ID when the event type has a mobile GraphQL node type. Clients must treat it as opaque.
`event.actor` is `null` or an object containing the actor's Relay `User.id`. Clients must not expect or derive raw actor database IDs from realtime payloads.

## `timeline:event_updated`

The joined topic broadcasts `timeline:event_updated` when a visible timeline event changes in place, such as a chat-message edit or moderation state change. The payload uses the same `{"event": {...}}` envelope as `timeline:event`.

Stable payload shape:

```json
{
  "event": {
    "__typename": "ChatMessageEvent",
    "id": "Q2hhdE1lc3NhZ2VFdmVudDoxMjM=",
    "event_type": "chat_message_sent",
    "body": "hello, edited",
    "actor": {
      "id": "VXNlcjo0NTY="
    },
    "occurred_at": "2026-06-01T23:19:09Z",
    "edited": true,
    "edit_count": 1,
    "edited_at": "2026-06-01T23:20:09Z"
  }
}
```

## `timeline:event_removed`

The joined topic broadcasts `timeline:event_removed` when a timeline event should be removed from the active client view.

Stable payload shape:

```json
{
  "removed_timeline_event_id": "Q2hhdE1lc3NhZ2VFdmVudDoxMjM="
}
```

## Disconnect Control

The backend uses control-topic broadcasts to close already-joined channels when durable lifecycle mutations invalidate the current socket state.

Stable control events:

- Session-wide control topic: `live_session_control:<session_id>`
- Viewer-scoped control topic: `live_session_control:<session_id>:user:<viewer_id>`
- Event name: `disconnect`
- Payload shape: `{"reason": "<reason>"}` with currently documented reasons `session_ended` and `viewer_left`

Mobile clients do not join these control topics directly. The client-observable contract is:

- `endLiveSession` publishes the terminal `timeline:event` lifecycle event first
- then publishes the terminal `session:state`
- only after those events does the server close already-joined viewers with `reason: "session_ended"`
- `leaveLiveSession` closes only the caller's joined channel with `reason: "viewer_left"`

Clients should treat the server-driven close as authoritative and reconcile durable state from GraphQL or retained chat history rather than trying to keep the old channel alive.

## Related Contracts

- Live media signaling: `docs/contracts/mobile-live-media-signaling.md`
- Live-session GraphQL: `docs/contracts/mobile-live-session-graphql.md`
- Retained chat history: `docs/contracts/mobile-graphql-chat-history.md`

Any change to the topic naming, join error reasons, aggregate state shape, timeline event payload fields, or disconnect ordering should be treated as a mobile API change and planned explicitly before landing downstream client work.

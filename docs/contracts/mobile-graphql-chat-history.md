# Mobile GraphQL Chat History Contract

## Overview

This contract freezes the mobile-facing GraphQL surface for durable live-session
chat and timeline history. Clients read retained history through Relay nodes and
connections, and they keep the same API shape whether they are paging older
events, paging newer events, or reading a session after it has ended.

## Entry Points

- `node(id: LiveSessionID) { ... on LiveSession { timelineEvents(first, after, last, before) { ... } } }`
- `node(id: ChatMessageEventID) { ... on ChatMessageEvent { ... } }`
- `node(id: LiveSessionStartedEventID) { ... on LiveSessionStartedEvent { ... } }`
- `node(id: LiveSessionEndedEventID) { ... on LiveSessionEndedEvent { ... } }`

All entry points use Relay global IDs. Clients should treat `LiveSession` as the
collection entry point and concrete timeline event nodes as refetch entry points
for individual retained events.

## `LiveSession.timelineEvents`

`timelineEvents` is a Relay connection on `LiveSession` with bidirectional
pagination enabled.

- Supported arguments: `first`, `after`, `last`, `before`
- Supported connection fields: `edges { cursor node { ... } }` and
  `pageInfo { startCursor endCursor hasNextPage hasPreviousPage }`
- Ordering is always chronological ascending within the returned page: oldest
  event first, newest event last.
- Cursor generation is deterministic. The server sorts retained timeline events
  by `occurredAt` ascending and then by the underlying event ID ascending to
  break timestamp ties.
- `first` and `after` are the forward-scrolling path. Use them to fetch newer
  events after the current page's `endCursor`.
- `last` and `before` are the backward-scrolling path. Use them to fetch older
  events before the current page's `startCursor`.
- The returned edge order does not flip when using `last`/`before`; pages still
  come back in chronological ascending order.

Example shape:

```graphql
query TimelineHistory(
  $id: ID!
  $first: Int
  $after: String
  $last: Int
  $before: String
) {
  node(id: $id) {
    ... on LiveSession {
      timelineEvents(first: $first, after: $after, last: $last, before: $before) {
        edges {
          cursor
          node {
            __typename
            id
            eventType
            occurredAt
            actor {
              id
            }
            ... on ChatMessageEvent {
              body
              edited
              editCount
              editedAt
            }
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
        }
      }
    }
  }
}
```

## Timeline Event Nodes

`LiveSessionTimelineEvent` is the retained-history interface.

- `id: ID!`
- `eventType: LiveSessionTimelineEventType!`
- `occurredAt: String!`
- `actor: User`

Current `LiveSessionTimelineEventType` values:

- `CHAT_MESSAGE_SENT`
- `LIVE_SESSION_STARTED`
- `LIVE_SESSION_ENDED`

`ChatMessageEvent` is the retained user-message node.

- `id: ID!`
- `eventType: LiveSessionTimelineEventType!`
- `occurredAt: String!`
- `actor: User`
- `body: String!`
- `edited: Boolean!`
- `editCount: Int!`
- `editedAt: String`

`LiveSessionStartedEvent` and `LiveSessionEndedEvent` expose only the shared
timeline fields. `occurredAt` is returned as an ISO 8601 UTC timestamp string.
`actor` is nullable, so clients must tolerate missing actor objects.

## Access Model

Retained history is viewer-scoped.

- Session hosts can read their own retained history as long as their account is
  active.
- Public-session history remains readable to active viewers after a session
  ends.
- Followers-only history remains readable to the host and to viewers who still
  satisfy the follow-visibility policy after a session ends.
- History reads reuse chat visibility policy without the live-only "session
  ended" rejection that applies to socket joins.
- Suspended viewers, unauthorized outsiders, and viewers who have muted the host
  do not receive retained history.

Unauthorized behavior is intentionally stable:

- `node(id: TimelineEventID)` returns `null` when the viewer is missing or cannot
  read the owning session's history.
- `LiveSession.timelineEvents(...)` returns an empty connection when the viewer
  cannot read that session's retained history.

## Client Expectations

- Clients can infinite scroll in both directions without switching to a
  different endpoint or payload shape.
- Initial live-session watch screens should load the newest retained events with
  `last`, preserving chronological edge order.
- Forward pagination is the path for newer events; backward pagination is the
  path for older events.
- Realtime `timeline:event`, `timeline:event_updated`, and
  `timeline:event_removed` payloads merge into retained history by opaque event
  ID.
- Ended sessions keep the same history API shape as live sessions; the
  difference is authorization, not transport.
- Any contract changes to node fields, cursor ordering, or fallback behavior
  should be treated as a downstream mobile API change and planned explicitly.

# Mobile GraphQL Chat History Contract

## Overview

This contract freezes the mobile-facing GraphQL surface for durable chat history. Clients read retained chat through Relay nodes and connections, and they keep the same API shape whether they are paging older messages, paging newer messages, or reading a session after it has ended.

## Entry Points

- `node(id: LiveSessionID) { ... on LiveSession { chatMessages(first, after, last, before) { ... } } }`
- `node(id: ChatMessageID) { ... on ChatMessage { ... } }`

Both entry points use Relay global IDs. Clients should treat `LiveSession` as the collection entry point and `ChatMessage` as the refetch entry point for a single retained message.

## `LiveSession.chatMessages`

`chatMessages` is a Relay connection on `LiveSession` with bidirectional pagination enabled.

- Supported arguments: `first`, `after`, `last`, `before`
- Supported connection fields: `edges { cursor node { ... } }` and `pageInfo { startCursor endCursor hasNextPage hasPreviousPage }`
- Ordering is always chronological ascending within the returned page: oldest message first, newest message last.
- Cursor generation is deterministic. The server sorts retained messages by `insertedAt` ascending and then by the underlying message ID ascending to break timestamp ties.
- `first` and `after` are the forward-scrolling path. Use them to fetch newer messages after the current page's `endCursor`.
- `last` and `before` are the backward-scrolling path. Use them to fetch older messages before the current page's `startCursor`.
- The returned edge order does not flip when using `last`/`before`; pages still come back in chronological ascending order.

Example shape:

```graphql
query ChatHistory($id: ID!, $first: Int, $after: String, $last: Int, $before: String) {
  node(id: $id) {
    ... on LiveSession {
      chatMessages(first: $first, after: $after, last: $last, before: $before) {
        edges {
          cursor
          node {
            id
            body
            kind
            insertedAt
            sender {
              id
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

## `ChatMessage` Node

`ChatMessage` is a Relay node for refetching one retained message.

- `id: ID!`
- `body: String`
- `kind: ChatMessageKind!`
- `insertedAt: String!`
- `sender: User`

Current `ChatMessageKind` values:

- `USER_MESSAGE`
- `SYSTEM_EVENT`

`insertedAt` is returned as an ISO 8601 UTC timestamp string. `sender` is nullable, so clients should tolerate a missing sender object.

## Access Model

Chat history is viewer-scoped.

- Session hosts can read their own retained history as long as their account is active.
- Public-session history remains readable to active viewers after a session ends.
- Followers-only history remains readable to the host and to viewers who still satisfy the follow-visibility policy after a session ends.
- History reads reuse chat visibility policy without the live-only "session ended" rejection that applies to socket joins.
- Suspended viewers, unauthorized outsiders, and viewers who have muted the host do not receive retained history.

Unauthorized behavior is intentionally stable:

- `node(id: ChatMessageID)` returns `null` when the viewer is missing or cannot read the owning session's history.
- `LiveSession.chatMessages(...)` returns an empty connection when the viewer cannot read that session's retained history.

## Client Expectations

- Clients can infinite scroll in both directions without switching to a different endpoint or payload shape.
- Forward pagination is the path for newer messages; backward pagination is the path for older messages.
- Ended sessions keep the same history API shape as live sessions; the difference is authorization, not transport.
- Any contract changes to the node fields, cursor ordering, or fallback behavior should be treated as a downstream mobile API change and planned explicitly.

# Mobile Live Session GraphQL Contract

## Overview

This contract freezes the mobile-facing GraphQL surface for live-session discovery, profile reads, Relay refetch, and lifecycle mutations. Clients should treat this document as the supported durable API for live-session state and use the separate chat-history and realtime contract docs for retained messages and Phoenix Channel event delivery.

## Relay And ID Rules

- Every public live-session identifier is a Relay global ID.
- `LiveSession` IDs are required for `node(id:)`, `goLiveSession`, `joinLiveSession`, `leaveLiveSession`, and `endLiveSession`.
- `recordingMediaAssetId` on `endLiveSession` must be a Relay `MediaAsset` ID when provided.
- Passing a non-`LiveSession` ID where a live-session ID is required returns `errors: [{field: "liveSessionId", message: "is invalid"}]`.
- Passing a non-`MediaAsset` ID as `recordingMediaAssetId` returns `errors: [{field: "recordingMediaAssetId", message: "is invalid"}]`.

## `LiveSession` Shape

Supported `LiveSession` fields for mobile clients:

- `id: ID!`
- `status: LiveSessionStatus!`
- `visibility: LiveSessionVisibility!`
- `channelTopic: String`
- `insertedAt: String!`
- `startedAt: String`
- `endedAt: String`
- `host: User!`
- `recordingMediaAsset: LiveSessionRecordingMediaAsset`
- `timelineEvents(first, after, last, before): LiveSessionTimelineEventConnection`

Current enum values:

- `LiveSessionStatus`: `STARTING`, `LIVE`, `ENDED`
- `LiveSessionVisibility`: `PUBLIC`, `FOLLOWERS`

Field semantics:

- `insertedAt`, `startedAt`, and `endedAt` are ISO 8601 UTC timestamp strings.
- `startedAt` is `null` until the host successfully transitions the session to `LIVE`.
- `endedAt` is `null` until the session reaches `ENDED`.
- `channelTopic` is an opaque Phoenix Channel topic string for visible `STARTING` and `LIVE` sessions.
- `channelTopic` is `null` for `ENDED` sessions.
- Mobile clients must pass `channelTopic` to the Phoenix Channel client exactly as returned; they must not parse it or derive it from a Relay ID.
- Channel joins still re-apply viewer authorization and session-state checks.
- `host.id` is always a Relay `User` ID.
- `recordingMediaAsset` is `null` when no durable recording is linked.
- `timelineEvents` is the retained chat and lifecycle history connection for
  the session. See `docs/contracts/mobile-graphql-chat-history.md` for event
  fields, pagination semantics, and authorization fallbacks.

Supported `recordingMediaAsset` fields:

- `id: ID!`
- `processingState: MediaProcessingState!`
- `publicUrl: String`

Recording assets are exposed only for durable recordings that the viewer is allowed to read through the owning session's retained-history policy.

## Read Entry Points

### Discovery Feeds

- `liveNow(first, after)` returns a Relay forward connection of visible active sessions (`STARTING` and `LIVE`) so viewers can enter pre-live media negotiation.
- `replayFeed(first, after)` returns a Relay forward connection of ended sessions with linked durable recordings visible to the viewer.

Ordering is stable:

- `liveNow` returns fresh `STARTING` preflight sessions before `LIVE` sessions so viewers can answer waiting hosts; stale preflights expire from discovery, and live rows then sort by `startedAt`, `insertedAt`, and ID.
- `replayFeed` is newest-ended first (`endedAt` descending, then `insertedAt`, then ID).

Both connections use standard Relay fields:

- `edges { cursor node { ...LiveSessionFields } }`
- `pageInfo { hasNextPage endCursor }`

### Profile Reads

Visible `User` nodes expose the same live-session surfaces that `viewer` exposes:

- `currentLiveSession: LiveSession`
- `replayFeed(first, after): LiveSessionConnection`

Viewer-scoped fallbacks are stable:

- `currentLiveSession` resolves to `null` when the viewer cannot see the host's current session.
- `replayFeed` resolves to an empty connection when the viewer cannot see that host's replay feed.

### Relay Node Refetch

- `node(id: LiveSessionID) { ... on LiveSession { ... } }` refetches a visible live session or replay by Relay ID.
- Active-session node reads reuse join visibility.
- Ended-session node reads reuse retained-history visibility.
- Unauthorized `LiveSession` node refetches return `null` rather than a GraphQL error.

## Lifecycle Mutations

### `startLiveSession`

```graphql
mutation StartLiveSession($visibility: LiveSessionVisibility) {
  startLiveSession(input: {visibility: $visibility}) {
    liveSession { ...LiveSessionFields }
    errors { field message }
  }
}
```

- Starts a new session for the authenticated viewer.
- The returned `liveSession.status` starts at `STARTING`.
- `visibility` accepts `PUBLIC` or `FOLLOWERS`.
- Without viewer scope, the mutation returns `errors: [{field: null, message: "unauthenticated"}]`.

### `goLiveSession`

- Host-only transition from `STARTING` to `LIVE`.
- On success, `startedAt` is populated and the returned session keeps the same Relay ID.
- If media negotiation is not ready yet, callers receive
  `errors: [{field: null, message: "media_not_ready"}]`.
- Non-host callers receive `errors: [{field: null, message: "not_authorized"}]`.
- If an end transition wins first, callers receive `errors: [{field: null, message: "ended"}]`.

`media_not_ready` is a retryable setup state. Mobile hosts should call
`prepareLiveMediaSession`, join the returned signaling topic, exchange the
required media negotiation messages, and then retry `goLiveSession`. Backend v1
readiness is tracked in durable live-media readiness storage, but clients should
still handle `media_not_ready` by renegotiating or retrying setup.

### `joinLiveSession`

- Adds the authenticated viewer to a joinable live session and returns the visible `LiveSession`.
- Audience checks match channel join policy.
- Unauthorized viewers receive `errors: [{field: null, message: "not_authorized"}]`.
- Join attempts are rate-limited and return `errors: [{field: null, message: "rate_limited"}]` when exceeded.

### `leaveLiveSession`

- Best-effort cleanup for the authenticated viewer's participation record.
- Returns `{left: true, errors: []}` on success.
- Cleanup remains allowed after the session has ended so clients can clear stale participation state after terminal delivery.

### `endLiveSession`

- Host-only terminal transition to `ENDED`.
- Accepts optional `recordingMediaAssetId` to link a durable recording asset owned by the host.
- On success, `endedAt` is populated and the response may include `recordingMediaAsset`.

Stable recording-link validation outcomes use the standard `errors { field, message }` shape:

- A non-`MediaAsset` Relay ID returns `errors: [{field: "recordingMediaAssetId", message: "is invalid"}]`.
- An asset owned by another user returns `errors: [{field: "recordingMediaAssetId", message: "must belong to the session host"}]`.
- An asset that is not yet durable returns `errors: [{field: "recordingMediaAssetId", message: "must be uploaded or processed"}]`.
- Repeating `endLiveSession` after the session is already terminal returns `errors: [{field: null, message: "ended"}]`.

## Access Model

- Host-only lifecycle operations: `goLiveSession` and `endLiveSession`.
- Viewer-scoped participation operations: `joinLiveSession` and `leaveLiveSession`.
- Discovery and profile reads apply the existing visibility, follow, block, mute, and suspension policy.
- `LiveSession` node refetch and child fields re-apply authorization instead of trusting a previously fetched parent node or raw foreign key.

## Related Contracts

- Retained chat history: `docs/contracts/mobile-graphql-chat-history.md`
- Auth/social baseline: `docs/contracts/mobile-graphql-phase2.md`
- Media signaling setup: `docs/contracts/mobile-live-media-signaling.md`

Any change to the fields, authorization fallbacks, ID rules, or user-error messages documented here should be treated as a mobile API change and planned explicitly before landing downstream client work.

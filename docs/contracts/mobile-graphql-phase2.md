# Mobile GraphQL Phase 2 Contract

## Overview

Phase 2 freezes the mobile-facing GraphQL contract so client teams can build against one documented surface. This slice viewer-scopes sensitive social reads, removes legacy auth mutations, and publishes the resulting contract in one place.

## Authentication Entry Points

- `beginAuthChallenge(provider: auth_provider!, purpose: auth_challenge_purpose!, magicLink: magic_link_auth_input, passkey: passkey_auth_input)` starts a challenge for password, magic link, or passkey sign-ins and returns `challenge` plus any errors.
- `signUp(provider: auth_provider!, password: password_auth_input, magicLink: magic_link_auth_input, oauth: oauth_auth_input, passkey: passkey_auth_input)` issues access/refresh tokens for new accounts. Supported `provider` modes include `PASSWORD`, `MAGIC_LINK`, `GOOGLE`, `APPLE`, and `PASSKEY`.
- `logIn(provider: auth_provider!, password: password_auth_input, magicLink: magic_link_auth_input, oauth: oauth_auth_input, passkey: passkey_auth_input)` consolidates every supported login mode into one entrypoint and always returns the Relay-style `accessToken`/`refreshToken` payload with `errors`.

The refresh/revoke lifecycle continues to rely on the existing tokens mutations such as `issueViewerAuthTokens` and `revokeRefreshToken`. No deprecated auth mutations (`loginWithPassword`, `requestMagicLinkLogin`, `loginWithMagicLink`) remain in the schema.

## Viewer-Scoped Social Reads

- `relationshipState(creatorId: ID!)` and `isMuted(creatorId: ID!)` now derive the viewer from the authenticated scope (no `viewerId` argument). When the viewer lacks scope or the creator cannot be resolved, fields return stable scalar fallbacks instead of GraphQL errors.
- `viewerPendingFollowRequests(first: Int, after: String)` exposes inbound follow requests that the authenticated viewer can accept or decline; each edge contains a `FollowRequest` node with `state`, `requestedAt`, and the `follower` `User`.
- `followers` and `following` respect each `User`’s `privacyMode` (`PUBLIC` / `PRIVATE`). Private profiles still surface `followers`/`following` edges to approved viewers while hiding the connection from the rest of the graph, and `privacyMode` is now readable on every `User` node to allow clients to adjust UI affordances.

## Viewer-Scoped Content Reporting

`reportPost(input: {postId: ID!, reason: PostReportReason!, details: String})` lets an authenticated viewer report a visible post. The reporter comes from viewer scope; clients must not send a reporter ID.

Supported `PostReportReason` values:

- `SPAM`
- `HARASSMENT`
- `HATE`
- `VIOLENCE`
- `SEXUAL_CONTENT`
- `SELF_HARM`
- `ILLEGAL`
- `OTHER`

The successful payload returns:

- `report.id`: Relay `PostReport` ID
- `report.postId`: Relay `Post` ID
- `report.reporterId`: Relay `User` ID for the authenticated reporter
- `report.reason`
- `report.status`, currently `OPEN` for newly created reports
- `report.details`
- `report.insertedAt`

Reporting is idempotent per viewer/post pair. If the same viewer reports the same post again, the backend returns the original `PostReport` instead of creating a duplicate or replacing the first reason/details.

Stable error outcomes use the same payload `errors { field message }` pattern as the other content mutations:

- Missing viewer scope returns `errors: [{field: null, message: "unauthenticated"}]`.
- Invalid or wrong-type `postId` returns `errors: [{field: "postId", message: "invalid_id"}]` or `errors: [{field: "postId", message: "invalid_type"}]`.
- Posts outside the viewer's visible feed policy return `errors: [{field: "postId", message: "not_found"}]`.
- A viewer reporting their own post returns `errors: [{field: "postId", message: "own_post"}]`.
- `details` is optional and limited to 2000 characters.

`PostReport` is a Relay node, but `node(id:)` refetch is reporter-scoped. Report IDs do not let another viewer enumerate or read someone else's report.

## Relay Expectations

Every social/content connection in Phase 2 remains Relay-first: nodes have global IDs, all connection fields accept `first`/`after` pagination, and `FollowRequest` plus `PostReport` nodes are resolvable via `node(id:)` for viewer-owned refetch workflows. Consumers should assume deterministic cursors derived from timestamps and consistent error messaging (permission violations return payload errors rather than raw GraphQL errors).

## Stability Notes

- The mobile client contract no longer exposes the legacy auth mutations (`loginWithPassword`, `requestMagicLinkLogin`, `loginWithMagicLink`). The supported auth surface is documented above.
- Viewer-scoped social reads and the pending follow-request inbox are the only new social behaviors shipped in Phase 2; all other fields retain their pre-existing semantics.
- Content reporting is viewer-scoped and moderation-queued only. Staff review queues, admin decisions, notifications, and report status transitions are intentionally outside this contract.

Documented endpoint references:

- Authentication: `beginAuthChallenge`, `signUp`, `logIn`, `issueViewerAuthTokens`, `revokeRefreshToken`.
- Social: `relationshipState`, `isMuted`, `viewerPendingFollowRequests`, `followers`, `following`, and the `privacyMode` field on `User`.
- Content: `reportPost` and reporter-owned `PostReport` node refetch.

Any deviations from this contract should be captured in follow-up plans and approved before landing downstream mobile work.

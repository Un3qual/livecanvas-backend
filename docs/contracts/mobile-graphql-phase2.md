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

## Relay Expectations

Every social connection in Phase 2 remains Relay-first: nodes have global IDs, all connection fields accept `first`/`after` pagination, and the `followRequest` node is resolvable via `node(id:)` for refetch workflows. Consumers should assume deterministic cursors derived from timestamps and consistent error messaging (permission violations return `UserError` payloads rather than raw GraphQL errors).

## Stability Notes

- The mobile client contract no longer exposes the legacy auth mutations (`loginWithPassword`, `requestMagicLinkLogin`, `loginWithMagicLink`). The supported auth surface is documented above.
- Viewer-scoped social reads and the pending follow-request inbox are the only new social behaviors shipped in Phase 2; all other fields retain their pre-existing semantics.

Documented endpoint references:

- Authentication: `beginAuthChallenge`, `signUp`, `logIn`, `issueViewerAuthTokens`, `revokeRefreshToken`.
- Social: `relationshipState`, `isMuted`, `viewerPendingFollowRequests`, `followers`, `following`, and the `privacyMode` field on `User`.

Any deviations from this contract should be captured in follow-up plans and approved before landing downstream mobile work.

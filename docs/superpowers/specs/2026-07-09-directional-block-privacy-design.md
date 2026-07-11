# Directional Block Privacy Design

Date: 2026-07-09
Status: implemented and verified
Owner: backend and mobile lanes

## Goal

When one user blocks another, the blocking user's account must be
observationally indistinguishable from a missing account to the blocked user.
The invariant applies to the public GraphQL and mobile profile surfaces, not
only to the wording rendered by the client.

For an authenticated viewer `V` and target user `T`:

- If `T` blocked `V`, profile and discovery APIs must behave as though `T` does
  not exist.
- If `V` blocked `T` and `T` did not block `V`, `T` remains addressable to `V`
  and may retain a viewer-owned `BLOCKED` state. This preserves a future
  direction-safe unblock path.
- Content, live-session, and chat authorization continue treating a block in
  either direction as a hard visibility boundary.
- Staff-only moderation access remains governed by staff authorization rather
  than the consumer profile rule.

## Current Failure

The backend currently has a direction-ambiguous block policy at several public
boundaries:

- Relay `node(id:)` loads `User` directly without the authenticated viewer.
- `relationshipState` returns `BLOCKED` for a block in either direction.
- Social mutations load the target before considering whether that target
  blocked the actor.
- Followers, following, pending-request, and contact-match projections can
  return user rows without filtering users who blocked the viewer.
- Mobile receives a real `User` plus `BLOCKED`, renders profile identity and
  privacy data, and only changes the relationship wording to `Unavailable`.

This makes the API response and parts of the UI observably different from a
missing user.

## Considered Approaches

### 1. Mask only in mobile

Render the generic missing-profile screen when mobile receives `BLOCKED`.

Rejected because GraphQL would still expose a non-null user node and the
explicit block state. Alternate clients could use the API as a block oracle.

### 2. Hide both block directions

Return a missing user whenever either party blocked the other.

Rejected because it would also hide a target from the user who created the
block, preventing direction-safe block management and a future unblock flow.

### 3. Enforce directional hiding at the public boundary

Recommended. Add one Social-owned directional predicate for "target blocked
viewer" and reuse it across GraphQL node lookup, social reads and writes, and
user-bearing discovery projections. Keep symmetric block checks for content
authorization.

This is the narrowest complete fix because it closes the observable boundary
without changing the persistence model, Relay IDs, or internal visibility
semantics.

## Design

### Domain policy

`LC.Social` will expose a clearly directional helper whose call shape reads as
"viewer is blocked by target." It will also provide query/list helpers needed
to remove users who blocked the viewer without introducing per-row GraphQL
queries.

The existing symmetric relationship/content policy remains intact. Public
GraphQL projection code decides whether the symmetric `:blocked` result is safe
to expose only after the directional check passes.

### GraphQL user lookup

Relay user-node lookup will receive the full resolution, derive the
authenticated viewer when present, and return `nil` when the fetched target
blocked that viewer. Invalid, deleted, and directionally hidden user IDs will
therefore produce the same `node: null` response.

Unauthenticated public lookup, self-lookup, and lookup of a user blocked by the
viewer remain compatible with current behavior.

### Social read and write normalization

For a target that blocked the viewer:

- `relationshipState` returns the same neutral value as a missing target.
- `isMuted` returns the same value as a missing target.
- Follow, block, mute, unmute, accept-request, and decline-request target
  lookups return the same `not_found` payload shape as a missing target.

The resolver must perform the directional visibility check before invoking a
write so persistence errors cannot become a side channel.

### User-bearing projections

Authenticated projections must remove any candidate user who blocked the
viewer:

- followers and following connections;
- viewer pending follow requests and follow-request node refetches;
- contact-match `matchedUsers` values, including list, upsert payload, and
  Relay node refetch paths.

Existing post, live-session, and timeline-event boundaries already apply the
symmetric read policy before exposing their associated user and remain under
focused regression coverage rather than being redesigned.

### Mobile behavior

Mobile continues using the existing null-user path and generic message,
`This profile is unavailable.` A directionally hidden target must arrive as a
null user node, so the client never renders its profile summary, privacy mode,
relationship card, live session, or connection links.

The `BLOCKED` presentation remains for the viewer-owned direction only. This
change does not add unblock or unfollow UI.

## Error and Compatibility Contract

- A hidden target and a missing target return identical public read values and
  identical social-mutation error messages and fields.
- The fix does not reveal block direction through a new enum or boolean.
- The Relay global ID format and schema field names remain unchanged.
- Existing blocks and follow rows are not deleted or migrated.
- The blocker can still inspect a target they blocked, subject to existing
  content-visibility rules.
- Staff moderation behavior is unchanged.

## Verification Design

Tests will be written before production changes and must first fail on the
current implementation.

1. A real GraphQL profile query proves a target who blocked the viewer and a
   deleted/missing user return the same `node`, `relationshipState`, and
   `isMuted` values.
2. Social mutation tests prove hidden and missing targets produce the same
   payload without writing reciprocal block or mute rows.
3. Connection, pending-request, follow-request-node, and contact-match tests
   prove users who blocked the viewer are absent while legitimate visible users
   remain.
4. A control test proves a viewer can still resolve a target the viewer blocked
   and receives their own blocked state.
5. Mobile rendering coverage proves a null user uses the generic unavailable
   screen and exposes no profile summary or social actions.
6. Focused backend tests, mobile tests, Relay generation, formatter, typecheck,
   and repository diff checks must pass before completion.

## Out of Scope

- `unblockUser`, `unfollowUser`, and their mobile controls;
- deleting follow relationships when a block is created;
- changing the `RelationshipState` enum;
- redesigning staff moderation or account deletion behavior;
- unrelated profile or social-control UI changes.

# Basic Profile Identity Design

## Goal

Give every LiveCanvas account an optional public display name and unique handle,
let the authenticated viewer edit both atomically, and use that identity
consistently across existing mobile surfaces. This replaces email-only or opaque
fallback presentation without exposing private account identifiers.

## Scope

This batch adds basic identity, not profile customization. It includes persisted
`display_name` and `username` fields, a viewer-scoped GraphQL update mutation,
mobile editing on the viewer profile, and shared presentation on profiles,
content, live-host, social-list, and contact-match surfaces.

Out of scope: avatar uploads, bios, profile layout, handle-based routing, global
people search, handle-change history, verification badges, and push
notifications. Existing opaque Relay IDs remain the only navigation keys.

## Considered Approaches

1. **Persist a unique handle and display name first (selected).** This is fully
   testable locally, improves every identity-bearing surface, and establishes
   the public key needed by a later people-search batch.
2. Add global search over account email. This would turn private login identity
   into a discovery key and is rejected.
3. Build push notifications next. Token registration, provider delivery, and
   policy decisions require external state and do not form a locally closable
   batch.

## Persistence And Validation

Add nullable `users.username` and `users.display_name` columns so existing
accounts and authentication flows remain valid. `username` has a unique index
and stores only canonical lowercase ASCII. Database checks and the Accounts
changeset enforce the same contract:

- username: 3-30 characters, starts and ends with a lowercase letter or digit,
  and contains only lowercase letters, digits, or underscores;
- display name: trimmed, 1-50 Unicode characters, single-line, with ASCII
  control characters rejected.

The edit mutation requires both strings. The Accounts boundary trims the
display name and canonicalizes the handle before one update. A collision is a
normal structured `username` error; the unique index remains the race-safe
authority. Handles may change because routing and durable references continue
to use opaque Relay IDs.

## GraphQL And Authorization

Expose nullable `User.username` and `User.displayName`. Although these are
public identity fields, their resolvers reapply the current blocked-viewer
policy because a `User` can be reached through `node(id:)`, post authors, live
hosts, connections, and contact projections. A target that blocked the viewer
therefore remains observationally missing; anonymous and otherwise authorized
profile reads receive the public identity.

Add `updateViewerProfileIdentity(input: {username!, displayName!})`. It accepts
no target user ID, updates only the authenticated viewer, returns the updated
`User`, and maps validation/uniqueness failures through the existing Relay
payload error shape.

## Mobile Data And Presentation

Extend existing Relay user selections wherever a visible person is rendered:
viewer/other profiles, content authors, live hosts, relationship lists, pending
requests, and contact matches. Do not introduce a second identity cache or
handle-based route.

The shared profile formatter uses this order:

1. display name as the title and `@username` as the subtitle;
2. `@username` as the title when no display name exists;
3. the authorized viewer email for legacy/self fallback;
4. the existing neutral LiveCanvas fallback.

Initials derive from at most the first two display-name words, then the handle,
then the authorized email. Unicode code points are handled without locale-based
case conversion surprises.

## Viewer Editing Workflow

The viewer profile gets a compact identity form prefilled from Relay. Pure
validation mirrors the backend contract and prevents blank or malformed
submissions. One active attempt is admitted at a time. The form preserves user
edits during an in-flight request, applies the returned canonical values only
to the matching attempt, reports field-specific payload errors, and ignores
callbacks after unmount. A successful update refreshes the header immediately
without waiting for a route refetch.

Other profile and shared content surfaces remain read-only. Manual privacy,
relationship, content, live, and contact behavior is unchanged.

## Error Handling And Testing

Backend tests cover canonicalization, valid Unicode display names, malformed
and blank values, uniqueness races, repeat updates, unauthenticated mutation
access, and blocked-viewer field resolution. Migration checks and the unique
constraint are exercised where practical.

Mobile pure tests cover validation, presentation priority, initials, admission,
success, field errors, retry, and stale completion. RNTL tests cover prefill,
single-submit admission, canonical response rendering, edit preservation,
payload/transport failures, unmount safety, other-profile rendering, and
regressions on content and connection surfaces. Relay generation, both
TypeScript projects, lint, full mobile tests, backend formatting/compilation,
`mix typecheck`, focused tests, full backend tests, Nix, and patch hygiene close
the batch.

Physical-device and release-operator QA remain pending and are not inferred
from local evidence.

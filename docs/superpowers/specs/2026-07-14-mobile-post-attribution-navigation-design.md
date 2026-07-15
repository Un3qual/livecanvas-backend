# Mobile Post Attribution and Author Navigation Design

## Executor Brief

The feed and profile-content queries already return each post author's opaque
Relay ID and viewer-scoped email, but `formatPostAuthorPresentation/0` discards
that data and every card renders the same `LiveCanvas creator` placeholder.
Cards and the dedicated story viewer also provide no path to the author's
profile. This batch makes the existing identity data useful without expanding
the backend's deliberately private email contract.

## Scope

- Format author identity from the existing `{id, email}` projection. A
  viewer-visible email uses the established profile presentation; otherwise the
  established privacy-safe `LiveCanvas user` fallback remains.
- Add one shared profile destination helper. The current viewer's author ID
  routes to `/profile`; every other opaque Relay ID routes unchanged to
  `/profiles/[id]`.
- Make the author title in post and story cards an accessible action.
- Wire author navigation through Home, profile previews, paginated profile
  content, and the dedicated story viewer.
- Keep all routing client-side and preserve Relay IDs as opaque strings.

Out of scope: public handles, display names, avatars stored by the backend,
profile editing, GraphQL schema changes, and any change to email visibility.

## Considered Approaches

1. **Use the current identity contract and shared routing helper (selected).**
   This closes the broken product path with no privacy or backend expansion.
2. Add a separate `View profile` button to every card. This is explicit but
   adds repeated visual weight to already action-heavy cards.
3. Add public handles/display names first. That would improve attribution, but
   it is a cross-lane schema and account-model feature rather than the next
   bounded mobile batch.

## Design

`formatPostAuthorPresentation/1` will consume the post author and reuse the
same privacy-safe formatting contract as profile screens. `profileHref/2` will
be the sole author-destination decision: self when `viewerId === profileId`,
otherwise the existing other-profile dynamic route.

When public identity and email are unavailable, the shared profile identity
formatter will include the complete opaque Relay ID in its fallback subtitle.
It must not truncate, decode, or replace the ID with a short hash: distinct
Relay IDs must remain visually and accessibly distinguishable on every surface
that reuses the formatter. Named identity presentation remains unchanged.

`ContentPostCard` will accept `onOpenAuthor(authorId)` and expose the author
title as a minimum-touch-target `Pressable` with a descriptive accessibility
label. `ContentSection` will require and forward that callback for post and
story variants. Each owning screen will create the callback from its router,
viewer ID, and `profileHref/2`. The story viewer will use the same helper from a
dedicated author-profile action because its layout does not use
`ContentPostCard`.

## Failure and Privacy Behavior

- Missing or unauthorized identity data renders the existing neutral fallback;
  the client never substitutes another private field. The fallback exposes the
  complete already-client-visible opaque Relay ID so it remains unique.
- A missing viewer ID routes to the other-profile path, which is the only safe
  choice when ownership cannot be established locally.
- Route helpers do not trim, decode, or reconstruct IDs. Invalid IDs continue
  to fail closed in the destination screen's existing Relay node handling.

## Verification

- Unit tests cover real author input, neutral fallback, self routing, other-user
  routing, opaque-ID preservation, and Relay IDs whose first eight characters
  collide (for example `VXNlcjox` and `VXNlcjoxMA==`).
- React Native behavior tests cover the accessible author action and routing
  from Home, profile content, and the dedicated story viewer. The post-card
  test must prove that colliding prefixes still produce distinct visible
  subtitles and accessible author-action names.
- Relay generation, both TypeScript checks, lint, the full mobile test gate,
  Nix flake checks, and `git diff --check` must pass.

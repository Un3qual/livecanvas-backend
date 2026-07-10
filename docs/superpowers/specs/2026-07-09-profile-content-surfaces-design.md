# Profile Content Surfaces Design

Date: 2026-07-09
Status: approved for Batch 2 implementation
Sequence source:
`docs/superpowers/specs/2026-07-09-next-five-product-batches-design.md`
Stacked base: `codex/reversible-social-controls` / draft PR #115

## Product Outcome

Viewer and other-user profiles expose visible posts, active stories, and
replays. Each profile shows compact previews and links to a shared paginated
list for one selected content kind. Post and story cards retain their existing
controls: the viewer can edit or delete owned content, while other visible
content can be reported.

## Scope

Batch 2 includes:

- reusable content sections and cards for posts, stories, live sessions, and
  replays
- viewer and other-user profile previews with three visible items per kind
- shared full-list behavior for posts, stories, and replays
- independent cursor, loading, retry, stale-response, and deduplication state
- owner edit/delete and non-owner report controls in previews and full lists
- refactoring Home to consume the universal content-surface layer
- focused backend verification of the existing profile connection contract

Batch 2 excludes media publishing, content detail pages, comments, reactions,
replay management, hidden-content counts, native media selection, and all
later approved product batches.

## Selected Architecture

The implementation will generalize the existing Home presentation into a
universal content-surface layer instead of creating profile-only copies.
Shared units own rendering, post controls, local row overlays, connection
pagination, and section states. `FeedHomeScreen` remains responsible for Home
query orchestration, manual refresh, discovery actions, and current-session
placement, but it renders all content collections through the shared units.

The shared layer uses a discriminated content kind:

- `posts`: standard `Post` nodes
- `stories`: active story `Post` nodes
- `replays`: ended `LiveSession` nodes with visible replay metadata
- `live`: active `LiveSession` nodes used by Home only

Post and story cards share the existing feed presentation rules for author,
visibility, timestamp, story expiry, and media processing. Live and replay
cards reuse `LiveSessionSummaryCard` and the existing watch route.

## Component Boundaries

### Content presentation

The current private Home post card becomes a reusable content card. It accepts
the viewer ID, a post node, control state, and callbacks. It never decides who
may mutate from route shape; ownership is derived only from the opaque viewer
and author IDs returned by Relay.

A shared section shell renders the title, optional `View all` action, neutral
empty copy, rows, and a load-more control. It supports post/story cards and
live/replay cards without teaching callers parallel display rules.

### Post controls

A reusable controller owns report, edit, and delete mutations plus same-tick
guards, per-post errors, confirmation state, edit state, and local updated or
deleted row overlays. Home, profile previews, and full lists all use this
controller. Owned posts and stories expose edit/delete; visible non-owned posts
and stories expose report. Replays have no Batch 2 mutation controls.

Mutation results use Relay normalization where possible and the active
surface's local overlay for immediate consistency. A successful update replaces
the matching node. A successful delete removes the node. A report stays in the
list and shows local confirmation. Errors remain scoped to the affected node.

### Connection state

A generic connection reducer owns:

- base-page identity
- appended rows
- end cursor and `hasNextPage`
- active request identity
- loading and retry error state
- deduplication by opaque node ID
- route-generation and content-kind stale-completion rejection

Home uses one reducer entry per paginated content section. A profile preview
uses one independent instance per kind, and a full-list route uses one instance
for its selected kind. Manual Home refresh remains Home-owned and resets each
shared connection entry from the refreshed base page.

## Relay Data Flow

Profile summary queries remain focused on identity, relationship, and social
data. Each profile content preview is a separately suspended and error-bounded
query keyed by opaque profile ID and content kind. This gives posts, stories,
and replays independent loading and retry behavior. Preview queries request
three nodes.

The shared profile-content operation accepts:

- opaque `profileId`
- `first` and `after`
- one selected content kind, encoded as mutually exclusive Relay include
  variables

Only the selected `User.posts`, `User.storyFeed`, or `User.replayFeed`
connection is executed. The operation also selects `viewer.id` for ownership
controls. Post fields come from one reusable unmasked Relay fragment shared by
Home, profile surfaces, and `updatePost` mutation results.

Full lists request ten nodes per page. The viewer route is
`/profile/content` with validated `id` and `kind` parameters. The other-user
route is `/profiles/[id]/content` with a validated `kind` parameter. Both route
files render the same `ProfileContentListScreen` and pass only opaque IDs.

## Home Refactor

Home will describe stories, posts, live sessions, and replays as section
configurations consumed by the universal section renderer. Its existing
refresh workflow, live-session discovery, and action navigation remain local.
The refactor must preserve:

- independent Home section pagination
- retained older rows across base-page refreshes when still applicable
- post owner/report behavior
- existing empty and retry copy
- current live-session and live-now navigation
- route and auth teardown guards

Home regression tests must pass before profile queries are added.

## Authorization And Privacy

The backend remains authoritative for ordering and visibility. Mobile renders
only connection edges returned by the selected `User` child field and never
reconstructs visibility policy or merges hidden rows.

An inaccessible profile keeps the current unavailable profile state. A visible
profile with an empty connection renders neutral copy such as `No visible posts
yet.` It does not expose whether rows were absent or filtered. Raw database IDs,
hidden counts, and inbound relationship details are never introduced.

The other-user profile renders no content preview sections while its effective
relationship state is `BLOCKED`. A direct full-list route to that profile still
relies on the same backend child-field authorization and renders only the
neutral empty state returned by the connection.

Backend code changes are conditional. Focused tests first verify profile
connection cursor pagination, ordering, and authorization through Relay global
IDs. Resolver or domain code changes only if those tests reproduce a contract
failure.

## Errors And Races

Each preview section owns its own Suspense boundary, error boundary, retry key,
and connection state. Retrying one section does not clear another section.
Pagination failure keeps loaded rows and exposes a local retry action.

Every asynchronous completion carries the profile ID, content kind, cursor,
and route generation that started it. Completions from an older profile,
content kind, cursor request, or A -> B -> A route generation are ignored.
Same-render refs close duplicate report, update, delete, and load-more gaps
before React state commits.

Invalid or repeated route parameters render the existing invalid-link state.
Missing selected connection data renders the neutral empty state rather than
guessing why it is absent.

## Testing Strategy

Backend contract tests cover:

- forward cursor pagination and ordering for `User.posts`
- active-story filtering and pagination for `User.storyFeed`
- replay visibility, ordering, and pagination for `User.replayFeed`
- viewer, allowed other-user, blocked/private, invalid-ID, and unauthenticated
  outcomes

Pure mobile tests cover:

- content-kind and route parameter validation
- connection append, deduplication, retry, base replacement, and stale request
  rejection
- local update/delete overlays
- universal section presentation and neutral empty copy

RNTL tests cover:

- Home behavior after the universal-surface refactor
- viewer and other-user previews for all three kinds
- edit/delete/report controls in both previews and full lists
- independent section loading, failure, and retry
- full-list pagination and duplicate-tap guards
- profile and kind route changes, including A -> B -> A stale completions
- replay navigation and inaccessible/empty states

Final verification includes the focused backend contract suite, backend
typecheck if typed backend code changes, Relay generation, TypeScript app and
test checks, zero-warning lint, focused mobile suites, full mobile quality, and
patch hygiene.

## Delivery

Implementation is inline on `codex/profile-content-surfaces`, stacked from
`codex/reversible-social-controls`. The draft PR targets the Batch 1 branch
until PR #115 merges; it can then be retargeted to `main`. Batch 3 remains
planning-only after Batch 2 closes.

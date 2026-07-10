# Profile Content Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build universal content-surface primitives, migrate Home to them, and add controlled post/story/replay previews plus paginated lists to viewer and other-user profiles.

**Architecture:** A shared `mobile/src/content/**` layer owns content kinds, Relay fragments, section/card presentation, post controls, local row overlays, and stale-safe connection state. Home keeps its discovery/refresh orchestration but consumes the shared layer; profile previews and full lists use one conditional Relay operation over existing authorized `User` connections.

**Tech Stack:** Elixir, Ecto, Absinthe Relay, ExUnit, Expo Router, React Native, TypeScript, React Relay, Bun, Jest/RNTL.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-09-profile-content-surfaces-design.md`.
- Stack from `codex/reversible-social-controls`; publish a draft PR targeting that branch until PR #115 merges.
- Keep Relay global IDs and cursors opaque. Never reconstruct backend visibility or ordering on mobile.
- Preview queries request exactly 3 rows; full lists request exactly 10 rows per page.
- Content kinds are exactly `posts`, `stories`, `replays`, plus Home-only `live`.
- Viewer-owned posts and stories expose edit/delete; non-owned posts and stories expose report; replays expose no mutation controls.
- Controls appear in previews and full lists.
- Other-user previews are omitted while the effective relationship is `BLOCKED`.
- Each preview owns its own Suspense/error/retry boundary; retrying one cannot clear another.
- Every pagination completion is guarded by profile ID, content kind, cursor, and route generation, including A -> B -> A.
- Mobile tests stay under `mobile/tests/**`.
- Backend production code changes only if Task 1 reproduces a contract failure.
- Do not implement media publishing, content details, comments, reactions, or replay management.

---

## Executor Brief

Execute Task 1 before changing mobile code. If the existing backend profile
connections fail their focused contract test, stop and repair that contract in
Task 1; otherwise record that no backend implementation was needed. Tasks 2-4
build and prove the universal content layer before Tasks 5-6 add profile
surfaces. Keep each task in its own milestone commit and update this plan's
checkboxes/evidence in the same commit as the relevant code.

## File Structure

### Backend contract proof

- Modify `test/live_canvas_gql/relay/node_queries_test.exs`: deterministic cursor, ordering, expiry, and authorization coverage for profile child connections.
- Modify backend production only if those tests fail for a real contract defect.

### Universal content layer

- Create `mobile/src/content/contentSurfaceTypes.ts`: content-kind, node, page-info, route identity, and section configuration types.
- Create `mobile/src/content/contentConnectionState.ts`: generic base/extra row state, deduplication, retry, and stale-completion rejection.
- Create `mobile/src/content/contentPostChanges.ts`: updated/deleted post overlays.
- Create `mobile/src/content/contentSurfaceOperations.ts`: shared Relay post/live fragments and report mutation.
- Create `mobile/src/content/ContentPostCard.tsx`: shared post/story card and controls UI.
- Create `mobile/src/content/ContentSection.tsx`: shared section, empty, view-all, live/replay, and load-more presentation.
- Create `mobile/src/content/usePostControls.ts`: report/update/delete controller and same-tick guards.

### Home migration

- Modify `mobile/src/feed/feedHomeOperations.ts`: consume shared fragments/operation types.
- Modify `mobile/src/feed/postOwnerControlOperations.ts`: return shared post fields.
- Modify `mobile/src/feed/FeedHomeScreen.tsx`: consume shared cards, sections, controller, connection state, and overlays.
- Modify existing Home tests and generated Relay files.

### Profile previews and lists

- Create `mobile/src/profile/profileContentRouteParams.ts`: strict kind and ID parsing plus route builders.
- Create `mobile/src/profile/profileContentOperations.ts`: conditional selected-kind profile query.
- Create `mobile/src/profile/ProfileContentPreviewSection.tsx`: independent preview query/boundary and shared content rendering.
- Create `mobile/src/profile/ProfileContentListScreen.tsx`: selected-kind list, cursor pagination, controls, and replay navigation.
- Create `mobile/app/(app)/profile/content.tsx`: viewer full-list route.
- Create `mobile/app/(app)/profiles/[id]/content.tsx`: other-user full-list route.
- Modify both profile screens, focused tests, and Relay artifacts.

---

### Task 1: Prove The Existing Profile Relay Contract

**Files:**
- Modify: `test/live_canvas_gql/relay/node_queries_test.exs`
- Modify only on reproduced failure: `lib/live_canvas/feed.ex`
- Modify only on reproduced failure: `lib/live_canvas_gql/accounts/user_resolver.ex`

**Interfaces:**
- Consumes: `User.posts`, `User.storyFeed`, and `User.replayFeed` Relay connections.
- Produces: verified forward pagination, newest-first ordering, active-story filtering, and viewer authorization for the mobile operation.

- [x] **Step 1: Add a deterministic profile-content pagination test**

Add `alias LCSchemas.Live.LiveSession` beside the existing `Post` alias. Add a
test after `refetches visible profile posts...` that creates two standard posts,
two active stories, one expired story, and two recorded replays. Set their
ordering timestamps explicitly, then query one row per connection:

```elixir
test "paginates visible profile content connections newest-first" do
  owner = user_fixture()
  viewer = user_fixture()
  context = %{current_scope: Accounts.scope_for_user(viewer)}
  _follow = accepted_follow_fixture(viewer, owner)

  {:ok, older_post} =
    Content.create_post(owner, %{kind: :standard, body_text: "older profile post"})

  {:ok, newer_post} =
    Content.create_post(owner, %{kind: :standard, body_text: "newer profile post"})

  {:ok, older_story} =
    Content.create_post(owner, %{kind: :story, body_text: "older active story"})

  {:ok, newer_story} =
    Content.create_post(owner, %{kind: :story, body_text: "newer active story"})

  {:ok, expired_story} =
    Content.create_post(owner, %{kind: :story, body_text: "expired story"})

  older_at = ~U[2026-07-08 10:00:00.000000Z]
  newer_at = ~U[2026-07-08 11:00:00.000000Z]

  for {post, inserted_at} <- [
        {older_post, older_at},
        {newer_post, newer_at},
        {older_story, older_at},
        {newer_story, newer_at}
      ] do
    {1, _rows} =
      Repo.update_all(from(row in Post, where: row.id == ^post.id),
        set: [inserted_at: inserted_at, updated_at: inserted_at]
      )
  end

  {1, _rows} =
    Repo.update_all(from(row in Post, where: row.id == ^expired_story.id),
      set: [expires_at: older_at, inserted_at: newer_at, updated_at: newer_at]
    )

  {:ok, older_asset} =
    Content.create_media_asset(owner, %{
      storage_key: "uploads/users/#{owner.id}/older-profile-replay.mp4",
      mime_type: "video/mp4",
      processing_state: :processed
    })

  {:ok, newer_asset} =
    Content.create_media_asset(owner, %{
      storage_key: "uploads/users/#{owner.id}/newer-profile-replay.mp4",
      mime_type: "video/mp4",
      processing_state: :processed
    })

  {:ok, older_replay} = Live.start_live_session(owner, %{visibility: :followers})
  {:ok, older_replay} =
    Live.end_live_session(older_replay, %{recording_media_asset_id: older_asset.id})

  {:ok, newer_replay} = Live.start_live_session(owner, %{visibility: :followers})
  {:ok, newer_replay} =
    Live.end_live_session(newer_replay, %{recording_media_asset_id: newer_asset.id})

  for {session, ended_at} <- [{older_replay, older_at}, {newer_replay, newer_at}] do
    {1, _rows} =
      Repo.update_all(from(row in LiveSession, where: row.id == ^session.id),
        set: [ended_at: ended_at, updated_at: ended_at]
      )
  end

  query = """
  query(
    $id: ID!
    $postsAfter: String
    $storiesAfter: String
    $replaysAfter: String
  ) {
    node(id: $id) {
      ... on User {
        posts(first: 1, after: $postsAfter) {
          edges { cursor node { id bodyText } }
          pageInfo { endCursor hasNextPage }
        }
        storyFeed(first: 1, after: $storiesAfter) {
          edges { cursor node { id bodyText } }
          pageInfo { endCursor hasNextPage }
        }
        replayFeed(first: 1, after: $replaysAfter) {
          edges { cursor node { id status } }
          pageInfo { endCursor hasNextPage }
        }
      }
    }
  }
  """

  profile_id = Absinthe.Relay.Node.to_global_id(:user, owner.id, LCGQL.Schema)

  assert {:ok, %{data: %{"node" => first_page}}} =
           Absinthe.run(query, LCGQL.Schema,
             variables: %{
               "id" => profile_id,
               "postsAfter" => nil,
               "storiesAfter" => nil,
               "replaysAfter" => nil
             },
             context: context
           )

  assert [%{"node" => %{"bodyText" => "newer profile post"}}] =
           first_page["posts"]["edges"]

  assert [%{"node" => %{"bodyText" => "newer active story"}}] =
           first_page["storyFeed"]["edges"]

  assert [%{"node" => %{"id" => newer_replay_id}}] =
           first_page["replayFeed"]["edges"]

  assert newer_replay_id ==
           Absinthe.Relay.Node.to_global_id(:live_session, newer_replay.id, LCGQL.Schema)

  assert first_page["posts"]["pageInfo"]["hasNextPage"]
  assert first_page["storyFeed"]["pageInfo"]["hasNextPage"]
  assert first_page["replayFeed"]["pageInfo"]["hasNextPage"]

  assert {:ok, %{data: %{"node" => second_page}}} =
           Absinthe.run(query, LCGQL.Schema,
             variables: %{
               "id" => profile_id,
               "postsAfter" => first_page["posts"]["pageInfo"]["endCursor"],
               "storiesAfter" => first_page["storyFeed"]["pageInfo"]["endCursor"],
               "replaysAfter" => first_page["replayFeed"]["pageInfo"]["endCursor"]
             },
             context: context
           )

  assert [%{"node" => %{"bodyText" => "older profile post"}}] =
           second_page["posts"]["edges"]

  assert [%{"node" => %{"bodyText" => "older active story"}}] =
           second_page["storyFeed"]["edges"]

  assert [%{"node" => %{"id" => older_replay_id}}] =
           second_page["replayFeed"]["edges"]

  assert older_replay_id ==
           Absinthe.Relay.Node.to_global_id(:live_session, older_replay.id, LCGQL.Schema)

  refute second_page["posts"]["pageInfo"]["hasNextPage"]
  refute second_page["storyFeed"]["pageInfo"]["hasNextPage"]
  refute second_page["replayFeed"]["pageInfo"]["hasNextPage"]
end
```

- [x] **Step 2: Extend the unauthorized case to anonymous access**

After the existing outsider assertion, run the query without context:

```elixir
assert {:ok,
        %{
          data: %{
            "node" => %{
              "id" => ^user_id,
              "posts" => %{"edges" => []},
              "storyFeed" => %{"edges" => []},
              "currentLiveSession" => nil,
              "replayFeed" => %{"edges" => []}
            }
          }
        }} =
         Absinthe.run(query, LCGQL.Schema,
           variables: %{"id" => user_id, "first" => 10}
         )
```

This proves the mobile route cannot widen access by omitting viewer state.

- [x] **Step 3: Run the focused backend test**

Run:

```bash
mix test test/live_canvas_gql/relay/node_queries_test.exs
```

Expected: PASS without backend production changes. If it fails, diagnose the
specific connection before editing `Feed` or `UserResolver`; do not weaken the
assertions.

- [x] **Step 4: Format and commit the contract proof**

Run:

```bash
mix format test/live_canvas_gql/relay/node_queries_test.exs
mix test test/live_canvas_gql/relay/node_queries_test.exs
git add test/live_canvas_gql/relay/node_queries_test.exs
git commit -m "test: prove profile content relay pagination"
```

Execution evidence (2026-07-09):

- Existing production code passed the new deterministic contract proof; no
  backend resolver or domain change was required.
- `mix test test/live_canvas_gql/relay/node_queries_test.exs` -> 30 tests,
  0 failures after formatting.

---

### Task 2: Add Universal Content State And Route Contracts

**Files:**
- Create: `mobile/src/content/contentSurfaceTypes.ts`
- Create: `mobile/src/content/contentConnectionState.ts`
- Create: `mobile/src/content/contentPostChanges.ts`
- Create: `mobile/src/profile/profileContentRouteParams.ts`
- Create: `mobile/tests/content/contentConnectionState.test.ts`
- Create: `mobile/tests/content/contentPostChanges.test.ts`
- Create: `mobile/tests/profile/profileContentRouteParams.test.ts`

**Interfaces:**
- Produces: `ContentSurfaceKind`, `ProfileContentKind`, `ContentConnectionState<Node>`, `contentConnectionReducer`, `selectContentRows`, `applyContentPostChanges`, and strict route readers/builders.
- Consumed by: Tasks 3-6.

- [x] **Step 1: Write failing route and connection-state tests**

Create tests that import the names above and assert:

```typescript
expect(readProfileContentKindParam('posts')).toBe('posts');
expect(readProfileContentKindParam(['stories'])).toBe('stories');
expect(readProfileContentKindParam(['posts', 'stories'])).toBeNull();
expect(readProfileContentKindParam('live')).toBeNull();
expect(readProfileContentKindParam('unknown')).toBeNull();

const initial = createContentConnectionState({
  basePageIdentity: 'profile-a:posts:cursor-1',
  baseRows: [{ id: 'post-1' }],
  pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
  routeGeneration: 1,
});
const loading = contentConnectionReducer(initial, {
  request: {
    cursor: 'cursor-1',
    key: 'profile-a:posts:cursor-1:1',
    routeGeneration: 1,
  },
  type: 'load_more_start',
});
const loaded = contentConnectionReducer(loading, {
  pageInfo: { endCursor: null, hasNextPage: false },
  request: loading.activeRequest!,
  rows: [{ id: 'post-1' }, { id: 'post-2' }],
  type: 'load_more_success',
});
expect(selectContentRows(loaded)).toEqual([
  { id: 'post-1' },
  { id: 'post-2' },
]);
```

Also assert a completion with an old request object or old route generation
returns the identical state, and an error preserves base/extra rows.

- [x] **Step 2: Run the tests and verify RED**

Run from `mobile/`:

```bash
bun test tests/content/contentConnectionState.test.ts tests/content/contentPostChanges.test.ts tests/profile/profileContentRouteParams.test.ts
```

Expected: FAIL because the new modules do not exist.

- [x] **Step 3: Implement exact shared types and reducer**

Use these public contracts:

```typescript
export const CONTENT_SURFACE_KINDS = [
  'posts',
  'stories',
  'live',
  'replays',
] as const;

export const PROFILE_CONTENT_KINDS = [
  'posts',
  'stories',
  'replays',
] as const;

export type ContentSurfaceKind = (typeof CONTENT_SURFACE_KINDS)[number];
export type ProfileContentKind = (typeof PROFILE_CONTENT_KINDS)[number];
export type ContentNode = { readonly id: string };
export type ContentPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};
export type ContentRequestIdentity = {
  readonly cursor: string;
  readonly key: string;
  readonly routeGeneration: number;
};
```

The reducer state/actions are:

```typescript
export type ContentConnectionState<Node extends ContentNode> = {
  readonly activeRequest: ContentRequestIdentity | null;
  readonly basePageIdentity: string;
  readonly baseRows: ReadonlyArray<Node>;
  readonly error: string | null;
  readonly extraRows: ReadonlyArray<Node>;
  readonly pageInfo: ContentPageInfo;
  readonly routeGeneration: number;
};

export type ContentConnectionAction<Node extends ContentNode> =
  | { readonly request: ContentRequestIdentity; readonly type: 'load_more_start' }
  | {
      readonly message: string;
      readonly request: ContentRequestIdentity;
      readonly type: 'load_more_error';
    }
  | {
      readonly pageInfo: ContentPageInfo;
      readonly request: ContentRequestIdentity;
      readonly rows: ReadonlyArray<Node>;
      readonly type: 'load_more_success';
    }
  | {
      readonly basePageIdentity: string;
      readonly baseRows: ReadonlyArray<Node>;
      readonly pageInfo: ContentPageInfo;
      readonly routeGeneration: number;
      readonly type: 'replace_base';
    };
```

`load_more_error` and `load_more_success` apply only when
`state.activeRequest === action.request` and both route generations match.
`selectContentRows` returns base rows followed by extras, keeping the first row
for each opaque ID. `replace_base` clears extras/error/request whenever base
identity or route generation changes; otherwise it retains extras.

- [x] **Step 4: Implement post overlays and strict route helpers**

Use:

```typescript
export type ContentPostChanges<Post extends { readonly id: string }> = {
  readonly deletedPostIds: Readonly<Record<string, true>>;
  readonly updatedPostsById: Readonly<Record<string, Post>>;
};

export function applyContentPostChanges<Post extends { readonly id: string }>(
  posts: ReadonlyArray<Post>,
  changes: ContentPostChanges<Post>,
): Post[] {
  return posts
    .filter((post) => changes.deletedPostIds[post.id] !== true)
    .map((post) => changes.updatedPostsById[post.id] ?? post);
}
```

Route parsing accepts exactly one trimmed kind/ID value. Export
`profileContentHref(profileId, kind, scope)` where viewer returns:

```typescript
{
  params: { id: profileId, kind },
  pathname: '/profile/content',
}
```

and other-user returns:

```typescript
{
  params: { id: profileId, kind },
  pathname: '/profiles/[id]/content',
}
```

- [x] **Step 5: Run pure tests and commit**

Run:

```bash
bun test tests/content/contentConnectionState.test.ts tests/content/contentPostChanges.test.ts tests/profile/profileContentRouteParams.test.ts
bun run typecheck
bun run typecheck:tests
```

Commit:

```bash
git add mobile/src/content mobile/src/profile/profileContentRouteParams.ts mobile/tests/content mobile/tests/profile/profileContentRouteParams.test.ts
git commit -m "feat(mobile): add universal content state"
```

Execution evidence (2026-07-09):

- RED: three suites errored because the new universal content and route modules
  did not exist.
- GREEN: 6 tests, 0 failures; `bun run typecheck` and
  `bun run typecheck:tests` passed.

---

### Task 3: Extract Shared Content Cards And Post Controls

**Files:**
- Create: `mobile/src/content/contentSurfaceOperations.ts`
- Create: `mobile/src/content/ContentPostCard.tsx`
- Create: `mobile/src/content/usePostControls.ts`
- Create: `mobile/tests/content/ContentPostCard.rntl.tsx`
- Modify: `mobile/src/feed/feedHomeOperations.ts`
- Modify: `mobile/src/feed/postOwnerControlOperations.ts`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: generated Relay artifacts

**Interfaces:**
- Produces: `ContentPost`, `contentSurfacePostFields`, `contentSurfaceLiveSessionFields`, `ContentPostCard`, and `usePostControls`.
- Preserves: existing Home owner/report behavior while removing its private card and mutation controller.

- [ ] **Step 1: Write failing shared-card RNTL tests**

Render a harness using `usePostControls({viewerId})` and `ContentPostCard`.
Assert an owned post exposes `Edit` and `Delete` but not `Report`; a non-owned
post exposes `Report` but not owner controls. Assert edit/update, delete
confirmation, report confirmation, payload error, network error, and same-tick
duplicate guards use the opaque post ID.

- [ ] **Step 2: Run focused card and existing Home tests for RED**

```bash
pnpm exec jest --config ./jest.config.js tests/content/ContentPostCard.rntl.tsx tests/feed/FeedHomeScreen.rntl.tsx --runInBand
```

Expected: the new suite fails because shared exports do not exist; the existing
Home suite remains the behavior baseline.

- [ ] **Step 3: Add shared Relay fragments and operations**

Move the post/live field selections to these exact fragment names:

```graphql
fragment contentSurfaceOperationsPostFields on Post {
  id
  kind
  bodyText
  visibility
  expiresAt
  insertedAt
  author { id email }
  mediaAssets { id mimeType processingState publicUrl }
}

fragment contentSurfaceOperationsLiveSessionFields on LiveSession {
  id
  channelTopic
  status
  visibility
  insertedAt
  startedAt
  endedAt
  host { id email }
}
```

Export `contentSurfaceReportPostMutation` with the current report payload.
Update Home queries and `updatePost` results to spread the shared unmasked post
fragment. Run Relay after all document references compile.

- [ ] **Step 4: Extract `ContentPostCard`**

Export these props:

```typescript
export type ContentPost = FeedPostCardInput;

export type ContentPostCardProps = {
  readonly controls: PostControls;
  readonly post: ContentPost;
  readonly viewerId: string | null;
};

export function ContentPostCard(
  props: ContentPostCardProps,
): React.JSX.Element;
```

The component keeps the current feed card copy, media presentation, edit
fields, visibility buttons, delete confirmation, report state, and per-post
errors. Move its styles into the new file. It calls controller callbacks and
contains no Relay hooks.

- [ ] **Step 5: Extract `usePostControls`**

Export:

```typescript
export type PostControls = {
  readonly changes: ContentPostChanges<ContentPost>;
  readonly deleteConfirmationPostId: string | null;
  readonly editState: PostOwnerEditState | null;
  readonly editingPostId: string | null;
  readonly errorsByPostId: Readonly<Record<string, string>>;
  readonly pendingAction: { readonly kind: 'delete' | 'update'; readonly postId: string } | null;
  readonly reportState: ReportPostState;
  readonly cancelDelete: () => void;
  readonly cancelEdit: () => void;
  readonly confirmDelete: (post: ContentPost) => void;
  readonly deletePost: (post: ContentPost) => void;
  readonly reportPost: (post: ContentPost) => void;
  readonly saveEdit: (post: ContentPost) => void;
  readonly selectEditVisibility: (visibility: 'FOLLOWERS' | 'PUBLIC') => void;
  readonly startEdit: (post: ContentPost) => void;
  readonly updateEditBody: (bodyText: string) => void;
};

export function usePostControls({
  viewerId,
}: {
  readonly viewerId: string | null;
}): PostControls;
```

Use the existing reducer/formatters and mutation documents. Preserve the
same-render refs for report and owner actions. Guard callbacks with a
layout-cleaned controller-generation ref so an unmounted surface cannot publish
errors or overlays.

- [ ] **Step 6: Replace Home's private card/controller and verify**

Delete Home's private `FeedPostCard`, owner-control type, mutation hooks, and
handler bodies. Create one `const postControls = usePostControls({viewerId})`,
apply `postControls.changes` to story/home rows, and pass the controller to each
`ContentPostCard`.

Run:

```bash
bun run relay
pnpm exec jest --config ./jest.config.js tests/content/ContentPostCard.rntl.tsx tests/feed/FeedHomeScreen.rntl.tsx --runInBand
bun run typecheck
bun run typecheck:tests
```

- [ ] **Step 7: Commit the shared control/card milestone**

```bash
git add mobile/src/content mobile/src/feed mobile/src/__generated__ mobile/tests/content mobile/tests/feed/FeedHomeScreen.rntl.tsx
git commit -m "refactor(mobile): share content cards and controls"
```

---

### Task 4: Migrate Home To Universal Sections And Connection State

**Files:**
- Create: `mobile/src/content/ContentSection.tsx`
- Create: `mobile/tests/content/ContentSection.rntl.tsx`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/src/feed/feedHomePagination.ts`
- Modify: `mobile/tests/feed/feedHomePagination.test.ts`
- Modify: `mobile/tests/feed/FeedHomeScreen.rntl.tsx`

**Interfaces:**
- Consumes: Tasks 2-3 universal state/cards/controls.
- Produces: Home rendered entirely through universal section/card primitives while retaining Home-only refresh and discovery behavior.

- [ ] **Step 1: Add failing universal-section and Home regression tests**

Test `ContentSection` for post rows, live/replay rows, neutral empty copy, view
all, load more, retry error, and disabled loading state. Add Home assertions for
`testID="content-section-stories"`, `content-section-posts`,
`content-section-live`, and `content-section-replays`, while retaining existing
pagination, refresh, owner/report, and navigation assertions.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest --config ./jest.config.js tests/content/ContentSection.rntl.tsx tests/feed/FeedHomeScreen.rntl.tsx --runInBand
bun test tests/feed/feedHomePagination.test.ts tests/content/contentConnectionState.test.ts
```

- [ ] **Step 3: Implement the shared section API**

```typescript
type ContentSectionBaseProps = {
  readonly emptyMessage: string;
  readonly loadMore?: ContentSectionLoadMore;
  readonly onViewAll?: () => void;
  readonly title: string;
};

type ContentPostSectionProps = ContentSectionBaseProps & {
  readonly kind: 'posts' | 'stories';
  readonly postControls: PostControls;
  readonly posts: ReadonlyArray<ContentPost>;
  readonly viewerId: string | null;
};

type ContentSessionSectionProps = ContentSectionBaseProps & {
  readonly kind: 'live' | 'replays';
  readonly onOpenLiveSession: (sessionId: string) => void;
  readonly sessions: ReadonlyArray<LiveSessionSummary>;
};

export type ContentSectionProps =
  | ContentPostSectionProps
  | ContentSessionSectionProps;
```

The shared base does not accept row props. The discriminated variants make it
impossible to render a post section without controls or a live/replay section
without navigation.

The common load-more contract is:

```typescript
type ContentSectionLoadMore = {
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
  readonly visible: boolean;
};
```

The component branches only on the discriminated kind: posts/stories render
`ContentPostCard`; live/replays render `LiveSessionSummaryCard` with `Watch
live`/`Watch replay`. Empty and load-more UI is common.

- [ ] **Step 4: Adapt Home pagination to the generic connection reducer**

Keep `feedHomePaginationReducer` responsible only for manual refresh state and
the map of section connection states. Delegate section start/success/error and
row deduplication to `contentConnectionReducer`. Preserve the exported
`createFeedHomePaginationState` and `selectFeedHomePageInfo` adapters until all
existing Home callers/tests are migrated in this task.

- [ ] **Step 5: Replace Home sections and verify no regression**

Render all four Home content collections through `ContentSection`. Current
session can remain its own heading but its card must use the shared live card
path. Run:

```bash
bun test tests/feed/feedHomePagination.test.ts tests/content/contentConnectionState.test.ts
pnpm exec jest --config ./jest.config.js tests/content/ContentSection.rntl.tsx tests/feed/FeedHomeScreen.rntl.tsx --runInBand
bun run typecheck
bun run typecheck:tests
```

- [ ] **Step 6: Commit the Home universal-surface migration**

```bash
git add mobile/src/content/ContentSection.tsx mobile/src/feed mobile/tests/content/ContentSection.rntl.tsx mobile/tests/feed
git commit -m "refactor(mobile): migrate home to content surfaces"
```

---

### Task 5: Add Independent Profile Content Previews

**Files:**
- Create: `mobile/src/profile/profileContentOperations.ts`
- Create: `mobile/src/profile/ProfileContentPreviewSection.tsx`
- Create: `mobile/tests/profile/ProfileContentPreviewSection.rntl.tsx`
- Modify: `mobile/src/profile/viewer/ViewerProfileScreen.tsx`
- Modify: `mobile/src/profile/other/OtherUserProfileScreen.tsx`
- Modify: `mobile/tests/profile/ProfilePreviewLinks.rntl.tsx`
- Modify: `mobile/tests/profile/OtherUserProfileScreen.rntl.tsx`
- Modify: generated Relay artifacts

**Interfaces:**
- Consumes: existing authorized `User` connections and Tasks 2-4 shared content layer.
- Produces: three independent, controlled previews on viewer and visible other-user profiles.

- [ ] **Step 1: Write failing preview query/UI tests**

Mock the conditional operation by variables. For each kind assert `first: 3`,
`after: null`, the same opaque profile ID, and mutually exclusive booleans:

```typescript
expect(mockQueryVariables).toEqual({
  after: null,
  first: 3,
  id: 'opaque-profile-id',
  includePosts: true,
  includeReplays: false,
  includeStories: false,
});
```

Render three preview sections and assert one failed boundary can retry without
unmounting successful siblings. Assert viewer previews expose owner controls,
other previews expose report, replays navigate to `liveSessionHref`, and each
`View all` action uses `profileContentHref`. Assert blocked other profiles show
no content-section test IDs.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest --config ./jest.config.js tests/profile/ProfileContentPreviewSection.rntl.tsx tests/profile/ProfilePreviewLinks.rntl.tsx tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
```

- [ ] **Step 3: Add the conditional profile operation**

```graphql
query profileContentOperationsQuery(
  $after: String
  $first: Int!
  $id: ID!
  $includePosts: Boolean!
  $includeReplays: Boolean!
  $includeStories: Boolean!
) {
  viewer { id }
  node(id: $id) {
    __typename
    ... on User {
      id
      posts(first: $first, after: $after) @include(if: $includePosts) {
        edges { node { ...contentSurfaceOperationsPostFields @relay(mask: false) } }
        pageInfo { endCursor hasNextPage }
      }
      storyFeed(first: $first, after: $after) @include(if: $includeStories) {
        edges { node { ...contentSurfaceOperationsPostFields @relay(mask: false) } }
        pageInfo { endCursor hasNextPage }
      }
      replayFeed(first: $first, after: $after) @include(if: $includeReplays) {
        edges { node { ...contentSurfaceOperationsLiveSessionFields @relay(mask: false) } }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
}
```

Export `profileContentVariables(profileId, kind, first, after)` and
`selectProfileContentConnection(data, kind)` so preview and list use identical
selection rules.

- [ ] **Step 4: Implement the independent preview boundary**

`ProfileContentPreviewSection` accepts:

```typescript
{
  readonly kind: ProfileContentKind;
  readonly profileId: string;
  readonly scope: 'other' | 'viewer';
}
```

Its outer component owns a retry key and error boundary; its content component
runs the query with `first: 3`, creates its own `usePostControls`, and renders
`ContentSection`. Use neutral messages `No visible posts yet.`, `No active
stories yet.`, and `No visible replays yet.`

- [ ] **Step 5: Add previews to both profile screens**

Viewer renders posts, stories, and replays after current-live-session and
before social lists. Other-user renders them after Relationship/Social content
only when `relationshipState !== 'BLOCKED'`. Pass the base query's opaque user
ID; never decode it.

- [ ] **Step 6: Generate Relay, verify, and commit**

```bash
bun run relay
pnpm exec jest --config ./jest.config.js tests/profile/ProfileContentPreviewSection.rntl.tsx tests/profile/ProfilePreviewLinks.rntl.tsx tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
bun run typecheck
bun run typecheck:tests
git add mobile/src/profile mobile/src/__generated__ mobile/tests/profile
git commit -m "feat(mobile): add profile content previews"
```

---

### Task 6: Add The Shared Paginated Profile Content List

**Files:**
- Create: `mobile/src/profile/ProfileContentListScreen.tsx`
- Create: `mobile/app/(app)/profile/content.tsx`
- Create: `mobile/app/(app)/profiles/[id]/content.tsx`
- Create: `mobile/tests/profile/ProfileContentListScreen.rntl.tsx`
- Modify: `mobile/tests/config/runtime.test.ts` only if route allowlisting requires it

**Interfaces:**
- Consumes: Task 5 operation/selectors and Tasks 2-4 state/cards/controls.
- Produces: one shared full-list screen for viewer and other posts/stories/replays.

- [ ] **Step 1: Write failing route and list tests**

Assert both route files reject invalid/missing/repeated `id` or `kind` values
with `Profile link is invalid.` Assert a valid route renders the shared screen.
In the screen suite assert:

- initial query uses `first: 10`
- load more uses the returned opaque cursor
- appended rows deduplicate by opaque node ID
- retry preserves loaded rows
- same-tick load-more presses issue one request
- route/kind changes reset rows
- A -> B -> A old completions are ignored
- viewer posts/stories show edit/delete
- other posts/stories show report
- replays open the existing watch route

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest --config ./jest.config.js tests/profile/ProfileContentListScreen.rntl.tsx --runInBand
bun test tests/profile/profileContentRouteParams.test.ts tests/content/contentConnectionState.test.ts
```

- [ ] **Step 3: Implement the shared list**

The screen accepts:

```typescript
export function ProfileContentListScreen({
  kind,
  profileId,
}: {
  readonly kind: ProfileContentKind;
  readonly profileId: string;
})
```

Use `useLazyLoadQuery` for the first page and `fetchQuery(...,
{fetchPolicy:'network-only'})` for later pages. Create a monotonically changing
route-generation token whenever `profileId`, `kind`, or base-page identity
changes. Store the complete request identity object in a ref before awaiting;
the reducer accepts completion only when that same object is still active.

Render a `FlatList` whose header identifies `Posts`, `Stories`, or `Replays`,
whose rows use `ContentPostCard` or `LiveSessionSummaryCard`, and whose footer
uses the shared load-more control. Apply post overlays before passing data.

- [ ] **Step 4: Implement strict route files**

Viewer route reads both `id` and `kind` from search params. Other-user route
reads path `id` and search `kind`. Both wrap the shared screen in
`RelayRouteBoundary` with kind-specific loading/error copy.

- [ ] **Step 5: Verify full-list behavior and commit**

```bash
pnpm exec jest --config ./jest.config.js tests/profile/ProfileContentListScreen.rntl.tsx --runInBand
bun test tests/profile/profileContentRouteParams.test.ts tests/content/contentConnectionState.test.ts
bun run typecheck
bun run typecheck:tests
git add mobile/app mobile/src/profile/ProfileContentListScreen.tsx mobile/tests/profile/ProfileContentListScreen.rntl.tsx mobile/tests/config/runtime.test.ts
git commit -m "feat(mobile): add paginated profile content lists"
```

Do not stage `runtime.test.ts` if it did not need a route-allowlist change.

---

### Task 7: Run Final Gates And Close Batch 2

**Files:**
- Modify: `docs/plans/NOW.md`
- Modify: `docs/plans/backend/NOW.md`
- Modify: `docs/plans/mobile/NOW.md`
- Modify: `docs/plans/mobile/TRACK.md`
- Modify: `docs/plans/INDEX.md`
- Modify: `docs/superpowers/plans/2026-07-09-profile-content-surfaces.md`

**Interfaces:**
- Consumes: verified Tasks 1-6.
- Produces: Batch 2 closure, Batch 3 planning-only coordinator state, and a stacked draft PR.

- [ ] **Step 1: Run final backend verification**

```bash
mix format --check-formatted test/live_canvas_gql/relay/node_queries_test.exs
mix test test/live_canvas_gql/relay/node_queries_test.exs
```

If backend typed production code changed, also run `mix typecheck`. Record the
known repository-wide formatter baseline separately; do not include unrelated
formatting churn.

- [ ] **Step 2: Run final mobile verification**

From `mobile/`:

```bash
bun run relay
bun test tests/content tests/profile/profileContentRouteParams.test.ts tests/feed/feedHomePagination.test.ts
pnpm exec jest --config ./jest.config.js tests/content tests/feed/FeedHomeScreen.rntl.tsx tests/profile/ProfileContentPreviewSection.rntl.tsx tests/profile/ProfileContentListScreen.rntl.tsx tests/profile/ProfilePreviewLinks.rntl.tsx tests/profile/OtherUserProfileScreen.rntl.tsx --runInBand
bun run test:quality
```

- [ ] **Step 3: Close lane documents**

Record Batch 2 complete in backend/mobile lane pointers, Track, Index, and the
coordinator dashboard. Name Batch 3, Media Post Publishing, as the next
planning action only. Record exact passed counts and the backend production
change decision.

- [ ] **Step 4: Verify patch hygiene and review**

```bash
git diff --check
git status --short
```

Review the complete stacked diff against the approved spec. Fix all Critical
and Important findings before publication.

- [ ] **Step 5: Commit closure and publish the stacked draft PR**

```bash
git add docs/plans/NOW.md docs/plans/backend/NOW.md docs/plans/mobile/NOW.md docs/plans/mobile/TRACK.md docs/plans/INDEX.md docs/superpowers/plans/2026-07-09-profile-content-surfaces.md
git commit -m "docs: close profile content surfaces batch"
git push -u origin codex/profile-content-surfaces
```

Open a draft PR with base `codex/reversible-social-controls` and head
`codex/profile-content-surfaces`. Include the full validation evidence and the
known repository-wide formatter baseline. Do not activate Batch 3.

---

## Execution Handoff

Execute inline with `superpowers:executing-plans`. Start at Task 1 and preserve
the task/commit boundaries. Do not begin universal mobile refactoring until the
profile Relay contract test is green.

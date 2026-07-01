# Feed Section Refresh And Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit load-more controls and combined refresh behavior to the
mobile home feed without blocking live-now or current-session UI.

**Architecture:** Keep the initial home read in `FeedHomeScreen` as a Relay
root query. Extract the query/mutation document into a feed-local operations file
so the screen can reuse the same query with `fetchQuery` for section-scoped
older-page loads and refreshes. Store older pages and load states in feed-local
screen state; keep report confirmation/error state independent so refreshes do
not clear it.

**Tech Stack:** Expo React Native, React hooks, React Relay `useLazyLoadQuery`
and `fetchQuery`, Bun tests, Relay compiler.

---

## Executor Brief

Current active task:
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md` Task 4.

Write scope:

- `mobile/src/feed/**`
- `mobile/tests/feed/**`
- generated Relay files under `mobile/src/__generated__/**` if query names or
  variables change
- `docs/plans/mobile/**` for progress evidence

Do not edit backend code unless the mobile work reproduces a backend contract
mismatch. If that happens, promote a backend issue in `docs/plans/backend/NOW.md`
before editing backend files.

## File Structure

- `mobile/src/feed/feedHomeOperations.ts`
  owns the feed home GraphQL query, report-post mutation, generated types, and
  default query variables. This mirrors
  `mobile/src/live/watch/liveSessionWatchOperations.ts`.
- `mobile/src/feed/feedHomePagination.ts`
  owns pure pagination state, reducer transitions, and helpers for extracting
  connection pages from query data. Keeping this pure lets focused tests cover
  section behavior without rendering the full screen.
- `mobile/src/feed/FeedHomeScreen.tsx`
  renders the home surface, delegates load-more and refresh events to the
  reducer, and uses `fetchQuery` for section-scoped network reads.
- `mobile/tests/feed/feedHomePagination.test.ts`
  covers pure reducer behavior.
- `mobile/tests/feed/FeedHomeScreen.test.tsx`
  covers rendered controls, query variables, section-scoped loading, refresh,
  and existing report behavior.

## Tasks

### Task 1: Extract Feed Home Operations

**Files:**
- Create: `mobile/src/feed/feedHomeOperations.ts`
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify after Relay codegen:
  `mobile/src/__generated__/feedHomeOperationsQuery.graphql.ts`
- Modify after Relay codegen:
  `mobile/src/__generated__/feedHomeOperationsReportPostMutation.graphql.ts`
- Remove after code switch:
  `mobile/src/__generated__/FeedHomeScreenQuery.graphql.ts`
- Remove after code switch:
  `mobile/src/__generated__/FeedHomeScreenReportPostMutation.graphql.ts`
- Test: `mobile/tests/feed/FeedHomeScreen.test.tsx`

- [ ] **Step 1: Create the operations file**

Create `mobile/src/feed/feedHomeOperations.ts` with this shape:

```ts
import { graphql } from 'react-relay';

export type {
  feedHomeOperationsQuery as FeedHomeScreenQuery,
} from '../__generated__/feedHomeOperationsQuery.graphql';
export type {
  feedHomeOperationsReportPostMutation as FeedHomeScreenReportPostMutation,
} from '../__generated__/feedHomeOperationsReportPostMutation.graphql';

export const FEED_HOME_QUERY_VARIABLES = {
  feedAfter: null,
  feedFirst: 10,
  liveFirst: 20,
  replayAfter: null,
  replayFirst: 10,
  storyAfter: null,
  storyFirst: 10,
} as const;

export const feedHomeScreenQuery = graphql`
  query feedHomeOperationsQuery(
    $feedAfter: String
    $feedFirst: Int!
    $liveFirst: Int!
    $replayAfter: String
    $replayFirst: Int!
    $storyAfter: String
    $storyFirst: Int!
  ) {
    viewer {
      id
      currentLiveSession {
        id
        channelTopic
        status
        visibility
        insertedAt
        startedAt
        endedAt
        host {
          id
          email
        }
      }
    }
    storyFeed(first: $storyFirst, after: $storyAfter) {
      edges {
        node {
          id
          kind
          bodyText
          visibility
          expiresAt
          insertedAt
          author {
            id
            email
          }
          mediaAssets {
            id
            mimeType
            processingState
            publicUrl
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    homeFeed(first: $feedFirst, after: $feedAfter) {
      edges {
        node {
          id
          kind
          bodyText
          visibility
          expiresAt
          insertedAt
          author {
            id
            email
          }
          mediaAssets {
            id
            mimeType
            processingState
            publicUrl
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    liveNow(first: $liveFirst) {
      edges {
        node {
          id
          channelTopic
          status
          visibility
          insertedAt
          startedAt
          endedAt
          host {
            id
            email
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
    replayFeed(first: $replayFirst, after: $replayAfter) {
      edges {
        node {
          id
          channelTopic
          status
          visibility
          insertedAt
          startedAt
          endedAt
          host {
            id
            email
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

export const feedHomeScreenReportPostMutation = graphql`
  mutation feedHomeOperationsReportPostMutation($input: ReportPostInput!) {
    reportPost(input: $input) {
      report {
        id
        postId
        reason
        status
        insertedAt
      }
      errors {
        field
        message
      }
    }
  }
`;
```

- [ ] **Step 2: Switch `FeedHomeScreen.tsx` to imports**

Replace the inline query, inline mutation, local generated type imports, and
local `FEED_HOME_QUERY_VARIABLES` with imports:

```ts
import {
  FEED_HOME_QUERY_VARIABLES,
  feedHomeScreenQuery,
  feedHomeScreenReportPostMutation,
  type FeedHomeScreenQuery,
  type FeedHomeScreenReportPostMutation,
} from './feedHomeOperations';
```

The initial query call should become:

```ts
const data = useLazyLoadQuery<FeedHomeScreenQuery>(
  feedHomeScreenQuery,
  FEED_HOME_QUERY_VARIABLES,
  { fetchPolicy: 'store-and-network' },
);
```

- [ ] **Step 3: Update the existing query-variable test**

In `mobile/tests/feed/FeedHomeScreen.test.tsx`, update
`keeps home route pointed at the product feed surface` to expect the new cursor
variables:

```ts
expect(queryVariables).toEqual({
  feedAfter: null,
  feedFirst: 10,
  liveFirst: 20,
  replayAfter: null,
  replayFirst: 10,
  storyAfter: null,
  storyFirst: 10,
});
```

- [ ] **Step 4: Run focused test before codegen**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: the test suite may fail until Relay codegen creates the new generated
types, but no runtime behavior should change beyond the updated variable shape.

- [ ] **Step 5: Run Relay codegen**

Run from `mobile/`:

```sh
bun run relay
```

Expected: generated files for `feedHomeOperationsQuery` and
`feedHomeOperationsReportPostMutation` are created. The old generated
`FeedHomeScreen*` files are removed if no code imports them.

- [ ] **Step 6: Verify extraction**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: all existing `FeedHomeScreen` tests pass.

### Task 2: Add Pure Pagination State

**Files:**
- Create: `mobile/src/feed/feedHomePagination.ts`
- Create: `mobile/tests/feed/feedHomePagination.test.ts`

- [ ] **Step 1: Write reducer tests**

Create `mobile/tests/feed/feedHomePagination.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

import {
  createFeedHomePaginationState,
  feedHomePaginationReducer,
  selectFeedHomePageInfo,
  type FeedHomePaginationPageInfo,
} from '../../src/feed/feedHomePagination';

const nextPage: FeedHomePaginationPageInfo = {
  endCursor: 'cursor-1',
  hasNextPage: true,
};

describe('feedHomePaginationReducer', () => {
  test('tracks section-scoped load-more progress', () => {
    const initial = createFeedHomePaginationState({
      homeFeed: nextPage,
      replays: nextPage,
      stories: nextPage,
    });

    const loading = feedHomePaginationReducer(initial, {
      section: 'stories',
      type: 'load_more_start',
    });

    expect(loading.sections.stories.isLoadingMore).toBe(true);
    expect(loading.sections.homeFeed.isLoadingMore).toBe(false);
    expect(loading.sections.replays.isLoadingMore).toBe(false);

    const loaded = feedHomePaginationReducer(loading, {
      pageInfo: {
        endCursor: 'cursor-2',
        hasNextPage: false,
      },
      section: 'stories',
      type: 'load_more_success',
    });

    expect(loaded.sections.stories).toEqual({
      error: null,
      isLoadingMore: false,
      pageInfo: {
        endCursor: 'cursor-2',
        hasNextPage: false,
      },
    });
  });

  test('tracks retryable section errors without clearing other sections', () => {
    const initial = createFeedHomePaginationState({
      homeFeed: nextPage,
      replays: nextPage,
      stories: nextPage,
    });

    const failed = feedHomePaginationReducer(initial, {
      message: 'Could not load more stories.',
      section: 'stories',
      type: 'load_more_error',
    });

    expect(failed.sections.stories).toEqual({
      error: 'Could not load more stories.',
      isLoadingMore: false,
      pageInfo: nextPage,
    });
    expect(failed.sections.homeFeed.error).toBeNull();
    expect(failed.sections.replays.error).toBeNull();
  });

  test('tracks combined refresh without clearing section page cursors', () => {
    const initial = createFeedHomePaginationState({
      homeFeed: nextPage,
      replays: nextPage,
      stories: nextPage,
    });

    const refreshing = feedHomePaginationReducer(initial, {
      type: 'refresh_start',
    });

    expect(refreshing.isRefreshing).toBe(true);
    expect(selectFeedHomePageInfo(refreshing, 'stories')).toEqual(nextPage);

    const refreshed = feedHomePaginationReducer(refreshing, {
      sections: {
        homeFeed: { endCursor: 'home-refreshed', hasNextPage: true },
        replays: { endCursor: null, hasNextPage: false },
        stories: { endCursor: 'story-refreshed', hasNextPage: true },
      },
      type: 'refresh_success',
    });

    expect(refreshed.isRefreshing).toBe(false);
    expect(refreshed.sections.stories.pageInfo.endCursor).toBe(
      'story-refreshed',
    );
    expect(refreshed.sections.replays.pageInfo.hasNextPage).toBe(false);
  });
});
```

- [ ] **Step 2: Run reducer tests to verify failure**

Run from `mobile/`:

```sh
bun test tests/feed/feedHomePagination.test.ts
```

Expected: fails because `mobile/src/feed/feedHomePagination.ts` does not exist.

- [ ] **Step 3: Implement reducer and helpers**

Create `mobile/src/feed/feedHomePagination.ts`:

```ts
export type FeedHomePaginationSection = 'homeFeed' | 'replays' | 'stories';

export type FeedHomePaginationPageInfo = {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
};

export type FeedHomeSectionPaginationState = {
  readonly error: string | null;
  readonly isLoadingMore: boolean;
  readonly pageInfo: FeedHomePaginationPageInfo;
};

export type FeedHomePaginationState = {
  readonly isRefreshing: boolean;
  readonly refreshError: string | null;
  readonly sections: Record<
    FeedHomePaginationSection,
    FeedHomeSectionPaginationState
  >;
};

export type FeedHomePaginationAction =
  | {
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_start';
    }
  | {
      readonly message: string;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_error';
    }
  | {
      readonly pageInfo: FeedHomePaginationPageInfo;
      readonly section: FeedHomePaginationSection;
      readonly type: 'load_more_success';
    }
  | { readonly type: 'refresh_start' }
  | { readonly message: string; readonly type: 'refresh_error' }
  | {
      readonly sections: Record<
        FeedHomePaginationSection,
        FeedHomePaginationPageInfo
      >;
      readonly type: 'refresh_success';
    };

const EMPTY_PAGE_INFO: FeedHomePaginationPageInfo = {
  endCursor: null,
  hasNextPage: false,
};

export function createFeedHomePaginationState(sections: {
  readonly homeFeed?: FeedHomePaginationPageInfo | null;
  readonly replays?: FeedHomePaginationPageInfo | null;
  readonly stories?: FeedHomePaginationPageInfo | null;
}): FeedHomePaginationState {
  return {
    isRefreshing: false,
    refreshError: null,
    sections: {
      homeFeed: createSectionState(sections.homeFeed),
      replays: createSectionState(sections.replays),
      stories: createSectionState(sections.stories),
    },
  };
}

export function feedHomePaginationReducer(
  state: FeedHomePaginationState,
  action: FeedHomePaginationAction,
): FeedHomePaginationState {
  switch (action.type) {
    case 'load_more_start':
      return updateSection(state, action.section, {
        error: null,
        isLoadingMore: true,
      });
    case 'load_more_error':
      return updateSection(state, action.section, {
        error: action.message,
        isLoadingMore: false,
      });
    case 'load_more_success':
      return updateSection(state, action.section, {
        error: null,
        isLoadingMore: false,
        pageInfo: action.pageInfo,
      });
    case 'refresh_start':
      return { ...state, isRefreshing: true, refreshError: null };
    case 'refresh_error':
      return {
        ...state,
        isRefreshing: false,
        refreshError: action.message,
      };
    case 'refresh_success':
      return {
        isRefreshing: false,
        refreshError: null,
        sections: {
          homeFeed: createSectionState(action.sections.homeFeed),
          replays: createSectionState(action.sections.replays),
          stories: createSectionState(action.sections.stories),
        },
      };
  }
}

export function selectFeedHomePageInfo(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
): FeedHomePaginationPageInfo {
  return state.sections[section].pageInfo;
}

function createSectionState(
  pageInfo: FeedHomePaginationPageInfo | null | undefined,
): FeedHomeSectionPaginationState {
  return {
    error: null,
    isLoadingMore: false,
    pageInfo: pageInfo ?? EMPTY_PAGE_INFO,
  };
}

function updateSection(
  state: FeedHomePaginationState,
  section: FeedHomePaginationSection,
  patch: Partial<FeedHomeSectionPaginationState>,
): FeedHomePaginationState {
  return {
    ...state,
    sections: {
      ...state.sections,
      [section]: {
        ...state.sections[section],
        ...patch,
      },
    },
  };
}
```

- [ ] **Step 4: Verify reducer tests pass**

Run from `mobile/`:

```sh
bun test tests/feed/feedHomePagination.test.ts
```

Expected: all reducer tests pass.

### Task 3: Render Section Load-More Controls

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.test.tsx`

- [ ] **Step 1: Add screen tests for load-more controls**

In `mobile/tests/feed/FeedHomeScreen.test.tsx`, change the `connection` helper
to accept `pageInfo` overrides:

```ts
function connection<Node>(
  nodes: ReadonlyArray<Node>,
  pageInfo: Partial<Connection<Node>['pageInfo']> = {},
): Connection<Node> {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: nodes.length > 0 ? 'cursor' : null,
      hasNextPage: false,
      ...pageInfo,
    },
  };
}
```

Add this test:

```ts
test('shows section load-more controls only for paginated content sections', () => {
  queryData = {
    ...createFilledQueryData(),
    homeFeed: connection([post({ id: 'post-1' })], {
      endCursor: 'home-cursor',
      hasNextPage: true,
    }),
    liveNow: connection([liveSession({ hostEmail: 'live-host@example.com', id: 'live-1' })], {
      endCursor: 'live-cursor',
      hasNextPage: true,
    }),
    replayFeed: connection(
      [
        liveSession({
          endedAt: '2026-06-30T18:00:00Z',
          hostEmail: 'replay-host@example.com',
          id: 'replay-1',
          status: 'ENDED',
        }),
      ],
      { endCursor: 'replay-cursor', hasNextPage: true },
    ),
    storyFeed: connection([post({ id: 'story-1', kind: 'STORY' })], {
      endCursor: 'story-cursor',
      hasNextPage: true,
    }),
  };

  const tree = renderWithHooks(createElement(FeedHomeContent));

  expect(findPressablesByText(tree, 'Load more stories')).toHaveLength(1);
  expect(findPressablesByText(tree, 'Load more feed posts')).toHaveLength(1);
  expect(findPressablesByText(tree, 'Load more replays')).toHaveLength(1);
  expect(findPressablesByText(tree, 'Load more live sessions')).toHaveLength(0);
});
```

- [ ] **Step 2: Run the screen test to verify failure**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: fails because the three load-more buttons do not render yet.

- [ ] **Step 3: Add load-more rendering props**

In `mobile/src/feed/FeedHomeScreen.tsx`, add a section control type near the
component-local types:

```ts
type FeedHomeLoadMoreControl = {
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly label: string;
  readonly onLoadMore: () => void;
  readonly visible: boolean;
};
```

Update `PostSection` props:

```ts
loadMoreControl: FeedHomeLoadMoreControl;
```

Render the control at the bottom of `PostSection`:

```tsx
{loadMoreControl.visible ? (
  <View style={styles.reportPanel}>
    <AppButton
      disabled={loadMoreControl.isLoading}
      label={
        loadMoreControl.isLoading
          ? 'Loading...'
          : loadMoreControl.label
      }
      onPress={loadMoreControl.onLoadMore}
      variant="secondary"
    />
    {loadMoreControl.error ? (
      <Text style={[styles.metadataText, { color: theme.colors.error }]}>
        {loadMoreControl.error}
      </Text>
    ) : null}
  </View>
) : null}
```

Update `LiveSessionSection` props the same way but pass `visible: false` for
the `Live now` section and a real control only for `Replays`.

- [ ] **Step 4: Wire initial pageInfo into pagination state**

Inside `FeedHomeContent`, after `data` is available, initialize pagination state:

```ts
const [paginationState, dispatchPagination] = useReducer(
  feedHomePaginationReducer,
  createFeedHomePaginationState({
    homeFeed: data.homeFeed?.pageInfo ?? null,
    replays: data.replayFeed?.pageInfo ?? null,
    stories: data.storyFeed?.pageInfo ?? null,
  }),
);
```

Use the reducer state to decide visibility:

```ts
const storyPageInfo = selectFeedHomePageInfo(paginationState, 'stories');
const feedPageInfo = selectFeedHomePageInfo(paginationState, 'homeFeed');
const replayPageInfo = selectFeedHomePageInfo(paginationState, 'replays');
```

For this task, `onLoadMore` can dispatch `load_more_start` only; Task 4 will
replace it with real network loading:

```ts
function startLoadMore(section: FeedHomePaginationSection) {
  dispatchPagination({ section, type: 'load_more_start' });
}
```

- [ ] **Step 5: Verify load-more controls render**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: the new load-more rendering test passes. Existing report and route
tests still pass.

### Task 4: Load Older Section Pages With Relay Cursors

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.test.tsx`

- [ ] **Step 1: Extend the Relay mock**

In `mobile/tests/feed/FeedHomeScreen.test.tsx`, add captured fetch calls:

```ts
type FetchQueryCall = {
  readonly variables: QueryVariables;
};

let fetchQueryCalls: FetchQueryCall[];
let fetchQueryResult: FeedHomeQueryData;
```

Reset them in `beforeEach`:

```ts
fetchQueryCalls = [];
fetchQueryResult = createFilledQueryData();
```

Update the `react-relay` mock:

```ts
fetchQuery: (_environment: unknown, _query: unknown, variables: QueryVariables) => {
  fetchQueryCalls.push({ variables });

  return {
    toPromise: () => Promise.resolve(fetchQueryResult),
  };
},
useRelayEnvironment: () => ({ environment: 'relay' }),
```

- [ ] **Step 2: Add an async cursor test**

Add this test:

```ts
test('loads older story pages with section cursors without blocking live rows', async () => {
  queryData = {
    ...createFilledQueryData(),
    storyFeed: connection([post({ id: 'story-1', kind: 'STORY' })], {
      endCursor: 'story-cursor',
      hasNextPage: true,
    }),
  };
  fetchQueryResult = {
    ...createFilledQueryData(),
    storyFeed: connection([post({ bodyText: 'Older story', id: 'story-2', kind: 'STORY' })], {
      endCursor: 'story-cursor-2',
      hasNextPage: false,
    }),
  };

  let tree = renderWithHooks(createElement(FeedHomeContent));

  findPressableByText(tree, 'Load more stories')?.props.onPress?.();
  tree = renderWithHooks(createElement(FeedHomeContent));

  expect(collectText(tree)).toContain('live-host@example.com');
  expect(fetchQueryCalls[0].variables).toMatchObject({
    feedAfter: null,
    replayAfter: null,
    storyAfter: 'story-cursor',
  });

  await Promise.resolve();
  tree = renderWithHooks(createElement(FeedHomeContent));

  expect(collectText(tree)).toContain('Older story');
  expect(findPressablesByText(tree, 'Load more stories')).toHaveLength(0);
});
```

- [ ] **Step 3: Run the cursor test to verify failure**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: fails because `fetchQuery` is not wired into the screen.

- [ ] **Step 4: Implement `loadMoreSection`**

In `FeedHomeScreen.tsx`, import:

```ts
import {
  fetchQuery,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from 'react-relay';
```

Add the environment:

```ts
const relayEnvironment = useRelayEnvironment();
```

Add a section loader:

```ts
async function loadMoreSection(section: FeedHomePaginationSection) {
  const pageInfo = selectFeedHomePageInfo(paginationState, section);

  if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
    return;
  }

  dispatchPagination({ section, type: 'load_more_start' });

  try {
    const pageData = await fetchQuery<FeedHomeScreenQuery>(
      relayEnvironment,
      feedHomeScreenQuery,
      {
        ...FEED_HOME_QUERY_VARIABLES,
        feedAfter: section === 'homeFeed' ? pageInfo.endCursor : null,
        replayAfter: section === 'replays' ? pageInfo.endCursor : null,
        storyAfter: section === 'stories' ? pageInfo.endCursor : null,
      },
      { fetchPolicy: 'network-only' },
    ).toPromise();

    const nextPageInfo =
      section === 'homeFeed'
        ? pageData?.homeFeed?.pageInfo
        : section === 'replays'
          ? pageData?.replayFeed?.pageInfo
          : pageData?.storyFeed?.pageInfo;

    dispatchPagination({
      pageInfo: nextPageInfo ?? { endCursor: null, hasNextPage: false },
      section,
      type: 'load_more_success',
    });
  } catch {
    dispatchPagination({
      message: formatFeedHomeLoadMoreError(section),
      section,
      type: 'load_more_error',
    });
  }
}
```

Add this local formatter:

```ts
function formatFeedHomeLoadMoreError(
  section: FeedHomePaginationSection,
): string {
  switch (section) {
    case 'homeFeed':
      return 'Could not load more feed posts.';
    case 'replays':
      return 'Could not load more replays.';
    case 'stories':
      return 'Could not load more stories.';
  }
}
```

Replace the temporary `startLoadMore` callbacks with
`() => void loadMoreSection('stories')`, `homeFeed`, and `replays`.

- [ ] **Step 5: Append older rows**

Extend `feedHomePagination.ts` with optional row storage, or keep row storage in
`FeedHomeScreen.tsx` with section-specific arrays. The screen-level shape should
be:

```ts
const [olderStories, setOlderStories] = useState<FeedHomePost[]>([]);
const [olderPosts, setOlderPosts] = useState<FeedHomePost[]>([]);
const [olderReplays, setOlderReplays] = useState<LiveSessionSummary[]>([]);
```

When a section succeeds, append nodes from the returned page:

```ts
if (section === 'stories') {
  setOlderStories((current) =>
    current.concat(readConnectionNodes(pageData?.storyFeed)),
  );
} else if (section === 'homeFeed') {
  setOlderPosts((current) =>
    current.concat(readConnectionNodes(pageData?.homeFeed)),
  );
} else {
  setOlderReplays((current) =>
    current.concat(readConnectionNodes(pageData?.replayFeed)),
  );
}
```

Render `stories.concat(olderStories)`, `posts.concat(olderPosts)`, and
`replaySessions.concat(olderReplays)`.

- [ ] **Step 6: Verify section loading**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: cursor variables are asserted and older rows render after the
resolved page.

### Task 5: Add Combined Refresh Without Clearing Report State

**Files:**
- Modify: `mobile/src/feed/FeedHomeScreen.tsx`
- Modify: `mobile/tests/feed/FeedHomeScreen.test.tsx`

- [ ] **Step 1: Add a `RefreshControl` mock**

In the `react-native` mock, add:

```ts
RefreshControl: NativeComponent,
```

Add a helper near the other test helpers:

```ts
function findHostNodeByType(
  tree: RenderedTree,
  type: string,
): HostNode | null {
  if (tree === null || typeof tree === 'string') {
    return null;
  }

  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findHostNodeByType(child, type);

      if (match) {
        return match;
      }
    }

    return null;
  }

  if (tree.type === type) {
    return tree;
  }

  return findHostNodeByType(tree.children, type);
}
```

- [ ] **Step 2: Add a refresh/report persistence test**

Add this test:

```ts
test('refreshes the home query without clearing local report confirmation', async () => {
  queryData = {
    ...createFilledQueryData(),
    homeFeed: connection([post({ bodyText: 'First public post', id: 'post-1' })]),
  };
  fetchQueryResult = {
    ...createFilledQueryData(),
    homeFeed: connection([post({ bodyText: 'Refreshed public post', id: 'post-2' })]),
  };

  let tree = renderWithHooks(createElement(FeedHomeContent));

  findPressableByText(tree, 'Report post')?.props.onPress?.();
  mutationCommits[0].onCompleted?.({
    reportPost: {
      errors: [],
      report: {
        id: 'report-1',
        insertedAt: '2026-06-30T18:15:30Z',
        postId: 'post-1',
        reason: 'SPAM',
        status: 'OPEN',
      },
    },
  });

  tree = renderWithHooks(createElement(FeedHomeContent));
  expect(collectText(tree)).toContain('Report submitted.');

  const scrollView = findHostNodeByType(tree, 'NativeComponent');
  const refreshControl = scrollView?.props.refreshControl as
    | ReactElement<{ onRefresh: () => void }>
    | undefined;

  refreshControl?.props.onRefresh();

  expect(fetchQueryCalls[0].variables).toMatchObject({
    feedAfter: null,
    replayAfter: null,
    storyAfter: null,
  });

  await Promise.resolve();
  tree = renderWithHooks(createElement(FeedHomeContent));

  expect(collectText(tree)).toContain('Report submitted.');
  expect(collectText(tree)).toContain('Refreshed public post');
});
```

- [ ] **Step 3: Run the refresh test to verify failure**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: fails because `ScrollView` has no `refreshControl` and refresh does
not fetch.

- [ ] **Step 4: Implement refresh**

Import `RefreshControl`:

```ts
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
```

Add `refreshHome`:

```ts
async function refreshHome() {
  dispatchPagination({ type: 'refresh_start' });

  try {
    const refreshedData = await fetchQuery<FeedHomeScreenQuery>(
      relayEnvironment,
      feedHomeScreenQuery,
      FEED_HOME_QUERY_VARIABLES,
      { fetchPolicy: 'network-only' },
    ).toPromise();

    setOlderStories([]);
    setOlderPosts([]);
    setOlderReplays([]);

    dispatchPagination({
      sections: {
        homeFeed: refreshedData?.homeFeed?.pageInfo ?? {
          endCursor: null,
          hasNextPage: false,
        },
        replays: refreshedData?.replayFeed?.pageInfo ?? {
          endCursor: null,
          hasNextPage: false,
        },
        stories: refreshedData?.storyFeed?.pageInfo ?? {
          endCursor: null,
          hasNextPage: false,
        },
      },
      type: 'refresh_success',
    });
  } catch {
    dispatchPagination({
      message: 'Could not refresh home.',
      type: 'refresh_error',
    });
  }
}
```

Attach it to `ScrollView`:

```tsx
refreshControl={
  <RefreshControl
    onRefresh={() => void refreshHome()}
    refreshing={paginationState.isRefreshing}
  />
}
```

To display refreshed rows in the custom test renderer, store refreshed top-level
sections in state:

```ts
const [refreshedHomeData, setRefreshedHomeData] =
  useState<FeedHomeScreenQuery['response'] | null>(null);
const effectiveData = refreshedHomeData ?? data;
```

Then call `setRefreshedHomeData(refreshedData ?? null)` in `refreshHome` and
read sections from `effectiveData` instead of `data`.

- [ ] **Step 5: Verify refresh behavior**

Run from `mobile/`:

```sh
bun test tests/feed/FeedHomeScreen.test.tsx
```

Expected: refresh test passes and report state persists because
`reportPostState` is a separate reducer that is not reinitialized by refresh.

### Task 6: Update Plan Evidence And Run Focused Gates

**Files:**
- Modify: `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`
- Modify if generated files changed:
  `mobile/src/__generated__/**`

- [ ] **Step 1: Run focused mobile tests**

Run from `mobile/`:

```sh
bun test tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx
```

Expected: all feed pagination and screen tests pass.

- [ ] **Step 2: Run Relay codegen if query variables changed**

Run from `mobile/`:

```sh
bun run relay
```

Expected: generated query/mutation artifacts match the checked-in operations.

- [ ] **Step 3: Run broader feed tests**

Run from `mobile/`:

```sh
bun test tests/feed/feedPresentation.test.ts tests/feed/reportPostReducer.test.ts tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx
```

Expected: all feed feature tests pass.

- [ ] **Step 4: Run final whitespace check**

Run from repo root:

```sh
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Record evidence**

In `docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`, update Task
4 checkboxes to `[x]` and add concise evidence like:

```md
Evidence:
- 2026-07-01: `bun test tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx`
  passes after adding section-scoped cursor loading and refresh.
- 2026-07-01: `bun run relay` regenerated feed home query artifacts after
  adding `after` variables.
- 2026-07-01: `git diff --check` passes.
```

- [ ] **Step 6: Commit the completed task**

Run from repo root:

```sh
git add mobile/src/feed mobile/tests/feed mobile/src/__generated__ docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md
git commit -m "Add feed section refresh pagination"
```

Expected: one scoped milestone commit for Task 4.

## Final Verification

Before handing off Task 4, run:

```sh
cd mobile
bun test tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx
bun test tests/feed/feedPresentation.test.ts tests/feed/reportPostReducer.test.ts tests/feed/feedHomePagination.test.ts tests/feed/FeedHomeScreen.test.tsx
bun run relay
cd ..
git diff --check
```

If backend behavior is suspected, promote that issue first and then run:

```sh
mix test test/live_canvas_gql/feed/feed_queries_test.exs
mix test test/live_canvas_gql/content/content_mutations_test.exs
```

## Handoff

After Task 4 lands, continue to Task 5 in
`docs/plans/mobile/2026-06-30-mobile-feed-content-discovery.md`: close the lane
batch, archive the completed plan if final verification passes, and either
promote the next product-facing mobile batch or mark mobile product direction
needed.

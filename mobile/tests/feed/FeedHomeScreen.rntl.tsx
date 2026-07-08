import { isValidElement, type ReactElement } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import HomeRoute from '../../app/(app)/home';
import {
  FeedHomeContent,
  FeedHomeLoadingState,
  FeedHomeQueryErrorState,
  createFeedHomeActions,
  pushFeedHomeAction,
  shouldShowFeedHomeHostAction,
} from '../../src/feed/FeedHomeScreen';

type FeedHomeQueryData = {
  readonly homeFeed: Connection<PostNode> | null;
  readonly liveNow: Connection<LiveSessionNode> | null;
  readonly replayFeed: Connection<LiveSessionNode> | null;
  readonly storyFeed: Connection<PostNode> | null;
  readonly viewer: {
    readonly currentLiveSession: LiveSessionNode | null;
    readonly id: string;
  } | null;
};

type Connection<Node> = {
  readonly edges: ReadonlyArray<{ readonly node: Node | null } | null>;
  readonly pageInfo?: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
};

type PostNode = {
  readonly author: {
    readonly email: string | null;
    readonly id: string;
  };
  readonly bodyText: string | null;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly insertedAt: string;
  readonly kind: string;
  readonly mediaAssets: ReadonlyArray<{
    readonly id: string;
    readonly mimeType: string;
    readonly processingState: string;
    readonly publicUrl: string | null;
  }>;
  readonly visibility: string;
};

type LiveSessionNode = {
  readonly channelTopic: string | null;
  readonly endedAt: string | null;
  readonly host: {
    readonly email: string | null;
    readonly id: string;
  };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt: string | null;
  readonly status: string;
  readonly visibility: string;
};

type QueryVariables = Record<string, unknown>;

type FetchQueryCall = { readonly variables: QueryVariables };
type FetchQueryImplementation = (
  variables: QueryVariables,
) => Promise<FeedHomeQueryData | null | undefined>;
type Deferred<Value> = {
  promise: Promise<Value>;
  reject: (error: unknown) => void;
  resolve: (value: Value) => void;
};

type ReportPostMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly details: string | null;
      readonly postId: string;
      readonly reason: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly reportPost: {
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
      readonly report: {
        readonly id: string;
        readonly insertedAt: string;
        readonly postId: string;
        readonly reason: string;
        readonly status: string;
      } | null;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};
type UpdatePostMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly bodyText: string;
      readonly postId: string;
      readonly visibility: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly updatePost: {
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
      readonly post: PostNode | null;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};
type DeletePostMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly postId: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly deletePost: {
      readonly deletedPostId: string | null;
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};

let mockQueryData: FeedHomeQueryData;
let mockQueryVariables: QueryVariables | null;
let mockFetchQueryCalls: FetchQueryCall[];
let mockFetchQueryImplementation: FetchQueryImplementation | null;
let mockFetchQueryResult: FeedHomeQueryData;
let mockPushedRoutes: unknown[];
const mockReportPostCommit =
  jest.fn<undefined, [ReportPostMutationConfig]>();
const mockUpdatePostCommit =
  jest.fn<undefined, [UpdatePostMutationConfig]>();
const mockDeletePostCommit =
  jest.fn<undefined, [DeletePostMutationConfig]>();

jest.mock('expo-router', () => ({
  Redirect: function RedirectMock(_props: { href: string }) {
    return null;
  },
  Stack: function StackMock(_props: { initialRouteName?: string }) {
    return null;
  },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/home',
  useRouter: () => ({
    push: (route: unknown) => {
      mockPushedRoutes.push(route);
    },
  }),
}));

jest.mock('react-relay', () => ({
  fetchQuery: (
    _environment: unknown,
    _query: unknown,
    variables: QueryVariables,
  ) => {
    mockFetchQueryCalls.push({ variables });

    return {
      toPromise: () =>
        mockFetchQueryImplementation
          ? mockFetchQueryImplementation(variables)
          : Promise.resolve(mockFetchQueryResult),
    };
  },
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    variables: QueryVariables,
  ): FeedHomeQueryData => {
    mockQueryVariables = variables;
    return mockQueryData;
  },
  useMutation: (mutation: unknown) => {
    const operationName = mockRelayOperationName(mutation);

    if (operationName.includes('UpdatePost')) {
      return [mockUpdatePostCommit, false];
    }

    if (operationName.includes('DeletePost')) {
      return [mockDeletePostCommit, false];
    }

    return [mockReportPostCommit, false];
  },
  useRelayEnvironment: () => ({ environment: 'relay' }),
}));

function mockRelayOperationName(mutation: unknown): string {
  if (typeof mutation === 'string') {
    return mutation;
  }

  if (
    mutation !== null &&
    typeof mutation === 'object' &&
    'params' in mutation
  ) {
    const params = mutation.params as { readonly name?: unknown };

    if (typeof params.name === 'string') {
      return params.name;
    }
  }

  return '';
}

beforeEach(() => {
  mockQueryData = createFilledQueryData();
  mockQueryVariables = null;
  mockFetchQueryCalls = [];
  mockFetchQueryImplementation = null;
  mockFetchQueryResult = createFilledQueryData();
  mockPushedRoutes = [];
  mockReportPostCommit.mockClear();
  mockUpdatePostCommit.mockClear();
  mockDeletePostCommit.mockClear();
});

describe('FeedHomeScreen with React Native Testing Library', () => {
  test('keeps home route pointed at the product feed surface', async () => {
    await render(<HomeRoute />);

    expect(screen.getAllByText('Home')).not.toHaveLength(0);
    expect(mockQueryVariables).toEqual({
      feedAfter: null,
      feedFirst: 10,
      liveFirst: 20,
      replayAfter: null,
      replayFirst: 10,
      storyAfter: null,
      storyFirst: 10,
    });
  });

  test('renders stories, home feed, live now, replays, and current session sections', async () => {
    const user = userEvent.setup();

    await render(<FeedHomeContent />);

    expect(screen.getByText('Stories')).toBeOnTheScreen();
    expect(screen.getByText('Story update')).toBeOnTheScreen();
    expect(screen.getByText('Home feed')).toBeOnTheScreen();
    expect(screen.getByText('First public post')).toBeOnTheScreen();
    expect(screen.getAllByText('Live now')).not.toHaveLength(0);
    expect(screen.getByText('live-host@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Replays')).toBeOnTheScreen();
    expect(screen.getByText('replay-host@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Your live session')).toBeOnTheScreen();
    expect(screen.getByText('viewer-host@example.com')).toBeOnTheScreen();
    expect(screen.queryByText('Host a live session')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Watch live' }));
    await user.press(screen.getByRole('button', { name: 'Watch replay' }));
    await user.press(screen.getByRole('button', { name: 'Open session' }));

    expect(mockPushedRoutes).toEqual([
      { params: { sessionId: 'live-1' }, pathname: '/live-session' },
      { params: { sessionId: 'replay-1' }, pathname: '/live-session' },
      { params: { sessionId: 'viewer-live' }, pathname: '/live-session' },
    ]);
  });

  test('shows section load-more controls only for paginated content sections', async () => {
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection(
        [
          post({
            bodyText: 'First public post',
            id: 'post-1',
            kind: 'STANDARD',
          }),
        ],
        { endCursor: 'home-cursor', hasNextPage: true },
      ),
      liveNow: connection(
        [
          liveSession({
            hostEmail: 'viewer-host@example.com',
            id: 'viewer-live',
          }),
          liveSession({
            hostEmail: 'live-host@example.com',
            id: 'live-1',
          }),
        ],
        { endCursor: 'live-cursor', hasNextPage: true },
      ),
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
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };

    await render(<FeedHomeContent />);

    expect(
      screen.queryAllByRole('button', { name: 'Load more stories' }),
    ).toHaveLength(1);
    expect(
      screen.queryAllByRole('button', { name: 'Load more feed posts' }),
    ).toHaveLength(1);
    expect(
      screen.queryAllByRole('button', { name: 'Load more replays' }),
    ).toHaveLength(1);
    expect(
      screen.queryAllByRole('button', { name: 'Load more live sessions' }),
    ).toHaveLength(0);
  });

  test('loads older story pages with section cursors without blocking live rows', async () => {
    const user = userEvent.setup();

    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryResult = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Older story',
            expiresAt: '2026-07-01T15:15:30Z',
            id: 'story-2',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor-2', hasNextPage: false },
      ),
    };

    await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    expect(screen.getByText('live-host@example.com')).toBeOnTheScreen();
    expect(mockFetchQueryCalls[0]?.variables).toMatchObject({
      feedAfter: null,
      replayAfter: null,
      storyAfter: 'story-cursor',
    });

    await waitFor(() => {
      expect(screen.getByText('Older story')).toBeOnTheScreen();
    });
    expect(
      screen.queryAllByRole('button', { name: 'Load more stories' }),
    ).toHaveLength(0);
  });

  test('syncs load-more controls when Relay delivers newer query pageInfo', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: null, hasNextPage: false },
      ),
    };

    const view = await render(<FeedHomeContent />);

    expect(
      screen.queryAllByRole('button', { name: 'Load more stories' }),
    ).toHaveLength(0);

    mockQueryData = {
      ...mockQueryData,
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-network-cursor', hasNextPage: true },
      ),
    };

    await view.rerender(<FeedHomeContent />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Load more stories' }),
      ).toBeOnTheScreen();
    });

    mockFetchQueryResult = {
      ...createFilledQueryData(),
      storyFeed: connection([], { endCursor: null, hasNextPage: false }),
    };

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    expect(mockFetchQueryCalls[0]?.variables).toMatchObject({
      storyAfter: 'story-network-cursor',
    });
  });

  test('blocks duplicate load-more taps before rerender', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryImplementation = (_variables) => new Promise(() => undefined);

    await render(<FeedHomeContent />);

    const loadMoreStories = screen.getByRole('button', {
      name: 'Load more stories',
    });

    await user.press(loadMoreStories);
    await user.press(loadMoreStories);

    expect(mockFetchQueryCalls).toHaveLength(1);
  });

  test('blocks load-more while refresh is in flight before rerender', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryImplementation = (_variables) => new Promise(() => undefined);

    const view = await render(<FeedHomeContent />);

    const loadMoreStories = screen.getByRole('button', {
      name: 'Load more stories',
    });

    await act(() => {
      getRefreshControl(view).props.onRefresh?.();
    });
    await user.press(loadMoreStories);

    expect(mockFetchQueryCalls).toHaveLength(1);
    expect(mockFetchQueryCalls[0]?.variables).toMatchObject({
      storyAfter: null,
    });
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });

  test('keeps in-flight load-more requests active across query pageInfo sync', async () => {
    const user = userEvent.setup();
    const secondLoadMoreDeferred =
      createDeferred<FeedHomeQueryData | null | undefined>();

    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryImplementation = (variables) =>
      variables.storyAfter === 'story-cursor-2'
        ? secondLoadMoreDeferred.promise
        : Promise.resolve({
            ...createFilledQueryData(),
            storyFeed: connection(
              [
                post({
                  bodyText: 'Older story',
                  expiresAt: '2026-07-01T15:15:30Z',
                  id: 'story-2',
                  kind: 'STORY',
                }),
              ],
              { endCursor: 'story-cursor-2', hasNextPage: true },
            ),
          });

    const view = await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    await waitFor(() => {
      expect(screen.getByText('Older story')).toBeOnTheScreen();
    });

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    mockQueryData = {
      ...mockQueryData,
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-network-cursor', hasNextPage: true },
      ),
    };

    await view.rerender(<FeedHomeContent />);

    await act(async () => {
      secondLoadMoreDeferred.resolve({
        ...createFilledQueryData(),
        storyFeed: connection(
          [
            post({
              bodyText: 'Second older story',
              expiresAt: '2026-07-01T14:15:30Z',
              id: 'story-3',
              kind: 'STORY',
            }),
          ],
          { endCursor: null, hasNextPage: false },
        ),
      });
      await flushPromises();
    });

    expect(screen.getByText('Second older story')).toBeOnTheScreen();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  test('clears stale load-more request refs when the base page changes', async () => {
    const user = userEvent.setup();
    const staleLoadMoreDeferred =
      createDeferred<FeedHomeQueryData | null | undefined>();

    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryImplementation = (variables) =>
      variables.storyAfter === 'story-cursor'
        ? staleLoadMoreDeferred.promise
        : Promise.resolve({
            ...createFilledQueryData(),
            storyFeed: connection(
              [
                post({
                  bodyText: 'Older story from new window',
                  expiresAt: '2026-07-01T16:15:30Z',
                  id: 'story-new-older',
                  kind: 'STORY',
                }),
              ],
              { endCursor: null, hasNextPage: false },
            ),
          });

    const view = await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    expect(mockFetchQueryCalls).toHaveLength(1);
    expect(mockFetchQueryCalls[0]?.variables).toMatchObject({
      storyAfter: 'story-cursor',
    });

    mockQueryData = {
      ...mockQueryData,
      storyFeed: connection(
        [
          post({
            bodyText: 'New base story',
            expiresAt: '2026-07-01T18:15:30Z',
            id: 'story-new-base',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-network-cursor', hasNextPage: true },
      ),
    };

    await view.rerender(<FeedHomeContent />);

    await waitFor(() => {
      expect(screen.getByText('New base story')).toBeOnTheScreen();
    });

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));

    expect(mockFetchQueryCalls).toHaveLength(2);
    expect(mockFetchQueryCalls[1]?.variables).toMatchObject({
      storyAfter: 'story-network-cursor',
    });
  });

  test('drops retained older feed posts when the base page changes', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection(
        [
          post({
            bodyText: 'First public post',
            id: 'post-1',
            kind: 'STANDARD',
          }),
        ],
        { endCursor: 'home-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryResult = {
      ...createFilledQueryData(),
      homeFeed: connection(
        [
          post({
            bodyText: 'Older public post',
            id: 'post-2',
            kind: 'STANDARD',
          }),
        ],
        { endCursor: null, hasNextPage: false },
      ),
    };

    const view = await render(<FeedHomeContent />);

    await user.press(
      screen.getByRole('button', { name: 'Load more feed posts' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Older public post')).toBeOnTheScreen();
    });

    mockQueryData = {
      ...mockQueryData,
      homeFeed: connection(
        [
          post({
            bodyText: 'New top public post',
            id: 'post-0',
            kind: 'STANDARD',
          }),
          post({
            bodyText: 'First public post',
            id: 'post-1',
            kind: 'STANDARD',
          }),
        ],
        { endCursor: 'new-home-cursor', hasNextPage: true },
      ),
    };
    await view.rerender(<FeedHomeContent />);

    expect(screen.getByText('New top public post')).toBeOnTheScreen();
    expect(screen.queryByText('Older public post')).toBeNull();
  });

  test('ignores stale load-more responses after refresh succeeds', async () => {
    const user = userEvent.setup();
    const loadMoreDeferred =
      createDeferred<FeedHomeQueryData | null | undefined>();
    const refreshDeferred = createDeferred<FeedHomeQueryData | null | undefined>();

    mockQueryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    mockFetchQueryImplementation = (variables) =>
      variables.storyAfter === 'story-cursor'
        ? loadMoreDeferred.promise
        : refreshDeferred.promise;

    const view = await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Load more stories' }));
    await act(() => {
      getRefreshControl(view).props.onRefresh?.();
    });
    await act(async () => {
      refreshDeferred.resolve({
        ...createFilledQueryData(),
        storyFeed: connection([
          post({
            bodyText: 'Refreshed story',
            expiresAt: '2026-07-01T18:15:30Z',
            id: 'story-refreshed',
            kind: 'STORY',
          }),
        ]),
      });
      await flushPromises();
    });

    expect(screen.getByText('Refreshed story')).toBeOnTheScreen();

    await act(async () => {
      loadMoreDeferred.resolve({
        ...createFilledQueryData(),
        storyFeed: connection([
          post({
            bodyText: 'Stale older story',
            expiresAt: '2026-07-01T15:15:30Z',
            id: 'story-stale',
            kind: 'STORY',
          }),
        ]),
      });
      await flushPromises();
    });

    expect(screen.queryByText('Stale older story')).toBeNull();
  });

  test('ignores stale refresh responses when refreshes overlap', async () => {
    const firstRefreshDeferred =
      createDeferred<FeedHomeQueryData | null | undefined>();
    const secondRefreshDeferred =
      createDeferred<FeedHomeQueryData | null | undefined>();
    let refreshCount = 0;

    mockFetchQueryImplementation = (_variables) => {
      refreshCount += 1;

      return refreshCount === 1
        ? firstRefreshDeferred.promise
        : secondRefreshDeferred.promise;
    };

    const view = await render(<FeedHomeContent />);
    const refreshControl = getRefreshControl(view);

    await act(() => {
      refreshControl.props.onRefresh?.();
      refreshControl.props.onRefresh?.();
    });

    await act(async () => {
      secondRefreshDeferred.resolve({
        ...createFilledQueryData(),
        storyFeed: connection([
          post({
            bodyText: 'Newest refreshed story',
            expiresAt: '2026-07-01T18:30:00Z',
            id: 'story-newest',
            kind: 'STORY',
          }),
        ]),
      });
      await flushPromises();
    });

    expect(screen.getByText('Newest refreshed story')).toBeOnTheScreen();

    await act(async () => {
      firstRefreshDeferred.resolve({
        ...createFilledQueryData(),
        storyFeed: connection([
          post({
            bodyText: 'Stale refreshed story',
            expiresAt: '2026-07-01T18:00:00Z',
            id: 'story-stale-refresh',
            kind: 'STORY',
          }),
        ]),
      });
      await flushPromises();
    });

    expect(screen.getByText('Newest refreshed story')).toBeOnTheScreen();
    expect(screen.queryByText('Stale refreshed story')).toBeNull();
  });

  test('keeps compose, host, profile, and diagnostics actions reachable from home', async () => {
    const user = userEvent.setup();

    expect(shouldShowFeedHomeHostAction(null)).toBe(true);
    expect(shouldShowFeedHomeHostAction({ id: 'live-1' })).toBe(false);

    expect(createFeedHomeActions(true)).toEqual([
      {
        key: 'compose',
        label: 'Create post',
        route: '/compose',
        variant: 'primary',
      },
      {
        key: 'host',
        label: 'Host a live session',
        route: '/host-broadcast',
        variant: 'primary',
      },
      {
        key: 'profile',
        label: 'Open profile',
        route: '/profile',
        variant: 'secondary',
      },
      {
        key: 'contacts',
        label: 'Find contacts',
        route: '/contacts',
        variant: 'secondary',
      },
      {
        key: 'settings',
        label: 'Settings',
        route: '/settings',
        variant: 'secondary',
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        route: '/diagnostics',
        variant: 'secondary',
      },
    ]);

    expect(createFeedHomeActions(false)).toEqual([
      {
        key: 'compose',
        label: 'Create post',
        route: '/compose',
        variant: 'primary',
      },
      {
        key: 'profile',
        label: 'Open profile',
        route: '/profile',
        variant: 'secondary',
      },
      {
        key: 'contacts',
        label: 'Find contacts',
        route: '/contacts',
        variant: 'secondary',
      },
      {
        key: 'settings',
        label: 'Settings',
        route: '/settings',
        variant: 'secondary',
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        route: '/diagnostics',
        variant: 'secondary',
      },
    ]);

    const routes: string[] = [];
    pushFeedHomeAction(
      {
        push: (route) => {
          routes.push(route);
        },
      },
      { route: '/compose' },
    );

    expect(routes).toEqual(['/compose']);

    await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Create post' }));
    await user.press(screen.getByRole('button', { name: 'Find contacts' }));
    await user.press(screen.getByRole('button', { name: 'Settings' }));

    expect(mockPushedRoutes).toEqual(['/compose', '/contacts', '/settings']);
  });

  test('renders section-specific empty states', async () => {
    mockQueryData = {
      homeFeed: connection([]),
      liveNow: connection([]),
      replayFeed: connection([]),
      storyFeed: connection([]),
      viewer: {
        currentLiveSession: null,
        id: 'viewer-1',
      },
    };

    await render(<FeedHomeContent />);

    expect(screen.getByText('Host a live session')).toBeOnTheScreen();
    expect(screen.getByText('No stories are available yet.')).toBeOnTheScreen();
    expect(
      screen.getByText('No feed posts are available yet.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('No live sessions are available right now.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('No replays are available yet.')).toBeOnTheScreen();
  });

  test('renders loading and retryable query-error states', async () => {
    const user = userEvent.setup();
    const retry = jest.fn();

    const loadingView = await render(<FeedHomeLoadingState />);

    expect(screen.getByText('Loading home...')).toBeOnTheScreen();

    await loadingView.unmount();

    await render(<FeedHomeQueryErrorState onRetry={retry} />);

    expect(
      screen.getByText("We couldn't load home. Check your connection and try again."),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Retry' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('reports non-owned posts while keeping own posts out of the action set', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({ bodyText: 'First public post', id: 'post-1' }),
        post({
          author: {
            email: 'viewer@example.com',
            id: 'viewer-1',
          },
          bodyText: 'Own post',
          id: 'own-post',
        }),
      ]),
      storyFeed: connection([]),
    };

    await render(<FeedHomeContent />);

    expect(
      screen.queryAllByRole('button', { name: 'Report post' }),
    ).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Report post' }));

    expect(mockReportPostCommit).toHaveBeenCalledTimes(1);
    expect(mockReportPostCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        details: null,
        postId: 'post-1',
        reason: 'SPAM',
      },
    });

    await completeReportPost({
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

    expect(screen.getByText('First public post')).toBeOnTheScreen();
    expect(screen.getByText('Own post')).toBeOnTheScreen();
    expect(screen.getByText('Report submitted.')).toBeOnTheScreen();
    expect(screen.queryByText('Report reason: SPAM')).toBeNull();
  });

  test('edits viewer-owned posts inline and leaves mutation errors retryable', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          author: {
            email: 'viewer@example.com',
            id: 'viewer-1',
          },
          bodyText: 'Own post',
          id: 'own-post',
          visibility: 'FOLLOWERS',
        }),
        post({ bodyText: 'Other post', id: 'post-1' }),
      ]),
      storyFeed: connection([]),
    };

    await render(<FeedHomeContent />);

    expect(screen.getByRole('button', { name: 'Edit post' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeOnTheScreen();
    expect(
      screen.queryAllByRole('button', { name: 'Report post' }),
    ).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Edit post' }));

    const bodyInput = screen.getByDisplayValue('Own post');
    await user.clear(bodyInput);
    await user.type(bodyInput, '  Updated owner post  ');
    await user.press(screen.getByRole('button', { name: 'Public' }));
    await user.press(screen.getByRole('button', { name: 'Save post' }));

    expect(mockUpdatePostCommit).toHaveBeenCalledTimes(1);
    expect(mockUpdatePostCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        bodyText: 'Updated owner post',
        postId: 'own-post',
        visibility: 'PUBLIC',
      },
    });

    await completeUpdatePost({
      updatePost: {
        errors: [{ field: 'postId', message: 'not_found' }],
        post: null,
      },
    });

    expect(screen.getByText('This post is no longer available.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Save post' }));

    expect(mockUpdatePostCommit).toHaveBeenCalledTimes(2);

    await completeUpdatePost(
      {
        updatePost: {
          errors: [],
          post: post({
            author: {
              email: 'viewer@example.com',
              id: 'viewer-1',
            },
            bodyText: 'Updated owner post',
            id: 'own-post',
            visibility: 'PUBLIC',
          }),
        },
      },
      1,
    );

    expect(screen.getByText('Updated owner post')).toBeOnTheScreen();
    expect(screen.queryByText('Own post')).toBeNull();
  });

  test('confirms delete before removing viewer-owned rows locally', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          author: {
            email: 'viewer@example.com',
            id: 'viewer-1',
          },
          bodyText: 'Own post',
          id: 'own-post',
        }),
      ]),
      storyFeed: connection([]),
    };

    await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Delete post' }));

    expect(
      screen.getByText('Delete this post? This cannot be undone.'),
    ).toBeOnTheScreen();
    expect(mockDeletePostCommit).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(mockDeletePostCommit).toHaveBeenCalledTimes(1);
    expect(mockDeletePostCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        postId: 'own-post',
      },
    });

    await completeDeletePost({
      deletePost: {
        deletedPostId: 'own-post',
        errors: [],
      },
    });

    expect(screen.queryByText('Own post')).toBeNull();
    expect(screen.getByText('No feed posts are available yet.')).toBeOnTheScreen();
  });

  test('refreshes the home query without clearing local report confirmation', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          bodyText: 'First public post',
          id: 'post-1',
          kind: 'STANDARD',
        }),
      ]),
      storyFeed: connection([]),
    };
    mockFetchQueryResult = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          bodyText: 'First public post',
          id: 'post-1',
          kind: 'STANDARD',
        }),
        post({
          bodyText: 'Refreshed public post',
          id: 'post-2',
          kind: 'STANDARD',
        }),
      ]),
    };

    const view = await render(<FeedHomeContent />);

    await user.press(screen.getByRole('button', { name: 'Report post' }));

    expect(mockReportPostCommit).toHaveBeenCalledTimes(1);

    await completeReportPost({
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

    expect(screen.getByText('Report submitted.')).toBeOnTheScreen();

    await act(async () => {
      getRefreshControl(view).props.onRefresh?.();
      await flushPromises();
    });

    expect(mockFetchQueryCalls[0]?.variables).toMatchObject({
      feedAfter: null,
      replayAfter: null,
      storyAfter: null,
    });

    expect(screen.getByText('Report submitted.')).toBeOnTheScreen();
    expect(screen.getByText('Refreshed public post')).toBeOnTheScreen();
  });

  test('keeps Relay query updates visible after a manual refresh', async () => {
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          bodyText: 'First public post',
          id: 'post-1',
          kind: 'STANDARD',
        }),
      ]),
    };
    mockFetchQueryResult = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({
          bodyText: 'Refreshed public post',
          id: 'post-2',
          kind: 'STANDARD',
        }),
      ]),
    };

    const view = await render(<FeedHomeContent />);

    await act(async () => {
      getRefreshControl(view).props.onRefresh?.();
      await flushPromises();
    });

    expect(screen.getByText('Refreshed public post')).toBeOnTheScreen();

    mockQueryData = {
      ...mockQueryData,
      homeFeed: connection([
        post({
          bodyText: 'Relay live public post',
          id: 'post-3',
          kind: 'STANDARD',
        }),
      ]),
    };

    await view.rerender(<FeedHomeContent />);

    expect(screen.getByText('Relay live public post')).toBeOnTheScreen();
    expect(screen.queryByText('Refreshed public post')).toBeNull();
  });

  test('surfaces refresh failures to the viewer', async () => {
    mockFetchQueryImplementation = (_variables) =>
      Promise.reject(new Error('offline'));

    const view = await render(<FeedHomeContent />);

    await act(async () => {
      getRefreshControl(view).props.onRefresh?.();
      await flushPromises();
    });

    expect(screen.getByText('Could not refresh home.')).toBeOnTheScreen();
  });

  test('blocks duplicate report taps and leaves payload errors retryable', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      ...createFilledQueryData(),
      homeFeed: connection([post({ id: 'post-1' })]),
      storyFeed: connection([]),
    };

    await render(<FeedHomeContent />);
    const reportButton = screen.getByRole('button', { name: 'Report post' });

    await fireEvent.press(reportButton);
    await fireEvent.press(reportButton);

    expect(mockReportPostCommit).toHaveBeenCalledTimes(1);

    await completeReportPost({
      reportPost: {
        errors: [{ field: 'postId', message: 'own_post' }],
        report: null,
      },
    });

    expect(screen.getByText('You cannot report your own post.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Report post' }));

    expect(mockReportPostCommit).toHaveBeenCalledTimes(2);
  });
});

function getRefreshControl(
  view: Awaited<ReturnType<typeof render>>,
): ReactElement<{
  onRefresh?: () => void;
  refreshing?: boolean;
}> {
  const refreshControl = view.root?.props.refreshControl;

  if (
    !isValidElement<{
      onRefresh?: () => void;
      refreshing?: boolean;
    }>(refreshControl)
  ) {
    throw new Error('Expected ScrollView to receive a RefreshControl.');
  }

  return refreshControl;
}

async function completeReportPost(
  payload: Parameters<NonNullable<ReportPostMutationConfig['onCompleted']>>[0],
) {
  const config = mockReportPostCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function completeUpdatePost(
  payload: Parameters<NonNullable<UpdatePostMutationConfig['onCompleted']>>[0],
  callIndex = 0,
) {
  const config = mockUpdatePostCommit.mock.calls[callIndex]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function completeDeletePost(
  payload: Parameters<NonNullable<DeletePostMutationConfig['onCompleted']>>[0],
) {
  const config = mockDeletePostCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

function createFilledQueryData(): FeedHomeQueryData {
  return {
    homeFeed: connection([
      post({
        bodyText: 'First public post',
        id: 'post-1',
        kind: 'STANDARD',
      }),
    ]),
    liveNow: connection([
      liveSession({
        hostEmail: 'viewer-host@example.com',
        id: 'viewer-live',
      }),
      liveSession({
        hostEmail: 'live-host@example.com',
        id: 'live-1',
      }),
    ]),
    replayFeed: connection([
      liveSession({
        endedAt: '2026-06-30T18:00:00Z',
        hostEmail: 'replay-host@example.com',
        id: 'replay-1',
        status: 'ENDED',
      }),
    ]),
    storyFeed: connection([
      post({
        bodyText: 'Story update',
        expiresAt: '2026-07-01T17:15:30Z',
        id: 'story-1',
        kind: 'STORY',
      }),
    ]),
    viewer: {
      currentLiveSession: liveSession({
        hostEmail: 'viewer-host@example.com',
        id: 'viewer-live',
      }),
      id: 'viewer-1',
    },
  };
}

function connection<Node>(
  nodes: ReadonlyArray<Node>,
  pageInfo: Partial<NonNullable<Connection<Node>['pageInfo']>> = {},
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

function createDeferred<Value>(): Deferred<Value> {
  let resolveDeferred: ((value: Value) => void) | null = null;
  let rejectDeferred: ((error: unknown) => void) | null = null;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  if (resolveDeferred === null || rejectDeferred === null) {
    throw new Error('Expected deferred promise handlers to be initialized.');
  }

  return {
    promise,
    reject: rejectDeferred,
    resolve: resolveDeferred,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function post(overrides: Partial<PostNode> = {}): PostNode {
  return {
    author: {
      email: 'creator@example.com',
      id: 'author-1',
    },
    bodyText: 'Post body',
    expiresAt: null,
    id: 'post-1',
    insertedAt: '2026-06-30T17:15:30Z',
    kind: 'STANDARD',
    mediaAssets: [
      {
        id: 'media-1',
        mimeType: 'image/jpeg',
        processingState: 'PROCESSED',
        publicUrl: 'https://media.example.test/post.jpg',
      },
    ],
    visibility: 'PUBLIC',
    ...overrides,
  };
}

function liveSession({
  endedAt = null,
  hostEmail,
  id,
  status = 'LIVE',
}: {
  endedAt?: string | null;
  hostEmail: string;
  id: string;
  status?: string;
}): LiveSessionNode {
  return {
    channelTopic: status === 'ENDED' ? null : `session:${id}`,
    endedAt,
    host: {
      email: hostEmail,
      id: `${id}-host`,
    },
    id,
    insertedAt: '2026-06-30T17:00:00Z',
    startedAt: status === 'STARTING' ? null : '2026-06-30T17:10:00Z',
    status,
    visibility: 'PUBLIC',
  };
}

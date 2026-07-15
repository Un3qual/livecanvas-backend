import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import ViewerProfileContentRoute from '../../app/(app)/profile/content';
import OtherProfileContentRoute from '../../app/(app)/profiles/[id]/content';
import { ProfileContentListScreen } from '../../src/profile/ProfileContentListScreen';
import { liveSessionHref } from '../../src/live/liveSessionNavigation';
import { storyHref } from '../../src/content/story/storyNavigation';

type QueryVariables = {
  readonly after: string | null;
  readonly first: number;
  readonly id: string;
  readonly includePosts: boolean;
  readonly includeReplays: boolean;
  readonly includeStories: boolean;
};

type QueryData = ReturnType<typeof profileContentData>;

type QueryOptions = {
  readonly fetchKey?: number;
  readonly fetchPolicy?: string;
};

let mockSearchParams: Record<string, string | string[] | undefined>;
let mockQueryData: QueryData;
let mockQueryVariables: QueryVariables[];
let mockQueryOptions: QueryOptions[];
let mockQueryShouldFail: boolean;
let mockFetchQueryVariables: QueryVariables[];
let mockFetchQueryImplementation: (
  variables: QueryVariables,
) => Promise<QueryData | null | undefined>;
let mockPushedRoutes: unknown[];

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
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
    mockFetchQueryVariables.push(variables);

    return {
      toPromise: () => mockFetchQueryImplementation(variables),
    };
  },
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    variables: QueryVariables,
    options: QueryOptions,
  ): QueryData => {
    mockQueryVariables.push(variables);
    mockQueryOptions.push(options);

    if (mockQueryShouldFail) {
      throw new Error('query failed');
    }

    return mockQueryData;
  },
  useMutation: () => [jest.fn(), false],
  useRelayEnvironment: () => ({ environment: 'relay' }),
}));

beforeEach(() => {
  mockSearchParams = {};
  mockQueryVariables = [];
  mockQueryOptions = [];
  mockQueryShouldFail = false;
  mockFetchQueryVariables = [];
  mockPushedRoutes = [];
  mockQueryData = profileContentData({
    kind: 'posts',
    profileId: 'viewer-id',
    rows: [post('post-1', 'viewer-id', 'Initial post')],
    viewerId: 'viewer-id',
  });
  mockFetchQueryImplementation = (_variables) =>
    Promise.resolve(
      profileContentData({
        kind: 'posts',
        profileId: 'viewer-id',
        rows: [],
        viewerId: 'viewer-id',
      }),
    );
});

describe('ProfileContentListScreen routes', () => {
  test('retries a failed route with a fresh network-only Relay request', async () => {
    const user = userEvent.setup();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockSearchParams = { id: 'viewer-id', kind: 'posts' };
    mockQueryShouldFail = true;

    await render(<ViewerProfileContentRoute />);

    expect(screen.getByText('We could not load posts.')).toBeOnTheScreen();
    mockQueryShouldFail = false;
    await user.press(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByTestId('profile-content-list')).toBeOnTheScreen();
    expect(mockQueryOptions.at(-1)).toEqual({
      fetchKey: 1,
      fetchPolicy: 'network-only',
    });
    consoleError.mockRestore();
  });

  test('rejects missing, invalid, or repeated viewer route params', async () => {
    mockSearchParams = { kind: 'posts' };
    const view = await render(<ViewerProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockSearchParams = { id: ['viewer-id', 'other-id'], kind: 'posts' };
    await view.rerender(<ViewerProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockSearchParams = { id: 'viewer-id', kind: 'live' };
    await view.rerender(<ViewerProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockSearchParams = { id: 'viewer-id', kind: ['posts', 'stories'] };
    await view.rerender(<ViewerProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockSearchParams = { id: 'viewer-id', kind: 'posts' };
    await view.rerender(<ViewerProfileContentRoute />);
    expect(screen.getByTestId('profile-content-list')).toBeOnTheScreen();
  });

  test('rejects invalid other-profile params and accepts opaque valid values', async () => {
    mockSearchParams = { id: 'opaque-profile-id', kind: ['replays', 'posts'] };
    const view = await render(<OtherProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockSearchParams = { id: ['', 'opaque-profile-id'], kind: 'replays' };
    await view.rerender(<OtherProfileContentRoute />);
    expect(screen.getByText('Profile link is invalid.')).toBeOnTheScreen();

    mockQueryData = profileContentData({
      kind: 'replays',
      profileId: 'opaque-profile-id',
      rows: [replay('replay-1', 'opaque-profile-id')],
      viewerId: 'viewer-id',
    });
    mockSearchParams = { id: 'opaque-profile-id', kind: 'replays' };
    await view.rerender(<OtherProfileContentRoute />);
    expect(screen.getByTestId('profile-content-list')).toBeOnTheScreen();
    expect(mockQueryVariables.at(-1)).toEqual({
      after: null,
      first: 10,
      id: 'opaque-profile-id',
      includePosts: false,
      includeReplays: true,
      includeStories: false,
    });
  });
});

describe('ProfileContentListScreen pagination and controls', () => {
  test('uses the opaque cursor, keeps rows on retry, and deduplicates appended IDs', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    mockQueryData = profileContentData({
      kind: 'posts',
      pageInfo: { endCursor: 'opaque-cursor-1', hasNextPage: true },
      profileId: 'viewer-id',
      rows: [post('post-1', 'viewer-id', 'Initial post')],
      viewerId: 'viewer-id',
    });
    mockFetchQueryImplementation = (_variables) => {
      requestCount += 1;

      return requestCount === 1
        ? Promise.reject(new Error('network'))
        : Promise.resolve(
            profileContentData({
              kind: 'posts',
              profileId: 'viewer-id',
              rows: [
                post('post-1', 'viewer-id', 'Duplicate post'),
                post('post-2', 'viewer-id', 'Older post'),
              ],
              viewerId: 'viewer-id',
            }),
          );
    };

    await render(
      <ProfileContentListScreen kind="posts" profileId="viewer-id" />,
    );

    expect(mockQueryVariables).toEqual([
      {
        after: null,
        first: 10,
        id: 'viewer-id',
        includePosts: true,
        includeReplays: false,
        includeStories: false,
      },
    ]);
    await user.press(
      screen.getByRole('button', { name: 'Load more feed posts' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Could not load more posts.')).toBeOnTheScreen();
    });
    expect(screen.getByText('Initial post')).toBeOnTheScreen();

    await user.press(
      screen.getByRole('button', { name: 'Load more feed posts' }),
    );
    await waitFor(() => {
      expect(screen.getByText('Older post')).toBeOnTheScreen();
    });

    expect(mockFetchQueryVariables).toHaveLength(2);
    expect(mockFetchQueryVariables[1]).toMatchObject({
      after: 'opaque-cursor-1',
      first: 10,
      id: 'viewer-id',
    });
    expect(screen.queryByText('Duplicate post')).toBeNull();
    expect(screen.getByText('Initial post')).toBeOnTheScreen();
  });

  test('blocks same-tick load-more presses with the request identity ref', async () => {
    let resolvePage: ((data: QueryData) => void) | undefined;
    mockQueryData = profileContentData({
      kind: 'stories',
      pageInfo: { endCursor: 'opaque-story-cursor', hasNextPage: true },
      profileId: 'viewer-id',
      rows: [post('story-1', 'viewer-id', 'Current story', 'STORY')],
      viewerId: 'viewer-id',
    });
    mockFetchQueryImplementation = (_variables) =>
      new Promise((resolve) => {
        resolvePage = resolve;
      });

    await render(
      <ProfileContentListScreen kind="stories" profileId="viewer-id" />,
    );
    const loadMore = screen.getByRole('button', { name: 'Load more stories' });
    await fireEvent.press(loadMore);
    await fireEvent.press(loadMore);

    expect(mockFetchQueryVariables).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    });

    await act(() => {
      resolvePage?.(
        profileContentData({
          kind: 'stories',
          profileId: 'viewer-id',
          rows: [],
          viewerId: 'viewer-id',
        }),
      );
    });
  });

  test('resets on route changes and ignores an old A completion after A to B to A', async () => {
    const user = userEvent.setup();
    let resolveOldPage: ((data: QueryData) => void) | undefined;
    mockQueryData = profileContentData({
      kind: 'posts',
      pageInfo: { endCursor: 'old-a-cursor', hasNextPage: true },
      profileId: 'profile-a',
      rows: [post('post-a-old', 'profile-a', 'Old A base')],
      viewerId: 'viewer-id',
    });
    mockFetchQueryImplementation = (_variables) =>
      new Promise((resolve) => {
        resolveOldPage = resolve;
      });

    const view = await render(
      <ProfileContentListScreen kind="posts" profileId="profile-a" />,
    );
    await user.press(
      screen.getByRole('button', { name: 'Load more feed posts' }),
    );

    mockQueryData = profileContentData({
      kind: 'stories',
      profileId: 'profile-b',
      rows: [post('story-b', 'profile-b', 'Profile B story', 'STORY')],
      viewerId: 'viewer-id',
    });
    await view.rerender(
      <ProfileContentListScreen kind="stories" profileId="profile-b" />,
    );
    expect(screen.getByText('Profile B story')).toBeOnTheScreen();
    expect(screen.queryByText('Old A base')).toBeNull();

    mockQueryData = profileContentData({
      kind: 'posts',
      profileId: 'profile-a',
      rows: [post('post-a-new', 'profile-a', 'New A base')],
      viewerId: 'viewer-id',
    });
    await view.rerender(
      <ProfileContentListScreen kind="posts" profileId="profile-a" />,
    );
    expect(screen.getByText('New A base')).toBeOnTheScreen();

    await act(() => {
      resolveOldPage?.(
        profileContentData({
          kind: 'posts',
          profileId: 'profile-a',
          rows: [post('stale-post', 'profile-a', 'Stale A page')],
          viewerId: 'viewer-id',
        }),
      );
    });

    expect(screen.queryByText('Stale A page')).toBeNull();
    expect(screen.getByText('New A base')).toBeOnTheScreen();
  });

  test('shows viewer owner controls, other report controls, and replay navigation', async () => {
    const user = userEvent.setup();
    mockQueryData = profileContentData({
      kind: 'posts',
      profileId: 'viewer-id',
      rows: [post('viewer-post', 'viewer-id', 'Viewer post')],
      viewerId: 'viewer-id',
    });
    const view = await render(
      <ProfileContentListScreen kind="posts" profileId="viewer-id" />,
    );
    expect(screen.getByRole('button', { name: 'Edit post' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete post' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Report post' })).toBeNull();

    mockQueryData = profileContentData({
      kind: 'stories',
      profileId: 'other-id',
      rows: [post('other-story', 'other-id', 'Other story', 'STORY')],
      viewerId: 'viewer-id',
    });
    await view.rerender(
      <ProfileContentListScreen kind="stories" profileId="other-id" />,
    );
    expect(screen.getByRole('button', { name: 'Report post' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Edit post' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'View story' }));

    mockQueryData = profileContentData({
      kind: 'replays',
      profileId: 'other-id',
      rows: [replay('opaque-replay-id', 'other-id')],
      viewerId: 'viewer-id',
    });
    await view.rerender(
      <ProfileContentListScreen kind="replays" profileId="other-id" />,
    );
    await user.press(screen.getByRole('button', { name: 'Watch replay' }));
    expect(mockPushedRoutes).toEqual([
      storyHref('other-story'),
      liveSessionHref('opaque-replay-id'),
    ]);
  });
});

function profileContentData({
  kind,
  pageInfo,
  profileId,
  rows,
  viewerId,
}: {
  kind: 'posts' | 'replays' | 'stories';
  pageInfo?: { readonly endCursor: string | null; readonly hasNextPage: boolean };
  profileId: string;
  rows: ReadonlyArray<Record<string, unknown>>;
  viewerId: string;
}) {
  const contentConnection = connection(rows, pageInfo);

  return {
    node: {
      __typename: 'User' as const,
      id: profileId,
      posts: kind === 'posts' ? contentConnection : undefined,
      replayFeed: kind === 'replays' ? contentConnection : undefined,
      storyFeed: kind === 'stories' ? contentConnection : undefined,
    },
    viewer: { id: viewerId },
  };
}

function connection(
  rows: ReadonlyArray<Record<string, unknown>>,
  pageInfo: { readonly endCursor: string | null; readonly hasNextPage: boolean } = {
    endCursor: null,
    hasNextPage: false,
  },
) {
  return { edges: rows.map((node) => ({ node })), pageInfo };
}

function post(
  id: string,
  authorId: string,
  bodyText: string,
  kind = 'STANDARD',
) {
  return {
    author: { email: 'creator@example.com', id: authorId },
    bodyText,
    expiresAt: kind === 'STORY' ? '2026-07-10T12:00:00.000000Z' : null,
    id,
    insertedAt: '2026-07-09T12:00:00.000000Z',
    kind,
    mediaAssets: [],
    visibility: 'PUBLIC',
  };
}

function replay(id: string, hostId: string) {
  return {
    endedAt: '2026-07-09T12:30:00.000000Z',
    host: { email: 'host@example.com', id: hostId },
    id,
    insertedAt: '2026-07-09T12:00:00.000000Z',
    startedAt: '2026-07-09T12:05:00.000000Z',
    status: 'ENDED',
    visibility: 'PUBLIC',
  };
}

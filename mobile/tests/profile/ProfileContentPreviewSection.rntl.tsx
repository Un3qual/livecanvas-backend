import { act, render, screen, userEvent, within } from '@testing-library/react-native';

import { liveSessionHref } from '../../src/live/liveSessionNavigation';
import { storyHref } from '../../src/content/story/storyNavigation';
import { ProfileContentPreviewSections } from '../../src/profile/ProfileContentPreviewSection';
import { profileContentHref } from '../../src/profile/profileContentRouteParams';
import { profileHref } from '../../src/profile/profileNavigation';

type QueryVariables = {
  readonly after: string | null;
  readonly first: number;
  readonly id: string;
  readonly includePosts: boolean;
  readonly includeReplays: boolean;
  readonly includeStories: boolean;
};

type QueryOptions = {
  readonly fetchKey?: number;
  readonly fetchPolicy?: string;
};

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockDeletePostCommit: MutationCommit;
let mockPushedRoutes: unknown[];
let mockQueryOptions: QueryOptions[];
let mockQueryShouldFail: boolean;
let mockQueryVariables: QueryVariables[];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (route: unknown) => mockPushedRoutes.push(route),
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    variables: QueryVariables,
    options: QueryOptions,
  ) => {
    mockQueryVariables.push(variables);
    mockQueryOptions.push(options);

    if (mockQueryShouldFail) {
      throw new Error('profile content failed');
    }

    return mockProfileContentData(variables.id);
  },
  useMutation: (mutation: unknown) =>
    mockRelayOperationName(mutation).includes('DeletePostMutation')
      ? [mockDeletePostCommit, false]
      : [jest.fn(), false],
}));

beforeEach(() => {
  mockDeletePostCommit = jest.fn();
  mockPushedRoutes = [];
  mockQueryOptions = [];
  mockQueryShouldFail = false;
  mockQueryVariables = [];
});

describe('ProfileContentPreviewSections', () => {
  test('loads all previews with one query and one shared owner controller', async () => {
    const user = userEvent.setup();
    await render(
      <ProfileContentPreviewSections profileId="viewer-id" scope="viewer" />,
    );

    expect(mockQueryVariables).toEqual([
      {
        after: null,
        first: 3,
        id: 'viewer-id',
        includePosts: true,
        includeReplays: true,
        includeStories: true,
      },
    ]);
    expect(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'Edit post',
      }),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('content-section-stories')).getByRole('button', {
        name: 'Edit post',
      }),
    ).toBeOnTheScreen();
    await user.press(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'Open author profile for creator@example.com',
      }),
    );
    expect(mockPushedRoutes).toEqual([profileHref('viewer-id', 'viewer-id')]);
  });

  test('reports other-user posts and routes replay and view-all actions', async () => {
    const user = userEvent.setup();
    await render(
      <ProfileContentPreviewSections
        profileId="opaque-profile-id"
        scope="other"
      />,
    );

    const posts = within(screen.getByTestId('content-section-posts'));
    const stories = within(screen.getByTestId('content-section-stories'));
    const replays = within(screen.getByTestId('content-section-replays'));
    expect(posts.getByRole('button', { name: 'Report post' })).toBeOnTheScreen();
    expect(posts.queryByRole('button', { name: 'Edit post' })).toBeNull();

    await user.press(
      posts.getByRole('button', {
        name: 'Open author profile for creator@example.com',
      }),
    );
    await user.press(stories.getByRole('button', { name: 'View story' }));
    await user.press(replays.getByRole('button', { name: 'Watch replay' }));
    await user.press(posts.getByRole('button', { name: 'View all' }));
    await user.press(replays.getByRole('button', { name: 'View all' }));

    expect(mockPushedRoutes).toEqual([
      profileHref('opaque-profile-id', 'viewer-id'),
      storyHref('opaque-story-id'),
      liveSessionHref('opaque-replay-id'),
      profileContentHref('opaque-profile-id', 'posts', 'other'),
      profileContentHref('opaque-profile-id', 'replays', 'other'),
    ]);
  });

  test('removes a viewer post preview after a successful delete', async () => {
    const user = userEvent.setup();
    await render(
      <ProfileContentPreviewSections profileId="viewer-id" scope="viewer" />,
    );

    await user.press(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'Delete post',
      }),
    );
    await user.press(screen.getByRole('button', { name: 'Confirm delete' }));

    await act(() => {
      mockDeletePostCommit.mock.calls[0]?.[0].onCompleted?.({
        deletePost: { deletedPostId: 'opaque-post-id', errors: [] },
      });
    });

    expect(screen.queryByText('Post body')).toBeNull();
    expect(screen.getByText('No visible posts yet.')).toBeOnTheScreen();
    expect(screen.getByText('Story body')).toBeOnTheScreen();
  });

  test('retries the combined preview with a fresh network-only request', async () => {
    const user = userEvent.setup();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockQueryShouldFail = true;
    await render(
      <ProfileContentPreviewSections profileId="viewer-id" scope="viewer" />,
    );

    expect(screen.getByText('Could not load profile content.')).toBeOnTheScreen();
    mockQueryShouldFail = false;
    await user.press(
      screen.getByRole('button', { name: 'Retry profile content' }),
    );

    expect(screen.getByText('Post body')).toBeOnTheScreen();
    expect(mockQueryOptions.at(-1)).toEqual({
      fetchKey: 1,
      fetchPolicy: 'network-only',
    });
    consoleError.mockRestore();
  });
});

function mockRelayOperationName(mutation: unknown): string {
  if (typeof mutation === 'string') {
    return mutation;
  }

  if (mutation !== null && typeof mutation === 'object' && 'params' in mutation) {
    const params = mutation.params as { readonly name?: unknown };
    return typeof params.name === 'string' ? params.name : '';
  }

  return '';
}

function mockProfileContentData(profileId: string) {
  return {
    node: {
      __typename: 'User',
      id: profileId,
      posts: connection([
        post('opaque-post-id', profileId, 'Post body', 'STANDARD'),
      ]),
      replayFeed: connection([replay(profileId)]),
      storyFeed: connection([
        post('opaque-story-id', profileId, 'Story body', 'STORY'),
      ]),
    },
    viewer: { id: 'viewer-id' },
  };
}

function post(id: string, authorId: string, bodyText: string, kind: string) {
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

function replay(profileId: string) {
  return {
    endedAt: '2026-07-09T12:30:00.000000Z',
    host: { email: 'host@example.com', id: profileId },
    id: 'opaque-replay-id',
    insertedAt: '2026-07-09T12:00:00.000000Z',
    startedAt: '2026-07-09T12:05:00.000000Z',
    status: 'ENDED',
    visibility: 'PUBLIC',
  };
}

function connection<Node>(nodes: ReadonlyArray<Node>) {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: { endCursor: null, hasNextPage: false },
  };
}

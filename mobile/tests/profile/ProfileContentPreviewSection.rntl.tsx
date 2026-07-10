import {
  act,
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import { View } from 'react-native';

import { liveSessionHref } from '../../src/live/liveSessionNavigation';
import { ProfileContentPreviewSection } from '../../src/profile/ProfileContentPreviewSection';
import { profileContentHref } from '../../src/profile/profileContentRouteParams';

type QueryVariables = {
  readonly after: string | null;
  readonly first: number;
  readonly id: string;
  readonly includePosts: boolean;
  readonly includeReplays: boolean;
  readonly includeStories: boolean;
};

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockDeletePostCommit: MutationCommit;
let mockPushedRoutes: unknown[];
let mockQueryVariables: QueryVariables[];
let mockStoryShouldFail: boolean;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (route: unknown) => {
      mockPushedRoutes.push(route);
    },
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (_query: unknown, variables: QueryVariables) => {
    mockQueryVariables.push(variables);

    if (variables.includeStories && mockStoryShouldFail) {
      throw new Error('stories failed');
    }

    return mockProfileContentData(variables);
  },
  useMutation: (mutation: unknown) => {
    const operation = mockRelayOperationName(mutation);

    return operation.includes('DeletePostMutation')
      ? [mockDeletePostCommit, false]
      : [jest.fn(), false];
  },
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
  mockDeletePostCommit = jest.fn();
  mockPushedRoutes = [];
  mockQueryVariables = [];
  mockStoryShouldFail = false;
});

describe('ProfileContentPreviewSection', () => {
  test('queries each viewer preview independently with mutually exclusive variables', async () => {
    await render(
      <View>
        <ProfileContentPreviewSection
          kind="posts"
          profileId="viewer-id"
          scope="viewer"
        />
        <ProfileContentPreviewSection
          kind="stories"
          profileId="viewer-id"
          scope="viewer"
        />
        <ProfileContentPreviewSection
          kind="replays"
          profileId="viewer-id"
          scope="viewer"
        />
      </View>,
    );

    expect(mockQueryVariables).toEqual([
      {
        after: null,
        first: 3,
        id: 'viewer-id',
        includePosts: true,
        includeReplays: false,
        includeStories: false,
      },
      {
        after: null,
        first: 3,
        id: 'viewer-id',
        includePosts: false,
        includeReplays: false,
        includeStories: true,
      },
      {
        after: null,
        first: 3,
        id: 'viewer-id',
        includePosts: false,
        includeReplays: true,
        includeStories: false,
      },
    ]);

    expect(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'Edit post',
      }),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('content-section-stories')).getByRole(
        'button',
        { name: 'Edit post' },
      ),
    ).toBeOnTheScreen();
  });

  test('reports other-user posts and routes replay and view-all actions with opaque IDs', async () => {
    const user = userEvent.setup();

    await render(
      <View>
        <ProfileContentPreviewSection
          kind="posts"
          profileId="opaque-profile-id"
          scope="other"
        />
        <ProfileContentPreviewSection
          kind="replays"
          profileId="opaque-profile-id"
          scope="other"
        />
      </View>,
    );

    const posts = within(screen.getByTestId('content-section-posts'));
    const replays = within(screen.getByTestId('content-section-replays'));
    expect(posts.getByRole('button', { name: 'Report post' })).toBeOnTheScreen();
    expect(posts.queryByRole('button', { name: 'Edit post' })).toBeNull();

    await user.press(replays.getByRole('button', { name: 'Watch replay' }));
    await user.press(posts.getByRole('button', { name: 'View all' }));
    await user.press(replays.getByRole('button', { name: 'View all' }));

    expect(mockPushedRoutes).toEqual([
      liveSessionHref('opaque-replay-id'),
      profileContentHref('opaque-profile-id', 'posts', 'other'),
      profileContentHref('opaque-profile-id', 'replays', 'other'),
    ]);
  });

  test('removes a viewer post preview after a successful delete', async () => {
    const user = userEvent.setup();

    await render(
      <ProfileContentPreviewSection
        kind="posts"
        profileId="viewer-id"
        scope="viewer"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Delete post' }));
    await user.press(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(mockDeletePostCommit).toHaveBeenCalledTimes(1);
    expect(mockDeletePostCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { postId: 'opaque-post-id' },
    });

    await act(() => {
      mockDeletePostCommit.mock.calls[0]?.[0].onCompleted?.({
        deletePost: { deletedPostId: 'opaque-post-id', errors: [] },
      });
    });

    expect(screen.queryByText('Post body')).toBeNull();
    expect(screen.getByText('No visible posts yet.')).toBeOnTheScreen();
  });

  test('retries one failed preview without remounting successful siblings', async () => {
    const user = userEvent.setup();
    mockStoryShouldFail = true;
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await render(<PreviewCollection />);

    expect(screen.getByText('Post body')).toBeOnTheScreen();
    expect(screen.getByText('host@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Could not load stories.')).toBeOnTheScreen();
    const postQueriesBeforeRetry = queryCount('posts');
    const replayQueriesBeforeRetry = queryCount('replays');
    expect(postQueriesBeforeRetry).toBeGreaterThan(0);
    expect(replayQueriesBeforeRetry).toBeGreaterThan(0);

    mockStoryShouldFail = false;
    await user.press(screen.getByRole('button', { name: 'Retry stories' }));

    expect(screen.getByText('Story body')).toBeOnTheScreen();
    expect(queryCount('posts')).toBe(postQueriesBeforeRetry);
    expect(queryCount('replays')).toBe(replayQueriesBeforeRetry);
    consoleError.mockRestore();
  });
});

function PreviewCollection() {
  return (
    <View>
      <ProfileContentPreviewSection
        kind="posts"
        profileId="viewer-id"
        scope="viewer"
      />
      <ProfileContentPreviewSection
        kind="stories"
        profileId="viewer-id"
        scope="viewer"
      />
      <ProfileContentPreviewSection
        kind="replays"
        profileId="viewer-id"
        scope="viewer"
      />
    </View>
  );
}

function queryCount(kind: 'posts' | 'replays'): number {
  return mockQueryVariables.filter((variables) =>
    kind === 'posts' ? variables.includePosts : variables.includeReplays,
  ).length;
}

function mockProfileContentData(variables: QueryVariables) {
  return {
    node: {
      __typename: 'User',
      id: variables.id,
      posts: variables.includePosts
        ? connection([post('opaque-post-id', variables.id, 'Post body', 'STANDARD')])
        : undefined,
      replayFeed: variables.includeReplays
        ? connection([replay(variables.id)])
        : undefined,
      storyFeed: variables.includeStories
        ? connection([post('opaque-story-id', variables.id, 'Story body', 'STORY')])
        : undefined,
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

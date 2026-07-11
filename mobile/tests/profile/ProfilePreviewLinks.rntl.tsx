import {
  render,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';

import { OtherUserProfileScreen } from '../../src/profile/other/OtherUserProfileScreen';
import { ViewerProfileScreen } from '../../src/profile/viewer/ViewerProfileScreen';

let mockQueryData: Record<string, unknown>;
let mockSocialQueryData: Record<string, unknown> | undefined;
let mockPushedRoutes: unknown[];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: (route: unknown) => {
      mockPushedRoutes.push(route);
    },
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    query: { params?: { name?: string } },
    variables: Record<string, unknown>,
  ) =>
    // Social previews use their network-fresh operation and dedicated mock data.
    query.params?.name === 'ViewerProfileSocialSectionsQuery'
      ? (mockSocialQueryData ?? mockQueryData)
      : mockIsProfileContentVariables(variables)
        ? mockProfileContentData(variables)
      : mockQueryData,
  useMutation: () => [jest.fn(), false],
}));

beforeEach(() => {
  mockPushedRoutes = [];
  mockSocialQueryData = undefined;
});

describe('profile preview full-list links', () => {
  test('viewer profile preview actions route to full followers, following, and requests lists', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      viewer: {
        currentLiveSession: null,
        email: 'viewer@example.com',
        id: 'viewer-id',
        privacyMode: 'PUBLIC',
      },
    };
    mockSocialQueryData = {
      viewer: {
        followers: connection([
          { email: 'follower@example.com', id: 'opaque-follower', privacyMode: 'PUBLIC' },
        ]),
        following: connection([
          { email: 'following@example.com', id: 'opaque-following', privacyMode: 'PUBLIC' },
        ]),
        id: 'viewer-id',
      },
      viewerPendingFollowRequests: connection([
        {
          follower: {
            email: 'requester@example.com',
            id: 'opaque-requester',
            privacyMode: 'PRIVATE',
          },
          id: 'request-1',
          requestedAt: '2026-07-01T00:00:00Z',
          state: 'REQUESTED',
        },
      ]),
    };

    await render(<ViewerProfileScreen />);

    await user.press(screen.getByRole('button', { name: 'View all followers' }));
    await user.press(screen.getByRole('button', { name: 'View all following' }));
    await user.press(screen.getByRole('button', { name: 'View requests' }));
    await user.press(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'View all',
      }),
    );
    await user.press(
      within(screen.getByTestId('content-section-stories')).getByRole(
        'button',
        { name: 'View all' },
      ),
    );
    await user.press(
      within(screen.getByTestId('content-section-replays')).getByRole(
        'button',
        { name: 'View all' },
      ),
    );

    expect(mockPushedRoutes).toEqual([
      '/profile/followers',
      '/profile/following',
      '/profile/requests',
      {
        params: { id: 'viewer-id', kind: 'posts' },
        pathname: '/profile/content',
      },
      {
        params: { id: 'viewer-id', kind: 'stories' },
        pathname: '/profile/content',
      },
      {
        params: { id: 'viewer-id', kind: 'replays' },
        pathname: '/profile/content',
      },
    ]);
  });

  test('other profile preview actions route using the opaque profile ID', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      isMuted: false,
      node: {
        __typename: 'User',
        currentLiveSession: null,
        followers: connection([]),
        following: connection([]),
        id: 'opaque-profile-id',
        privacyMode: 'PUBLIC',
      },
      relationshipState: 'NONE',
      viewer: { id: 'viewer-id' },
    };

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'View followers' }));
    await user.press(screen.getByRole('button', { name: 'View following' }));
    await user.press(
      within(screen.getByTestId('content-section-posts')).getByRole('button', {
        name: 'View all',
      }),
    );
    await user.press(
      within(screen.getByTestId('content-section-stories')).getByRole(
        'button',
        { name: 'View all' },
      ),
    );
    await user.press(
      within(screen.getByTestId('content-section-replays')).getByRole(
        'button',
        { name: 'View all' },
      ),
    );

    expect(mockPushedRoutes).toEqual([
      {
        params: { id: 'opaque-profile-id' },
        pathname: '/profiles/[id]/followers',
      },
      {
        params: { id: 'opaque-profile-id' },
        pathname: '/profiles/[id]/following',
      },
      {
        params: { id: 'opaque-profile-id', kind: 'posts' },
        pathname: '/profiles/[id]/content',
      },
      {
        params: { id: 'opaque-profile-id', kind: 'stories' },
        pathname: '/profiles/[id]/content',
      },
      {
        params: { id: 'opaque-profile-id', kind: 'replays' },
        pathname: '/profiles/[id]/content',
      },
    ]);
  });

  test('profiles blocked by the viewer do not expose full connection-list links', async () => {
    mockQueryData = {
      isMuted: false,
      node: {
        __typename: 'User',
        currentLiveSession: null,
        followers: connection([{ id: 'opaque-follower' }]),
        following: connection([{ id: 'opaque-following' }]),
        id: 'opaque-profile-id',
        privacyMode: 'PUBLIC',
      },
      relationshipState: 'BLOCKED',
      viewer: { id: 'viewer-id' },
    };

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    expect(screen.queryByRole('button', { name: 'View followers' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View following' })).toBeNull();
    expect(screen.queryByTestId('content-section-posts')).toBeNull();
    expect(screen.queryByTestId('content-section-stories')).toBeNull();
    expect(screen.queryByTestId('content-section-replays')).toBeNull();
  });
});

function connection<Node>(nodes: ReadonlyArray<Node>) {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}

function mockIsProfileContentVariables(
  variables: Record<string, unknown>,
): variables is Record<string, unknown> & {
  readonly id: string;
  readonly includePosts: boolean;
  readonly includeReplays: boolean;
  readonly includeStories: boolean;
} {
  return typeof variables.includePosts === 'boolean';
}

function mockProfileContentData(
  variables: Record<string, unknown> & {
    readonly id: string;
    readonly includePosts: boolean;
    readonly includeReplays: boolean;
    readonly includeStories: boolean;
  },
) {
  return {
    node: {
      __typename: 'User',
      id: variables.id,
      posts: variables.includePosts ? connection([]) : undefined,
      replayFeed: variables.includeReplays ? connection([]) : undefined,
      storyFeed: variables.includeStories ? connection([]) : undefined,
    },
    viewer: { id: 'viewer-id' },
  };
}

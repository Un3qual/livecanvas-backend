import { render, screen, userEvent } from '@testing-library/react-native';

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
  useLazyLoadQuery: (query: { params?: { name?: string } }) =>
    // Social previews use their network-fresh operation and dedicated mock data.
    query.params?.name === 'ViewerProfileSocialSectionsQuery'
      ? (mockSocialQueryData ?? mockQueryData)
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

    expect(mockPushedRoutes).toEqual([
      '/profile/followers',
      '/profile/following',
      '/profile/requests',
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

    expect(mockPushedRoutes).toEqual([
      {
        params: { id: 'opaque-profile-id' },
        pathname: '/profiles/[id]/followers',
      },
      {
        params: { id: 'opaque-profile-id' },
        pathname: '/profiles/[id]/following',
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

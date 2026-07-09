import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { ProfileConnectionListScreen } from '../../src/profile/ProfileConnectionListScreen';

type UserNode = {
  readonly email: string | null;
  readonly id: string;
  readonly privacyMode: string;
};

type UserConnection = {
  readonly edges: ReadonlyArray<{ readonly node: UserNode | null } | null>;
  readonly pageInfo: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
};

type QueryData = {
  readonly node?: {
    readonly __typename: string;
    readonly followers?: UserConnection | null;
    readonly following?: UserConnection | null;
    readonly id: string;
  } | null;
  readonly viewer?: {
    readonly followers?: UserConnection | null;
    readonly following?: UserConnection | null;
    readonly id: string;
  } | null;
};

type QueryVariables = Record<string, unknown>;

let mockQueryData: QueryData;
let mockQueryVariables: QueryVariables | null;
let mockFetchQueryVariables: QueryVariables | null;
let mockFetchQueryResult: QueryData;
let mockPushedRoutes: unknown[];

jest.mock('expo-router', () => ({
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
    mockFetchQueryVariables = variables;

    return {
      toPromise: () => Promise.resolve(mockFetchQueryResult),
    };
  },
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    variables: QueryVariables,
  ): QueryData => {
    mockQueryVariables = variables;
    return mockQueryData;
  },
  useRelayEnvironment: () => ({ environment: 'relay' }),
}));

beforeEach(() => {
  mockQueryData = {
    viewer: {
      followers: connection([
        { email: 'first@example.com', id: 'opaque-user-1', privacyMode: 'PUBLIC' },
      ], { endCursor: 'cursor-1', hasNextPage: true }),
      id: 'viewer-id',
    },
  };
  mockFetchQueryResult = {
    viewer: {
      followers: connection([
        { email: 'second@example.com', id: 'opaque-user-2', privacyMode: 'PRIVATE' },
      ]),
      id: 'viewer-id',
    },
  };
  mockQueryVariables = null;
  mockFetchQueryVariables = null;
  mockPushedRoutes = [];
});

describe('ProfileConnectionListScreen with React Native Testing Library', () => {
  test('renders viewer followers and appends paginated rows', async () => {
    const user = userEvent.setup();

    await render(<ProfileConnectionListScreen kind="viewerFollowers" />);

    expect(screen.getByTestId('profile-connection-list')).toBeOnTheScreen();
    expect(screen.getByText('Followers')).toBeOnTheScreen();
    expect(screen.getByText('first@example.com')).toBeOnTheScreen();
    expect(mockQueryVariables).toEqual({ after: null, first: 20 });

    await user.press(screen.getByRole('button', { name: 'Load more' }));

    expect(mockFetchQueryVariables).toEqual({ after: 'cursor-1', first: 20 });

    await waitFor(() => {
      expect(screen.getByText('second@example.com')).toBeOnTheScreen();
    });
  });

  test('renders other-profile following and opens opaque profile IDs', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      node: {
        __typename: 'User',
        following: connection([
          { email: 'followed@example.com', id: 'opaque-user-3', privacyMode: 'PUBLIC' },
        ]),
        id: 'opaque-profile-id',
      },
    };

    await render(
      <ProfileConnectionListScreen
        kind="otherFollowing"
        profileId="opaque-profile-id"
      />,
    );

    expect(screen.getByText('Following')).toBeOnTheScreen();
    expect(mockQueryVariables).toEqual({
      after: null,
      first: 20,
      id: 'opaque-profile-id',
    });

    await user.press(screen.getByRole('button', { name: 'followed@example.com' }));

    expect(mockPushedRoutes).toEqual([
      { params: { id: 'opaque-user-3' }, pathname: '/profiles/[id]' },
    ]);
  });

  test('resets paginated rows when the connection route changes', async () => {
    const user = userEvent.setup();
    const view = await render(
      <ProfileConnectionListScreen kind="viewerFollowers" />,
    );

    await user.press(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(screen.getByText('second@example.com')).toBeOnTheScreen();
    });

    mockQueryData = {
      viewer: {
        following: connection([
          {
            email: 'following@example.com',
            id: 'opaque-user-4',
            privacyMode: 'PUBLIC',
          },
        ]),
        id: 'viewer-id',
      },
    };

    await act(async () => {
      view.rerender(<ProfileConnectionListScreen kind="viewerFollowing" />);
    });

    await waitFor(() => {
      expect(screen.getByText('following@example.com')).toBeOnTheScreen();
    });
    expect(screen.queryByText('first@example.com')).toBeNull();
    expect(screen.queryByText('second@example.com')).toBeNull();
  });

  test('renders unavailable empty state without leaking private relationship detail', async () => {
    mockQueryData = {
      node: {
        __typename: 'User',
        following: null,
        id: 'opaque-profile-id',
      },
    };

    await render(
      <ProfileConnectionListScreen
        kind="otherFollowing"
        profileId="opaque-profile-id"
      />,
    );

    expect(screen.getByText('No profiles are visible yet.')).toBeOnTheScreen();
  });
});

function connection(
  nodes: ReadonlyArray<UserNode>,
  pageInfo: Partial<UserConnection['pageInfo']> = {},
): UserConnection {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: nodes.length > 0 ? 'cursor' : null,
      hasNextPage: false,
      ...pageInfo,
    },
  };
}

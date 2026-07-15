import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { PendingFollowRequestsScreen } from '../../src/profile/PendingFollowRequestsScreen';

type PendingRequestNode = {
  readonly follower: {
    readonly displayName: string | null;
    readonly email: string | null;
    readonly id: string;
    readonly privacyMode: string;
    readonly username: string | null;
  };
  readonly id: string;
  readonly requestedAt: string;
  readonly state: string;
};

type PendingRequestsConnection = {
  readonly edges: ReadonlyArray<{ readonly node: PendingRequestNode | null } | null>;
  readonly pageInfo: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
};

type QueryData = {
  readonly viewerPendingFollowRequests: PendingRequestsConnection | null;
};

type QueryVariables = Record<string, unknown>;

type AcceptConfig = {
  readonly variables: {
    readonly input: {
      readonly followerId: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly acceptFollowRequest: {
      readonly errors: ReadonlyArray<{ readonly field: string | null; readonly message: string }>;
      readonly follow: { readonly id: string; readonly state: string } | null;
    } | null;
  }) => void;
};

type DeclineConfig = {
  readonly variables: {
    readonly input: {
      readonly followerId: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly declineFollowRequest: {
      readonly errors: ReadonlyArray<{ readonly field: string | null; readonly message: string }>;
    } | null;
  }) => void;
};

let mockQueryData: QueryData;
let mockQueryVariables: QueryVariables | null;
let mockFetchQueryResult: QueryData;
let mockFetchQueryVariables: QueryVariables | null;
let mockPushedRoutes: unknown[];
const mockAcceptCommit = jest.fn<undefined, [AcceptConfig]>();
const mockDeclineCommit = jest.fn<undefined, [DeclineConfig]>();

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
  useMutation: (mutation: unknown) => {
    const name = mockRelayOperationName(mutation);

    if (name.includes('Decline')) {
      return [mockDeclineCommit, false];
    }

    return [mockAcceptCommit, false];
  },
  useRelayEnvironment: () => ({ environment: 'relay' }),
}));

function mockRelayOperationName(mutation: unknown): string {
  if (
    mutation !== null &&
    typeof mutation === 'object' &&
    'params' in mutation
  ) {
    const params = mutation.params as { readonly name?: unknown };

    return typeof params.name === 'string' ? params.name : '';
  }

  return typeof mutation === 'string' ? mutation : '';
}

beforeEach(() => {
  mockQueryData = {
    viewerPendingFollowRequests: connection([
      pendingRequest({
        follower: {
          displayName: 'Canvas Requester',
          email: 'requester@example.com',
          id: 'opaque-user-1',
          privacyMode: 'PRIVATE',
          username: 'canvas_requester',
        },
        id: 'request-1',
      }),
    ]),
  };
  mockFetchQueryResult = {
    viewerPendingFollowRequests: connection([
      pendingRequest({
        follower: {
          displayName: 'Later Requester',
          email: 'later-requester@example.com',
          id: 'opaque-user-2',
          privacyMode: 'PUBLIC',
          username: 'later_requester',
        },
        id: 'request-2',
      }),
    ]),
  };
  mockQueryVariables = null;
  mockFetchQueryVariables = null;
  mockPushedRoutes = [];
  mockAcceptCommit.mockClear();
  mockDeclineCommit.mockClear();
});

describe('PendingFollowRequestsScreen with React Native Testing Library', () => {
  test('renders pending requests and accepts one row at a time', async () => {
    await render(<PendingFollowRequestsScreen />);

    expect(screen.getByTestId('pending-follow-request-list')).toBeOnTheScreen();
    expect(screen.getByText('Follow requests')).toBeOnTheScreen();
    expect(screen.getByText('Canvas Requester')).toBeOnTheScreen();
    expect(mockQueryVariables).toEqual({ after: null, first: 20 });

    const acceptButton = screen.getByRole('button', { name: 'Accept' });
    await fireEvent.press(acceptButton);
    await fireEvent.press(acceptButton);

    expect(mockAcceptCommit).toHaveBeenCalledTimes(1);
    expect(mockAcceptCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        followerId: 'opaque-user-1',
      },
    });

    await completeAccept({
      acceptFollowRequest: {
        errors: [],
        follow: { id: 'follow-1', state: 'ACCEPTED' },
      },
    });

    expect(screen.queryByText('Canvas Requester')).toBeNull();
  });

  test('keeps decline errors row-local and retryable', async () => {
    const user = userEvent.setup();

    await render(<PendingFollowRequestsScreen />);

    await user.press(screen.getByRole('button', { name: 'Decline' }));

    expect(mockDeclineCommit).toHaveBeenCalledTimes(1);

    await completeDecline({
      declineFollowRequest: {
        errors: [{ field: 'followerId', message: 'not_found' }],
      },
    });

    expect(
      screen.getByText('We could not update this follow request.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Decline' }));

    expect(mockDeclineCommit).toHaveBeenCalledTimes(2);
  });

  test('opens requester profiles with opaque IDs', async () => {
    const user = userEvent.setup();

    await render(<PendingFollowRequestsScreen />);

    await user.press(screen.getByRole('button', { name: 'Canvas Requester' }));

    expect(mockPushedRoutes).toEqual([
      { params: { id: 'opaque-user-1' }, pathname: '/profiles/[id]' },
    ]);
  });

  test('loads additional pending requests from the next page', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      viewerPendingFollowRequests: connection(
        [
          pendingRequest({
            follower: {
              displayName: 'Canvas Requester',
              email: 'requester@example.com',
              id: 'opaque-user-1',
              privacyMode: 'PRIVATE',
              username: 'canvas_requester',
            },
            id: 'request-1',
          }),
        ],
        { endCursor: 'cursor-1', hasNextPage: true },
      ),
    };

    await render(<PendingFollowRequestsScreen />);

    await user.press(screen.getByRole('button', { name: 'Load more' }));

    expect(mockFetchQueryVariables).toEqual({
      after: 'cursor-1',
      first: 20,
    });

    await waitFor(() => {
      expect(screen.getByText('Later Requester')).toBeOnTheScreen();
    });
  });
});

async function completeAccept(
  payload: Parameters<NonNullable<AcceptConfig['onCompleted']>>[0],
) {
  const config = mockAcceptCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function completeDecline(
  payload: Parameters<NonNullable<DeclineConfig['onCompleted']>>[0],
) {
  const config =
    mockDeclineCommit.mock.calls[mockDeclineCommit.mock.calls.length - 1]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

function connection(
  nodes: ReadonlyArray<PendingRequestNode>,
  pageInfo: Partial<PendingRequestsConnection['pageInfo']> = {},
): PendingRequestsConnection {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: nodes.length > 0 ? 'cursor' : null,
      hasNextPage: false,
      ...pageInfo,
    },
  };
}

function pendingRequest(
  overrides: Partial<PendingRequestNode> = {},
): PendingRequestNode {
  return {
    follower: {
      displayName: 'Canvas Requester',
      email: 'requester@example.com',
      id: 'opaque-user-1',
      privacyMode: 'PRIVATE',
      username: 'canvas_requester',
    },
    id: 'request-1',
    requestedAt: '2026-07-01T00:00:00Z',
    state: 'REQUESTED',
    ...overrides,
  };
}

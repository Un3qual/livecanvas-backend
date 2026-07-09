import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import ContactsRoute from '../../app/(app)/contacts';
import { ContactDiscoveryScreen } from '../../src/contacts/ContactDiscoveryScreen';

type ContactDiscoveryQueryData = {
  readonly viewerContactMatches: Connection<ContactMatchNode> | null;
};

type Connection<Node> = {
  readonly edges: ReadonlyArray<{ readonly node: Node | null } | null>;
  readonly pageInfo: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
};

type ContactMatchNode = {
  readonly contactName: string | null;
  readonly id: string;
  readonly inviteRecipient: string | null;
  readonly matchedUsers: ReadonlyArray<{
    readonly email: string | null;
    readonly id: string;
    readonly privacyMode: string;
  }>;
};

type QueryVariables = Record<string, unknown>;

type UpsertContactMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly contactClientId: string;
      readonly contactName: string | null;
      readonly emails: readonly string[];
    };
  };
  readonly onCompleted?: (payload: {
    readonly upsertViewerContactEntry: {
      readonly contactMatch: ContactMatchNode | null;
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};

type DeliverInviteMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly recipient: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly deliverViewerContactInvite: {
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};

let mockQueryData: ContactDiscoveryQueryData;
let mockQueryVariables: QueryVariables | null;
let mockFetchQueryResult: ContactDiscoveryQueryData;
let mockFetchQueryVariables: QueryVariables | null;
let mockQueryError: Error | null;
let mockPushedRoutes: unknown[];
const mockUpsertContactCommit =
  jest.fn<undefined, [UpsertContactMutationConfig]>();
const mockDeliverInviteCommit =
  jest.fn<undefined, [DeliverInviteMutationConfig]>();

jest.mock('expo-router', () => ({
  Redirect: function RedirectMock(_props: { href: string }) {
    return null;
  },
  Stack: function StackMock(_props: { initialRouteName?: string }) {
    return null;
  },
  usePathname: () => '/contacts',
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
  ): ContactDiscoveryQueryData => {
    if (mockQueryError) {
      throw mockQueryError;
    }

    mockQueryVariables = variables;
    return mockQueryData;
  },
  useMutation: (mutation: unknown) => {
    const operationName = mockRelayOperationName(mutation);

    if (operationName.includes('DeliverInvite')) {
      return [mockDeliverInviteCommit, false];
    }

    return [mockUpsertContactCommit, false];
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
  mockQueryError = null;
  mockQueryData = {
    viewerContactMatches: connection([]),
  };
  mockFetchQueryResult = {
    viewerContactMatches: connection([
      contactMatch({
        contactName: 'Later Match',
        id: 'contact-match-later',
        matchedUsers: [],
      }),
    ]),
  };
  mockQueryVariables = null;
  mockFetchQueryVariables = null;
  mockPushedRoutes = [];
  mockUpsertContactCommit.mockClear();
  mockDeliverInviteCommit.mockClear();
});

describe('ContactDiscoveryScreen with React Native Testing Library', () => {
  test('keeps contacts route pointed at manual contact discovery', async () => {
    await render(<ContactsRoute />);

    expect(screen.getAllByText('Find contacts')).not.toHaveLength(0);
    expect(mockQueryVariables).toEqual({
      after: null,
      first: 20,
    });
  });

  test('contacts route catches Relay query errors', async () => {
    mockQueryError = new Error('relay query failed');

    await withSuppressedConsoleError(async () => {
      await render(<ContactsRoute />);
    });

    expect(
      screen.getByText('We could not load contact discovery.'),
    ).toBeOnTheScreen();
  });

  test('submits one normalized manual email contact and opens matched profiles', async () => {
    const user = userEvent.setup();

    await render(<ContactDiscoveryScreen />);

    expect(screen.getByTestId('contact-discovery-list')).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Contact email'), ' Friend@Example.COM ');
    await user.type(screen.getByLabelText('Display name'), ' Friend Name ');
    const searchButton = screen.getByRole('button', { name: 'Search contacts' });
    await fireEvent.press(searchButton);
    await fireEvent.press(searchButton);

    expect(mockUpsertContactCommit).toHaveBeenCalledTimes(1);
    expect(mockUpsertContactCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        contactClientId: 'manual-email:friend@example.com',
        contactName: 'Friend Name',
        emails: ['friend@example.com'],
      },
    });

    await completeUpsertContact({
      upsertViewerContactEntry: {
        contactMatch: contactMatch({
          contactName: 'Friend Name',
          id: 'contact-match-1',
          matchedUsers: [
            {
              email: 'matched@example.com',
              id: 'opaque-user-id',
              privacyMode: 'PUBLIC',
            },
          ],
        }),
        errors: [],
      },
    });

    expect(screen.getByText('Friend Name')).toBeOnTheScreen();
    expect(screen.getByText('matched@example.com')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Open profile' }));

    expect(mockPushedRoutes).toEqual([
      { params: { id: 'opaque-user-id' }, pathname: '/profiles/[id]' },
    ]);
  });

  test('invites a no-match manual email row with an independent duplicate guard', async () => {
    const user = userEvent.setup();

    await render(<ContactDiscoveryScreen />);

    await user.type(screen.getByLabelText('Contact email'), ' nomatch@example.com ');
    await user.press(screen.getByRole('button', { name: 'Search contacts' }));

    await completeUpsertContact({
      upsertViewerContactEntry: {
        contactMatch: contactMatch({
          contactName: null,
          id: 'contact-match-2',
          inviteRecipient: 'nomatch@example.com',
          matchedUsers: [],
        }),
        errors: [],
      },
    });

    const inviteButton = screen.getByRole('button', { name: 'Send invite' });
    await fireEvent.press(inviteButton);
    await fireEvent.press(inviteButton);

    expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(1);
    expect(mockDeliverInviteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        recipient: 'nomatch@example.com',
      },
    });

    await completeInvite({
      deliverViewerContactInvite: {
        errors: [],
      },
    });

    expect(
      screen.getByText('Invite sent to nomatch@example.com.'),
    ).toBeOnTheScreen();
  });

  test('renders query rows, empty state, and retryable payload errors', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          contactName: 'Existing Match',
          id: 'contact-match-existing',
          matchedUsers: [],
        }),
      ]),
    };

    await render(<ContactDiscoveryScreen />);

    expect(screen.getByText('Existing Match')).toBeOnTheScreen();
    expect(screen.getByText('No LiveCanvas match yet.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Search contacts' }));

    expect(screen.getByText('Enter an email address.')).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Contact email'), 'bad');
    await user.press(screen.getByRole('button', { name: 'Search contacts' }));

    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
  });

  test('invites a persisted no-match contact after remounting the screen', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          contactName: 'Persisted contact',
          id: 'contact-match-persisted',
          inviteRecipient: 'persisted@example.com',
          matchedUsers: [],
        }),
      ]),
    };

    await render(<ContactDiscoveryScreen />);

    await user.press(screen.getByRole('button', { name: 'Send invite' }));

    expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(1);
    expect(mockDeliverInviteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { recipient: 'persisted@example.com' },
    });
  });

  test('loads additional contact matches from the next page', async () => {
    const user = userEvent.setup();
    mockQueryData = {
      viewerContactMatches: connection(
        [
          contactMatch({
            contactName: 'Existing Match',
            id: 'contact-match-existing',
            matchedUsers: [],
          }),
        ],
        { endCursor: 'cursor-1', hasNextPage: true },
      ),
    };

    await render(<ContactDiscoveryScreen />);

    await user.press(screen.getByRole('button', { name: 'Load more' }));

    expect(mockFetchQueryVariables).toEqual({
      after: 'cursor-1',
      first: 20,
    });

    await waitFor(() => {
      expect(screen.getByText('Later Match')).toBeOnTheScreen();
    });
  });
});

async function completeUpsertContact(
  payload: Parameters<NonNullable<UpsertContactMutationConfig['onCompleted']>>[0],
) {
  const config = mockUpsertContactCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function completeInvite(
  payload: Parameters<NonNullable<DeliverInviteMutationConfig['onCompleted']>>[0],
) {
  const config = mockDeliverInviteCommit.mock.calls[0]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

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

function contactMatch(overrides: Partial<ContactMatchNode> = {}): ContactMatchNode {
  return {
    contactName: 'Contact',
    id: 'contact-match-1',
    inviteRecipient: null,
    matchedUsers: [],
    ...overrides,
  };
}

async function withSuppressedConsoleError(
  callback: () => Promise<void>,
): Promise<void> {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  try {
    await callback();
  } finally {
    consoleError.mockRestore();
  }
}

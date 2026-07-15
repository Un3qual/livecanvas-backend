import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

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
    readonly displayName: string | null;
    readonly email: string | null;
    readonly id: string;
    readonly privacyMode: string;
    readonly username: string | null;
  }>;
};

type QueryVariables = Record<string, unknown>;
type QueryOptions = { readonly fetchKey?: number };

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

type ImportContactsMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly entries: ReadonlyArray<{
        readonly contactClientId: string;
        readonly contactName: string | null;
        readonly emails: readonly string[];
        readonly phoneNumbers: readonly string[];
      }>;
    };
  };
  readonly onCompleted?: (payload: {
    readonly importViewerContactEntries: {
      readonly importedCount: number;
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};

type MockDeviceContactEntry = ImportContactsMutationConfig['variables']['input']['entries'][number];
type MockDeviceContactsReadResult =
  | {
      readonly status: 'granted';
      readonly entries: readonly MockDeviceContactEntry[];
    }
  | { readonly status: 'denied' | 'unavailable' | 'failed' };

let mockQueryData: ContactDiscoveryQueryData;
let mockQueryVariables: QueryVariables | null;
let mockQueryOptions: QueryOptions | null;
let mockFetchQueryResult: ContactDiscoveryQueryData;
let mockFetchQueryVariables: QueryVariables | null;
let mockQueryError: Error | null;
let mockPushedRoutes: unknown[];
let mockRouteFetchKey: number | null;
const mockUpsertContactCommit =
  jest.fn<undefined, [UpsertContactMutationConfig]>();
const mockDeliverInviteCommit =
  jest.fn<undefined, [DeliverInviteMutationConfig]>();
const mockImportContactsCommit =
  jest.fn<undefined, [ImportContactsMutationConfig]>();
const mockReadDeviceContacts =
  jest.fn<Promise<MockDeviceContactsReadResult>, []>();

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

jest.mock('../../src/components/RelayRouteBoundary', () => {
  const actual = jest.requireActual(
    '../../src/components/RelayRouteBoundary',
  ) as typeof import('../../src/components/RelayRouteBoundary');

  return {
    ...actual,
    useRelayRouteFetchKey: () => {
      const routeFetchKey = actual.useRelayRouteFetchKey();
      return mockRouteFetchKey ?? routeFetchKey;
    },
  };
});

jest.mock('../../src/contacts/deviceContactsNative', () => ({
  readDeviceContacts: () => mockReadDeviceContacts(),
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
    options: QueryOptions,
  ): ContactDiscoveryQueryData => {
    if (mockQueryError) {
      throw mockQueryError;
    }

    mockQueryVariables = variables;
    mockQueryOptions = options;
    return mockQueryData;
  },
  useMutation: (mutation: unknown) => {
    const operationName = mockRelayOperationName(mutation);

    if (operationName.includes('DeliverInvite')) {
      return [mockDeliverInviteCommit, false];
    }

    if (operationName.includes('Import')) {
      return [mockImportContactsCommit, false];
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
  mockRouteFetchKey = null;
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
  mockQueryOptions = null;
  mockFetchQueryVariables = null;
  mockPushedRoutes = [];
  mockUpsertContactCommit.mockClear();
  mockDeliverInviteCommit.mockClear();
  mockImportContactsCommit.mockClear();
  mockReadDeviceContacts.mockReset();
  mockReadDeviceContacts.mockResolvedValue({ entries: [], status: 'granted' });
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

  test('contacts route retries Relay with a new fetch key', async () => {
    mockQueryError = new Error('relay query failed');

    await withSuppressedConsoleError(async () => {
      await render(<ContactsRoute />);
    });

    mockQueryError = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getAllByText('Find contacts')).not.toHaveLength(0);
    });

    expect(mockQueryOptions?.fetchKey).toBe(1);
  });

  test('imports device contacts in sequential chunks and refreshes after total success', async () => {
    mockReadDeviceContacts.mockResolvedValue({
      entries: deviceContactEntries(205),
      status: 'granted',
    });

    await render(<ContactDiscoveryScreen />);

    expect(mockReadDeviceContacts).not.toHaveBeenCalled();
    const importButton = screen.getByRole('button', {
      name: 'Import device contacts',
    });
    await fireEvent.press(importButton);
    await fireEvent.press(importButton);

    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(1));
    expect(mockReadDeviceContacts).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Importing...' })).toBeDisabled();
    expect(
      mockImportContactsCommit.mock.calls[0]?.[0].variables.input.entries,
    ).toHaveLength(100);
    expect(mockFetchQueryVariables).toBeNull();

    await completeContactImport(100, 0);
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(2));
    expect(
      mockImportContactsCommit.mock.calls[1]?.[0].variables.input.entries,
    ).toHaveLength(100);
    expect(screen.getByText('Imported 100 of 205 contacts...')).toBeOnTheScreen();
    expect(mockFetchQueryVariables).toBeNull();

    await completeContactImport(100, 1);
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(3));
    expect(
      mockImportContactsCommit.mock.calls[2]?.[0].variables.input.entries,
    ).toHaveLength(5);
    expect(mockFetchQueryVariables).toBeNull();

    await completeContactImport(5, 2);

    await waitFor(() => {
      expect(screen.getByText('Imported 205 contacts.')).toBeOnTheScreen();
      expect(screen.getByText('Later Match')).toBeOnTheScreen();
    });
    expect(mockFetchQueryVariables).toEqual({ after: null, first: 20 });
  });

  test('stops on the first failed chunk and retries idempotently from the start', async () => {
    mockReadDeviceContacts.mockResolvedValue({
      entries: deviceContactEntries(150),
      status: 'granted',
    });

    await render(<ContactDiscoveryScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import device contacts' }),
    );
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(1));
    await completeContactImport(100, 0);
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(2));
    expect(
      mockImportContactsCommit.mock.calls[1]?.[0].variables.input.entries[0]
        ?.contactClientId,
    ).toBe('device:100');
    await failContactImport(1);

    expect(
      screen.getByText('We could not import your contacts. Try again.'),
    ).toBeOnTheScreen();
    expect(mockImportContactsCommit).toHaveBeenCalledTimes(2);
    expect(mockFetchQueryVariables).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Try import again' }),
    );

    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(3));
    expect(mockReadDeviceContacts).toHaveBeenCalledTimes(2);
    expect(
      mockImportContactsCommit.mock.calls[2]?.[0].variables.input.entries[0]
        ?.contactClientId,
    ).toBe('device:0');
  });

  test.each([
    [
      'count mismatch',
      { importViewerContactEntries: { errors: [], importedCount: 0 } },
    ],
    [
      'payload error',
      {
        importViewerContactEntries: {
          errors: [{ field: 'entries', message: 'Invalid contact batch.' }],
          importedCount: 1,
        },
      },
    ],
  ] as const)('rejects a chunk with a %s', async (_label, payload) => {
    mockReadDeviceContacts.mockResolvedValue({
      entries: deviceContactEntries(1),
      status: 'granted',
    });

    await render(<ContactDiscoveryScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import device contacts' }),
    );
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(1));
    await completeContactImportPayload(payload);

    expect(
      screen.getByText('We could not import your contacts. Try again.'),
    ).toBeOnTheScreen();
    expect(mockFetchQueryVariables).toBeNull();
  });

  test('shows denied permission with an explicit Settings action', async () => {
    mockReadDeviceContacts.mockResolvedValue({ status: 'denied' });
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined);

    await render(<ContactDiscoveryScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import device contacts' }),
    );

    expect(
      await screen.findByText(
        'Allow contacts access in Settings to import your address book.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  test('keeps manual discovery usable when native contacts are unavailable', async () => {
    mockReadDeviceContacts.mockResolvedValue({ status: 'unavailable' });
    const user = userEvent.setup();

    await render(<ContactDiscoveryScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import device contacts' }),
    );

    expect(
      await screen.findByText('Device contact import is unavailable on this device.'),
    ).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Contact email'), 'manual@example.com');
    await user.press(screen.getByRole('button', { name: 'Search contacts' }));
    expect(mockUpsertContactCommit).toHaveBeenCalledTimes(1);
  });

  test('ignores import completion after the contact screen unmounts', async () => {
    mockReadDeviceContacts.mockResolvedValue({
      entries: deviceContactEntries(1),
      status: 'granted',
    });

    const view = await render(<ContactDiscoveryScreen />);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Import device contacts' }),
    );
    await waitFor(() => expect(mockImportContactsCommit).toHaveBeenCalledTimes(1));
    await view.unmount();
    await completeContactImport(1, 0);

    expect(mockFetchQueryVariables).toBeNull();
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
              displayName: 'Matched Creator',
              email: 'matched@example.com',
              id: 'opaque-user-id',
              privacyMode: 'PUBLIC',
              username: 'matched_creator',
            },
          ],
        }),
        errors: [],
      },
    });

    expect(screen.getByText('Friend Name')).toBeOnTheScreen();
    expect(screen.getByText('Matched Creator')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Open profile' }));

    expect(mockPushedRoutes).toEqual([
      { params: { id: 'opaque-user-id' }, pathname: '/profiles/[id]' },
    ]);
  });

  test('drops local matched-user identity after a privacy refresh', async () => {
    const user = userEvent.setup();
    mockRouteFetchKey = 0;
    const view = await render(<ContactDiscoveryScreen />);

    await user.type(screen.getByLabelText('Contact email'), 'friend@example.com');
    await user.press(screen.getByRole('button', { name: 'Search contacts' }));

    await completeUpsertContact({
      upsertViewerContactEntry: {
        contactMatch: contactMatch({
          id: 'contact-match-privacy',
          matchedUsers: [
            {
              displayName: null,
              email: 'hidden@example.com',
              id: 'hidden-user-id',
              privacyMode: 'PUBLIC',
              username: null,
            },
          ],
        }),
        errors: [],
      },
    });

    expect(screen.getByText('hidden@example.com')).toBeOnTheScreen();

    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-privacy',
          matchedUsers: [],
        }),
      ]),
    };
    mockRouteFetchKey = 1;
    await view.rerender(<ContactDiscoveryScreen />);

    expect(screen.queryByText('hidden@example.com')).toBeNull();
    expect(screen.getByText('No LiveCanvas match yet.')).toBeOnTheScreen();
  });

  test('delivers one normalized invite and preserves the discovery rows', async () => {
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          contactName: 'No Match',
          id: 'contact-match-invite',
          inviteRecipient: ' Friend@Example.COM ',
        }),
        contactMatch({
          contactName: 'Other row',
          id: 'contact-match-other',
        }),
      ]),
    };
    await render(<ContactDiscoveryScreen />);

    const sendButton = screen.getByRole('button', { name: 'Send invite' });
    await fireEvent.press(sendButton);
    await fireEvent.press(sendButton);

    expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(1);
    expect(mockDeliverInviteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { contactMatchId: 'contact-match-invite' },
    });
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    await completeInviteDelivery({
      deliverViewerContactInvite: { errors: [] },
    });

    expect(screen.getByRole('button', { name: 'Sent' })).toBeDisabled();
    expect(screen.getByText('No Match')).toBeOnTheScreen();
    expect(screen.getByText('Other row')).toBeOnTheScreen();
    expect(screen.queryByText(/https?:\/\//)).toBeNull();
    expect(screen.queryByText(/token=/)).toBeNull();
  });

  test.each([0, 1])(
    'shares one delivery when duplicate recipient row %i initiates',
    async (initiatingIndex) => {
      mockQueryData = {
        viewerContactMatches: connection([
          contactMatch({
            contactName: 'First duplicate',
            id: 'contact-match-duplicate-first',
            inviteRecipient: ' Duplicate@Example.COM ',
          }),
          contactMatch({
            contactName: 'Second duplicate',
            id: 'contact-match-duplicate-second',
            inviteRecipient: 'duplicate@example.com',
          }),
        ]),
      };
      await render(<ContactDiscoveryScreen />);

      const sendButtons = screen.getAllByRole('button', {
        name: 'Send invite',
      });
      await fireEvent.press(sendButtons[initiatingIndex]);
      await fireEvent.press(sendButtons[initiatingIndex === 0 ? 1 : 0]);
      await fireEvent.press(sendButtons[initiatingIndex]);

      expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(1);
      expect(
        screen.getAllByRole('button', { name: 'Sending...' }),
      ).toHaveLength(2);

      await completeInviteDelivery({
        deliverViewerContactInvite: { errors: [] },
      });

      const sentButtons = screen.getAllByRole('button', { name: 'Sent' });
      expect(sentButtons).toHaveLength(2);
      expect(sentButtons[0]).toBeDisabled();
      expect(sentButtons[1]).toBeDisabled();
      await fireEvent.press(sentButtons[0]);
      await fireEvent.press(sentButtons[1]);
      expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(1);
    },
  );

  test('retries transport and delivery failures for the same recipient', async () => {
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-retry',
          inviteRecipient: 'retry@example.com',
        }),
      ]),
    };
    await render(<ContactDiscoveryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
    await failInviteDelivery();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(mockDeliverInviteCommit).toHaveBeenCalledTimes(2);

    await completeInviteDelivery(
      {
        deliverViewerContactInvite: {
          errors: [{ field: null, message: 'delivery_failed' }],
        },
      },
      1,
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  test('renders invalid recipients as a terminal viewer-safe state', async () => {
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-invalid',
          inviteRecipient: 'recipient@example.com',
        }),
      ]),
    };
    await render(<ContactDiscoveryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));
    await completeInviteDelivery({
      deliverViewerContactInvite: {
        errors: [
          { field: 'contactMatchId', message: 'invalid_contact_match' },
        ],
      },
    });

    expect(screen.getByRole('button', { name: 'Cannot invite' })).toBeDisabled();
    expect(screen.queryByText('invalid_recipient')).toBeNull();
  });

  test('suppresses invite delivery for matched and invalid-recipient rows', async () => {
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-matched',
          inviteRecipient: 'matched@example.com',
          matchedUsers: [
            {
              displayName: null,
              email: 'matched@example.com',
              id: 'matched-user',
              privacyMode: 'PUBLIC',
              username: null,
            },
          ],
        }),
        contactMatch({
          id: 'contact-match-malformed',
          inviteRecipient: 'not-an-email',
        }),
      ]),
    };
    await render(<ContactDiscoveryScreen />);

    expect(screen.getByRole('button', { name: 'Open profile' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Send invite' })).toBeNull();
  });

  test('ignores stale delivery completion after the row becomes matched', async () => {
    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-stale',
          inviteRecipient: 'stale@example.com',
        }),
      ]),
    };
    const view = await render(<ContactDiscoveryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send invite' }));

    mockQueryData = {
      viewerContactMatches: connection([
        contactMatch({
          id: 'contact-match-stale',
          inviteRecipient: null,
          matchedUsers: [
            {
              displayName: null,
              email: 'stale@example.com',
              id: 'matched-user',
              privacyMode: 'PUBLIC',
              username: null,
            },
          ],
        }),
      ]),
    };
    await view.rerender(<ContactDiscoveryScreen />);
    await completeInviteDelivery({
      deliverViewerContactInvite: { errors: [] },
    });

    expect(screen.getByRole('button', { name: 'Open profile' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sent' })).toBeNull();
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

  test('shows invite delivery for persisted no-match contacts', async () => {
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

    expect(screen.getByRole('button', { name: 'Send invite' })).toBeOnTheScreen();
    expect(mockDeliverInviteCommit).not.toHaveBeenCalled();
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

async function completeInviteDelivery(
  payload: Parameters<NonNullable<DeliverInviteMutationConfig['onCompleted']>>[0],
  callIndex = 0,
) {
  const config = mockDeliverInviteCommit.mock.calls[callIndex]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function failInviteDelivery(callIndex = 0) {
  const config = mockDeliverInviteCommit.mock.calls[callIndex]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onError?.(new Error('network failed'));
  });
}

async function completeContactImport(importedCount: number, callIndex = 0) {
  await completeContactImportPayload(
    { importViewerContactEntries: { errors: [], importedCount } },
    callIndex,
  );
}

async function completeContactImportPayload(
  payload: Parameters<
    NonNullable<ImportContactsMutationConfig['onCompleted']>
  >[0],
  callIndex = 0,
) {
  const config = mockImportContactsCommit.mock.calls[callIndex]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onCompleted?.(payload);
  });
}

async function failContactImport(callIndex = 0) {
  const config = mockImportContactsCommit.mock.calls[callIndex]?.[0];

  expect(config).toBeDefined();

  await act(() => {
    config?.onError?.(new Error('network failed'));
  });
}

function deviceContactEntries(count: number): readonly MockDeviceContactEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    contactClientId: `device:${index}`,
    contactName: `Contact ${index}`,
    emails: [`contact-${index}@example.com`],
    phoneNumbers: [],
  }));
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

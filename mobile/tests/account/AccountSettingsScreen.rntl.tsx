import { act, render, screen, userEvent } from '@testing-library/react-native';

import { AccountSettingsScreen } from '../../src/account/AccountSettingsScreen';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};
type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockQueryData: Record<string, unknown>;
let mockUnlinkCommit: MutationCommit;
let mockExportCommit: MutationCommit;
let mockDeleteCommit: MutationCommit;
let mockCancelDeleteCommit: MutationCommit;

jest.mock('react-relay', () => ({
  useLazyLoadQuery: () => mockQueryData,
  useMutation: (mutation: unknown) => {
    const operationName = mockOperationName(mutation);

    if (operationName === 'accountSettingsOperationsUnlinkIdentityMutation') {
      return [mockUnlinkCommit, false];
    }

    if (operationName === 'accountSettingsOperationsRequestDataExportMutation') {
      return [mockExportCommit, false];
    }

    if (
      operationName === 'accountSettingsOperationsRequestAccountDeletionMutation'
    ) {
      return [mockDeleteCommit, false];
    }

    return [mockCancelDeleteCommit, false];
  },
}));

beforeEach(() => {
  mockUnlinkCommit = jest.fn();
  mockExportCommit = jest.fn();
  mockDeleteCommit = jest.fn();
  mockCancelDeleteCommit = jest.fn();
  mockQueryData = {
    viewer: {
      email: 'viewer@example.com',
      id: 'viewer-id',
      userIdentities: connection([
        {
          authProvider: 'GOOGLE',
          id: 'identity-1',
          insertedAt: '2026-07-01T00:00:00Z',
          provider: 'google_provider',
        },
      ]),
    },
    viewerAccountDeletionRequests: connection([
      {
        completedAt: null,
        failureReason: null,
        id: 'deletion-1',
        requestedAt: '2026-07-01T00:00:00Z',
        scheduledPurgeAt: '2026-07-08T00:00:00Z',
        status: 'SCHEDULED',
      },
    ]),
    viewerDataExportRequests: connection([]),
  };
});

describe('AccountSettingsScreen', () => {
  test('renders settings sections and account lifecycle rows', async () => {
    await render(<AccountSettingsScreen />);

    expect(screen.getByText('viewer@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Google')).toBeOnTheScreen();
    expect(screen.getByText('No data export requests yet.')).toBeOnTheScreen();
    expect(screen.getByText('Scheduled')).toBeOnTheScreen();
  });

  test('unlinks identities and starts export and deletion requests', async () => {
    const user = userEvent.setup();

    await render(<AccountSettingsScreen />);

    await user.press(screen.getByRole('button', { name: 'Unlink' }));
    expect(mockUnlinkCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { userIdentityId: 'identity-1' },
    });
    await completeMutation(mockUnlinkCommit, {
      unlinkViewerIdentity: {
        errors: [],
        userIdentity: { id: 'identity-1' },
      },
    });
    expect(screen.queryByText('Google')).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Request data export' }));
    expect(mockExportCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {},
    });
    await completeMutation(mockExportCommit, {
      requestViewerDataExport: {
        dataExportRequest: {
          completedAt: null,
          failureReason: null,
          format: 'JSON',
          id: 'export-1',
          requestedAt: '2026-07-02T00:00:00Z',
          status: 'PENDING',
        },
        errors: [],
      },
    });
    expect(screen.getByText('Pending')).toBeOnTheScreen();

    await user.press(
      screen.getByRole('button', { name: 'Request account deletion' }),
    );
    expect(mockDeleteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {},
    });
  });

  test('cancels deletion requests and keeps payload errors retryable', async () => {
    const user = userEvent.setup();

    await render(<AccountSettingsScreen />);

    await user.press(screen.getByRole('button', { name: 'Cancel request' }));
    expect(mockCancelDeleteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { accountDeletionRequestId: 'deletion-1' },
    });
    await completeMutation(mockCancelDeleteCommit, {
      cancelViewerAccountDeletionRequest: {
        accountDeletionRequest: {
          completedAt: null,
          failureReason: null,
          id: 'deletion-1',
          requestedAt: '2026-07-01T00:00:00Z',
          scheduledPurgeAt: '2026-07-08T00:00:00Z',
          status: 'CANCELED',
        },
        errors: [],
      },
    });
    expect(screen.getByText('Canceled')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();

    await user.press(
      screen.getByRole('button', { name: 'Request account deletion' }),
    );
    await completeMutation(mockDeleteCommit, {
      requestViewerAccountDeletion: {
        accountDeletionRequest: null,
        errors: [{ field: null, message: 'deletion_unavailable' }],
      },
    });
    expect(screen.getByText('deletion_unavailable')).toBeOnTheScreen();
  });
});

async function completeMutation(
  commit: MutationCommit,
  payload: Record<string, unknown>,
) {
  await act(async () => {
    commit.mock.calls.at(-1)?.[0].onCompleted?.(payload);
  });
}

function connection<Node>(nodes: ReadonlyArray<Node>) {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}

function mockOperationName(operation: unknown): string {
  if (
    operation &&
    typeof operation === 'object' &&
    'params' in operation &&
    operation.params &&
    typeof operation.params === 'object' &&
    'name' in operation.params &&
    typeof operation.params.name === 'string'
  ) {
    return operation.params.name;
  }

  return '';
}

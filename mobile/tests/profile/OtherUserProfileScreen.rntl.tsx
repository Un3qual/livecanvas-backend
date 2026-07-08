import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { OtherUserProfileScreen } from '../../src/profile/other/OtherUserProfileScreen';

type MutationCommit = jest.Mock<void, [MutationConfig]>;

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};

let mockQueryData: Record<string, unknown>;
let mockFollowCommit: MutationCommit;
let mockMuteCommit: MutationCommit;
let mockUnmuteCommit: MutationCommit;
let mockBlockCommit: MutationCommit;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: () => mockQueryData,
  useMutation: (mutation: unknown) => {
    const operationName = mockOperationName(mutation);

    if (operationName === 'socialControlOperationsMuteUserMutation') {
      return [mockMuteCommit, false];
    }

    if (operationName === 'socialControlOperationsUnmuteUserMutation') {
      return [mockUnmuteCommit, false];
    }

    if (operationName === 'socialControlOperationsBlockUserMutation') {
      return [mockBlockCommit, false];
    }

    return [mockFollowCommit, false];
  },
}));

beforeEach(() => {
  mockFollowCommit = jest.fn();
  mockMuteCommit = jest.fn();
  mockUnmuteCommit = jest.fn();
  mockBlockCommit = jest.fn();
  mockQueryData = profileQueryData({
    isMuted: false,
    relationshipState: 'ACCEPTED',
  });
});

describe('OtherUserProfileScreen social controls', () => {
  test('mutes and unmutes a profile using its opaque Relay ID', async () => {
    const user = userEvent.setup();

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'Mute' }));

    expect(mockMuteCommit).toHaveBeenCalledTimes(1);
    expect(mockMuteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { mutedId: 'opaque-profile-id' },
    });

    await completeMutation(mockMuteCommit, {
      muteUser: {
        errors: [],
      },
    });

    expect(
      screen.getByText('You follow this profile. Notifications are muted.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Unmute' }));

    expect(mockUnmuteCommit).toHaveBeenCalledTimes(1);
    expect(mockUnmuteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { mutedId: 'opaque-profile-id' },
    });
  });

  test('confirms before blocking and then hides reversible controls', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isMuted: false,
      relationshipState: 'NONE',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'Block' }));

    expect(
      screen.getByText(
        'Block this profile? Unblock is not available in the mobile app yet.',
      ),
    ).toBeOnTheScreen();
    expect(mockBlockCommit).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirm block' }));

    expect(mockBlockCommit).toHaveBeenCalledTimes(1);
    expect(mockBlockCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { blockedId: 'opaque-profile-id' },
    });

    await completeMutation(mockBlockCommit, {
      blockUser: {
        errors: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('This profile is not available.')).toBeOnTheScreen();
    });
    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
  });

  test('keeps block payload errors local and retryable', async () => {
    const user = userEvent.setup();

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'Block' }));
    await user.press(screen.getByRole('button', { name: 'Confirm block' }));

    await completeMutation(mockBlockCommit, {
      blockUser: {
        errors: [{ field: 'blockedId', message: 'not_found' }],
      },
    });

    expect(screen.getByText('blockedId: not_found')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Confirm block' }));

    expect(mockBlockCommit).toHaveBeenCalledTimes(2);
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

function profileQueryData({
  isMuted,
  relationshipState,
}: {
  isMuted: boolean;
  relationshipState: string;
}) {
  return {
    isMuted,
    node: {
      __typename: 'User',
      currentLiveSession: null,
      followers: connection([]),
      following: connection([]),
      id: 'opaque-profile-id',
      privacyMode: 'PUBLIC',
    },
    relationshipState,
  };
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
  if (typeof operation === 'string') {
    return operation;
  }

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

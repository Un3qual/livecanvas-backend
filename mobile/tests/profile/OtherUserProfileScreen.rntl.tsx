import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';

import { OtherUserProfileScreen } from '../../src/profile/other/OtherUserProfileScreen';

type MutationCommit = jest.Mock<void, [MutationConfig]>;

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};

type QueryOptions = {
  readonly fetchKey?: number;
  readonly fetchPolicy?: string;
};

let mockQueryData: Record<string, unknown>;
let mockFollowCommit: MutationCommit;
let mockMuteCommit: MutationCommit;
let mockUnmuteCommit: MutationCommit;
let mockBlockCommit: MutationCommit;
let mockUnfollowCommit: MutationCommit;
let mockUnblockCommit: MutationCommit;
let mockQueryOptions: QueryOptions[];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    _query: unknown,
    _variables: Record<string, unknown>,
    options: QueryOptions,
  ) => {
    mockQueryOptions.push(options);
    return mockQueryData;
  },
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

    if (operationName === 'socialControlOperationsUnfollowUserMutation') {
      return [mockUnfollowCommit, false];
    }

    if (operationName === 'socialControlOperationsUnblockUserMutation') {
      return [mockUnblockCommit, false];
    }

    return [mockFollowCommit, false];
  },
}));

beforeEach(() => {
  mockFollowCommit = jest.fn();
  mockMuteCommit = jest.fn();
  mockUnmuteCommit = jest.fn();
  mockBlockCommit = jest.fn();
  mockUnfollowCommit = jest.fn();
  mockUnblockCommit = jest.fn();
  mockQueryOptions = [];
  mockQueryData = profileQueryData({
    isBlockedByViewer: false,
    isMuted: false,
    relationshipState: 'ACCEPTED',
  });
});

describe('OtherUserProfileScreen social controls', () => {
  test('blocks a social control submitted in the same tick as follow', async () => {
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'NONE',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    const followButton = screen.getByRole('button', { name: 'Request follow' });
    const staleMuteButton = screen.getByRole('button', { name: 'Mute' });

    await fireEvent.press(followButton);
    await fireEvent.press(staleMuteButton);

    expect(mockFollowCommit).toHaveBeenCalledTimes(1);
    expect(mockMuteCommit).not.toHaveBeenCalled();
  });

  test('mutes and unmutes a profile using its opaque Relay ID', async () => {
    const user = userEvent.setup();

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'Mute' }));

    expect(mockMuteCommit).toHaveBeenCalledTimes(1);
    expect(mockMuteCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { mutedId: 'opaque-profile-id' },
    });

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: true,
      relationshipState: 'ACCEPTED',
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

  test('unfollows with the opaque Relay ID and blocks a same-tick second action', async () => {
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'ACCEPTED',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    const unfollow = screen.getByRole('button', { name: 'Unfollow' });
    const staleMute = screen.getByRole('button', { name: 'Mute' });
    await fireEvent.press(unfollow);
    await fireEvent.press(staleMute);

    expect(mockUnfollowCommit).toHaveBeenCalledTimes(1);
    expect(mockUnfollowCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { followedId: 'opaque-profile-id' },
    });
    expect(mockMuteCommit).not.toHaveBeenCalled();

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'BLOCKED',
    });

    await completeMutation(mockUnfollowCommit, {
      unfollowUser: { errors: [] },
    });

    expect(screen.getByText('This profile is not available.')).toBeOnTheScreen();
    expect(mockQueryOptions).toContainEqual({
      fetchKey: 1,
      fetchPolicy: 'network-only',
    });
  });

  test('ignores an unfollow completion after navigation changes the profile id', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      profileId: 'profile-1',
      relationshipState: 'ACCEPTED',
    });

    const view = await render(<OtherUserProfileScreen id="profile-1" />);
    await user.press(screen.getByRole('button', { name: 'Unfollow' }));
    expect(mockUnfollowCommit).toHaveBeenCalledTimes(1);

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      profileId: 'profile-2',
      relationshipState: 'ACCEPTED',
    });
    await view.rerender(<OtherUserProfileScreen id="profile-2" />);

    await completeMutation(mockUnfollowCommit, {
      unfollowUser: { errors: [] },
    });

    expect(screen.getByText('You follow this profile.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Unfollow' })).toBeOnTheScreen();
  });

  test('ignores an old completion after navigating away and back to the same profile', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      profileId: 'profile-1',
      relationshipState: 'ACCEPTED',
    });

    const view = await render(<OtherUserProfileScreen id="profile-1" />);
    await user.press(screen.getByRole('button', { name: 'Unfollow' }));

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      profileId: 'profile-2',
      relationshipState: 'ACCEPTED',
    });
    await view.rerender(<OtherUserProfileScreen id="profile-2" />);

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      profileId: 'profile-1',
      relationshipState: 'NONE',
    });
    await view.rerender(<OtherUserProfileScreen id="profile-1" />);

    await user.press(screen.getByRole('button', { name: 'Block' }));
    await user.press(screen.getByRole('button', { name: 'Confirm block' }));

    mockQueryData = profileQueryData({
      isBlockedByViewer: true,
      isMuted: false,
      profileId: 'profile-1',
      relationshipState: 'BLOCKED',
    });
    await completeMutation(mockBlockCommit, {
      blockUser: { errors: [] },
    });

    expect(screen.getByText('You blocked this profile.')).toBeOnTheScreen();
    await completeMutation(mockUnfollowCommit, {
      unfollowUser: { errors: [] },
    });

    expect(screen.getByText('You blocked this profile.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeOnTheScreen();
  });

  test('shows unblock only for an outbound block and submits the opaque Relay ID', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isBlockedByViewer: true,
      isMuted: false,
      relationshipState: 'BLOCKED',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);
    await user.press(screen.getByRole('button', { name: 'Unblock' }));

    expect(mockUnblockCommit).toHaveBeenCalledTimes(1);
    expect(mockUnblockCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { blockedId: 'opaque-profile-id' },
    });

    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'PUBLIC',
    });

    await completeMutation(mockUnblockCommit, {
      unblockUser: { errors: [] },
    });

    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
    expect(screen.getByText('You can follow this profile.')).toBeOnTheScreen();
    expect(mockQueryOptions).toContainEqual({
      fetchKey: 1,
      fetchPolicy: 'network-only',
    });
  });

  test('does not expose unblock for an inbound-only block', async () => {
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'BLOCKED',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
    expect(screen.getByText('This profile is not available.')).toBeOnTheScreen();
  });

  test('keeps unblock payload errors local and retryable', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isBlockedByViewer: true,
      isMuted: false,
      relationshipState: 'BLOCKED',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);
    await user.press(screen.getByRole('button', { name: 'Unblock' }));
    await completeMutation(mockUnblockCommit, {
      unblockUser: {
        errors: [{ field: 'blockedId', message: 'not_found' }],
      },
    });

    expect(screen.getByText('blockedId: not_found')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Unblock' }));
    expect(mockUnblockCommit).toHaveBeenCalledTimes(2);
  });

  test('confirms before blocking and then exposes outbound unblock', async () => {
    const user = userEvent.setup();
    mockQueryData = profileQueryData({
      isBlockedByViewer: false,
      isMuted: false,
      relationshipState: 'NONE',
    });

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    await user.press(screen.getByRole('button', { name: 'Block' }));

    expect(
      screen.getByText(
        'Block this profile? You can unblock it later.',
      ),
    ).toBeOnTheScreen();
    expect(mockBlockCommit).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirm block' }));

    expect(mockBlockCommit).toHaveBeenCalledTimes(1);
    expect(mockBlockCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { blockedId: 'opaque-profile-id' },
    });

    mockQueryData = profileQueryData({
      isBlockedByViewer: true,
      isMuted: false,
      relationshipState: 'BLOCKED',
    });

    await completeMutation(mockBlockCommit, {
      blockUser: {
        errors: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('You blocked this profile.')).toBeOnTheScreen();
    });
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeOnTheScreen();
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

  test('does not expose social controls when the route targets the viewer', async () => {
    mockQueryData = {
      ...profileQueryData({
        isBlockedByViewer: false,
        isMuted: false,
        relationshipState: 'ACCEPTED',
      }),
      viewer: { id: 'opaque-profile-id' },
    };

    await render(<OtherUserProfileScreen id="opaque-profile-id" />);

    expect(screen.getByText('This is your profile.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Block' })).toBeNull();
  });
});

async function completeMutation(
  commit: MutationCommit,
  payload: Record<string, unknown>,
) {
  await act(() => {
    commit.mock.calls.at(-1)?.[0].onCompleted?.(payload);
  });
}

function profileQueryData({
  isBlockedByViewer,
  isMuted,
  profileId = 'opaque-profile-id',
  relationshipState,
}: {
  isBlockedByViewer: boolean;
  isMuted: boolean;
  profileId?: string;
  relationshipState: string;
}) {
  return {
    isBlockedByViewer,
    isMuted,
    node: {
      __typename: 'User',
      currentLiveSession: null,
      followers: connection([]),
      following: connection([]),
      id: profileId,
      privacyMode: 'PUBLIC',
    },
    relationshipState,
    viewer: { id: 'viewer-id' },
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

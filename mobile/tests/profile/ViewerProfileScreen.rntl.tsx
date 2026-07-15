import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { ViewerProfileScreen } from '../../src/profile/viewer/ViewerProfileScreen';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};

type MutationCommit = jest.Mock<
  { dispose: () => void },
  [MutationConfig]
>;

let mockViewer: Record<string, unknown>;
let mockIdentityCommit: MutationCommit;
let mockPrivacyCommit: MutationCommit;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: () => ({ viewer: mockViewer }),
  useMutation: (operation: unknown) => {
    const operationName =
      typeof operation === 'string'
        ? operation
        : mockReadRelayOperationName(operation);

    return operationName.includes('ProfileIdentity')
      ? [mockIdentityCommit, false]
      : [mockPrivacyCommit, false];
  },
}));

jest.mock('../../src/profile/ProfileContentPreviewSection', () => ({
  ProfileContentPreviewSections: () => null,
}));

jest.mock('../../src/profile/viewer/ViewerProfileSocialSections', () => ({
  ViewerProfileSocialSectionsBoundary: () => null,
}));

beforeEach(() => {
  mockViewer = {
    currentLiveSession: null,
    displayName: 'Old Name',
    email: 'viewer@example.com',
    id: 'viewer-id',
    privacyMode: 'PUBLIC',
    username: 'old_name',
  };
  mockIdentityCommit = jest.fn((_config: MutationConfig) => ({
    dispose: jest.fn(),
  }));
  mockPrivacyCommit = jest.fn((_config: MutationConfig) => ({
    dispose: jest.fn(),
  }));
});

describe('ViewerProfileScreen identity editor', () => {
  test('prefills inputs and rejects invalid local values without a mutation', async () => {
    const user = userEvent.setup();
    await render(<ViewerProfileScreen />);

    expect(screen.getByDisplayValue('Old Name')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('old_name')).toBeOnTheScreen();

    await user.clear(screen.getByLabelText('Display name'));
    await user.clear(screen.getByLabelText('Username'));
    await user.press(screen.getByRole('button', { name: 'Save identity' }));

    expect(screen.getByText('Enter a display name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a username.')).toBeOnTheScreen();
    expect(mockIdentityCommit).not.toHaveBeenCalled();
  });

  test('admits one save, preserves later edits, and updates the header from canonical success', async () => {
    const user = userEvent.setup();
    await render(<ViewerProfileScreen />);

    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), 'Submitted Name');
    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'SUBMITTED_NAME');

    const saveButton = screen.getByRole('button', { name: 'Save identity' });
    await fireEvent.press(saveButton);
    await fireEvent.press(saveButton);

    expect(mockIdentityCommit).toHaveBeenCalledTimes(1);
    expect(mockIdentityCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        displayName: 'Submitted Name',
        username: 'submitted_name',
      },
    });

    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), 'Unsaved Next Name');

    await completeIdentityMutation({
      updateViewerProfileIdentity: {
        errors: [],
        user: {
          displayName: 'Submitted Name',
          id: 'viewer-id',
          username: 'submitted_name',
        },
      },
    });

    expect(screen.getByText('Submitted Name')).toBeOnTheScreen();
    expect(screen.getByText('@submitted_name')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Unsaved Next Name')).toBeOnTheScreen();
  });

  test('renders field and transport errors, supports retry, and ignores completion after unmount', async () => {
    const user = userEvent.setup();
    const view = await render(<ViewerProfileScreen />);

    await user.press(screen.getByRole('button', { name: 'Save identity' }));
    await completeIdentityMutation({
      updateViewerProfileIdentity: {
        errors: [
          { field: 'username', message: 'has already been taken' },
          { field: 'displayName', message: 'is invalid' },
        ],
        user: null,
      },
    });

    expect(screen.getByText('has already been taken')).toBeOnTheScreen();
    expect(screen.getByText('is invalid')).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Username'), '2');
    await user.press(screen.getByRole('button', { name: 'Save identity' }));
    expect(mockIdentityCommit).toHaveBeenCalledTimes(2);

    await act(() => {
      mockIdentityCommit.mock.calls[1]?.[0].onError?.();
    });
    expect(
      screen.getByText('We could not update your profile identity. Try again.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Save identity' }));
    expect(mockIdentityCommit).toHaveBeenCalledTimes(3);

    await view.unmount();
    expect(mockIdentityCommit.mock.results[2]?.value.dispose).toHaveBeenCalledTimes(
      1,
    );
    await act(() => {
      mockIdentityCommit.mock.calls[2]?.[0].onCompleted?.({
        updateViewerProfileIdentity: {
          errors: [],
          user: {
            displayName: 'Late Name',
            id: 'viewer-id',
            username: 'late_name',
          },
        },
      });
    });
  });
});

async function completeIdentityMutation(payload: Record<string, unknown>) {
  const config = mockIdentityCommit.mock.calls.at(-1)?.[0];

  if (!config) {
    throw new Error('Missing identity mutation');
  }

  await act(() => {
    config.onCompleted?.(payload);
  });
}

function mockReadRelayOperationName(operation: unknown): string {
  if (typeof operation !== 'object' || operation === null) {
    return '';
  }

  const params = Reflect.get(operation, 'params');

  return typeof params === 'object' && params !== null
    ? String(Reflect.get(params, 'name') ?? '')
    : '';
}

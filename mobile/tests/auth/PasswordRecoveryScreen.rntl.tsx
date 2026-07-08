import { act, render, screen, userEvent } from '@testing-library/react-native';

import { PASSWORD_RECOVERY_SUCCESS_COPY } from '../../src/auth/recovery/passwordRecoveryState';
import { PasswordRecoveryScreen } from '../../src/auth/recovery/PasswordRecoveryScreen';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};
type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockRequestCommit: MutationCommit;
let mockReplacedRoutes: string[];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (route: string) => {
      mockReplacedRoutes.push(route);
    },
  }),
}));

jest.mock('react-relay', () => ({
  useMutation: () => [mockRequestCommit, false],
}));

beforeEach(() => {
  mockRequestCommit = jest.fn();
  mockReplacedRoutes = [];
});

describe('PasswordRecoveryScreen', () => {
  test('submits normalized email and shows uniform success copy', async () => {
    const user = userEvent.setup();

    await render(<PasswordRecoveryScreen />);

    await user.type(screen.getByPlaceholderText('you@example.com'), ' Viewer@Example.COM ');
    await user.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(mockRequestCommit).toHaveBeenCalledTimes(1);
    expect(mockRequestCommit.mock.calls[0]?.[0].variables).toEqual({
      input: { email: 'viewer@example.com' },
    });

    await completeMutation(mockRequestCommit, {
      requestPasswordReset: {
        errors: [],
      },
    });

    expect(screen.getByText(PASSWORD_RECOVERY_SUCCESS_COPY)).toBeOnTheScreen();
  });

  test('keeps entered email after retryable payload errors', async () => {
    const user = userEvent.setup();

    await render(<PasswordRecoveryScreen />);

    await user.type(screen.getByPlaceholderText('you@example.com'), 'viewer@example.com');
    await user.press(screen.getByRole('button', { name: 'Send reset link' }));

    await completeMutation(mockRequestCommit, {
      requestPasswordReset: {
        errors: [{ field: null, message: 'try_again' }],
      },
    });

    expect(screen.getByDisplayValue('viewer@example.com')).toBeOnTheScreen();
    expect(screen.getByText('try_again')).toBeOnTheScreen();
  });

  test('returns to sign in', async () => {
    const user = userEvent.setup();

    await render(<PasswordRecoveryScreen />);

    await user.press(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(mockReplacedRoutes).toEqual(['/sign-in']);
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

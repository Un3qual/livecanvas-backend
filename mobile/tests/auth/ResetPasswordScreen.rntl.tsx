import { act, render, screen, userEvent } from '@testing-library/react-native';

import { PASSWORD_RESET_SUCCESS_COPY } from '../../src/auth/recovery/passwordRecoveryState';
import { ResetPasswordScreen } from '../../src/auth/recovery/ResetPasswordScreen';

type MutationConfig = {
  readonly onCompleted?: (payload: Record<string, unknown>) => void;
  readonly onError?: () => void;
  readonly variables: Record<string, unknown>;
};
type MutationCommit = jest.Mock<void, [MutationConfig]>;

let mockResetCommit: MutationCommit;
let mockReplacedRoutes: string[];
let mockSearchParams: { token?: string | string[] };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({
    replace: (route: string) => {
      mockReplacedRoutes.push(route);
    },
  }),
}));

jest.mock('react-relay', () => ({
  useMutation: () => [mockResetCommit, false],
}));

beforeEach(() => {
  mockResetCommit = jest.fn();
  mockReplacedRoutes = [];
  mockSearchParams = { token: 'query-token' };
});

describe('ResetPasswordScreen', () => {
  test('submits reset password with the token query param', async () => {
    const user = userEvent.setup();

    await render(<ResetPasswordScreen />);

    expect(screen.getByDisplayValue('query-token')).toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('Enter a new password'), 'new-password-123');
    await user.type(
      screen.getByPlaceholderText('Re-enter the new password'),
      'new-password-123',
    );
    await user.press(screen.getByRole('button', { name: 'Reset password' }));

    expect(mockResetCommit).toHaveBeenCalledTimes(1);
    expect(mockResetCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        password: 'new-password-123',
        passwordConfirmation: 'new-password-123',
        token: 'query-token',
      },
    });

    await completeMutation(mockResetCommit, {
      resetPassword: {
        errors: [],
        reset: true,
      },
    });

    expect(screen.getByText(PASSWORD_RESET_SUCCESS_COPY)).toBeOnTheScreen();
  });

  test('supports pasted reset tokens when no query token exists', async () => {
    const user = userEvent.setup();
    mockSearchParams = {};

    await render(<ResetPasswordScreen />);

    await user.type(screen.getByPlaceholderText('Paste reset token'), 'paste-token');
    await user.type(screen.getByPlaceholderText('Enter a new password'), 'new-password-123');
    await user.type(
      screen.getByPlaceholderText('Re-enter the new password'),
      'new-password-123',
    );
    await user.press(screen.getByRole('button', { name: 'Reset password' }));

    expect(mockResetCommit.mock.calls[0]?.[0].variables).toEqual({
      input: {
        password: 'new-password-123',
        passwordConfirmation: 'new-password-123',
        token: 'paste-token',
      },
    });
  });

  test('keeps fields after retryable reset errors and can return to sign in', async () => {
    const user = userEvent.setup();

    await render(<ResetPasswordScreen />);

    await user.type(screen.getByPlaceholderText('Enter a new password'), 'new-password-123');
    await user.type(
      screen.getByPlaceholderText('Re-enter the new password'),
      'new-password-123',
    );
    await user.press(screen.getByRole('button', { name: 'Reset password' }));

    await completeMutation(mockResetCommit, {
      resetPassword: {
        errors: [{ field: 'token', message: 'invalid_or_expired' }],
        reset: false,
      },
    });

    expect(screen.getByDisplayValue('query-token')).toBeOnTheScreen();
    expect(screen.getByText('token: invalid_or_expired')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Sign in' }));

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

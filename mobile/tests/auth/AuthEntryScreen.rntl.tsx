import { render, screen, userEvent } from '@testing-library/react-native';

import { AuthEntryScreen } from '../../src/auth/screens/AuthEntryScreen';
import { MAGIC_LINK_REQUEST_SUCCESS_COPY } from '../../src/auth/useMagicLinkAuth';

let mockPushedRoutes: string[];
const mockSubmitMagicLink = jest.fn(() => Promise.resolve(true));
const mockClearTransientErrors = jest.fn();
let mockController: Record<string, unknown>;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: (route: string) => {
      mockPushedRoutes.push(route);
    },
    replace: jest.fn(),
  }),
}));

jest.mock('../../src/auth/useAuthEntryController', () => ({
  useAuthEntryController: () => mockController,
}));

beforeEach(() => {
  mockPushedRoutes = [];
  mockSubmitMagicLink.mockClear();
  mockClearTransientErrors.mockClear();
  mockController = {
    canSwitchScreens: true,
    clearTransientErrors: mockClearTransientErrors,
    fieldErrors: {},
    formError: null,
    handleAlternateScreenPress: (navigate: () => void) => navigate(),
    hasAppleAuthOption: false,
    hasGoogleAuthOption: false,
    isAppleSubmitting: false,
    isBusy: false,
    isGoogleSubmitting: false,
    isMagicLinkSubmitting: false,
    isPasswordSubmitting: false,
    magicLinkMessage: null,
    showAlternativeAuthDivider: true,
    submitApple: jest.fn(),
    submitGoogle: jest.fn(),
    submitMagicLink: mockSubmitMagicLink,
    submitPassword: jest.fn(),
  };
});

describe('AuthEntryScreen recovery link', () => {
  test('routes sign-in users to password recovery', async () => {
    const user = userEvent.setup();

    await render(<AuthEntryScreen mode="signIn" />);

    await user.press(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(mockPushedRoutes).toEqual(['/password-recovery']);
  });

  test('does not show password recovery on sign-up', async () => {
    await render(<AuthEntryScreen mode="signUp" />);

    expect(screen.queryByRole('button', { name: 'Forgot password?' })).toBeNull();
  });
});

describe('AuthEntryScreen magic-link action', () => {
  test.each([
    ['signIn', 'Email me a sign-in link'],
    ['signUp', 'Email me a sign-up link'],
  ] as const)('requests the current mode without requiring a password', async (mode, label) => {
    const user = userEvent.setup();

    await render(<AuthEntryScreen mode={mode} />);
    await user.type(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await user.press(screen.getByRole('button', { name: label }));

    expect(mockSubmitMagicLink).toHaveBeenCalledWith('user@example.com');
  });

  test('shows neutral success copy and shared email errors', async () => {
    mockController = {
      ...mockController,
      fieldErrors: { email: 'Email cannot receive a sign-up link.' },
      magicLinkMessage: MAGIC_LINK_REQUEST_SUCCESS_COPY,
    };

    await render(<AuthEntryScreen mode="signUp" />);

    expect(screen.getByText(MAGIC_LINK_REQUEST_SUCCESS_COPY)).toBeOnTheScreen();
    expect(
      screen.getByText('Email cannot receive a sign-up link.'),
    ).toBeOnTheScreen();
  });

  test('clears request feedback when the shared email changes', async () => {
    const user = userEvent.setup();

    await render(<AuthEntryScreen mode="signIn" />);
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a');

    expect(mockClearTransientErrors).toHaveBeenCalled();
  });
});

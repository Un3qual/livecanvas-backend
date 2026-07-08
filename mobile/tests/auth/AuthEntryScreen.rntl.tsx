import { render, screen, userEvent } from '@testing-library/react-native';

import { AuthEntryScreen } from '../../src/auth/screens/AuthEntryScreen';

let mockPushedRoutes: string[];

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
  useAuthEntryController: () => ({
    canSwitchScreens: true,
    clearTransientErrors: jest.fn(),
    fieldErrors: {},
    formError: null,
    handleAlternateScreenPress: (navigate: () => void) => navigate(),
    hasAppleAuthOption: false,
    hasGoogleAuthOption: false,
    isAppleSubmitting: false,
    isBusy: false,
    isGoogleSubmitting: false,
    isPasswordSubmitting: false,
    showOauthDivider: false,
    submitApple: jest.fn(),
    submitGoogle: jest.fn(),
    submitPassword: jest.fn(),
  }),
}));

beforeEach(() => {
  mockPushedRoutes = [];
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

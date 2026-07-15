import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import MagicLinkRoute from '../../app/(auth)/magic-link';
import { MagicLinkScreen } from '../../src/auth/magicLink/MagicLinkScreen';

let mockAuthStatus: 'authenticated' | 'loading' | 'unauthenticated';
let mockHandoffParam: string | string[] | undefined;
let mockHandoffStatus: 'expired' | 'matched' | 'mismatch' | 'missing';
let mockPayload: {
  purpose: 'signIn' | 'signUp';
  returnTo?: string;
  token: string;
};
type RedeemParams = {
  apiBaseUrl: string;
  mode: 'signIn' | 'signUp';
  token: string;
};
type TestAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
type RedeemResult =
  | {
      ok: true;
      tokens: TestAuthTokens;
    }
  | {
      ok: false;
      errors: Array<{ code?: string; message: string }>;
    };
const mockReplace = jest.fn();
const mockSignIn = jest.fn<Promise<void>, [TestAuthTokens]>(() =>
  Promise.resolve(),
);
const mockClearHandoff = jest.fn<Promise<boolean>, [string]>(() =>
  Promise.resolve(true),
);
const mockRedeem = jest.fn<Promise<RedeemResult>, [RedeemParams]>(() =>
  Promise.resolve({
    ok: true as const,
    tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-01T00:00:00.000Z',
    },
  }),
);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ handoff: mockHandoffParam }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    state: { status: mockAuthStatus },
  }),
}));

jest.mock('../../src/providers/StartupGate', () => ({
  useStartupState: () => ({
    environment: { apiBaseUrl: 'https://api.example.test' },
  }),
}));

jest.mock('../../src/auth/authMutationClient', () => ({
  redeemMagicLinkAuthMutation: (params: RedeemParams) => mockRedeem(params),
}));

jest.mock('../../src/auth/magicLink/magicLinkHandoff', () => ({
  clearMagicLinkHandoff: (handoffId: string) => mockClearHandoff(handoffId),
  withMagicLinkHandoff: async (
    _handoffId: string,
    callback: (payload: typeof mockPayload) => Promise<unknown>,
  ) =>
    mockHandoffStatus === 'matched'
      ? { status: 'matched', value: await callback(mockPayload) }
      : { status: mockHandoffStatus },
}));

beforeEach(() => {
  mockAuthStatus = 'unauthenticated';
  mockHandoffParam = 'handoff-one';
  mockHandoffStatus = 'matched';
  mockPayload = { purpose: 'signIn', token: 'serialized-token' };
  mockReplace.mockClear();
  mockSignIn.mockClear();
  mockSignIn.mockResolvedValue();
  mockClearHandoff.mockClear();
  mockRedeem.mockClear();
  mockRedeem.mockResolvedValue({
    ok: true,
    tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-01T00:00:00.000Z',
    },
  });
});

describe('MagicLinkScreen', () => {
  test.each([
    ['signIn', 'serialized-login-token'],
    ['signUp', 'serialized-signup-token'],
  ] as const)('redeems %s, persists the session, clears, and routes home', async (purpose, token) => {
    mockPayload = { purpose, token };

    await render(<MagicLinkRoute />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockRedeem).toHaveBeenCalledWith({
      apiBaseUrl: 'https://api.example.test',
      mode: purpose,
      token,
    });
    expect(mockSignIn).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-01T00:00:00.000Z',
    });
    expect(mockClearHandoff).toHaveBeenCalledWith('handoff-one');
  });

  test('routes to the locally retained post-auth target after redemption', async () => {
    mockPayload = {
      purpose: 'signIn',
      returnTo: '/compose',
      token: 'serialized-token',
    };

    await render(<MagicLinkScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/compose'));
  });

  test('falls back home when a retained post-auth target is not allowed', async () => {
    mockPayload = {
      purpose: 'signIn',
      returnTo: '//attacker.example',
      token: 'serialized-token',
    };

    await render(<MagicLinkScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
  });

  test.each(['missing', 'mismatch', 'expired'] as const)(
    'shows a generic unavailable state for a %s handoff without clearing another slot',
    async (status) => {
      mockHandoffStatus = status;

      await render(<MagicLinkScreen />);

      await waitFor(() => {
        expect(
          screen.getByText('This email link is invalid or has expired.'),
        ).toBeOnTheScreen();
      });
      expect(mockRedeem).not.toHaveBeenCalled();
      expect(mockClearHandoff).not.toHaveBeenCalled();
    },
  );

  test('clears a definitively invalid token', async () => {
    mockRedeem.mockResolvedValueOnce({
      ok: false,
      errors: [
        { code: 'INVALID_CREDENTIALS', message: 'invalid_credentials' },
      ],
    });

    await render(<MagicLinkScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('This email link is invalid or has expired.'),
      ).toBeOnTheScreen();
    });
    expect(mockClearHandoff).toHaveBeenCalledWith('handoff-one');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('retains and retries the handoff after a transport failure', async () => {
    mockRedeem.mockRejectedValueOnce(new Error('offline'));

    await render(<MagicLinkScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('We could not confirm this email link. Try again.'),
      ).toBeOnTheScreen();
    });
    expect(mockClearHandoff).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockRedeem).toHaveBeenCalledTimes(2);
  });

  test('retries local token persistence without redeeming the one-time link twice', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('secure storage unavailable'));

    await render(<MagicLinkScreen />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));

    expect(mockRedeem).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledTimes(2);
  });

  test('does not replace an existing authenticated session', async () => {
    mockAuthStatus = 'authenticated';

    await render(<MagicLinkScreen />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockRedeem).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockClearHandoff).toHaveBeenCalledWith('handoff-one');
  });

  test('ignores stale completion after the handoff route changes', async () => {
    let resolveFirst!: (result: RedeemResult) => void;
    mockPayload = { purpose: 'signIn', token: 'token-a' };
    mockRedeem.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const view = await render(<MagicLinkScreen />);
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(1));

    mockHandoffParam = 'handoff-two';
    mockPayload = { purpose: 'signUp', token: 'token-b' };
    await view.rerender(<MagicLinkScreen />);
    await waitFor(() => expect(mockRedeem).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveFirst({
        ok: true,
        tokens: {
          accessToken: 'stale-access',
          refreshToken: 'stale-refresh',
          expiresAt: '2026-08-01T00:00:00.000Z',
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'));
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).not.toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'stale-access' }),
    );
    expect(mockClearHandoff).toHaveBeenCalledWith('handoff-two');
    expect(mockClearHandoff).not.toHaveBeenCalledWith('handoff-one');
  });
});

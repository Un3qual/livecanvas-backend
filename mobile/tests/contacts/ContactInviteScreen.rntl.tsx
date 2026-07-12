import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import InviteRoute from '../../app/invite';
import { ContactInviteScreen } from '../../src/contacts/ContactInviteScreen';

type CommitConfig = {
  readonly variables: { readonly input: { readonly token: string } };
  readonly onCompleted: (payload: {
    readonly consumeContactInvite: {
      readonly consumed: boolean;
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
    } | null;
  }) => void;
  readonly onError: (error: Error) => void;
};

let mockAuthStatus: 'authenticated' | 'loading' | 'unauthenticated';
let mockHandoffParam: string | string[] | undefined;
let mockHandoffStatus: 'expired' | 'matched' | 'mismatch' | 'missing';
let mockPushedRoutes: string[];
let mockTokenForConsumption: string;
const mockClearHandoff = jest.fn((_handoffId: string) => Promise.resolve(true));
const mockCommitConsume = jest.fn<undefined, [CommitConfig]>();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ handoff: mockHandoffParam }),
  useRouter: () => ({
    push: (href: string) => mockPushedRoutes.push(href),
  }),
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({ state: { status: mockAuthStatus } }),
}));

jest.mock('react-relay', () => ({
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useMutation: () => [mockCommitConsume, false],
}));

jest.mock('../../src/contacts/contactInviteHandoff', () => ({
  clearContactInviteHandoff: (handoffId: string) => mockClearHandoff(handoffId),
  readContactInviteHandoffStatus: () => Promise.resolve(mockHandoffStatus),
  withContactInviteToken: async (
    _handoffId: string,
    callback: (token: string) => Promise<unknown>,
  ) =>
    mockHandoffStatus === 'matched'
      ? { status: 'matched', value: await callback(mockTokenForConsumption) }
      : { status: mockHandoffStatus },
}));

beforeEach(() => {
  mockAuthStatus = 'unauthenticated';
  mockHandoffParam = 'handoff-one';
  mockHandoffStatus = 'matched';
  mockPushedRoutes = [];
  mockTokenForConsumption = 'serialized-token';
  mockClearHandoff.mockClear();
  mockCommitConsume.mockClear();
});

describe('ContactInviteScreen', () => {
  test('keeps the invite route public with token-free auth return actions', async () => {
    await render(<InviteRoute />);

    await waitFor(() => {
      expect(screen.getByText('You have been invited to LiveCanvas.')).toBeOnTheScreen();
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create account' }),
    );

    expect(mockPushedRoutes).toEqual([
      '/sign-in?returnTo=%2Finvite%3Fhandoff%3Dhandoff-one',
      '/sign-up?returnTo=%2Finvite%3Fhandoff%3Dhandoff-one',
    ]);
    expect(JSON.stringify(mockPushedRoutes)).not.toContain('serialized-token');
    expect(mockCommitConsume).not.toHaveBeenCalled();
  });

  test('consumes once for an authenticated viewer and clears the matching slot', async () => {
    mockAuthStatus = 'authenticated';

    await render(<ContactInviteScreen />);

    await waitFor(() => expect(mockCommitConsume).toHaveBeenCalledTimes(1));
    expect(mockCommitConsume.mock.calls[0]?.[0].variables).toEqual({
      input: { token: 'serialized-token' },
    });

    await act(async () => {
      mockCommitConsume.mock.calls[0]?.[0].onCompleted({
        consumeContactInvite: { consumed: true, errors: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Invitation accepted.')).toBeOnTheScreen();
    });
    expect(mockClearHandoff).toHaveBeenCalledWith('handoff-one');
    expect(mockCommitConsume).toHaveBeenCalledTimes(1);
  });

  test('retains the token after a lost response and retries the same serialization', async () => {
    mockAuthStatus = 'authenticated';

    await render(<ContactInviteScreen />);
    await waitFor(() => expect(mockCommitConsume).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockCommitConsume.mock.calls[0]?.[0].onError(new Error('response lost'));
      await Promise.resolve();
    });

    expect(mockClearHandoff).not.toHaveBeenCalled();
    expect(
      screen.getByText('We could not confirm the invitation. Try again.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(mockCommitConsume).toHaveBeenCalledTimes(2));

    expect(
      mockCommitConsume.mock.calls.map(([config]) => config.variables),
    ).toEqual([
      { input: { token: 'serialized-token' } },
      { input: { token: 'serialized-token' } },
    ]);

    await act(async () => {
      mockCommitConsume.mock.calls[1]?.[0].onCompleted({
        consumeContactInvite: { consumed: true, errors: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Invitation accepted.')).toBeOnTheScreen();
    });
  });

  test('ignores an authenticated completion after the route unmounts', async () => {
    mockAuthStatus = 'authenticated';
    const view = await render(<ContactInviteScreen />);
    await waitFor(() => expect(mockCommitConsume).toHaveBeenCalledTimes(1));

    await view.unmount();
    await act(async () => {
      mockCommitConsume.mock.calls[0]?.[0].onCompleted({
        consumeContactInvite: { consumed: true, errors: [] },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClearHandoff).not.toHaveBeenCalled();
  });

  test('renders a generic invalid state without clearing a newer handoff', async () => {
    mockAuthStatus = 'authenticated';
    mockHandoffStatus = 'mismatch';

    await render(<ContactInviteScreen />);

    await waitFor(() => {
      expect(
        screen.getByText('This invitation is invalid or has expired.'),
      ).toBeOnTheScreen();
    });
    expect(mockCommitConsume).not.toHaveBeenCalled();
    expect(mockClearHandoff).not.toHaveBeenCalled();
  });
});

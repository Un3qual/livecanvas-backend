import React, { Suspense } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Text } from 'react-native';
import { RelayEnvironmentProvider } from 'react-relay';
import {
  createOperationDescriptor,
  Environment,
  Network,
  RecordSource,
  Store,
  type GraphQLResponse,
} from 'relay-runtime';

import otherUserProfileScreenQuery from '../../src/__generated__/OtherUserProfileScreenQuery.graphql';
import { OtherUserProfileScreen } from '../../src/profile/other/OtherUserProfileScreen';

const profileId = 'opaque-profile-id';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

test('withholds cached profile data until current authorization is confirmed', async () => {
  let resolveNetwork: ((response: GraphQLResponse) => void) | undefined;

  const environment = new Environment({
    network: Network.create(
      () =>
        new Promise<GraphQLResponse>((resolve) => {
          resolveNetwork = resolve;
        }),
    ),
    store: new Store(new RecordSource()),
  });

  const operation = createOperationDescriptor(otherUserProfileScreenQuery, {
    id: profileId,
  });

  environment.commitPayload(operation, visibleProfileData());

  await render(
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback={<Text>Checking profile access...</Text>}>
        <OtherUserProfileScreen id={profileId} />
      </Suspense>
    </RelayEnvironmentProvider>,
  );

  expect(screen.getByText('Checking profile access...')).toBeOnTheScreen();
  expect(screen.queryByText('LiveCanvas user')).toBeNull();
  expect(screen.queryByText('Public profile')).toBeNull();

  resolveNetwork?.(hiddenProfilePayload());

  await waitFor(() => {
    expect(screen.getByText('This profile is unavailable.')).toBeOnTheScreen();
  });

  expect(screen.queryByText('LiveCanvas user')).toBeNull();
  expect(screen.queryByText('Public profile')).toBeNull();
});

test('retries a failed privacy-sensitive profile request with a fresh fetch', async () => {
  let networkAttempts = 0;
  let rejectInitialRequest: ((reason?: unknown) => void) | undefined;
  let resolveRetry: ((response: GraphQLResponse) => void) | undefined;
  const environment = new Environment({
    // Failed suspense queries are intentionally retained for five minutes on
    // clients. This test owns the retry lifecycle, so avoid carrying that
    // production cache timer into Jest after the assertions complete.
    isServer: true,
    network: Network.create(() => {
      networkAttempts += 1;

      if (networkAttempts === 1) {
        return new Promise<GraphQLResponse>((_resolve, reject) => {
          rejectInitialRequest = reject;
        });
      }

      return new Promise<GraphQLResponse>((resolve) => {
        resolveRetry = resolve;
      });
    }),
    store: new Store(new RecordSource()),
  });

  const { unmount } = await render(
    <RelayEnvironmentProvider environment={environment}>
      <Suspense fallback={<Text>Checking profile access...</Text>}>
        <OtherUserProfileScreen id={profileId} />
      </Suspense>
    </RelayEnvironmentProvider>,
  );

  await waitFor(() => {
    expect(networkAttempts).toBe(1);
  });

  const rejectInitial = rejectInitialRequest;

  if (!rejectInitial) {
    throw new Error('Missing initial network rejecter');
  }

  await withSuppressedConsoleError(async () => {
    await act(async () => {
      rejectInitial(new Error('offline'));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't load this profile. Check your connection and try again.",
        ),
      ).toBeOnTheScreen();
    });
  });

  await withSuppressedConsoleError(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(networkAttempts).toBe(2);
    });
  });

  const resolveRetryRequest = resolveRetry;

  if (!resolveRetryRequest) {
    throw new Error('Missing retry network resolver');
  }

  await act(async () => {
    resolveRetryRequest(hiddenProfilePayload());
  });

  await waitFor(() => {
    expect(screen.getByText('This profile is unavailable.')).toBeOnTheScreen();
  });

  await act(async () => {
    unmount();
  });
});

function visibleProfileData() {
  return {
    isBlockedByViewer: false,
    isMuted: false,
    node: {
      __typename: 'User',
      currentLiveSession: null,
      followers: emptyConnection(),
      following: emptyConnection(),
      id: profileId,
      privacyMode: 'PUBLIC',
    },
    relationshipState: 'PUBLIC',
    viewer: { id: 'viewer-id' },
  };
}

function hiddenProfilePayload(): GraphQLResponse {
  return {
    data: {
      isBlockedByViewer: false,
      isMuted: false,
      node: null,
      relationshipState: 'NONE',
      viewer: { id: 'viewer-id' },
    },
  };
}

function emptyConnection() {
  return {
    edges: [],
    pageInfo: {
      endCursor: null,
      hasNextPage: false,
    },
  };
}

async function withSuppressedConsoleError(run: () => Promise<void>) {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    await run();
  } finally {
    consoleError.mockRestore();
  }
}

import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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

function visibleProfileData() {
  return {
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

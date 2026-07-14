import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { RelayEnvironmentProvider } from 'react-relay';
import {
  createOperationDescriptor,
  Environment,
  Network,
  RecordSource,
  Store,
  type GraphQLResponse,
} from 'relay-runtime';

import viewerProfileSocialSectionsQuery from '../../src/__generated__/ViewerProfileSocialSectionsQuery.graphql';
import viewerProfileScreenQuery from '../../src/__generated__/ViewerProfileScreenQuery.graphql';
import { ViewerProfileScreen } from '../../src/profile/viewer/ViewerProfileScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

test('renders cached viewer-owned profile data while social identity refreshes', async () => {
  const networkResolvers = new Map<
    string,
    (response: GraphQLResponse) => void
  >();
  const environment = new Environment({
    network: Network.create(
      (operation) =>
        new Promise<GraphQLResponse>((resolve) => {
          networkResolvers.set(operation.name, resolve);
        }),
    ),
    store: new Store(new RecordSource()),
  });
  const viewerOperation = createOperationDescriptor(viewerProfileScreenQuery, {});
  const socialOperation = createOperationDescriptor(
    viewerProfileSocialSectionsQuery,
    {},
  );

  environment.commitPayload(viewerOperation, cachedViewerProfile());
  environment.commitPayload(socialOperation, cachedSocialProfiles());

  await render(
    <RelayEnvironmentProvider environment={environment}>
      <ViewerProfileScreen />
    </RelayEnvironmentProvider>,
  );

  expect(screen.getByText('viewer@example.com')).toBeOnTheScreen();
  expect(screen.getByText('Refreshing social activity...')).toBeOnTheScreen();
  expect(screen.queryByText('cached-follower@example.com')).toBeNull();
  expect(screen.queryByText('cached-requester@example.com')).toBeNull();

  await act(async () => {
    resolveNetwork(
      networkResolvers,
      'ViewerProfileScreenQuery',
      cachedViewerProfile(),
    );
    resolveNetwork(
      networkResolvers,
      'ViewerProfileSocialSectionsQuery',
      emptySocialProfiles(),
    );
    resolveNetwork(
      networkResolvers,
      'profileContentOperationsQuery',
      emptyProfileContent(),
    );
  });

  expect(networkResolvers.size).toBe(0);

  await waitFor(() => {
    expect(screen.getByText('No followers are visible yet.')).toBeOnTheScreen();
  });
});

function cachedViewerProfile() {
  return {
    viewer: {
      currentLiveSession: null,
      email: 'viewer@example.com',
      id: 'viewer-id',
      privacyMode: 'PUBLIC',
    },
  };
}

function cachedSocialProfiles() {
  return {
    viewer: {
      followers: connection([
        {
          email: 'cached-follower@example.com',
          id: 'cached-follower-id',
          privacyMode: 'PUBLIC',
        },
      ]),
      following: connection([]),
      id: 'viewer-id',
    },
    viewerPendingFollowRequests: connection([
      {
        follower: {
          email: 'cached-requester@example.com',
          id: 'cached-requester-id',
          privacyMode: 'PRIVATE',
        },
        id: 'cached-request-id',
        requestedAt: '2026-07-01T00:00:00Z',
        state: 'REQUESTED',
      },
    ]),
  };
}

function emptySocialProfiles() {
  return {
    viewer: {
      followers: connection([]),
      following: connection([]),
      id: 'viewer-id',
    },
    viewerPendingFollowRequests: connection([]),
  };
}

function emptyProfileContent() {
  return {
    node: {
      __typename: 'User',
      id: 'viewer-id',
      posts: connection([]),
      replayFeed: connection([]),
      storyFeed: connection([]),
    },
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

function resolveNetwork(
  resolvers: Map<string, (response: GraphQLResponse) => void>,
  operationName: string,
  data: object,
) {
  const resolve = resolvers.get(operationName);

  if (!resolve) {
    throw new Error(`Missing network resolver for ${operationName}`);
  }

  resolve({ data });
  resolvers.delete(operationName);
}

import { render } from '@testing-library/react-native';

import { LiveDiscoveryScreen } from '../../src/live/discovery/LiveDiscoveryScreen';
import { LiveSessionWatchScreen } from '../../src/live/watch/LiveSessionWatchScreen';

type QueryOptions = {
  readonly fetchKey?: number;
  readonly fetchPolicy?: string;
};

type QueryCall = {
  readonly operationName: string;
  readonly options: QueryOptions;
};

let mockQueryCalls: QueryCall[];

const mockChatChannelLifecycle = {
  getState: () => ({
    channelStatus: 'idle',
    sendError: null,
    sendStatus: 'idle',
    sessionId: null,
  }),
  send: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

const mockOlderTimelinePageLoader = {
  mount: jest.fn(),
  requestOlderPage: jest.fn(),
  syncSession: jest.fn(),
  unmount: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('react-relay', () => ({
  fetchQuery: () => ({ toPromise: () => Promise.resolve(null) }),
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: (
    query: unknown,
    _variables: Record<string, unknown>,
    options: QueryOptions,
  ) => {
    const operationName = mockOperationName(query);
    mockQueryCalls.push({ operationName, options });

    if (operationName === 'LiveDiscoveryScreenQuery') {
      return {
        liveNow: { edges: [] },
        viewer: { currentLiveSession: null },
      };
    }

    return { node: null, viewer: { id: 'viewer-id' } };
  },
  useMutation: () => [jest.fn(), false],
  useRelayEnvironment: () => ({}),
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: jest.fn(),
    state: { status: 'unauthenticated' },
  }),
}));

jest.mock('../../src/host/HostBroadcastPublishingSessionProvider', () => ({
  useHostBroadcastPublishingSessions: () => ({
    controlsFor: () => null,
    has: () => false,
    release: jest.fn(),
  }),
}));

jest.mock('../../src/providers/StartupGate', () => ({
  useStartupState: () => ({ environment: { websocketUrl: 'ws://test' } }),
}));

jest.mock('../../src/live/chat/LiveSessionChatPanel', () => ({
  LiveSessionChatPanel: () => null,
}));

jest.mock(
  '../../src/live/chat/state/liveSessionChatChannelActorLifecycle',
  () => ({
    createLiveSessionChatChannelActorLifecycle: () =>
      mockChatChannelLifecycle,
  }),
);

jest.mock('../../src/live/watch/components/LiveSessionWatchCards', () => ({
  createLiveSessionWatchHostMediaControls: () => null,
  LiveSessionDetailsCard: () => null,
  LiveSessionHero: () => null,
  LiveSessionWatchControlsCard: () => null,
  UnavailableLiveSession: () => null,
}));

jest.mock(
  '../../src/live/watch/components/LiveSessionViewerPlaybackSurface',
  () => ({ LiveSessionViewerPlaybackSurface: () => null }),
);

jest.mock('../../src/live/watch/hooks/useLiveSessionWatchController', () => ({
  createLiveSessionOlderTimelinePageLoader: () =>
    mockOlderTimelinePageLoader,
  useLiveSessionWatchController: () => ({
    handleMembershipLost: jest.fn(),
    handleSessionEnded: jest.fn(),
    hasActiveSubmission: false,
    isEnding: false,
    isJoined: false,
    isJoining: false,
    isLeaving: false,
    requestEnd: jest.fn(),
    requestJoin: jest.fn(),
    requestLeave: jest.fn(),
    watchError: null,
  }),
}));

jest.mock(
  '../../src/live/watch/hooks/useLiveSessionViewerPlaybackController',
  () => ({
    useLiveSessionViewerPlaybackController: () => ({
      retryViewerPlayback: jest.fn(),
      stopViewerPlayback: jest.fn(),
      viewerPlaybackState: { status: 'idle' },
    }),
  }),
);

beforeEach(() => {
  mockQueryCalls = [];
  jest.clearAllMocks();
});

describe('live identity query privacy', () => {
  test('waits for network authorization before rendering live discovery identities', async () => {
    await render(<LiveDiscoveryScreen />);

    expect(queryOptions('LiveDiscoveryScreenQuery')).toEqual({
      fetchKey: 0,
      fetchPolicy: 'network-only',
    });
  });

  test('waits for network authorization before rendering a live session and chat history', async () => {
    await render(<LiveSessionWatchScreen sessionId="session-id" />);

    expect(queryOptions('liveSessionWatchOperationsQuery')).toEqual({
      fetchKey: 0,
      fetchPolicy: 'network-only',
    });
  });
});

function queryOptions(operationName: string): QueryOptions | undefined {
  return mockQueryCalls.find((call) => call.operationName === operationName)
    ?.options;
}

function mockOperationName(operation: unknown): string {
  if (typeof operation === 'string') {
    return operation;
  }

  if (
    operation &&
    typeof operation === 'object' &&
    'params' in operation &&
    operation.params &&
    typeof operation.params === 'object' &&
    'name' in operation.params &&
    typeof operation.params.name === 'string'
  ) {
    return operation.params.name;
  }

  return '';
}

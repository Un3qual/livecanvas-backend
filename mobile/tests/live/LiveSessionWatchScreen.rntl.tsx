import {
  act,
  render,
  waitFor,
} from '@testing-library/react-native';

import { LiveSessionWatchScreen } from '../../src/live/watch/LiveSessionWatchScreen';
import type { LiveSessionChatMessageControls } from '../../src/live/chat/LiveSessionChatPanel';
import type {
  LiveSessionChatControlsController,
  LiveSessionChatTimelineMutationAction,
} from '../../src/live/chat/useLiveSessionChatControls';

type ChatControlsInput = {
  readonly dispatchTimeline: (
    action: LiveSessionChatTimelineMutationAction,
  ) => void;
  readonly hostId: string | null;
  readonly sessionStatus: string | null;
  readonly viewerId: string | null;
};

type ChatPanelProps = {
  readonly messageControls?: LiveSessionChatMessageControls;
  readonly rows: ReadonlyArray<{
    readonly body?: string;
    readonly id: string;
  }>;
};

let mockChatControlsInput: ChatControlsInput | null;
let mockChatPanelProps: ChatPanelProps | null;
let mockSessionStatus: 'ENDED' | 'LIVE';
let mockQueryData: ReturnType<typeof createQueryData>;

const mockControlsController: LiveSessionChatControlsController = {
  clearRowError: jest.fn(),
  controlsState: {
    errorsByEventId: {},
    pendingByEventId: {},
    removedEventIds: {},
  },
  editMessage: jest.fn(),
  removeMessage: jest.fn(),
};

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
  useLazyLoadQuery: () => mockQueryData,
  useMutation: () => [jest.fn(), false],
  useRelayEnvironment: () => ({}),
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: jest.fn(),
    state: { status: 'authenticated' },
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

jest.mock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { background: '#ffffff' } }),
}));

jest.mock('../../src/live/chat/LiveSessionChatPanel', () => ({
  LiveSessionChatPanel: (props: ChatPanelProps) => {
    mockChatPanelProps = props;
    return null;
  },
}));

jest.mock('../../src/live/chat/useLiveSessionChatControls', () => ({
  useLiveSessionChatControls: (input: ChatControlsInput) => {
    mockChatControlsInput = input;
    return mockControlsController;
  },
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
    error: null,
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
  mockChatControlsInput = null;
  mockChatPanelProps = null;
  mockSessionStatus = 'LIVE';
  mockQueryData = createQueryData(mockSessionStatus);
  jest.clearAllMocks();
});

describe('LiveSessionWatchScreen chat control wiring', () => {
  test('passes opaque identities and reconciles confirmed mutations into panel rows', async () => {
    await render(<LiveSessionWatchScreen sessionId="session-1" />);

    await waitFor(() => {
      expect(mockChatPanelProps?.rows).toHaveLength(1);
    });
    expect(mockChatControlsInput).toMatchObject({
      hostId: 'host-1',
      sessionStatus: 'LIVE',
      viewerId: 'viewer-1',
    });
    expect(mockChatPanelProps?.messageControls).toMatchObject({
      ...mockControlsController,
      hostId: 'host-1',
      sessionStatus: 'LIVE',
      viewerId: 'viewer-1',
    });

    await act(async () => {
      mockChatControlsInput?.dispatchTimeline({
        event: {
          actor: { id: 'viewer-1' },
          body: 'edited',
          editCount: 1,
          edited: true,
          editedAt: '2026-07-11T12:02:00Z',
          id: 'event-1',
        },
        type: 'mutation_update_confirmed',
      });
    });
    await waitFor(() => {
      expect(mockChatPanelProps?.rows[0]?.body).toBe('edited');
    });

    await act(async () => {
      mockChatControlsInput?.dispatchTimeline({
        eventId: 'event-1',
        type: 'mutation_remove_confirmed',
      });
    });
    await waitFor(() => {
      expect(mockChatPanelProps?.rows).toEqual([]);
    });
  });

  test('passes ended status so the panel removes edit and removal affordances', async () => {
    mockSessionStatus = 'ENDED';
    mockQueryData = createQueryData(mockSessionStatus);
    await render(<LiveSessionWatchScreen sessionId="session-1" />);

    expect(mockChatControlsInput).toMatchObject({
      sessionStatus: 'ENDED',
    });
    expect(mockChatPanelProps?.messageControls).toMatchObject({
      sessionStatus: 'ENDED',
    });
  });
});

function createQueryData(status: 'ENDED' | 'LIVE') {
  return {
    node: {
      __typename: 'LiveSession' as const,
      channelTopic: 'live_session:1',
      endedAt: status === 'ENDED' ? '2026-07-11T13:00:00Z' : null,
      host: { email: 'host@example.test', id: 'host-1' },
      id: 'session-1',
      insertedAt: '2026-07-11T12:00:00Z',
      recordingMediaAsset: null,
      startedAt: '2026-07-11T12:00:00Z',
      status,
      timelineEvents: {
        edges: [
          {
            cursor: 'cursor-1',
            node: {
              __typename: 'ChatMessageEvent' as const,
              actor: { id: 'viewer-1' },
              body: 'original',
              editCount: 0,
              edited: false,
              editedAt: null,
              eventType: 'CHAT_MESSAGE_SENT',
              id: 'event-1',
              occurredAt: '2026-07-11T12:01:00Z',
            },
          },
        ],
        pageInfo: {
          endCursor: 'cursor-1',
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 'cursor-1',
        },
      },
      visibility: 'PUBLIC' as const,
    },
    viewer: { id: 'viewer-1' },
  };
}

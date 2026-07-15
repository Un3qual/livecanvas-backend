import {
  act,
  render,
  screen,
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
let mockIsJoined: boolean;
let mockAppState: { isActive: boolean; resumeGeneration: number };
let mockPlaybackControllerInputs: Array<{
  isAppActive: boolean;
  isJoined: boolean;
}>;
let mockResumeFetches: unknown[][];
let mockSessionStateCallbacks: Array<
  (event: { status: 'ENDED' | 'LIVE'; viewerCount: number }) => void
>;
let mockChannelJoinResolvers: Array<
  (result: {
    sessionState: {
      kind: 'session_state';
      status: 'ENDED' | 'LIVE';
      viewerCount: number;
      visibility: 'PUBLIC';
    } | null;
    status: 'joined';
  }) => void
>;

const mockControlsController: LiveSessionChatControlsController = {
  clearRowError: jest.fn(),
  controlsState: {
    errorsByEventId: {},
    failedActionByEventId: {},
    pendingByEventId: {},
    removedEventIds: {},
  },
  editMessage: jest.fn(),
  removeMessage: jest.fn(),
};

const mockOlderTimelinePageLoader = {
  mount: jest.fn(),
  requestOlderPage: jest.fn(),
  syncSession: jest.fn(),
  unmount: jest.fn(),
};
const mockGetAccessToken = jest.fn();
const mockRelayEnvironment = {};
const mockHostPublishingSessions = {
  controlsFor: jest.fn(() => null),
  has: jest.fn(() => false),
  release: jest.fn(),
};
const mockWatchControllerFunctions = {
  handleMembershipLost: jest.fn(),
  handleSessionEnded: jest.fn(),
  requestEnd: jest.fn(),
  requestJoin: jest.fn(),
  requestLeave: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

jest.mock('react-relay', () => ({
  fetchQuery: (...args: unknown[]) => {
    mockResumeFetches.push(args);

    return {
      subscribe: () => ({ unsubscribe: jest.fn() }),
      toPromise: () => Promise.resolve(null),
    };
  },
  graphql: jest.fn((query: TemplateStringsArray) => query.join('')),
  useLazyLoadQuery: () => mockQueryData,
  useMutation: () => [jest.fn(), false],
  useRelayEnvironment: () => mockRelayEnvironment,
}));

jest.mock('../../src/live/watch/liveSessionAppState', () => ({
  useLiveSessionAppState: () => mockAppState,
}));

jest.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    state: { status: 'authenticated' },
  }),
}));

jest.mock('../../src/host/HostBroadcastPublishingSessionProvider', () => ({
  useHostBroadcastPublishingSessions: () => mockHostPublishingSessions,
}));

jest.mock('../../src/providers/StartupGate', () => ({
  useStartupState: () => ({ environment: { websocketUrl: 'ws://test' } }),
}));

jest.mock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: '#3366ff',
      background: '#ffffff',
      border: '#cccccc',
      surface: '#ffffff',
      surfaceMuted: '#eeeeee',
      text: '#111111',
      textMuted: '#666666',
    },
  }),
}));

jest.mock('../../src/realtime/phoenixSocket', () => ({
  createPhoenixSocket: () => ({
    channel: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock('../../src/live/liveSessionChannelClient', () => {
  const actual = jest.requireActual(
    '../../src/live/liveSessionChannelClient',
  );

  return {
    ...actual,
    createLiveSessionChannelClient: (options: {
      onSessionState: (
        event: { status: 'ENDED' | 'LIVE'; viewerCount: number },
      ) => void;
    }) => {
      mockSessionStateCallbacks.push(options.onSessionState);

      return {
        join: () =>
          new Promise<{
            sessionState: {
              kind: 'session_state';
              status: 'ENDED' | 'LIVE';
              viewerCount: number;
              visibility: 'PUBLIC';
            } | null;
            status: 'joined';
          }>((resolve) => {
            mockChannelJoinResolvers.push(resolve);
          }),
        leave: jest.fn(),
        sendChatMessage: jest.fn(),
      };
    },
  };
});

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

jest.mock('../../src/live/watch/components/LiveSessionWatchCards', () => {
  const actual = jest.requireActual(
    '../../src/live/watch/components/LiveSessionWatchCards',
  );

  return {
    ...actual,
    createLiveSessionWatchHostMediaControls: () => null,
    LiveSessionDetailsCard: () => null,
    LiveSessionWatchControlsCard: () => null,
    UnavailableLiveSession: () => null,
  };
});

jest.mock(
  '../../src/live/watch/components/LiveSessionViewerPlaybackSurface',
  () => ({ LiveSessionViewerPlaybackSurface: () => null }),
);

jest.mock('../../src/live/watch/hooks/useLiveSessionWatchController', () => ({
  createLiveSessionOlderTimelinePageLoader: () =>
    mockOlderTimelinePageLoader,
  useLiveSessionWatchController: () => ({
    ...mockWatchControllerFunctions,
    error: null,
    hasActiveSubmission: false,
    isEnding: false,
    isJoined: mockIsJoined,
    isJoining: false,
    isLeaving: false,
  }),
}));

jest.mock(
  '../../src/live/watch/hooks/useLiveSessionViewerPlaybackController',
  () => ({
    useLiveSessionViewerPlaybackController: (input: {
      isAppActive: boolean;
      isJoined: boolean;
    }) => {
      mockPlaybackControllerInputs.push(input);

      return {
        retryViewerPlayback: jest.fn(),
        stopViewerPlayback: jest.fn(),
        viewerPlaybackState: { status: 'idle' },
      };
    },
  }),
);

beforeEach(() => {
  mockChatControlsInput = null;
  mockChatPanelProps = null;
  mockSessionStatus = 'LIVE';
  mockQueryData = createQueryData(mockSessionStatus);
  mockIsJoined = false;
  mockAppState = { isActive: true, resumeGeneration: 0 };
  mockPlaybackControllerInputs = [];
  mockResumeFetches = [];
  mockSessionStateCallbacks = [];
  mockChannelJoinResolvers = [];
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

    await act(() => {
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

    await act(() => {
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

describe('LiveSessionWatchScreen audience count', () => {
  test('seeds the viewer count from the channel join acknowledgement', async () => {
    mockIsJoined = true;
    await render(<LiveSessionWatchScreen sessionId="session-1" />);

    await waitFor(() => {
      expect(mockChannelJoinResolvers).toHaveLength(1);
    });

    await act(() => {
      mockChannelJoinResolvers[0]?.({
        sessionState: {
          kind: 'session_state',
          status: 'LIVE',
          viewerCount: 7,
          visibility: 'PUBLIC',
        },
        status: 'joined',
      });
    });

    expect(screen.getByText('7 viewers')).toBeOnTheScreen();
  });

  test('renders zero, singular, and plural realtime viewer counts', async () => {
    mockIsJoined = true;
    await render(<LiveSessionWatchScreen sessionId="session-1" />);

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(1);
    });

    await act(() => {
      mockSessionStateCallbacks[0]?.({ status: 'LIVE', viewerCount: 0 });
    });
    expect(screen.getByText('0 viewers')).toBeOnTheScreen();

    await act(() => {
      mockSessionStateCallbacks[0]?.({ status: 'LIVE', viewerCount: 1 });
    });
    expect(screen.getByText('1 viewer')).toBeOnTheScreen();

    await act(() => {
      mockSessionStateCallbacks[0]?.({ status: 'LIVE', viewerCount: 12 });
    });
    expect(screen.getByText('12 viewers')).toBeOnTheScreen();
  });

  test('resets viewer count and ignores stale channel callbacks after session change', async () => {
    mockIsJoined = true;
    const view = await render(
      <LiveSessionWatchScreen sessionId="session-1" />,
    );

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(1);
    });
    const staleSessionStateCallback = mockSessionStateCallbacks[0];

    await act(() => {
      staleSessionStateCallback?.({ status: 'LIVE', viewerCount: 8 });
    });
    expect(screen.getByText('8 viewers')).toBeOnTheScreen();

    mockQueryData = createQueryData('LIVE', 'session-2');
    await view.rerender(<LiveSessionWatchScreen sessionId="session-2" />);

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(2);
    });
    expect(screen.queryByText('8 viewers')).toBeNull();

    await act(() => {
      staleSessionStateCallback?.({ status: 'LIVE', viewerCount: 99 });
    });
    expect(screen.queryByText('99 viewers')).toBeNull();

    await act(() => {
      mockSessionStateCallbacks[1]?.({ status: 'LIVE', viewerCount: 2 });
    });
    expect(screen.getByText('2 viewers')).toBeOnTheScreen();
  });
});

describe('LiveSessionWatchScreen app lifecycle recovery', () => {
  test('suspends transient work in background and refetches once on resume without leaving', async () => {
    mockIsJoined = true;
    const view = await render(
      <LiveSessionWatchScreen sessionId="session-1" />,
    );

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(1);
    });
    expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
      isAppActive: true,
    });
    expect(mockResumeFetches).toHaveLength(0);

    mockAppState = { isActive: false, resumeGeneration: 0 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
      isAppActive: false,
    });
    expect(mockWatchControllerFunctions.requestLeave).not.toHaveBeenCalled();

    mockAppState = { isActive: true, resumeGeneration: 1 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(2);
      expect(mockResumeFetches).toHaveLength(1);
    });
    expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
      isAppActive: true,
    });
    expect(mockWatchControllerFunctions.requestLeave).not.toHaveBeenCalled();
  });

  test('drops stale realtime status when a resume generation reads ended server state', async () => {
    mockIsJoined = true;
    const view = await render(
      <LiveSessionWatchScreen sessionId="session-1" />,
    );

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(1);
    });
    await act(() => {
      mockSessionStateCallbacks[0]?.({ status: 'LIVE', viewerCount: 4 });
    });
    expect(mockChatControlsInput).toMatchObject({ sessionStatus: 'LIVE' });

    mockAppState = { isActive: false, resumeGeneration: 0 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    mockQueryData = createQueryData('ENDED');
    mockAppState = { isActive: true, resumeGeneration: 1 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    expect(mockChatControlsInput).toMatchObject({ sessionStatus: 'ENDED' });
    expect(screen.queryByText('4 viewers')).toBeNull();
  });

  test('keeps queried ended status terminal against a same-generation live event', async () => {
    mockIsJoined = true;
    const view = await render(
      <LiveSessionWatchScreen sessionId="session-1" />,
    );

    await waitFor(() => {
      expect(mockSessionStateCallbacks).toHaveLength(1);
    });
    await act(() => {
      mockSessionStateCallbacks[0]?.({ status: 'LIVE', viewerCount: 4 });
    });

    mockQueryData = createQueryData('ENDED');
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    expect(mockChatControlsInput).toMatchObject({ sessionStatus: 'ENDED' });
    expect(screen.queryByText('4 viewers')).toBeNull();
  });

  test('waits for membership rejoin before restarting viewer playback', async () => {
    mockIsJoined = true;
    const view = await render(
      <LiveSessionWatchScreen sessionId="session-1" />,
    );

    await waitFor(() => {
      expect(mockChannelJoinResolvers).toHaveLength(1);
    });
    expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
      isJoined: false,
    });

    await act(() => {
      mockChannelJoinResolvers[0]?.({ sessionState: null, status: 'joined' });
    });
    await waitFor(() => {
      expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
        isJoined: true,
      });
    });

    mockAppState = { isActive: false, resumeGeneration: 0 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    mockAppState = { isActive: true, resumeGeneration: 1 };
    await view.rerender(<LiveSessionWatchScreen sessionId="session-1" />);

    await waitFor(() => {
      expect(mockChannelJoinResolvers).toHaveLength(2);
    });
    expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
      isJoined: false,
    });

    await act(() => {
      mockChannelJoinResolvers[1]?.({ sessionState: null, status: 'joined' });
    });
    await waitFor(() => {
      expect(mockPlaybackControllerInputs.at(-1)).toMatchObject({
        isJoined: true,
      });
    });
  });
});

function createQueryData(
  status: 'ENDED' | 'LIVE',
  sessionId = 'session-1',
) {
  return {
    node: {
      __typename: 'LiveSession' as const,
      channelTopic: `live_session:${sessionId}`,
      endedAt: status === 'ENDED' ? '2026-07-11T13:00:00Z' : null,
      host: { email: 'host@example.test', id: 'host-1' },
      id: sessionId,
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

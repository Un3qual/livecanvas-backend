import { describe, expect, mock, test } from 'bun:test';
import {
  Fragment,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  createLiveSessionChatPanelModel,
  formatLiveSessionChatPanelRow,
} from '../../src/live/chat/liveSessionChatPanelPresentation';
import { createLiveSessionChatControlsState } from '../../src/live/chat/liveSessionChatControlsState';
import type { LiveSessionTimelineHistoryRow } from '../../src/live/liveSessionTimelineHistory';

function NativeComponent({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement('NativeComponent', props, children);
}

function FlatListMock(props: { [key: string]: unknown }) {
  return createElement('FlatList', props);
}

mock.module('react-native', () => ({
  FlatList: FlatListMock,
  Pressable: NativeComponent,
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
  },
  Text: function Text({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) {
    return createElement('Text', props, children);
  },
  TextInput: NativeComponent,
  View: NativeComponent,
}));

mock.module('../../src/components/AppButton', () => ({
  AppButton: ({
    disabled,
    label,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
  }) =>
    createElement(
      'Pressable',
      { accessibilityRole: 'button', disabled: disabled ?? false, onPress },
      label,
    ),
}));

mock.module('../../src/components/AppCard', () => ({
  AppCard: ({ children }: { children?: ReactNode }) =>
    createElement('View', null, children),
}));

mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: 'accent',
      accentText: 'accentText',
      background: 'background',
      border: 'border',
      error: 'error',
      surface: 'surface',
      surfaceMuted: 'surfaceMuted',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));

mock.module('../../src/theme/tokens', () => ({
  radius: { lg: 24, md: 14, pill: 999, sm: 8 },
  spacing: { lg: 16, md: 12, sm: 8, xs: 4 },
  touchTarget: { min: 44 },
  typography: { body: {}, label: {} },
}));

const { LiveSessionChatPanel } = await import(
  '../../src/live/chat/LiveSessionChatPanel'
);

type ReactRuntimeWithClientInternals = typeof import('react') & {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
    H: unknown;
  };
};

const reactInternals = (
  (await import('react')) as unknown as ReactRuntimeWithClientInternals
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as {
  H: unknown;
};

describe('LiveSessionChatPanel presentation model', () => {
  test('derives row controls only for active chat rows with the right identities', () => {
    const controlsState = createLiveSessionChatControlsState();
    const authored = chatRow({ actor: { id: 'viewer-1' }, id: 'authored' });
    const other = chatRow({ actor: { id: 'viewer-2' }, id: 'other' });

    expect(
      formatLiveSessionChatPanelRow(authored, {
        controlsState,
        hostId: 'viewer-2',
        sessionStatus: 'LIVE',
        viewerId: 'viewer-1',
      }),
    ).toMatchObject({ canEdit: true, canRemove: false, isPending: false });
    expect(
      formatLiveSessionChatPanelRow(other, {
        controlsState,
        hostId: 'viewer-1',
        sessionStatus: 'LIVE',
        viewerId: 'viewer-1',
      }),
    ).toMatchObject({ canEdit: false, canRemove: true, isPending: false });
    expect(
      formatLiveSessionChatPanelRow(authored, {
        controlsState,
        hostId: 'viewer-1',
        sessionStatus: 'ENDED',
        viewerId: 'viewer-1',
      }),
    ).toMatchObject({ canEdit: false, canRemove: false });
    expect(
      formatLiveSessionChatPanelRow(
        lifecycleRow({ actor: { id: 'viewer-1' }, id: 'lifecycle' }),
        {
          controlsState,
          hostId: 'viewer-1',
          sessionStatus: 'LIVE',
          viewerId: 'viewer-1',
        },
      ),
    ).toMatchObject({ canEdit: false, canRemove: false });
  });

  test('keeps retained chat, lifecycle, and future timeline rows available for lazy rendering', () => {
    const rows = [
      chatRow({
        body: 'Retained hello',
        edited: true,
        editCount: 2,
        id: 'event-chat-1',
      }),
      lifecycleRow({
        id: 'event-started-1',
        label: 'Live started',
      }),
      unknownRow({
        id: 'event-future-1',
        label: 'Timeline event',
      }),
    ];
    const model = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows,
      canLoadOlder: false,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(model.emptyStateMessage).toBeNull();
    expect(model.rows).toBe(rows);
  });

  test('disables the composer until the viewer is joined and the channel is joined', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'idle',
        draftMessage: 'hello',
        isJoined: false,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Join the live session to use chat.',
      composerDisabled: true,
      sendButtonDisabled: true,
      sendButtonLabel: 'Send',
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joining',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Joining chat...',
      composerDisabled: true,
      sendButtonDisabled: true,
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Chat connected.',
      composerDisabled: false,
      sendButtonDisabled: false,
    });
  });

  test('shows pending send state and viewer-safe send errors', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'sending',
      }),
    ).toMatchObject({
      composerDisabled: true,
      sendButtonDisabled: true,
      sendButtonLabel: 'Sending...',
    });

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'errored',
        draftMessage: 'hello',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: 'Message is too long.',
        sendStatus: 'failed',
      }),
    ).toMatchObject({
      channelStatusLabel: 'Chat connection failed.',
      sendError: 'Message is too long.',
    });
  });

  test('prevents blank message sends while allowing trimmed drafts', () => {
    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: '   ',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }).sendButtonDisabled,
    ).toBe(true);

    expect(
      createLiveSessionChatPanelModel({
        channelStatus: 'joined',
        draftMessage: '  hello chat  ',
        isJoined: true,
        rows: [],
        canLoadOlder: false,
        isLoadingOlder: false,
        olderLoadError: null,
        sendError: null,
        sendStatus: 'idle',
      }).sendButtonDisabled,
    ).toBe(false);
  });

  test('keeps all explicitly loaded retained rows available after older pagination', () => {
    const rows = Array.from({ length: 65 }, (_, index) =>
      chatRow({
        body: `message-${index}`,
        id: `event-chat-${index}`,
      }),
    );
    const model = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: '',
      isJoined: true,
      rows,
      canLoadOlder: false,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(model.rows).toHaveLength(65);
    expect(model.rows[0].id).toBe('event-chat-0');
    expect(model.rows.at(-1)?.id).toBe('event-chat-64');
  });

  test('exposes older retained history loading state separately from composer state', () => {
    const loadable = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows: [chatRow({ id: 'event-chat-1' })],
      canLoadOlder: true,
      isLoadingOlder: false,
      olderLoadError: null,
      sendError: null,
      sendStatus: 'idle',
    });

    expect(loadable).toMatchObject({
      canLoadOlder: true,
      olderLoadButtonDisabled: false,
      olderLoadButtonLabel: 'Load older messages',
      olderLoadError: null,
      sendButtonDisabled: false,
    });

    const loading = createLiveSessionChatPanelModel({
      channelStatus: 'joined',
      draftMessage: 'hello',
      isJoined: true,
      rows: [chatRow({ id: 'event-chat-1' })],
      canLoadOlder: true,
      isLoadingOlder: true,
      olderLoadError:
        'We could not load older messages. Check your connection and try again.',
      sendError: null,
      sendStatus: 'idle',
    });

    expect(loading).toMatchObject({
      canLoadOlder: true,
      olderLoadButtonDisabled: true,
      olderLoadButtonLabel: 'Loading older messages...',
      olderLoadError:
        'We could not load older messages. Check your connection and try again.',
      sendButtonDisabled: false,
    });
  });
});

describe('LiveSessionChatPanel timeline rendering', () => {
  test('uses a virtualized list for retained and paginated timeline rows', () => {
    const rows = Array.from({ length: 65 }, (_, index) =>
      chatRow({
        body: `message-${index}`,
        edited: index === 0,
        id: `event-chat-${index}`,
      }),
    );

    const tree = renderPanel({ rows });
    const list = findNodeByType(tree, 'FlatList');

    expect(list).not.toBeNull();
    expect(list?.props.data).toBe(rows);
    expect(
      (list?.props.keyExtractor as (row: LiveSessionTimelineHistoryRow) => string)(
        rows[64],
      ),
    ).toBe('event-chat-64');

    const rowTree = renderPanelNode(
      (list?.props.renderItem as (info: {
        item: LiveSessionTimelineHistoryRow;
      }) => ReactNode)({ item: rows[0] }),
    );

    expect(collectText(rowTree)).toEqual(['Edited', 'message-0']);
  });
});

function chatRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'chat_message' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'chat_message' }> {
  return {
    __typename: 'ChatMessageEvent',
    actor: { id: 'actor-1' },
    body: 'hello',
    cursor: 'cursor-chat',
    editCount: 0,
    edited: false,
    editedAt: null,
    eventType: 'chat_message',
    id: 'event-chat',
    kind: 'chat_message',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}

type RenderedNode = {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: ReadonlyArray<RenderedTree>;
};

type RenderedTree = RenderedNode | string;

function renderPanel({
  rows,
}: {
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>;
}): ReadonlyArray<RenderedTree> {
  return withHookDispatcher(() =>
    renderPanelNode(
      createElement(LiveSessionChatPanel, {
        canLoadOlder: true,
        channelStatus: 'joined',
        isJoined: true,
        isLoadingOlder: false,
        olderLoadError: null,
        onLoadOlder: () => undefined,
        onSendMessage: () => Promise.resolve(true),
        rows,
        sendError: null,
        sendStatus: 'idle',
      }),
    ),
  );
}

function withHookDispatcher<ReturnValue>(
  render: () => ReturnValue,
): ReturnValue {
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
    useEffect(effect: () => (() => void) | undefined): void {
      effect();
    },
    useState<State>(
      initialState: State,
    ): [State, (nextState: State) => void] {
      return [initialState, () => undefined];
    },
  };

  try {
    return render();
  } finally {
    reactInternals.H = previousDispatcher;
  }
}

function renderPanelNode(node: ReactNode): ReadonlyArray<RenderedTree> {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => renderPanelNode(child));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const element = node as ReactElement<{
    children?: ReactNode;
    [key: string]: unknown;
  }>;

  if (element.type === Fragment) {
    return renderPanelNode(element.props.children);
  }

  if (typeof element.type === 'function') {
    const renderFunction = element.type as (
      props: typeof element.props,
    ) => ReactNode;
    return renderPanelNode(renderFunction(element.props));
  }

  return [
    {
      type: String(element.type),
      props: element.props,
      children: renderPanelNode(element.props.children),
    },
  ];
}

function findNodeByType(
  tree: ReadonlyArray<RenderedTree>,
  type: string,
): RenderedNode | null {
  for (const node of tree) {
    if (typeof node === 'string') {
      continue;
    }

    if (node.type === type) {
      return node;
    }

    const childMatch = findNodeByType(node.children, type);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function collectText(tree: ReadonlyArray<RenderedTree>): ReadonlyArray<string> {
  return tree.flatMap((node) => {
    if (typeof node === 'string') {
      return [node];
    }

    return collectText(node.children);
  });
}

function lifecycleRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'lifecycle' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'lifecycle' }> {
  return {
    __typename: 'LiveSessionStartedEvent',
    actor: null,
    cursor: 'cursor-started',
    eventType: 'live_session_started',
    id: 'event-started',
    kind: 'lifecycle',
    label: 'Live started',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}

function unknownRow(
  overrides: Partial<Extract<LiveSessionTimelineHistoryRow, { kind: 'unknown' }>>,
): Extract<LiveSessionTimelineHistoryRow, { kind: 'unknown' }> {
  return {
    __typename: 'FutureEvent',
    actor: null,
    cursor: 'cursor-future',
    eventType: 'future_event',
    id: 'event-future',
    kind: 'unknown',
    label: 'Timeline event',
    occurredAt: '2026-06-04T12:00:00Z',
    ...overrides,
  };
}

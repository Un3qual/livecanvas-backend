import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

type LinkingMock = {
  canOpenURL: ReturnType<typeof mock>;
  getInitialURL: ReturnType<typeof mock>;
  openURL: ReturnType<typeof mock>;
};

const linkingMock: LinkingMock = {
  canOpenURL: mock(() => Promise.resolve(false)),
  getInitialURL: mock(() => Promise.resolve(null)),
  openURL: mock(() => Promise.resolve()),
};

function NativeComponent({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement('NativeComponent', props, children);
}

mock.module('react-native', () => ({
  ActivityIndicator: NativeComponent,
  FlatList: NativeComponent,
  Linking: linkingMock,
  Platform: {
    OS: 'ios',
  },
  Pressable: function Pressable({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) {
    return createElement('Pressable', props, children);
  },
  StyleSheet: {
    create: <Styles,>(styles: Styles): Styles => styles,
  },
  ScrollView: NativeComponent,
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

mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      accent: 'accent',
      accentText: 'accentText',
      background: 'background',
      border: 'border',
      error: 'error',
      errorMuted: 'errorMuted',
      surface: 'surface',
      surfaceMuted: 'surfaceMuted',
      text: 'text',
      textMuted: 'textMuted',
    },
  }),
}));

mock.module('../../src/theme/tokens', () => ({
  colors: {},
  radius: {
    lg: 24,
    md: 14,
    pill: 999,
    sm: 8,
  },
  spacing: {
    lg: 24,
    md: 16,
    sm: 8,
    xs: 4,
  },
  touchTarget: {
    min: 44,
  },
  typography: {
    body: {},
    label: {},
  },
}));

const { LiveSessionDetailsCard, openLiveSessionRecordingUrl } = await import(
  '../../src/live/watch/components/LiveSessionWatchCards'
);

import type { LiveSessionNode } from '../../src/live/watch/liveSessionWatchScreenTypes';

type RenderedNode = {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: ReadonlyArray<RenderedTree>;
};

type RenderedTree = RenderedNode | string;

const reactInternals = (
  await import('react')
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as {
  H: unknown;
};

describe('LiveSessionWatchCards recording metadata', () => {
  beforeEach(() => {
    linkingMock.canOpenURL = mock(() => Promise.resolve(false));
    linkingMock.getInitialURL = mock(() => Promise.resolve(null));
    linkingMock.openURL = mock(() => Promise.resolve());
  });

  test('omits the recording section when the session has no recording asset', () => {
    const renderer = createRenderer();
    const tree = renderer.render(
      <LiveSessionDetailsCard
        normalizedStatus="ENDED"
        session={sessionWithRecording(null)}
        status={{ label: 'Ended', tone: 'ended' }}
      />,
    );
    const text = collectText(tree);

    expect(text).toContain('Session details');
    expect(text).toContain('Status');
    expect(text).toContain('Ended');
    expect(text).toContain('Visibility');
    expect(text).toContain('Public');
    expect(text).toContain('Timing');
    expect(text).toContain('Ended Jun 1, 2026');
    expect(text).not.toContain('Recording');
  });

  test('renders processed, processing, failed, and unavailable recording states', () => {
    const cases: ReadonlyArray<{
      readonly processingState: string;
      readonly publicUrl?: string | null;
      readonly expectedBody: string;
      readonly expectedStatus: string;
      readonly hasOpenAction: boolean;
    }> = [
      {
        processingState: 'PROCESSED',
        publicUrl: 'https://media.example.test/replay/session-1.m3u8',
        expectedStatus: 'Replay ready',
        expectedBody: 'This session recording is ready to watch.',
        hasOpenAction: true,
      },
      {
        processingState: 'PENDING_UPLOAD',
        publicUrl: null,
        expectedStatus: 'Recording processing',
        expectedBody: 'The recording is still being prepared. Check back soon.',
        hasOpenAction: false,
      },
      {
        processingState: 'UPLOADED',
        publicUrl: null,
        expectedStatus: 'Recording processing',
        expectedBody: 'The recording is still being prepared. Check back soon.',
        hasOpenAction: false,
      },
      {
        processingState: 'FAILED',
        publicUrl: null,
        expectedStatus: 'Recording failed',
        expectedBody: 'The recording could not be processed.',
        hasOpenAction: false,
      },
      {
        processingState: '%future added value',
        publicUrl: null,
        expectedStatus: 'Recording unavailable',
        expectedBody: 'The replay is not available yet.',
        hasOpenAction: false,
      },
    ];

    for (const recordingCase of cases) {
      const renderer = createRenderer();
      const tree = renderer.render(
        <LiveSessionDetailsCard
          normalizedStatus="ENDED"
          session={sessionWithRecording({
            id: 'recording-1',
            processingState: recordingCase.processingState,
            publicUrl: recordingCase.publicUrl,
          })}
          status={{ label: 'Ended', tone: 'ended' }}
        />,
      );
      const text = collectText(tree);

      expect(text).toContain('Recording');
      expect(text).toContain(recordingCase.expectedStatus);
      expect(text).toContain(recordingCase.expectedBody);

      if (recordingCase.publicUrl) {
        expect(text).not.toContain(recordingCase.publicUrl);
      }

      const openRecordingButton = findPressableByText(tree, 'Open recording');

      if (recordingCase.hasOpenAction) {
        expect(openRecordingButton).not.toBeNull();
        expect(openRecordingButton?.props.disabled).toBe(false);
      } else {
        expect(openRecordingButton).toBeNull();
      }
    }
  });

  test('does not render an open action for blank or malformed processed recording URLs', () => {
    const rejectedUrls = ['   ', 'not a url'];

    for (const publicUrl of rejectedUrls) {
      const renderer = createRenderer();
      const tree = renderer.render(
        <LiveSessionDetailsCard
          normalizedStatus="ENDED"
          session={sessionWithRecording({
            id: 'recording-1',
            processingState: 'PROCESSED',
            publicUrl,
          })}
          status={{ label: 'Ended', tone: 'ended' }}
        />,
      );

      expect(collectText(tree)).toContain('Recording unavailable');
      expect(findPressableByText(tree, 'Open recording')).toBeNull();
    }

    expect(linkingMock.canOpenURL).not.toHaveBeenCalled();
    expect(linkingMock.openURL).not.toHaveBeenCalled();
  });

  test('opens processed recording URLs and renders a retryable failure message', async () => {
    linkingMock.openURL = mock(() =>
      Promise.reject(new Error('browser unavailable')),
    );

    const renderer = createRenderer();
    const props = {
      normalizedStatus: 'ENDED' as const,
      session: sessionWithRecording({
        id: 'recording-1',
        processingState: 'PROCESSED',
        publicUrl: 'https://media.example.test/replay/session-1.m3u8',
      }),
      status: { label: 'Ended', tone: 'ended' as const },
    };

    let tree = renderer.render(<LiveSessionDetailsCard {...props} />);
    const openRecordingButton = findPressableByText(tree, 'Open recording');

    expect(openRecordingButton).not.toBeNull();
    expect(openRecordingButton?.props.disabled).toBe(false);

    const onPress = openRecordingButton?.props.onPress;
    expect(typeof onPress).toBe('function');
    (onPress as () => void)();
    await flushPromises();

    expect(linkingMock.openURL).toHaveBeenCalledWith(
      'https://media.example.test/replay/session-1.m3u8',
    );

    tree = renderer.render(<LiveSessionDetailsCard {...props} />);

    expect(collectText(tree)).toContain(
      'We could not open this recording. Try again in a moment.',
    );
    expect(findPressableByText(tree, 'Open recording')?.props.disabled).toBe(
      false,
    );
  });

  test('opens custom schemes only when the platform reports support', async () => {
    linkingMock.canOpenURL = mock(() => Promise.resolve(false));

    await expect(
      openLiveSessionRecordingUrl('livecanvas://recording/1'),
    ).rejects.toThrow('Unsupported recording URL');
    expect(linkingMock.openURL).not.toHaveBeenCalled();

    linkingMock.canOpenURL = mock(() => Promise.resolve(true));

    await openLiveSessionRecordingUrl('livecanvas://recording/1');

    expect(linkingMock.canOpenURL).toHaveBeenCalledWith(
      'livecanvas://recording/1',
    );
    expect(linkingMock.openURL).toHaveBeenCalledWith(
      'livecanvas://recording/1',
    );
  });

  test('rejects blank or malformed recording URLs without calling Linking', async () => {
    for (const publicUrl of ['   ', 'not a url']) {
      await expect(openLiveSessionRecordingUrl(publicUrl)).rejects.toThrow(
        'Unsupported recording URL',
      );
    }

    expect(linkingMock.canOpenURL).not.toHaveBeenCalled();
    expect(linkingMock.openURL).not.toHaveBeenCalled();
  });
});

function sessionWithRecording(
  recordingMediaAsset: LiveSessionNode['recordingMediaAsset'],
): LiveSessionNode {
  return {
    __typename: 'LiveSession',
    channelTopic: 'session:1',
    endedAt: '2026-06-01T17:10:00Z',
    host: {
      email: 'host@example.test',
      id: 'host-1',
    },
    id: 'session-1',
    insertedAt: '2026-06-01T16:00:00Z',
    recordingMediaAsset,
    startedAt: '2026-06-01T16:04:00Z',
    status: 'ENDED',
    timelineEvents: {
      edges: [],
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
      },
    },
    visibility: 'PUBLIC',
  };
}

function createRenderer() {
  // Temporary test renderer: the component under test only uses useState, so
  // this narrow dispatcher shim avoids installing a full React Native renderer.
  const previousDispatcher = reactInternals.H;
  const states: unknown[] = [];

  return {
    render(node: ReactNode): ReadonlyArray<RenderedTree> {
      let stateIndex = 0;

      reactInternals.H = {
        useState<State>(initialState: State): [State, (nextState: State) => void] {
          const currentIndex = stateIndex;

          if (states.length === currentIndex) {
            states.push(initialState);
          }

          stateIndex += 1;

          return [
            states[currentIndex] as State,
            (nextState: State) => {
              states[currentIndex] = nextState;
            },
          ];
        },
      };

      try {
        return renderNode(node);
      } finally {
        reactInternals.H = previousDispatcher;
      }
    },
  };
}

function renderNode(node: ReactNode): ReadonlyArray<RenderedTree> {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return [String(node)];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => renderNode(child));
  }

  if (!isValidElement(node)) {
    return [];
  }

  const element = node as ReactElement<{
    children?: ReactNode;
    [key: string]: unknown;
  }>;

  if (typeof element.type === 'function') {
    return renderNode(element.type(element.props));
  }

  return [
    {
      type: String(element.type),
      props: element.props,
      children: renderNode(element.props.children),
    },
  ];
}

function collectText(tree: ReadonlyArray<RenderedTree>): ReadonlyArray<string> {
  return tree.flatMap((node) => {
    if (typeof node === 'string') {
      return [node];
    }

    return collectText(node.children);
  });
}

function findPressableByText(
  tree: ReadonlyArray<RenderedTree>,
  text: string,
): RenderedNode | null {
  for (const node of tree) {
    if (typeof node === 'string') {
      continue;
    }

    if (node.type === 'Pressable' && collectText(node.children).includes(text)) {
      return node;
    }

    const childMatch = findPressableByText(node.children, text);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

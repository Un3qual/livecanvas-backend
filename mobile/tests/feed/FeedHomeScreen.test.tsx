import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  Fragment,
  Suspense,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

type HostNode = {
  children: RenderedTree[];
  props: Record<string, unknown>;
  type: string;
};

type RenderedTree = HostNode | string | null | readonly RenderedTree[];

type FeedHomeQueryData = {
  readonly homeFeed: Connection<PostNode> | null;
  readonly liveNow: Connection<LiveSessionNode> | null;
  readonly replayFeed: Connection<LiveSessionNode> | null;
  readonly storyFeed: Connection<PostNode> | null;
  readonly viewer: {
    readonly currentLiveSession: LiveSessionNode | null;
    readonly id: string;
  } | null;
};

type Connection<Node> = {
  readonly edges: ReadonlyArray<{ readonly node: Node | null } | null>;
  readonly pageInfo?: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
};

type PostNode = {
  readonly author: {
    readonly email: string | null;
    readonly id: string;
  };
  readonly bodyText: string | null;
  readonly expiresAt: string | null;
  readonly id: string;
  readonly insertedAt: string;
  readonly kind: string;
  readonly mediaAssets: ReadonlyArray<{
    readonly id: string;
    readonly mimeType: string;
    readonly processingState: string;
    readonly publicUrl: string | null;
  }>;
  readonly visibility: string;
};

type LiveSessionNode = {
  readonly channelTopic: string | null;
  readonly endedAt: string | null;
  readonly host: {
    readonly email: string | null;
    readonly id: string;
  };
  readonly id: string;
  readonly insertedAt: string;
  readonly startedAt: string | null;
  readonly status: string;
  readonly visibility: string;
};

type QueryVariables = Record<string, unknown>;

type FetchQueryCall = { readonly variables: QueryVariables };

type ReportPostMutationConfig = {
  readonly variables: {
    readonly input: {
      readonly details: string | null;
      readonly postId: string;
      readonly reason: string;
    };
  };
  readonly onCompleted?: (payload: {
    readonly reportPost: {
      readonly errors: ReadonlyArray<{
        readonly field: string | null;
        readonly message: string;
      }>;
      readonly report: {
        readonly id: string;
        readonly insertedAt: string;
        readonly postId: string;
        readonly reason: string;
        readonly status: string;
      } | null;
    } | null;
  }) => void;
  readonly onError?: (error: Error) => void;
};

type HookDispatcher = {
  useReducer: <State, Action>(
    reducer: (state: State, action: Action) => State,
    initialArg: State,
  ) => [State, (action: Action) => void];
  useRef: <Value>(initialValue: Value) => { current: Value };
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};

let queryData: FeedHomeQueryData;
let queryVariables: QueryVariables | null;
let fetchQueryCalls: FetchQueryCall[];
let fetchQueryResult: FeedHomeQueryData;
let mutationCommits: ReportPostMutationConfig[];
let pushedRoutes: unknown[];
let hookIndex = 0;
let hookStates: unknown[] = [];

// This focused renderer replaces React's hook dispatcher. It only supports
// useState, useReducer, and useRef, each consuming the next state slot in order.
const reactInternals = (
  await import('react')
).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as {
  H: HookDispatcher | null;
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

function AppButtonMock({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return createElement(
    'Pressable',
    { accessibilityRole: 'button', disabled: disabled ?? false, onPress },
    label,
  );
}

function AppCardMock({ children }: { children?: ReactNode }) {
  return createElement('View', null, children);
}

function AppHeaderMock({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow?: string;
  subtitle?: string;
  title: string;
}) {
  return createElement('View', null, eyebrow, title, subtitle);
}

function ScreenStateMock({
  message,
  onRetry,
  state,
}: {
  message: string;
  onRetry?: () => void;
  state: string;
}) {
  return createElement(
    'View',
    null,
    state,
    message,
    onRetry
      ? createElement(
          'Pressable',
          { accessibilityRole: 'button', onPress: onRetry },
          'Retry',
        )
      : null,
  );
}

function LiveSessionSummaryCardMock({
  buttonLabel,
  onPress,
  session,
}: {
  buttonLabel: string;
  onPress: () => void;
  session: LiveSessionNode;
}) {
  return createElement(
    'View',
    null,
    session.host.email ?? session.host.id,
    createElement(
      'Pressable',
      { accessibilityRole: 'button', onPress },
      buttonLabel,
    ),
  );
}

mock.module('expo-router', () => ({
  useRouter: () => ({
    push: (route: unknown) => {
      pushedRoutes.push(route);
    },
  }),
}));

mock.module('react-native', () => ({
  ActivityIndicator: NativeComponent,
  FlatList: NativeComponent,
  Linking: {
    canOpenURL: () => Promise.resolve(false),
    getInitialURL: () => Promise.resolve(null),
    openURL: () => Promise.resolve(),
  },
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
  ScrollView: NativeComponent,
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

mock.module('react-relay', () => ({
  fetchQuery: (
    _environment: unknown,
    _query: unknown,
    variables: QueryVariables,
  ) => {
    fetchQueryCalls.push({ variables });

    return {
      toPromise: () => Promise.resolve(fetchQueryResult),
    };
  },
  graphql: (query: TemplateStringsArray) => query,
  useLazyLoadQuery: (
    _query: unknown,
    variables: QueryVariables,
  ): FeedHomeQueryData => {
    queryVariables = variables;
    return queryData;
  },
  useRelayEnvironment: () => ({ environment: 'relay' }),
  useMutation: () => [
    (config: ReportPostMutationConfig) => {
      mutationCommits.push(config);
    },
    false,
  ],
}));

mock.module('../../src/components/AppButton', () => ({
  AppButton: AppButtonMock,
}));
mock.module('../../src/components/AppCard', () => ({
  AppCard: AppCardMock,
}));
mock.module('../../src/components/AppHeader', () => ({
  AppHeader: AppHeaderMock,
}));
mock.module('../../src/components/ScreenState', () => ({
  ScreenState: ScreenStateMock,
}));
mock.module('../../src/live/components/LiveSessionSummaryCard', () => ({
  LiveSessionSummaryCard: LiveSessionSummaryCardMock,
}));
mock.module('../../src/live/liveSessionNavigation', () => ({
  liveSessionHref: (sessionId: string) => ({
    params: { sessionId },
    pathname: '/live-session',
  }),
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
    xl: 32,
    xs: 4,
  },
  touchTarget: {
    min: 44,
  },
  typography: {
    body: {},
    eyebrow: {},
    heading: {},
    label: {},
  },
}));

const feedHomeScreen = await import('../../src/feed/FeedHomeScreen');
const homeRoute = await import('../../app/(app)/home');

const {
  FeedHomeContent,
  FeedHomeLoadingState,
  FeedHomeQueryErrorState,
  createFeedHomeActions,
  pushFeedHomeAction,
  shouldShowFeedHomeHostAction,
} = feedHomeScreen;

beforeEach(() => {
  queryData = createFilledQueryData();
  queryVariables = null;
  fetchQueryCalls = [];
  fetchQueryResult = createFilledQueryData();
  mutationCommits = [];
  pushedRoutes = [];
  hookIndex = 0;
  hookStates = [];
});

describe('FeedHomeScreen', () => {
  test('keeps home route pointed at the product feed surface', () => {
    const tree = renderWithHooks(createElement(homeRoute.default));

    expect(collectText(tree)).toContain('Home');
    expect(queryVariables).toEqual({
      feedAfter: null,
      feedFirst: 10,
      liveFirst: 20,
      replayAfter: null,
      replayFirst: 10,
      storyAfter: null,
      storyFirst: 10,
    });
  });

  test('renders stories, home feed, live now, replays, and current session sections', () => {
    const tree = renderWithHooks(createElement(FeedHomeContent));
    const text = collectText(tree);

    expect(text).toContain('Stories');
    expect(text).toContain('Story update');
    expect(text).toContain('Home feed');
    expect(text).toContain('First public post');
    expect(text).toContain('Live now');
    expect(text).toContain('live-host@example.com');
    expect(text).toContain('Replays');
    expect(text).toContain('replay-host@example.com');
    expect(text).toContain('Your live session');
    expect(text).toContain('viewer-host@example.com');
    expect(text).not.toContain('Host a live session');

    findPressableByText(tree, 'Watch live')?.props.onPress?.();
    findPressableByText(tree, 'Watch replay')?.props.onPress?.();
    findPressableByText(tree, 'Open session')?.props.onPress?.();

    expect(pushedRoutes).toEqual([
      { params: { sessionId: 'live-1' }, pathname: '/live-session' },
      { params: { sessionId: 'replay-1' }, pathname: '/live-session' },
      { params: { sessionId: 'viewer-live' }, pathname: '/live-session' },
    ]);
  });

  test('shows section load-more controls only for paginated content sections', () => {
    queryData = {
      ...createFilledQueryData(),
      homeFeed: connection(
        [
          post({
            bodyText: 'First public post',
            id: 'post-1',
            kind: 'STANDARD',
          }),
        ],
        { endCursor: 'home-cursor', hasNextPage: true },
      ),
      liveNow: connection(
        [
          liveSession({
            hostEmail: 'viewer-host@example.com',
            id: 'viewer-live',
          }),
          liveSession({
            hostEmail: 'live-host@example.com',
            id: 'live-1',
          }),
        ],
        { endCursor: 'live-cursor', hasNextPage: true },
      ),
      replayFeed: connection(
        [
          liveSession({
            endedAt: '2026-06-30T18:00:00Z',
            hostEmail: 'replay-host@example.com',
            id: 'replay-1',
            status: 'ENDED',
          }),
        ],
        { endCursor: 'replay-cursor', hasNextPage: true },
      ),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };

    const tree = renderWithHooks(createElement(FeedHomeContent));

    expect(findPressablesByText(tree, 'Load more stories')).toHaveLength(1);
    expect(findPressablesByText(tree, 'Load more feed posts')).toHaveLength(1);
    expect(findPressablesByText(tree, 'Load more replays')).toHaveLength(1);
    expect(findPressablesByText(tree, 'Load more live sessions')).toHaveLength(
      0,
    );
  });

  test('loads older story pages with section cursors without blocking live rows', async () => {
    queryData = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Story update',
            expiresAt: '2026-07-01T17:15:30Z',
            id: 'story-1',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor', hasNextPage: true },
      ),
    };
    fetchQueryResult = {
      ...createFilledQueryData(),
      storyFeed: connection(
        [
          post({
            bodyText: 'Older story',
            expiresAt: '2026-07-01T15:15:30Z',
            id: 'story-2',
            kind: 'STORY',
          }),
        ],
        { endCursor: 'story-cursor-2', hasNextPage: false },
      ),
    };

    let tree = renderWithHooks(createElement(FeedHomeContent));

    findPressableByText(tree, 'Load more stories')?.props.onPress?.();
    tree = renderWithHooks(createElement(FeedHomeContent));

    expect(collectText(tree)).toContain('live-host@example.com');
    expect(fetchQueryCalls[0].variables).toMatchObject({
      feedAfter: null,
      replayAfter: null,
      storyAfter: 'story-cursor',
    });

    await Promise.resolve();
    tree = renderWithHooks(createElement(FeedHomeContent));

    expect(collectText(tree)).toContain('Older story');
    expect(findPressablesByText(tree, 'Load more stories')).toHaveLength(0);
  });

  test('keeps host, profile, and diagnostics actions reachable from home', () => {
    expect(shouldShowFeedHomeHostAction(null)).toBe(true);
    expect(shouldShowFeedHomeHostAction({ id: 'live-1' })).toBe(false);

    expect(createFeedHomeActions(true)).toEqual([
      {
        key: 'host',
        label: 'Host a live session',
        route: '/host-broadcast',
        variant: 'primary',
      },
      {
        key: 'profile',
        label: 'Open profile',
        route: '/profile',
        variant: 'secondary',
      },
      {
        key: 'diagnostics',
        label: 'Diagnostics',
        route: '/diagnostics',
        variant: 'secondary',
      },
    ]);

    const routes: string[] = [];
    pushFeedHomeAction(
      {
        push: (route) => {
          routes.push(route);
        },
      },
      { route: '/diagnostics' },
    );

    expect(routes).toEqual(['/diagnostics']);
  });

  test('renders section-specific empty states', () => {
    queryData = {
      homeFeed: connection([]),
      liveNow: connection([]),
      replayFeed: connection([]),
      storyFeed: connection([]),
      viewer: {
        currentLiveSession: null,
        id: 'viewer-1',
      },
    };

    const tree = renderWithHooks(createElement(FeedHomeContent));
    const text = collectText(tree);

    expect(text).toContain('Host a live session');
    expect(text).toContain('No stories are available yet.');
    expect(text).toContain('No feed posts are available yet.');
    expect(text).toContain('No live sessions are available right now.');
    expect(text).toContain('No replays are available yet.');
  });

  test('renders loading and retryable query-error states', () => {
    const loadingTree = renderWithHooks(createElement(FeedHomeLoadingState));
    expect(collectText(loadingTree)).toEqual(['loading', 'Loading home...']);

    const retryCalls: string[] = [];
    const errorTree = renderWithHooks(
      createElement(FeedHomeQueryErrorState, {
        onRetry: () => {
          retryCalls.push('retry');
        },
      }),
    );

    expect(collectText(errorTree)).toEqual([
      'error',
      "We couldn't load home. Check your connection and try again.",
      'Retry',
    ]);

    findPressableByText(errorTree, 'Retry')?.props.onPress?.();

    expect(retryCalls).toEqual(['retry']);
  });

  test('reports non-owned posts while keeping own posts out of the action set', () => {
    queryData = {
      ...createFilledQueryData(),
      homeFeed: connection([
        post({ bodyText: 'First public post', id: 'post-1' }),
        post({
          author: {
            email: 'viewer@example.com',
            id: 'viewer-1',
          },
          bodyText: 'Own post',
          id: 'own-post',
        }),
      ]),
      storyFeed: connection([]),
    };

    let tree = renderWithHooks(createElement(FeedHomeContent));

    expect(findPressablesByText(tree, 'Report post')).toHaveLength(1);

    findPressableByText(tree, 'Report post')?.props.onPress?.();

    expect(mutationCommits).toHaveLength(1);
    expect(mutationCommits[0].variables).toEqual({
      input: {
        details: null,
        postId: 'post-1',
        reason: 'SPAM',
      },
    });

    mutationCommits[0].onCompleted?.({
      reportPost: {
        errors: [],
        report: {
          id: 'report-1',
          insertedAt: '2026-06-30T18:15:30Z',
          postId: 'post-1',
          reason: 'SPAM',
          status: 'OPEN',
        },
      },
    });

    tree = renderWithHooks(createElement(FeedHomeContent));

    const text = collectText(tree);
    expect(text).toContain('First public post');
    expect(text).toContain('Own post');
    expect(text).toContain('Report submitted.');
    expect(text).not.toContain('Report reason: SPAM');
  });

  test('blocks duplicate report taps and leaves payload errors retryable', () => {
    queryData = {
      ...createFilledQueryData(),
      homeFeed: connection([post({ id: 'post-1' })]),
      storyFeed: connection([]),
    };

    let tree = renderWithHooks(createElement(FeedHomeContent));
    const reportButton = findPressableByText(tree, 'Report post');

    reportButton?.props.onPress?.();
    reportButton?.props.onPress?.();

    expect(mutationCommits).toHaveLength(1);

    mutationCommits[0].onCompleted?.({
      reportPost: {
        errors: [{ field: 'postId', message: 'own_post' }],
        report: null,
      },
    });

    tree = renderWithHooks(createElement(FeedHomeContent));

    expect(collectText(tree)).toContain('You cannot report your own post.');
    findPressableByText(tree, 'Report post')?.props.onPress?.();

    expect(mutationCommits).toHaveLength(2);
  });
});

function createFilledQueryData(): FeedHomeQueryData {
  return {
    homeFeed: connection([
      post({
        bodyText: 'First public post',
        id: 'post-1',
        kind: 'STANDARD',
      }),
    ]),
    liveNow: connection([
      liveSession({
        hostEmail: 'viewer-host@example.com',
        id: 'viewer-live',
      }),
      liveSession({
        hostEmail: 'live-host@example.com',
        id: 'live-1',
      }),
    ]),
    replayFeed: connection([
      liveSession({
        endedAt: '2026-06-30T18:00:00Z',
        hostEmail: 'replay-host@example.com',
        id: 'replay-1',
        status: 'ENDED',
      }),
    ]),
    storyFeed: connection([
      post({
        bodyText: 'Story update',
        expiresAt: '2026-07-01T17:15:30Z',
        id: 'story-1',
        kind: 'STORY',
      }),
    ]),
    viewer: {
      currentLiveSession: liveSession({
        hostEmail: 'viewer-host@example.com',
        id: 'viewer-live',
      }),
      id: 'viewer-1',
    },
  };
}

function connection<Node>(
  nodes: ReadonlyArray<Node>,
  pageInfo: Partial<NonNullable<Connection<Node>['pageInfo']>> = {},
): Connection<Node> {
  return {
    edges: nodes.map((node) => ({ node })),
    pageInfo: {
      endCursor: nodes.length > 0 ? 'cursor' : null,
      hasNextPage: false,
      ...pageInfo,
    },
  };
}

function post(overrides: Partial<PostNode> = {}): PostNode {
  return {
    author: {
      email: 'creator@example.com',
      id: 'author-1',
    },
    bodyText: 'Post body',
    expiresAt: null,
    id: 'post-1',
    insertedAt: '2026-06-30T17:15:30Z',
    kind: 'STANDARD',
    mediaAssets: [
      {
        id: 'media-1',
        mimeType: 'image/jpeg',
        processingState: 'PROCESSED',
        publicUrl: 'https://media.example.test/post.jpg',
      },
    ],
    visibility: 'PUBLIC',
    ...overrides,
  };
}

function liveSession({
  endedAt = null,
  hostEmail,
  id,
  status = 'LIVE',
}: {
  endedAt?: string | null;
  hostEmail: string;
  id: string;
  status?: string;
}): LiveSessionNode {
  return {
    channelTopic: status === 'ENDED' ? null : `session:${id}`,
    endedAt,
    host: {
      email: hostEmail,
      id: `${id}-host`,
    },
    id,
    insertedAt: '2026-06-30T17:00:00Z',
    startedAt: status === 'STARTING' ? null : '2026-06-30T17:10:00Z',
    status,
    visibility: 'PUBLIC',
  };
}

function renderWithHooks(node: ReactNode): RenderedTree {
  hookIndex = 0;
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
    useReducer: <State, Action>(
      reducer: (state: State, action: Action) => State,
      initialArg: State,
    ): [State, (action: Action) => void] => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push(initialArg);
      }

      hookIndex += 1;

      return [
        hookStates[currentIndex] as State,
        (action) => {
          hookStates[currentIndex] = reducer(
            hookStates[currentIndex] as State,
            action,
          );
        },
      ];
    },
    useState: <State,>(
      initialState: State | (() => State),
    ): [State, (nextState: State | ((current: State) => State)) => void] => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push(
          typeof initialState === 'function'
            ? (initialState as () => State)()
            : initialState,
        );
      }

      hookIndex += 1;

      return [
        hookStates[currentIndex] as State,
        (nextState) => {
          hookStates[currentIndex] =
            typeof nextState === 'function'
              ? (nextState as (current: State) => State)(
                  hookStates[currentIndex] as State,
                )
              : nextState;
        },
      ];
    },
    useRef: <Value,>(initialValue: Value): { current: Value } => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push({ current: initialValue });
      }

      hookIndex += 1;

      return hookStates[currentIndex] as { current: Value };
    },
  };

  try {
    return renderNode(node);
  } finally {
    reactInternals.H = previousDispatcher;
  }
}

function renderNode(node: ReactNode): RenderedTree {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => renderNode(child));
  }

  if (!isValidElement(node)) {
    return null;
  }

  const element = node as ReactElement<{
    children?: ReactNode;
    [key: string]: unknown;
  }>;

  if (element.type === Fragment || element.type === Suspense) {
    return renderNode(element.props.children);
  }

  if (typeof element.type === 'function') {
    if (isClassComponent(element.type)) {
      const instance = new element.type(element.props);

      return renderNode(instance.render());
    }

    return renderNode(element.type(element.props));
  }

  return {
    children: normalizeRenderedChildren(renderNode(element.props.children)),
    props: element.props,
    type: String(element.type),
  };
}

function isClassComponent(
  value: unknown,
): value is new (props: Record<string, unknown>) => { render: () => ReactNode } {
  return (
    typeof value === 'function' &&
    typeof (value as { prototype?: { render?: unknown } }).prototype?.render ===
      'function'
  );
}

function normalizeRenderedChildren(rendered: RenderedTree): RenderedTree[] {
  if (rendered === null) {
    return [];
  }

  return Array.isArray(rendered)
    ? rendered.flatMap(normalizeRenderedChildren)
    : [rendered];
}

function collectText(tree: RenderedTree): string[] {
  if (tree === null) {
    return [];
  }

  if (typeof tree === 'string') {
    return [tree];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap((child) => collectText(child));
  }

  return tree.children.flatMap((child) => collectText(child));
}

function findPressableByText(
  tree: RenderedTree,
  text: string,
): HostNode | null {
  if (tree === null || typeof tree === 'string') {
    return null;
  }

  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findPressableByText(child, text);

      if (match) {
        return match;
      }
    }

    return null;
  }

  if (tree.type === 'Pressable' && collectText(tree).includes(text)) {
    return tree;
  }

  return findPressableByText(tree.children, text);
}

function findPressablesByText(
  tree: RenderedTree,
  text: string,
): HostNode[] {
  if (tree === null || typeof tree === 'string') {
    return [];
  }

  if (Array.isArray(tree)) {
    return tree.flatMap((child) => findPressablesByText(child, text));
  }

  const currentMatch =
    tree.type === 'Pressable' && collectText(tree).includes(text) ? [tree] : [];

  return currentMatch.concat(findPressablesByText(tree.children, text));
}

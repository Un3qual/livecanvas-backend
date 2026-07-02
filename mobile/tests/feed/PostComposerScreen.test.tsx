import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  Fragment,
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
type EffectCleanup = () => void;
type EffectCallback = () => EffectCleanup | undefined;
type EffectState = {
  cleanup?: () => void;
  deps?: readonly unknown[];
  kind: 'effect';
};

type HookDispatcher = {
  useEffect: (
    effect: EffectCallback,
    deps?: readonly unknown[],
  ) => void;
  useRef: <Value>(initialValue: Value) => { current: Value };
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};

let backCalls: string[];
let canGoBack = true;
let replaceCalls: string[];
let hookIndex = 0;
let hookStates: unknown[] = [];

type CreatePostCommitConfig = {
  onCompleted?: (payload: unknown) => void;
  onError?: () => void;
  variables: unknown;
};

let createPostCommitCalls: CreatePostCommitConfig[];
let createPostInFlight = false;

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
  selected,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const accessibilityState =
    selected === undefined
      ? { disabled: disabled ?? false }
      : { disabled: disabled ?? false, selected };

  return createElement(
    'Pressable',
    {
      accessibilityRole: 'button',
      accessibilityState,
      disabled: disabled ?? false,
      onPress,
    },
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
  state,
}: {
  message: string;
  state: string;
}) {
  return createElement('View', null, state, message);
}

mock.module('expo-router', () => ({
  Redirect: function RedirectMock(_props: { href: string }) {
    return null;
  },
  Stack: function StackMock(_props: { initialRouteName?: string }) {
    return null;
  },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/compose',
  useRouter: () => ({
    back: () => {
      backCalls.push('back');
    },
    canGoBack: () => canGoBack,
    replace: (route: string) => {
      replaceCalls.push(route);
    },
  }),
}));

mock.module('react-relay', () => ({
  fetchQuery: () => ({
    toPromise: () => Promise.resolve(null),
  }),
  graphql: (query: TemplateStringsArray) => query,
  useLazyLoadQuery: () => null,
  useMutation: () => [
    (config: CreatePostCommitConfig) => {
      createPostCommitCalls.push(config);
    },
    createPostInFlight,
  ],
  useRelayEnvironment: () => ({ environment: 'relay' }),
}));

mock.module('react-native', () => ({
  Linking: {
    canOpenURL: () => Promise.resolve(false),
    getInitialURL: () => Promise.resolve(null),
    openURL: () => Promise.resolve(),
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
  RefreshControl: NativeComponent,
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

const mockedReactNative = await import('react-native');
const composerScreen = await import('../../src/feed/PostComposerScreen');
const composeRoute = await import('../../app/(app)/compose');

const { PostComposerScreen } = composerScreen;

beforeEach(() => {
  backCalls = [];
  canGoBack = true;
  replaceCalls = [];
  createPostCommitCalls = [];
  createPostInFlight = false;
  hookIndex = 0;
  hookStates = [];
});

describe('PostComposerScreen', () => {
  test('keeps the local react-native mock compatible with feed refresh imports', () => {
    expect(mockedReactNative.RefreshControl).toBe(NativeComponent);
  });

  test('keeps compose route pointed at the post composer screen', () => {
    const tree = renderWithHooks(createElement(composeRoute.default));
    const text = collectText(tree);

    expect(text).toContain('Compose post');
    expect(text).toContain('Standard');
    expect(text).toContain('Story');
    expect(text).toContain('Post');
    expect(text).toContain('Cancel');
  });

  test('keeps submit disabled until the body is valid', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(true);

    const input = findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    });

    input?.props.onChangeText?.('  hello from mobile  ');
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(false);

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('x'.repeat(5001));
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree)).toContain(
      'Posts must be 5,000 characters or fewer.',
    );
    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(true);
  });

  test('counts emoji as backend graphemes in the body counter', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('😀😀😀');
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree).join('')).toContain('3/5000');
    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(false);
  });

  test('shows empty validation after the body field is touched', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onBlur?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree)).toContain('Add text before posting.');
    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(true);
  });

  test('marks active kind and visibility controls as selected', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    expectButtonSelection(tree, 'Standard', true);
    expectButtonSelection(tree, 'Story', false);
    expectButtonSelection(tree, 'Followers', true);
    expectButtonSelection(tree, 'Public', false);

    findPressableByText(tree, 'Story')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));
    findPressableByText(tree, 'Public')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    expectButtonSelection(tree, 'Standard', false);
    expectButtonSelection(tree, 'Story', true);
    expectButtonSelection(tree, 'Followers', false);
    expectButtonSelection(tree, 'Public', true);
  });

  test('commits createPost with trimmed input values', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('  Story update  ');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Story')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Public')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();

    expect(createPostCommitCalls).toHaveLength(1);
    expect(createPostCommitCalls[0]?.variables).toEqual({
      input: {
        bodyText: 'Story update',
        kind: 'STORY',
        visibility: 'PUBLIC',
      },
    });
  });

  test('blocks duplicate createPost submissions before rerender', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Duplicate guard');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    findPressableByText(tree, 'Post')?.props.onPress?.();

    expect(createPostCommitCalls).toHaveLength(1);
  });

  test('blocks cancel before rerender while createPost is in flight', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Do not hide this create');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    findPressableByText(tree, 'Cancel')?.props.onPress?.();

    expect(backCalls).toEqual([]);

    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(findPressableByText(tree, 'Cancel')?.props.disabled).toBe(true);
  });

  test('freezes draft controls while createPost is in flight', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Original post body');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Story')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Public')?.props.onPress?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Edited while posting');
    findPressableByText(tree, 'Standard')?.props.onPress?.();
    findPressableByText(tree, 'Followers')?.props.onPress?.();

    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(
      findHostNodeByProps(tree, {
        accessibilityLabel: 'Post body',
      })?.props.value,
    ).toBe('Original post body');
    expect(
      findHostNodeByProps(tree, {
        accessibilityLabel: 'Post body',
      })?.props.editable,
    ).toBe(false);
    expect(findPressableByText(tree, 'Standard')?.props.disabled).toBe(true);
    expect(findPressableByText(tree, 'Story')?.props.disabled).toBe(true);
    expect(findPressableByText(tree, 'Followers')?.props.disabled).toBe(true);
    expect(findPressableByText(tree, 'Public')?.props.disabled).toBe(true);
    expect(findPressableByText(tree, 'Standard')?.props.accessibilityState).toEqual({
      disabled: true,
      selected: false,
    });
    expect(findPressableByText(tree, 'Story')?.props.accessibilityState).toEqual({
      disabled: true,
      selected: true,
    });
    expect(findPressableByText(tree, 'Followers')?.props.accessibilityState).toEqual({
      disabled: true,
      selected: false,
    });
    expect(findPressableByText(tree, 'Public')?.props.accessibilityState).toEqual({
      disabled: true,
      selected: true,
    });
  });

  test('shows confirmation and returns home after successful creation', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Successful post');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    createPostCommitCalls[0]?.onCompleted?.({
      createPost: {
        errors: [],
        post: { id: 'post-1' },
      },
    });
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree)).toContain('Post created.');
    expect(replaceCalls).toEqual(['/home']);
  });

  test('ignores createPost callbacks after the composer unmounts', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Leave before callback');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    runEffectCleanups();
    createPostCommitCalls[0]?.onCompleted?.({
      createPost: {
        errors: [],
        post: { id: 'post-1' },
      },
    });

    expect(replaceCalls).toEqual([]);
  });

  test('keeps payload errors retryable without losing the draft body', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Retry this post');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    createPostCommitCalls[0]?.onCompleted?.({
      createPost: {
        errors: [{ field: null, message: 'unauthenticated' }],
        post: null,
      },
    });
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree)).toContain('Sign in again to create a post.');
    expect(
      findHostNodeByProps(tree, {
        accessibilityLabel: 'Post body',
      })?.props.value,
    ).toBe('Retry this post');
    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(false);

    findPressableByText(tree, 'Post')?.props.onPress?.();

    expect(createPostCommitCalls).toHaveLength(2);
  });

  test('keeps network errors retryable without losing the draft body', () => {
    let tree = renderWithHooks(createElement(PostComposerScreen));

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Retry after network error');
    tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Post')?.props.onPress?.();
    createPostCommitCalls[0]?.onError?.();
    tree = renderWithHooks(createElement(PostComposerScreen));

    expect(collectText(tree)).toContain('We could not create this post.');
    expect(
      findHostNodeByProps(tree, {
        accessibilityLabel: 'Post body',
      })?.props.value,
    ).toBe('Retry after network error');
    expect(findPressableByText(tree, 'Post')?.props.disabled).toBe(false);

    findPressableByText(tree, 'Post')?.props.onPress?.();

    expect(createPostCommitCalls).toHaveLength(2);
  });

  test('cancels through router back', () => {
    const tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Cancel')?.props.onPress?.();

    expect(backCalls).toEqual(['back']);
    expect(replaceCalls).toEqual([]);
  });

  test('cancels direct compose routes by replacing home', () => {
    canGoBack = false;
    const tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Cancel')?.props.onPress?.();

    expect(backCalls).toEqual([]);
    expect(replaceCalls).toEqual(['/home']);
  });
});

function renderWithHooks(node: ReactNode): RenderedTree {
  hookIndex = 0;
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
    useEffect: (effect, deps) => {
      const currentIndex = hookIndex;
      const previousState = hookStates[currentIndex];
      const previousEffectState = isEffectState(previousState)
        ? previousState
        : null;
      const shouldRun =
        previousEffectState === null ||
        !areHookDepsEqual(previousEffectState.deps, deps);

      if (shouldRun) {
        previousEffectState?.cleanup?.();
        const cleanup = effect();
        hookStates[currentIndex] = {
          cleanup: typeof cleanup === 'function' ? cleanup : undefined,
          deps,
          kind: 'effect',
        } satisfies EffectState;
      }

      hookIndex += 1;
    },
    useRef: <Value,>(initialValue: Value): { current: Value } => {
      const currentIndex = hookIndex;

      if (hookStates.length === currentIndex) {
        hookStates.push({ current: initialValue });
      }

      hookIndex += 1;

      return hookStates[currentIndex] as { current: Value };
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
  };

  try {
    return renderNode(node);
  } finally {
    reactInternals.H = previousDispatcher;
  }
}

function runEffectCleanups() {
  for (const hookState of hookStates) {
    if (isEffectState(hookState)) {
      hookState.cleanup?.();
    }
  }
}

function isEffectState(value: unknown): value is EffectState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'effect'
  );
}

function areHookDepsEqual(
  left: readonly unknown[] | undefined,
  right: readonly unknown[] | undefined,
): boolean {
  if (left === undefined || right === undefined || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => Object.is(value, right[index]));
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

  if (element.type === Fragment) {
    return renderNode(element.props.children);
  }

  if (typeof element.type === 'function') {
    return renderNode(element.type(element.props));
  }

  return {
    children: normalizeRenderedChildren(renderNode(element.props.children)),
    props: element.props,
    type: String(element.type),
  };
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

function findHostNodeByProps(
  tree: RenderedTree,
  expectedProps: Record<string, unknown>,
): HostNode | null {
  if (tree === null || typeof tree === 'string') {
    return null;
  }

  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findHostNodeByProps(child, expectedProps);

      if (match) {
        return match;
      }
    }

    return null;
  }

  const isMatch = Object.entries(expectedProps).every(
    ([key, value]) => tree.props[key] === value,
  );

  if (isMatch) {
    return tree;
  }

  return findHostNodeByProps(tree.children, expectedProps);
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

function expectButtonSelection(
  tree: RenderedTree,
  label: string,
  selected: boolean,
) {
  expect(findPressableByText(tree, label)?.props.accessibilityState).toEqual({
    disabled: false,
    selected,
  });
}

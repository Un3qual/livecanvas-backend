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

type HookDispatcher = {
  useState: <State>(
    initialState: State | (() => State),
  ) => [State, (nextState: State | ((current: State) => State)) => void];
};

let backCalls: string[];
let hookIndex = 0;
let hookStates: unknown[] = [];

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
  state,
}: {
  message: string;
  state: string;
}) {
  return createElement('View', null, state, message);
}

mock.module('expo-router', () => ({
  useRouter: () => ({
    back: () => {
      backCalls.push('back');
    },
  }),
}));

mock.module('react-native', () => ({
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

const composerScreen = await import('../../src/feed/PostComposerScreen');
const composeRoute = await import('../../app/(app)/compose');

const { PostComposerScreen } = composerScreen;

beforeEach(() => {
  backCalls = [];
  hookIndex = 0;
  hookStates = [];
});

describe('PostComposerScreen', () => {
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

  test('maps kind and visibility controls to createPost input values', () => {
    const submittedInputs: unknown[] = [];

    let tree = renderWithHooks(
      createElement(PostComposerScreen, {
        onSubmitInput: (input: unknown) => {
          submittedInputs.push(input);
        },
      }),
    );

    findHostNodeByProps(tree, {
      accessibilityLabel: 'Post body',
    })?.props.onChangeText?.('Story update');
    tree = renderWithHooks(
      createElement(PostComposerScreen, {
        onSubmitInput: (input: unknown) => {
          submittedInputs.push(input);
        },
      }),
    );

    findPressableByText(tree, 'Story')?.props.onPress?.();
    tree = renderWithHooks(
      createElement(PostComposerScreen, {
        onSubmitInput: (input: unknown) => {
          submittedInputs.push(input);
        },
      }),
    );

    findPressableByText(tree, 'Public')?.props.onPress?.();
    tree = renderWithHooks(
      createElement(PostComposerScreen, {
        onSubmitInput: (input: unknown) => {
          submittedInputs.push(input);
        },
      }),
    );

    findPressableByText(tree, 'Post')?.props.onPress?.();

    expect(submittedInputs).toEqual([
      {
        bodyText: 'Story update',
        kind: 'STORY',
        visibility: 'PUBLIC',
      },
    ]);
  });

  test('cancels through router back', () => {
    const tree = renderWithHooks(createElement(PostComposerScreen));

    findPressableByText(tree, 'Cancel')?.props.onPress?.();

    expect(backCalls).toEqual(['back']);
  });
});

function renderWithHooks(node: ReactNode): RenderedTree {
  hookIndex = 0;
  const previousDispatcher = reactInternals.H;
  reactInternals.H = {
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

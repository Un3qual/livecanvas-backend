import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';

type MockComponent = (props: {
  children?: ReactNode;
  [key: string]: unknown;
}) => ReactElement;

import { resetReactNativeLinkingMock } from './reactNative';

const reactNative = (await import('react-native')) as unknown as {
  Linking: {
    canOpenURL: ReturnType<typeof mock>;
    getInitialURL: ReturnType<typeof mock>;
    openURL: ReturnType<typeof mock>;
  };
  Pressable: MockComponent;
  RefreshControl: MockComponent;
  ScrollView: MockComponent;
  StyleSheet: {
    create: <Styles>(styles: Styles) => Styles;
  };
  Text: MockComponent;
  TextInput: MockComponent;
  View: MockComponent;
};

function renderMockComponent(
  Component: MockComponent,
  props: Parameters<MockComponent>[0],
) {
  return Component(props);
}

describe('react-native Bun test mock', () => {
  beforeEach(() => {
    resetReactNativeLinkingMock();
  });

  afterEach(() => {
    resetReactNativeLinkingMock();
  });

  test('renders inspectable host elements from the preload mock', () => {
    const onPress = mock(() => undefined);
    const pressable = renderMockComponent(reactNative.Pressable, {
      accessibilityRole: 'button',
      children: 'Open',
      onPress,
    });
    const textInput = renderMockComponent(reactNative.TextInput, {
      onChangeText: mock(() => undefined),
      value: 'draft',
    });
    const scrollView = renderMockComponent(reactNative.ScrollView, {
      children: createElement(reactNative.Text, null, 'Body'),
      refreshControl: createElement(reactNative.RefreshControl, {
        refreshing: false,
      }),
    });

    expect(isValidElement(pressable)).toBe(true);
    expect(pressable.type).toBe('Pressable');
    expect(pressable.props).toMatchObject({
      accessibilityRole: 'button',
      children: 'Open',
      onPress,
    });
    expect(textInput.type).toBe('TextInput');
    expect(textInput.props.value).toBe('draft');
    expect(scrollView.type).toBe('ScrollView');
    expect(isValidElement(scrollView.props.refreshControl)).toBe(true);
  });

  test('keeps native boundary shims configurable for focused tests', async () => {
    reactNative.Linking.canOpenURL = mock(() => Promise.resolve(true));
    reactNative.Linking.openURL = mock(() => Promise.resolve());

    expect(await reactNative.Linking.canOpenURL('https://example.test')).toBe(
      true,
    );
    expect(reactNative.Linking.canOpenURL).toHaveBeenCalledWith(
      'https://example.test',
    );

    await reactNative.Linking.openURL('https://example.test');
    expect(reactNative.Linking.openURL).toHaveBeenCalledWith(
      'https://example.test',
    );
  });

  test('returns styles unchanged for style assertions', () => {
    const styles = {
      button: {
        minHeight: 44,
      },
    };

    expect(reactNative.StyleSheet.create(styles)).toBe(styles);
  });
});

import { mock } from 'bun:test';
import {
  createElement,
  type ReactElement,
  type ReactNode,
} from 'react';

type HostComponentProps = {
  children?: ReactNode;
  [key: string]: unknown;
};

export type ReactNativeMockComponent = (
  props: HostComponentProps,
) => ReactElement;

export type ReactNativeLinkingMock = {
  canOpenURL: (url: string) => Promise<boolean>;
  getInitialURL: () => Promise<string | null>;
  openURL: (url: string) => Promise<void>;
};

export function createReactNativeHostComponent(
  name: string,
): ReactNativeMockComponent {
  function ReactNativeHostComponent({
    children,
    ...props
  }: HostComponentProps) {
    return createElement(name, props, children);
  }

  ReactNativeHostComponent.displayName = name;

  return ReactNativeHostComponent;
}

export const reactNativeLinkingMock: ReactNativeLinkingMock = {
  canOpenURL: mock(() => Promise.resolve(false)),
  getInitialURL: mock(() => Promise.resolve(null)),
  openURL: mock(() => Promise.resolve()),
};

export function resetReactNativeLinkingMock() {
  reactNativeLinkingMock.canOpenURL = mock(() => Promise.resolve(false));
  reactNativeLinkingMock.getInitialURL = mock(() => Promise.resolve(null));
  reactNativeLinkingMock.openURL = mock(() => Promise.resolve());
}

export const reactNativeMock = {
  ActivityIndicator: createReactNativeHostComponent('ActivityIndicator'),
  FlatList: createReactNativeHostComponent('FlatList'),
  KeyboardAvoidingView: createReactNativeHostComponent('KeyboardAvoidingView'),
  Linking: reactNativeLinkingMock,
  Platform: {
    OS: 'ios',
    select: <Specifics extends Record<string, unknown>>(
      specifics: Specifics,
    ) => specifics.ios ?? specifics.native ?? specifics.default,
  },
  Pressable: createReactNativeHostComponent('Pressable'),
  RefreshControl: createReactNativeHostComponent('RefreshControl'),
  ScrollView: createReactNativeHostComponent('ScrollView'),
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: createReactNativeHostComponent('Text'),
  TextInput: createReactNativeHostComponent('TextInput'),
  View: createReactNativeHostComponent('View'),
};

mock.module('react-native', () => reactNativeMock);

import '../setup/reactNative';

import { describe, expect, mock, test } from 'bun:test';
import React from 'react';

mock.module('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      error: 'error',
      surfaceMuted: 'surfaceMuted',
      text: 'text',
    },
  }),
}));

const { LiveSessionViewerPlaybackSurface } = await import(
  '../../src/live/watch/components/LiveSessionViewerPlaybackSurface'
);

// Direct component calls plus element-tree inspection only cover prop/text
// branching here, not renderer-driven hooks or effects.
type ReactElementWithProps = React.ReactElement<{
  readonly children?: React.ReactNode;
  readonly label?: string;
  readonly onPress?: () => void;
}>;

describe('LiveSessionViewerPlaybackSurface', () => {
  test('shows retry video for recoverable closed playback and keeps status copy visible', () => {
    let retryCount = 0;
    const surface = LiveSessionViewerPlaybackSurface({
      isJoined: true,
      recovery: {
        canRetry: true,
        onRetry: () => {
          retryCount += 1;
        },
      },
      state: {
        error: null,
        remoteStreamUrl: null,
        status: 'closed',
      },
    });

    expect(hasText(surface, 'Live video disconnected.')).toBe(true);

    const retryButton = findButton(surface, 'Retry video');

    expect(retryButton).not.toBeNull();

    retryButton?.props.onPress?.();

    expect(retryCount).toBe(1);
  });

  test('shows retry video for recoverable errored playback while preserving the error message', () => {
    const surface = LiveSessionViewerPlaybackSurface({
      isJoined: true,
      recovery: {
        canRetry: true,
        onRetry: () => undefined,
      },
      state: {
        error: 'Connection failed.',
        remoteStreamUrl: null,
        status: 'errored',
      },
    });

    expect(hasText(surface, 'Connection failed.')).toBe(true);
    expect(findButton(surface, 'Retry video')).not.toBeNull();
  });

  test('hides retry video before join and while playback is idle, connecting, or playing', () => {
    const baseState = {
      error: null,
      remoteStreamUrl: null,
    };

    expect(
      findButton(
        LiveSessionViewerPlaybackSurface({
          isJoined: false,
          recovery: {
            canRetry: false,
            onRetry: () => undefined,
          },
          state: {
            ...baseState,
            status: 'closed',
          },
        }),
        'Retry video',
      ),
    ).toBeNull();

    for (const status of ['idle', 'connecting', 'playing'] as const) {
      expect(
        findButton(
          LiveSessionViewerPlaybackSurface({
            isJoined: true,
            recovery: {
              canRetry: false,
              onRetry: () => undefined,
            },
            state: {
              ...baseState,
              remoteStreamUrl:
                status === 'playing' ? 'stream://host-camera' : null,
              status,
            },
          }),
          'Retry video',
        ),
      ).toBeNull();
    }
  });
});

function findButton(
  node: React.ReactNode,
  label: string,
): ReactElementWithProps | null {
  return (
    findElements(node).find(
      (element) =>
        element.props.label === label &&
        typeof element.props.onPress === 'function',
    ) ?? null
  );
}

function hasText(node: React.ReactNode, text: string): boolean {
  if (typeof node === 'string') {
    return node === text;
  }

  if (!React.isValidElement(node)) {
    return false;
  }

  const element = node as ReactElementWithProps;

  return React.Children.toArray(element.props.children).some((child) =>
    hasText(child, text),
  );
}

function findElements(node: React.ReactNode): ReactElementWithProps[] {
  if (!React.isValidElement(node)) {
    return [];
  }

  const element = node as ReactElementWithProps;
  const children = React.Children.toArray(element.props.children).flatMap(
    findElements,
  );

  return [element, ...children];
}

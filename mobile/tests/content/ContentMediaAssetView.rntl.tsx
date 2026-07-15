import { act, render, screen } from '@testing-library/react-native';

import {
  ContentMediaAssetView,
} from '../../src/content/ContentMediaAssetView';
import type { ContentMediaAssetPresentation } from '../../src/content/contentPostPresentation';

let mockImageOnError: (() => void) | null;
let mockVideoStatusChange:
  | ((event: { status: 'error' | 'readyToPlay' }) => void)
  | null;
let mockVideoViewProps: Record<string, unknown> | null;

jest.mock('expo-image', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    Image: ({
      accessibilityLabel,
      onError,
      source,
    }: {
      accessibilityLabel: string;
      onError: () => void;
      source: string;
    }) => {
      mockImageOnError = onError;
      return (
        <Text accessibilityLabel={accessibilityLabel} testID="content-image">
          {source}
        </Text>
      );
    },
  };
});

jest.mock('expo-video', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    useVideoPlayer: (
      source: string,
      setup?: (player: Record<string, unknown>) => void,
    ) => {
      const player = {
        addListener: (
          _event: string,
          listener: (event: { status: 'error' | 'readyToPlay' }) => void,
        ) => {
          mockVideoStatusChange = listener;
          return { remove: jest.fn() };
        },
        loop: true,
        source,
        status: 'loading',
        staysActiveInBackground: true,
      };
      setup?.(player);
      return player;
    },
    VideoView: (props: Record<string, unknown>) => {
      mockVideoViewProps = props;
      const player = props.player as { source: string };
      return <Text testID="content-video">{player.source}</Text>;
    },
  };
});

jest.mock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      border: '#cccccc',
      surfaceMuted: '#eeeeee',
      text: '#111111',
      textMuted: '#666666',
    },
  }),
}));

beforeEach(() => {
  mockImageOnError = null;
  mockVideoStatusChange = null;
  mockVideoViewProps = null;
});

describe('ContentMediaAssetView', () => {
  test('renders a processed image through the optimized Expo image surface', async () => {
    await render(
      <ContentMediaAssetView
        asset={asset({
          kind: 'image',
          label: 'Image',
          publicUrl: 'https://media.example.test/post.jpg',
        })}
      />,
    );

    expect(screen.getByTestId('content-image')).toHaveTextContent(
      'https://media.example.test/post.jpg',
    );
    expect(screen.getByLabelText('Image attachment')).toBeOnTheScreen();
  });

  test('renders a processed video with native controls and no background playback', async () => {
    await render(
      <ContentMediaAssetView
        asset={asset({
          kind: 'video',
          label: 'Video',
          publicUrl: 'https://media.example.test/post.mp4',
        })}
      />,
    );

    expect(screen.getByTestId('content-video')).toHaveTextContent(
      'https://media.example.test/post.mp4',
    );
    expect(mockVideoViewProps).toMatchObject({
      accessibilityLabel: 'Video attachment',
      contentFit: 'contain',
      nativeControls: true,
    });
    expect(
      mockVideoViewProps?.player,
    ).toMatchObject({ loop: false, staysActiveInBackground: false });
  });

  test.each([
    ['processing', 'Media is still processing.'],
    ['failed', 'Media could not be processed.'],
    ['unavailable', 'Media is unavailable.'],
  ] as const)('renders the %s fallback without a native surface', async (state, body) => {
    await render(
      <ContentMediaAssetView
        asset={asset({ kind: 'unknown', publicUrl: null, state, body })}
      />,
    );

    expect(screen.getByText(body)).toBeOnTheScreen();
    expect(screen.queryByTestId('content-image')).toBeNull();
    expect(screen.queryByTestId('content-video')).toBeNull();
  });

  test('replaces image and video surfaces with stable load-error fallbacks', async () => {
    const view = await render(
      <ContentMediaAssetView
        asset={asset({
          kind: 'image',
          label: 'Image',
          publicUrl: 'https://media.example.test/broken.jpg',
        })}
      />,
    );

    await act(() => {
      mockImageOnError?.();
    });
    expect(screen.getByText('Image could not be loaded.')).toBeOnTheScreen();

    await view.rerender(
      <ContentMediaAssetView
        asset={asset({
          id: 'video-id',
          kind: 'video',
          label: 'Video',
          publicUrl: 'https://media.example.test/broken.mp4',
        })}
      />,
    );
    await act(() => {
      mockVideoStatusChange?.({ status: 'error' });
    });
    expect(screen.getByText('Video could not be loaded.')).toBeOnTheScreen();
  });
});

function asset(
  overrides: Partial<ContentMediaAssetPresentation> = {},
): ContentMediaAssetPresentation {
  return {
    body: 'Media is ready.',
    id: 'asset-id',
    kind: 'image',
    label: 'Image',
    publicUrl: 'https://media.example.test/post.jpg',
    state: 'available',
    ...overrides,
  };
}

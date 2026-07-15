import { render, screen } from '@testing-library/react-native';

jest.mock('../../src/live/media/liveWebRtcAdapter', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    LiveWebRtcRTCView: ({ streamURL }: { streamURL: string }) => (
      <Text testID="host-preview-video">{streamURL}</Text>
    ),
  };
});

jest.mock('../../src/providers/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      border: '#333333',
      surfaceMuted: '#222222',
      text: '#ffffff',
      textMuted: '#aaaaaa',
    },
  }),
}));

import { HostPreviewCard } from '../../src/host/preflight/components/HostPreviewCard';

describe('HostPreviewCard', () => {
  test('renders the cached host stream as a mirrored camera preview', async () => {
    await render(
      <HostPreviewCard
        nativeMediaReady
        previewStreamUrl="stream://host-preview"
      />,
    );

    expect(screen.getByText('Camera preview')).toBeOnTheScreen();
    expect(screen.getByTestId('host-preview-video')).toHaveTextContent(
      'stream://host-preview',
    );
  });

  test('renders a stable fallback while native preview is unavailable', async () => {
    await render(
      <HostPreviewCard nativeMediaReady={false} previewStreamUrl={null} />,
    );

    expect(
      screen.getByText(
        'Camera preview will appear after camera and microphone access is ready.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('host-preview-video')).toBeNull();
  });
});

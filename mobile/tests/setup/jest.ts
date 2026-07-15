import '@testing-library/react-native';
import { jest } from '@jest/globals';

// Expo media surfaces require native view managers that are unavailable in
// Jest. Feature-focused suites can replace these neutral defaults with richer
// local mocks while unrelated feed/profile tests keep exercising card layout.
jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return { Image: View };
});

jest.mock('expo-video', () => {
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    useVideoPlayer: (
      _source: string,
      setup?: (player: Record<string, unknown>) => void,
    ) => {
      const player = {
        addListener: () => ({ remove: jest.fn() }),
        loop: false,
        status: 'idle',
        staysActiveInBackground: false,
      };
      setup?.(player);
      return player;
    },
    VideoView: View,
  };
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useLiveSessionAppState } from '../../src/live/watch/liveSessionAppState';

const initialAppStateCurrentState = AppState.currentState;

afterEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: initialAppStateCurrentState,
    writable: true,
  });
  jest.restoreAllMocks();
});

describe('useLiveSessionAppState', () => {
  test('reconciles a state transition missed before the listener subscribes', async () => {
    const remove = jest.fn();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
      writable: true,
    });

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, _listener) => {
        Object.defineProperty(AppState, 'currentState', {
          configurable: true,
          value: 'background',
          writable: true,
        });
        return { remove };
      });

    const { result, unmount } = await renderHook(() =>
      useLiveSessionAppState(),
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        isActive: false,
        resumeGeneration: 0,
      });
    });

    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

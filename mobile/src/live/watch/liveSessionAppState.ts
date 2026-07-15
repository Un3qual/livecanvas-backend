import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type LiveSessionAppState = Readonly<{
  isActive: boolean;
  resumeGeneration: number;
}>;

export function createLiveSessionAppState(
  status: AppStateStatus,
): LiveSessionAppState {
  return {
    isActive: status === 'active',
    resumeGeneration: 0,
  };
}

export function reduceLiveSessionAppState(
  state: LiveSessionAppState,
  status: AppStateStatus,
): LiveSessionAppState {
  const isActive = status === 'active';

  if (state.isActive === isActive) {
    return state;
  }

  return {
    isActive,
    resumeGeneration: isActive
      ? state.resumeGeneration + 1
      : state.resumeGeneration,
  };
}

export function useLiveSessionAppState(): LiveSessionAppState {
  const [state, setState] = useState(() =>
    createLiveSessionAppState(AppState.currentState),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      setState((currentState) =>
        reduceLiveSessionAppState(currentState, status),
      );
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return state;
}

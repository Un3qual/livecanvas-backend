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
    const updateStatus = (status: AppStateStatus) => {
      setState((currentState) =>
        reduceLiveSessionAppState(currentState, status),
      );
    };
    const subscription = AppState.addEventListener('change', updateStatus);

    // Reconcile after subscribing so a transition between the initial render
    // and this effect cannot leave recovery state stale.
    updateStatus(AppState.currentState);

    return () => {
      subscription.remove();
    };
  }, []);

  return state;
}

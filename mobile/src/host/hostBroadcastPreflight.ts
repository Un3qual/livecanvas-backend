export type HostBroadcastPermissionState =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked';

export type HostBroadcastPermissionTarget = 'camera' | 'microphone';

export type HostBroadcastPreflightBlockerReason =
  | 'camera_permission'
  | 'microphone_permission'
  | 'native_media'
  | 'backend_media_contract';

export type HostBroadcastPreflightBlocker = {
  readonly reason: HostBroadcastPreflightBlockerReason;
  readonly userActionable: boolean;
};

export type HostBroadcastPreflightState = {
  readonly backendMediaContractReady: boolean;
  readonly cameraPermission: HostBroadcastPermissionState;
  readonly microphonePermission: HostBroadcastPermissionState;
  readonly nativeMediaReady: boolean;
};

export type HostBroadcastPreflightAction =
  | {
      readonly permission: HostBroadcastPermissionTarget;
      readonly state: HostBroadcastPermissionState;
      readonly type: 'permission_changed';
    }
  | { readonly ready: boolean; readonly type: 'native_media_changed' }
  | {
      readonly ready: boolean;
      readonly type: 'backend_media_contract_changed';
    }
  | { readonly type: 'reset' };

export function createHostBroadcastPreflightState(): HostBroadcastPreflightState {
  return {
    backendMediaContractReady: false,
    cameraPermission: 'unknown',
    microphonePermission: 'unknown',
    nativeMediaReady: false,
  };
}

export function canCreateHostPreflightSession(
  state: HostBroadcastPreflightState,
): boolean {
  return (
    state.cameraPermission === 'granted' &&
    state.microphonePermission === 'granted' &&
    state.nativeMediaReady
  );
}

export function canGoLiveFromHostPreflight(
  state: HostBroadcastPreflightState,
): boolean {
  return (
    canCreateHostPreflightSession(state) && state.backendMediaContractReady
  );
}

export function hostBroadcastPreflightBlockers(
  state: HostBroadcastPreflightState,
): ReadonlyArray<HostBroadcastPreflightBlocker> {
  const blockers: Array<HostBroadcastPreflightBlocker> = [];

  if (state.cameraPermission !== 'granted') {
    blockers.push({
      reason: 'camera_permission',
      userActionable: true,
    });
  }

  if (state.microphonePermission !== 'granted') {
    blockers.push({
      reason: 'microphone_permission',
      userActionable: true,
    });
  }

  if (!state.nativeMediaReady) {
    blockers.push({
      reason: 'native_media',
      userActionable: false,
    });
  }

  if (!state.backendMediaContractReady) {
    blockers.push({
      reason: 'backend_media_contract',
      userActionable: false,
    });
  }

  return blockers;
}

export function hostBroadcastPreflightReducer(
  state: HostBroadcastPreflightState,
  action: HostBroadcastPreflightAction,
): HostBroadcastPreflightState {
  switch (action.type) {
    case 'permission_changed':
      return action.permission === 'camera'
        ? { ...state, cameraPermission: action.state }
        : { ...state, microphonePermission: action.state };

    case 'native_media_changed':
      return { ...state, nativeMediaReady: action.ready };

    case 'backend_media_contract_changed':
      return { ...state, backendMediaContractReady: action.ready };

    case 'reset':
      return createHostBroadcastPreflightState();

    default:
      return state;
  }
}

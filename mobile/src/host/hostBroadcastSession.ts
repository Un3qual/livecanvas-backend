export type HostBroadcastSessionStatus =
  | 'idle'
  | 'creating'
  | 'starting'
  | 'ending'
  | 'ended';

export type HostBroadcastSessionState = {
  readonly liveSessionId: string | null;
  readonly status: HostBroadcastSessionStatus;
  readonly viewerSafeErrorText: string | null;
};

export type HostBroadcastPreflightCleanupState = {
  readonly hasEndLiveSessionRequestInFlight: boolean;
  readonly hasGoLiveRequestInFlight: boolean;
  readonly hasGoLiveSucceeded: boolean;
};

export type HostBroadcastPreflightStartSubmissionState = {
  readonly hasStartLiveSessionRequestInFlight: boolean;
};

export type HostBroadcastSessionAction =
  | { readonly type: 'start_requested' }
  | { readonly type: 'start_succeeded'; readonly liveSessionId: string }
  | { readonly type: 'start_failed'; readonly viewerSafeErrorText: string }
  | { readonly type: 'end_requested' }
  | { readonly type: 'end_succeeded' }
  | { readonly type: 'end_failed'; readonly viewerSafeErrorText: string };

export function createHostBroadcastSessionState(): HostBroadcastSessionState {
  return {
    liveSessionId: null,
    status: 'idle',
    viewerSafeErrorText: null,
  };
}

export function canRequestHostGoLive(
  state: HostBroadcastSessionState,
  backendMediaReady: boolean,
): boolean {
  return (
    state.status === 'starting' &&
    state.liveSessionId !== null &&
    backendMediaReady
  );
}

export function canSubmitHostPreflightStartRequest(
  canCreateSession: boolean,
  submissionState: HostBroadcastPreflightStartSubmissionState,
): boolean {
  return (
    canCreateSession &&
    !submissionState.hasStartLiveSessionRequestInFlight
  );
}

export function canRequestHostPreflightBackCleanup(
  state: HostBroadcastSessionState,
): boolean {
  return (
    hostBroadcastPreflightCleanupLiveSessionId(state, {
      hasEndLiveSessionRequestInFlight: false,
      hasGoLiveRequestInFlight: false,
      hasGoLiveSucceeded: false,
    }) !== null
  );
}

export function canRequestAbandonedHostPreflightCleanup(
  cleanupState: HostBroadcastPreflightCleanupState,
): boolean {
  return (
    !cleanupState.hasEndLiveSessionRequestInFlight &&
    !cleanupState.hasGoLiveRequestInFlight &&
    !cleanupState.hasGoLiveSucceeded
  );
}

export function hostBroadcastPreflightCleanupLiveSessionId(
  state: HostBroadcastSessionState,
  cleanupState: HostBroadcastPreflightCleanupState,
): string | null {
  if (
    !canRequestAbandonedHostPreflightCleanup(cleanupState) ||
    state.status !== 'starting'
  ) {
    return null;
  }

  return state.liveSessionId;
}

export function canUseHostPreflightBackAction(
  state: HostBroadcastSessionState,
  isGoingLive: boolean,
): boolean {
  return (
    state.status !== 'creating' &&
    state.status !== 'ending' &&
    !isGoingLive
  );
}

export function hostBroadcastSessionReducer(
  state: HostBroadcastSessionState,
  action: HostBroadcastSessionAction,
): HostBroadcastSessionState {
  switch (action.type) {
    case 'start_requested':
      if (state.status !== 'idle' && state.status !== 'ended') {
        return state;
      }

      return {
        liveSessionId: null,
        status: 'creating',
        viewerSafeErrorText: null,
      };

    case 'start_succeeded':
      if (state.status !== 'creating') {
        return state;
      }

      return {
        liveSessionId: action.liveSessionId,
        status: 'starting',
        viewerSafeErrorText: null,
      };

    case 'start_failed':
      if (state.status !== 'creating') {
        return state;
      }

      return {
        liveSessionId: null,
        status: 'idle',
        viewerSafeErrorText: action.viewerSafeErrorText,
      };

    case 'end_requested':
      return state.liveSessionId === null || state.status !== 'starting'
        ? state
        : {
            liveSessionId: state.liveSessionId,
            status: 'ending',
            viewerSafeErrorText: null,
          };

    case 'end_succeeded':
      if (state.status !== 'ending') {
        return state;
      }

      return {
        liveSessionId: null,
        status: 'ended',
        viewerSafeErrorText: null,
      };

    case 'end_failed':
      if (state.status !== 'ending') {
        return state;
      }

      return {
        liveSessionId: state.liveSessionId,
        status: 'starting',
        viewerSafeErrorText: action.viewerSafeErrorText,
      };

    default:
      return state;
  }
}

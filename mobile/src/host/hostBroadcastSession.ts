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

export type HostBroadcastSessionAction =
  | { readonly type: 'start_requested' }
  | { readonly type: 'start_succeeded'; readonly liveSessionId: string }
  | { readonly type: 'start_failed'; readonly viewerSafeErrorText: string }
  | { readonly type: 'end_requested' }
  | { readonly type: 'end_succeeded' };

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

    default:
      return state;
  }
}

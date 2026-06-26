export type LiveSessionWatchSubmission = 'idle' | 'joining' | 'leaving' | 'ending';
export type LiveSessionWatchMutationKind = 'join' | 'leave' | 'end';

export type LiveSessionWatchState = {
  readonly activeSessionId: string | null;
  readonly error: string | null;
  readonly isJoined: boolean;
  readonly submission: LiveSessionWatchSubmission;
};

export type LiveSessionWatchPendingMutation = {
  readonly kind: LiveSessionWatchMutationKind;
  readonly sessionId: string;
};

export type LiveSessionWatchAction =
  | { readonly type: 'join_started'; readonly sessionId: string }
  | { readonly type: 'join_succeeded'; readonly sessionId: string }
  | { readonly type: 'join_failed'; readonly sessionId: string; readonly error: string }
  | { readonly type: 'leave_started'; readonly sessionId: string }
  | { readonly type: 'leave_succeeded'; readonly sessionId: string }
  | { readonly type: 'leave_failed'; readonly sessionId: string; readonly error: string }
  | { readonly type: 'membership_lost'; readonly sessionId: string }
  | { readonly type: 'end_started'; readonly sessionId: string }
  | { readonly type: 'end_succeeded'; readonly sessionId: string }
  | { readonly type: 'end_failed'; readonly sessionId: string; readonly error: string }
  | { readonly type: 'session_changed'; readonly sessionId: string };

export function createLiveSessionWatchState(): LiveSessionWatchState {
  return {
    activeSessionId: null,
    error: null,
    isJoined: false,
    submission: 'idle',
  };
}

export function readLiveSessionWatchSubmission(
  state: LiveSessionWatchState,
  sessionId: string,
): LiveSessionWatchSubmission {
  return state.activeSessionId === sessionId ? state.submission : 'idle';
}

export function isLiveSessionWatchMutationPending(
  pendingMutation: LiveSessionWatchPendingMutation | null,
  sessionId: string,
  kind: LiveSessionWatchMutationKind,
): boolean {
  return (
    pendingMutation?.sessionId === sessionId && pendingMutation.kind === kind
  );
}

export function isLiveSessionWatchAnyMutationPending(
  pendingMutation: LiveSessionWatchPendingMutation | null,
  sessionId: string,
): boolean {
  return pendingMutation?.sessionId === sessionId;
}

export function clearLiveSessionWatchPendingMutation(
  pendingMutation: LiveSessionWatchPendingMutation | null,
  sessionId: string,
  kind: LiveSessionWatchMutationKind,
): LiveSessionWatchPendingMutation | null {
  return isLiveSessionWatchMutationPending(pendingMutation, sessionId, kind)
    ? null
    : pendingMutation;
}

export function shouldAutoLeaveLiveSession(
  state: LiveSessionWatchState,
  sessionId: string,
  pendingMutation: LiveSessionWatchPendingMutation | null,
): boolean {
  return (
    state.activeSessionId === sessionId &&
    state.isJoined &&
    state.submission === 'idle' &&
    !isLiveSessionWatchAnyMutationPending(pendingMutation, sessionId)
  );
}

export function liveSessionWatchReducer(
  state: LiveSessionWatchState,
  action: LiveSessionWatchAction,
): LiveSessionWatchState {
  switch (action.type) {
    case 'session_changed':
      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: false,
        submission: 'idle',
      };

    case 'join_started':
      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: false,
        submission: 'joining',
      };

    case 'join_succeeded':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: true,
        submission: 'idle',
      };

    case 'join_failed':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: action.error,
        isJoined: false,
        submission: 'idle',
      };

    case 'leave_started':
      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: state.isJoined,
        submission: 'leaving',
      };

    case 'leave_succeeded':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: false,
        submission: 'idle',
      };

    case 'leave_failed':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: action.error,
        isJoined: true,
        submission: 'idle',
      };

    case 'membership_lost':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: false,
        submission: 'idle',
      };

    case 'end_started':
      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined:
          state.activeSessionId === action.sessionId ? state.isJoined : false,
        submission: 'ending',
      };

    case 'end_succeeded':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: null,
        isJoined: false,
        submission: 'idle',
      };

    case 'end_failed':
      if (state.activeSessionId !== action.sessionId) {
        return state;
      }

      return {
        activeSessionId: action.sessionId,
        error: action.error,
        isJoined: state.isJoined,
        submission: 'idle',
      };

    default:
      return state;
  }
}

export type FollowRequestActionKind = 'accept' | 'decline';

export type FollowRequestState = {
  activeAction: {
    action: FollowRequestActionKind;
    requestId: string;
  } | null;
  dismissedRequestIds: Record<string, true>;
  errorsByRequestId: Record<string, string>;
};

export type FollowRequestAction =
  | {
      type: 'start';
      action: FollowRequestActionKind;
      requestId: string;
    }
  | {
      type: 'success';
      requestId: string;
    }
  | {
      type: 'error';
      requestId: string;
      message: string;
    };

export function createFollowRequestState(): FollowRequestState {
  return {
    activeAction: null,
    dismissedRequestIds: {},
    errorsByRequestId: {},
  };
}

export function followRequestReducer(
  state: FollowRequestState,
  action: FollowRequestAction,
): FollowRequestState {
  switch (action.type) {
    case 'start':
      if (state.activeAction) {
        return state;
      }

      return {
        activeAction: {
          action: action.action,
          requestId: action.requestId,
        },
        dismissedRequestIds: state.dismissedRequestIds,
        errorsByRequestId: removeRequestError(
          state.errorsByRequestId,
          action.requestId,
        ),
      };

    case 'success':
      return {
        activeAction: null,
        dismissedRequestIds: {
          ...state.dismissedRequestIds,
          [action.requestId]: true,
        },
        errorsByRequestId: removeRequestError(
          state.errorsByRequestId,
          action.requestId,
        ),
      };

    case 'error':
      return {
        activeAction: null,
        dismissedRequestIds: state.dismissedRequestIds,
        errorsByRequestId: {
          ...state.errorsByRequestId,
          [action.requestId]: action.message,
        },
      };

    default:
      return state;
  }
}

export function isFollowRequestDismissed(
  state: FollowRequestState,
  requestId: string,
): boolean {
  return state.dismissedRequestIds[requestId] === true;
}

function removeRequestError(
  errorsByRequestId: Record<string, string>,
  requestId: string,
): Record<string, string> {
  const { [requestId]: _removed, ...rest } = errorsByRequestId;
  return rest;
}

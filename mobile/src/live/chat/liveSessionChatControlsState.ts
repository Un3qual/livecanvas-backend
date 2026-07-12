import type { LiveSessionTimelineHistoryRow } from '../liveSessionTimelineHistory';

export type LiveSessionChatControlAction = 'edit' | 'remove';

export type LiveSessionChatPendingOperation = {
  readonly action: LiveSessionChatControlAction;
  readonly attemptId: number;
};

export type LiveSessionChatControlsState = {
  readonly errorsByEventId: Readonly<Record<string, string>>;
  readonly pendingByEventId: Readonly<
    Record<string, LiveSessionChatPendingOperation>
  >;
  readonly removedEventIds: Readonly<Record<string, true>>;
};

type OperationAction = {
  readonly action: LiveSessionChatControlAction;
  readonly attemptId: number;
  readonly eventId: string;
};

export type LiveSessionChatControlsAction =
  | (OperationAction & { readonly type: 'operation_started' })
  | (OperationAction & { readonly type: 'operation_succeeded' })
  | (OperationAction & {
      readonly message: string;
      readonly type: 'operation_failed';
    })
  | { readonly eventId: string; readonly type: 'row_error_cleared' }
  | { readonly type: 'reset' };

type EditEligibilityInput = {
  readonly row: LiveSessionTimelineHistoryRow;
  readonly sessionStatus: string | null;
  readonly viewerId: string | null;
};

type RemoveEligibilityInput = EditEligibilityInput & {
  readonly hostId: string | null;
};

export function createLiveSessionChatControlsState(): LiveSessionChatControlsState {
  return {
    errorsByEventId: {},
    pendingByEventId: {},
    removedEventIds: {},
  };
}

export function canEditChatRow({
  row,
  sessionStatus,
  viewerId,
}: EditEligibilityInput): boolean {
  return (
    sessionStatus !== 'ENDED' &&
    viewerId != null &&
    row.__typename === 'ChatMessageEvent' &&
    row.actor?.id === viewerId
  );
}

export function canRemoveChatRow({
  hostId,
  row,
  sessionStatus,
  viewerId,
}: RemoveEligibilityInput): boolean {
  return (
    sessionStatus !== 'ENDED' &&
    viewerId != null &&
    hostId === viewerId &&
    row.__typename === 'ChatMessageEvent'
  );
}

export function liveSessionChatControlsReducer(
  state: LiveSessionChatControlsState,
  action: LiveSessionChatControlsAction,
): LiveSessionChatControlsState {
  switch (action.type) {
    case 'operation_started':
      if (
        state.removedEventIds[action.eventId] ||
        state.pendingByEventId[action.eventId]
      ) {
        return state;
      }

      return {
        ...state,
        errorsByEventId: omitKey(state.errorsByEventId, action.eventId),
        pendingByEventId: {
          ...state.pendingByEventId,
          [action.eventId]: {
            action: action.action,
            attemptId: action.attemptId,
          },
        },
      };

    case 'operation_succeeded':
      if (
        state.removedEventIds[action.eventId] ||
        !isCurrentOperation(state, action)
      ) {
        return state;
      }

      return {
        ...state,
        errorsByEventId: omitKey(state.errorsByEventId, action.eventId),
        pendingByEventId: omitKey(state.pendingByEventId, action.eventId),
        removedEventIds:
          action.action === 'remove'
            ? { ...state.removedEventIds, [action.eventId]: true }
            : state.removedEventIds,
      };

    case 'operation_failed':
      if (
        state.removedEventIds[action.eventId] ||
        !isCurrentOperation(state, action)
      ) {
        return state;
      }

      return {
        ...state,
        errorsByEventId: {
          ...state.errorsByEventId,
          [action.eventId]: action.message,
        },
        pendingByEventId: omitKey(state.pendingByEventId, action.eventId),
      };

    case 'row_error_cleared':
      if (!state.errorsByEventId[action.eventId]) {
        return state;
      }

      return {
        ...state,
        errorsByEventId: omitKey(state.errorsByEventId, action.eventId),
      };

    case 'reset':
      return createLiveSessionChatControlsState();

    default:
      return state;
  }
}

export function liveSessionChatControlErrorMessage(error: unknown): string {
  if (typeof error !== 'string') {
    return 'Could not update this message. Try again.';
  }

  switch (error) {
    case 'not_authorized':
      return 'You cannot change this message.';
    case 'session_ended':
      return 'This live session has ended.';
    case 'hidden':
    case 'not_found':
      return 'This message is no longer available. Refresh the chat.';
    case 'unauthenticated':
      return 'Sign in again to continue.';
    case 'invalid_id':
    case 'invalid_type':
    case 'is invalid':
    case 'not_chat_message':
      return 'Check the message and try again.';
    default:
      return 'Could not update this message. Try again.';
  }
}

function isCurrentOperation(
  state: LiveSessionChatControlsState,
  operation: OperationAction,
): boolean {
  const pending = state.pendingByEventId[operation.eventId];

  return (
    pending?.action === operation.action &&
    pending.attemptId === operation.attemptId
  );
}

function omitKey<T>(
  record: Readonly<Record<string, T>>,
  keyToOmit: string,
): Readonly<Record<string, T>> {
  if (!(keyToOmit in record)) {
    return record;
  }

  const next: Record<string, T> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key !== keyToOmit) {
      next[key] = value;
    }
  }

  return next;
}

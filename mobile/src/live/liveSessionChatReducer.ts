import type {
  LiveSessionRealtimeEvent,
  LiveSessionTimelineEventPayload,
} from './liveSessionRealtimeEvents';
import type {
  LiveSessionTimelineHistory,
  LiveSessionTimelineHistoryPageInfo,
  LiveSessionTimelineHistoryRow,
} from './liveSessionTimelineHistory';

export type LiveSessionChatChannelStatus =
  | 'closed'
  | 'errored'
  | 'idle'
  | 'joined'
  | 'joining';

export type LiveSessionChatSendStatus = 'failed' | 'idle' | 'sending';

export type LiveSessionChatState = {
  readonly activeSessionId: string | null;
  readonly channelError: string | null;
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly eventIds: ReadonlyArray<string>;
  readonly eventsById: Readonly<Record<string, LiveSessionTimelineHistoryRow>>;
  readonly pageInfo: LiveSessionTimelineHistoryPageInfo | null;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export type LiveSessionChatAction =
  | {
      readonly sessionId: string;
      readonly type: 'session_changed';
    }
  | {
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
      readonly type:
        | 'retained_initial_loaded'
        | 'retained_newer_loaded'
        | 'retained_older_loaded';
    }
  | {
      readonly event: LiveSessionRealtimeEvent;
      readonly sessionId: string;
      readonly type: 'realtime_event_received';
    }
  | {
      readonly error?: string | null;
      readonly sessionId: string;
      readonly status: LiveSessionChatChannelStatus;
      readonly type: 'channel_status_changed';
    }
  | {
      readonly sessionId: string;
      readonly type: 'send_cancelled' | 'send_started' | 'send_succeeded';
    }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'send_failed';
    };

export type LiveSessionChatPaginationCursors = {
  readonly endCursor: string | null;
  readonly startCursor: string | null;
};

export type LiveSessionChatSendStartInput = {
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly hasPendingSend: boolean;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export function createLiveSessionChatState(): LiveSessionChatState {
  return {
    activeSessionId: null,
    channelError: null,
    channelStatus: 'idle',
    eventIds: [],
    eventsById: {},
    pageInfo: null,
    sendError: null,
    sendStatus: 'idle',
  };
}

export function liveSessionChatReducer(
  state: LiveSessionChatState,
  action: LiveSessionChatAction,
): LiveSessionChatState {
  switch (action.type) {
    case 'session_changed':
      return {
        activeSessionId: action.sessionId,
        channelError: null,
        channelStatus: 'idle',
        eventIds: [],
        eventsById: {},
        pageInfo: null,
        sendError: null,
        sendStatus: 'idle',
      };

    case 'retained_initial_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...(state.eventIds.length === 0
          ? replaceWithRows(action.history.rows)
          : mergeRetainedRefreshRows(state, action.history.rows)),
        pageInfo:
          state.eventIds.length === 0
            ? action.history.pageInfo
            : mergeRetainedInitialPageInfo(state, action.history),
      };

    case 'retained_older_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...prependRows(state, action.history.rows),
        pageInfo: mergeOlderPageInfo(state.pageInfo, action.history.pageInfo),
      };

    case 'retained_newer_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...appendRows(state, action.history.rows),
        pageInfo: mergeNewerPageInfo(state.pageInfo, action.history.pageInfo),
      };

    case 'realtime_event_received':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return mergeRealtimeEvent(state, action.event);

    case 'channel_status_changed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        channelError: action.error ?? null,
        channelStatus: action.status,
      };

    case 'send_started':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'sending',
      };

    case 'send_succeeded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'idle',
      };

    case 'send_cancelled':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'idle',
      };

    case 'send_failed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: action.error,
        sendStatus: 'failed',
      };

    default:
      return state;
  }
}

export function selectLiveSessionChatVisibleRows(
  state: LiveSessionChatState,
): ReadonlyArray<LiveSessionTimelineHistoryRow> {
  return state.eventIds.flatMap((eventId) => {
    const row = state.eventsById[eventId];

    return row ? [row] : [];
  });
}

export function selectLiveSessionChatPaginationPageInfo(
  state: LiveSessionChatState,
): LiveSessionTimelineHistoryPageInfo | null {
  return state.pageInfo;
}

export function selectLiveSessionChatPaginationCursors(
  state: LiveSessionChatState,
): LiveSessionChatPaginationCursors {
  return {
    endCursor: state.pageInfo?.endCursor ?? null,
    startCursor: state.pageInfo?.startCursor ?? null,
  };
}

export function selectLiveSessionChatChannelStatus(
  state: LiveSessionChatState,
): LiveSessionChatChannelStatus {
  return state.channelStatus;
}

export function selectLiveSessionChatSendStatus(
  state: LiveSessionChatState,
): LiveSessionChatSendStatus {
  return state.sendStatus;
}

export function selectLiveSessionChatSendError(
  state: LiveSessionChatState,
): string | null {
  return state.sendError;
}

export function canStartLiveSessionChatSend({
  channelStatus,
  hasPendingSend,
  sendStatus,
}: LiveSessionChatSendStartInput): boolean {
  return (
    channelStatus === 'joined' &&
    !hasPendingSend &&
    sendStatus !== 'sending'
  );
}

function isActiveSessionAction(
  state: LiveSessionChatState,
  sessionId: string,
): boolean {
  return state.activeSessionId === sessionId;
}

function replaceWithRows(
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds: Array<string> = [];
  const eventsById: Record<string, LiveSessionTimelineHistoryRow> = {};

  for (const row of rows) {
    if (!eventsById[row.id]) {
      eventIds.push(row.id);
    }

    eventsById[row.id] = row;
  }

  return { eventIds, eventsById };
}

function mergeRetainedRefreshRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventsById = { ...state.eventsById };
  const incomingIds = new Set<string>();
  const incomingEventIds: Array<string> = [];

  for (const row of rows) {
    if (incomingIds.has(row.id)) {
      eventsById[row.id] = row;
      continue;
    }

    incomingIds.add(row.id);
    incomingEventIds.push(row.id);

    eventsById[row.id] = row;
  }

  if (incomingEventIds.length === 0) {
    return {
      eventIds: state.eventIds,
      eventsById,
    };
  }

  const overlapIndexes = incomingEventIds
    .map((eventId) => state.eventIds.indexOf(eventId))
    .filter((index) => index >= 0);

  if (overlapIndexes.length > 0) {
    const firstOverlapIndex = Math.min(...overlapIndexes);
    const lastOverlapIndex = Math.max(...overlapIndexes);

    return {
      eventIds: [
        ...state.eventIds
          .slice(0, firstOverlapIndex)
          .filter((eventId) => !incomingIds.has(eventId)),
        ...incomingEventIds,
        ...state.eventIds
          .slice(lastOverlapIndex + 1)
          .filter((eventId) => !incomingIds.has(eventId)),
      ],
      eventsById,
    };
  }

  const insertionIndex = findRetainedRefreshInsertionIndex(
    state,
    eventsById[incomingEventIds[0]],
  );

  if (insertionIndex === -1) {
    return {
      eventIds: [...state.eventIds, ...incomingEventIds],
      eventsById,
    };
  }

  return {
    eventIds: [
      ...state.eventIds.slice(0, insertionIndex),
      ...incomingEventIds,
      ...state.eventIds.slice(insertionIndex),
    ],
    eventsById,
  };
}

function findRetainedRefreshInsertionIndex(
  state: LiveSessionChatState,
  firstIncomingRow: LiveSessionTimelineHistoryRow | undefined,
): number {
  if (!firstIncomingRow) {
    return -1;
  }

  return state.eventIds.findIndex((eventId) => {
    const row = state.eventsById[eventId];

    return row !== undefined && row.occurredAt >= firstIncomingRow.occurredAt;
  });
}

function prependRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds = new Set(state.eventIds);
  const eventsById = { ...state.eventsById };
  const prependedIds: Array<string> = [];

  for (const row of rows) {
    if (!eventIds.has(row.id)) {
      prependedIds.push(row.id);
      eventIds.add(row.id);
    }

    eventsById[row.id] = row;
  }

  return {
    eventIds: [...prependedIds, ...state.eventIds],
    eventsById,
  };
}

function appendRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds = new Set(state.eventIds);
  const eventsById = { ...state.eventsById };
  const appendedIds: Array<string> = [];

  for (const row of rows) {
    if (!eventIds.has(row.id)) {
      appendedIds.push(row.id);
      eventIds.add(row.id);
    }

    eventsById[row.id] = row;
  }

  return {
    eventIds: [...state.eventIds, ...appendedIds],
    eventsById,
  };
}

function mergeRealtimeEvent(
  state: LiveSessionChatState,
  event: LiveSessionRealtimeEvent,
): LiveSessionChatState {
  switch (event.kind) {
    case 'timeline_event':
      return mergeRealtimeTimelineEvent(state, event.event, 'append_or_replace');

    case 'timeline_event_updated':
      return mergeRealtimeTimelineEvent(state, event.event, 'replace_existing');

    case 'timeline_event_removed':
      return removeRealtimeTimelineEvent(state, event.removedTimelineEventId);

    default:
      return state;
  }
}

function mergeRealtimeTimelineEvent(
  state: LiveSessionChatState,
  event: LiveSessionTimelineEventPayload,
  mode: 'append_or_replace' | 'replace_existing',
): LiveSessionChatState {
  const row = readRealtimeTimelineRow(event);

  if (!row) {
    return state;
  }

  const eventExists = state.eventsById[row.id] !== undefined;
  const nextRow = eventExists
    ? {
        ...row,
        cursor: state.eventsById[row.id]?.cursor ?? row.cursor,
      }
    : row;

  if (!eventExists && mode === 'replace_existing') {
    return state;
  }

  return {
    ...state,
    eventIds: eventExists ? state.eventIds : [...state.eventIds, nextRow.id],
    eventsById: {
      ...state.eventsById,
      [nextRow.id]: nextRow,
    },
  };
}

function removeRealtimeTimelineEvent(
  state: LiveSessionChatState,
  removedTimelineEventId: string,
): LiveSessionChatState {
  if (!state.eventsById[removedTimelineEventId]) {
    return state;
  }

  const eventsById: Record<string, LiveSessionTimelineHistoryRow> = {};

  for (const [eventId, row] of Object.entries(state.eventsById)) {
    if (eventId !== removedTimelineEventId) {
      eventsById[eventId] = row;
    }
  }

  return {
    ...state,
    eventIds: state.eventIds.filter(
      (eventId) => eventId !== removedTimelineEventId,
    ),
    eventsById,
  };
}

function readRealtimeTimelineRow(
  event: LiveSessionTimelineEventPayload,
): LiveSessionTimelineHistoryRow | null {
  const base = {
    __typename: event.__typename,
    actor: event.actor,
    cursor: null,
    eventType: event.eventType,
    id: event.id,
    occurredAt: event.occurredAt,
  };

  switch (event.__typename) {
    case 'ChatMessageEvent':
      if (
        typeof event.body !== 'string' ||
        typeof event.edited !== 'boolean' ||
        typeof event.editCount !== 'number'
      ) {
        return null;
      }

      return {
        ...base,
        __typename: 'ChatMessageEvent',
        body: event.body,
        editCount: event.editCount,
        edited: event.edited,
        editedAt: event.editedAt,
        kind: 'chat_message',
      };

    case 'LiveSessionEndedEvent':
      return {
        ...base,
        __typename: 'LiveSessionEndedEvent',
        kind: 'lifecycle',
        label: 'Live ended',
      };

    case 'LiveSessionStartedEvent':
      return {
        ...base,
        __typename: 'LiveSessionStartedEvent',
        kind: 'lifecycle',
        label: 'Live started',
      };

    default:
      return {
        ...base,
        kind: 'unknown',
        label: 'Timeline event',
      };
  }
}

function mergeRetainedInitialPageInfo(
  state: LiveSessionChatState,
  history: LiveSessionTimelineHistory,
): LiveSessionTimelineHistoryPageInfo | null {
  if (!history.pageInfo) {
    return state.pageInfo;
  }

  if (!state.pageInfo) {
    return history.pageInfo;
  }

  if (history.rows.length === 0) {
    return state.pageInfo;
  }

  const firstLoadedEventId = state.eventIds[0];
  const refreshStillContainsFirstLoadedEvent = history.rows.some(
    (row) => row.id === firstLoadedEventId,
  );

  if (refreshStillContainsFirstLoadedEvent) {
    return history.pageInfo;
  }

  return mergeNewerPageInfo(state.pageInfo, history.pageInfo);
}

function mergeOlderPageInfo(
  current: LiveSessionTimelineHistoryPageInfo | null,
  incoming: LiveSessionTimelineHistoryPageInfo | null,
): LiveSessionTimelineHistoryPageInfo | null {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return {
    endCursor: current.endCursor,
    hasNextPage: current.hasNextPage,
    hasPreviousPage: incoming.hasPreviousPage,
    startCursor: incoming.startCursor,
  };
}

function mergeNewerPageInfo(
  current: LiveSessionTimelineHistoryPageInfo | null,
  incoming: LiveSessionTimelineHistoryPageInfo | null,
): LiveSessionTimelineHistoryPageInfo | null {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  return {
    endCursor: incoming.endCursor,
    hasNextPage: incoming.hasNextPage,
    hasPreviousPage: current.hasPreviousPage,
    startCursor: current.startCursor,
  };
}

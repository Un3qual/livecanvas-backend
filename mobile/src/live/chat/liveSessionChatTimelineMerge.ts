import type {
  LiveSessionRealtimeEvent,
  LiveSessionTimelineEventPayload,
} from '../liveSessionRealtimeEvents';
import type {
  LiveSessionTimelineHistory,
  LiveSessionTimelineHistoryPageInfo,
  LiveSessionTimelineHistoryRow,
} from '../liveSessionTimelineHistory';
import type {
  LiveSessionChatMutationUpdate,
  LiveSessionChatState,
} from './liveSessionChatState';

export function replaceWithRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds: Array<string> = [];
  const eventsById: Record<string, LiveSessionTimelineHistoryRow> = {};

  for (const row of rows) {
    if (state.removedEventIds[row.id]) {
      continue;
    }

    if (!eventsById[row.id]) {
      eventIds.push(row.id);
    }

    eventsById[row.id] = row;
  }

  return { eventIds, eventsById };
}

export function mergeRetainedRefreshRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventsById = { ...state.eventsById };
  const incomingIds = new Set<string>();
  const incomingEventIds: Array<string> = [];

  for (const row of rows) {
    if (state.removedEventIds[row.id]) {
      continue;
    }

    const preferredRow = preferMonotonicChatRow(eventsById[row.id], row);

    if (incomingIds.has(row.id)) {
      eventsById[row.id] = preferredRow;
      continue;
    }

    incomingIds.add(row.id);
    incomingEventIds.push(row.id);

    eventsById[row.id] = preferredRow;
  }

  if (incomingEventIds.length === 0) {
    return {
      eventIds: state.eventIds,
      eventsById,
    };
  }

  return {
    eventIds: sortTimelineEventIds({
      eventIds: mergeRetainedRefreshEventIds(
        state.eventIds,
        incomingEventIds,
        incomingIds,
      ),
      eventsById,
    }),
    eventsById,
  };
}

function mergeRetainedRefreshEventIds(
  stateEventIds: ReadonlyArray<string>,
  incomingEventIds: ReadonlyArray<string>,
  incomingIds: ReadonlySet<string>,
): ReadonlyArray<string> {
  // Retained refreshes may overlap already-seen realtime rows. Replace only the
  // overlapped window, then sort by occurrence time so missed retained rows can
  // interleave with realtime messages outside the window.
  const stateEventIndex = readEventIdOrder(stateEventIds);
  let firstOverlapIndex: number | null = null;
  let lastOverlapIndex: number | null = null;

  for (const incomingEventId of incomingEventIds) {
    const overlapIndex = stateEventIndex.get(incomingEventId);

    if (overlapIndex === undefined) {
      continue;
    }

    firstOverlapIndex =
      firstOverlapIndex === null
        ? overlapIndex
        : Math.min(firstOverlapIndex, overlapIndex);
    lastOverlapIndex =
      lastOverlapIndex === null
        ? overlapIndex
        : Math.max(lastOverlapIndex, overlapIndex);
  }

  if (firstOverlapIndex !== null && lastOverlapIndex !== null) {
    return [
      ...stateEventIds
        .slice(0, firstOverlapIndex)
        .filter((eventId) => !incomingIds.has(eventId)),
      ...incomingEventIds,
      ...stateEventIds
        .slice(lastOverlapIndex + 1)
        .filter((eventId) => !incomingIds.has(eventId)),
    ];
  }

  const mergedIds = [...stateEventIds];
  const mergedIdSet = new Set(mergedIds);

  for (const incomingEventId of incomingEventIds) {
    if (!mergedIdSet.has(incomingEventId)) {
      mergedIds.push(incomingEventId);
      mergedIdSet.add(incomingEventId);
    }
  }

  return mergedIds;
}

type SortTimelineEventIdsInput = {
  readonly eventIds: ReadonlyArray<string>;
  readonly eventsById: Readonly<Record<string, LiveSessionTimelineHistoryRow>>;
};

function sortTimelineEventIds({
  eventIds,
  eventsById,
}: SortTimelineEventIdsInput): ReadonlyArray<string> {
  const eventOrder = readEventIdOrder(eventIds);

  return [...eventIds].sort((leftEventId, rightEventId) => {
    const leftRow = eventsById[leftEventId];
    const rightRow = eventsById[rightEventId];

    if (!leftRow || !rightRow) {
      return readEventOrder(leftEventId, eventOrder) -
        readEventOrder(rightEventId, eventOrder);
    }

    const occurredAtOrder = leftRow.occurredAt.localeCompare(rightRow.occurredAt);

    if (occurredAtOrder !== 0) {
      return occurredAtOrder;
    }

    return readEventOrder(leftEventId, eventOrder) -
      readEventOrder(rightEventId, eventOrder);
  });
}

function readEventIdOrder(
  eventIds: ReadonlyArray<string>,
): ReadonlyMap<string, number> {
  return new Map(eventIds.map((eventId, index) => [eventId, index]));
}

function readEventOrder(
  eventId: string,
  eventOrder: ReadonlyMap<string, number>,
): number {
  return eventOrder.get(eventId) ?? Number.MAX_SAFE_INTEGER;
}

export function prependRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds = new Set(state.eventIds);
  const eventsById = { ...state.eventsById };
  const prependedIds: Array<string> = [];

  for (const row of rows) {
    if (state.removedEventIds[row.id]) {
      continue;
    }

    if (!eventIds.has(row.id)) {
      prependedIds.push(row.id);
      eventIds.add(row.id);
    }

    eventsById[row.id] = preferMonotonicChatRow(eventsById[row.id], row);
  }

  return {
    eventIds: [...prependedIds, ...state.eventIds],
    eventsById,
  };
}

export function appendRows(
  state: LiveSessionChatState,
  rows: ReadonlyArray<LiveSessionTimelineHistoryRow>,
): Pick<LiveSessionChatState, 'eventIds' | 'eventsById'> {
  const eventIds = new Set(state.eventIds);
  const eventsById = { ...state.eventsById };
  const appendedIds: Array<string> = [];

  for (const row of rows) {
    if (state.removedEventIds[row.id]) {
      continue;
    }

    if (!eventIds.has(row.id)) {
      appendedIds.push(row.id);
      eventIds.add(row.id);
    }

    eventsById[row.id] = preferMonotonicChatRow(eventsById[row.id], row);
  }

  return {
    eventIds: [...state.eventIds, ...appendedIds],
    eventsById,
  };
}

export function mergeRealtimeEvent(
  state: LiveSessionChatState,
  event: LiveSessionRealtimeEvent,
): LiveSessionChatState {
  switch (event.kind) {
    case 'timeline_event':
      return mergeRealtimeTimelineEvent(state, event.event, 'append_or_replace');

    case 'timeline_event_updated':
      return mergeRealtimeTimelineEvent(state, event.event, 'replace_existing');

    case 'timeline_event_removed':
      return removeTimelineEvent(state, event.removedTimelineEventId);

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

  if (state.removedEventIds[row.id]) {
    return state;
  }

  const eventExists = state.eventsById[row.id] !== undefined;
  const existingRow = state.eventsById[row.id];

  if (
    existingRow?.kind === 'chat_message' &&
    row.kind === 'chat_message' &&
    (row.editCount < existingRow.editCount ||
      (mode === 'replace_existing' && row.editCount === existingRow.editCount))
  ) {
    return state;
  }

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

export function mergeConfirmedTimelineUpdate(
  state: LiveSessionChatState,
  update: LiveSessionChatMutationUpdate,
): LiveSessionChatState {
  const current = state.eventsById[update.id];

  if (
    current?.kind !== 'chat_message' ||
    update.editCount <= current.editCount
  ) {
    return state;
  }

  return {
    ...state,
    eventsById: {
      ...state.eventsById,
      [update.id]: {
        ...current,
        actor: update.actor,
        body: update.body,
        editCount: update.editCount,
        edited: update.edited,
        editedAt: update.editedAt,
      },
    },
  };
}

export function removeTimelineEvent(
  state: LiveSessionChatState,
  removedTimelineEventId: string,
): LiveSessionChatState {
  if (
    state.removedEventIds[removedTimelineEventId] &&
    !state.eventsById[removedTimelineEventId]
  ) {
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
    removedEventIds: {
      ...state.removedEventIds,
      [removedTimelineEventId]: true,
    },
  };
}

function preferMonotonicChatRow(
  existingRow: LiveSessionTimelineHistoryRow | undefined,
  incomingRow: LiveSessionTimelineHistoryRow,
): LiveSessionTimelineHistoryRow {
  if (
    existingRow?.kind === 'chat_message' &&
    incomingRow.kind === 'chat_message' &&
    incomingRow.editCount < existingRow.editCount
  ) {
    return existingRow;
  }

  return incomingRow;
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

export function mergeRetainedInitialPageInfo(
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

  // If the refresh still includes our oldest loaded row, its pageInfo describes
  // the whole retained window. Otherwise, keep older-page knowledge and merge
  // only the refreshed newer edge.
  if (refreshStillContainsFirstLoadedEvent) {
    return history.pageInfo;
  }

  return mergeNewerPageInfo(state.pageInfo, history.pageInfo);
}

export function mergeOlderPageInfo(
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

export function mergeNewerPageInfo(
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

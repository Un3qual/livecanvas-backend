type JsonRecord = Record<string, unknown>;

export type LiveSessionTimelineEventPayload = {
  readonly __typename: string;
  readonly id: string;
  readonly eventType: string;
  readonly body: string | null;
  readonly actorId: number | null;
  readonly occurredAt: string;
  readonly edited: boolean | null;
  readonly editCount: number | null;
  readonly editedAt: string | null;
};

export type LiveSessionRealtimeEvent =
  | {
      readonly kind: 'session_state';
      readonly status: 'STARTING' | 'LIVE' | 'ENDED';
      readonly visibility: 'PUBLIC' | 'FOLLOWERS';
      readonly viewerCount: number;
    }
  | {
      readonly kind: 'timeline_event';
      readonly event: LiveSessionTimelineEventPayload;
    }
  | {
      readonly kind: 'timeline_event_updated';
      readonly event: LiveSessionTimelineEventPayload;
    }
  | {
      readonly kind: 'timeline_event_removed';
      readonly removedTimelineEventId: string;
    };

export function normalizeLiveSessionRealtimeEvent(
  eventName: string,
  payload: unknown,
): LiveSessionRealtimeEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (eventName === 'session:state') {
    return normalizeSessionState(payload);
  }

  if (eventName === 'timeline:event' || eventName === 'timeline:event_updated') {
    const event = normalizeTimelineEvent(payload.event);
    if (!event) {
      return null;
    }

    return {
      kind:
        eventName === 'timeline:event'
          ? 'timeline_event'
          : 'timeline_event_updated',
      event,
    };
  }

  if (eventName === 'timeline:event_removed') {
    return isNonBlankString(payload.removed_timeline_event_id)
      ? {
          kind: 'timeline_event_removed',
          removedTimelineEventId: payload.removed_timeline_event_id,
        }
      : null;
  }

  return null;
}

function normalizeSessionState(
  payload: JsonRecord,
): LiveSessionRealtimeEvent | null {
  const sessionState = payload.session_state;

  if (!isRecord(sessionState)) {
    return null;
  }

  const status = normalizeRealtimeStatus(sessionState.status);
  const visibility = normalizeRealtimeVisibility(sessionState.visibility);
  const viewerCount = sessionState.viewer_count;

  if (!status || !visibility || !isNonNegativeInteger(viewerCount)) {
    return null;
  }

  return {
    kind: 'session_state',
    status,
    visibility,
    viewerCount,
  };
}

function normalizeTimelineEvent(
  value: unknown,
): LiveSessionTimelineEventPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.__typename !== 'string' ||
    !isNonBlankString(value.id) ||
    typeof value.event_type !== 'string' ||
    typeof value.occurred_at !== 'string' ||
    !isNullableString(value.body) ||
    !isNullablePositiveInteger(value.actor_id) ||
    !isNullableBoolean(value.edited) ||
    !isNullableNonNegativeInteger(value.edit_count) ||
    !isNullableString(value.edited_at)
  ) {
    return null;
  }

  return {
    __typename: value.__typename,
    id: value.id,
    eventType: value.event_type,
    body: value.body,
    actorId: value.actor_id,
    occurredAt: value.occurred_at,
    edited: value.edited,
    editCount: value.edit_count,
    editedAt: value.edited_at,
  };
}

function normalizeRealtimeStatus(
  value: unknown,
): 'STARTING' | 'LIVE' | 'ENDED' | null {
  switch (value) {
    case 'starting':
      return 'STARTING';
    case 'live':
      return 'LIVE';
    case 'ended':
      return 'ENDED';
    default:
      return null;
  }
}

function normalizeRealtimeVisibility(
  value: unknown,
): 'PUBLIC' | 'FOLLOWERS' | null {
  switch (value) {
    case 'public':
      return 'PUBLIC';
    case 'followers':
      return 'FOLLOWERS';
    default:
      return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isNullableNonNegativeInteger(
  value: unknown,
): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

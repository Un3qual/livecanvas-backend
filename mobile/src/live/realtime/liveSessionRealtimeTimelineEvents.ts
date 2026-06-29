import {
  isNonBlankString,
  isNonNegativeInteger,
  isNullableBoolean,
  isNullableNonNegativeInteger,
  isNullableString,
  isRecord,
} from './liveSessionRealtimePayloadGuards';
import type {
  LiveSessionRealtimeSessionStateEvent,
  LiveSessionRealtimeTimelineEvent,
  LiveSessionRealtimeTimelineEventRemoved,
  LiveSessionRealtimeTimelineEventUpdated,
  LiveSessionTimelineEventActor,
  LiveSessionTimelineEventPayload,
} from './liveSessionRealtimeTypes';

export function readLiveSessionSessionStateEvent(
  payload: unknown,
): LiveSessionRealtimeSessionStateEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  const sessionState = payload.session_state;

  if (!isRecord(sessionState)) {
    return null;
  }

  const status = readRealtimeStatus(sessionState.status);
  const visibility = readRealtimeVisibility(sessionState.visibility);
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

export function readLiveSessionTimelineEvent(
  payload: unknown,
): LiveSessionRealtimeTimelineEvent | null {
  const event = readTimelineEventPayloadFromEnvelope(payload);

  return event
    ? {
        kind: 'timeline_event',
        event,
      }
    : null;
}

export function readLiveSessionTimelineEventUpdated(
  payload: unknown,
): LiveSessionRealtimeTimelineEventUpdated | null {
  const event = readTimelineEventPayloadFromEnvelope(payload);

  return event
    ? {
        kind: 'timeline_event_updated',
        event,
      }
    : null;
}

export function readLiveSessionTimelineEventRemoved(
  payload: unknown,
): LiveSessionRealtimeTimelineEventRemoved | null {
  if (!isRecord(payload)) {
    return null;
  }

  return isNonBlankString(payload.removed_timeline_event_id)
    ? {
        kind: 'timeline_event_removed',
        removedTimelineEventId: payload.removed_timeline_event_id,
      }
    : null;
}

function readTimelineEventPayloadFromEnvelope(
  payload: unknown,
): LiveSessionTimelineEventPayload | null {
  return isRecord(payload) ? readTimelineEventPayload(payload.event) : null;
}

function readTimelineEventPayload(
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
    !isNullableTimelineEventActor(value.actor) ||
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
    actor: value.actor,
    occurredAt: value.occurred_at,
    edited: value.edited,
    editCount: value.edit_count,
    editedAt: value.edited_at,
  };
}

function readRealtimeStatus(
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

function readRealtimeVisibility(
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

function isTimelineEventActor(
  value: unknown,
): value is LiveSessionTimelineEventActor {
  return isRecord(value) && isNonBlankString(value.id);
}

function isNullableTimelineEventActor(
  value: unknown,
): value is LiveSessionTimelineEventActor | null {
  return value === null || isTimelineEventActor(value);
}

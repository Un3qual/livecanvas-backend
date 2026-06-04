type JsonRecord = Record<string, unknown>;

export type LiveSessionTimelineEventActor = {
  readonly id: string;
};

export type LiveSessionTimelineEventPayload = {
  readonly __typename: string;
  readonly id: string;
  readonly eventType: string;
  readonly body: string | null;
  readonly actor: LiveSessionTimelineEventActor | null;
  readonly occurredAt: string;
  readonly edited: boolean | null;
  readonly editCount: number | null;
  readonly editedAt: string | null;
};

export type LiveSessionRealtimeMediaSenderRole = 'host' | 'viewer';

export type LiveSessionRealtimeMediaDescription = {
  readonly sdp: string;
  readonly type: 'offer' | 'answer';
};

export type LiveSessionRealtimeIceCandidate = {
  readonly candidate: string;
  readonly sdpMLineIndex?: number;
  readonly sdpMid?: string;
  readonly usernameFragment?: string;
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
    }
  | {
      readonly description: LiveSessionRealtimeMediaDescription;
      readonly kind: 'media_offer' | 'media_answer';
      readonly senderRole: LiveSessionRealtimeMediaSenderRole;
    }
  | {
      readonly candidate: LiveSessionRealtimeIceCandidate;
      readonly kind: 'media_ice_candidate';
      readonly senderRole: LiveSessionRealtimeMediaSenderRole;
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

  if (eventName === 'media:offer' || eventName === 'media:answer') {
    return normalizeMediaDescriptionEvent(eventName, payload);
  }

  if (eventName === 'media:ice_candidate') {
    return normalizeMediaIceCandidateEvent(payload);
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

// Media payloads are server-authored: offer/answer event names must match
// payload.type, sender_role is required, and ICE candidate fields stay strictly
// validated before returning media_offer/media_answer/media_ice_candidate.
function normalizeMediaDescriptionEvent(
  eventName: 'media:offer' | 'media:answer',
  payload: JsonRecord,
): LiveSessionRealtimeEvent | null {
  const expectedType = eventName === 'media:offer' ? 'offer' : 'answer';
  const senderRole = normalizeSenderRole(payload.sender_role);

  if (
    !senderRole ||
    payload.type !== expectedType ||
    !isNonBlankString(payload.sdp)
  ) {
    return null;
  }

  return {
    description: {
      sdp: payload.sdp,
      type: expectedType,
    },
    kind: eventName === 'media:offer' ? 'media_offer' : 'media_answer',
    senderRole,
  };
}

function normalizeMediaIceCandidateEvent(
  payload: JsonRecord,
): LiveSessionRealtimeEvent | null {
  const senderRole = normalizeSenderRole(payload.sender_role);

  if (
    !senderRole ||
    !isNonBlankString(payload.candidate) ||
    !isOptionalString(payload.sdp_mid) ||
    !isOptionalNonNegativeInteger(payload.sdp_m_line_index) ||
    !isOptionalString(payload.username_fragment)
  ) {
    return null;
  }

  return {
    candidate: {
      candidate: payload.candidate,
      ...(payload.sdp_m_line_index === undefined
        ? {}
        : { sdpMLineIndex: payload.sdp_m_line_index }),
      ...(payload.sdp_mid === undefined ? {} : { sdpMid: payload.sdp_mid }),
      ...(payload.username_fragment === undefined
        ? {}
        : { usernameFragment: payload.username_fragment }),
    },
    kind: 'media_ice_candidate',
    senderRole,
  };
}

function normalizeSenderRole(
  value: unknown,
): LiveSessionRealtimeMediaSenderRole | null {
  return value === 'host' || value === 'viewer' ? value : null;
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

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
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

function isOptionalNonNegativeInteger(
  value: unknown,
): value is number | undefined {
  return value === undefined || isNonNegativeInteger(value);
}

function isNullableNonNegativeInteger(
  value: unknown,
): value is number | null {
  return value === null || isNonNegativeInteger(value);
}

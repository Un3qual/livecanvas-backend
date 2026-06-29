import {
  isNonBlankString,
  isOptionalNonNegativeInteger,
  isOptionalString,
  isRecord,
} from './liveSessionRealtimePayloadGuards';
import type {
  LiveSessionHostMediaIceCandidateEvent,
  LiveSessionHostMediaOfferEvent,
  LiveSessionRealtimeMediaAnswerEvent,
  LiveSessionRealtimeMediaIceCandidateEvent,
  LiveSessionRealtimeMediaOfferEvent,
  LiveSessionRealtimeMediaSenderRole,
  LiveSessionRealtimeMediaViewerReadyEvent,
  LiveSessionViewerMediaAnswerEvent,
  LiveSessionViewerMediaIceCandidateEvent,
  LiveSessionViewerMediaReadyEvent,
} from './liveSessionRealtimeTypes';

type LiveSessionRealtimeMediaEvent =
  | LiveSessionRealtimeMediaOfferEvent
  | LiveSessionRealtimeMediaAnswerEvent
  | LiveSessionRealtimeMediaIceCandidateEvent
  | LiveSessionRealtimeMediaViewerReadyEvent;

export function readLiveSessionRealtimeMediaEvent(
  eventName: string,
  payload: unknown,
): LiveSessionRealtimeMediaEvent | null {
  switch (eventName) {
    case 'media:offer':
      return readMediaOfferEvent(payload);
    case 'media:answer':
      return readMediaAnswerEvent(payload);
    case 'media:ice_candidate':
      return readMediaIceCandidateEvent(payload);
    case 'media:viewer_ready':
      return readMediaViewerReadyEvent(payload);
    default:
      return null;
  }
}

export function readMediaOfferEvent(
  payload: unknown,
): LiveSessionRealtimeMediaOfferEvent | null {
  const event = readMediaDescriptionEvent('offer', payload);

  return event
    ? {
        description: event.description,
        kind: 'media_offer',
        senderRole: event.senderRole,
      }
    : null;
}

export function readMediaAnswerEvent(
  payload: unknown,
): LiveSessionRealtimeMediaAnswerEvent | null {
  const event = readMediaDescriptionEvent('answer', payload);

  return event
    ? {
        description: event.description,
        kind: 'media_answer',
        senderRole: event.senderRole,
      }
    : null;
}

export function readMediaIceCandidateEvent(
  payload: unknown,
): LiveSessionRealtimeMediaIceCandidateEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  const senderRole = readSenderRole(payload.sender_role);

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

export function readMediaViewerReadyEvent(
  payload: unknown,
): LiveSessionRealtimeMediaViewerReadyEvent | null {
  if (!isRecord(payload)) {
    return null;
  }

  const senderRole = readSenderRole(payload.sender_role);

  return senderRole
    ? {
        kind: 'media_viewer_ready',
        senderRole,
      }
    : null;
}

export function readHostMediaOfferEvent(
  payload: unknown,
): LiveSessionHostMediaOfferEvent | null {
  const event = readMediaOfferEvent(payload);

  return event?.senderRole === 'host'
    ? {
        ...event,
        senderRole: 'host',
      }
    : null;
}

export function readViewerMediaAnswerEvent(
  payload: unknown,
): LiveSessionViewerMediaAnswerEvent | null {
  const event = readMediaAnswerEvent(payload);

  return event?.senderRole === 'viewer'
    ? {
        ...event,
        senderRole: 'viewer',
      }
    : null;
}

export function readHostMediaIceCandidateEvent(
  payload: unknown,
): LiveSessionHostMediaIceCandidateEvent | null {
  const event = readMediaIceCandidateEvent(payload);

  return event?.senderRole === 'host'
    ? {
        ...event,
        senderRole: 'host',
      }
    : null;
}

export function readViewerMediaIceCandidateEvent(
  payload: unknown,
): LiveSessionViewerMediaIceCandidateEvent | null {
  const event = readMediaIceCandidateEvent(payload);

  return event?.senderRole === 'viewer'
    ? {
        ...event,
        senderRole: 'viewer',
      }
    : null;
}

export function readViewerMediaReadyEvent(
  payload: unknown,
): LiveSessionViewerMediaReadyEvent | null {
  const event = readMediaViewerReadyEvent(payload);

  return event?.senderRole === 'viewer'
    ? {
        ...event,
        senderRole: 'viewer',
      }
    : null;
}

function readMediaDescriptionEvent<Type extends 'offer' | 'answer'>(
  expectedType: Type,
  payload: unknown,
): {
  readonly description: {
    readonly sdp: string;
    readonly type: Type;
  };
  readonly senderRole: LiveSessionRealtimeMediaSenderRole;
} | null {
  if (!isRecord(payload)) {
    return null;
  }

  const senderRole = readSenderRole(payload.sender_role);

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
    senderRole,
  };
}

function readSenderRole(
  value: unknown,
): LiveSessionRealtimeMediaSenderRole | null {
  return value === 'host' || value === 'viewer' ? value : null;
}

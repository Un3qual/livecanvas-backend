import {
  normalizeLiveSessionRealtimeEvent,
  type LiveSessionRealtimeEvent,
  type LiveSessionTimelineEventPayload,
} from './liveSessionRealtimeEvents';

export type LiveSessionChannelPushStatus = 'ok' | 'error' | 'timeout';

export type LiveSessionChannelPush = {
  readonly receive: (
    status: LiveSessionChannelPushStatus,
    callback: (payload: unknown) => void,
  ) => LiveSessionChannelPush;
};

export type LiveSessionChannel = {
  readonly join: () => LiveSessionChannelPush;
  readonly leave: () => LiveSessionChannelPush;
  readonly on: (
    eventName: string,
    callback: (payload: unknown) => void,
  ) => number;
  readonly onClose?: (callback: () => void) => number;
  readonly onError?: (callback: (payload: unknown) => void) => number;
  readonly push: (
    eventName: string,
    payload: Record<string, unknown>,
  ) => LiveSessionChannelPush;
};

export type LiveSessionChannelSocket = {
  readonly channel: (
    topic: string,
    params?: Record<string, unknown>,
  ) => LiveSessionChannel;
};

export type LiveSessionSessionStateEvent = Extract<
  LiveSessionRealtimeEvent,
  { readonly kind: 'session_state' }
>;

export type LiveSessionTimelineEvent = Extract<
  LiveSessionRealtimeEvent,
  { readonly kind: 'timeline_event' }
>;

export type LiveSessionTimelineEventUpdated = Extract<
  LiveSessionRealtimeEvent,
  { readonly kind: 'timeline_event_updated' }
>;

export type LiveSessionTimelineEventRemoved = Extract<
  LiveSessionRealtimeEvent,
  { readonly kind: 'timeline_event_removed' }
>;

export type LiveSessionChannelClientOptions = {
  readonly onClose?: () => void;
  readonly onError?: (reason: string) => void;
  readonly onSessionState?: (event: LiveSessionSessionStateEvent) => void;
  readonly onTimelineEvent?: (event: LiveSessionTimelineEvent) => void;
  readonly onTimelineEventRemoved?: (
    event: LiveSessionTimelineEventRemoved,
  ) => void;
  readonly onTimelineEventUpdated?: (
    event: LiveSessionTimelineEventUpdated,
  ) => void;
  readonly socket: LiveSessionChannelSocket;
  readonly topic: string;
};

export type LiveSessionJoinResult =
  | {
      readonly sessionState: LiveSessionSessionStateEvent | null;
      readonly status: 'joined';
    }
  | {
      readonly reason: string;
      readonly status: 'error';
    };

export type LiveSessionChatMessageSendResult =
  | {
      readonly event: LiveSessionTimelineEventPayload;
      readonly status: 'ok';
    }
  | {
      readonly reason: string;
      readonly status: 'error';
    };

export type LiveSessionChannelClient = {
  readonly join: () => Promise<LiveSessionJoinResult>;
  readonly leave: () => LiveSessionChannelPush;
  readonly sendChatMessage: (
    body: string,
  ) => Promise<LiveSessionChatMessageSendResult>;
};

const GENERIC_JOIN_FAILURE_REASON = 'Could not join live chat. Please try again.';
const GENERIC_SEND_FAILURE_REASON =
  'Could not send message. Please try again.';
const GENERIC_CHANNEL_ERROR_REASON = 'Chat connection failed.';

export function createLiveSessionChannelClient({
  onClose,
  onError,
  onSessionState,
  onTimelineEvent,
  onTimelineEventRemoved,
  onTimelineEventUpdated,
  socket,
  topic,
}: LiveSessionChannelClientOptions): LiveSessionChannelClient {
  const channel = socket.channel(topic);

  channel.on('session:state', (payload) => {
    const event = normalizeLiveSessionRealtimeEvent('session:state', payload);
    if (event?.kind === 'session_state') {
      onSessionState?.(event);
    }
  });
  channel.on('timeline:event', (payload) => {
    const event = normalizeLiveSessionRealtimeEvent('timeline:event', payload);
    if (event?.kind === 'timeline_event') {
      onTimelineEvent?.(event);
    }
  });
  channel.on('timeline:event_updated', (payload) => {
    const event = normalizeLiveSessionRealtimeEvent(
      'timeline:event_updated',
      payload,
    );
    if (event?.kind === 'timeline_event_updated') {
      onTimelineEventUpdated?.(event);
    }
  });
  channel.on('timeline:event_removed', (payload) => {
    const event = normalizeLiveSessionRealtimeEvent(
      'timeline:event_removed',
      payload,
    );
    if (event?.kind === 'timeline_event_removed') {
      onTimelineEventRemoved?.(event);
    }
  });
  channel.onClose?.(() => {
    onClose?.();
  });
  channel.onError?.((payload) => {
    onError?.(viewerSafeReason(payload, GENERIC_CHANNEL_ERROR_REASON));
  });

  return {
    join: () => joinChannel(channel),
    leave: () => channel.leave(),
    sendChatMessage: (body) => sendChatMessage(channel, body),
  };
}

function joinChannel(channel: LiveSessionChannel): Promise<LiveSessionJoinResult> {
  return new Promise((resolve) => {
    channel
      .join()
      .receive('ok', (payload) => {
        const event = normalizeLiveSessionRealtimeEvent(
          'session:state',
          payload,
        );

        resolve({
          sessionState: event?.kind === 'session_state' ? event : null,
          status: 'joined',
        });
      })
      .receive('error', (payload) => {
        resolve({
          reason: viewerSafeReason(payload, GENERIC_JOIN_FAILURE_REASON),
          status: 'error',
        });
      })
      .receive('timeout', () => {
        resolve({
          reason: GENERIC_JOIN_FAILURE_REASON,
          status: 'error',
        });
      });
  });
}

function sendChatMessage(
  channel: LiveSessionChannel,
  body: string,
): Promise<LiveSessionChatMessageSendResult> {
  return new Promise((resolve) => {
    channel
      .push('timeline:chat_message:send', { body })
      .receive('ok', (payload) => {
        const event = normalizeLiveSessionRealtimeEvent(
          'timeline:event',
          payload,
        );

        resolve(
          event?.kind === 'timeline_event'
            ? { event: event.event, status: 'ok' }
            : {
                reason: GENERIC_SEND_FAILURE_REASON,
                status: 'error',
              },
        );
      })
      .receive('error', (payload) => {
        resolve({
          reason: viewerSafeReason(payload, GENERIC_SEND_FAILURE_REASON),
          status: 'error',
        });
      })
      .receive('timeout', () => {
        resolve({
          reason: GENERIC_SEND_FAILURE_REASON,
          status: 'error',
        });
      });
  });
}

function viewerSafeReason(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.reason !== 'string') {
    return fallback;
  }

  switch (payload.reason) {
    case 'body_blank':
    case 'empty_body':
    case 'message_blank':
      return 'Enter a message before sending.';
    case 'body_too_long':
    case 'message_too_long':
      return 'Message is too long.';
    case 'live_session_ended':
    case 'session_ended':
      return 'This live session has ended.';
    case 'not_authorized':
      return 'You do not have permission to send chat messages.';
    case 'unauthenticated':
      return 'Sign in again to send chat messages.';
    default:
      return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

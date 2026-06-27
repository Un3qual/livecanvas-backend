import type { LiveSessionRealtimeEvent } from '../liveSessionRealtimeEvents';
import type {
  LiveSessionTimelineHistory,
  LiveSessionTimelineHistoryPageInfo,
  LiveSessionTimelineHistoryRow,
} from '../liveSessionTimelineHistory';

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

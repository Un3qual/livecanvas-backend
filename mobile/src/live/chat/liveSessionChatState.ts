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
  readonly eventIds: ReadonlyArray<string>;
  readonly eventsById: Readonly<Record<string, LiveSessionTimelineHistoryRow>>;
  readonly pageInfo: LiveSessionTimelineHistoryPageInfo | null;
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
    };

export type LiveSessionChatSendStartInput = {
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly hasPendingSend: boolean;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export function createLiveSessionChatState(): LiveSessionChatState {
  return {
    activeSessionId: null,
    eventIds: [],
    eventsById: {},
    pageInfo: null,
  };
}

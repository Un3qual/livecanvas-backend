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
  readonly removedEventIds: Readonly<Record<string, true>>;
};

export type LiveSessionChatMutationUpdate = {
  readonly actor: { readonly id: string } | null;
  readonly body: string;
  readonly editCount: number;
  readonly edited: boolean;
  readonly editedAt: string | null;
  readonly id: string;
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
      readonly event: LiveSessionChatMutationUpdate;
      readonly sessionId: string;
      readonly type: 'mutation_update_confirmed';
    }
  | {
      readonly eventId: string;
      readonly sessionId: string;
      readonly type: 'mutation_remove_confirmed';
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
    removedEventIds: {},
  };
}

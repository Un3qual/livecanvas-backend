import type {
  LiveSessionTimelineHistoryPageInfo,
  LiveSessionTimelineHistoryRow,
} from '../liveSessionTimelineHistory';
import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStartInput,
  LiveSessionChatSendStatus,
  LiveSessionChatState,
} from './liveSessionChatState';

export type LiveSessionChatPaginationCursors = {
  readonly endCursor: string | null;
  readonly startCursor: string | null;
};

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

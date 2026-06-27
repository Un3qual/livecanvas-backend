import type { LiveSessionTimelineHistoryRow } from '../liveSessionTimelineHistory';
import type {
  LiveSessionChatSendStartInput,
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

export function selectLiveSessionChatPaginationCursors(
  state: LiveSessionChatState,
): LiveSessionChatPaginationCursors {
  return {
    endCursor: state.pageInfo?.endCursor ?? null,
    startCursor: state.pageInfo?.startCursor ?? null,
  };
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

import {
  createLiveSessionChatState,
  type LiveSessionChatAction,
  type LiveSessionChatState,
} from './chat/liveSessionChatState';
import {
  appendRows,
  mergeNewerPageInfo,
  mergeOlderPageInfo,
  mergeRealtimeEvent,
  mergeRetainedInitialPageInfo,
  mergeRetainedRefreshRows,
  prependRows,
  replaceWithRows,
} from './chat/liveSessionChatTimelineMerge';

export type {
  LiveSessionChatAction,
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStartInput,
  LiveSessionChatSendStatus,
  LiveSessionChatState,
} from './chat/liveSessionChatState';
export { createLiveSessionChatState } from './chat/liveSessionChatState';
export type { LiveSessionChatPaginationCursors } from './chat/liveSessionChatSelectors';
export {
  canStartLiveSessionChatSend,
  selectLiveSessionChatChannelStatus,
  selectLiveSessionChatPaginationCursors,
  selectLiveSessionChatPaginationPageInfo,
  selectLiveSessionChatSendError,
  selectLiveSessionChatSendStatus,
  selectLiveSessionChatVisibleRows,
} from './chat/liveSessionChatSelectors';

export function liveSessionChatReducer(
  state: LiveSessionChatState,
  action: LiveSessionChatAction,
): LiveSessionChatState {
  switch (action.type) {
    case 'session_changed':
      return {
        ...createLiveSessionChatState(),
        activeSessionId: action.sessionId,
      };

    case 'retained_initial_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...(state.eventIds.length === 0
          ? replaceWithRows(action.history.rows)
          : mergeRetainedRefreshRows(state, action.history.rows)),
        pageInfo:
          state.eventIds.length === 0
            ? action.history.pageInfo
            : mergeRetainedInitialPageInfo(state, action.history),
      };

    case 'retained_older_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...prependRows(state, action.history.rows),
        pageInfo: mergeOlderPageInfo(state.pageInfo, action.history.pageInfo),
      };

    case 'retained_newer_loaded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        ...appendRows(state, action.history.rows),
        pageInfo: mergeNewerPageInfo(state.pageInfo, action.history.pageInfo),
      };

    case 'realtime_event_received':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return mergeRealtimeEvent(state, action.event);

    case 'channel_status_changed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        channelError: action.error ?? null,
        channelStatus: action.status,
      };

    case 'send_started':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'sending',
      };

    case 'send_succeeded':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'idle',
      };

    case 'send_cancelled':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: null,
        sendStatus: 'idle',
      };

    case 'send_failed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return {
        ...state,
        sendError: action.error,
        sendStatus: 'failed',
      };

    default:
      return state;
  }
}

function isActiveSessionAction(
  state: LiveSessionChatState,
  sessionId: string,
): boolean {
  return state.activeSessionId === sessionId;
}

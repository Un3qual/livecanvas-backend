import {
  createLiveSessionChatState,
  type LiveSessionChatAction,
  type LiveSessionChatState,
} from './liveSessionChatState';
import {
  appendRows,
  mergeNewerPageInfo,
  mergeOlderPageInfo,
  mergeConfirmedTimelineUpdate,
  mergeRealtimeEvent,
  mergeRetainedInitialPageInfo,
  mergeRetainedRefreshRows,
  prependRows,
  removeTimelineEvent,
  replaceWithRows,
} from './liveSessionChatTimelineMerge';

export function liveSessionChatTimelineReducer(
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

      // The first retained load seeds an empty window; later retained refreshes
      // merge so row continuity and pageInfo edges stay consistent.
      return {
        ...state,
        ...(state.eventIds.length === 0
          ? replaceWithRows(state, action.history.rows)
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

    case 'mutation_update_confirmed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return mergeConfirmedTimelineUpdate(state, action.event);

    case 'mutation_remove_confirmed':
      if (!isActiveSessionAction(state, action.sessionId)) {
        return state;
      }

      return removeTimelineEvent(state, action.eventId);

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

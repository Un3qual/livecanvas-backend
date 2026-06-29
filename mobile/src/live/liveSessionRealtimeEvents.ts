import {
  readMediaAnswerEvent,
  readMediaIceCandidateEvent,
  readMediaOfferEvent,
  readMediaViewerReadyEvent,
} from './realtime/liveSessionRealtimeMediaEvents';
import {
  readLiveSessionSessionStateEvent,
  readLiveSessionTimelineEvent,
  readLiveSessionTimelineEventRemoved,
  readLiveSessionTimelineEventUpdated,
} from './realtime/liveSessionRealtimeTimelineEvents';
import type { LiveSessionRealtimeEvent } from './realtime/liveSessionRealtimeTypes';

export * from './realtime/liveSessionRealtimeMediaEvents';
export * from './realtime/liveSessionRealtimeTimelineEvents';
export * from './realtime/liveSessionRealtimeTypes';

export function normalizeLiveSessionRealtimeEvent(
  eventName: string,
  payload: unknown,
): LiveSessionRealtimeEvent | null {
  switch (eventName) {
    case 'session:state':
      return readLiveSessionSessionStateEvent(payload);
    case 'timeline:event':
      return readLiveSessionTimelineEvent(payload);
    case 'timeline:event_updated':
      return readLiveSessionTimelineEventUpdated(payload);
    case 'timeline:event_removed':
      return readLiveSessionTimelineEventRemoved(payload);
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

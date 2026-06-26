import type { LiveSessionStatus } from './liveSessionPresentation';

export type LiveSessionRealtimeStatusMap = ReadonlyMap<
  string,
  LiveSessionStatus
>;

export function readLiveSessionRealtimeStatus({
  liveSessionId,
  queriedStatus,
  realtimeStatuses,
}: {
  readonly liveSessionId: string;
  readonly queriedStatus: LiveSessionStatus;
  readonly realtimeStatuses: LiveSessionRealtimeStatusMap;
}): LiveSessionStatus {
  return realtimeStatuses.get(liveSessionId) ?? queriedStatus;
}

export function updateLiveSessionRealtimeStatus({
  liveSessionId,
  realtimeStatuses,
  status,
}: {
  readonly liveSessionId: string;
  readonly realtimeStatuses: LiveSessionRealtimeStatusMap;
  readonly status: LiveSessionStatus;
}): LiveSessionRealtimeStatusMap {
  if (realtimeStatuses.get(liveSessionId) === status) {
    return realtimeStatuses;
  }

  const nextStatuses = new Map(realtimeStatuses);
  nextStatuses.set(liveSessionId, status);
  return nextStatuses;
}

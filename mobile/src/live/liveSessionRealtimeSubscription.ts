export type LiveSessionRealtimeSubscriptionState = {
  readonly hasRetainedHostPublishingSession: boolean;
  readonly isJoined: boolean;
};

export function shouldMaintainLiveSessionRealtimeChannel({
  hasRetainedHostPublishingSession,
  isJoined,
}: LiveSessionRealtimeSubscriptionState): boolean {
  return isJoined || hasRetainedHostPublishingSession;
}

export type LiveSessionEndedRealtimeCleanupOptions = {
  readonly clearEndedSessionMembership: (liveSessionId: string) => void;
  readonly closeChatChannelForEndedSession: () => void;
  readonly liveSessionId: string;
  readonly markLiveSessionEnded: (liveSessionId: string) => void;
  readonly releaseHostPublishing: (liveSessionId: string) => void;
  readonly stopViewerPlayback: (options: { readonly resetState: true }) => void;
};

export function handleLiveSessionEndedRealtimeCleanup({
  clearEndedSessionMembership,
  closeChatChannelForEndedSession,
  liveSessionId,
  markLiveSessionEnded,
  releaseHostPublishing,
  stopViewerPlayback,
}: LiveSessionEndedRealtimeCleanupOptions) {
  markLiveSessionEnded(liveSessionId);
  clearEndedSessionMembership(liveSessionId);
  stopViewerPlayback({ resetState: true });
  releaseHostPublishing(liveSessionId);
  closeChatChannelForEndedSession();
}

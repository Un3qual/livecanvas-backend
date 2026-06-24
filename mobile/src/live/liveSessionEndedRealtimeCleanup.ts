export type LiveSessionEndedRealtimeCleanupOptions = {
  readonly closeChatChannelForEndedSession: () => void;
  readonly liveSessionId: string;
  readonly releaseHostPublishing: (liveSessionId: string) => void;
  readonly stopViewerPlayback: (options: { readonly resetState: true }) => void;
};

export function handleLiveSessionEndedRealtimeCleanup({
  closeChatChannelForEndedSession,
  liveSessionId,
  releaseHostPublishing,
  stopViewerPlayback,
}: LiveSessionEndedRealtimeCleanupOptions) {
  stopViewerPlayback({ resetState: true });
  releaseHostPublishing(liveSessionId);
  closeChatChannelForEndedSession();
}

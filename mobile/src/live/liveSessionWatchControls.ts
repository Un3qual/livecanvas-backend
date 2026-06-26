export type LiveSessionViewerJoinControlState = {
  readonly canEndLiveSession: boolean;
  readonly isJoined: boolean;
};

export type LiveSessionViewerJoinStartState =
  LiveSessionViewerJoinControlState & {
    readonly enterable: boolean;
    readonly hasActiveSubmission: boolean;
    readonly hasPendingMutation: boolean;
  };

export function canStartLiveSessionViewerJoin({
  canEndLiveSession,
  enterable,
  hasActiveSubmission,
  hasPendingMutation,
  isJoined,
}: LiveSessionViewerJoinStartState): boolean {
  return (
    !canEndLiveSession &&
    enterable &&
    !hasActiveSubmission &&
    !hasPendingMutation &&
    !isJoined
  );
}

export function shouldShowLiveSessionViewerJoinControl({
  canEndLiveSession,
  isJoined,
}: LiveSessionViewerJoinControlState): boolean {
  return !canEndLiveSession && !isJoined;
}

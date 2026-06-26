export type LiveSessionViewerJoinControlState = {
  readonly isHostOwnedSession: boolean;
  readonly isJoined: boolean;
};

export type LiveSessionViewerJoinStartState =
  LiveSessionViewerJoinControlState & {
    readonly enterable: boolean;
    readonly hasActiveSubmission: boolean;
    readonly hasPendingMutation: boolean;
  };

export function canStartLiveSessionViewerJoin({
  enterable,
  hasActiveSubmission,
  hasPendingMutation,
  isHostOwnedSession,
  isJoined,
}: LiveSessionViewerJoinStartState): boolean {
  return (
    !isHostOwnedSession &&
    enterable &&
    !hasActiveSubmission &&
    !hasPendingMutation &&
    !isJoined
  );
}

export function shouldShowLiveSessionViewerJoinControl({
  isHostOwnedSession,
  isJoined,
}: LiveSessionViewerJoinControlState): boolean {
  return !isHostOwnedSession && !isJoined;
}

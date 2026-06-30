import { useEffect, useRef, useState } from 'react';
import type { UseMutationConfig } from 'react-relay';
import { createActor } from 'xstate';

import type { LiveSessionTimelineHistory } from '../../liveSessionTimelineHistory';
import {
  canRequestLiveSessionWatchCommand,
  isLiveSessionViewerJoined,
  isLiveSessionWatchAnyMutationPending,
  liveSessionWatchMachine,
  readLiveSessionWatchError,
  readLiveSessionWatchSubmission,
  shouldAutoLeaveLiveSession,
  type LiveSessionWatchPendingCommand,
  type LiveSessionWatchSnapshot,
} from '../state/liveSessionWatchMachine';
import type { StopViewerPlayback } from '../liveSessionWatchScreenTypes';
import type {
  LiveSessionWatchScreenEndMutation,
  LiveSessionWatchScreenJoinMutation,
  LiveSessionWatchScreenLeaveMutation,
} from '../liveSessionWatchOperations';

type JoinLiveSessionCommit = (
  config: UseMutationConfig<LiveSessionWatchScreenJoinMutation>,
) => unknown;

type LeaveLiveSessionCommit = (
  config: UseMutationConfig<LiveSessionWatchScreenLeaveMutation>,
) => unknown;

type EndLiveSessionCommit = (
  config: UseMutationConfig<LiveSessionWatchScreenEndMutation>,
) => unknown;

export const LIVE_SESSION_OLDER_TIMELINE_LOAD_ERROR =
  'We could not load older messages. Check your connection and try again.';

export type LiveSessionOlderTimelinePageLoadState = {
  readonly error: string | null;
  readonly isLoading: boolean;
};

export type LiveSessionOlderTimelinePageLoadRequest = {
  readonly canLoadOlder: boolean;
  readonly liveSessionId: string;
  readonly timelineBefore: string | null;
  readonly timelineLast: number;
};

export type FetchLiveSessionOlderTimelinePage = (
  request: Omit<LiveSessionOlderTimelinePageLoadRequest, 'canLoadOlder'>,
) => Promise<LiveSessionTimelineHistory | null>;

export type LiveSessionOlderTimelinePageLoaded = {
  readonly history: LiveSessionTimelineHistory;
  readonly sessionId: string;
};

export type LiveSessionOlderTimelinePageLoaderLifecycle = {
  readonly getState: () => LiveSessionOlderTimelinePageLoadState;
  readonly mount: () => void;
  readonly requestOlderPage: (
    request: LiveSessionOlderTimelinePageLoadRequest,
  ) => void;
  readonly syncSession: (liveSessionId: string) => void;
  readonly unmount: () => void;
};

export type LiveSessionOlderTimelinePageLoaderOptions = {
  readonly fetchOlderTimelinePage: FetchLiveSessionOlderTimelinePage;
  readonly onOlderTimelinePageLoaded: (
    loaded: LiveSessionOlderTimelinePageLoaded,
  ) => void;
  readonly onStateChanged?: (
    state: LiveSessionOlderTimelinePageLoadState,
  ) => void;
};

export type LiveSessionWatchControllerState = {
  readonly error: string | null;
  readonly hasActiveSubmission: boolean;
  readonly isEnding: boolean;
  readonly isJoined: boolean;
  readonly isJoining: boolean;
  readonly isLeaving: boolean;
  readonly snapshot: LiveSessionWatchSnapshot;
};

export type LiveSessionWatchJoinRequest = {
  readonly enterable: boolean;
  readonly isCurrentViewerHost: boolean;
  readonly liveSessionId: string;
};

export type LiveSessionWatchLeaveRequest = {
  readonly liveSessionId: string;
};

export type LiveSessionWatchEndRequest = {
  readonly canEndLiveSession: boolean;
  readonly liveSessionId: string;
};

export type LiveSessionWatchControllerLifecycle = {
  readonly getState: (liveSessionId?: string) => LiveSessionWatchControllerState;
  readonly handleMembershipLost: (liveSessionId: string) => void;
  readonly handleSessionEnded: (
    liveSessionId: string,
    closeChatChannel?: () => void,
  ) => void;
  readonly requestEnd: (request: LiveSessionWatchEndRequest) => void;
  readonly requestJoin: (request: LiveSessionWatchJoinRequest) => void;
  readonly requestLeave: (request: LiveSessionWatchLeaveRequest) => void;
  readonly mount: () => void;
  readonly syncSession: (liveSessionId: string) => void;
  readonly unmount: () => void;
};

export type LiveSessionWatchControllerLifecycleOptions = {
  readonly commitEndLiveSession: EndLiveSessionCommit;
  readonly commitJoinLiveSession: JoinLiveSessionCommit;
  readonly commitLeaveLiveSession: LeaveLiveSessionCommit;
  readonly onStateChanged?: (state: LiveSessionWatchControllerState) => void;
  readonly releaseRetainedHostPublishingSession: (liveSessionId: string) => void;
  readonly stopViewerPlayback: StopViewerPlayback;
};

export type LiveSessionWatchControllerOptions =
  LiveSessionWatchControllerLifecycleOptions & {
    readonly liveSessionId: string;
  };

export type LiveSessionWatchController = LiveSessionWatchControllerState & {
  readonly handleMembershipLost: (liveSessionId: string) => void;
  readonly handleSessionEnded: (
    liveSessionId: string,
    closeChatChannel?: () => void,
  ) => void;
  readonly requestEnd: (request: LiveSessionWatchEndRequest) => void;
  readonly requestJoin: (request: LiveSessionWatchJoinRequest) => void;
  readonly requestLeave: (request: LiveSessionWatchLeaveRequest) => void;
};

export function createLiveSessionOlderTimelinePageLoader({
  fetchOlderTimelinePage,
  onOlderTimelinePageLoaded,
  onStateChanged,
}: LiveSessionOlderTimelinePageLoaderOptions): LiveSessionOlderTimelinePageLoaderLifecycle {
  let activeLiveSessionId: string | null = null;
  let activeRequest:
    | {
        readonly sessionId: string;
        readonly token: number;
      }
    | null = null;
  let isMounted = true;
  let requestToken = 0;
  let state: LiveSessionOlderTimelinePageLoadState = {
    error: null,
    isLoading: false,
  };

  function getState(): LiveSessionOlderTimelinePageLoadState {
    return state;
  }

  function syncSession(liveSessionId: string) {
    activeLiveSessionId = liveSessionId;
    activeRequest = null;
    publishState({ error: null, isLoading: false });
  }

  function requestOlderPage({
    canLoadOlder,
    liveSessionId,
    timelineBefore,
    timelineLast,
  }: LiveSessionOlderTimelinePageLoadRequest) {
    if (
      !canLoadOlder ||
      !timelineBefore ||
      state.isLoading ||
      activeLiveSessionId !== liveSessionId
    ) {
      return;
    }

    const token = requestToken + 1;
    requestToken = token;
    activeRequest = { sessionId: liveSessionId, token };
    publishState({ error: null, isLoading: true });

    fetchOlderTimelinePage({
      liveSessionId,
      timelineBefore,
      timelineLast,
    })
      .then((history) => {
        if (!isActiveRequest(liveSessionId, token)) {
          return;
        }

        activeRequest = null;

        if (!history) {
          publishState({
            error: LIVE_SESSION_OLDER_TIMELINE_LOAD_ERROR,
            isLoading: false,
          });
          return;
        }

        onOlderTimelinePageLoaded({
          history,
          sessionId: liveSessionId,
        });
        publishState({ error: null, isLoading: false });
      })
      .catch(() => {
        if (!isActiveRequest(liveSessionId, token)) {
          return;
        }

        activeRequest = null;
        publishState({
          error: LIVE_SESSION_OLDER_TIMELINE_LOAD_ERROR,
          isLoading: false,
        });
      });
  }

  function unmount() {
    isMounted = false;
    activeRequest = null;

    if (state.isLoading) {
      publishState({ error: null, isLoading: false });
    }
  }

  function mount() {
    isMounted = true;
  }

  function isActiveRequest(liveSessionId: string, token: number): boolean {
    return (
      isMounted &&
      activeLiveSessionId === liveSessionId &&
      activeRequest?.sessionId === liveSessionId &&
      activeRequest.token === token
    );
  }

  function publishState(nextState: LiveSessionOlderTimelinePageLoadState) {
    state = nextState;

    if (isMounted) {
      onStateChanged?.(state);
    }
  }

  return {
    getState,
    mount,
    requestOlderPage,
    syncSession,
    unmount,
  };
}

export function createLiveSessionWatchControllerLifecycle({
  commitEndLiveSession,
  commitJoinLiveSession,
  commitLeaveLiveSession,
  onStateChanged,
  releaseRetainedHostPublishingSession,
  stopViewerPlayback,
}: LiveSessionWatchControllerLifecycleOptions): LiveSessionWatchControllerLifecycle {
  const actor = createActor(liveSessionWatchMachine).start();
  let currentLiveSessionId: string | null = null;
  let isMounted = true;
  let pendingMutation: LiveSessionWatchPendingCommand | null = null;

  function syncSession(liveSessionId: string) {
    currentLiveSessionId = liveSessionId;
    actor.send({ sessionId: liveSessionId, type: 'SESSION_CHANGED' });
    publishState();
  }

  function requestJoin({
    enterable,
    isCurrentViewerHost,
    liveSessionId,
  }: LiveSessionWatchJoinRequest) {
    if (
      isCurrentViewerHost ||
      !enterable ||
      !canStartCommand(liveSessionId, 'join')
    ) {
      return;
    }

    pendingMutation = { kind: 'join', sessionId: liveSessionId };
    actor.send({ sessionId: liveSessionId, type: 'JOIN_REQUESTED' });
    publishState();

    commitJoinLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.joinLiveSession;
        clearPendingMutation(liveSessionId, 'join');

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!isMounted) {
            return;
          }

          actor.send({
            errors: result?.errors,
            sessionId: liveSessionId,
            type: 'JOIN_FAILED',
          });
          publishState();
          return;
        }

        if (!isMounted) {
          commitDetachedLeaveLiveSession(liveSessionId);
          return;
        }

        if (currentLiveSessionId !== liveSessionId) {
          commitDetachedLeaveLiveSession(liveSessionId);
          return;
        }

        actor.send({ sessionId: liveSessionId, type: 'JOIN_SUCCEEDED' });
        publishState();
      },
      onError: () => {
        clearPendingMutation(liveSessionId, 'join');

        if (!isMounted) {
          return;
        }

        actor.send({
          errors: [],
          sessionId: liveSessionId,
          type: 'JOIN_FAILED',
        });
        publishState();
      },
    });
  }

  function requestLeave({ liveSessionId }: LiveSessionWatchLeaveRequest) {
    if (!canStartCommand(liveSessionId, 'leave')) {
      return;
    }

    pendingMutation = { kind: 'leave', sessionId: liveSessionId };
    actor.send({ sessionId: liveSessionId, type: 'LEAVE_REQUESTED' });
    publishState();
    stopViewerPlayback({ resetState: true });

    commitLeaveLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.leaveLiveSession;
        clearPendingMutation(liveSessionId, 'leave');

        if (!result?.left || (result.errors?.length ?? 0) > 0) {
          actor.send({
            errors: result?.errors,
            sessionId: liveSessionId,
            type: 'LEAVE_FAILED',
          });
          if (!isMounted) {
            commitDetachedLeaveLiveSession(liveSessionId);
            return;
          }

          publishState();
          return;
        }

        actor.send({ sessionId: liveSessionId, type: 'LEAVE_SUCCEEDED' });
        publishState();
      },
      onError: () => {
        clearPendingMutation(liveSessionId, 'leave');
        actor.send({
          errors: [],
          sessionId: liveSessionId,
          type: 'LEAVE_FAILED',
        });
        if (!isMounted) {
          commitDetachedLeaveLiveSession(liveSessionId);
          return;
        }

        publishState();
      },
    });
  }

  function requestEnd({
    canEndLiveSession,
    liveSessionId,
  }: LiveSessionWatchEndRequest) {
    if (!canEndLiveSession || !canStartCommand(liveSessionId, 'end')) {
      return;
    }

    pendingMutation = { kind: 'end', sessionId: liveSessionId };
    actor.send({ sessionId: liveSessionId, type: 'END_REQUESTED' });
    publishState();

    commitEndLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.endLiveSession;
        clearPendingMutation(liveSessionId, 'end');

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!isMounted) {
            return;
          }

          actor.send({
            errors: result?.errors,
            sessionId: liveSessionId,
            type: 'END_FAILED',
          });
          publishState();
          return;
        }

        releaseRetainedHostPublishingSession(liveSessionId);
        if (currentLiveSessionId === liveSessionId) {
          stopViewerPlayback({ resetState: true });
        }

        if (!isMounted) {
          return;
        }

        actor.send({ sessionId: liveSessionId, type: 'END_SUCCEEDED' });
        publishState();
      },
      onError: () => {
        clearPendingMutation(liveSessionId, 'end');

        if (!isMounted) {
          return;
        }

        actor.send({
          errors: [],
          sessionId: liveSessionId,
          type: 'END_FAILED',
        });
        publishState();
      },
    });
  }

  function handleMembershipLost(liveSessionId: string) {
    if (currentLiveSessionId !== liveSessionId) {
      return;
    }

    actor.send({ sessionId: liveSessionId, type: 'MEMBERSHIP_LOST' });
    publishState();
    stopViewerPlayback({ resetState: true });
  }

  function handleSessionEnded(
    liveSessionId: string,
    closeChatChannel?: () => void,
  ) {
    const isActiveSession = currentLiveSessionId === liveSessionId;
    actor.send({ sessionId: liveSessionId, type: 'SESSION_ENDED' });
    publishState();

    if (!isActiveSession) {
      releaseRetainedHostPublishingSession(liveSessionId);
      return;
    }

    stopViewerPlayback({ resetState: true });
    releaseRetainedHostPublishingSession(liveSessionId);
    closeChatChannel?.();
  }

  function mount() {
    isMounted = true;
  }

  function unmount() {
    isMounted = false;
    stopViewerPlayback({ resetState: false });

    const liveSessionId = currentLiveSessionId;

    if (
      liveSessionId &&
      shouldAutoLeaveLiveSession(actor.getSnapshot(), liveSessionId) &&
      !isAnyMutationPending(liveSessionId)
    ) {
      commitDetachedLeaveLiveSession(liveSessionId);
    }
  }

  function commitDetachedLeaveLiveSession(liveSessionId: string) {
    if (pendingMutation?.sessionId === liveSessionId) {
      return;
    }

    pendingMutation = { kind: 'leave', sessionId: liveSessionId };
    commitLeaveLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: () => {
        clearPendingMutation(liveSessionId, 'leave');
      },
      onError: () => {
        clearPendingMutation(liveSessionId, 'leave');
      },
    });
  }

  function canStartCommand(
    liveSessionId: string,
    kind: LiveSessionWatchPendingCommand['kind'],
  ): boolean {
    const snapshot = actor.getSnapshot();

    return (
      canRequestLiveSessionWatchCommand(snapshot, liveSessionId, kind) &&
      !isAnyMutationPending(liveSessionId)
    );
  }

  function isAnyMutationPending(liveSessionId: string): boolean {
    return (
      pendingMutation?.sessionId === liveSessionId ||
      isLiveSessionWatchAnyMutationPending(actor.getSnapshot(), liveSessionId)
    );
  }

  function clearPendingMutation(
    liveSessionId: string,
    kind: LiveSessionWatchPendingCommand['kind'],
  ) {
    if (
      pendingMutation?.sessionId === liveSessionId &&
      pendingMutation.kind === kind
    ) {
      pendingMutation = null;
    }
  }

  function getState(
    liveSessionId = currentLiveSessionId ?? '',
  ): LiveSessionWatchControllerState {
    const snapshot = actor.getSnapshot();
    const submission = readLiveSessionWatchSubmission(snapshot, liveSessionId);

    return {
      error: readLiveSessionWatchError(snapshot, liveSessionId),
      hasActiveSubmission: submission !== 'idle',
      isEnding: submission === 'ending',
      isJoined: isLiveSessionViewerJoined(snapshot, liveSessionId),
      isJoining: submission === 'joining',
      isLeaving: submission === 'leaving',
      snapshot,
    };
  }

  function publishState() {
    if (isMounted) {
      onStateChanged?.(getState());
    }
  }

  return {
    getState,
    handleMembershipLost,
    handleSessionEnded,
    mount,
    requestEnd,
    requestJoin,
    requestLeave,
    syncSession,
    unmount,
  };
}

export function useLiveSessionWatchController({
  commitEndLiveSession,
  commitJoinLiveSession,
  commitLeaveLiveSession,
  liveSessionId,
  releaseRetainedHostPublishingSession,
  stopViewerPlayback,
}: LiveSessionWatchControllerOptions): LiveSessionWatchController {
  const [controllerState, setControllerState] =
    useState<LiveSessionWatchControllerState>(() =>
      getInitialLiveSessionWatchControllerState(liveSessionId),
    );
  const lifecycleRef = useRef<LiveSessionWatchControllerLifecycle | null>(null);

  if (!lifecycleRef.current) {
    lifecycleRef.current = createLiveSessionWatchControllerLifecycle({
      commitEndLiveSession,
      commitJoinLiveSession,
      commitLeaveLiveSession,
      onStateChanged: setControllerState,
      releaseRetainedHostPublishingSession,
      stopViewerPlayback,
    });
  }

  const lifecycle = lifecycleRef.current;

  useEffect(() => {
    lifecycle.syncSession(liveSessionId);
  }, [lifecycle, liveSessionId]);

  useEffect(
    () => {
      lifecycle.mount();

      return () => {
        lifecycle.unmount();
      };
    },
    [lifecycle],
  );

  return {
    ...controllerState,
    handleMembershipLost: lifecycle.handleMembershipLost,
    handleSessionEnded: lifecycle.handleSessionEnded,
    requestEnd: lifecycle.requestEnd,
    requestJoin: lifecycle.requestJoin,
    requestLeave: lifecycle.requestLeave,
  };
}

function getInitialLiveSessionWatchControllerState(
  liveSessionId: string,
): LiveSessionWatchControllerState {
  const actor = createActor(liveSessionWatchMachine).start();

  actor.send({ sessionId: liveSessionId, type: 'SESSION_CHANGED' });

  const snapshot = actor.getSnapshot();

  actor.stop();

  return {
    error: readLiveSessionWatchError(snapshot, liveSessionId),
    hasActiveSubmission: false,
    isEnding: false,
    isJoined: false,
    isJoining: false,
    isLeaving: false,
    snapshot,
  };
}

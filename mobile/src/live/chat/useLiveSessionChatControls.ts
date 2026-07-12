import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useMutation } from 'react-relay';

import type { LiveSessionChatMutationUpdate } from './liveSessionChatState';
import {
  createLiveSessionChatControlsState,
  liveSessionChatControlErrorMessage,
  liveSessionChatControlsReducer,
  type LiveSessionChatControlAction,
  type LiveSessionChatControlsAction,
  type LiveSessionChatControlsState,
} from './liveSessionChatControlsState';
import {
  liveSessionChatEditMutation,
  liveSessionChatRemoveMutation,
  type LiveSessionChatControlEditMutation,
  type LiveSessionChatControlRemoveMutation,
} from './liveSessionChatControlOperations';

export type LiveSessionChatTimelineMutationAction =
  | {
      readonly event: LiveSessionChatMutationUpdate;
      readonly type: 'mutation_update_confirmed';
    }
  | {
      readonly eventId: string;
      readonly type: 'mutation_remove_confirmed';
    };

export type LiveSessionChatControlsController = {
  readonly clearRowError: (eventId: string) => void;
  readonly controlsState: LiveSessionChatControlsState;
  readonly editMessage: (eventId: string, body: string) => void;
  readonly removeMessage: (eventId: string) => void;
};

type UseLiveSessionChatControlsInput = {
  readonly dispatchTimeline: (
    action: LiveSessionChatTimelineMutationAction,
  ) => void;
  readonly hostId: string | null;
  readonly sessionStatus: string | null;
  readonly viewerId: string | null;
};

export function useLiveSessionChatControls(
  {
    dispatchTimeline,
    hostId,
    sessionStatus,
    viewerId,
  }: UseLiveSessionChatControlsInput,
): LiveSessionChatControlsController {
  const [controlsState, dispatch] = useReducer(
    liveSessionChatControlsReducer,
    undefined,
    createLiveSessionChatControlsState,
  );
  const [commitEdit] = useMutation<LiveSessionChatControlEditMutation>(
    liveSessionChatEditMutation,
  );
  const [commitRemove] = useMutation<LiveSessionChatControlRemoveMutation>(
    liveSessionChatRemoveMutation,
  );
  const commitEditRef = useRef(commitEdit);
  const commitRemoveRef = useRef(commitRemove);
  // Attempt identity is kept outside React state so same-tick duplicate actions
  // cannot race a render and so superseded callbacks can be rejected precisely.
  const activeByEventIdRef = useRef<
    Record<
      string,
      {
        readonly action: LiveSessionChatControlAction;
        readonly attemptId: number;
        readonly viewerId: string;
      }
    >
  >({});
  const nextAttemptIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const previousViewerIdRef = useRef(viewerId);
  const runtimeRef = useRef({ hostId, sessionStatus, viewerId });
  commitEditRef.current = commitEdit;
  commitRemoveRef.current = commitRemove;
  runtimeRef.current = { hostId, sessionStatus, viewerId };

  useLayoutEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      activeByEventIdRef.current = {};
    };
  }, []);

  useLayoutEffect(() => {
    const viewerChanged = previousViewerIdRef.current !== viewerId;
    previousViewerIdRef.current = viewerId;

    if (viewerId !== null && viewerChanged) {
      activeByEventIdRef.current = Object.fromEntries(
        Object.entries(activeByEventIdRef.current).filter(
          ([, active]) => active.viewerId === viewerId,
        ),
      );
    }

    if (viewerId === null || viewerChanged || sessionStatus === 'ENDED') {
      // Ended sessions hide controls immediately, but accepted requests remain
      // eligible to reconcile their server-authoritative timeline result.
      dispatch({ type: 'reset' });
    }
  }, [sessionStatus, viewerId]);

  const dispatchControl = useCallback((action: LiveSessionChatControlsAction) => {
    dispatch(action);
  }, []);

  const clearRowError = useCallback(
    (eventId: string) => {
      dispatchControl({ eventId, type: 'row_error_cleared' });
    },
    [dispatchControl],
  );

  const isCurrentAttempt = useCallback(
    (
      eventId: string,
      action: LiveSessionChatControlAction,
      attemptId: number,
    ): boolean => {
      const active = activeByEventIdRef.current[eventId];

      // Only the exact mounted attempt may settle UI or timeline state; a
      // different signed-in viewer and unmount invalidate late callbacks.
      return (
        isMountedRef.current &&
        active?.action === action &&
        active.attemptId === attemptId
      );
    },
    [],
  );

  const clearActiveAttempt = useCallback((eventId: string): void => {
    activeByEventIdRef.current = Object.fromEntries(
      Object.entries(activeByEventIdRef.current).filter(
        ([activeEventId]) => activeEventId !== eventId,
      ),
    );
  }, []);

  const settleFailure = useCallback(
    (
      eventId: string,
      action: LiveSessionChatControlAction,
      attemptId: number,
      error: unknown,
    ): void => {
      if (!isCurrentAttempt(eventId, action, attemptId)) {
        return;
      }

      clearActiveAttempt(eventId);
      dispatchControl({
        action,
        attemptId,
        eventId,
        message: liveSessionChatControlErrorMessage(error),
        type: 'operation_failed',
      });
    },
    [clearActiveAttempt, dispatchControl, isCurrentAttempt],
  );

  const editMessage = useCallback(
    (eventId: string, body: string) => {
      const runtime = runtimeRef.current;

      if (
        runtime.viewerId === null ||
        runtime.sessionStatus === 'ENDED' ||
        activeByEventIdRef.current[eventId]
      ) {
        return;
      }

      const attemptId = ++nextAttemptIdRef.current;
      activeByEventIdRef.current[eventId] = {
        action: 'edit',
        attemptId,
        viewerId: runtime.viewerId,
      };
      dispatchControl({
        action: 'edit',
        attemptId,
        eventId,
        type: 'operation_started',
      });

      commitEditRef.current({
        variables: {
          input: { body, chatMessageEventId: eventId },
        },
        onCompleted: (payload) => {
          if (!isCurrentAttempt(eventId, 'edit', attemptId)) {
            return;
          }

          const result = payload.editLiveChatMessage;
          const event = result?.chatMessageEvent;

          if (!event || result.errors.length > 0) {
            settleFailure(
              eventId,
              'edit',
              attemptId,
              mutationErrorMessage(result?.errors),
            );
            return;
          }

          clearActiveAttempt(eventId);
          dispatchControl({
            action: 'edit',
            attemptId,
            eventId,
            type: 'operation_succeeded',
          });
          dispatchTimeline({
            event: {
              actor: event.actor ?? null,
              body: event.body,
              editCount: event.editCount,
              edited: event.edited,
              editedAt: event.editedAt ?? null,
              id: event.id,
            },
            type: 'mutation_update_confirmed',
          });
        },
        onError: (error) => {
          settleFailure(eventId, 'edit', attemptId, error);
        },
      });
    },
    [
      clearActiveAttempt,
      dispatchControl,
      dispatchTimeline,
      isCurrentAttempt,
      settleFailure,
    ],
  );

  const removeMessage = useCallback(
    (eventId: string) => {
      const runtime = runtimeRef.current;

      if (
        runtime.viewerId === null ||
        runtime.viewerId !== runtime.hostId ||
        runtime.sessionStatus === 'ENDED' ||
        activeByEventIdRef.current[eventId]
      ) {
        return;
      }

      const attemptId = ++nextAttemptIdRef.current;
      activeByEventIdRef.current[eventId] = {
        action: 'remove',
        attemptId,
        viewerId: runtime.viewerId,
      };
      dispatchControl({
        action: 'remove',
        attemptId,
        eventId,
        type: 'operation_started',
      });

      commitRemoveRef.current({
        variables: { input: { chatMessageEventId: eventId } },
        onCompleted: (payload) => {
          if (!isCurrentAttempt(eventId, 'remove', attemptId)) {
            return;
          }

          const result = payload.removeLiveChatMessageEvent;

          if (
            result?.removedTimelineEventId !== eventId ||
            result.errors.length > 0
          ) {
            settleFailure(
              eventId,
              'remove',
              attemptId,
              mutationErrorMessage(result?.errors),
            );
            return;
          }

          clearActiveAttempt(eventId);
          dispatchControl({
            action: 'remove',
            attemptId,
            eventId,
            type: 'operation_succeeded',
          });
          dispatchTimeline({
            eventId,
            type: 'mutation_remove_confirmed',
          });
        },
        onError: (error) => {
          settleFailure(eventId, 'remove', attemptId, error);
        },
      });
    },
    [
      clearActiveAttempt,
      dispatchControl,
      dispatchTimeline,
      isCurrentAttempt,
      settleFailure,
    ],
  );

  return useMemo(
    () => ({
      clearRowError,
      controlsState,
      editMessage,
      removeMessage,
    }),
    [clearRowError, controlsState, editMessage, removeMessage],
  );
}

type MutationError = {
  readonly message: string;
};

function mutationErrorMessage(
  errors: ReadonlyArray<MutationError> | null | undefined,
): string | Error {
  return errors?.[0]?.message ?? new Error('mutation failed');
}

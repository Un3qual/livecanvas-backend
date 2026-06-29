import { assign, setup, type SnapshotFrom } from 'xstate';

import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  type HostBroadcastPermissionState,
  type HostBroadcastPermissionTarget,
  type HostBroadcastPreflightBlocker,
  type HostBroadcastPreflightState,
} from '../../hostBroadcastPreflight';
import type {
  HostBroadcastPreflightCleanupState,
  HostBroadcastSessionState,
} from '../../hostBroadcastSession';

export type HostBroadcastPreflightWorkflowStatus =
  | 'idle'
  | 'creating'
  | 'starting'
  | 'preparing_media'
  | 'ready_to_publish'
  | 'going_live'
  | 'live'
  | 'ending'
  | 'ended';

type HostBroadcastPreflightMachineContext = {
  readonly backendMediaContractReady: boolean;
  readonly cameraPermission: HostBroadcastPermissionState;
  readonly hasBackgroundEndRequestInFlight: boolean;
  readonly hasGoneLive: boolean;
  readonly hasPreparedMedia: boolean;
  readonly liveSessionId: string | null;
  readonly microphonePermission: HostBroadcastPermissionState;
  readonly nativeMediaReady: boolean;
  readonly viewerSafeErrorText: string | null;
};

export type HostBroadcastPreflightMachineEvent =
  | {
      readonly permission: HostBroadcastPermissionTarget;
      readonly state: HostBroadcastPermissionState;
      readonly type: 'PERMISSION_CHANGED';
    }
  | { readonly ready: boolean; readonly type: 'NATIVE_MEDIA_CHANGED' }
  | {
      readonly ready: boolean;
      readonly type: 'BACKEND_MEDIA_CONTRACT_CHANGED';
    }
  | { readonly type: 'CREATE_SESSION_REQUESTED' }
  | { readonly liveSessionId: string; readonly type: 'CREATE_SESSION_SUCCEEDED' }
  | {
      readonly type: 'CREATE_SESSION_FAILED';
      readonly viewerSafeErrorText: string;
    }
  | { readonly type: 'PREPARE_MEDIA_REQUESTED' }
  | { readonly type: 'PREPARE_MEDIA_SUCCEEDED' }
  | {
      readonly type: 'PREPARE_MEDIA_FAILED';
      readonly viewerSafeErrorText: string;
    }
  | { readonly type: 'PREPARED_MEDIA_CLEARED' }
  | { readonly type: 'GO_LIVE_REQUESTED' }
  | { readonly liveSessionId: string; readonly type: 'GO_LIVE_SUCCEEDED' }
  | {
      readonly retryable: boolean;
      readonly type: 'GO_LIVE_FAILED';
      readonly viewerSafeErrorText: string;
    }
  | { readonly type: 'END_REQUESTED' }
  | { readonly type: 'END_SUCCEEDED' }
  | { readonly type: 'END_FAILED'; readonly viewerSafeErrorText: string }
  | { readonly type: 'BACKGROUND_END_REQUESTED' }
  | { readonly type: 'BACKGROUND_END_FINISHED' }
  | {
      readonly type: 'PUBLISHING_FAILED';
      readonly viewerSafeErrorText: string;
    }
  | {
      readonly type: 'HOST_ACTION_ERROR_REPORTED';
      readonly viewerSafeErrorText: string;
    }
  | { readonly type: 'HOST_ACTION_ERROR_CLEARED' };

type HostBroadcastPreflightMachineActions = {
  readonly clearError: undefined;
  readonly clearPreparedMedia: undefined;
  readonly endSession: undefined;
  readonly failAndClearPreparedMedia: undefined;
  readonly failGoLiveRetryable: undefined;
  readonly failWorkflow: undefined;
  readonly finishBackgroundEnd: undefined;
  readonly markPreparedMedia: undefined;
  readonly reportHostActionError: undefined;
  readonly requestBackgroundEnd: undefined;
  readonly requestCreateSession: undefined;
  readonly succeedCreateSession: undefined;
  readonly succeedGoLive: undefined;
  readonly updateBackendMediaContract: undefined;
  readonly updateNativeMedia: undefined;
  readonly updatePermission: undefined;
};

type HostBroadcastPreflightMachineGuards = {
  readonly canCreateSession: undefined;
  readonly canGoLive: undefined;
  readonly canPrepareMedia: undefined;
  readonly hasGoneLive: undefined;
  readonly hasStartedSession: undefined;
  readonly isRetryableGoLiveFailure: undefined;
  readonly willBeReadyToPublish: undefined;
};

export type HostBroadcastPreflightWorkflowViewState = {
  readonly blockers: ReadonlyArray<HostBroadcastPreflightBlocker>;
  readonly canCreateSession: boolean;
  readonly canGoLive: boolean;
  readonly canPrepareMedia: boolean;
  readonly canUseBackAction: boolean;
  readonly errorMessage: string | null;
  readonly hasBlockers: boolean;
  readonly hasPreparedMedia: boolean;
  readonly isGoingLive: boolean;
  readonly isPreparingMedia: boolean;
  readonly preflightState: HostBroadcastPreflightState;
  readonly sessionState: HostBroadcastSessionState;
  readonly status: HostBroadcastPreflightWorkflowStatus;
};

const initialPreflightState = createHostBroadcastPreflightState();
const initialHostBroadcastPreflightMachineContext: HostBroadcastPreflightMachineContext =
  {
    backendMediaContractReady:
      initialPreflightState.backendMediaContractReady,
    cameraPermission: initialPreflightState.cameraPermission,
    hasBackgroundEndRequestInFlight: false,
    hasGoneLive: false,
    hasPreparedMedia: false,
    liveSessionId: null,
    microphonePermission: initialPreflightState.microphonePermission,
    nativeMediaReady: initialPreflightState.nativeMediaReady,
    viewerSafeErrorText: null,
  };

export const INITIAL_HOST_BROADCAST_PREFLIGHT_WORKFLOW_STATE: HostBroadcastPreflightWorkflowViewState =
  {
    blockers: hostBroadcastPreflightBlockers(initialPreflightState),
    canCreateSession: false,
    canGoLive: false,
    canPrepareMedia: false,
    canUseBackAction: true,
    errorMessage: null,
    hasBlockers: true,
    hasPreparedMedia: false,
    isGoingLive: false,
    isPreparingMedia: false,
    preflightState: initialPreflightState,
    sessionState: {
      liveSessionId: null,
      status: 'idle',
      viewerSafeErrorText: null,
    },
    status: 'idle',
  };

export const hostBroadcastPreflightMachine = setup<
  HostBroadcastPreflightMachineContext,
  HostBroadcastPreflightMachineEvent,
  Record<string, never>,
  Record<string, never>,
  HostBroadcastPreflightMachineActions,
  HostBroadcastPreflightMachineGuards
>({
  actors: {},
  guards: {
    canCreateSession: ({ context }) =>
      canCreateHostPreflightSession(selectPreflightStateFromContext(context)) &&
      context.liveSessionId === null,
    canGoLive: ({ context }) => canGoLiveFromContext(context),
    canPrepareMedia: ({ context }) =>
      context.liveSessionId !== null && !context.hasPreparedMedia,
    hasStartedSession: ({ context }) => context.liveSessionId !== null,
    hasGoneLive: ({ context }) => context.hasGoneLive,
    isRetryableGoLiveFailure: ({ event }) =>
      event.type === 'GO_LIVE_FAILED' && event.retryable,
    willBeReadyToPublish: ({ context, event }) => {
      const backendMediaContractReady =
        event.type === 'BACKEND_MEDIA_CONTRACT_CHANGED'
          ? event.ready
          : context.backendMediaContractReady;
      const hasPreparedMedia =
        event.type === 'PREPARE_MEDIA_SUCCEEDED'
          ? true
          : context.hasPreparedMedia;

      return (
        context.liveSessionId !== null &&
        hasPreparedMedia &&
        canGoLiveFromHostPreflight({
          ...selectPreflightStateFromContext(context),
          backendMediaContractReady,
        })
      );
    },
  },
  actions: {
    updatePermission: assign(({ event }) => {
      if (event.type !== 'PERMISSION_CHANGED') {
        return {};
      }

      return event.permission === 'camera'
        ? { cameraPermission: event.state }
        : { microphonePermission: event.state };
    }),
    updateNativeMedia: assign(({ event }) => {
      if (event.type !== 'NATIVE_MEDIA_CHANGED') {
        return {};
      }

      return {
        nativeMediaReady: event.ready,
      };
    }),
    updateBackendMediaContract: assign(({ event }) => {
      if (event.type !== 'BACKEND_MEDIA_CONTRACT_CHANGED') {
        return {};
      }

      return {
        backendMediaContractReady: event.ready,
      };
    }),
    requestCreateSession: assign({
      backendMediaContractReady: false,
      hasPreparedMedia: false,
      hasGoneLive: false,
      liveSessionId: null,
      viewerSafeErrorText: null,
    }),
    succeedCreateSession: assign(({ event }) => {
      if (event.type !== 'CREATE_SESSION_SUCCEEDED') {
        return {};
      }

      return {
        liveSessionId: event.liveSessionId,
        viewerSafeErrorText: null,
      };
    }),
    clearError: assign({
      viewerSafeErrorText: null,
    }),
    markPreparedMedia: assign({
      hasPreparedMedia: true,
      viewerSafeErrorText: null,
    }),
    clearPreparedMedia: assign({
      backendMediaContractReady: false,
      hasPreparedMedia: false,
    }),
    failWorkflow: assign(({ event }) => {
      if (!isViewerSafeFailureEvent(event)) {
        return {};
      }

      return {
        viewerSafeErrorText: event.viewerSafeErrorText,
      };
    }),
    failAndClearPreparedMedia: assign(({ event }) => {
      if (!isViewerSafeFailureEvent(event)) {
        return {};
      }

      return {
        backendMediaContractReady: false,
        hasPreparedMedia: false,
        viewerSafeErrorText: event.viewerSafeErrorText,
      };
    }),
    failGoLiveRetryable: assign(({ event }) => {
      if (event.type !== 'GO_LIVE_FAILED') {
        return {};
      }

      return {
        viewerSafeErrorText: event.viewerSafeErrorText,
      };
    }),
    requestBackgroundEnd: assign({
      hasBackgroundEndRequestInFlight: true,
    }),
    finishBackgroundEnd: assign({
      hasBackgroundEndRequestInFlight: false,
    }),
    succeedGoLive: assign(({ event }) => {
      if (event.type !== 'GO_LIVE_SUCCEEDED') {
        return {};
      }

      return {
        hasGoneLive: true,
        liveSessionId: event.liveSessionId,
        viewerSafeErrorText: null,
      };
    }),
    endSession: assign({
      backendMediaContractReady: false,
      hasGoneLive: false,
      hasPreparedMedia: false,
      liveSessionId: null,
      viewerSafeErrorText: null,
    }),
    reportHostActionError: assign(({ event }) => {
      if (event.type === 'HOST_ACTION_ERROR_CLEARED') {
        return {
          viewerSafeErrorText: null,
        };
      }

      if (
        event.type !== 'HOST_ACTION_ERROR_REPORTED' &&
        event.type !== 'PUBLISHING_FAILED'
      ) {
        return {};
      }

      return {
        viewerSafeErrorText: event.viewerSafeErrorText,
      };
    }),
  },
}).createMachine({
  id: 'hostBroadcastPreflight',
  initial: 'idle',
  context: initialHostBroadcastPreflightMachineContext,
  on: {
    PERMISSION_CHANGED: {
      actions: 'updatePermission',
    },
    NATIVE_MEDIA_CHANGED: {
      actions: 'updateNativeMedia',
    },
    HOST_ACTION_ERROR_REPORTED: {
      actions: 'reportHostActionError',
    },
    HOST_ACTION_ERROR_CLEARED: {
      actions: 'reportHostActionError',
    },
    BACKGROUND_END_REQUESTED: {
      actions: 'requestBackgroundEnd',
      guard: 'hasStartedSession',
    },
    BACKGROUND_END_FINISHED: {
      actions: 'finishBackgroundEnd',
    },
  },
  states: {
    idle: {
      on: {
        CREATE_SESSION_REQUESTED: {
          actions: 'requestCreateSession',
          guard: 'canCreateSession',
          target: 'creating',
        },
      },
    },
    creating: {
      on: {
        CREATE_SESSION_SUCCEEDED: {
          actions: 'succeedCreateSession',
          target: 'starting',
        },
        CREATE_SESSION_FAILED: {
          actions: 'failWorkflow',
          target: 'idle',
        },
      },
    },
    starting: {
      on: {
        BACKEND_MEDIA_CONTRACT_CHANGED: [
          {
            actions: 'updateBackendMediaContract',
            guard: 'willBeReadyToPublish',
            target: 'readyToPublish',
          },
          {
            actions: 'updateBackendMediaContract',
          },
        ],
        END_REQUESTED: {
          actions: 'clearError',
          guard: 'hasStartedSession',
          target: 'ending',
        },
        PREPARE_MEDIA_REQUESTED: {
          actions: 'clearError',
          guard: 'canPrepareMedia',
          target: 'preparingMedia',
        },
        PREPARED_MEDIA_CLEARED: {
          actions: 'clearPreparedMedia',
        },
        PUBLISHING_FAILED: {
          actions: ['clearPreparedMedia', 'reportHostActionError'],
        },
        GO_LIVE_REQUESTED: {
          actions: 'clearError',
          guard: 'canGoLive',
          target: 'goingLive',
        },
      },
    },
    preparingMedia: {
      on: {
        END_REQUESTED: {
          actions: 'clearError',
          guard: 'hasStartedSession',
          target: 'ending',
        },
        PREPARE_MEDIA_SUCCEEDED: [
          {
            actions: 'markPreparedMedia',
            guard: 'willBeReadyToPublish',
            target: 'readyToPublish',
          },
          {
            actions: 'markPreparedMedia',
            target: 'starting',
          },
        ],
        PREPARE_MEDIA_FAILED: {
          actions: 'failAndClearPreparedMedia',
          target: 'starting',
        },
        PREPARED_MEDIA_CLEARED: {
          actions: 'clearPreparedMedia',
          target: 'starting',
        },
        PUBLISHING_FAILED: {
          actions: ['clearPreparedMedia', 'reportHostActionError'],
          target: 'starting',
        },
      },
    },
    readyToPublish: {
      on: {
        BACKEND_MEDIA_CONTRACT_CHANGED: [
          {
            actions: 'updateBackendMediaContract',
            guard: 'willBeReadyToPublish',
          },
          {
            actions: 'updateBackendMediaContract',
            target: 'starting',
          },
        ],
        END_REQUESTED: {
          actions: 'clearError',
          guard: 'hasStartedSession',
          target: 'ending',
        },
        GO_LIVE_REQUESTED: {
          actions: 'clearError',
          guard: 'canGoLive',
          target: 'goingLive',
        },
        PREPARED_MEDIA_CLEARED: {
          actions: 'clearPreparedMedia',
          target: 'starting',
        },
        PUBLISHING_FAILED: {
          actions: ['clearPreparedMedia', 'reportHostActionError'],
          target: 'starting',
        },
      },
    },
    goingLive: {
      on: {
        GO_LIVE_SUCCEEDED: {
          actions: 'succeedGoLive',
          target: 'live',
        },
        GO_LIVE_FAILED: [
          {
            actions: 'failGoLiveRetryable',
            guard: 'isRetryableGoLiveFailure',
            target: 'readyToPublish',
          },
          {
            actions: 'failAndClearPreparedMedia',
            target: 'starting',
          },
        ],
        PUBLISHING_FAILED: {
          actions: ['clearPreparedMedia', 'reportHostActionError'],
          target: 'starting',
        },
      },
    },
    live: {
      on: {
        END_REQUESTED: {
          actions: 'clearError',
          guard: 'hasStartedSession',
          target: 'ending',
        },
      },
    },
    ending: {
      on: {
        END_SUCCEEDED: {
          actions: 'endSession',
          target: 'ended',
        },
        END_FAILED: [
          {
            actions: 'failWorkflow',
            guard: 'hasGoneLive',
            target: 'live',
          },
          {
            actions: 'failWorkflow',
            guard: 'canGoLive',
            target: 'readyToPublish',
          },
          {
            actions: 'failWorkflow',
            target: 'starting',
          },
        ],
      },
    },
    ended: {
      on: {
        CREATE_SESSION_REQUESTED: {
          actions: 'requestCreateSession',
          guard: 'canCreateSession',
          target: 'creating',
        },
      },
    },
  },
});

export type HostBroadcastPreflightSnapshot = SnapshotFrom<
  typeof hostBroadcastPreflightMachine
>;

export function selectHostBroadcastPreflightWorkflowState(
  snapshot: HostBroadcastPreflightSnapshot,
): HostBroadcastPreflightWorkflowViewState {
  const preflightState = selectHostBroadcastPreflightState(snapshot);
  const sessionState = selectHostBroadcastSessionState(snapshot);
  const blockers = hostBroadcastPreflightBlockers(preflightState);

  return {
    blockers,
    canCreateSession: selectCanCreateHostBroadcastPreflightSession(snapshot),
    canGoLive: selectCanGoLiveFromHostBroadcastPreflight(snapshot),
    canPrepareMedia: selectCanPrepareHostBroadcastMedia(snapshot),
    canUseBackAction: selectCanUseHostPreflightBackAction(snapshot),
    errorMessage: snapshot.context.viewerSafeErrorText,
    hasBlockers: blockers.length > 0,
    hasPreparedMedia: snapshot.context.hasPreparedMedia,
    isGoingLive: snapshot.matches('goingLive'),
    isPreparingMedia: snapshot.matches('preparingMedia'),
    preflightState,
    sessionState,
    status: selectHostBroadcastPreflightWorkflowStatus(snapshot),
  };
}

export function selectHostBroadcastPreflightState(
  snapshot: HostBroadcastPreflightSnapshot,
): HostBroadcastPreflightState {
  return selectPreflightStateFromContext(snapshot.context);
}

export function selectHostBroadcastSessionState(
  snapshot: HostBroadcastPreflightSnapshot,
): HostBroadcastSessionState {
  return {
    liveSessionId: snapshot.context.liveSessionId,
    status: selectHostBroadcastSessionStatus(snapshot),
    viewerSafeErrorText: snapshot.context.viewerSafeErrorText,
  };
}

export function selectHostBroadcastPreflightWorkflowStatus(
  snapshot: HostBroadcastPreflightSnapshot,
): HostBroadcastPreflightWorkflowStatus {
  if (snapshot.matches('creating')) {
    return 'creating';
  }

  if (snapshot.matches('preparingMedia')) {
    return 'preparing_media';
  }

  if (snapshot.matches('readyToPublish')) {
    return 'ready_to_publish';
  }

  if (snapshot.matches('goingLive')) {
    return 'going_live';
  }

  if (snapshot.matches('live')) {
    return 'live';
  }

  if (snapshot.matches('ending')) {
    return 'ending';
  }

  if (snapshot.matches('ended')) {
    return 'ended';
  }

  if (snapshot.matches('starting')) {
    return 'starting';
  }

  return 'idle';
}

export function selectCanCreateHostBroadcastPreflightSession(
  snapshot: HostBroadcastPreflightSnapshot,
): boolean {
  return (
    (snapshot.matches('idle') || snapshot.matches('ended')) &&
    snapshot.context.liveSessionId === null &&
    canCreateHostPreflightSession(selectHostBroadcastPreflightState(snapshot))
  );
}

export function selectCanPrepareHostBroadcastMedia(
  snapshot: HostBroadcastPreflightSnapshot,
): boolean {
  return (
    (snapshot.matches('starting') || snapshot.matches('readyToPublish')) &&
    snapshot.context.liveSessionId !== null &&
    !snapshot.context.hasPreparedMedia
  );
}

export function selectCanGoLiveFromHostBroadcastPreflight(
  snapshot: HostBroadcastPreflightSnapshot,
): boolean {
  return (
    !snapshot.matches('goingLive') &&
    !snapshot.matches('ending') &&
    !snapshot.matches('live') &&
    snapshot.context.liveSessionId !== null &&
    snapshot.context.hasPreparedMedia &&
    canGoLiveFromHostPreflight(selectHostBroadcastPreflightState(snapshot))
  );
}

export function selectCanUseHostPreflightBackAction(
  snapshot: HostBroadcastPreflightSnapshot,
): boolean {
  return (
    !snapshot.matches('creating') &&
    !snapshot.matches('ending') &&
    !snapshot.matches('goingLive') &&
    !snapshot.matches('live')
  );
}

export function selectShouldPreventHostBroadcastPreflightNavigationRemoval(
  snapshot: HostBroadcastPreflightSnapshot,
): boolean {
  return (
    snapshot.context.liveSessionId !== null &&
    !snapshot.matches('ended') &&
    !snapshot.matches('goingLive') &&
    !snapshot.matches('live')
  );
}

export function selectCanRequestHostBroadcastBackgroundEnd(
  snapshot: HostBroadcastPreflightSnapshot,
  liveSessionId: string,
): boolean {
  return (
    snapshot.context.liveSessionId === liveSessionId &&
    !snapshot.context.hasBackgroundEndRequestInFlight &&
    !snapshot.matches('creating') &&
    !snapshot.matches('ending') &&
    !snapshot.matches('goingLive') &&
    !snapshot.matches('ended')
  );
}

export function selectHostBroadcastPreflightCleanupLiveSessionId(
  snapshot: HostBroadcastPreflightSnapshot,
  cleanupState: Partial<HostBroadcastPreflightCleanupState> = {},
): string | null {
  if (
    cleanupState.hasEndLiveSessionRequestInFlight ||
    cleanupState.hasGoLiveRequestInFlight ||
    cleanupState.hasGoLiveSucceeded ||
    snapshot.context.hasBackgroundEndRequestInFlight ||
    snapshot.matches('creating') ||
    snapshot.matches('ending') ||
    snapshot.matches('goingLive') ||
    snapshot.matches('live')
  ) {
    return null;
  }

  return snapshot.context.liveSessionId;
}

function selectHostBroadcastSessionStatus(
  snapshot: HostBroadcastPreflightSnapshot,
): HostBroadcastSessionState['status'] {
  if (snapshot.matches('creating')) {
    return 'creating';
  }

  if (snapshot.matches('ending')) {
    return 'ending';
  }

  if (snapshot.matches('ended')) {
    return 'ended';
  }

  return snapshot.context.liveSessionId === null ? 'idle' : 'starting';
}

function selectPreflightStateFromContext(
  context: HostBroadcastPreflightMachineContext,
): HostBroadcastPreflightState {
  return {
    backendMediaContractReady: context.backendMediaContractReady,
    cameraPermission: context.cameraPermission,
    microphonePermission: context.microphonePermission,
    nativeMediaReady: context.nativeMediaReady,
  };
}

function canGoLiveFromContext(
  context: HostBroadcastPreflightMachineContext,
): boolean {
  return (
    context.liveSessionId !== null &&
    context.hasPreparedMedia &&
    canGoLiveFromHostPreflight(selectPreflightStateFromContext(context))
  );
}

function isViewerSafeFailureEvent(
  event: HostBroadcastPreflightMachineEvent,
): event is Extract<
  HostBroadcastPreflightMachineEvent,
  { readonly viewerSafeErrorText: string }
> {
  return 'viewerSafeErrorText' in event;
}

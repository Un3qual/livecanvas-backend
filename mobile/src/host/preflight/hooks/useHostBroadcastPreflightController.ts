import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { UseMutationConfig } from 'react-relay';
import { createActor, type ActorRefFrom } from 'xstate';

import type { AuthState } from '../../../auth/types';
import { formatLiveMutationErrors } from '../../../live/liveSessionPresentation';
import {
  isRetryableHostGoLiveMediaReadinessError,
  readPreparedHostBroadcastMedia,
  type HostBroadcastMediaPreparation,
} from '../../hostBroadcastMediaSignaling';
import {
  createHostBroadcastNative,
  type HostBroadcastNative,
} from '../../hostBroadcastNative';
import {
  createHostBroadcastPublishingPreflightController,
  type HostBroadcastPublishingResource,
  type HostBroadcastPublishingSessionStore,
} from '../../publishing/hostBroadcastPublishingSessionStore';
import {
  INITIAL_HOST_BROADCAST_PREFLIGHT_WORKFLOW_STATE,
  hostBroadcastPreflightMachine,
  selectHostBroadcastPreflightCleanupLiveSessionId,
  selectHostBroadcastPreflightWorkflowState,
  type HostBroadcastPreflightMachineEvent,
  type HostBroadcastPreflightWorkflowViewState,
} from '../state/hostBroadcastPreflightMachine';
import type {
  HostBroadcastPreflightScreenEndMutation,
  HostBroadcastPreflightScreenGoLiveMutation,
  HostBroadcastPreflightScreenPrepareMediaMutation,
  HostBroadcastPreflightScreenStartMutation,
} from '../hostBroadcastPreflightOperations';
import type {
  HostBroadcastControlsCardProps,
  HostBroadcastPreflightReadinessCardProps,
} from '../components/HostPreflightCards';
import {
  useHostBroadcastPublishingController,
  type HostBroadcastPublishingStatus,
} from './useHostBroadcastPublishingController';

const HOST_PUBLISHING_ERROR =
  'Could not start host media publishing. Please try again.';

type PreflightEndLiveSessionOptions = {
  readonly navigateBackOnSuccess: boolean;
  readonly updateSessionLifecycle?: boolean;
};

export type HostBroadcastStartLiveSessionCommit = (
  config: UseMutationConfig<HostBroadcastPreflightScreenStartMutation>,
) => unknown;

export type HostBroadcastPrepareMediaCommit = (
  config: UseMutationConfig<HostBroadcastPreflightScreenPrepareMediaMutation>,
) => unknown;

export type HostBroadcastGoLiveCommit = (
  config: UseMutationConfig<HostBroadcastPreflightScreenGoLiveMutation>,
) => unknown;

export type HostBroadcastEndLiveSessionCommit = (
  config: UseMutationConfig<HostBroadcastPreflightScreenEndMutation>,
) => unknown;

export type HostBroadcastPreflightController = {
  readonly controlsCardProps: HostBroadcastControlsCardProps;
  readonly readinessCardProps: HostBroadcastPreflightReadinessCardProps;
};

export type HostBroadcastPreflightControllerOptions = {
  readonly authStatus: AuthState['status'];
  readonly commitEndLiveSession: HostBroadcastEndLiveSessionCommit;
  readonly commitGoLive: HostBroadcastGoLiveCommit;
  readonly commitPrepareMedia: HostBroadcastPrepareMediaCommit;
  readonly commitStartLiveSession: HostBroadcastStartLiveSessionCommit;
  readonly createNative?: () => HostBroadcastNative;
  readonly getAccessToken: () => string | null;
  readonly hostPublishingSessions: HostBroadcastPublishingSessionStore;
  readonly navigateBack: () => void;
  readonly navigateToLiveSession: (liveSessionId: string) => void;
  readonly websocketUrl: string;
};

export type HostBroadcastPreflightControllerLifecycleOptions = {
  readonly commitEndLiveSession: HostBroadcastEndLiveSessionCommit;
  readonly commitGoLive: HostBroadcastGoLiveCommit;
  readonly commitPrepareMedia: HostBroadcastPrepareMediaCommit;
  readonly commitStartLiveSession: HostBroadcastStartLiveSessionCommit;
  readonly disposeNative: () => void;
  readonly failPreparedPublishing: (reason: string) => void;
  readonly hasRetainedPublishingResource: () => boolean;
  readonly navigateBack: () => void;
  readonly navigateToLiveSession: (liveSessionId: string) => void;
  readonly onWorkflowStateChanged: (
    state: HostBroadcastPreflightWorkflowViewState,
  ) => void;
  readonly resetPreparedMedia: () => void;
  readonly retainAttachedPublishingForLiveSession: (
    liveSessionId: string,
  ) => HostBroadcastPublishingResource | null;
  readonly setPreparedMedia: (
    preparedMedia: HostBroadcastMediaPreparation | null,
  ) => void;
};

export type HostBroadcastPreflightControllerLifecycle = {
  readonly handleBackPress: () => void;
  readonly handleCreateSessionPress: () => void;
  readonly handleGoLivePress: () => void;
  readonly handlePrepareMediaPress: () => void;
  readonly mount: () => void;
  readonly requestPreflightEndLiveSession: (
    liveSessionId: string,
    options?: PreflightEndLiveSessionOptions,
  ) => void;
  readonly sendWorkflowEvent: (
    event: HostBroadcastPreflightMachineEvent,
  ) => HostBroadcastPreflightWorkflowViewState;
  readonly unmount: () => void;
  readonly updateOptions: (
    options: HostBroadcastPreflightControllerLifecycleOptions,
  ) => void;
};

type HostBroadcastPreflightActor = ActorRefFrom<
  typeof hostBroadcastPreflightMachine
>;

export function createHostBroadcastPreflightControllerLifecycle(
  initialOptions: HostBroadcastPreflightControllerLifecycleOptions,
): HostBroadcastPreflightControllerLifecycle {
  let options = initialOptions;
  const actor: HostBroadcastPreflightActor = createActor(
    hostBroadcastPreflightMachine,
  ).start();
  let currentWorkflowState = selectHostBroadcastPreflightWorkflowState(
    actor.getSnapshot(),
  );
  let isMounted = true;

  function updateOptions(nextOptions: HostBroadcastPreflightControllerLifecycleOptions) {
    options = nextOptions;
  }

  function publishWorkflowState() {
    currentWorkflowState = selectHostBroadcastPreflightWorkflowState(
      actor.getSnapshot(),
    );

    if (isMounted) {
      options.onWorkflowStateChanged(currentWorkflowState);
    }

    return currentWorkflowState;
  }

  function sendWorkflowEvent(event: HostBroadcastPreflightMachineEvent) {
    actor.send(event);
    return publishWorkflowState();
  }

  function readWorkflowState() {
    currentWorkflowState = selectHostBroadcastPreflightWorkflowState(
      actor.getSnapshot(),
    );
    return currentWorkflowState;
  }

  function requestPreflightEndLiveSession(
    liveSessionId: string,
    endOptions: PreflightEndLiveSessionOptions = {
      navigateBackOnSuccess: false,
    },
  ) {
    // Back cleanup reports failures to the mounted screen, while abandoned
    // cleanup only attempts non-blocking teardown after unmount.
    if (readWorkflowState().status === 'ending') {
      return;
    }

    const updateSessionLifecycle =
      endOptions.navigateBackOnSuccess ||
      endOptions.updateSessionLifecycle === true;

    sendWorkflowEvent({ type: 'END_REQUESTED' });

    options.commitEndLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.endLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          if (updateSessionLifecycle) {
            sendWorkflowEvent({
              type: 'END_FAILED',
              viewerSafeErrorText,
            });
          } else {
            sendWorkflowEvent({
              type: 'END_FAILED',
              viewerSafeErrorText,
            });
          }
          return;
        }

        sendWorkflowEvent({ type: 'END_SUCCEEDED' });
        if (endOptions.navigateBackOnSuccess) {
          options.navigateBack();
        }
      },
      onError: () => {
        const viewerSafeErrorText = formatLiveMutationErrors([]);
        if (updateSessionLifecycle) {
          sendWorkflowEvent({
            type: 'END_FAILED',
            viewerSafeErrorText,
          });
        } else {
          sendWorkflowEvent({
            type: 'END_FAILED',
            viewerSafeErrorText,
          });
        }
      },
    });
  }

  function requestAbandonedPreflightEndLiveSession(liveSessionId: string) {
    // Abandoned preflight cleanup is best-effort and non-navigating; the
    // machine cleanup selector makes duplicate end/go-live races no-ops.
    if (
      selectHostBroadcastPreflightCleanupLiveSessionId(actor.getSnapshot()) !==
      liveSessionId
    ) {
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: false,
    });
  }

  function handleCreateSessionPress() {
    if (!readWorkflowState().canCreateSession) {
      return;
    }

    sendWorkflowEvent({ type: 'CREATE_SESSION_REQUESTED' });
    options.resetPreparedMedia();

    options.commitStartLiveSession({
      variables: {
        input: {
          visibility: 'PUBLIC',
        },
      },
      onCompleted: (payload) => {
        const result = payload.startLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!isMounted) {
            return;
          }

          sendWorkflowEvent({
            type: 'CREATE_SESSION_FAILED',
            viewerSafeErrorText: formatLiveMutationErrors(result?.errors),
          });
          return;
        }

        sendWorkflowEvent({
          liveSessionId: result.liveSession.id,
          type: 'CREATE_SESSION_SUCCEEDED',
        });

        if (!isMounted) {
          requestAbandonedPreflightEndLiveSession(result.liveSession.id);
        }
      },
      onError: () => {
        if (!isMounted) {
          return;
        }

        sendWorkflowEvent({
          type: 'CREATE_SESSION_FAILED',
          viewerSafeErrorText: formatLiveMutationErrors([]),
        });
      },
    });
  }

  function handlePrepareMediaPress() {
    const workflowState = readWorkflowState();
    const liveSessionId = workflowState.sessionState.liveSessionId;

    if (!workflowState.canPrepareMedia || !liveSessionId) {
      return;
    }

    sendWorkflowEvent({ type: 'PREPARE_MEDIA_REQUESTED' });

    options.commitPrepareMedia({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.prepareLiveMediaSession;
        const prepared = readPreparedHostBroadcastMedia(result);

        if (!prepared) {
          options.resetPreparedMedia();
          sendWorkflowEvent({
            type: 'PREPARE_MEDIA_FAILED',
            viewerSafeErrorText: formatLiveMutationErrors(result?.errors),
          });
          return;
        }

        options.setPreparedMedia(prepared);
        sendWorkflowEvent({ type: 'PREPARE_MEDIA_SUCCEEDED' });
      },
      onError: () => {
        options.resetPreparedMedia();
        sendWorkflowEvent({
          type: 'PREPARE_MEDIA_FAILED',
          viewerSafeErrorText: formatLiveMutationErrors([]),
        });
      },
    });
  }

  function handleGoLivePress() {
    const workflowState = readWorkflowState();
    const liveSessionId = workflowState.sessionState.liveSessionId;

    if (!workflowState.canGoLive || !liveSessionId) {
      return;
    }

    sendWorkflowEvent({ type: 'GO_LIVE_REQUESTED' });

    options.commitGoLive({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        const result = payload.goLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          const retryable = isRetryableHostGoLiveMediaReadinessError(
            result?.errors,
          );
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);

          if (!retryable) {
            options.resetPreparedMedia();
          }

          sendWorkflowEvent({
            retryable,
            type: 'GO_LIVE_FAILED',
            viewerSafeErrorText,
          });

          if (!isMounted) {
            requestAbandonedPreflightEndLiveSession(liveSessionId);
          }
          return;
        }

        const retainedResource = options.retainAttachedPublishingForLiveSession(
          result.liveSession.id,
        );

        if (!retainedResource) {
          if (!isMounted) {
            sendWorkflowEvent({
              type: 'PUBLISHING_FAILED',
              viewerSafeErrorText: HOST_PUBLISHING_ERROR,
            });
            requestAbandonedPreflightEndLiveSession(result.liveSession.id);
            return;
          }

          options.failPreparedPublishing(HOST_PUBLISHING_ERROR);
          // Go-live already succeeded, so end the backend session if the host
          // cannot retain the publishing runtime needed to serve viewers.
          requestPreflightEndLiveSession(result.liveSession.id, {
            navigateBackOnSuccess: false,
            updateSessionLifecycle: true,
          });
          return;
        }

        sendWorkflowEvent({
          liveSessionId: result.liveSession.id,
          type: 'GO_LIVE_SUCCEEDED',
        });
        options.navigateToLiveSession(result.liveSession.id);
      },
      onError: () => {
        if (!isMounted) {
          return;
        }

        sendWorkflowEvent({
          retryable: true,
          type: 'GO_LIVE_FAILED',
          viewerSafeErrorText: formatLiveMutationErrors([]),
        });
      },
    });
  }

  function handleBackPress() {
    if (!readWorkflowState().canUseBackAction) {
      return;
    }

    const liveSessionId = selectHostBroadcastPreflightCleanupLiveSessionId(
      actor.getSnapshot(),
    );

    if (!liveSessionId) {
      options.navigateBack();
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: true,
    });
  }

  function mount() {
    isMounted = true;
    publishWorkflowState();
  }

  function unmount() {
    isMounted = false;
    const liveSessionId = selectHostBroadcastPreflightCleanupLiveSessionId(
      actor.getSnapshot(),
    );

    if (liveSessionId) {
      requestAbandonedPreflightEndLiveSession(liveSessionId);
    }

    if (!options.hasRetainedPublishingResource()) {
      options.disposeNative();
    }
  }

  return {
    handleBackPress,
    handleCreateSessionPress,
    handleGoLivePress,
    handlePrepareMediaPress,
    mount,
    requestPreflightEndLiveSession,
    sendWorkflowEvent,
    unmount,
    updateOptions,
  };
}

export function useHostBroadcastPreflightController({
  authStatus,
  commitEndLiveSession,
  commitGoLive,
  commitPrepareMedia,
  commitStartLiveSession,
  createNative = createHostBroadcastNative,
  getAccessToken,
  hostPublishingSessions,
  navigateBack,
  navigateToLiveSession,
  websocketUrl,
}: HostBroadcastPreflightControllerOptions): HostBroadcastPreflightController {
  const native = useMemo(() => createNative(), [createNative]);
  const publishingPreflightController = useMemo(
    () => createHostBroadcastPublishingPreflightController(),
    [],
  );
  const [workflowState, setWorkflowState] =
    useState<HostBroadcastPreflightWorkflowViewState>(
      INITIAL_HOST_BROADCAST_PREFLIGHT_WORKFLOW_STATE,
    );
  const {
    canCreateSession,
    canGoLive,
    canPrepareMedia,
    canUseBackAction,
    errorMessage,
    hasBlockers,
    hasPreparedMedia,
    isGoingLive,
    isPreparingMedia,
    preflightState,
    sessionState,
  } = workflowState;
  const [preparedMedia, setPreparedMedia] =
    useState<HostBroadcastMediaPreparation | null>(null);
  const [publishingStatus, setPublishingStatus] =
    useState<HostBroadcastPublishingStatus>('idle');
  const hasRetainedHostPublishingResourceRef = useRef(false);
  const retainedHostPublishingResourceRef =
    useRef<HostBroadcastPublishingResource | null>(null);
  const retainedHostPublishingLiveSessionIdsRef = useRef(
    new Map<HostBroadcastPublishingResource, string>(),
  );
  const hasRetainedPublishingResourceCallbackRef = useRef<() => boolean>(
    () => false,
  );
  const retainAttachedPublishingForLiveSessionCallbackRef = useRef<
    (liveSessionId: string) => HostBroadcastPublishingResource | null
  >(() => null);
  const preflightLifecycleRef =
    useRef<HostBroadcastPreflightControllerLifecycle | null>(null);

  const resetPreparedMedia = useCallback(() => {
    setPreparedMedia(null);
    setPublishingStatus('idle');
  }, []);

  const failPreparedPublishing = useCallback(
    (reason: string) => {
      publishingPreflightController.cleanupAttachedResource();
      setPreparedMedia(null);
      setPublishingStatus('errored');
      preflightLifecycleRef.current?.sendWorkflowEvent({
        type: 'PUBLISHING_FAILED',
        viewerSafeErrorText: reason,
      });
    },
    [publishingPreflightController],
  );

  const setBackendMediaContractReady = useCallback((ready: boolean) => {
    preflightLifecycleRef.current?.sendWorkflowEvent({
      ready,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });
  }, []);

  const setHostActionError = useCallback((error: string | null) => {
    preflightLifecycleRef.current?.sendWorkflowEvent(
      error
        ? {
            type: 'HOST_ACTION_ERROR_REPORTED',
            viewerSafeErrorText: error,
          }
        : { type: 'HOST_ACTION_ERROR_CLEARED' },
    );
  }, []);

  const setIdlePublishingStatusUnlessErrored = useCallback(() => {
    setPublishingStatus((status) => (status === 'errored' ? status : 'idle'));
  }, []);

  const preflightLifecycleOptions: HostBroadcastPreflightControllerLifecycleOptions =
    {
      commitEndLiveSession,
      commitGoLive,
      commitPrepareMedia,
      commitStartLiveSession,
      disposeNative: native.dispose,
      failPreparedPublishing,
      hasRetainedPublishingResource: () =>
        hasRetainedPublishingResourceCallbackRef.current(),
      navigateBack,
      navigateToLiveSession,
      onWorkflowStateChanged: setWorkflowState,
      resetPreparedMedia,
      retainAttachedPublishingForLiveSession: (liveSessionId) =>
        retainAttachedPublishingForLiveSessionCallbackRef.current(liveSessionId),
      setPreparedMedia,
    };

  if (!preflightLifecycleRef.current) {
    preflightLifecycleRef.current =
      createHostBroadcastPreflightControllerLifecycle(
        preflightLifecycleOptions,
      );
  } else {
    preflightLifecycleRef.current.updateOptions(preflightLifecycleOptions);
  }

  const preflightLifecycle = preflightLifecycleRef.current;

  const publishingController = useHostBroadcastPublishingController({
    authStatus,
    failPreparedPublishing,
    getAccessToken,
    hasRetainedPublishingResourceRef: hasRetainedHostPublishingResourceRef,
    hostPublishingSessions,
    native,
    preparedMedia,
    publishingPreflightController,
    requestPreflightEndLiveSession:
      preflightLifecycle.requestPreflightEndLiveSession,
    retainedPublishingLiveSessionIdsRef: retainedHostPublishingLiveSessionIdsRef,
    retainedPublishingResourceRef: retainedHostPublishingResourceRef,
    setBackendMediaContractReady,
    setHostActionError,
    setIdlePublishingStatusUnlessErrored,
    setPublishingStatus,
    websocketUrl,
  });
  hasRetainedPublishingResourceCallbackRef.current =
    publishingController.hasRetainedPublishingResource;
  retainAttachedPublishingForLiveSessionCallbackRef.current =
    publishingController.retainAttachedPublishingForLiveSession;

  useEffect(() => {
    let isMounted = true;
    preflightLifecycle.mount();

    async function refreshNativeReadiness() {
      const permissions = await native.requestPermissions();
      const preview =
        permissions.camera === 'granted' && permissions.microphone === 'granted'
          ? await native.preparePreview()
          : { status: 'native_media_unavailable' as const };

      if (!isMounted) {
        return;
      }

      preflightLifecycle.sendWorkflowEvent({
        permission: 'camera',
        state: permissions.camera,
        type: 'PERMISSION_CHANGED',
      });
      preflightLifecycle.sendWorkflowEvent({
        permission: 'microphone',
        state: permissions.microphone,
        type: 'PERMISSION_CHANGED',
      });
      preflightLifecycle.sendWorkflowEvent({
        ready: preview.status !== 'native_media_unavailable',
        type: 'NATIVE_MEDIA_CHANGED',
      });
    }

    refreshNativeReadiness().catch(() => {
      if (!isMounted) {
        return;
      }

      preflightLifecycle.sendWorkflowEvent({
        ready: false,
        type: 'NATIVE_MEDIA_CHANGED',
      });
    });

    return () => {
      isMounted = false;
      preflightLifecycle.unmount();
    };
  }, [native, preflightLifecycle]);

  return {
    controlsCardProps: {
      canCreateSession,
      canGoLive,
      canPrepareMedia,
      canUseBackAction,
      errorMessage,
      hasBlockers,
      hasPreparedMedia,
      isGoingLive,
      isPreparingMedia,
      onBackPress: preflightLifecycle.handleBackPress,
      onCreateSessionPress: preflightLifecycle.handleCreateSessionPress,
      onGoLivePress: preflightLifecycle.handleGoLivePress,
      onPrepareMediaPress: preflightLifecycle.handlePrepareMediaPress,
      publishingStatus,
      sessionState,
    },
    readinessCardProps: {
      preflightState,
      publishingStatus,
      sessionState,
    },
  };
}

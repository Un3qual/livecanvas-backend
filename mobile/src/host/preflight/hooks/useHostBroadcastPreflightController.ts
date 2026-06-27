import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { UseMutationConfig } from 'react-relay';

import type { AuthState } from '../../../auth/types';
import { formatLiveMutationErrors } from '../../../live/liveSessionPresentation';
import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  hostBroadcastPreflightReducer,
  type HostBroadcastPreflightState,
} from '../../hostBroadcastPreflight';
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
  canRequestAbandonedHostPreflightCleanup,
  canRequestHostGoLive,
  canSubmitHostPreflightStartRequest,
  canUseHostPreflightBackAction,
  createHostBroadcastSessionState,
  hostBroadcastPreflightCleanupLiveSessionId,
  hostBroadcastSessionReducer,
  type HostBroadcastSessionAction,
  type HostBroadcastSessionState,
} from '../../hostBroadcastSession';
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

type HostBroadcastStateSetter<T> = (
  nextState: T | ((current: T) => T),
) => void;

export type HostBroadcastPreflightControllerLifecycleOptions = {
  readonly commitEndLiveSession: HostBroadcastEndLiveSessionCommit;
  readonly commitGoLive: HostBroadcastGoLiveCommit;
  readonly commitPrepareMedia: HostBroadcastPrepareMediaCommit;
  readonly commitStartLiveSession: HostBroadcastStartLiveSessionCommit;
  readonly dispatchSessionAction: (action: HostBroadcastSessionAction) => void;
  readonly disposeNative: () => void;
  readonly failPreparedPublishing: (reason: string) => void;
  readonly getCanCreateSession: () => boolean;
  readonly getCanGoLive: () => boolean;
  readonly getCanPrepareMedia: () => boolean;
  readonly getCanUseBackAction: () => boolean;
  readonly getSessionState: () => HostBroadcastSessionState;
  readonly hasRetainedPublishingResource: () => boolean;
  readonly navigateBack: () => void;
  readonly navigateToLiveSession: (liveSessionId: string) => void;
  readonly resetPreparedMedia: () => void;
  readonly retainAttachedPublishingForLiveSession: (
    liveSessionId: string,
  ) => HostBroadcastPublishingResource | null;
  readonly setHostActionError: (error: string | null) => void;
  readonly setIsGoingLive: HostBroadcastStateSetter<boolean>;
  readonly setIsPreparingMedia: HostBroadcastStateSetter<boolean>;
  readonly setPreparedMedia: HostBroadcastStateSetter<HostBroadcastMediaPreparation | null>;
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
  readonly unmount: () => void;
  readonly updateOptions: (
    options: HostBroadcastPreflightControllerLifecycleOptions,
  ) => void;
};

export function createHostBroadcastPreflightControllerLifecycle(
  initialOptions: HostBroadcastPreflightControllerLifecycleOptions,
): HostBroadcastPreflightControllerLifecycle {
  let options = initialOptions;
  let hasStartLiveSessionRequestInFlight = false;
  let hasEndLiveSessionRequestInFlight = false;
  let hasGoLiveRequestInFlight = false;
  let hasGoLiveSucceeded = false;
  let isMounted = true;

  function updateOptions(nextOptions: HostBroadcastPreflightControllerLifecycleOptions) {
    options = nextOptions;
  }

  function readPreflightCleanupState() {
    return {
      hasEndLiveSessionRequestInFlight,
      hasGoLiveRequestInFlight,
      hasGoLiveSucceeded,
    };
  }

  function requestPreflightEndLiveSession(
    liveSessionId: string,
    endOptions: PreflightEndLiveSessionOptions = {
      navigateBackOnSuccess: false,
    },
  ) {
    // Back cleanup reports failures to the mounted screen, while abandoned
    // cleanup only attempts non-blocking teardown after unmount.
    if (hasEndLiveSessionRequestInFlight) {
      return;
    }

    hasEndLiveSessionRequestInFlight = true;
    const updateSessionLifecycle =
      endOptions.navigateBackOnSuccess ||
      endOptions.updateSessionLifecycle === true;

    if (updateSessionLifecycle) {
      options.dispatchSessionAction({ type: 'end_requested' });
      if (endOptions.navigateBackOnSuccess) {
        options.setHostActionError(null);
      }
    }

    options.commitEndLiveSession({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        hasEndLiveSessionRequestInFlight = false;

        if (!updateSessionLifecycle) {
          return;
        }

        const result = payload.endLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          options.dispatchSessionAction({
            type: 'end_failed',
            viewerSafeErrorText,
          });
          options.setHostActionError(viewerSafeErrorText);
          return;
        }

        options.dispatchSessionAction({ type: 'end_succeeded' });
        if (endOptions.navigateBackOnSuccess) {
          options.navigateBack();
        }
      },
      onError: () => {
        hasEndLiveSessionRequestInFlight = false;

        if (!updateSessionLifecycle) {
          return;
        }

        const viewerSafeErrorText = formatLiveMutationErrors([]);
        options.dispatchSessionAction({
          type: 'end_failed',
          viewerSafeErrorText,
        });
        options.setHostActionError(viewerSafeErrorText);
      },
    });
  }

  function requestAbandonedPreflightEndLiveSession(liveSessionId: string) {
    // Abandoned preflight cleanup is best-effort and non-navigating; the
    // shared cleanup gate makes duplicate end/go-live races no-ops.
    if (!canRequestAbandonedHostPreflightCleanup(readPreflightCleanupState())) {
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: false,
    });
  }

  function handleCreateSessionPress() {
    if (
      !canSubmitHostPreflightStartRequest(options.getCanCreateSession(), {
        hasStartLiveSessionRequestInFlight,
      })
    ) {
      return;
    }

    hasStartLiveSessionRequestInFlight = true;
    options.dispatchSessionAction({ type: 'start_requested' });
    options.resetPreparedMedia();
    options.setHostActionError(null);

    options.commitStartLiveSession({
      variables: {
        input: {
          visibility: 'PUBLIC',
        },
      },
      onCompleted: (payload) => {
        const result = payload.startLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          hasStartLiveSessionRequestInFlight = false;

          if (!isMounted) {
            return;
          }

          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          options.dispatchSessionAction({
            type: 'start_failed',
            viewerSafeErrorText,
          });
          options.setHostActionError(viewerSafeErrorText);
          return;
        }

        hasStartLiveSessionRequestInFlight = false;

        if (!isMounted) {
          requestAbandonedPreflightEndLiveSession(result.liveSession.id);
          return;
        }

        options.dispatchSessionAction({
          liveSessionId: result.liveSession.id,
          type: 'start_succeeded',
        });
      },
      onError: () => {
        hasStartLiveSessionRequestInFlight = false;

        if (!isMounted) {
          return;
        }

        const viewerSafeErrorText = formatLiveMutationErrors([]);
        options.dispatchSessionAction({
          type: 'start_failed',
          viewerSafeErrorText,
        });
        options.setHostActionError(viewerSafeErrorText);
      },
    });
  }

  function handlePrepareMediaPress() {
    const liveSessionId = options.getSessionState().liveSessionId;

    if (!options.getCanPrepareMedia() || !liveSessionId) {
      return;
    }

    options.setIsPreparingMedia(true);
    options.setHostActionError(null);

    options.commitPrepareMedia({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        options.setIsPreparingMedia(false);

        const result = payload.prepareLiveMediaSession;
        const prepared = readPreparedHostBroadcastMedia(result);

        if (!prepared) {
          options.resetPreparedMedia();
          options.setHostActionError(formatLiveMutationErrors(result?.errors));
          return;
        }

        options.setPreparedMedia(prepared);
      },
      onError: () => {
        options.setIsPreparingMedia(false);
        options.resetPreparedMedia();
        options.setHostActionError(formatLiveMutationErrors([]));
      },
    });
  }

  function handleGoLivePress() {
    const liveSessionId = options.getSessionState().liveSessionId;

    if (!options.getCanGoLive() || !liveSessionId) {
      return;
    }

    options.setIsGoingLive(true);
    hasGoLiveRequestInFlight = true;
    options.setHostActionError(null);

    options.commitGoLive({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        hasGoLiveRequestInFlight = false;
        const result = payload.goLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!isMounted) {
            requestAbandonedPreflightEndLiveSession(liveSessionId);
            return;
          }

          options.setIsGoingLive(false);
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);

          if (isRetryableHostGoLiveMediaReadinessError(result?.errors)) {
            options.setHostActionError(viewerSafeErrorText);
            return;
          }

          options.resetPreparedMedia();
          options.setHostActionError(viewerSafeErrorText);
          return;
        }

        const retainedResource = options.retainAttachedPublishingForLiveSession(
          result.liveSession.id,
        );

        if (!retainedResource) {
          if (!isMounted) {
            requestAbandonedPreflightEndLiveSession(result.liveSession.id);
            return;
          }

          options.setIsGoingLive(false);
          options.failPreparedPublishing(HOST_PUBLISHING_ERROR);
          // Go-live already succeeded, so end the backend session if the host
          // cannot retain the publishing runtime needed to serve viewers.
          requestPreflightEndLiveSession(result.liveSession.id, {
            navigateBackOnSuccess: false,
            updateSessionLifecycle: true,
          });
          return;
        }

        hasGoLiveSucceeded = true;
        if (isMounted) {
          options.setIsGoingLive(false);
        }
        options.navigateToLiveSession(result.liveSession.id);
      },
      onError: () => {
        hasGoLiveRequestInFlight = false;

        if (!isMounted) {
          return;
        }

        options.setIsGoingLive(false);
        options.setHostActionError(formatLiveMutationErrors([]));
      },
    });
  }

  function handleBackPress() {
    if (!options.getCanUseBackAction()) {
      return;
    }

    if (
      hasEndLiveSessionRequestInFlight ||
      hasGoLiveRequestInFlight ||
      hasGoLiveSucceeded
    ) {
      return;
    }

    const liveSessionId = hostBroadcastPreflightCleanupLiveSessionId(
      options.getSessionState(),
      readPreflightCleanupState(),
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
  }

  function unmount() {
    isMounted = false;
    const liveSessionId = hostBroadcastPreflightCleanupLiveSessionId(
      options.getSessionState(),
      readPreflightCleanupState(),
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
  const [preflightState, dispatchPreflightAction] = useReducer(
    hostBroadcastPreflightReducer,
    createHostBroadcastPreflightState(),
  );
  const blockers = hostBroadcastPreflightBlockers(preflightState);
  const [sessionState, dispatchSessionAction] = useReducer(
    hostBroadcastSessionReducer,
    createHostBroadcastSessionState(),
  );
  const [preparedMedia, setPreparedMedia] =
    useState<HostBroadcastMediaPreparation | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [publishingStatus, setPublishingStatus] =
    useState<HostBroadcastPublishingStatus>('idle');
  const [hostActionError, setHostActionError] = useState<string | null>(null);
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
  const hasPreparedMedia = preparedMedia !== null;
  const canCreateSession =
    canCreateHostPreflightSession(preflightState) &&
    sessionState.status !== 'creating' &&
    sessionState.liveSessionId === null;
  const canPrepareMedia =
    sessionState.status === 'starting' &&
    sessionState.liveSessionId !== null &&
    !hasPreparedMedia &&
    !isPreparingMedia;
  const canGoLive =
    canGoLiveFromHostPreflight(preflightState) &&
    canRequestHostGoLive(sessionState, hasPreparedMedia) &&
    !isGoingLive;
  const canUseBackAction = canUseHostPreflightBackAction(
    sessionState,
    isGoingLive,
  );

  const resetPreparedMedia = useCallback(() => {
    setPreparedMedia(null);
    setPublishingStatus('idle');
    dispatchPreflightAction({
      ready: false,
      type: 'backend_media_contract_changed',
    });
  }, []);

  const failPreparedPublishing = useCallback(
    (reason: string) => {
      publishingPreflightController.cleanupAttachedResource();
      setPreparedMedia(null);
      setPublishingStatus('errored');
      dispatchPreflightAction({
        ready: false,
        type: 'backend_media_contract_changed',
      });
      setHostActionError(reason);
    },
    [publishingPreflightController],
  );

  const setBackendMediaContractReady = useCallback((ready: boolean) => {
    dispatchPreflightAction({
      ready,
      type: 'backend_media_contract_changed',
    });
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
      dispatchSessionAction,
      disposeNative: native.dispose,
      failPreparedPublishing,
      getCanCreateSession: () => canCreateSession,
      getCanGoLive: () => canGoLive,
      getCanPrepareMedia: () => canPrepareMedia,
      getCanUseBackAction: () => canUseBackAction,
      getSessionState: () => sessionState,
      hasRetainedPublishingResource: () =>
        hasRetainedPublishingResourceCallbackRef.current(),
      navigateBack,
      navigateToLiveSession,
      resetPreparedMedia,
      retainAttachedPublishingForLiveSession: (liveSessionId) =>
        retainAttachedPublishingForLiveSessionCallbackRef.current(liveSessionId),
      setHostActionError,
      setIsGoingLive,
      setIsPreparingMedia,
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

      dispatchPreflightAction({
        permission: 'camera',
        state: permissions.camera,
        type: 'permission_changed',
      });
      dispatchPreflightAction({
        permission: 'microphone',
        state: permissions.microphone,
        type: 'permission_changed',
      });
      dispatchPreflightAction({
        ready: preview.status !== 'native_media_unavailable',
        type: 'native_media_changed',
      });
    }

    refreshNativeReadiness().catch(() => {
      if (!isMounted) {
        return;
      }

      dispatchPreflightAction({
        ready: false,
        type: 'native_media_changed',
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
      errorMessage: hostActionError ?? sessionState.viewerSafeErrorText,
      hasBlockers: blockers.length > 0,
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

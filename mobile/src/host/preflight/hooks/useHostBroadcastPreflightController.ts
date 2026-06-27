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
import type { HostBroadcastPreflightScreenEndMutation } from '../../../__generated__/HostBroadcastPreflightScreenEndMutation.graphql';
import type { HostBroadcastPreflightScreenGoLiveMutation } from '../../../__generated__/HostBroadcastPreflightScreenGoLiveMutation.graphql';
import type { HostBroadcastPreflightScreenPrepareMediaMutation } from '../../../__generated__/HostBroadcastPreflightScreenPrepareMediaMutation.graphql';
import type { HostBroadcastPreflightScreenStartMutation } from '../../../__generated__/HostBroadcastPreflightScreenStartMutation.graphql';
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
  type HostBroadcastSessionState,
} from '../../hostBroadcastSession';
import type { HostBroadcastPublishingStatus } from '../hostBroadcastPreflightScreenTypes';
import { useHostBroadcastPublishingController } from './useHostBroadcastPublishingController';

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

export type HostBroadcastPreflightReadinessCardProps = {
  readonly preflightState: HostBroadcastPreflightState;
  readonly publishingStatus: HostBroadcastPublishingStatus;
  readonly sessionState: HostBroadcastSessionState;
};

export type HostBroadcastControlsCardProps = {
  readonly canCreateSession: boolean;
  readonly canGoLive: boolean;
  readonly canPrepareMedia: boolean;
  readonly canUseBackAction: boolean;
  readonly errorMessage: string | null;
  readonly hasBlockers: boolean;
  readonly hasPreparedMedia: boolean;
  readonly isGoingLive: boolean;
  readonly isPreparingMedia: boolean;
  readonly onBackPress: () => void;
  readonly onCreateSessionPress: () => void;
  readonly onGoLivePress: () => void;
  readonly onPrepareMediaPress: () => void;
  readonly publishingStatus: HostBroadcastPublishingStatus;
  readonly sessionState: HostBroadcastSessionState;
};

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
  const latestSessionStateRef = useRef(sessionState);
  const commitEndLiveSessionRef = useRef(commitEndLiveSession);
  const isPreflightScreenMountedRef = useRef(true);
  const hasStartLiveSessionRequestInFlightRef = useRef(false);
  const hasEndLiveSessionRequestInFlightRef = useRef(false);
  const hasGoLiveRequestInFlightRef = useRef(false);
  const hasGoLiveSucceededRef = useRef(false);
  const hasRetainedHostPublishingResourceRef = useRef(false);
  const retainedHostPublishingResourceRef =
    useRef<HostBroadcastPublishingResource | null>(null);
  const retainedHostPublishingLiveSessionIdsRef = useRef(
    new Map<HostBroadcastPublishingResource, string>(),
  );
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

  useEffect(() => {
    latestSessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    commitEndLiveSessionRef.current = commitEndLiveSession;
  }, [commitEndLiveSession]);

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

  const readPreflightCleanupState = useCallback(
    () => ({
      hasEndLiveSessionRequestInFlight:
        hasEndLiveSessionRequestInFlightRef.current,
      hasGoLiveRequestInFlight: hasGoLiveRequestInFlightRef.current,
      hasGoLiveSucceeded: hasGoLiveSucceededRef.current,
    }),
    [],
  );

  const requestPreflightEndLiveSession = useCallback(
    (
      liveSessionId: string,
      options: PreflightEndLiveSessionOptions = {
        navigateBackOnSuccess: false,
      },
    ) => {
      // Back cleanup reports failures to the mounted screen, while abandoned
      // cleanup only attempts non-blocking teardown after unmount.
      if (hasEndLiveSessionRequestInFlightRef.current) {
        return;
      }

      hasEndLiveSessionRequestInFlightRef.current = true;
      const updateSessionLifecycle =
        options.navigateBackOnSuccess || options.updateSessionLifecycle === true;

      if (updateSessionLifecycle) {
        dispatchSessionAction({ type: 'end_requested' });
        if (options.navigateBackOnSuccess) {
          setHostActionError(null);
        }
      }

      commitEndLiveSessionRef.current({
        variables: {
          input: {
            liveSessionId,
          },
        },
        onCompleted: (payload) => {
          hasEndLiveSessionRequestInFlightRef.current = false;

          if (!updateSessionLifecycle) {
            return;
          }

          const result = payload.endLiveSession;

          if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
            const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
            dispatchSessionAction({
              type: 'end_failed',
              viewerSafeErrorText,
            });
            setHostActionError(viewerSafeErrorText);
            return;
          }

          dispatchSessionAction({ type: 'end_succeeded' });
          if (options.navigateBackOnSuccess) {
            navigateBack();
          }
        },
        onError: () => {
          hasEndLiveSessionRequestInFlightRef.current = false;

          if (!updateSessionLifecycle) {
            return;
          }

          const viewerSafeErrorText = formatLiveMutationErrors([]);
          dispatchSessionAction({
            type: 'end_failed',
            viewerSafeErrorText,
          });
          setHostActionError(viewerSafeErrorText);
        },
      });
    },
    [navigateBack],
  );

  const requestAbandonedPreflightEndLiveSession = useCallback(
    (liveSessionId: string) => {
      // Abandoned preflight cleanup is best-effort and non-navigating; the
      // shared cleanup gate makes duplicate end/go-live races no-ops.
      if (
        !canRequestAbandonedHostPreflightCleanup(readPreflightCleanupState())
      ) {
        return;
      }

      requestPreflightEndLiveSession(liveSessionId, {
        navigateBackOnSuccess: false,
      });
    },
    [readPreflightCleanupState, requestPreflightEndLiveSession],
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

  const publishingController = useHostBroadcastPublishingController({
    authStatus,
    failPreparedPublishing,
    getAccessToken,
    hasRetainedPublishingResourceRef: hasRetainedHostPublishingResourceRef,
    hostPublishingSessions,
    native,
    preparedMedia,
    publishingPreflightController,
    requestPreflightEndLiveSession,
    retainedPublishingLiveSessionIdsRef: retainedHostPublishingLiveSessionIdsRef,
    retainedPublishingResourceRef: retainedHostPublishingResourceRef,
    setBackendMediaContractReady,
    setHostActionError,
    setIdlePublishingStatusUnlessErrored,
    setPublishingStatus,
    websocketUrl,
  });
  const hasRetainedPublishingResource =
    publishingController.hasRetainedPublishingResource;
  const retainAttachedPublishingForLiveSession =
    publishingController.retainAttachedPublishingForLiveSession;

  const handleCreateSessionPress = useCallback(() => {
    if (
      !canSubmitHostPreflightStartRequest(canCreateSession, {
        hasStartLiveSessionRequestInFlight:
          hasStartLiveSessionRequestInFlightRef.current,
      })
    ) {
      return;
    }

    hasStartLiveSessionRequestInFlightRef.current = true;
    dispatchSessionAction({ type: 'start_requested' });
    resetPreparedMedia();
    setHostActionError(null);

    commitStartLiveSession({
      variables: {
        input: {
          visibility: 'PUBLIC',
        },
      },
      onCompleted: (payload) => {
        const result = payload.startLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          hasStartLiveSessionRequestInFlightRef.current = false;

          if (!isPreflightScreenMountedRef.current) {
            return;
          }

          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          dispatchSessionAction({
            type: 'start_failed',
            viewerSafeErrorText,
          });
          setHostActionError(viewerSafeErrorText);
          return;
        }

        hasStartLiveSessionRequestInFlightRef.current = false;

        if (!isPreflightScreenMountedRef.current) {
          requestAbandonedPreflightEndLiveSession(result.liveSession.id);
          return;
        }

        dispatchSessionAction({
          liveSessionId: result.liveSession.id,
          type: 'start_succeeded',
        });
      },
      onError: () => {
        hasStartLiveSessionRequestInFlightRef.current = false;

        if (!isPreflightScreenMountedRef.current) {
          return;
        }

        const viewerSafeErrorText = formatLiveMutationErrors([]);
        dispatchSessionAction({
          type: 'start_failed',
          viewerSafeErrorText,
        });
        setHostActionError(viewerSafeErrorText);
      },
    });
  }, [
    canCreateSession,
    commitStartLiveSession,
    requestAbandonedPreflightEndLiveSession,
    resetPreparedMedia,
  ]);

  const handlePrepareMediaPress = useCallback(() => {
    const liveSessionId = sessionState.liveSessionId;

    if (!canPrepareMedia || !liveSessionId) {
      return;
    }

    setIsPreparingMedia(true);
    setHostActionError(null);

    commitPrepareMedia({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        setIsPreparingMedia(false);

        const result = payload.prepareLiveMediaSession;
        const prepared = readPreparedHostBroadcastMedia(result);

        if (!prepared) {
          resetPreparedMedia();
          setHostActionError(formatLiveMutationErrors(result?.errors));
          return;
        }

        setPreparedMedia(prepared);
      },
      onError: () => {
        setIsPreparingMedia(false);
        resetPreparedMedia();
        setHostActionError(formatLiveMutationErrors([]));
      },
    });
  }, [
    canPrepareMedia,
    commitPrepareMedia,
    resetPreparedMedia,
    sessionState.liveSessionId,
  ]);

  const handleGoLivePress = useCallback(() => {
    const liveSessionId = sessionState.liveSessionId;

    if (!canGoLive || !liveSessionId) {
      return;
    }

    setIsGoingLive(true);
    hasGoLiveRequestInFlightRef.current = true;
    setHostActionError(null);

    commitGoLive({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        hasGoLiveRequestInFlightRef.current = false;
        const result = payload.goLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!isPreflightScreenMountedRef.current) {
            requestAbandonedPreflightEndLiveSession(liveSessionId);
            return;
          }

          setIsGoingLive(false);
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);

          if (isRetryableHostGoLiveMediaReadinessError(result?.errors)) {
            setHostActionError(viewerSafeErrorText);
            return;
          }

          resetPreparedMedia();
          setHostActionError(viewerSafeErrorText);
          return;
        }

        const retainedResource = retainAttachedPublishingForLiveSession(
          result.liveSession.id,
        );

        if (!retainedResource) {
          if (!isPreflightScreenMountedRef.current) {
            requestAbandonedPreflightEndLiveSession(result.liveSession.id);
            return;
          }

          setIsGoingLive(false);
          failPreparedPublishing(HOST_PUBLISHING_ERROR);
          // Go-live already succeeded, so end the backend session if the host
          // cannot retain the publishing runtime needed to serve viewers.
          requestPreflightEndLiveSession(result.liveSession.id, {
            navigateBackOnSuccess: false,
            updateSessionLifecycle: true,
          });
          return;
        }

        hasGoLiveSucceededRef.current = true;
        if (isPreflightScreenMountedRef.current) {
          setIsGoingLive(false);
        }
        navigateToLiveSession(result.liveSession.id);
      },
      onError: () => {
        hasGoLiveRequestInFlightRef.current = false;

        if (!isPreflightScreenMountedRef.current) {
          return;
        }

        setIsGoingLive(false);
        setHostActionError(formatLiveMutationErrors([]));
      },
    });
  }, [
    canGoLive,
    commitGoLive,
    failPreparedPublishing,
    navigateToLiveSession,
    requestAbandonedPreflightEndLiveSession,
    requestPreflightEndLiveSession,
    resetPreparedMedia,
    retainAttachedPublishingForLiveSession,
    sessionState.liveSessionId,
  ]);

  const handleBackPress = useCallback(() => {
    if (!canUseBackAction) {
      return;
    }

    if (
      hasEndLiveSessionRequestInFlightRef.current ||
      hasGoLiveRequestInFlightRef.current ||
      hasGoLiveSucceededRef.current
    ) {
      return;
    }

    const liveSessionId = hostBroadcastPreflightCleanupLiveSessionId(
      sessionState,
      readPreflightCleanupState(),
    );

    if (!liveSessionId) {
      navigateBack();
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: true,
    });
  }, [
    canUseBackAction,
    navigateBack,
    readPreflightCleanupState,
    requestPreflightEndLiveSession,
    sessionState,
  ]);

  useEffect(() => {
    let isMounted = true;
    isPreflightScreenMountedRef.current = true;

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
      isPreflightScreenMountedRef.current = false;
      // Component unmount may race with start/go-live callbacks; only tear down
      // a created STARTING session when no transition already owns cleanup.
      const liveSessionId = hostBroadcastPreflightCleanupLiveSessionId(
        latestSessionStateRef.current,
        readPreflightCleanupState(),
      );

      if (liveSessionId) {
        requestAbandonedPreflightEndLiveSession(liveSessionId);
      }

      if (!hasRetainedPublishingResource()) {
        native.dispose();
      }
    };
  }, [native]);

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
      onBackPress: handleBackPress,
      onCreateSessionPress: handleCreateSessionPress,
      onGoLivePress: handleGoLivePress,
      onPrepareMediaPress: handlePrepareMediaPress,
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

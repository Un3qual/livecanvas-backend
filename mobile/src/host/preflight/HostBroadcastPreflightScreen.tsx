import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { graphql, useMutation } from 'react-relay';

import { useAuth } from '../../auth/AuthProvider';
import { AppHeader } from '../../components/AppHeader';
import { formatLiveMutationErrors } from '../../live/liveSessionPresentation';
import { liveSessionHref } from '../../live/liveSessionNavigation';
import { useAppTheme } from '../../providers/ThemeProvider';
import { useStartupState } from '../../providers/StartupGate';
import { createPhoenixSocket } from '../../realtime/phoenixSocket';
import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  hostBroadcastPreflightReducer,
} from '../hostBroadcastPreflight';
import {
  isRetryableHostGoLiveMediaReadinessError,
  readPreparedHostBroadcastMedia,
  type HostBroadcastMediaPreparation,
} from '../hostBroadcastMediaSignaling';
import { createHostBroadcastNative } from '../hostBroadcastNative';
import {
  createDefaultHostBroadcastPeerConnectionFactory,
  createHostBroadcastPublishingRuntime,
  type HostBroadcastPublishingRuntime,
} from '../hostBroadcastPublishingRuntime';
import { useHostBroadcastPublishingSessions } from '../HostBroadcastPublishingSessionProvider';
import {
  createHostBroadcastPublishingPreflightController,
  handleReleasedRetainedHostPublishingSessionTermination,
  releaseCurrentRetainedHostPublishingResource,
  shouldIgnoreRetainedHostPublishingChannelTermination,
  type HostBroadcastPublishingResource,
  type HostBroadcastPublishingPreflightController,
} from '../hostBroadcastPublishingSession';
import {
  canRequestAbandonedHostPreflightCleanup,
  canRequestHostGoLive,
  canSubmitHostPreflightStartRequest,
  canUseHostPreflightBackAction,
  createHostBroadcastSessionState,
  hostBroadcastPreflightCleanupLiveSessionId,
  hostBroadcastSessionReducer,
} from '../hostBroadcastSession';
import {
  HostControlsCard,
  PreflightReadinessCard,
} from './components/HostPreflightCards';
import { hostBroadcastPreflightScreenStyles as styles } from './hostBroadcastPreflightScreenStyles';
import type { HostBroadcastPublishingStatus } from './hostBroadcastPreflightScreenTypes';
import type { HostBroadcastPreflightScreenGoLiveMutation } from '../__generated__/HostBroadcastPreflightScreenGoLiveMutation.graphql';
import type { HostBroadcastPreflightScreenEndMutation } from '../__generated__/HostBroadcastPreflightScreenEndMutation.graphql';
import type { HostBroadcastPreflightScreenPrepareMediaMutation } from '../__generated__/HostBroadcastPreflightScreenPrepareMediaMutation.graphql';
import type { HostBroadcastPreflightScreenStartMutation } from '../__generated__/HostBroadcastPreflightScreenStartMutation.graphql';

const hostBroadcastPreflightScreenStartMutation = graphql`
  mutation HostBroadcastPreflightScreenStartMutation(
    $input: StartLiveSessionInput!
  ) {
    startLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;

const hostBroadcastPreflightScreenPrepareMediaMutation = graphql`
  mutation HostBroadcastPreflightScreenPrepareMediaMutation(
    $input: PrepareLiveMediaSessionInput!
  ) {
    prepareLiveMediaSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      signalingTopic
      iceServers {
        urls
        username
        credential
        credentialType
      }
      errors {
        field
        message
      }
    }
  }
`;

const hostBroadcastPreflightScreenGoLiveMutation = graphql`
  mutation HostBroadcastPreflightScreenGoLiveMutation(
    $input: GoLiveSessionInput!
  ) {
    goLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;

const hostBroadcastPreflightScreenEndMutation = graphql`
  mutation HostBroadcastPreflightScreenEndMutation(
    $input: EndLiveSessionInput!
  ) {
    endLiveSession(input: $input) {
      liveSession {
        id
        status
        channelTopic
      }
      errors {
        field
        message
      }
    }
  }
`;

const HOST_PUBLISHING_ERROR =
  'Could not start host media publishing. Please try again.';

type PreflightEndLiveSessionOptions = {
  readonly navigateBackOnSuccess: boolean;
  readonly updateSessionLifecycle?: boolean;
};

export function HostBroadcastPreflightScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const auth = useAuth();
  const { environment } = useStartupState();
  const native = useMemo(() => createHostBroadcastNative(), []);
  const hostPublishingSessions = useHostBroadcastPublishingSessions();
  const publishingPreflightController =
    useMemo<HostBroadcastPublishingPreflightController>(
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
  const [commitStartLiveSession] =
    useMutation<HostBroadcastPreflightScreenStartMutation>(
      hostBroadcastPreflightScreenStartMutation,
    );
  const [commitPrepareMedia] =
    useMutation<HostBroadcastPreflightScreenPrepareMediaMutation>(
      hostBroadcastPreflightScreenPrepareMediaMutation,
    );
  const [commitGoLive] =
    useMutation<HostBroadcastPreflightScreenGoLiveMutation>(
      hostBroadcastPreflightScreenGoLiveMutation,
    );
  const [commitEndLiveSession] =
    useMutation<HostBroadcastPreflightScreenEndMutation>(
      hostBroadcastPreflightScreenEndMutation,
    );
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

  function resetPreparedMedia() {
    setPreparedMedia(null);
    setPublishingStatus('idle');
    dispatchPreflightAction({
      ready: false,
      type: 'backend_media_contract_changed',
    });
  }

  function failPreparedPublishing(reason: string) {
    publishingPreflightController.cleanupAttachedResource();
    setPreparedMedia(null);
    setPublishingStatus('errored');
    dispatchPreflightAction({
      ready: false,
      type: 'backend_media_contract_changed',
    });
    setHostActionError(reason);
  }

  function readPreflightCleanupState() {
    return {
      hasEndLiveSessionRequestInFlight:
        hasEndLiveSessionRequestInFlightRef.current,
      hasGoLiveRequestInFlight: hasGoLiveRequestInFlightRef.current,
      hasGoLiveSucceeded: hasGoLiveSucceededRef.current,
    };
  }

  function requestAbandonedPreflightEndLiveSession(liveSessionId: string) {
    // Abandoned preflight cleanup is best-effort and non-navigating; the shared
    // cleanup gate makes duplicate end/go-live races no-ops.
    if (!canRequestAbandonedHostPreflightCleanup(readPreflightCleanupState())) {
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: false,
    });
  }

  function handleCreateSessionPress() {
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
  }

  function handlePrepareMediaPress() {
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
  }

  function handleGoLivePress() {
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

        const retainedResource =
          publishingPreflightController.retainForLiveSession(
            result.liveSession.id,
            hostPublishingSessions,
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
        hasRetainedHostPublishingResourceRef.current = true;
        retainedHostPublishingResourceRef.current = retainedResource;
        retainedHostPublishingLiveSessionIdsRef.current.set(
          retainedResource,
          result.liveSession.id,
        );
        if (isPreflightScreenMountedRef.current) {
          setIsGoingLive(false);
        }
        router.replace(liveSessionHref(result.liveSession.id));
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
  }

  function handleBackPress() {
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
      router.back();
      return;
    }

    requestPreflightEndLiveSession(liveSessionId, {
      navigateBackOnSuccess: true,
    });
  }

  function requestPreflightEndLiveSession(
    liveSessionId: string,
    options: PreflightEndLiveSessionOptions,
  ) {
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
          router.back();
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
  }

  useEffect(() => {
    let isMounted = true;

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

      if (!hasRetainedHostPublishingResourceRef.current) {
        native.dispose();
      }
    };
  }, [native]);

  useEffect(() => {
    if (!preparedMedia) {
      setPublishingStatus((status) => (status === 'errored' ? status : 'idle'));
      return undefined;
    }

    if (auth.state.status !== 'authenticated') {
      failPreparedPublishing(HOST_PUBLISHING_ERROR);
      return undefined;
    }

    const mediaPreparation = preparedMedia;
    let isActive = true;
    let runtime: HostBroadcastPublishingRuntime | null = null;
    let publishingResource: HostBroadcastPublishingResource | null = null;
    let didHandleChannelTermination = false;
    const socket = createPhoenixSocket({
      getAccessToken: auth.getAccessToken,
      websocketUrl: environment.websocketUrl,
    });
    const peerConnectionFactory =
      createDefaultHostBroadcastPeerConnectionFactory();

    dispatchPreflightAction({
      ready: false,
      type: 'backend_media_contract_changed',
    });
    setPublishingStatus('starting');
    setHostActionError(null);

    function releaseRetainedPublishingResource() {
      return releaseCurrentRetainedHostPublishingResource({
        clearCurrentResource: (resource) => {
          if (retainedHostPublishingResourceRef.current === resource) {
            retainedHostPublishingResourceRef.current = null;
            hasRetainedHostPublishingResourceRef.current = false;
          }
        },
        currentResource: publishingResource,
        liveSessionIdsByResource: retainedHostPublishingLiveSessionIdsRef.current,
        store: hostPublishingSessions,
      });
    }

    function currentRetainedPublishingLiveSessionId() {
      return publishingResource
        ? (retainedHostPublishingLiveSessionIdsRef.current.get(
            publishingResource,
          ) ?? null)
        : null;
    }

    async function startPublishingRuntime() {
      const localStream = await native.getPreviewStream();

      if (!isActive) {
        return;
      }

      if (!localStream || !peerConnectionFactory) {
        failPreparedPublishing(HOST_PUBLISHING_ERROR);
        return;
      }

      runtime = createHostBroadcastPublishingRuntime({
        disposeLocalMedia: native.releasePreviewStream,
        localStream,
        onChannelTerminated: (reason) => {
          if (didHandleChannelTermination) {
            return;
          }

          if (
            shouldIgnoreRetainedHostPublishingChannelTermination(
              reason,
              currentRetainedPublishingLiveSessionId(),
            )
          ) {
            return;
          }

          didHandleChannelTermination = true;

          if (
            handleReleasedRetainedHostPublishingSessionTermination(
              reason,
              releaseRetainedPublishingResource(),
              (retainedLiveSessionId) => {
                requestPreflightEndLiveSession(retainedLiveSessionId, {
                  navigateBackOnSuccess: false,
                });
              },
            )
          ) {
            return;
          }

          if (!isActive) {
            return;
          }

          failPreparedPublishing(HOST_PUBLISHING_ERROR);
        },
        onError: (reason) => {
          const retainedLiveSessionId = releaseRetainedPublishingResource();
          if (retainedLiveSessionId) {
            requestPreflightEndLiveSession(retainedLiveSessionId, {
              navigateBackOnSuccess: false,
            });
            return;
          }

          if (!isActive) {
            return;
          }

          failPreparedPublishing(reason);
        },
        onNegotiationReady: () => {
          if (!isActive) {
            return;
          }

          setPublishingStatus('ready');
          dispatchPreflightAction({
            ready: true,
            type: 'backend_media_contract_changed',
          });
          setHostActionError(null);
        },
        onNegotiationPending: () => {
          if (!isActive) {
            return;
          }

          setPublishingStatus('negotiating');
          dispatchPreflightAction({
            ready: false,
            type: 'backend_media_contract_changed',
          });
        },
        peerConnectionFactory,
        preparedMedia: mediaPreparation,
        socket,
      });
      publishingResource = {
        disconnectSocket: () => {
          socket.disconnect();
        },
        runtime,
      };
      publishingPreflightController.attachResource(publishingResource);
      socket.connect();

      const result = await runtime.start();

      if (!isActive) {
        return;
      }

      if (result.status === 'error') {
        failPreparedPublishing(result.reason);
        return;
      }

      setPublishingStatus(
        runtime.isNegotiationReady() ? 'ready' : 'negotiating',
      );
    }

    startPublishingRuntime().catch(() => {
      if (!isActive) {
        return;
      }

      failPreparedPublishing(HOST_PUBLISHING_ERROR);
    });

    return () => {
      isActive = false;
      publishingPreflightController.cleanupAttachedResource();
    };
  }, [
    auth.getAccessToken,
    auth.state.status,
    environment.websocketUrl,
    native,
    preparedMedia,
    publishingPreflightController,
  ]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <AppHeader
        eyebrow="Host"
        title="Host live session"
        subtitle="Check camera, microphone, and media readiness before going live."
      />

      <PreflightReadinessCard
        preflightState={preflightState}
        publishingStatus={publishingStatus}
        sessionState={sessionState}
      />

      <HostControlsCard
        canCreateSession={canCreateSession}
        canGoLive={canGoLive}
        canPrepareMedia={canPrepareMedia}
        canUseBackAction={canUseBackAction}
        errorMessage={hostActionError ?? sessionState.viewerSafeErrorText}
        hasBlockers={blockers.length > 0}
        hasPreparedMedia={preparedMedia !== null}
        isGoingLive={isGoingLive}
        isPreparingMedia={isPreparingMedia}
        onBackPress={handleBackPress}
        onCreateSessionPress={handleCreateSessionPress}
        onGoLivePress={handleGoLivePress}
        onPrepareMediaPress={handlePrepareMediaPress}
        publishingStatus={publishingStatus}
        sessionState={sessionState}
      />
    </ScrollView>
  );
}

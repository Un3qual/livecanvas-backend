import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useMutation } from 'react-relay';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { formatLiveMutationErrors } from '../live/liveSessionPresentation';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
import { useStartupState } from '../providers/StartupGate';
import { createPhoenixSocket } from '../realtime/phoenixSocket';
import { radius, spacing, typography } from '../theme/tokens';
import {
  canCreateHostPreflightSession,
  canGoLiveFromHostPreflight,
  createHostBroadcastPreflightState,
  hostBroadcastPreflightBlockers,
  hostBroadcastPreflightReducer,
  type HostBroadcastPermissionState,
} from './hostBroadcastPreflight';
import {
  isRetryableHostGoLiveMediaReadinessError,
  readPreparedHostBroadcastMedia,
  type HostBroadcastMediaPreparation,
} from './hostBroadcastMediaSignaling';
import { createHostBroadcastNative } from './hostBroadcastNative';
import {
  createDefaultHostBroadcastPeerConnectionFactory,
  createHostBroadcastPublishingRuntime,
  type HostBroadcastPublishingRuntime,
} from './hostBroadcastPublishingRuntime';
import { useHostBroadcastPublishingSessions } from './HostBroadcastPublishingSessionProvider';
import {
  createHostBroadcastPublishingPreflightController,
  releaseHostBroadcastPublishingRetainedResource,
  type HostBroadcastPublishingResource,
  type HostBroadcastPublishingPreflightController,
} from './hostBroadcastPublishingSession';
import {
  canRequestAbandonedHostPreflightCleanup,
  canRequestHostGoLive,
  canSubmitHostPreflightStartRequest,
  canUseHostPreflightBackAction,
  createHostBroadcastSessionState,
  hostBroadcastPreflightCleanupLiveSessionId,
  hostBroadcastSessionReducer,
} from './hostBroadcastSession';
import type { HostBroadcastPreflightScreenGoLiveMutation } from './__generated__/HostBroadcastPreflightScreenGoLiveMutation.graphql';
import type { HostBroadcastPreflightScreenEndMutation } from './__generated__/HostBroadcastPreflightScreenEndMutation.graphql';
import type { HostBroadcastPreflightScreenPrepareMediaMutation } from './__generated__/HostBroadcastPreflightScreenPrepareMediaMutation.graphql';
import type { HostBroadcastPreflightScreenStartMutation } from './__generated__/HostBroadcastPreflightScreenStartMutation.graphql';

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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  statusList: {
    gap: spacing.sm,
  },
  statusRow: {
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  statusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusLabel: {
    ...typography.label,
    flex: 1,
  },
  statusValue: typography.body,
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: typography.label,
  bodyText: typography.body,
  errorText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  controls: {
    gap: spacing.sm,
  },
});

type HostBroadcastPublishingStatus =
  | 'idle'
  | 'starting'
  | 'negotiating'
  | 'ready'
  | 'errored';

const HOST_PUBLISHING_ERROR =
  'Could not start host media publishing. Please try again.';

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
          setPublishingStatus('errored');
          dispatchPreflightAction({
            ready: false,
            type: 'backend_media_contract_changed',
          });
          setHostActionError(HOST_PUBLISHING_ERROR);
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
    options: { readonly navigateBackOnSuccess: boolean },
  ) {
    // Back cleanup reports failures to the mounted screen, while abandoned
    // cleanup only attempts non-blocking teardown after unmount.
    if (hasEndLiveSessionRequestInFlightRef.current) {
      return;
    }

    hasEndLiveSessionRequestInFlightRef.current = true;

    if (options.navigateBackOnSuccess) {
      dispatchSessionAction({ type: 'end_requested' });
      setHostActionError(null);
    }

    commitEndLiveSessionRef.current({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        if (!options.navigateBackOnSuccess) {
          return;
        }

        const result = payload.endLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          hasEndLiveSessionRequestInFlightRef.current = false;
          dispatchSessionAction({
            type: 'end_failed',
            viewerSafeErrorText,
          });
          setHostActionError(viewerSafeErrorText);
          return;
        }

        hasEndLiveSessionRequestInFlightRef.current = false;
        dispatchSessionAction({ type: 'end_succeeded' });
        router.back();
      },
      onError: () => {
        if (!options.navigateBackOnSuccess) {
          return;
        }

        const viewerSafeErrorText = formatLiveMutationErrors([]);
        hasEndLiveSessionRequestInFlightRef.current = false;
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
        disposeLocalMedia: native.dispose,
        localStream,
        onChannelTerminated: () => {
          if (didHandleChannelTermination) {
            return;
          }

          didHandleChannelTermination = true;

          const resource = publishingResource;
          const retainedLiveSessionId = resource
            ? retainedHostPublishingLiveSessionIdsRef.current.get(resource)
            : null;

          if (resource && retainedLiveSessionId) {
            retainedHostPublishingLiveSessionIdsRef.current.delete(resource);
            releaseHostBroadcastPublishingRetainedResource(
              retainedLiveSessionId,
              resource,
              hostPublishingSessions,
            );

            if (retainedHostPublishingResourceRef.current === resource) {
              retainedHostPublishingResourceRef.current = null;
              hasRetainedHostPublishingResourceRef.current = false;
            }
            return;
          }

          if (!isActive) {
            return;
          }

          failPreparedPublishing(HOST_PUBLISHING_ERROR);
        },
        onError: (reason) => {
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

      <AppCard>
        <SectionHeading title="Preflight readiness" />
        <View style={styles.statusList}>
          <StatusRow
            detail="Camera access"
            label="Camera"
            state={permissionStatus(preflightState.cameraPermission)}
          />
          <StatusRow
            detail="Microphone access"
            label="Microphone"
            state={permissionStatus(preflightState.microphonePermission)}
          />
          <StatusRow
            detail="Native preview"
            label="Native media"
            state={
              preflightState.nativeMediaReady
                ? readyStatus()
                : pendingStatus('Unavailable')
            }
          />
          <StatusRow
            detail="Host offer and viewer answer"
            label="Media signaling"
            state={
              preflightState.backendMediaContractReady
                ? readyStatus()
                : publishingStatus === 'errored'
                  ? { label: 'Blocked', tone: 'blocked' }
                  : pendingStatus(publishingStatusLabel(publishingStatus))
            }
          />
          <StatusRow
            detail={
              sessionState.liveSessionId
                ? 'Host session created'
                : 'No host session'
            }
            label="Live session"
            state={
              sessionState.liveSessionId
                ? readyStatus()
                : sessionState.status === 'creating'
                  ? pendingStatus('Creating')
                  : pendingStatus('Pending')
            }
          />
        </View>
      </AppCard>

      <AppCard>
        <SectionHeading title="Host controls" />
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {blockers.length > 0
            ? 'Host broadcast is waiting on preflight readiness.'
            : 'Host broadcast preflight is ready.'}
        </Text>
        {preparedMedia ? (
          <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
            {publishingStatus === 'ready'
              ? 'Host publishing negotiation is ready.'
              : 'Host publishing is waiting for viewer negotiation.'}
          </Text>
        ) : null}
        {hostActionError || sessionState.viewerSafeErrorText ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {hostActionError ?? sessionState.viewerSafeErrorText}
          </Text>
        ) : null}
        <View style={styles.controls}>
          <AppButton
            disabled={!canCreateSession}
            label={
              sessionState.status === 'creating'
                ? 'Creating session...'
                : 'Create host session'
            }
            onPress={handleCreateSessionPress}
          />
          <AppButton
            disabled={!canPrepareMedia}
            label={isPreparingMedia ? 'Preparing media...' : 'Prepare media'}
            onPress={handlePrepareMediaPress}
            variant="secondary"
          />
          <AppButton
            disabled={!canGoLive}
            label={isGoingLive ? 'Going live...' : 'Go live'}
            onPress={handleGoLivePress}
          />
          <AppButton
            disabled={!canUseBackAction}
            label="Go back"
            onPress={handleBackPress}
            variant="secondary"
          />
        </View>
      </AppCard>
    </ScrollView>
  );
}

type StatusState = {
  readonly label: string;
  readonly tone: 'ready' | 'pending' | 'blocked';
};

function permissionStatus(
  permission: HostBroadcastPermissionState,
): StatusState {
  switch (permission) {
    case 'granted':
      return readyStatus();
    case 'denied':
      return { label: 'Denied', tone: 'blocked' };
    case 'blocked':
      return { label: 'Blocked', tone: 'blocked' };
    case 'unknown':
      return pendingStatus('Unknown');
    default:
      return pendingStatus('Unknown');
  }
}

function readyStatus(): StatusState {
  return { label: 'Ready', tone: 'ready' };
}

function pendingStatus(label: string): StatusState {
  return { label, tone: 'pending' };
}

function publishingStatusLabel(status: HostBroadcastPublishingStatus): string {
  switch (status) {
    case 'starting':
      return 'Starting';
    case 'negotiating':
      return 'Negotiating';
    case 'ready':
      return 'Ready';
    case 'errored':
      return 'Blocked';
    case 'idle':
    default:
      return 'Pending';
  }
}

function SectionHeading({ title }: { title: string }) {
  const theme = useAppTheme();

  return (
    <Text style={[styles.statusLabel, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
}

function StatusRow({
  detail,
  label,
  state,
}: {
  detail: string;
  label: string;
  state: StatusState;
}) {
  const theme = useAppTheme();
  const badgeColors =
    state.tone === 'ready'
      ? {
          background: theme.colors.surfaceMuted,
          text: theme.colors.accent,
        }
      : state.tone === 'blocked'
        ? {
            background: theme.colors.errorMuted,
            text: theme.colors.error,
          }
        : {
            background: theme.colors.surfaceMuted,
            text: theme.colors.textMuted,
          };

  return (
    <View style={[styles.statusRow, { borderColor: theme.colors.border }]}>
      <View style={styles.statusHeader}>
        <Text style={[styles.statusLabel, { color: theme.colors.text }]}>
          {label}
        </Text>
        <View
          style={[styles.badge, { backgroundColor: badgeColors.background }]}
        >
          <Text style={[styles.badgeText, { color: badgeColors.text }]}>
            {state.label}
          </Text>
        </View>
      </View>
      <Text style={[styles.statusValue, { color: theme.colors.textMuted }]}>
        {detail}
      </Text>
    </View>
  );
}

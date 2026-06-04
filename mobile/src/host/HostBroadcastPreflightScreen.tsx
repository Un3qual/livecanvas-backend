import { useEffect, useMemo, useReducer, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { graphql, useMutation } from 'react-relay';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { formatLiveMutationErrors } from '../live/liveSessionPresentation';
import { liveSessionHref } from '../live/liveSessionNavigation';
import { useAppTheme } from '../providers/ThemeProvider';
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
  canRequestHostGoLive,
  createHostBroadcastSessionState,
  hostBroadcastSessionReducer,
} from './hostBroadcastSession';
import type { HostBroadcastPreflightScreenGoLiveMutation } from './__generated__/HostBroadcastPreflightScreenGoLiveMutation.graphql';
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

export function HostBroadcastPreflightScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const native = useMemo(() => createHostBroadcastNative(), []);
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

  function resetPreparedMedia() {
    setPreparedMedia(null);
    dispatchPreflightAction({
      ready: false,
      type: 'backend_media_contract_changed',
    });
  }

  function handleCreateSessionPress() {
    if (!canCreateSession) {
      return;
    }

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
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);
          dispatchSessionAction({
            type: 'start_failed',
            viewerSafeErrorText,
          });
          setHostActionError(viewerSafeErrorText);
          return;
        }

        dispatchSessionAction({
          liveSessionId: result.liveSession.id,
          type: 'start_succeeded',
        });
      },
      onError: () => {
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
    setHostActionError(null);

    commitGoLive({
      variables: {
        input: {
          liveSessionId,
        },
      },
      onCompleted: (payload) => {
        setIsGoingLive(false);
        const result = payload.goLiveSession;

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          const viewerSafeErrorText = formatLiveMutationErrors(result?.errors);

          if (isRetryableHostGoLiveMediaReadinessError(result?.errors)) {
            setHostActionError(viewerSafeErrorText);
            return;
          }

          resetPreparedMedia();
          setHostActionError(viewerSafeErrorText);
          return;
        }

        router.replace(liveSessionHref(result.liveSession.id));
      },
      onError: () => {
        setIsGoingLive(false);
        setHostActionError(formatLiveMutationErrors([]));
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
      native.dispose();
    };
  }, [native]);

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
            detail="Backend negotiation"
            label="Media signaling"
            state={
              preflightState.backendMediaContractReady
                ? readyStatus()
                : pendingStatus('Pending')
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
            Media signaling is prepared with {preparedMedia.iceServers.length}{' '}
            ICE server{preparedMedia.iceServers.length === 1 ? '' : 's'}.
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
            label="Go back"
            onPress={() => router.back()}
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

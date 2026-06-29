import { Text, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';
import { useAppTheme } from '../../../providers/ThemeProvider';
import type {
  HostBroadcastPermissionState,
  HostBroadcastPreflightState,
} from '../../hostBroadcastPreflight';
import type { HostBroadcastSessionState } from '../../hostBroadcastSession';
import type { HostBroadcastPublishingStatus } from '../hooks/useHostBroadcastPublishingController';
import { hostBroadcastPreflightScreenStyles as styles } from '../hostBroadcastPreflightScreenStyles';

type StatusState = {
  readonly label: string;
  readonly tone: 'ready' | 'pending' | 'blocked';
};

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

export function PreflightReadinessCard({
  preflightState,
  publishingStatus,
  sessionState,
}: HostBroadcastPreflightReadinessCardProps) {
  return (
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
  );
}

export function HostControlsCard({
  canCreateSession,
  canGoLive,
  canPrepareMedia,
  canUseBackAction,
  errorMessage,
  hasBlockers,
  hasPreparedMedia,
  isGoingLive,
  isPreparingMedia,
  onBackPress,
  onCreateSessionPress,
  onGoLivePress,
  onPrepareMediaPress,
  publishingStatus,
  sessionState,
}: HostBroadcastControlsCardProps) {
  const theme = useAppTheme();

  return (
    <AppCard>
      <SectionHeading title="Host controls" />
      <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
        {hasBlockers
          ? 'Host broadcast is waiting on preflight readiness.'
          : 'Host broadcast preflight is ready.'}
      </Text>
      {hasPreparedMedia ? (
        <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
          {publishingStatus === 'ready'
            ? 'Host publishing negotiation is ready.'
            : 'Host publishing is waiting for viewer negotiation.'}
        </Text>
      ) : null}
      {errorMessage ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {errorMessage}
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
          onPress={onCreateSessionPress}
        />
        <AppButton
          disabled={!canPrepareMedia}
          label={isPreparingMedia ? 'Preparing media...' : 'Prepare media'}
          onPress={onPrepareMediaPress}
          variant="secondary"
        />
        <AppButton
          disabled={!canGoLive}
          label={isGoingLive ? 'Going live...' : 'Go live'}
          onPress={onGoLivePress}
        />
        <AppButton
          disabled={!canUseBackAction}
          label="Go back"
          onPress={onBackPress}
          variant="secondary"
        />
      </View>
    </AppCard>
  );
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

function publishingStatusLabel(
  status: HostBroadcastPublishingStatus,
): string {
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

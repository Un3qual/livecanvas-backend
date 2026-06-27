import type {
  HostBroadcastPermissionState,
  HostBroadcastPreflightState,
} from '../hostBroadcastPreflight';
import type { HostBroadcastSessionState } from '../hostBroadcastSession';

export type HostBroadcastPublishingStatus =
  | 'idle'
  | 'starting'
  | 'negotiating'
  | 'ready'
  | 'errored';

export type StatusState = {
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

export function permissionStatus(
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

export function readyStatus(): StatusState {
  return { label: 'Ready', tone: 'ready' };
}

export function pendingStatus(label: string): StatusState {
  return { label, tone: 'pending' };
}

export function publishingStatusLabel(
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

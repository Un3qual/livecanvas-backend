import type { HostBroadcastPermissionState } from '../hostBroadcastPreflight';

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


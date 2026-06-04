export type HostBroadcastPermissionState =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'blocked';

export type HostBroadcastPermissionSnapshot = Readonly<{
  camera: HostBroadcastPermissionState;
  microphone: HostBroadcastPermissionState;
}>;

export type HostBroadcastPreviewResult = Readonly<{
  status: 'native_media_unavailable';
}>;

export type HostBroadcastNative = Readonly<{
  requestPermissions: () => Promise<HostBroadcastPermissionSnapshot>;
  preparePreview: () => Promise<HostBroadcastPreviewResult>;
  dispose: () => void;
}>;

export function normalizeHostBroadcastPermission(
  value: unknown,
): HostBroadcastPermissionState {
  if (value === true) {
    return 'granted';
  }

  if (value === false) {
    return 'denied';
  }

  switch (value) {
    case 'unknown':
    case 'granted':
    case 'denied':
    case 'blocked':
      return value;
    default:
      return 'unknown';
  }
}

export function createUnavailableHostBroadcastNative(): HostBroadcastNative {
  return {
    async requestPermissions() {
      return {
        camera: 'unknown',
        microphone: 'unknown',
      };
    },
    async preparePreview() {
      return {
        status: 'native_media_unavailable',
      };
    },
    dispose() {},
  };
}

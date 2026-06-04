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
  status: 'native_media_ready' | 'native_media_unavailable';
}>;

export type HostBroadcastNative = Readonly<{
  requestPermissions: () => Promise<HostBroadcastPermissionSnapshot>;
  preparePreview: () => Promise<HostBroadcastPreviewResult>;
  dispose: () => void;
}>;

type HostBroadcastMediaTrack = Readonly<{
  stop?: () => void;
}>;

type HostBroadcastMediaStream = Readonly<{
  getTracks?: () => ReadonlyArray<HostBroadcastMediaTrack>;
}>;

type HostBroadcastMediaDevices = Readonly<{
  getUserMedia?: (constraints: {
    audio: boolean;
    video: boolean;
  }) => Promise<HostBroadcastMediaStream>;
}>;

type HostBroadcastNativeOptions = Readonly<{
  mediaDevices?: HostBroadcastMediaDevices | null;
}>;

type ReactNativeWebRtcModule = Readonly<{
  mediaDevices?: HostBroadcastMediaDevices | null;
}>;

declare const require:
  | undefined
  | ((moduleName: 'react-native-webrtc') => ReactNativeWebRtcModule);

export function normalizeHostBroadcastPermission(
  value?: unknown,
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

export function createHostBroadcastNative(
  options: HostBroadcastNativeOptions = {},
): HostBroadcastNative {
  const mediaDevices = options.mediaDevices ?? loadDefaultMediaDevices();

  if (!mediaDevices?.getUserMedia) {
    return createUnavailableHostBroadcastNative();
  }

  const getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
  let previewStream: HostBroadcastMediaStream | null = null;

  async function requestPreviewStream() {
    const stream = await getUserMedia({
      audio: true,
      video: true,
    });

    if (!stream) {
      throw new Error('native_media_unavailable');
    }

    return stream;
  }

  function replacePreviewStream(stream: HostBroadcastMediaStream) {
    stopPreviewStream(previewStream);
    previewStream = stream;
  }

  return {
    async requestPermissions() {
      try {
        replacePreviewStream(await requestPreviewStream());

        return {
          camera: 'granted',
          microphone: 'granted',
        };
      } catch {
        return {
          camera: 'denied',
          microphone: 'denied',
        };
      }
    },
    async preparePreview() {
      try {
        if (!previewStream) {
          replacePreviewStream(await requestPreviewStream());
        }

        return {
          status: 'native_media_ready',
        };
      } catch {
        stopPreviewStream(previewStream);
        previewStream = null;

        return {
          status: 'native_media_unavailable',
        };
      }
    },
    dispose() {
      stopPreviewStream(previewStream);
      previewStream = null;
    },
  };
}

export function createUnavailableHostBroadcastNative(): HostBroadcastNative {
  // Deliberate native-less fallback: permissions stay unknown and preview
  // reports unavailable so callers can branch on unsupported environments.
  return {
    requestPermissions() {
      return Promise.resolve({
        camera: 'unknown',
        microphone: 'unknown',
      });
    },
    preparePreview() {
      return Promise.resolve({
        status: 'native_media_unavailable',
      });
    },
    dispose() {
      // No native resources exist in the unsupported fallback.
    },
  };
}

function stopPreviewStream(stream: HostBroadcastMediaStream | null) {
  for (const track of stream?.getTracks?.() ?? []) {
    track.stop?.();
  }
}

function loadDefaultMediaDevices(): HostBroadcastMediaDevices | null {
  if (typeof require === 'undefined') {
    return null;
  }

  try {
    return require('react-native-webrtc').mediaDevices ?? null;
  } catch {
    return null;
  }
}

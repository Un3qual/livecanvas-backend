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
  getPreviewStream: () => Promise<HostBroadcastMediaStream | null>;
  releasePreviewStream: () => void;
  dispose: () => void;
}>;

export type HostBroadcastMediaTrack = Readonly<{
  stop?: () => void;
}>;

export type HostBroadcastMediaStream = Readonly<{
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
  let previewStreamRequest: Promise<HostBroadcastMediaStream> | null = null;
  let disposed = false;

  async function ensurePreviewStream() {
    // Keep one getUserMedia request shared across concurrent preflight calls;
    // if disposal wins that race, stop the late stream instead of caching it.
    if (disposed) {
      throw new Error('native_media_disposed');
    }

    if (previewStream) {
      return previewStream;
    }

    if (!previewStreamRequest) {
      previewStreamRequest = getUserMedia({
        audio: true,
        video: true,
      })
        .then((stream) => {
          if (!stream) {
            throw new Error('native_media_unavailable');
          }

          if (disposed) {
            stopPreviewStream(stream);
            throw new Error('native_media_disposed');
          }

          previewStream = stream;
          return stream;
        })
        .finally(() => {
          previewStreamRequest = null;
        });
    }

    return previewStreamRequest;
  }

  return {
    async requestPermissions() {
      try {
        await ensurePreviewStream();

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
        await ensurePreviewStream();

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
    async getPreviewStream() {
      try {
        return await ensurePreviewStream();
      } catch {
        return null;
      }
    },
    releasePreviewStream() {
      stopPreviewStream(previewStream);
      previewStream = null;
    },
    dispose() {
      disposed = true;
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
    getPreviewStream() {
      return Promise.resolve(null);
    },
    releasePreviewStream() {
      // No native resources exist in the unsupported fallback.
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

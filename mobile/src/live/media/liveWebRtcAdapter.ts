import type { ComponentType } from 'react';

export type LiveWebRtcMediaConstraints = Readonly<{
  audio: boolean;
  video: boolean;
}>;

export type LiveWebRtcMediaDevices<MediaStream> = Readonly<{
  getUserMedia?: (
    constraints: LiveWebRtcMediaConstraints,
  ) => Promise<MediaStream>;
}>;

export type LiveWebRtcPeerConnectionFactory<
  PeerConnectionConfig,
  PeerConnection,
> = (config: PeerConnectionConfig) => PeerConnection;

export type LiveWebRtcRTCViewProps = {
  readonly objectFit?: 'contain' | 'cover';
  readonly streamURL: string;
  readonly style?: unknown;
};

export type LiveWebRtcNativeModule<
  PeerConnectionConfig,
  PeerConnection,
  MediaDevices,
> = Readonly<{
  RTCView?: ComponentType<LiveWebRtcRTCViewProps>;
  RTCPeerConnection?: new (
    config: PeerConnectionConfig,
  ) => PeerConnection;
  mediaDevices?: MediaDevices | null;
}>;

declare const require:
  | undefined
  | (<PeerConnectionConfig, PeerConnection, MediaDevices>(
      moduleName: 'react-native-webrtc',
    ) => LiveWebRtcNativeModule<
      PeerConnectionConfig,
      PeerConnection,
      MediaDevices
    >);

export function createLiveWebRtcPeerConnectionFactory<
  PeerConnectionConfig,
  PeerConnection,
>(
  nativeModule:
    | LiveWebRtcNativeModule<
        PeerConnectionConfig,
        PeerConnection,
        unknown
      >
    | null
    | undefined,
):
  | LiveWebRtcPeerConnectionFactory<PeerConnectionConfig, PeerConnection>
  | null {
  const PeerConnection = nativeModule?.RTCPeerConnection;

  return PeerConnection
    ? (config) => new PeerConnection(config)
    : null;
}

export function readLiveWebRtcMediaDevices<MediaDevices>(
  nativeModule:
    | LiveWebRtcNativeModule<unknown, unknown, MediaDevices>
    | null
    | undefined,
): MediaDevices | null {
  return nativeModule?.mediaDevices ?? null;
}

export function createDefaultLiveWebRtcPeerConnectionFactory<
  PeerConnectionConfig,
  PeerConnection,
>():
  | LiveWebRtcPeerConnectionFactory<PeerConnectionConfig, PeerConnection>
  | null {
  return createLiveWebRtcPeerConnectionFactory(
    loadReactNativeWebRtcModule<
      PeerConnectionConfig,
      PeerConnection,
      unknown
    >(),
  );
}

export function loadDefaultLiveWebRtcMediaDevices<MediaDevices>():
  | MediaDevices
  | null {
  return readLiveWebRtcMediaDevices(
    loadReactNativeWebRtcModule<unknown, unknown, MediaDevices>(),
  );
}

export const LiveWebRtcRTCView =
  loadReactNativeWebRtcModule<unknown, unknown, unknown>()?.RTCView ?? null;

function loadReactNativeWebRtcModule<
  PeerConnectionConfig,
  PeerConnection,
  MediaDevices,
>():
  | LiveWebRtcNativeModule<
      PeerConnectionConfig,
      PeerConnection,
      MediaDevices
    >
  | null {
  if (typeof require === 'undefined') {
    return null;
  }

  try {
    return require<
      PeerConnectionConfig,
      PeerConnection,
      MediaDevices
    >('react-native-webrtc');
  } catch {
    return null;
  }
}

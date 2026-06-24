import type {
  LiveSessionChannel,
  LiveSessionChannelSocket,
} from '../live/liveSessionChannelClient';
import { normalizeLiveSessionRealtimeEvent } from '../live/liveSessionRealtimeEvents';
import {
  createHostBroadcastMediaIceCandidatePayload,
  createHostBroadcastMediaOfferPayload,
  type HostBroadcastMediaIceServer,
  type HostBroadcastMediaPreparation,
} from './hostBroadcastMediaSignaling';

export type HostBroadcastPublishingSessionDescription = {
  readonly sdp: string;
  readonly type: 'offer' | 'answer';
};

export type HostBroadcastPublishingIceCandidate = {
  readonly candidate: string;
  readonly sdpMLineIndex?: number | null;
  readonly sdpMid?: string | null;
  readonly toJSON?: () => unknown;
  readonly usernameFragment?: string | null;
};

export type HostBroadcastPublishingPeerConnectionIceServer = {
  readonly credential?: string;
  readonly credentialType?: 'OAUTH' | 'PASSWORD';
  readonly username?: string;
  readonly urls: ReadonlyArray<string>;
};

export type HostBroadcastPublishingPeerConnectionConfig = {
  readonly iceServers: ReadonlyArray<HostBroadcastPublishingPeerConnectionIceServer>;
};

export type HostBroadcastPublishingPeerConnection = {
  onicecandidate:
    | ((
        event: Readonly<{
          candidate?: HostBroadcastPublishingIceCandidate | null;
        }>,
      ) => void)
    | null;
  readonly addIceCandidate: (
    candidate: HostBroadcastPublishingIceCandidate,
  ) => Promise<void>;
  readonly addTrack: (track: unknown, stream: unknown) => unknown;
  readonly close: () => void;
  readonly createOffer: () => Promise<HostBroadcastPublishingSessionDescription>;
  readonly setLocalDescription: (
    description: HostBroadcastPublishingSessionDescription,
  ) => Promise<void>;
  readonly setRemoteDescription: (
    description: HostBroadcastPublishingSessionDescription,
  ) => Promise<void>;
};

export type HostBroadcastPublishingPeerConnectionFactory = (
  config: HostBroadcastPublishingPeerConnectionConfig,
) => HostBroadcastPublishingPeerConnection;

export type HostBroadcastPublishingMediaStream = {
  readonly getTracks?: () => ReadonlyArray<unknown>;
};

export type HostBroadcastPublishingRuntimeStartResult =
  | { readonly status: 'started' }
  | { readonly reason: string; readonly status: 'error' };

export type HostBroadcastPublishingRuntime = {
  readonly dispose: () => void;
  readonly isNegotiationReady: () => boolean;
  readonly start: () => Promise<HostBroadcastPublishingRuntimeStartResult>;
};

export type HostBroadcastPublishingRuntimeOptions = {
  readonly disposeLocalMedia?: () => void;
  readonly localStream: HostBroadcastPublishingMediaStream;
  readonly onError?: (reason: string) => void;
  readonly onNegotiationReady?: () => void;
  readonly peerConnectionFactory: HostBroadcastPublishingPeerConnectionFactory;
  readonly preparedMedia: HostBroadcastMediaPreparation;
  readonly socket: LiveSessionChannelSocket;
};

type ReactNativeWebRtcModule = Readonly<{
  RTCPeerConnection?: new (
    config: HostBroadcastPublishingPeerConnectionConfig,
  ) => HostBroadcastPublishingPeerConnection;
}>;

declare const require:
  | undefined
  | ((moduleName: 'react-native-webrtc') => ReactNativeWebRtcModule);

const GENERIC_START_FAILURE_REASON =
  'Could not start host media publishing. Please try again.';

export function createHostBroadcastPublishingRuntime({
  disposeLocalMedia,
  localStream,
  onError,
  onNegotiationReady,
  peerConnectionFactory,
  preparedMedia,
  socket,
}: HostBroadcastPublishingRuntimeOptions): HostBroadcastPublishingRuntime {
  const channel = socket.channel(preparedMedia.signalingTopic);
  let disposed = false;
  let localMediaDisposed = false;
  let negotiationReady = false;
  let peerConnection: HostBroadcastPublishingPeerConnection | null = null;
  let started = false;

  channel.on('media:answer', (payload) => {
    void applyViewerAnswer(payload);
  });
  channel.on('media:ice_candidate', (payload) => {
    void applyViewerIceCandidate(payload);
  });

  async function start(): Promise<HostBroadcastPublishingRuntimeStartResult> {
    if (disposed) {
      return {
        reason: GENERIC_START_FAILURE_REASON,
        status: 'error',
      };
    }

    if (started) {
      return { status: 'started' };
    }

    started = true;

    try {
      peerConnection = peerConnectionFactory({
        iceServers: preparedMedia.iceServers.map(toPeerConnectionIceServer),
      });
      peerConnection.onicecandidate = (event) => {
        pushLocalIceCandidate(event.candidate ?? null);
      };

      const tracks = localStream.getTracks?.() ?? [];

      if (tracks.length === 0) {
        throw new Error('missing_local_media_tracks');
      }

      for (const track of tracks) {
        peerConnection.addTrack(track, localStream);
      }

      const joinResult = await joinMediaSignalingChannel(channel);

      if (joinResult.status === 'error') {
        throw new Error(joinResult.reason);
      }

      const offer = await peerConnection.createOffer();
      const offerPayload = createHostBroadcastMediaOfferPayload(offer);

      if (!offerPayload) {
        throw new Error('invalid_host_media_offer');
      }

      await peerConnection.setLocalDescription(offerPayload);
      channel.push('media:offer', offerPayload);

      return { status: 'started' };
    } catch {
      const reason = GENERIC_START_FAILURE_REASON;
      onError?.(reason);
      dispose();
      return {
        reason,
        status: 'error',
      };
    }
  }

  function pushLocalIceCandidate(
    candidate: HostBroadcastPublishingIceCandidate | null,
  ) {
    if (disposed || !candidate) {
      return;
    }

    const payload = createHostBroadcastMediaIceCandidatePayload(candidate);

    if (!payload) {
      return;
    }

    channel.push('media:ice_candidate', payload);
  }

  async function applyViewerAnswer(payload: unknown) {
    if (disposed || !peerConnection) {
      return;
    }

    const event = normalizeLiveSessionRealtimeEvent('media:answer', payload);

    if (event?.kind !== 'media_answer' || event.senderRole !== 'viewer') {
      return;
    }

    try {
      await peerConnection.setRemoteDescription(event.description);
      markNegotiationReady();
    } catch {
      onError?.(GENERIC_START_FAILURE_REASON);
    }
  }

  async function applyViewerIceCandidate(payload: unknown) {
    if (disposed || !peerConnection) {
      return;
    }

    const event = normalizeLiveSessionRealtimeEvent(
      'media:ice_candidate',
      payload,
    );

    if (
      event?.kind !== 'media_ice_candidate' ||
      event.senderRole !== 'viewer'
    ) {
      return;
    }

    try {
      await peerConnection.addIceCandidate(event.candidate);
    } catch {
      onError?.(GENERIC_START_FAILURE_REASON);
    }
  }

  function markNegotiationReady() {
    if (negotiationReady) {
      return;
    }

    negotiationReady = true;
    onNegotiationReady?.();
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    channel.leave();

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.close();
      peerConnection = null;
    }

    if (!localMediaDisposed) {
      localMediaDisposed = true;
      disposeLocalMedia?.();
    }
  }

  return {
    dispose,
    isNegotiationReady() {
      return negotiationReady;
    },
    start,
  };
}

export function createDefaultHostBroadcastPeerConnectionFactory():
  | HostBroadcastPublishingPeerConnectionFactory
  | null {
  if (typeof require === 'undefined') {
    return null;
  }

  try {
    const PeerConnection = require('react-native-webrtc').RTCPeerConnection;

    return PeerConnection
      ? (config) => new PeerConnection(config)
      : null;
  } catch {
    return null;
  }
}

function joinMediaSignalingChannel(
  channel: LiveSessionChannel,
): Promise<HostBroadcastPublishingRuntimeStartResult> {
  return new Promise((resolve) => {
    try {
      channel
        .join()
        .receive('ok', () => {
          resolve({ status: 'started' });
        })
        .receive('error', () => {
          resolve({
            reason: GENERIC_START_FAILURE_REASON,
            status: 'error',
          });
        })
        .receive('timeout', () => {
          resolve({
            reason: GENERIC_START_FAILURE_REASON,
            status: 'error',
          });
        });
    } catch {
      resolve({
        reason: GENERIC_START_FAILURE_REASON,
        status: 'error',
      });
    }
  });
}

function toPeerConnectionIceServer(
  server: HostBroadcastMediaIceServer,
): HostBroadcastPublishingPeerConnectionIceServer {
  return {
    ...(server.credential === null ? {} : { credential: server.credential }),
    ...(server.credentialType === null ||
    server.credentialType === '%future added value'
      ? {}
      : { credentialType: server.credentialType }),
    ...(server.username === null ? {} : { username: server.username }),
    urls: server.urls,
  };
}

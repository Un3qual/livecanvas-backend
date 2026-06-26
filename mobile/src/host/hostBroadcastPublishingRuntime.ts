import type {
  LiveSessionChannel,
  LiveSessionChannelSocket,
} from '../live/liveSessionChannelClient';
import { normalizeLiveSessionRealtimeEvent } from '../live/liveSessionRealtimeEvents';
import {
  createHostBroadcastMediaIceCandidatePayload,
  createHostBroadcastMediaOfferPayload,
  type HostBroadcastMediaIceServer,
  type HostBroadcastMediaIceCandidatePayload,
  type HostBroadcastMediaOfferPayload,
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

export type HostBroadcastPublishingChannelTerminationReason =
  | 'closed'
  | 'errored';

export type HostBroadcastPublishingRuntimeOptions = {
  readonly disposeLocalMedia?: () => void;
  readonly localStream: HostBroadcastPublishingMediaStream;
  readonly onChannelTerminated?: (
    reason: HostBroadcastPublishingChannelTerminationReason,
  ) => void;
  readonly onError?: (reason: string) => void;
  readonly onNegotiationPending?: () => void;
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
const MAX_PENDING_VIEWER_ICE_CANDIDATES = 50;

export function createHostBroadcastPublishingRuntime({
  disposeLocalMedia,
  localStream,
  onChannelTerminated,
  onError,
  onNegotiationPending,
  onNegotiationReady,
  peerConnectionFactory,
  preparedMedia,
  socket,
}: HostBroadcastPublishingRuntimeOptions): HostBroadcastPublishingRuntime {
  const channel = socket.channel(preparedMedia.signalingTopic);
  let applyingViewerAnswer = false;
  let disposed = false;
  let localMediaDisposed = false;
  let localIceCandidatePayloads: HostBroadcastMediaIceCandidatePayload[] = [];
  let negotiationReady = false;
  let viewerAnswerApplied = false;
  let pendingViewerIceCandidates: HostBroadcastPublishingIceCandidate[] = [];
  let localOfferPayload: HostBroadcastMediaOfferPayload | null = null;
  let peerConnection: HostBroadcastPublishingPeerConnection | null = null;
  let started = false;
  const disposedDuringStartError = new Error(
    'host_broadcast_publishing_runtime_disposed',
  );

  channel.on('media:answer', (payload) => {
    applyViewerAnswer(payload);
  });
  channel.on('media:ice_candidate', (payload) => {
    applyViewerIceCandidate(payload);
  });
  channel.on('media:viewer_ready', (payload) => {
    replayOfferForReadyViewer(payload);
  });
  channel.onClose?.(() => {
    onChannelTerminated?.('closed');
  });
  channel.onError?.(() => {
    onChannelTerminated?.('errored');
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
      peerConnection = createConfiguredPeerConnection();

      const joinResult = await joinMediaSignalingChannel(channel);
      throwIfDisposed();

      if (joinResult.status === 'error') {
        throw new Error(joinResult.reason);
      }

      await publishLocalOffer();

      return { status: 'started' };
    } catch (error) {
      const reason = GENERIC_START_FAILURE_REASON;
      if (error !== disposedDuringStartError) {
        onError?.(reason);
      }
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

    localIceCandidatePayloads.push(payload);
    channel.push('media:ice_candidate', payload);
  }

  function createConfiguredPeerConnection(): HostBroadcastPublishingPeerConnection {
    const nextPeerConnection = peerConnectionFactory({
      iceServers: preparedMedia.iceServers.map(toPeerConnectionIceServer),
    });
    nextPeerConnection.onicecandidate = (event) => {
      pushLocalIceCandidate(event.candidate ?? null);
    };

    const tracks = localStream.getTracks?.() ?? [];

    if (tracks.length === 0) {
      throw new Error('missing_local_media_tracks');
    }

    for (const track of tracks) {
      nextPeerConnection.addTrack(track, localStream);
    }

    return nextPeerConnection;
  }

  async function publishLocalOffer() {
    if (!peerConnection) {
      throw new Error('missing_peer_connection');
    }

    const offer = await peerConnection.createOffer();
    throwIfDisposed();
    const offerPayload = createHostBroadcastMediaOfferPayload(offer);

    if (!offerPayload) {
      throw new Error('invalid_host_media_offer');
    }

    await peerConnection.setLocalDescription(offerPayload);
    throwIfDisposed();
    localOfferPayload = offerPayload;
    channel.push('media:offer', offerPayload);
  }

  async function applyViewerAnswer(payload: unknown) {
    if (disposed || !peerConnection) {
      return;
    }

    const event = normalizeLiveSessionRealtimeEvent('media:answer', payload);

    if (event?.kind !== 'media_answer' || event.senderRole !== 'viewer') {
      return;
    }

    // The beta path has one viewer peer connection; ignore duplicate answers
    // while the accepted answer is applying or after it has landed.
    if (applyingViewerAnswer || viewerAnswerApplied) {
      return;
    }

    try {
      applyingViewerAnswer = true;
      viewerAnswerApplied = false;
      await peerConnection.setRemoteDescription(event.description);
      if (disposed) {
        applyingViewerAnswer = false;
        return;
      }

      viewerAnswerApplied = true;
      applyingViewerAnswer = false;
      await flushPendingViewerIceCandidates();
      if (disposed) {
        return;
      }

      markNegotiationReady();
    } catch {
      applyingViewerAnswer = false;
      if (!disposed) {
        onError?.(GENERIC_START_FAILURE_REASON);
        dispose();
      }
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
      if (!viewerAnswerApplied || applyingViewerAnswer) {
        queuePendingViewerIceCandidate(event.candidate);
        return;
      }

      await addViewerIceCandidate(event.candidate);
    } catch {
      if (!disposed) {
        onError?.(GENERIC_START_FAILURE_REASON);
        dispose();
      }
    }
  }

  function queuePendingViewerIceCandidate(
    candidate: HostBroadcastPublishingIceCandidate,
  ) {
    if (pendingViewerIceCandidates.length >= MAX_PENDING_VIEWER_ICE_CANDIDATES) {
      pendingViewerIceCandidates.shift();
    }

    pendingViewerIceCandidates.push(candidate);
  }

  async function flushPendingViewerIceCandidates() {
    while (pendingViewerIceCandidates.length > 0) {
      if (disposed) {
        return;
      }

      const candidate = pendingViewerIceCandidates.shift();

      if (candidate) {
        await addViewerIceCandidate(candidate);
      }
    }
  }

  async function addViewerIceCandidate(
    candidate: HostBroadcastPublishingIceCandidate,
  ) {
    if (!peerConnection) {
      return;
    }

    await peerConnection.addIceCandidate(candidate);
  }

  async function replayOfferForReadyViewer(payload: unknown) {
    if (disposed) {
      return;
    }

    const event = normalizeLiveSessionRealtimeEvent('media:viewer_ready', payload);

    if (event?.kind !== 'media_viewer_ready' || event.senderRole !== 'viewer') {
      return;
    }

    // Before the viewer answer lands, viewer_ready is a replay request for
    // cached offer/ICE. After negotiation is ready, the single-viewer beta path
    // restarts the peer connection and publishes a fresh offer instead.
    if (negotiationReady) {
      await restartNegotiationForReadyViewer();
      return;
    }

    if (!localOfferPayload) {
      return;
    }

    channel.push('media:offer', localOfferPayload);

    for (const iceCandidatePayload of localIceCandidatePayloads) {
      channel.push('media:ice_candidate', iceCandidatePayload);
    }
  }

  async function restartNegotiationForReadyViewer() {
    closePeerConnection();
    peerConnection = null;
    applyingViewerAnswer = false;
    localIceCandidatePayloads = [];
    localOfferPayload = null;
    markNegotiationPending();
    pendingViewerIceCandidates = [];
    viewerAnswerApplied = false;

    try {
      peerConnection = createConfiguredPeerConnection();
      await publishLocalOffer();
    } catch (error) {
      if (error !== disposedDuringStartError && !disposed) {
        onError?.(GENERIC_START_FAILURE_REASON);
        dispose();
      }
    }
  }

  function markNegotiationReady() {
    if (disposed || negotiationReady) {
      return;
    }

    negotiationReady = true;
    onNegotiationReady?.();
  }

  function markNegotiationPending() {
    if (disposed || !negotiationReady) {
      return;
    }

    negotiationReady = false;
    onNegotiationPending?.();
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    channel.leave();

    closePeerConnection();
    peerConnection = null;

    if (!localMediaDisposed) {
      localMediaDisposed = true;
      disposeLocalMedia?.();
    }
  }

  function throwIfDisposed() {
    if (disposed) {
      throw disposedDuringStartError;
    }
  }

  function closePeerConnection() {
    if (!peerConnection) {
      return;
    }

    peerConnection.onicecandidate = null;
    peerConnection.close();
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
    ...(server.username === null ? {} : { username: server.username }),
    urls: server.urls,
  };
}

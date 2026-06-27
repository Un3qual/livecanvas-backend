import type {
  LiveSessionChannel,
  LiveSessionChannelSocket,
} from '../liveSessionChannelClient';
import {
  createDefaultLiveWebRtcPeerConnectionFactory,
  type LiveWebRtcPeerConnectionFactory,
} from '../media/liveWebRtcAdapter';
import type { LiveMediaSessionDescription } from '../media/liveMediaPayloads';
import {
  readHostMediaIceCandidateEvent,
  readHostMediaOfferEvent,
} from '../realtime/liveSessionRealtimeMediaEvents';
import type { LiveSessionHostMediaOfferEvent } from '../realtime/liveSessionRealtimeTypes';
import {
  createLiveSessionViewerMediaAnswerPayload,
  createLiveSessionViewerMediaIceCandidatePayload,
  type LiveSessionViewerMediaIceServer,
  type LiveSessionViewerMediaPreparation,
} from './liveSessionViewerPlaybackPreparation';

export type LiveSessionViewerPlaybackSessionDescription =
  LiveMediaSessionDescription;

export type LiveSessionViewerPlaybackIceCandidate = {
  readonly candidate: string;
  readonly sdpMLineIndex?: number | null;
  readonly sdpMid?: string | null;
  readonly toJSON?: () => unknown;
  readonly usernameFragment?: string | null;
};

export type LiveSessionViewerPlaybackPeerConnectionIceServer = {
  readonly credential?: string;
  readonly username?: string;
  readonly urls: ReadonlyArray<string>;
};

export type LiveSessionViewerPlaybackPeerConnectionConfig = {
  readonly iceServers: ReadonlyArray<LiveSessionViewerPlaybackPeerConnectionIceServer>;
};

export type LiveSessionViewerPlaybackRemoteStream = {
  readonly toURL?: () => string;
};

export type LiveSessionViewerPlaybackPeerConnection = {
  onicecandidate:
    | ((
        event: Readonly<{
          candidate?: LiveSessionViewerPlaybackIceCandidate | null;
        }>,
      ) => void)
    | null;
  ontrack:
    | ((
        event: Readonly<{
          streams?: ReadonlyArray<LiveSessionViewerPlaybackRemoteStream>;
        }>,
      ) => void)
    | null;
  readonly addIceCandidate: (
    candidate: LiveSessionViewerPlaybackIceCandidate,
  ) => Promise<void>;
  readonly close: () => void;
  readonly createAnswer: () => Promise<LiveSessionViewerPlaybackSessionDescription>;
  readonly setLocalDescription: (
    description: LiveSessionViewerPlaybackSessionDescription,
  ) => Promise<void>;
  readonly setRemoteDescription: (
    description: LiveSessionViewerPlaybackSessionDescription,
  ) => Promise<void>;
};

export type LiveSessionViewerPlaybackPeerConnectionFactory =
  LiveWebRtcPeerConnectionFactory<
    LiveSessionViewerPlaybackPeerConnectionConfig,
    LiveSessionViewerPlaybackPeerConnection
  >;

export type LiveSessionViewerPlaybackRuntimeStartResult =
  | { readonly status: 'started' }
  | { readonly reason: string; readonly status: 'error' };

export type LiveSessionViewerPlaybackRuntime = {
  readonly dispose: () => void;
  readonly start: () => Promise<LiveSessionViewerPlaybackRuntimeStartResult>;
};

export type LiveSessionViewerPlaybackRuntimeOptions = {
  readonly onChannelTerminated?: () => void;
  readonly onError?: (reason: string) => void;
  readonly onRemoteStream?: (
    stream: LiveSessionViewerPlaybackRemoteStream | null,
  ) => void;
  readonly peerConnectionFactory: LiveSessionViewerPlaybackPeerConnectionFactory;
  readonly preparedMedia: LiveSessionViewerMediaPreparation;
  readonly socket: LiveSessionChannelSocket;
};

type LiveSessionViewerHostOfferEvent = LiveSessionHostMediaOfferEvent;

const GENERIC_VIEWER_PLAYBACK_FAILURE_REASON =
  'Could not start live video playback. Please try again.';
const MAX_PENDING_HOST_ICE_CANDIDATES = 50;

export function createLiveSessionViewerPlaybackRuntime({
  onChannelTerminated,
  onError,
  onRemoteStream,
  peerConnectionFactory,
  preparedMedia,
  socket,
}: LiveSessionViewerPlaybackRuntimeOptions): LiveSessionViewerPlaybackRuntime {
  const channel = socket.channel(preparedMedia.signalingTopic);
  let disposed = false;
  let applyingRemoteOffer = false;
  let applyingRemoteOfferIdentity: string | null = null;
  const pendingHostIceCandidates: LiveSessionViewerPlaybackIceCandidate[] = [];
  let pendingRemoteOffer: LiveSessionViewerHostOfferEvent | null = null;
  let peerConnection: LiveSessionViewerPlaybackPeerConnection | null = null;
  let remoteStreamAttached = false;
  let remoteOfferApplied = false;
  let remoteOfferIdentity: string | null = null;
  let started = false;
  const disposedDuringAsyncError = new Error(
    'live_session_viewer_playback_runtime_disposed',
  );

  channel.on('media:offer', (payload) => {
    answerHostOffer(payload);
  });
  channel.on('media:ice_candidate', (payload) => {
    applyHostIceCandidate(payload);
  });
  channel.onClose?.(() => {
    onChannelTerminated?.();
    dispose();
  });
  channel.onError?.(() => {
    onChannelTerminated?.();
    dispose();
  });

  async function start(): Promise<LiveSessionViewerPlaybackRuntimeStartResult> {
    if (disposed) {
      return {
        reason: GENERIC_VIEWER_PLAYBACK_FAILURE_REASON,
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
      peerConnection.ontrack = (event) => {
        const stream = event.streams?.[0] ?? null;

        if (!disposed && stream) {
          remoteStreamAttached = true;
          onRemoteStream?.(stream);
        }
      };

      const joinResult = await joinMediaSignalingChannel(channel);
      throwIfDisposed();

      if (joinResult.status === 'error') {
        throw new Error(joinResult.reason);
      }

      channel.push('media:viewer_ready', {});

      return { status: 'started' };
    } catch (error) {
      const reason = GENERIC_VIEWER_PLAYBACK_FAILURE_REASON;
      if (error !== disposedDuringAsyncError) {
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
    candidate: LiveSessionViewerPlaybackIceCandidate | null,
  ) {
    if (disposed || !candidate) {
      return;
    }

    const payload = createLiveSessionViewerMediaIceCandidatePayload(candidate);

    if (!payload) {
      return;
    }

    channel.push('media:ice_candidate', payload);
  }

  async function answerHostOffer(payload: unknown) {
    if (disposed || !peerConnection) {
      return;
    }

    const event = readHostMediaOfferEvent(payload);

    if (!event) {
      return;
    }

    await answerNormalizedHostOffer(event);
  }

  async function answerNormalizedHostOffer(
    event: LiveSessionViewerHostOfferEvent,
  ) {
    if (disposed || !peerConnection) {
      return;
    }

    const offerIdentity = createSessionDescriptionIdentity(event.description);

    // Offer identity guards duplicate replays while still allowing a later
    // host restart to replace the pending negotiation attempt.
    if (
      applyingRemoteOffer &&
      applyingRemoteOfferIdentity === offerIdentity
    ) {
      return;
    }

    if (remoteOfferApplied && remoteOfferIdentity === offerIdentity) {
      return;
    }

    if (applyingRemoteOffer) {
      // Host negotiation can restart while a prior offer is still applying.
      // Retain only the newest fresh offer so the host gets a matching answer.
      pendingHostIceCandidates.length = 0;
      pendingRemoteOffer = event;
      return;
    }

    try {
      // Set this synchronously before the first await so concurrent host offers
      // either dedupe by identity or queue as a fresh restart.
      applyingRemoteOffer = true;
      applyingRemoteOfferIdentity = offerIdentity;
      remoteOfferApplied = false;
      await peerConnection.setRemoteDescription(event.description);
      throwIfDisposed();
      remoteOfferApplied = true;
      remoteOfferIdentity = offerIdentity;

      const supersedingOffer = pendingRemoteOffer;

      if (supersedingOffer) {
        pendingRemoteOffer = null;
        applyingRemoteOffer = false;
        applyingRemoteOfferIdentity = null;
        await answerNormalizedHostOffer(supersedingOffer);
        return;
      }

      await flushPendingHostIceCandidates();
      throwIfDisposed();

      const answer = await peerConnection.createAnswer();
      throwIfDisposed();
      const answerPayload = createLiveSessionViewerMediaAnswerPayload(answer);

      if (!answerPayload) {
        throw new Error('invalid_viewer_media_answer');
      }

      await peerConnection.setLocalDescription(answerPayload);
      throwIfDisposed();
      channel.push('media:answer', answerPayload);
      const nextOffer = pendingRemoteOffer;
      pendingRemoteOffer = null;
      applyingRemoteOffer = false;
      applyingRemoteOfferIdentity = null;

      if (nextOffer) {
        await answerNormalizedHostOffer(nextOffer);
      }
    } catch (error) {
      applyingRemoteOffer = false;
      applyingRemoteOfferIdentity = null;
      pendingRemoteOffer = null;
      if (!disposed && error !== disposedDuringAsyncError) {
        onError?.(GENERIC_VIEWER_PLAYBACK_FAILURE_REASON);
        dispose();
      }
    }
  }

  async function applyHostIceCandidate(payload: unknown) {
    if (disposed || !peerConnection) {
      return;
    }

    const event = readHostMediaIceCandidateEvent(payload);

    if (!event) {
      return;
    }

    try {
      // Host ICE can arrive before the accepted remote offer has landed; queue
      // it until setRemoteDescription finishes for the active offer.
      if (!remoteOfferApplied || applyingRemoteOffer) {
        queuePendingHostIceCandidate(event.candidate);
        return;
      }

      await addHostIceCandidate(event.candidate);
    } catch {
      if (!disposed) {
        onError?.(GENERIC_VIEWER_PLAYBACK_FAILURE_REASON);
        dispose();
      }
    }
  }

  function queuePendingHostIceCandidate(
    candidate: LiveSessionViewerPlaybackIceCandidate,
  ) {
    // Bound stale ICE growth during reconnect churn by dropping the oldest
    // candidate once the pre-offer queue is full.
    if (pendingHostIceCandidates.length >= MAX_PENDING_HOST_ICE_CANDIDATES) {
      pendingHostIceCandidates.shift();
    }

    pendingHostIceCandidates.push(candidate);
  }

  async function flushPendingHostIceCandidates() {
    while (pendingHostIceCandidates.length > 0) {
      if (disposed) {
        return;
      }

      const candidate = pendingHostIceCandidates.shift();

      if (candidate) {
        await addHostIceCandidate(candidate);
      }
    }
  }

  async function addHostIceCandidate(
    candidate: LiveSessionViewerPlaybackIceCandidate,
  ) {
    if (!peerConnection) {
      return;
    }

    await peerConnection.addIceCandidate(candidate);
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    pendingRemoteOffer = null;
    channel.leave();

    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.close();
      peerConnection = null;
    }

    if (remoteStreamAttached) {
      remoteStreamAttached = false;
      onRemoteStream?.(null);
    }
  }

  function throwIfDisposed() {
    if (disposed) {
      throw disposedDuringAsyncError;
    }
  }

  return {
    dispose,
    start,
  };
}

export function createDefaultLiveSessionViewerPeerConnectionFactory():
  | LiveSessionViewerPlaybackPeerConnectionFactory
  | null {
  return createDefaultLiveWebRtcPeerConnectionFactory<
    LiveSessionViewerPlaybackPeerConnectionConfig,
    LiveSessionViewerPlaybackPeerConnection
  >();
}

function createSessionDescriptionIdentity(
  description: LiveSessionViewerPlaybackSessionDescription,
): string {
  return `${description.type}\n${description.sdp}`;
}

function joinMediaSignalingChannel(
  channel: LiveSessionChannel,
): Promise<LiveSessionViewerPlaybackRuntimeStartResult> {
  return new Promise((resolve) => {
    try {
      channel
        .join()
        .receive('ok', () => {
          resolve({ status: 'started' });
        })
        .receive('error', () => {
          resolve({
            reason: GENERIC_VIEWER_PLAYBACK_FAILURE_REASON,
            status: 'error',
          });
        })
        .receive('timeout', () => {
          resolve({
            reason: GENERIC_VIEWER_PLAYBACK_FAILURE_REASON,
            status: 'error',
          });
        });
    } catch {
      resolve({
        reason: GENERIC_VIEWER_PLAYBACK_FAILURE_REASON,
        status: 'error',
      });
    }
  });
}

function toPeerConnectionIceServer(
  server: LiveSessionViewerMediaIceServer,
): LiveSessionViewerPlaybackPeerConnectionIceServer {
  return {
    ...(server.credential === null ? {} : { credential: server.credential }),
    ...(server.username === null ? {} : { username: server.username }),
    urls: server.urls,
  };
}

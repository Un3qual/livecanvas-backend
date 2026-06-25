import type {
  LiveSessionChannel,
  LiveSessionChannelSocket,
} from './liveSessionChannelClient';
import type { LiveMutationError } from './liveSessionPresentation';
import { normalizeLiveSessionRealtimeEvent } from './liveSessionRealtimeEvents';

type PrepareLiveMediaSessionSource = {
  readonly errors?: ReadonlyArray<LiveMutationError> | null;
  readonly iceServers?: ReadonlyArray<LiveSessionViewerMediaIceServerSource> | null;
  readonly liveSession?: LiveSessionViewerMediaLiveSessionSource | null;
  readonly signalingTopic?: string | null;
};

type LiveSessionViewerMediaLiveSessionSource = {
  readonly id?: string | null;
  readonly status?: string | null;
};

type LiveSessionViewerMediaIceServerSource = {
  readonly credential?: string | null;
  readonly credentialType?: string | null;
  readonly username?: string | null;
  readonly urls?: ReadonlyArray<string> | null;
};

export type LiveSessionViewerMediaIceServer = {
  readonly credential: string | null;
  readonly credentialType: 'OAUTH' | 'PASSWORD' | '%future added value' | null;
  readonly username: string | null;
  readonly urls: ReadonlyArray<string>;
};

export type LiveSessionViewerMediaPreparation = {
  readonly iceServers: ReadonlyArray<LiveSessionViewerMediaIceServer>;
  readonly liveSessionId: string;
  readonly signalingTopic: string;
};

export type LiveSessionViewerPlaybackSessionDescription = {
  readonly sdp: string;
  readonly type: 'offer' | 'answer';
};

export type LiveSessionViewerPlaybackIceCandidate = {
  readonly candidate: string;
  readonly sdpMLineIndex?: number | null;
  readonly sdpMid?: string | null;
  readonly toJSON?: () => unknown;
  readonly usernameFragment?: string | null;
};

export type LiveSessionViewerPlaybackPeerConnectionIceServer = {
  readonly credential?: string;
  readonly credentialType?: 'OAUTH' | 'PASSWORD';
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

export type LiveSessionViewerPlaybackPeerConnectionFactory = (
  config: LiveSessionViewerPlaybackPeerConnectionConfig,
) => LiveSessionViewerPlaybackPeerConnection;

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

export type LiveSessionViewerMediaAnswerPayload = {
  readonly sdp: string;
  readonly type: 'answer';
};

export type LiveSessionViewerMediaIceCandidatePayload = {
  readonly candidate: string;
  readonly sdp_m_line_index?: number;
  readonly sdp_mid?: string;
  readonly username_fragment?: string;
};

type LiveSessionViewerMediaDescriptionSource = Readonly<{
  sdp?: unknown;
  type?: unknown;
}>;

type LiveSessionViewerMediaIceCandidateSource = Readonly<{
  candidate?: unknown;
  sdpMLineIndex?: unknown;
  sdpMid?: unknown;
  sdp_m_line_index?: unknown;
  sdp_mid?: unknown;
  toJSON?: () => unknown;
  usernameFragment?: unknown;
  username_fragment?: unknown;
}>;

type ReactNativeWebRtcModule = Readonly<{
  RTCPeerConnection?: new (
    config: LiveSessionViewerPlaybackPeerConnectionConfig,
  ) => LiveSessionViewerPlaybackPeerConnection;
}>;

declare const require:
  | undefined
  | ((moduleName: 'react-native-webrtc') => ReactNativeWebRtcModule);

const GENERIC_VIEWER_PLAYBACK_FAILURE_REASON =
  'Could not start live video playback. Please try again.';

export function readPreparedLiveSessionViewerMedia(
  payload: PrepareLiveMediaSessionSource | null | undefined,
): LiveSessionViewerMediaPreparation | null {
  if (
    !payload ||
    (payload.errors?.length ?? 0) > 0 ||
    !payload.liveSession?.id?.trim() ||
    !isActiveLiveSessionStatus(payload.liveSession.status) ||
    !payload.signalingTopic?.trim()
  ) {
    return null;
  }

  const iceServers = normalizeIceServers(payload.iceServers);

  if (iceServers.length === 0) {
    return null;
  }

  return {
    iceServers,
    liveSessionId: payload.liveSession.id,
    signalingTopic: payload.signalingTopic,
  };
}

export function createLiveSessionViewerMediaAnswerPayload(
  description: LiveSessionViewerMediaDescriptionSource | null | undefined,
): LiveSessionViewerMediaAnswerPayload | null {
  if (description?.type !== 'answer' || !isNonBlankString(description.sdp)) {
    return null;
  }

  return {
    sdp: description.sdp,
    type: 'answer',
  };
}

export function createLiveSessionViewerMediaIceCandidatePayload(
  source: LiveSessionViewerMediaIceCandidateSource | null | undefined,
): LiveSessionViewerMediaIceCandidatePayload | null {
  const candidate = normalizeIceCandidateSource(source);

  if (!candidate || !isNonBlankString(candidate.candidate)) {
    return null;
  }

  const sdpMid = readOptionalString(candidate.sdpMid ?? candidate.sdp_mid);
  const sdpMLineIndex = readOptionalNonNegativeInteger(
    candidate.sdpMLineIndex ?? candidate.sdp_m_line_index,
  );
  const usernameFragment = readOptionalString(
    candidate.usernameFragment ?? candidate.username_fragment,
  );

  if (
    sdpMid === undefined ||
    sdpMLineIndex === undefined ||
    usernameFragment === undefined
  ) {
    return null;
  }

  return {
    candidate: candidate.candidate,
    ...(sdpMLineIndex === null
      ? {}
      : { sdp_m_line_index: sdpMLineIndex }),
    ...(sdpMid === null ? {} : { sdp_mid: sdpMid }),
    ...(usernameFragment === null
      ? {}
      : { username_fragment: usernameFragment }),
  };
}

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
  let peerConnection: LiveSessionViewerPlaybackPeerConnection | null = null;
  let remoteStreamAttached = false;
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

    const event = normalizeLiveSessionRealtimeEvent('media:offer', payload);

    if (event?.kind !== 'media_offer' || event.senderRole !== 'host') {
      return;
    }

    try {
      await peerConnection.setRemoteDescription(event.description);
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
    } catch (error) {
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

    const event = normalizeLiveSessionRealtimeEvent(
      'media:ice_candidate',
      payload,
    );

    if (
      event?.kind !== 'media_ice_candidate' ||
      event.senderRole !== 'host'
    ) {
      return;
    }

    try {
      await peerConnection.addIceCandidate(event.candidate);
    } catch {
      if (!disposed) {
        onError?.(GENERIC_VIEWER_PLAYBACK_FAILURE_REASON);
        dispose();
      }
    }
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
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

function normalizeIceServers(
  iceServers: ReadonlyArray<LiveSessionViewerMediaIceServerSource> | null | undefined,
): ReadonlyArray<LiveSessionViewerMediaIceServer> {
  return (
    iceServers
      ?.map(normalizeIceServer)
      .filter(
        (server): server is LiveSessionViewerMediaIceServer => server !== null,
      ) ?? []
  );
}

function normalizeIceServer(
  iceServer: LiveSessionViewerMediaIceServerSource,
): LiveSessionViewerMediaIceServer | null {
  const urls =
    iceServer.urls
      ?.map((url) => url.trim())
      .filter((url) => url.length > 0) ?? [];

  if (urls.length === 0) {
    return null;
  }

  return {
    credential: iceServer.credential ?? null,
    credentialType: normalizeCredentialType(iceServer.credentialType),
    username: iceServer.username ?? null,
    urls,
  };
}

function normalizeCredentialType(
  value: string | null | undefined,
): LiveSessionViewerMediaIceServer['credentialType'] {
  switch (value) {
    case 'OAUTH':
    case 'PASSWORD':
    case null:
    case undefined:
      return value ?? null;
    default:
      return '%future added value';
  }
}

function toPeerConnectionIceServer(
  server: LiveSessionViewerMediaIceServer,
): LiveSessionViewerPlaybackPeerConnectionIceServer {
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

function normalizeIceCandidateSource(
  source: LiveSessionViewerMediaIceCandidateSource | null | undefined,
): LiveSessionViewerMediaIceCandidateSource | null {
  if (!source) {
    return null;
  }

  const json = source.toJSON?.();

  return isRecord(json) ? json : source;
}

function isActiveLiveSessionStatus(value: unknown): boolean {
  return value === 'STARTING' || value === 'LIVE';
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> & LiveSessionViewerMediaIceCandidateSource {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function readOptionalNonNegativeInteger(
  value: unknown,
): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return (
    typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 0
  )
    ? value
    : undefined;
}

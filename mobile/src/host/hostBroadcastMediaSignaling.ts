import { readJoinableLiveSessionChannelTopic } from '../live/liveSessionChannelTopic';
import type { LiveMutationError } from '../live/liveSessionPresentation';

type PrepareLiveMediaSessionSource = {
  readonly errors?: ReadonlyArray<LiveMutationError> | null;
  readonly iceServers?: ReadonlyArray<HostBroadcastMediaIceServerSource> | null;
  readonly liveSession?: HostBroadcastMediaLiveSessionSource | null;
  readonly signalingTopic?: string | null;
};

type HostBroadcastMediaLiveSessionSource = {
  readonly channelTopic?: string | null;
  readonly id?: string | null;
  readonly status?: string | null;
};

type HostBroadcastMediaIceServerSource = {
  readonly credential?: string | null;
  readonly credentialType?: string | null;
  readonly username?: string | null;
  readonly urls?: ReadonlyArray<string> | null;
};

export type HostBroadcastMediaIceServer = {
  readonly credential: string | null;
  readonly credentialType: 'OAUTH' | 'PASSWORD' | '%future added value' | null;
  readonly username: string | null;
  readonly urls: ReadonlyArray<string>;
};

export type HostBroadcastMediaPreparation = {
  readonly channelTopic: string;
  readonly iceServers: ReadonlyArray<HostBroadcastMediaIceServer>;
  readonly liveSessionId: string;
  readonly signalingTopic: string;
};

export type HostBroadcastMediaOfferPayload = {
  readonly sdp: string;
  readonly type: 'offer';
};

export type HostBroadcastMediaIceCandidatePayload = {
  readonly candidate: string;
  readonly sdp_m_line_index?: number;
  readonly sdp_mid?: string;
  readonly username_fragment?: string;
};

type HostBroadcastMediaDescriptionSource = Readonly<{
  sdp?: unknown;
  type?: unknown;
}>;

type HostBroadcastMediaIceCandidateSource = Readonly<{
  candidate?: unknown;
  sdpMLineIndex?: unknown;
  sdpMid?: unknown;
  sdp_m_line_index?: unknown;
  sdp_mid?: unknown;
  toJSON?: () => unknown;
  usernameFragment?: unknown;
  username_fragment?: unknown;
}>;

export function readPreparedHostBroadcastMedia(
  payload: PrepareLiveMediaSessionSource | null | undefined,
): HostBroadcastMediaPreparation | null {
  if (
    !payload ||
    (payload.errors?.length ?? 0) > 0 ||
    !payload.liveSession?.id?.trim() ||
    !payload.signalingTopic?.trim()
  ) {
    return null;
  }

  const channelTopic = readJoinableLiveSessionChannelTopic({
    channelTopic: payload.liveSession.channelTopic,
    status: payload.liveSession.status ?? '',
  });
  const iceServers = normalizeIceServers(payload.iceServers);

  if (!channelTopic || iceServers.length === 0) {
    return null;
  }

  return {
    channelTopic,
    iceServers,
    liveSessionId: payload.liveSession.id,
    signalingTopic: payload.signalingTopic,
  };
}

export function createHostBroadcastMediaOfferPayload(
  description: HostBroadcastMediaDescriptionSource | null | undefined,
): HostBroadcastMediaOfferPayload | null {
  if (
    description?.type !== 'offer' ||
    !isNonBlankString(description.sdp)
  ) {
    return null;
  }

  return {
    sdp: description.sdp,
    type: 'offer',
  };
}

export function createHostBroadcastMediaIceCandidatePayload(
  source: HostBroadcastMediaIceCandidateSource | null | undefined,
): HostBroadcastMediaIceCandidatePayload | null {
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

export function isRetryableHostGoLiveMediaReadinessError(
  errors: ReadonlyArray<LiveMutationError> | null | undefined,
): boolean {
  return (
    errors?.some((error) => error?.message?.trim() === 'media_not_ready') ??
    false
  );
}

function normalizeIceServers(
  iceServers: ReadonlyArray<HostBroadcastMediaIceServerSource> | null | undefined,
): ReadonlyArray<HostBroadcastMediaIceServer> {
  return (
    iceServers
      ?.map(normalizeIceServer)
      .filter((server): server is HostBroadcastMediaIceServer => server !== null) ??
    []
  );
}

function normalizeIceServer(
  iceServer: HostBroadcastMediaIceServerSource,
): HostBroadcastMediaIceServer | null {
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
): HostBroadcastMediaIceServer['credentialType'] {
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

function normalizeIceCandidateSource(
  source: HostBroadcastMediaIceCandidateSource | null | undefined,
): HostBroadcastMediaIceCandidateSource | null {
  if (!source) {
    return null;
  }

  const json = source.toJSON?.();

  return isRecord(json) ? json : source;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> & HostBroadcastMediaIceCandidateSource {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : undefined;
}

function readOptionalNonNegativeInteger(
  value: unknown,
): number | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

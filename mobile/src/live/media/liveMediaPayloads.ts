import type {
  LiveMediaIceCandidatePayload,
  LiveMediaIceCandidateSource,
  LiveMediaIceServer,
  LiveMediaIceServerCredentialType,
  LiveMediaIceServerSource,
  LiveMediaSessionDescription,
  LiveMediaSessionDescriptionSource,
  LiveMediaSessionDescriptionType,
} from './liveMediaTypes';

export function createLiveMediaSessionDescriptionPayload<
  Type extends LiveMediaSessionDescriptionType,
>(
  description: LiveMediaSessionDescriptionSource | null | undefined,
  type: Type,
): LiveMediaSessionDescription<Type> | null {
  if (description?.type !== type || !isNonBlankString(description.sdp)) {
    return null;
  }

  return {
    sdp: description.sdp,
    type,
  };
}

export function normalizeLiveMediaIceCandidatePayload(
  source: LiveMediaIceCandidateSource | null | undefined,
): LiveMediaIceCandidatePayload | null {
  const candidate = normalizeLiveMediaIceCandidateSource(source);

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

export function normalizeLiveMediaIceCandidateSource(
  source: LiveMediaIceCandidateSource | null | undefined,
): (Record<string, unknown> & LiveMediaIceCandidateSource) | null {
  if (!source) {
    return null;
  }

  const json = source.toJSON?.();

  return isRecord(json)
    ? (json as Record<string, unknown> & LiveMediaIceCandidateSource)
    : (source as Record<string, unknown> & LiveMediaIceCandidateSource);
}

export function normalizeLiveMediaIceServers(
  iceServers: ReadonlyArray<LiveMediaIceServerSource> | null | undefined,
): ReadonlyArray<LiveMediaIceServer> {
  return (
    iceServers
      ?.map(normalizeLiveMediaIceServer)
      .filter((server): server is LiveMediaIceServer => server !== null) ?? []
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readOptionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function readOptionalNonNegativeInteger(
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

function normalizeLiveMediaIceServer(
  iceServer: LiveMediaIceServerSource,
): LiveMediaIceServer | null {
  const urls =
    iceServer.urls
      ?.map((url) => url.trim())
      .filter((url) => url.length > 0) ?? [];

  if (urls.length === 0) {
    return null;
  }

  const credentialType = normalizeCredentialType(iceServer.credentialType);

  if (credentialType === 'OAUTH' || credentialType === '%future added value') {
    return null;
  }

  return {
    credential: iceServer.credential ?? null,
    credentialType,
    username: iceServer.username ?? null,
    urls,
  };
}

function normalizeCredentialType(
  value: string | null | undefined,
): LiveMediaIceServerCredentialType {
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

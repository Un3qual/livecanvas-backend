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

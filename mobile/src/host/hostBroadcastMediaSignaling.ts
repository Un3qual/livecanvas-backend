import { readJoinableLiveSessionChannelTopic } from '../live/liveSessionChannelTopic';
import {
  createLiveMediaSessionDescriptionPayload,
  normalizeLiveMediaIceCandidatePayload,
  normalizeLiveMediaIceServers,
} from '../live/media/liveMediaPayloads';
import type {
  LiveMediaIceCandidatePayload,
  LiveMediaIceCandidateSource,
  LiveMediaIceServer,
  LiveMediaIceServerSource,
  LiveMediaSessionDescription,
  LiveMediaSessionDescriptionSource,
} from '../live/media/liveMediaTypes';
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

type HostBroadcastMediaIceServerSource = LiveMediaIceServerSource;

export type HostBroadcastMediaIceServer = LiveMediaIceServer;

export type HostBroadcastMediaPreparation = {
  readonly channelTopic: string;
  readonly iceServers: ReadonlyArray<HostBroadcastMediaIceServer>;
  readonly liveSessionId: string;
  readonly signalingTopic: string;
};

export type HostBroadcastMediaOfferPayload =
  LiveMediaSessionDescription<'offer'>;

export type HostBroadcastMediaIceCandidatePayload =
  LiveMediaIceCandidatePayload;

type HostBroadcastMediaDescriptionSource = LiveMediaSessionDescriptionSource;

type HostBroadcastMediaIceCandidateSource = LiveMediaIceCandidateSource;

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
  const iceServers = normalizeLiveMediaIceServers(payload.iceServers);

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
  return createLiveMediaSessionDescriptionPayload(description, 'offer');
}

export function createHostBroadcastMediaIceCandidatePayload(
  source: HostBroadcastMediaIceCandidateSource | null | undefined,
): HostBroadcastMediaIceCandidatePayload | null {
  return normalizeLiveMediaIceCandidatePayload(source);
}

export function isRetryableHostGoLiveMediaReadinessError(
  errors: ReadonlyArray<LiveMutationError> | null | undefined,
): boolean {
  return (
    errors?.some((error) => error?.message?.trim() === 'media_not_ready') ??
    false
  );
}

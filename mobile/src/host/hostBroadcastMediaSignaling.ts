import type { hostBroadcastPreflightOperationsPrepareMediaMutation } from '../__generated__/hostBroadcastPreflightOperationsPrepareMediaMutation.graphql';
import {
  createLiveMediaSessionDescriptionPayload,
  normalizeLiveMediaIceCandidatePayload,
  normalizeLiveMediaIceServers,
} from '../live/media/liveMediaPayloads';
import type {
  LiveMediaIceCandidatePayload,
  LiveMediaIceCandidateSource,
  LiveMediaIceServer,
  LiveMediaSessionDescription,
  LiveMediaSessionDescriptionSource,
} from '../live/media/liveMediaPayloads';
import {
  canEnterLiveSession,
  normalizeLiveSessionStatus,
  type LiveMutationError,
} from '../live/liveSessionPresentation';

type PrepareLiveMediaSessionSource =
  hostBroadcastPreflightOperationsPrepareMediaMutation['response']['prepareLiveMediaSession'];

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

  const channelTopic = payload.liveSession.channelTopic;
  const iceServers = normalizeLiveMediaIceServers(payload.iceServers);

  if (
    !channelTopic?.trim() ||
    !canEnterLiveSession(
      normalizeLiveSessionStatus(payload.liveSession.status ?? ''),
    ) ||
    iceServers.length === 0
  ) {
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

import type { LiveMutationError } from '../liveSessionPresentation';
import {
  createLiveMediaSessionDescriptionPayload,
  normalizeLiveMediaIceCandidatePayload,
  normalizeLiveMediaIceServers,
} from '../media/liveMediaPayloads';
import type {
  LiveMediaIceCandidatePayload,
  LiveMediaIceCandidateSource,
  LiveMediaIceServer,
  LiveMediaIceServerSource,
  LiveMediaSessionDescription,
  LiveMediaSessionDescriptionSource,
} from '../media/liveMediaPayloads';

export type PrepareLiveSessionViewerMediaSource = {
  readonly errors?: ReadonlyArray<LiveMutationError> | null;
  readonly iceServers?: ReadonlyArray<LiveSessionViewerMediaIceServerSource> | null;
  readonly liveSession?: LiveSessionViewerMediaLiveSessionSource | null;
  readonly signalingTopic?: string | null;
};

export type LiveSessionViewerMediaLiveSessionSource = {
  readonly id?: string | null;
  readonly status?: string | null;
};

export type LiveSessionViewerMediaIceServerSource = LiveMediaIceServerSource;

export type LiveSessionViewerMediaIceServer = LiveMediaIceServer;

export type LiveSessionViewerMediaPreparation = {
  readonly iceServers: ReadonlyArray<LiveSessionViewerMediaIceServer>;
  readonly liveSessionId: string;
  readonly signalingTopic: string;
};

export type LiveSessionViewerMediaAnswerPayload =
  LiveMediaSessionDescription<'answer'>;

export type LiveSessionViewerMediaIceCandidatePayload =
  LiveMediaIceCandidatePayload;

type LiveSessionViewerMediaDescriptionSource =
  LiveMediaSessionDescriptionSource;

type LiveSessionViewerMediaIceCandidateSource = LiveMediaIceCandidateSource;

export function readPreparedLiveSessionViewerMedia(
  payload: PrepareLiveSessionViewerMediaSource | null | undefined,
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

  const iceServers = normalizeLiveMediaIceServers(payload.iceServers);

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
  return createLiveMediaSessionDescriptionPayload(description, 'answer');
}

export function createLiveSessionViewerMediaIceCandidatePayload(
  source: LiveSessionViewerMediaIceCandidateSource | null | undefined,
): LiveSessionViewerMediaIceCandidatePayload | null {
  return normalizeLiveMediaIceCandidatePayload(source);
}

function isActiveLiveSessionStatus(value: unknown): boolean {
  return value === 'STARTING' || value === 'LIVE';
}

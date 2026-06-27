import type {
  HostBroadcastPublishingIceCandidate,
  HostBroadcastPublishingPeerConnection,
  HostBroadcastPublishingSessionDescription,
} from '../../../src/host/hostBroadcastPublishingRuntime';
import type {
  LiveSessionViewerPlaybackIceCandidate,
  LiveSessionViewerPlaybackPeerConnection,
  LiveSessionViewerPlaybackRemoteStream,
  LiveSessionViewerPlaybackSessionDescription,
} from '../../../src/live/liveSessionViewerPlaybackRuntime';

export type Deferred<T = undefined> = {
  readonly promise: Promise<T>;
  readonly resolve: (value?: T) => void;
};

export function createDeferred<T = undefined>(): Deferred<T> {
  let resolve!: (value?: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = (value) => {
      resolvePromise(value as T);
    };
  });

  return { promise, resolve };
}

type FakeSessionDescription = {
  readonly sdp: string;
  readonly type: string;
};

type FakeIceCandidateEvent<IceCandidate> = Readonly<{
  candidate?: IceCandidate | null;
}>;

type FakeIceCandidateHandler<IceCandidate> = (
  event: FakeIceCandidateEvent<IceCandidate>,
) => void;

export type FakeWebRtcPeerConnectionOperation<
  SessionDescription extends FakeSessionDescription,
  IceCandidate,
> =
  | {
      readonly description: SessionDescription;
      readonly type: 'setRemoteDescription';
    }
  | {
      readonly candidate: IceCandidate;
      readonly type: 'addIceCandidate';
    };

export class FakeWebRtcPeerConnection<
  SessionDescription extends FakeSessionDescription,
  IceCandidate,
> {
  readonly addIceCandidateCalls: IceCandidate[] = [];
  readonly localDescriptions: SessionDescription[] = [];
  readonly operations: Array<
    FakeWebRtcPeerConnectionOperation<SessionDescription, IceCandidate>
  > = [];
  readonly remoteDescriptions: SessionDescription[] = [];
  addIceCandidateError: Error | null = null;
  closeCount = 0;
  onicecandidate: FakeIceCandidateHandler<IceCandidate> | null = null;
  setLocalDescriptionDeferred: Deferred | null = null;
  setLocalDescriptionError: Error | null = null;
  setRemoteDescriptionDeferred: Deferred | null = null;
  setRemoteDescriptionError: Error | null = null;

  addIceCandidate(candidate: IceCandidate): Promise<void> {
    this.addIceCandidateCalls.push(candidate);
    this.operations.push({ candidate, type: 'addIceCandidate' });
    if (this.addIceCandidateError) {
      return Promise.reject(this.addIceCandidateError);
    }

    return Promise.resolve();
  }

  close(): void {
    this.closeCount += 1;
  }

  setLocalDescription(description: SessionDescription): Promise<void> {
    this.localDescriptions.push(description);
    if (this.setLocalDescriptionError) {
      return Promise.reject(this.setLocalDescriptionError);
    }

    return this.setLocalDescriptionDeferred?.promise ?? Promise.resolve();
  }

  setRemoteDescription(description: SessionDescription): Promise<void> {
    this.remoteDescriptions.push(description);
    this.operations.push({ description, type: 'setRemoteDescription' });
    if (this.setRemoteDescriptionError) {
      return Promise.reject(this.setRemoteDescriptionError);
    }

    return this.setRemoteDescriptionDeferred?.promise ?? Promise.resolve();
  }

  emitLocalIceCandidate(candidate: IceCandidate | null): void {
    this.onicecandidate?.({ candidate });
  }
}

export const defaultHostBroadcastOffer: HostBroadcastPublishingSessionDescription =
  {
    sdp: 'v=0\r\nhost-offer',
    type: 'offer',
  };

export class FakeHostBroadcastPeerConnection
  extends FakeWebRtcPeerConnection<
    HostBroadcastPublishingSessionDescription,
    HostBroadcastPublishingIceCandidate
  >
  implements HostBroadcastPublishingPeerConnection
{
  readonly addTrackCalls: Array<{
    readonly stream: unknown;
    readonly track: unknown;
  }> = [];
  createOfferDeferred: Deferred<HostBroadcastPublishingSessionDescription> | null =
    null;
  offer: HostBroadcastPublishingSessionDescription = defaultHostBroadcastOffer;

  addTrack(track: unknown, stream: unknown): void {
    this.addTrackCalls.push({ stream, track });
  }

  createOffer(): Promise<HostBroadcastPublishingSessionDescription> {
    return this.createOfferDeferred?.promise ?? Promise.resolve(this.offer);
  }
}

export const defaultViewerPlaybackAnswer: LiveSessionViewerPlaybackSessionDescription =
  {
    sdp: 'v=0\r\nviewer-answer',
    type: 'answer',
  };

export class FakeLiveSessionViewerPeerConnection
  extends FakeWebRtcPeerConnection<
    LiveSessionViewerPlaybackSessionDescription,
    LiveSessionViewerPlaybackIceCandidate
  >
  implements LiveSessionViewerPlaybackPeerConnection
{
  answer: LiveSessionViewerPlaybackSessionDescription =
    defaultViewerPlaybackAnswer;
  createAnswerDeferred: Deferred<LiveSessionViewerPlaybackSessionDescription> | null =
    null;
  createAnswerError: Error | null = null;
  ontrack:
    | ((
        event: Readonly<{
          streams?: ReadonlyArray<LiveSessionViewerPlaybackRemoteStream>;
        }>,
      ) => void)
    | null = null;

  createAnswer(): Promise<LiveSessionViewerPlaybackSessionDescription> {
    if (this.createAnswerError) {
      return Promise.reject(this.createAnswerError);
    }

    return this.createAnswerDeferred?.promise ?? Promise.resolve(this.answer);
  }

  emitRemoteStream(stream: unknown): void {
    this.ontrack?.({
      streams: [stream as LiveSessionViewerPlaybackRemoteStream],
    });
  }
}

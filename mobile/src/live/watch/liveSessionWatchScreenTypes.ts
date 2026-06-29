import type { LiveSessionWatchScreenQuery } from './liveSessionWatchOperations';

export type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];

export type LiveSessionWatchModel = Extract<
  NonNullable<LiveSessionWatchData['node']>,
  { readonly __typename: 'LiveSession' }
>;

export type LiveSessionNode = LiveSessionWatchModel;

export type LiveSessionWatchScreenProps = {
  sessionId: string;
};

export type ViewerPlaybackStatus =
  | 'idle'
  | 'preparing'
  | 'connecting'
  | 'waiting_for_host'
  | 'playing'
  | 'errored'
  | 'closed';

export type ViewerPlaybackState = {
  readonly error: string | null;
  readonly remoteStreamUrl: string | null;
  readonly status: ViewerPlaybackStatus;
};

export type ViewerPlaybackStopOptions = {
  readonly resetState: boolean;
};

export type StopViewerPlayback = (
  options: ViewerPlaybackStopOptions,
) => void;

export type StopViewerPlaybackGeneration = (
  generation: number,
  options: ViewerPlaybackStopOptions,
) => void;

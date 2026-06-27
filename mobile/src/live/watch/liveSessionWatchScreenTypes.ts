import type { ComponentType } from 'react';

import type { LiveSessionViewerPlaybackRuntime } from '../liveSessionViewerPlaybackRuntime';
import type { LiveSessionWatchPendingMutation } from '../liveSessionWatchReducer';
import type { LiveSessionWatchScreenQuery } from '../__generated__/LiveSessionWatchScreenQuery.graphql';

export type LiveSessionWatchData = LiveSessionWatchScreenQuery['response'];

export type LiveSessionRTCViewProps = {
  readonly objectFit?: 'contain' | 'cover';
  readonly streamURL: string;
  readonly style?: unknown;
};

export type ReactNativeWebRtcViewModule = Readonly<{
  RTCView?: ComponentType<LiveSessionRTCViewProps>;
}>;

export type LiveSessionNode = Extract<
  NonNullable<LiveSessionWatchData['node']>,
  { readonly __typename: 'LiveSession' }
>;

export type LiveSessionWatchScreenProps = {
  sessionId: string;
};

export type PendingMutationRef = {
  current: LiveSessionWatchPendingMutation | null;
};

export type PendingChatSendRef = {
  current: { readonly sessionId: string; readonly token: number } | null;
};

export type AutoLeaveOnUnmountRef = {
  current: { readonly sessionId: string; readonly shouldLeave: boolean } | null;
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

export type ViewerPlaybackResource = {
  readonly disconnectSocket: () => void;
  readonly generation: number;
  readonly runtime: LiveSessionViewerPlaybackRuntime;
  readonly sessionId: string;
};

export type LiveSessionWatchContentProps = LiveSessionWatchScreenProps & {
  pendingMutationRef: PendingMutationRef;
};


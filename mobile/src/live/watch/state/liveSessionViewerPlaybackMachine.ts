import { assign, setup, type SnapshotFrom } from 'xstate';

import type { ViewerPlaybackState } from '../liveSessionWatchScreenTypes';

type LiveSessionViewerPlaybackMachineContext = {
  readonly error: string | null;
  readonly remoteStreamUrl: string | null;
};

export type LiveSessionViewerPlaybackMachineEvent =
  | { readonly type: 'PREPARE_REQUESTED' }
  | { readonly type: 'CONNECT_REQUESTED' }
  | { readonly type: 'RUNTIME_STARTED' }
  | {
      readonly remoteStreamUrl: string | null;
      readonly type: 'REMOTE_STREAM_RECEIVED';
    }
  | { readonly type: 'CLOSED' }
  | { readonly error: string; readonly type: 'FAILED' }
  | { readonly type: 'RESET' };

type LiveSessionViewerPlaybackMachineActions = {
  readonly clearError: undefined;
  readonly closePlayback: undefined;
  readonly failPlayback: undefined;
  readonly receiveRemoteStream: undefined;
  readonly resetPlayback: undefined;
};

type LiveSessionViewerPlaybackMachineGuards = {
  readonly hasRemoteStream: undefined;
  readonly receivedRemoteStream: undefined;
};

export const INITIAL_VIEWER_PLAYBACK_STATE: ViewerPlaybackState = {
  error: null,
  remoteStreamUrl: null,
  status: 'idle',
};

export const liveSessionViewerPlaybackMachine = setup<
  LiveSessionViewerPlaybackMachineContext,
  LiveSessionViewerPlaybackMachineEvent,
  {},
  {},
  LiveSessionViewerPlaybackMachineActions,
  LiveSessionViewerPlaybackMachineGuards
>({
  guards: {
    hasRemoteStream: ({ context }) => context.remoteStreamUrl !== null,
    receivedRemoteStream: ({ event }) =>
      event.type === 'REMOTE_STREAM_RECEIVED' &&
      event.remoteStreamUrl !== null,
  },
  actions: {
    clearError: assign({
      error: null,
    }),
    closePlayback: assign({
      error: null,
      remoteStreamUrl: null,
    }),
    failPlayback: assign(({ event }) => ({
      error: readPlaybackFailureError(event),
      remoteStreamUrl: null,
    })),
    receiveRemoteStream: assign(({ event }) => ({
      remoteStreamUrl: readRemoteStreamUrl(event),
    })),
    resetPlayback: assign({
      error: null,
      remoteStreamUrl: null,
    }),
  },
}).createMachine({
  id: 'liveSessionViewerPlayback',
  initial: 'idle',
  context: {
    error: null,
    remoteStreamUrl: null,
  },
  on: {
    PREPARE_REQUESTED: {
      actions: 'resetPlayback',
      target: '.preparing',
    },
    RESET: {
      actions: 'resetPlayback',
      target: '.idle',
    },
  },
  states: {
    idle: {},
    preparing: {
      on: {
        CONNECT_REQUESTED: {
          actions: 'clearError',
          target: 'connecting',
        },
        FAILED: {
          actions: 'failPlayback',
          target: 'errored',
        },
      },
    },
    connecting: {
      on: {
        CLOSED: {
          actions: 'closePlayback',
          target: 'closed',
        },
        FAILED: {
          actions: 'failPlayback',
          target: 'errored',
        },
        REMOTE_STREAM_RECEIVED: [
          {
            actions: 'receiveRemoteStream',
            guard: 'receivedRemoteStream',
            target: 'playing',
          },
          {
            actions: 'receiveRemoteStream',
          },
        ],
        RUNTIME_STARTED: [
          {
            actions: 'clearError',
            guard: 'hasRemoteStream',
            target: 'playing',
          },
          {
            actions: 'clearError',
            target: 'waitingForHost',
          },
        ],
      },
    },
    waitingForHost: {
      on: {
        CLOSED: {
          actions: 'closePlayback',
          target: 'closed',
        },
        FAILED: {
          actions: 'failPlayback',
          target: 'errored',
        },
        REMOTE_STREAM_RECEIVED: [
          {
            actions: 'receiveRemoteStream',
            guard: 'receivedRemoteStream',
            target: 'playing',
          },
          {
            actions: 'receiveRemoteStream',
          },
        ],
      },
    },
    playing: {
      on: {
        CLOSED: {
          actions: 'closePlayback',
          target: 'closed',
        },
        FAILED: {
          actions: 'failPlayback',
          target: 'errored',
        },
        REMOTE_STREAM_RECEIVED: {
          actions: 'receiveRemoteStream',
        },
        RUNTIME_STARTED: {
          actions: 'clearError',
        },
      },
    },
    closed: {},
    errored: {},
  },
});

export type LiveSessionViewerPlaybackSnapshot = SnapshotFrom<
  typeof liveSessionViewerPlaybackMachine
>;

export function selectLiveSessionViewerPlaybackState(
  snapshot: LiveSessionViewerPlaybackSnapshot,
): ViewerPlaybackState {
  return {
    error: snapshot.context.error,
    remoteStreamUrl: snapshot.context.remoteStreamUrl,
    status: selectLiveSessionViewerPlaybackStatus(snapshot),
  };
}

function selectLiveSessionViewerPlaybackStatus(
  snapshot: LiveSessionViewerPlaybackSnapshot,
): ViewerPlaybackState['status'] {
  if (snapshot.matches('preparing')) {
    return 'preparing';
  }

  if (snapshot.matches('connecting')) {
    return 'connecting';
  }

  if (snapshot.matches('waitingForHost')) {
    return 'waiting_for_host';
  }

  if (snapshot.matches('playing')) {
    return 'playing';
  }

  if (snapshot.matches('closed')) {
    return 'closed';
  }

  if (snapshot.matches('errored')) {
    return 'errored';
  }

  return 'idle';
}

function readPlaybackFailureError(
  event: LiveSessionViewerPlaybackMachineEvent,
): string {
  if (event.type !== 'FAILED') {
    throw new Error(`Unexpected playback failure event: ${event.type}`);
  }

  return event.error;
}

function readRemoteStreamUrl(
  event: LiveSessionViewerPlaybackMachineEvent,
): string | null {
  if (event.type !== 'REMOTE_STREAM_RECEIVED') {
    throw new Error(`Unexpected remote stream event: ${event.type}`);
  }

  return event.remoteStreamUrl;
}

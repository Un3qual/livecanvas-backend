import { assign, setup, type SnapshotFrom } from 'xstate';

import type {
  LiveSessionChatChannelStatus,
  LiveSessionChatSendStatus,
} from '../liveSessionChatState';

const CHAT_SEND_DISCONNECTED_ERROR =
  'Chat disconnected before the message was sent.';

type LiveSessionChatChannelMachineContext = {
  readonly activeSessionId: string | null;
  readonly channelError: string | null;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export type LiveSessionChatChannelMachineEvent =
  | { readonly sessionId: string; readonly type: 'SESSION_CHANGED' }
  | { readonly sessionId: string; readonly type: 'CHANNEL_IDLE' }
  | { readonly sessionId: string; readonly type: 'CHANNEL_JOINING' }
  | { readonly sessionId: string; readonly type: 'CHANNEL_JOINED' }
  | { readonly sessionId: string; readonly type: 'CHANNEL_CLOSED' }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'CHANNEL_ERRORED';
    }
  | { readonly sessionId: string; readonly type: 'SEND_STARTED' }
  | { readonly sessionId: string; readonly type: 'SEND_SUCCEEDED' }
  | { readonly sessionId: string; readonly type: 'SEND_CANCELLED' }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'SEND_FAILED';
    };

type LiveSessionChatChannelMachineActions = {
  readonly cancelSend: undefined;
  readonly closeChannel: undefined;
  readonly failChannel: undefined;
  readonly idleChannel: undefined;
  readonly failSend: undefined;
  readonly joinChannel: undefined;
  readonly markJoined: undefined;
  readonly resetForSession: undefined;
  readonly startSend: undefined;
  readonly succeedSend: undefined;
};

type LiveSessionChatChannelMachineGuards = {
  readonly isActiveSession: undefined;
};

export type LiveSessionChatChannelViewState = {
  readonly channelError: string | null;
  readonly channelStatus: LiveSessionChatChannelStatus;
  readonly sendError: string | null;
  readonly sendStatus: LiveSessionChatSendStatus;
};

export const liveSessionChatChannelMachine = setup<
  LiveSessionChatChannelMachineContext,
  LiveSessionChatChannelMachineEvent,
  {},
  {},
  LiveSessionChatChannelMachineActions,
  LiveSessionChatChannelMachineGuards
>({
  guards: {
    isActiveSession: ({ context, event }) =>
      context.activeSessionId === event.sessionId,
  },
  actions: {
    resetForSession: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      channelError: null,
      sendError: null,
      sendStatus: 'idle' as const,
    })),
    joinChannel: assign({
      channelError: null,
    }),
    idleChannel: assign({
      channelError: null,
    }),
    markJoined: assign({
      channelError: null,
    }),
    closeChannel: assign(({ context }) => ({
      channelError: null,
      sendError:
        context.sendStatus === 'sending'
          ? CHAT_SEND_DISCONNECTED_ERROR
          : context.sendError,
      sendStatus:
        context.sendStatus === 'sending'
          ? ('failed' as const)
          : context.sendStatus,
    })),
    failChannel: assign(({ context, event }) => ({
      channelError: readChannelError(event),
      sendError:
        context.sendStatus === 'sending'
          ? CHAT_SEND_DISCONNECTED_ERROR
          : context.sendError,
      sendStatus:
        context.sendStatus === 'sending'
          ? ('failed' as const)
          : context.sendStatus,
    })),
    startSend: assign({
      sendError: null,
      sendStatus: 'sending',
    }),
    succeedSend: assign({
      sendError: null,
      sendStatus: 'idle',
    }),
    cancelSend: assign({
      sendError: null,
      sendStatus: 'idle',
    }),
    failSend: assign(({ event }) => ({
      sendError: readSendError(event),
      sendStatus: 'failed' as const,
    })),
  },
}).createMachine({
  id: 'liveSessionChatChannel',
  initial: 'idle',
  context: {
    activeSessionId: null,
    channelError: null,
    sendError: null,
    sendStatus: 'idle',
  },
  on: {
    SESSION_CHANGED: {
      actions: 'resetForSession',
      target: '.idle',
    },
    CHANNEL_IDLE: {
      actions: 'idleChannel',
      guard: 'isActiveSession',
      target: '.idle',
    },
  },
  states: {
    idle: {
      on: {
        CHANNEL_JOINING: {
          actions: 'joinChannel',
          guard: 'isActiveSession',
          target: 'joining',
        },
        CHANNEL_JOINED: {
          actions: 'markJoined',
          guard: 'isActiveSession',
          target: 'joined',
        },
        CHANNEL_CLOSED: {
          actions: 'closeChannel',
          guard: 'isActiveSession',
          target: 'closed',
        },
        CHANNEL_ERRORED: {
          actions: 'failChannel',
          guard: 'isActiveSession',
          target: 'errored',
        },
      },
    },
    joining: {
      on: {
        CHANNEL_JOINED: {
          actions: 'markJoined',
          guard: 'isActiveSession',
          target: 'joined',
        },
        CHANNEL_CLOSED: {
          actions: 'closeChannel',
          guard: 'isActiveSession',
          target: 'closed',
        },
        CHANNEL_ERRORED: {
          actions: 'failChannel',
          guard: 'isActiveSession',
          target: 'errored',
        },
      },
    },
    joined: {
      on: {
        CHANNEL_JOINING: {
          actions: 'joinChannel',
          guard: 'isActiveSession',
          target: 'joining',
        },
        CHANNEL_CLOSED: {
          actions: 'closeChannel',
          guard: 'isActiveSession',
          target: 'closed',
        },
        CHANNEL_ERRORED: {
          actions: 'failChannel',
          guard: 'isActiveSession',
          target: 'errored',
        },
        SEND_STARTED: {
          actions: 'startSend',
          guard: 'isActiveSession',
        },
        SEND_SUCCEEDED: {
          actions: 'succeedSend',
          guard: 'isActiveSession',
        },
        SEND_CANCELLED: {
          actions: 'cancelSend',
          guard: 'isActiveSession',
        },
        SEND_FAILED: {
          actions: 'failSend',
          guard: 'isActiveSession',
        },
      },
    },
    closed: {
      on: {
        CHANNEL_JOINING: {
          actions: 'joinChannel',
          guard: 'isActiveSession',
          target: 'joining',
        },
      },
    },
    errored: {
      on: {
        CHANNEL_JOINING: {
          actions: 'joinChannel',
          guard: 'isActiveSession',
          target: 'joining',
        },
      },
    },
  },
});

export type LiveSessionChatChannelSnapshot = SnapshotFrom<
  typeof liveSessionChatChannelMachine
>;

export function selectLiveSessionChatChannelState(
  snapshot: LiveSessionChatChannelSnapshot,
): LiveSessionChatChannelViewState {
  return {
    channelError: snapshot.context.channelError,
    channelStatus: selectLiveSessionChatChannelStatus(snapshot),
    sendError: snapshot.context.sendError,
    sendStatus: snapshot.context.sendStatus,
  };
}

export function selectLiveSessionChatChannelStatus(
  snapshot: LiveSessionChatChannelSnapshot,
): LiveSessionChatChannelStatus {
  if (snapshot.matches('joining')) {
    return 'joining';
  }

  if (snapshot.matches('joined')) {
    return 'joined';
  }

  if (snapshot.matches('closed')) {
    return 'closed';
  }

  if (snapshot.matches('errored')) {
    return 'errored';
  }

  return 'idle';
}

export function selectLiveSessionChatSendStatus(
  snapshot: LiveSessionChatChannelSnapshot,
): LiveSessionChatSendStatus {
  return snapshot.context.sendStatus;
}

function readChannelError(event: LiveSessionChatChannelMachineEvent): string {
  if (event.type !== 'CHANNEL_ERRORED') {
    throw new Error(`Unexpected chat channel error event: ${event.type}`);
  }

  return event.error;
}

function readSendError(event: LiveSessionChatChannelMachineEvent): string {
  if (event.type !== 'SEND_FAILED') {
    throw new Error(`Unexpected chat send failure event: ${event.type}`);
  }

  return event.error;
}

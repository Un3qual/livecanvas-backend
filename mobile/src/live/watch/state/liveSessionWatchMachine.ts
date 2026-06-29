import { assign, setup, type SnapshotFrom } from 'xstate';

import {
  formatLiveMutationErrors,
  type LiveMutationError,
} from '../../liveSessionPresentation';

export type LiveSessionWatchSubmission =
  | 'idle'
  | 'joining'
  | 'leaving'
  | 'ending';
export type LiveSessionWatchMutationKind = 'join' | 'leave' | 'end';

export type LiveSessionWatchPendingCommand = {
  readonly kind: LiveSessionWatchMutationKind;
  readonly sessionId: string;
};

type LiveSessionWatchMachineContext = {
  readonly activeSessionId: string | null;
  readonly autoLeaveEnabled: boolean;
  readonly error: string | null;
  readonly pendingCommand: LiveSessionWatchPendingCommand | null;
};

type LiveSessionWatchFailureEvent =
  | {
      readonly type: 'JOIN_FAILED';
      readonly sessionId: string;
      readonly errors?: ReadonlyArray<LiveMutationError> | null;
    }
  | {
      readonly type: 'LEAVE_FAILED';
      readonly sessionId: string;
      readonly errors?: ReadonlyArray<LiveMutationError> | null;
    }
  | {
      readonly type: 'END_FAILED';
      readonly sessionId: string;
      readonly errors?: ReadonlyArray<LiveMutationError> | null;
    };

export type LiveSessionWatchMachineEvent =
  | { readonly type: 'SESSION_CHANGED'; readonly sessionId: string }
  | { readonly type: 'JOIN_REQUESTED'; readonly sessionId: string }
  | { readonly type: 'JOIN_SUCCEEDED'; readonly sessionId: string }
  | LiveSessionWatchFailureEvent
  | { readonly type: 'LEAVE_REQUESTED'; readonly sessionId: string }
  | { readonly type: 'LEAVE_SUCCEEDED'; readonly sessionId: string }
  | { readonly type: 'MEMBERSHIP_LOST'; readonly sessionId: string }
  | { readonly type: 'END_REQUESTED'; readonly sessionId: string }
  | { readonly type: 'END_SUCCEEDED'; readonly sessionId: string }
  | { readonly type: 'SESSION_ENDED'; readonly sessionId: string };

type LiveSessionWatchMachineActions = {
  readonly clearJoined: undefined;
  readonly failEnd: undefined;
  readonly failEndJoined: undefined;
  readonly failJoin: undefined;
  readonly failLeave: undefined;
  readonly markJoined: undefined;
  readonly requestEnd: undefined;
  readonly requestJoin: undefined;
  readonly requestLeave: undefined;
  readonly resetForSession: undefined;
};

type LiveSessionWatchMachineGuards = {
  readonly canStartSessionCommand: undefined;
  readonly isActiveSession: undefined;
};

export const liveSessionWatchMachine = setup<
  LiveSessionWatchMachineContext,
  LiveSessionWatchMachineEvent,
  Record<string, never>,
  Record<string, never>,
  LiveSessionWatchMachineActions,
  LiveSessionWatchMachineGuards
>({
  actors: {},
  guards: {
    canStartSessionCommand: ({ context, event }) =>
      context.activeSessionId === event.sessionId,
    isActiveSession: ({ context, event }) =>
      context.activeSessionId === event.sessionId,
  },
  actions: {
    resetForSession: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: null,
      pendingCommand: null,
    })),
    requestJoin: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: null,
      pendingCommand: {
        kind: 'join',
        sessionId: event.sessionId,
      },
    })),
    markJoined: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: true,
      error: null,
      pendingCommand: null,
    })),
    failJoin: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: formatFailureEvent(event),
      pendingCommand: null,
    })),
    requestLeave: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: null,
      pendingCommand: {
        kind: 'leave',
        sessionId: event.sessionId,
      },
    })),
    clearJoined: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: null,
      pendingCommand: null,
    })),
    failLeave: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: true,
      error: formatFailureEvent(event),
      pendingCommand: null,
    })),
    requestEnd: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: null,
      pendingCommand: {
        kind: 'end',
        sessionId: event.sessionId,
      },
    })),
    failEnd: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: false,
      error: formatFailureEvent(event),
      pendingCommand: null,
    })),
    failEndJoined: assign(({ event }) => ({
      activeSessionId: event.sessionId,
      autoLeaveEnabled: true,
      error: formatFailureEvent(event),
      pendingCommand: null,
    })),
  },
}).createMachine({
  id: 'liveSessionWatch',
  initial: 'idle',
  context: {
    activeSessionId: null,
    autoLeaveEnabled: false,
    error: null,
    pendingCommand: null,
  },
  on: {
    SESSION_CHANGED: {
      actions: 'resetForSession',
      target: '.idle',
    },
  },
  states: {
    idle: {
      on: {
        JOIN_REQUESTED: {
          actions: 'requestJoin',
          guard: 'canStartSessionCommand',
          target: 'joining',
        },
        END_REQUESTED: {
          actions: 'requestEnd',
          guard: 'canStartSessionCommand',
          target: 'endingIdle',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
        },
      },
    },
    joining: {
      on: {
        JOIN_SUCCEEDED: {
          actions: 'markJoined',
          guard: 'isActiveSession',
          target: 'joined',
        },
        JOIN_FAILED: {
          actions: 'failJoin',
          guard: 'isActiveSession',
          target: 'idle',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
      },
    },
    joined: {
      on: {
        LEAVE_REQUESTED: {
          actions: 'requestLeave',
          guard: 'isActiveSession',
          target: 'leaving',
        },
        MEMBERSHIP_LOST: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        END_REQUESTED: {
          actions: 'requestEnd',
          guard: 'isActiveSession',
          target: 'endingJoined',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
      },
    },
    leaving: {
      on: {
        LEAVE_SUCCEEDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        LEAVE_FAILED: {
          actions: 'failLeave',
          guard: 'isActiveSession',
          target: 'joined',
        },
        MEMBERSHIP_LOST: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
      },
    },
    endingJoined: {
      on: {
        END_SUCCEEDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        END_FAILED: {
          actions: 'failEndJoined',
          guard: 'isActiveSession',
          target: 'joined',
        },
        MEMBERSHIP_LOST: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
      },
    },
    endingIdle: {
      on: {
        END_SUCCEEDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
        END_FAILED: {
          actions: 'failEnd',
          guard: 'isActiveSession',
          target: 'idle',
        },
        SESSION_ENDED: {
          actions: 'clearJoined',
          guard: 'isActiveSession',
          target: 'idle',
        },
      },
    },
  },
});

export type LiveSessionWatchSnapshot = SnapshotFrom<
  typeof liveSessionWatchMachine
>;

export function readLiveSessionWatchSubmission(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
): LiveSessionWatchSubmission {
  if (snapshot.context.activeSessionId !== sessionId) {
    return 'idle';
  }

  if (snapshot.matches('joining')) {
    return 'joining';
  }

  if (snapshot.matches('leaving')) {
    return 'leaving';
  }

  if (snapshot.matches('endingJoined') || snapshot.matches('endingIdle')) {
    return 'ending';
  }

  return 'idle';
}

export function readLiveSessionWatchPendingCommand(
  snapshot: LiveSessionWatchSnapshot,
): LiveSessionWatchPendingCommand | null {
  return snapshot.context.pendingCommand;
}

export function readLiveSessionWatchError(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
): string | null {
  return snapshot.context.activeSessionId === sessionId
    ? snapshot.context.error
    : null;
}

export function isLiveSessionWatchMutationPending(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
  kind: LiveSessionWatchMutationKind,
): boolean {
  const pendingCommand = readLiveSessionWatchPendingCommand(snapshot);

  return (
    pendingCommand?.sessionId === sessionId && pendingCommand.kind === kind
  );
}

export function isLiveSessionWatchAnyMutationPending(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
): boolean {
  return snapshot.context.pendingCommand?.sessionId === sessionId;
}

export function isLiveSessionViewerJoined(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
): boolean {
  return (
    snapshot.context.activeSessionId === sessionId &&
    (snapshot.matches('joined') ||
      snapshot.matches('leaving') ||
      snapshot.matches('endingJoined'))
  );
}

export function shouldAutoLeaveLiveSession(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
): boolean {
  return (
    snapshot.context.activeSessionId === sessionId &&
    snapshot.context.autoLeaveEnabled &&
    isLiveSessionViewerJoined(snapshot, sessionId) &&
    !isLiveSessionWatchAnyMutationPending(snapshot, sessionId)
  );
}

export function canRequestLiveSessionWatchCommand(
  snapshot: LiveSessionWatchSnapshot,
  sessionId: string,
  kind: LiveSessionWatchMutationKind,
): boolean {
  if (
    snapshot.context.activeSessionId !== sessionId ||
    isLiveSessionWatchAnyMutationPending(snapshot, sessionId)
  ) {
    return false;
  }

  switch (kind) {
    case 'join':
      return snapshot.matches('idle');
    case 'leave':
      return snapshot.matches('joined');
    case 'end':
      return snapshot.matches('idle') || snapshot.matches('joined');
    default:
      return false;
  }
}

function formatFailureEvent(event: LiveSessionWatchMachineEvent): string {
  switch (event.type) {
    case 'JOIN_FAILED':
    case 'LEAVE_FAILED':
    case 'END_FAILED':
      return formatLiveMutationErrors(event.errors);
    default:
      return formatLiveMutationErrors([]);
  }
}

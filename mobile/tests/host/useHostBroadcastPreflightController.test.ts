import { describe, expect, test } from 'bun:test';

import type { HostBroadcastMediaPreparation } from '../../src/host/hostBroadcastMediaSignaling';
import {
  createHostBroadcastSessionState,
  hostBroadcastSessionReducer,
  type HostBroadcastSessionAction,
  type HostBroadcastSessionState,
} from '../../src/host/hostBroadcastSession';
import type { HostBroadcastPublishingResource } from '../../src/host/hostBroadcastPublishingSession';
import type { HostBroadcastPublishingStatus } from '../../src/host/preflight/hostBroadcastPreflightScreenTypes';
import {
  createHostBroadcastPreflightControllerLifecycle,
  type HostBroadcastEndLiveSessionCommit,
  type HostBroadcastGoLiveCommit,
  type HostBroadcastPrepareMediaCommit,
  type HostBroadcastStartLiveSessionCommit,
} from '../../src/host/preflight/hooks/useHostBroadcastPreflightController';

type StartLiveSessionCommitConfig = {
  readonly onCompleted?: (payload: StartLiveSessionPayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly visibility: 'PUBLIC';
    };
  };
};

type StartLiveSessionPayload = {
  readonly startLiveSession: {
    readonly errors: ReadonlyArray<MutationError>;
    readonly liveSession: LiveSessionPayload | null;
  } | null;
};

type PrepareMediaCommitConfig = {
  readonly onCompleted?: (payload: PrepareMediaPayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly liveSessionId: string;
    };
  };
};

type PrepareMediaPayload = {
  readonly prepareLiveMediaSession: {
    readonly errors: ReadonlyArray<MutationError>;
    readonly iceServers: ReadonlyArray<{
      readonly credential: string | null;
      readonly credentialType: 'PASSWORD' | null;
      readonly urls: ReadonlyArray<string>;
      readonly username: string | null;
    }>;
    readonly liveSession: LiveSessionPayload;
    readonly signalingTopic: string;
  };
};

type GoLiveCommitConfig = {
  readonly onCompleted?: (payload: GoLivePayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly liveSessionId: string;
    };
  };
};

type GoLivePayload = {
  readonly goLiveSession: {
    readonly errors: ReadonlyArray<MutationError>;
    readonly liveSession: LiveSessionPayload | null;
  } | null;
};

type EndLiveSessionCommitConfig = {
  readonly onCompleted?: (payload: EndLiveSessionPayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly liveSessionId: string;
    };
  };
};

type EndLiveSessionPayload = {
  readonly endLiveSession: {
    readonly errors: ReadonlyArray<MutationError>;
    readonly liveSession: LiveSessionPayload | null;
  } | null;
};

type MutationError = {
  readonly field?: string | null;
  readonly message: string;
};

type LiveSessionPayload = {
  readonly channelTopic: string;
  readonly id: string;
  readonly status: 'LIVE' | 'STARTING';
};

type StateUpdate<T> = T | ((current: T) => T);

function createHarness() {
  const endCommits: EndLiveSessionCommitConfig[] = [];
  const goLiveCommits: GoLiveCommitConfig[] = [];
  const navigateBackCalls: string[] = [];
  const navigatedLiveSessionIds: string[] = [];
  const prepareCommits: PrepareMediaCommitConfig[] = [];
  const retainedLiveSessionIds: string[] = [];
  const startCommits: StartLiveSessionCommitConfig[] = [];
  let backendMediaReady = false;
  let canRetainPublishingResource = true;
  let disposedNativeCount = 0;
  let hostActionError: string | null = null;
  let isGoingLive = false;
  let isPreparingMedia = false;
  let preparedMedia: HostBroadcastMediaPreparation | null = null;
  let publishingStatus: HostBroadcastPublishingStatus = 'idle';
  let retainedResource: HostBroadcastPublishingResource | null = null;
  let sessionState = createHostBroadcastSessionState();
  const lifecycle = createHostBroadcastPreflightControllerLifecycle({
    commitEndLiveSession: ((config) => {
      endCommits.push(config as EndLiveSessionCommitConfig);
    }) as HostBroadcastEndLiveSessionCommit,
    commitGoLive: ((config) => {
      goLiveCommits.push(config as GoLiveCommitConfig);
    }) as HostBroadcastGoLiveCommit,
    commitPrepareMedia: ((config) => {
      prepareCommits.push(config as PrepareMediaCommitConfig);
    }) as HostBroadcastPrepareMediaCommit,
    commitStartLiveSession: ((config) => {
      startCommits.push(config as StartLiveSessionCommitConfig);
    }) as HostBroadcastStartLiveSessionCommit,
    dispatchSessionAction: (action: HostBroadcastSessionAction) => {
      sessionState = hostBroadcastSessionReducer(sessionState, action);
    },
    disposeNative: () => {
      disposedNativeCount += 1;
    },
    failPreparedPublishing: (reason) => {
      preparedMedia = null;
      publishingStatus = 'errored';
      backendMediaReady = false;
      hostActionError = reason;
    },
    getCanCreateSession: () =>
      sessionState.status !== 'creating' &&
      sessionState.liveSessionId === null,
    getCanGoLive: () =>
      sessionState.status === 'starting' &&
      sessionState.liveSessionId !== null &&
      preparedMedia !== null &&
      backendMediaReady &&
      !isGoingLive,
    getCanPrepareMedia: () =>
      sessionState.status === 'starting' &&
      sessionState.liveSessionId !== null &&
      preparedMedia === null &&
      !isPreparingMedia,
    getCanUseBackAction: () =>
      sessionState.status !== 'creating' &&
      sessionState.status !== 'ending' &&
      !isGoingLive,
    getSessionState: () => sessionState,
    hasRetainedPublishingResource: () => retainedResource !== null,
    navigateBack: () => {
      navigateBackCalls.push('back');
    },
    navigateToLiveSession: (liveSessionId) => {
      navigatedLiveSessionIds.push(liveSessionId);
    },
    resetPreparedMedia: () => {
      preparedMedia = null;
      publishingStatus = 'idle';
      backendMediaReady = false;
    },
    retainAttachedPublishingForLiveSession: (liveSessionId) => {
      if (!canRetainPublishingResource) {
        return null;
      }

      retainedLiveSessionIds.push(liveSessionId);
      retainedResource = createPublishingResource();
      return retainedResource;
    },
    setHostActionError: (error) => {
      hostActionError = error;
    },
    setIsGoingLive: setState((next) => {
      isGoingLive = next;
    }, () => isGoingLive),
    setIsPreparingMedia: setState((next) => {
      isPreparingMedia = next;
    }, () => isPreparingMedia),
    setPreparedMedia: setState((next) => {
      preparedMedia = next;
    }, () => preparedMedia),
  });

  function completeStartSession(liveSessionId = 'live-session-id') {
    startCommits[startCommits.length - 1]?.onCompleted?.(
      createStartLiveSessionPayload(liveSessionId),
    );
  }

  function completePrepareMedia(liveSessionId = 'live-session-id') {
    prepareCommits[prepareCommits.length - 1]?.onCompleted?.(
      createPrepareMediaPayload(liveSessionId),
    );
  }

  function markBackendMediaReady() {
    backendMediaReady = true;
    publishingStatus = 'ready';
  }

  function prepareStartedSession(liveSessionId = 'live-session-id') {
    lifecycle.handleCreateSessionPress();
    completeStartSession(liveSessionId);
    lifecycle.handlePrepareMediaPress();
    completePrepareMedia(liveSessionId);
    markBackendMediaReady();
  }

  return {
    completePrepareMedia,
    completeStartSession,
    endCommits,
    get backendMediaReady() {
      return backendMediaReady;
    },
    get disposedNativeCount() {
      return disposedNativeCount;
    },
    get hostActionError() {
      return hostActionError;
    },
    get isGoingLive() {
      return isGoingLive;
    },
    get preparedMedia() {
      return preparedMedia;
    },
    get publishingStatus() {
      return publishingStatus;
    },
    get sessionState() {
      return sessionState;
    },
    goLiveCommits,
    lifecycle,
    markBackendMediaReady,
    navigateBackCalls,
    navigatedLiveSessionIds,
    prepareCommits,
    prepareStartedSession,
    retainedLiveSessionIds,
    setCanRetainPublishingResource(nextValue: boolean) {
      canRetainPublishingResource = nextValue;
    },
    startCommits,
  };
}

function setState<T>(
  write: (next: T) => void,
  read: () => T,
): (next: StateUpdate<T>) => void {
  return (next) => {
    write(typeof next === 'function' ? (next as (current: T) => T)(read()) : next);
  };
}

function createPublishingResource(): HostBroadcastPublishingResource {
  return {
    disconnectSocket() {
      // The preflight lifecycle only needs resource identity here.
    },
    runtime: {
      dispose() {
        // The preflight lifecycle only needs resource identity here.
      },
      isNegotiationReady() {
        return true;
      },
      start() {
        return Promise.resolve({ status: 'started' as const });
      },
    },
  };
}

function createStartLiveSessionPayload(
  liveSessionId: string,
): StartLiveSessionPayload {
  return {
    startLiveSession: {
      errors: [],
      liveSession: createLiveSessionPayload(liveSessionId, 'STARTING'),
    },
  };
}

function createPrepareMediaPayload(liveSessionId: string): PrepareMediaPayload {
  return {
    prepareLiveMediaSession: {
      errors: [],
      iceServers: [
        {
          credential: null,
          credentialType: null,
          urls: ['stun:stun.example.test:3478'],
          username: null,
        },
      ],
      liveSession: createLiveSessionPayload(liveSessionId, 'STARTING'),
      signalingTopic: `live_session_media:${liveSessionId}`,
    },
  };
}

function createGoLivePayload(liveSessionId: string): GoLivePayload {
  return {
    goLiveSession: {
      errors: [],
      liveSession: createLiveSessionPayload(liveSessionId, 'LIVE'),
    },
  };
}

function createRetryableGoLivePayload(): GoLivePayload {
  return {
    goLiveSession: {
      errors: [{ message: 'media_not_ready' }],
      liveSession: null,
    },
  };
}

function createLiveSessionPayload(
  liveSessionId: string,
  status: LiveSessionPayload['status'],
): LiveSessionPayload {
  return {
    channelTopic: `live_session:${liveSessionId}`,
    id: liveSessionId,
    status,
  };
}

describe('useHostBroadcastPreflightController lifecycle', () => {
  test('creates, prepares, goes live, retains publishing, and navigates to the live session', () => {
    const harness = createHarness();

    harness.lifecycle.handleCreateSessionPress();
    expect(harness.startCommits).toHaveLength(1);
    expect(harness.startCommits[0].variables.input.visibility).toBe('PUBLIC');

    harness.completeStartSession();
    expect(harness.sessionState).toMatchObject({
      liveSessionId: 'live-session-id',
      status: 'starting',
    });

    harness.lifecycle.handlePrepareMediaPress();
    expect(harness.prepareCommits).toHaveLength(1);
    expect(harness.prepareCommits[0].variables.input.liveSessionId).toBe(
      'live-session-id',
    );

    harness.completePrepareMedia();
    harness.markBackendMediaReady();
    expect(harness.preparedMedia?.liveSessionId).toBe('live-session-id');

    harness.lifecycle.handleGoLivePress();
    expect(harness.goLiveCommits).toHaveLength(1);
    expect(harness.isGoingLive).toBe(true);

    harness.goLiveCommits[0].onCompleted?.(createGoLivePayload('live-session-id'));

    expect(harness.retainedLiveSessionIds).toEqual(['live-session-id']);
    expect(harness.navigatedLiveSessionIds).toEqual(['live-session-id']);
    expect(harness.endCommits).toEqual([]);
    expect(harness.isGoingLive).toBe(false);
  });

  test('ends the backend session without navigation when go-live cannot retain publishing', () => {
    const harness = createHarness();

    harness.prepareStartedSession();
    harness.setCanRetainPublishingResource(false);

    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createGoLivePayload('live-session-id'));

    expect(harness.retainedLiveSessionIds).toEqual([]);
    expect(harness.navigatedLiveSessionIds).toEqual([]);
    expect(harness.navigateBackCalls).toEqual([]);
    expect(harness.endCommits).toHaveLength(1);
    expect(harness.endCommits[0].variables.input.liveSessionId).toBe(
      'live-session-id',
    );
    expect(harness.sessionState.status).toBe('ending');
    expect(harness.preparedMedia).toBeNull();
    expect(harness.publishingStatus).toBe('errored');
  });

  test('keeps prepared media when go-live returns retryable media readiness errors', () => {
    const harness = createHarness();

    harness.prepareStartedSession();
    const preparedBeforeGoLive = harness.preparedMedia;

    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createRetryableGoLivePayload());

    expect(harness.preparedMedia).toBe(preparedBeforeGoLive);
    expect(harness.backendMediaReady).toBe(true);
    expect(harness.publishingStatus).toBe('ready');
    expect(harness.hostActionError).toBe(
      'Media negotiation is not ready yet. Prepare media and try again.',
    );
    expect(harness.retainedLiveSessionIds).toEqual([]);
    expect(harness.endCommits).toEqual([]);
    expect(harness.isGoingLive).toBe(false);
  });

  test('requests abandoned cleanup when unmounted after a start succeeds', () => {
    const harness = createHarness();

    harness.lifecycle.handleCreateSessionPress();
    harness.completeStartSession();
    harness.lifecycle.unmount();

    expect(harness.endCommits).toHaveLength(1);
    expect(harness.endCommits[0].variables.input.liveSessionId).toBe(
      'live-session-id',
    );
    expect(harness.navigateBackCalls).toEqual([]);
    expect(harness.navigatedLiveSessionIds).toEqual([]);
    expect(harness.disposedNativeCount).toBe(1);
  });
});

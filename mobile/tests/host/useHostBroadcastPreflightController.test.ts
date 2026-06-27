import { describe, expect, test } from 'bun:test';

import type { HostBroadcastMediaPreparation } from '../../src/host/hostBroadcastMediaSignaling';
import {
  INITIAL_HOST_BROADCAST_PREFLIGHT_WORKFLOW_STATE,
  type HostBroadcastPreflightWorkflowViewState,
} from '../../src/host/preflight/state/hostBroadcastPreflightMachine';
import type { HostBroadcastPublishingResource } from '../../src/host/publishing/hostBroadcastPublishingSessionStore';
import type { HostBroadcastPublishingStatus } from '../../src/host/preflight/hooks/useHostBroadcastPublishingController';
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

function createHarness() {
  const endCommits: EndLiveSessionCommitConfig[] = [];
  const goLiveCommits: GoLiveCommitConfig[] = [];
  const navigateBackCalls: string[] = [];
  const navigatedLiveSessionIds: string[] = [];
  const prepareCommits: PrepareMediaCommitConfig[] = [];
  const retainedLiveSessionIds: string[] = [];
  const startCommits: StartLiveSessionCommitConfig[] = [];
  let canRetainPublishingResource = true;
  let disposedNativeCount = 0;
  let preparedMedia: HostBroadcastMediaPreparation | null = null;
  let publishingStatus: HostBroadcastPublishingStatus = 'idle';
  let retainedResource: HostBroadcastPublishingResource | null = null;
  let workflowState: HostBroadcastPreflightWorkflowViewState =
    INITIAL_HOST_BROADCAST_PREFLIGHT_WORKFLOW_STATE;
  let lifecycle: HostBroadcastPreflightControllerLifecycle;

  lifecycle = createHostBroadcastPreflightControllerLifecycle({
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
    disposeNative: () => {
      disposedNativeCount += 1;
    },
    failPreparedPublishing: (reason) => {
      preparedMedia = null;
      publishingStatus = 'errored';
      lifecycle.sendWorkflowEvent({
        type: 'PUBLISHING_FAILED',
        viewerSafeErrorText: reason,
      });
    },
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
    },
    retainAttachedPublishingForLiveSession: (liveSessionId) => {
      if (!canRetainPublishingResource) {
        return null;
      }

      retainedLiveSessionIds.push(liveSessionId);
      retainedResource = createPublishingResource();
      return retainedResource;
    },
    onWorkflowStateChanged: (nextState) => {
      workflowState = nextState;
    },
    setPreparedMedia: (next) => {
      preparedMedia = next;
    },
  });

  markNativeReady();

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

  function markNativeReady() {
    lifecycle.sendWorkflowEvent({
      permission: 'camera',
      state: 'granted',
      type: 'PERMISSION_CHANGED',
    });
    lifecycle.sendWorkflowEvent({
      permission: 'microphone',
      state: 'granted',
      type: 'PERMISSION_CHANGED',
    });
    lifecycle.sendWorkflowEvent({
      ready: true,
      type: 'NATIVE_MEDIA_CHANGED',
    });
  }

  function markBackendMediaReady() {
    publishingStatus = 'ready';
    lifecycle.sendWorkflowEvent({
      ready: true,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });
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
      return workflowState.preflightState.backendMediaContractReady;
    },
    get disposedNativeCount() {
      return disposedNativeCount;
    },
    get hostActionError() {
      return workflowState.errorMessage;
    },
    get isGoingLive() {
      return workflowState.isGoingLive;
    },
    get preparedMedia() {
      return preparedMedia;
    },
    get publishingStatus() {
      return publishingStatus;
    },
    get sessionState() {
      return workflowState.sessionState;
    },
    get workflowState() {
      return workflowState;
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

function createNonRetryableGoLivePayload(): GoLivePayload {
  return {
    goLiveSession: {
      errors: [{ message: 'not_authorized' }],
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

  test('ignores back presses after go-live succeeds', () => {
    const harness = createHarness();

    harness.prepareStartedSession();
    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createGoLivePayload('live-session-id'));
    harness.lifecycle.handleBackPress();

    expect(harness.navigatedLiveSessionIds).toEqual(['live-session-id']);
    expect(harness.navigateBackCalls).toEqual([]);
    expect(harness.endCommits).toEqual([]);
    expect(harness.workflowState).toMatchObject({
      canUseBackAction: false,
      status: 'live',
    });
  });

  test('allows non-lifecycle backend end requests after go-live succeeds', () => {
    const harness = createHarness();

    harness.prepareStartedSession();
    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createGoLivePayload('live-session-id'));
    harness.lifecycle.requestPreflightEndLiveSession('live-session-id');

    expect(harness.endCommits).toHaveLength(1);
    expect(harness.endCommits[0].variables.input.liveSessionId).toBe(
      'live-session-id',
    );
    expect(harness.workflowState).toMatchObject({
      status: 'live',
      sessionState: {
        liveSessionId: 'live-session-id',
        status: 'starting',
      },
    });
    expect(harness.navigateBackCalls).toEqual([]);
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

  test('clears prepared media when go-live returns non-retryable errors', () => {
    const harness = createHarness();

    harness.prepareStartedSession();

    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createNonRetryableGoLivePayload());

    expect(harness.preparedMedia).toBeNull();
    expect(harness.backendMediaReady).toBe(false);
    expect(harness.publishingStatus).toBe('idle');
    expect(harness.hostActionError).toBe(
      'This live session is not available to your account.',
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

  test('does not dispose native resources on unmount when publishing is retained', () => {
    const harness = createHarness();

    harness.prepareStartedSession();
    harness.lifecycle.handleGoLivePress();
    harness.goLiveCommits[0].onCompleted?.(createGoLivePayload('live-session-id'));
    harness.lifecycle.unmount();

    expect(harness.retainedLiveSessionIds).toEqual(['live-session-id']);
    expect(harness.disposedNativeCount).toBe(0);
    expect(harness.endCommits).toEqual([]);
  });

  test('ignores stale prepare-media completion after back cleanup starts', () => {
    const harness = createHarness();

    harness.lifecycle.handleCreateSessionPress();
    harness.completeStartSession();
    harness.lifecycle.handlePrepareMediaPress();
    harness.lifecycle.handleBackPress();

    expect(harness.workflowState).toMatchObject({
      status: 'ending',
    });
    expect(harness.endCommits).toHaveLength(1);

    harness.completePrepareMedia();

    expect(harness.preparedMedia).toBeNull();
    expect(harness.publishingStatus).toBe('idle');
    expect(harness.workflowState).toMatchObject({
      status: 'ending',
      hasPreparedMedia: false,
    });
  });

  test('routes navigation removal through end cleanup before continuing', () => {
    const harness = createHarness();
    const continuedActions: string[] = [];

    harness.lifecycle.handleCreateSessionPress();
    harness.completeStartSession();

    expect(harness.lifecycle.shouldPreventNavigationRemoval()).toBe(true);

    harness.lifecycle.handleNavigationRemovalAttempt(() => {
      continuedActions.push('continue');
    });

    expect(harness.navigateBackCalls).toEqual([]);
    expect(harness.endCommits).toHaveLength(1);
    expect(continuedActions).toEqual([]);

    harness.endCommits[0].onCompleted?.({
      endLiveSession: {
        errors: [],
        liveSession: createLiveSessionPayload('live-session-id', 'STARTING'),
      },
    });

    expect(continuedActions).toEqual(['continue']);
  });
});

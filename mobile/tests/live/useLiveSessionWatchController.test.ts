import { describe, expect, test } from 'bun:test';

import {
  createLiveSessionWatchControllerLifecycle,
  type LiveSessionWatchControllerLifecycle,
} from '../../src/live/watch/hooks/useLiveSessionWatchController';

type MutationConfig<TPayload> = {
  readonly onCompleted?: (payload: TPayload) => void;
  readonly onError?: () => void;
  readonly variables: {
    readonly input: {
      readonly liveSessionId: string;
    };
  };
};

type JoinPayload = {
  readonly joinLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null;
      readonly message: string;
    }>;
    readonly liveSession: { readonly id: string } | null;
  } | null;
};

type LeavePayload = {
  readonly leaveLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null;
      readonly message: string;
    }>;
    readonly left: boolean;
  } | null;
};

type EndPayload = {
  readonly endLiveSession: {
    readonly errors: ReadonlyArray<{
      readonly field: string | null;
      readonly message: string;
    }>;
    readonly liveSession: { readonly id: string } | null;
  } | null;
};

function createHarness() {
  const joins: MutationConfig<JoinPayload>[] = [];
  const leaves: MutationConfig<LeavePayload>[] = [];
  const ends: MutationConfig<EndPayload>[] = [];
  const releasedHostPublishingSessions: string[] = [];
  const stopPlaybackCalls: Array<{ readonly resetState: boolean }> = [];
  const closedChatSessions: string[] = [];
  const stateHistory: ReturnType<
    LiveSessionWatchControllerLifecycle['getState']
  >[] = [];
  const controller = createLiveSessionWatchControllerLifecycle({
    commitEndLiveSession: (config) => {
      ends.push(config as MutationConfig<EndPayload>);
    },
    commitJoinLiveSession: (config) => {
      joins.push(config as MutationConfig<JoinPayload>);
    },
    commitLeaveLiveSession: (config) => {
      leaves.push(config as MutationConfig<LeavePayload>);
    },
    releaseRetainedHostPublishingSession: (sessionId) => {
      releasedHostPublishingSessions.push(sessionId);
    },
    onStateChanged: (state) => {
      stateHistory.push(state);
    },
    stopViewerPlayback: (options) => {
      stopPlaybackCalls.push(options);
    },
  });

  controller.syncSession('session-1');

  function completeJoin(
    index = joins.length - 1,
    payload: JoinPayload = {
      joinLiveSession: {
        errors: [],
        liveSession: { id: joins[index].variables.input.liveSessionId },
      },
    },
  ) {
    joins[index]?.onCompleted?.(payload);
  }

  function completeLeave(
    index = leaves.length - 1,
    payload: LeavePayload = {
      leaveLiveSession: {
        errors: [],
        left: true,
      },
    },
  ) {
    leaves[index]?.onCompleted?.(payload);
  }

  function completeEnd(
    index = ends.length - 1,
    payload: EndPayload = {
      endLiveSession: {
        errors: [],
        liveSession: { id: ends[index].variables.input.liveSessionId },
      },
    },
  ) {
    ends[index]?.onCompleted?.(payload);
  }

  function join(
    controllerOverride: LiveSessionWatchControllerLifecycle = controller,
  ) {
    controllerOverride.requestJoin({
      enterable: true,
      isCurrentViewerHost: false,
      liveSessionId: 'session-1',
    });
  }

  return {
    closedChatSessions,
    completeEnd,
    completeJoin,
    completeLeave,
    controller,
    ends,
    joins,
    leaves,
    releasedHostPublishingSessions,
    stateHistory,
    stopPlaybackCalls,
    join,
  };
}

describe('useLiveSessionWatchController lifecycle', () => {
  test('prevents duplicate join commits before same-render state can update', () => {
    const harness = createHarness();

    harness.join();
    harness.join();

    expect(harness.joins).toHaveLength(1);
    expect(harness.controller.getState()).toMatchObject({
      error: null,
      hasActiveSubmission: true,
      isJoined: false,
      isJoining: true,
    });
  });

  test('detached-leaves stale successful join after the active session changes', () => {
    const harness = createHarness();

    harness.join();
    harness.controller.syncSession('session-2');
    harness.completeJoin(0);

    expect(harness.controller.getState('session-2')).toMatchObject({
      error: null,
      hasActiveSubmission: false,
      isJoined: false,
      isJoining: false,
    });
    expect(harness.leaves).toHaveLength(1);
    expect(harness.leaves[0].variables.input.liveSessionId).toBe('session-1');
  });

  test('leaves detached when join completes after unmount', () => {
    const harness = createHarness();

    harness.join();
    harness.controller.unmount();
    harness.completeJoin();
    harness.completeJoin();

    expect(harness.leaves).toHaveLength(1);
    expect(harness.leaves[0].variables.input.liveSessionId).toBe('session-1');
  });

  test('reactivates after effect cleanup so later join completion publishes state', () => {
    const harness = createHarness();

    harness.controller.unmount();
    harness.controller.mount();
    harness.join();
    harness.completeJoin();

    expect(harness.leaves).toHaveLength(0);
    expect(harness.controller.getState()).toMatchObject({
      hasActiveSubmission: false,
      isJoined: true,
      isJoining: false,
    });
    expect(harness.stateHistory.at(-1)).toMatchObject({
      hasActiveSubmission: false,
      isJoined: true,
      isJoining: false,
    });
  });

  test('keeps joined cleanup retry semantics after leave fails', () => {
    const harness = createHarness();

    harness.join();
    harness.completeJoin();
    harness.controller.requestLeave({ liveSessionId: 'session-1' });
    harness.completeLeave(0, {
      leaveLiveSession: {
        errors: [],
        left: false,
      },
    });

    expect(harness.stopPlaybackCalls).toEqual([{ resetState: true }]);
    expect(harness.controller.getState()).toMatchObject({
      error:
        'We could not update this live session. Check your connection and try again.',
      hasActiveSubmission: false,
      isJoined: true,
      isLeaving: false,
    });

    harness.controller.unmount();

    expect(harness.leaves).toHaveLength(2);
    expect(harness.leaves[1].variables.input.liveSessionId).toBe('session-1');
  });

  test('does not publish leave completion state after unmount', () => {
    const successHarness = createHarness();

    successHarness.join();
    successHarness.completeJoin();
    successHarness.controller.requestLeave({ liveSessionId: 'session-1' });
    const successStateCountBeforeUnmount = successHarness.stateHistory.length;

    successHarness.controller.unmount();
    successHarness.completeLeave();

    expect(successHarness.stateHistory).toHaveLength(
      successStateCountBeforeUnmount,
    );

    const failureHarness = createHarness();

    failureHarness.join();
    failureHarness.completeJoin();
    failureHarness.controller.requestLeave({ liveSessionId: 'session-1' });
    const failureStateCountBeforeUnmount = failureHarness.stateHistory.length;

    failureHarness.controller.unmount();
    failureHarness.leaves[0].onError?.();

    expect(failureHarness.stateHistory).toHaveLength(
      failureStateCountBeforeUnmount,
    );
  });

  test('detached-leaves again when a pending leave fails after unmount', () => {
    const falseCompletionHarness = createHarness();

    falseCompletionHarness.join();
    falseCompletionHarness.completeJoin();
    falseCompletionHarness.controller.requestLeave({ liveSessionId: 'session-1' });
    falseCompletionHarness.controller.unmount();
    falseCompletionHarness.completeLeave(0, {
      leaveLiveSession: {
        errors: [],
        left: false,
      },
    });

    expect(falseCompletionHarness.leaves).toHaveLength(2);
    expect(falseCompletionHarness.leaves[1].variables.input.liveSessionId).toBe(
      'session-1',
    );

    const errorHarness = createHarness();

    errorHarness.join();
    errorHarness.completeJoin();
    errorHarness.controller.requestLeave({ liveSessionId: 'session-1' });
    errorHarness.controller.unmount();
    errorHarness.leaves[0].onError?.();

    expect(errorHarness.leaves).toHaveLength(2);
    expect(errorHarness.leaves[1].variables.input.liveSessionId).toBe(
      'session-1',
    );
  });

  test('end success releases retained host publishing resources and stops playback', () => {
    const harness = createHarness();

    harness.join();
    harness.completeJoin();
    harness.controller.requestEnd({
      canEndLiveSession: true,
      liveSessionId: 'session-1',
    });
    harness.completeEnd();

    expect(harness.releasedHostPublishingSessions).toEqual(['session-1']);
    expect(harness.stopPlaybackCalls).toEqual([{ resetState: true }]);
    expect(harness.controller.getState()).toMatchObject({
      hasActiveSubmission: false,
      isEnding: false,
      isJoined: false,
    });
  });

  test('ended-session events release resources, stop playback, close chat, and suppress detached leave', () => {
    const harness = createHarness();

    harness.join();
    harness.completeJoin();
    harness.controller.handleSessionEnded('session-1', () => {
      harness.closedChatSessions.push('session-1');
    });
    harness.controller.unmount();

    expect(harness.releasedHostPublishingSessions).toEqual(['session-1']);
    expect(harness.stopPlaybackCalls).toEqual([
      { resetState: true },
      { resetState: false },
    ]);
    expect(harness.closedChatSessions).toEqual(['session-1']);
    expect(harness.leaves).toHaveLength(0);
  });

  test('ignores stale teardown side effects from previous sessions', () => {
    const harness = createHarness();

    harness.controller.syncSession('session-2');
    harness.controller.handleMembershipLost('session-1');
    harness.controller.handleSessionEnded('session-1', () => {
      harness.closedChatSessions.push('session-1');
    });

    expect(harness.releasedHostPublishingSessions).toEqual(['session-1']);
    expect(harness.stopPlaybackCalls).toEqual([]);
    expect(harness.closedChatSessions).toEqual([]);
    expect(harness.controller.getState('session-2')).toMatchObject({
      hasActiveSubmission: false,
      isJoined: false,
    });
  });
});

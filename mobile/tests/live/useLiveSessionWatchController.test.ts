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

  test('ignores stale mutation completion after the active session changes', () => {
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
    expect(harness.leaves).toHaveLength(0);
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
});

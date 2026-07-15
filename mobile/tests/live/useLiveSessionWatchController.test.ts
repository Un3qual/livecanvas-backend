import { describe, expect, test } from 'vitest';

import {
  createLiveSessionOlderTimelinePageLoader,
  createLiveSessionWatchControllerLifecycle,
  type LiveSessionWatchControllerLifecycle,
} from '../../src/live/watch/hooks/useLiveSessionWatchController';
import type { LiveSessionTimelineHistory } from '../../src/live/liveSessionTimelineHistory';

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

type OlderTimelinePageLoaderState = {
  readonly error: string | null;
  readonly isLoading: boolean;
};

type OlderTimelinePageLoadRequest = {
  readonly canLoadOlder: boolean;
  readonly liveSessionId: string;
  readonly timelineBefore: string | null;
  readonly timelineLast: number;
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
    expect(harness.controller.getState()).toMatchObject({
      hasActiveSubmission: false,
      isJoined: false,
      isLeaving: false,
    });
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

describe('older retained timeline page loading', () => {
  test('loads older timeline pages with the current Relay session ID and before cursor', async () => {
    const history = retainedHistory(['event-older'], {
      endCursor: 'cursor-event-older',
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: 'cursor-event-older',
    });
    const requests: Omit<OlderTimelinePageLoadRequest, 'canLoadOlder'>[] = [];
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const states: OlderTimelinePageLoaderState[] = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: (request) => {
        requests.push(request);
        return Promise.resolve(history);
      },
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
      onStateChanged: (state) => {
        states.push(state);
      },
    });

    loader.syncSession('relay-live-session-id:opaque');
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'relay-live-session-id:opaque',
      timelineBefore: 'cursor-current-start',
      timelineLast: 30,
    });
    await Promise.resolve();

    expect(requests).toEqual([
      {
        liveSessionId: 'relay-live-session-id:opaque',
        timelineBefore: 'cursor-current-start',
        timelineLast: 30,
      },
    ]);
    expect(loadedPages).toEqual([
      {
        history,
        sessionId: 'relay-live-session-id:opaque',
      },
    ]);
    expect(states).toEqual([
      { error: null, isLoading: false },
      { error: null, isLoading: true },
      { error: null, isLoading: false },
    ]);
  });

  test('ignores stale older-page responses after the active session changes', async () => {
    const deferred = createDeferred<LiveSessionTimelineHistory | null>();
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const states: OlderTimelinePageLoaderState[] = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: () => deferred.promise,
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
      onStateChanged: (state) => {
        states.push(state);
      },
    });

    loader.syncSession('session-1');
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-session-1',
      timelineLast: 30,
    });
    loader.syncSession('session-2');
    deferred.resolve(
      retainedHistory(['event-stale'], {
        endCursor: 'cursor-event-stale',
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: 'cursor-event-stale',
      }),
    );
    await deferred.promise;
    await Promise.resolve();

    expect(loadedPages).toEqual([]);
    expect(loader.getState()).toEqual({ error: null, isLoading: false });
    expect(states.at(-1)).toEqual({ error: null, isLoading: false });
  });

  test('resets loading state when unmount abandons an older-page request', async () => {
    const abandonedRequest = createDeferred<LiveSessionTimelineHistory | null>();
    const remountedHistory = retainedHistory(['event-after-abandon'], {
      endCursor: 'cursor-event-after-abandon',
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: 'cursor-event-after-abandon',
    });
    const requests: Omit<OlderTimelinePageLoadRequest, 'canLoadOlder'>[] = [];
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: (request) => {
        requests.push(request);
        return requests.length === 1
          ? abandonedRequest.promise
          : Promise.resolve(remountedHistory);
      },
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
    });

    loader.syncSession('session-1');
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-before-abandon',
      timelineLast: 30,
    });
    loader.unmount();
    loader.mount();
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-after-remount',
      timelineLast: 30,
    });
    await flushPromises();

    abandonedRequest.resolve(
      retainedHistory(['event-abandoned'], {
        endCursor: 'cursor-event-abandoned',
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: 'cursor-event-abandoned',
      }),
    );
    await abandonedRequest.promise;
    await flushPromises();

    expect(requests).toEqual([
      {
        liveSessionId: 'session-1',
        timelineBefore: 'cursor-before-abandon',
        timelineLast: 30,
      },
      {
        liveSessionId: 'session-1',
        timelineBefore: 'cursor-after-remount',
        timelineLast: 30,
      },
    ]);
    expect(loadedPages).toEqual([
      { history: remountedHistory, sessionId: 'session-1' },
    ]);
    expect(loader.getState()).toEqual({ error: null, isLoading: false });
  });

  test('keeps existing rows untouched and exposes a viewer-safe retry error when older load fails', async () => {
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: () =>
        Promise.reject(new Error('database exploded')),
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
    });

    loader.syncSession('session-1');
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-session-1',
      timelineLast: 30,
    });
    await flushPromises();

    expect(loadedPages).toEqual([]);
    expect(loader.getState()).toEqual({
      error:
        'We could not load older messages. Check your connection and try again.',
      isLoading: false,
    });
  });

  test('exposes the viewer-safe retry error when older load returns no history', async () => {
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: () => Promise.resolve(null),
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
    });

    loader.syncSession('session-1');
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-session-1',
      timelineLast: 30,
    });
    await flushPromises();

    expect(loadedPages).toEqual([]);
    expect(loader.getState()).toEqual({
      error:
        'We could not load older messages. Check your connection and try again.',
      isLoading: false,
    });
  });

  test('does not request older pages when unavailable, missing a cursor, or already loading', async () => {
    const loadingRequest = createDeferred<LiveSessionTimelineHistory | null>();
    const requests: Omit<OlderTimelinePageLoadRequest, 'canLoadOlder'>[] = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: (request) => {
        requests.push(request);
        return loadingRequest.promise;
      },
      onOlderTimelinePageLoaded: () => undefined,
    });

    loader.syncSession('session-1');
    loader.requestOlderPage({
      canLoadOlder: false,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-unavailable',
      timelineLast: 30,
    });
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: null,
      timelineLast: 30,
    });
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-loading',
      timelineLast: 30,
    });
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-while-loading',
      timelineLast: 30,
    });

    expect(requests).toEqual([
      {
        liveSessionId: 'session-1',
        timelineBefore: 'cursor-loading',
        timelineLast: 30,
      },
    ]);

    loadingRequest.resolve(
      retainedHistory(['event-loading'], {
        endCursor: 'cursor-event-loading',
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: 'cursor-event-loading',
      }),
    );
    await loadingRequest.promise;
    await flushPromises();

    expect(loader.getState()).toEqual({ error: null, isLoading: false });
  });

  test('reactivates after unmount so a remounted loader can load older pages', async () => {
    const history = retainedHistory(['event-after-remount'], {
      endCursor: 'cursor-event-after-remount',
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: 'cursor-event-after-remount',
    });
    const loadedPages: Array<{
      readonly history: LiveSessionTimelineHistory;
      readonly sessionId: string;
    }> = [];
    const states: OlderTimelinePageLoaderState[] = [];
    const loader = createLiveSessionOlderTimelinePageLoader({
      fetchOlderTimelinePage: () => Promise.resolve(history),
      onOlderTimelinePageLoaded: (loaded) => {
        loadedPages.push(loaded);
      },
      onStateChanged: (state) => {
        states.push(state);
      },
    });

    loader.syncSession('session-1');
    loader.unmount();
    loader.mount();
    loader.requestOlderPage({
      canLoadOlder: true,
      liveSessionId: 'session-1',
      timelineBefore: 'cursor-current-start',
      timelineLast: 30,
    });
    await Promise.resolve();

    expect(loadedPages).toEqual([{ history, sessionId: 'session-1' }]);
    expect(loader.getState()).toEqual({ error: null, isLoading: false });
    expect(states.at(-1)).toEqual({ error: null, isLoading: false });
  });
});

function retainedHistory(
  eventIds: ReadonlyArray<string>,
  pageInfo: NonNullable<LiveSessionTimelineHistory['pageInfo']>,
): LiveSessionTimelineHistory {
  return {
    pageInfo,
    rows: eventIds.map((eventId) => ({
      __typename: 'ChatMessageEvent',
      actor: { id: `actor-${eventId}` },
      body: `body ${eventId}`,
      cursor: `cursor-${eventId}`,
      editCount: 0,
      edited: false,
      editedAt: null,
      eventType: 'CHAT_MESSAGE_SENT',
      id: eventId,
      kind: 'chat_message',
      occurredAt: '2026-06-04T17:00:00.000000Z',
    })),
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: T) => void;
} {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

# Mobile XState Live Workflow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring XState into the mobile app for complex live broadcast workflows so large screens stop hand-rolling async state machines with scattered booleans, refs, reducer actions, and lifecycle guards.

**Architecture:** Keep Relay as the server-state layer and keep small component-local state in React. Use XState v5 only for feature-local workflows that have protocol-like state transitions: viewer watch membership, viewer playback, chat channel/send lifecycle, and host preflight/go-live orchestration. Keep all Relay mutations, Phoenix channels, WebRTC runtime creation, auth token access, and navigation as injected services or hook-owned adapters so machines own state transitions without becoming IO modules.

**Tech Stack:** Expo Router, React Native, TypeScript strict mode, Relay, Phoenix Channels, react-native-webrtc, XState v5, `@xstate/react`, Bun tests, pnpm.

---

## Activation Note

The current mobile lane remains pointed at release-candidate QA in `docs/plans/mobile/NOW.md`. Do not activate this plan as the lane current batch until that QA pass is completed, explicitly superseded, or a live workflow refactor is promoted as the next mobile batch.

## State Library Decision

Use XState for the large live/host workflow screens. Do not introduce Redux Toolkit or a general Zustand store in this batch.

- Relay remains the only GraphQL/server cache.
- XState machines live under the feature that owns the workflow.
- Machines store serializable workflow state only: current state value, active session id, viewer-safe error text, pending command kind, playback status, channel/send status, and cleanup policy.
- Non-serializable resources stay outside machine context: Relay commit functions, Phoenix socket/channel clients, WebRTC peer connections, media streams, and navigation/router objects.
- Use `setup(...)` for typed machines and `@xstate/react` hooks at React integration points.
- Use actor snapshots for same-tick command guards. Event handlers that must close double-tap gaps read `actorRef.getSnapshot()` before sending a command event.
- Do not use XState persistence, global actor context, or Stately Studio in this batch.

## Target Folder Shape

- `mobile/src/live/watch/state/liveSessionWatchMachine.ts`
  Viewer membership/end workflow state and selectors.
- `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
  Viewer playback status state and selectors.
- `mobile/src/live/watch/hooks/useLiveSessionWatchController.ts`
  Relay mutation orchestration for join/leave/end around the watch machine.
- `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
  Existing playback side-effect controller updated to publish state through the playback machine.
- `mobile/src/live/chat/state/liveSessionChatChannelMachine.ts`
  Chat channel connection and send status state only; timeline rows stay in the existing chat reducer modules.
- `mobile/src/host/preflight/state/hostBroadcastPreflightMachine.ts`
  Host create/prepare/go-live/end workflow state and selectors.
- `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
  Existing host preflight controller updated to send machine events instead of holding several independent local booleans.
- `mobile/tests/live/liveSessionWatchMachine.test.ts`
- `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`
- `mobile/tests/live/liveSessionChatChannelMachine.test.ts`
- `mobile/tests/host/hostBroadcastPreflightMachine.test.ts`
- Existing controller tests stay under `mobile/tests/live/**` and `mobile/tests/host/**`.

## Implementation Rules

- Prefer one machine per workflow, not one global live app machine.
- Prefer selectors named after UI needs: `selectIsJoined`, `selectVisibleSubmission`, `selectCanRequestJoin`, `selectShouldAutoLeaveOnUnmount`.
- Preserve existing user-visible copy from `formatLiveMutationErrors` and current screen cards.
- Do not move timeline event collections into XState. They are append/merge data structures, not workflow states.
- Do not put WebRTC peer connections, sockets, channels, or media streams in machine context.
- Keep old reducer files only until consumers are migrated. Delete unused reducers in the cleanup task rather than leaving facade exports.
- New tests belong under `mobile/tests/**`.

## Task 1: Add XState Dependencies And Conventions

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/pnpm-lock.yaml`
- Test: `mobile/tests/live/liveSessionWatchMachine.test.ts`

- [ ] **Step 1: Add the runtime packages**

Run:

```bash
cd mobile
pnpm add xstate @xstate/react
```

Expected: `mobile/package.json` has `xstate` and `@xstate/react` under `dependencies`, and `mobile/pnpm-lock.yaml` is updated.

- [ ] **Step 2: Verify the dependency install did not disturb the current suite**

Run:

```bash
cd mobile
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add mobile/package.json mobile/pnpm-lock.yaml
git commit -m "Add XState mobile dependencies"
```

## Task 2: Model Viewer Watch Membership With XState

**Files:**
- Create: `mobile/src/live/watch/state/liveSessionWatchMachine.ts`
- Create: `mobile/tests/live/liveSessionWatchMachine.test.ts`
- Modify: `mobile/tests/live/liveSessionWatchReducer.test.ts`

- [ ] **Step 1: Write failing machine tests for the existing watch reducer behavior**

Create `mobile/tests/live/liveSessionWatchMachine.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  liveSessionWatchMachine,
  selectCanRequestJoin,
  selectIsJoined,
  selectShouldAutoLeaveOnUnmount,
  selectVisibleError,
  selectVisibleSubmission,
} from '../../src/live/watch/state/liveSessionWatchMachine';

function createStartedActor() {
  const actor = createActor(liveSessionWatchMachine);
  actor.start();
  return actor;
}

describe('liveSessionWatchMachine', () => {
  test('tracks join request and success for the active session', () => {
    const actor = createStartedActor();

    actor.send({ type: 'session.changed', sessionId: 'session-1' });
    actor.send({ type: 'join.requested', sessionId: 'session-1' });

    expect(selectVisibleSubmission(actor.getSnapshot())).toBe('joining');
    expect(selectCanRequestJoin(actor.getSnapshot())).toBe(false);

    actor.send({ type: 'join.succeeded', sessionId: 'session-1' });

    expect(selectIsJoined(actor.getSnapshot())).toBe(true);
    expect(selectVisibleSubmission(actor.getSnapshot())).toBe('idle');
    expect(selectShouldAutoLeaveOnUnmount(actor.getSnapshot())).toBe(true);
  });

  test('ignores stale join completion from an older session', () => {
    const actor = createStartedActor();

    actor.send({ type: 'session.changed', sessionId: 'session-1' });
    actor.send({ type: 'join.requested', sessionId: 'session-1' });
    actor.send({ type: 'session.changed', sessionId: 'session-2' });
    actor.send({ type: 'join.succeeded', sessionId: 'session-1' });

    expect(selectIsJoined(actor.getSnapshot())).toBe(false);
    expect(selectVisibleSubmission(actor.getSnapshot())).toBe('idle');
  });

  test('leave failure keeps joined state so cleanup can be retried', () => {
    const actor = createStartedActor();

    actor.send({ type: 'session.changed', sessionId: 'session-1' });
    actor.send({ type: 'join.requested', sessionId: 'session-1' });
    actor.send({ type: 'join.succeeded', sessionId: 'session-1' });
    actor.send({ type: 'leave.requested', sessionId: 'session-1' });
    actor.send({
      error: 'We could not update this live session.',
      sessionId: 'session-1',
      type: 'leave.failed',
    });

    expect(selectIsJoined(actor.getSnapshot())).toBe(true);
    expect(selectVisibleError(actor.getSnapshot())).toBe(
      'We could not update this live session.',
    );
    expect(selectShouldAutoLeaveOnUnmount(actor.getSnapshot())).toBe(true);
  });

  test('ended session clears join state and disables auto-leave cleanup', () => {
    const actor = createStartedActor();

    actor.send({ type: 'session.changed', sessionId: 'session-1' });
    actor.send({ type: 'join.requested', sessionId: 'session-1' });
    actor.send({ type: 'join.succeeded', sessionId: 'session-1' });
    actor.send({ type: 'session.ended', sessionId: 'session-1' });

    expect(selectIsJoined(actor.getSnapshot())).toBe(false);
    expect(selectShouldAutoLeaveOnUnmount(actor.getSnapshot())).toBe(false);
  });
});
```

Run:

```bash
cd mobile
bun test tests/live/liveSessionWatchMachine.test.ts
```

Expected: FAIL because `mobile/src/live/watch/state/liveSessionWatchMachine.ts` does not exist.

- [ ] **Step 2: Implement the watch membership machine**

Create `mobile/src/live/watch/state/liveSessionWatchMachine.ts`:

```ts
import { assign, setup, type SnapshotFrom } from 'xstate';

export type LiveSessionWatchSubmission =
  | 'idle'
  | 'joining'
  | 'leaving'
  | 'ending';

export type LiveSessionWatchCommandKind = 'join' | 'leave' | 'end';

export type LiveSessionWatchContext = {
  readonly activeSessionId: string | null;
  readonly autoLeaveOnUnmount: boolean;
  readonly error: string | null;
  readonly pendingCommand: LiveSessionWatchCommandKind | null;
};

export type LiveSessionWatchEvent =
  | { readonly type: 'session.changed'; readonly sessionId: string }
  | { readonly type: 'join.requested'; readonly sessionId: string }
  | { readonly type: 'join.succeeded'; readonly sessionId: string }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'join.failed';
    }
  | { readonly type: 'leave.requested'; readonly sessionId: string }
  | { readonly type: 'leave.succeeded'; readonly sessionId: string }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'leave.failed';
    }
  | { readonly type: 'membership.lost'; readonly sessionId: string }
  | { readonly type: 'end.requested'; readonly sessionId: string }
  | { readonly type: 'end.succeeded'; readonly sessionId: string }
  | {
      readonly error: string;
      readonly sessionId: string;
      readonly type: 'end.failed';
    }
  | { readonly type: 'session.ended'; readonly sessionId: string };

const initialContext: LiveSessionWatchContext = {
  activeSessionId: null,
  autoLeaveOnUnmount: false,
  error: null,
  pendingCommand: null,
};

function eventSessionId(event: LiveSessionWatchEvent): string {
  return event.sessionId;
}

export const liveSessionWatchMachine = setup({
  types: {
    context: {} as LiveSessionWatchContext,
    events: {} as LiveSessionWatchEvent,
  },
  actions: {
    changeSession: assign({
      activeSessionId: ({ event }) => eventSessionId(event),
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => null,
    }),
    markJoinRequested: assign({
      activeSessionId: ({ event }) => eventSessionId(event),
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => 'join' as const,
    }),
    markJoinSucceeded: assign({
      autoLeaveOnUnmount: () => true,
      error: () => null,
      pendingCommand: () => null,
    }),
    markJoinFailed: assign({
      autoLeaveOnUnmount: () => false,
      error: ({ event }) =>
        event.type === 'join.failed' ? event.error : null,
      pendingCommand: () => null,
    }),
    markLeaveRequested: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => 'leave' as const,
    }),
    markLeaveSucceeded: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => null,
    }),
    markLeaveFailed: assign({
      autoLeaveOnUnmount: () => true,
      error: ({ event }) =>
        event.type === 'leave.failed' ? event.error : null,
      pendingCommand: () => null,
    }),
    markEndRequested: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => 'end' as const,
    }),
    markEndSucceeded: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => null,
    }),
    markEndFailed: assign({
      error: ({ event }) => (event.type === 'end.failed' ? event.error : null),
      pendingCommand: () => null,
    }),
    markMembershipLost: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => null,
    }),
    markSessionEnded: assign({
      autoLeaveOnUnmount: () => false,
      error: () => null,
      pendingCommand: () => null,
    }),
  },
  guards: {
    isCurrentSession: ({ context, event }) =>
      context.activeSessionId === eventSessionId(event),
  },
}).createMachine({
  id: 'liveSessionWatch',
  context: initialContext,
  initial: 'notJoined',
  on: {
    'session.changed': {
      actions: 'changeSession',
      target: '.notJoined',
    },
  },
  states: {
    notJoined: {
      on: {
        'end.requested': {
          actions: 'markEndRequested',
          target: 'ending',
        },
        'join.requested': {
          actions: 'markJoinRequested',
          target: 'joining',
        },
        'session.ended': {
          guard: 'isCurrentSession',
          actions: 'markSessionEnded',
        },
      },
    },
    joining: {
      on: {
        'join.failed': {
          guard: 'isCurrentSession',
          actions: 'markJoinFailed',
          target: 'notJoined',
        },
        'join.succeeded': {
          guard: 'isCurrentSession',
          actions: 'markJoinSucceeded',
          target: 'joined',
        },
        'session.ended': {
          guard: 'isCurrentSession',
          actions: 'markSessionEnded',
          target: 'notJoined',
        },
      },
    },
    joined: {
      on: {
        'end.requested': {
          guard: 'isCurrentSession',
          actions: 'markEndRequested',
          target: 'ending',
        },
        'leave.requested': {
          guard: 'isCurrentSession',
          actions: 'markLeaveRequested',
          target: 'leaving',
        },
        'membership.lost': {
          guard: 'isCurrentSession',
          actions: 'markMembershipLost',
          target: 'notJoined',
        },
        'session.ended': {
          guard: 'isCurrentSession',
          actions: 'markSessionEnded',
          target: 'notJoined',
        },
      },
    },
    leaving: {
      on: {
        'leave.failed': {
          guard: 'isCurrentSession',
          actions: 'markLeaveFailed',
          target: 'joined',
        },
        'leave.succeeded': {
          guard: 'isCurrentSession',
          actions: 'markLeaveSucceeded',
          target: 'notJoined',
        },
        'membership.lost': {
          guard: 'isCurrentSession',
          actions: 'markMembershipLost',
          target: 'notJoined',
        },
        'session.ended': {
          guard: 'isCurrentSession',
          actions: 'markSessionEnded',
          target: 'notJoined',
        },
      },
    },
    ending: {
      on: {
        'end.failed': {
          guard: 'isCurrentSession',
          actions: 'markEndFailed',
          target: 'notJoined',
        },
        'end.succeeded': {
          guard: 'isCurrentSession',
          actions: 'markEndSucceeded',
          target: 'notJoined',
        },
        'session.ended': {
          guard: 'isCurrentSession',
          actions: 'markSessionEnded',
          target: 'notJoined',
        },
      },
    },
  },
});

export type LiveSessionWatchSnapshot = SnapshotFrom<
  typeof liveSessionWatchMachine
>;

export function selectIsJoined(snapshot: LiveSessionWatchSnapshot): boolean {
  return snapshot.matches('joined') || snapshot.matches('leaving');
}

export function selectVisibleSubmission(
  snapshot: LiveSessionWatchSnapshot,
): LiveSessionWatchSubmission {
  if (snapshot.matches('joining')) {
    return 'joining';
  }

  if (snapshot.matches('leaving')) {
    return 'leaving';
  }

  if (snapshot.matches('ending')) {
    return 'ending';
  }

  return 'idle';
}

export function selectVisibleError(
  snapshot: LiveSessionWatchSnapshot,
): string | null {
  return snapshot.context.error;
}

export function selectCanRequestJoin(
  snapshot: LiveSessionWatchSnapshot,
): boolean {
  return snapshot.matches('notJoined') && snapshot.context.pendingCommand === null;
}

export function selectShouldAutoLeaveOnUnmount(
  snapshot: LiveSessionWatchSnapshot,
): boolean {
  return selectIsJoined(snapshot) && snapshot.context.autoLeaveOnUnmount;
}
```

- [ ] **Step 3: Run the new machine tests**

Run:

```bash
cd mobile
bun test tests/live/liveSessionWatchMachine.test.ts
```

Expected: PASS.

- [ ] **Step 4: Keep reducer coverage until the screen migration lands**

Run:

```bash
cd mobile
bun test tests/live/liveSessionWatchReducer.test.ts tests/live/liveSessionWatchMachine.test.ts
```

Expected: PASS. Keep both suites for this task so reducer and machine semantics can be compared during migration.

- [ ] **Step 5: Commit**

Run:

```bash
git add mobile/src/live/watch/state/liveSessionWatchMachine.ts mobile/tests/live/liveSessionWatchMachine.test.ts
git commit -m "Add live session watch state machine"
```

## Task 3: Move Join Leave End Orchestration Into A Watch Controller Hook

**Files:**
- Create: `mobile/src/live/watch/hooks/useLiveSessionWatchController.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/tests/live/liveSessionWatchMachine.test.ts`
- Modify: `mobile/tests/live/liveSessionWatchReducer.test.ts`
- Test: `mobile/tests/live/LiveDiscoveryScreen.test.ts`

- [ ] **Step 1: Expand watch machine tests for same-tick command guards**

Add this test to `mobile/tests/live/liveSessionWatchMachine.test.ts`:

```ts
test('exposes pending command state for same-tick submit guards', () => {
  const actor = createStartedActor();

  actor.send({ type: 'session.changed', sessionId: 'session-1' });

  expect(selectCanRequestJoin(actor.getSnapshot())).toBe(true);

  actor.send({ type: 'join.requested', sessionId: 'session-1' });

  expect(selectCanRequestJoin(actor.getSnapshot())).toBe(false);
  expect(actor.getSnapshot().context.pendingCommand).toBe('join');
});
```

Run:

```bash
cd mobile
bun test tests/live/liveSessionWatchMachine.test.ts
```

Expected: PASS after Task 2 implementation.

- [ ] **Step 2: Create the controller hook**

Create `mobile/src/live/watch/hooks/useLiveSessionWatchController.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useMachine } from '@xstate/react';

import {
  clearLiveSessionWatchPendingMutation,
  isLiveSessionWatchAnyMutationPending,
  type LiveSessionWatchPendingMutation,
} from '../../liveSessionWatchReducer';
import { formatLiveMutationErrors } from '../../liveSessionPresentation';
import {
  liveSessionWatchMachine,
  selectCanRequestJoin,
  selectIsJoined,
  selectShouldAutoLeaveOnUnmount,
  selectVisibleError,
  selectVisibleSubmission,
} from '../state/liveSessionWatchMachine';
import type {
  LiveSessionWatchScreenEndMutation,
  LiveSessionWatchScreenJoinMutation,
  LiveSessionWatchScreenLeaveMutation,
} from '../liveSessionWatchOperations';
import type { UseMutationConfig } from 'react-relay';

export type LiveSessionWatchMutationCommit<TMutation> = (
  config: UseMutationConfig<TMutation>,
) => unknown;

export type LiveSessionWatchControllerOptions = {
  readonly canEndLiveSession: boolean;
  readonly canEnterLiveSession: boolean;
  readonly commitEndLiveSession: LiveSessionWatchMutationCommit<LiveSessionWatchScreenEndMutation>;
  readonly commitJoinLiveSession: LiveSessionWatchMutationCommit<LiveSessionWatchScreenJoinMutation>;
  readonly commitLeaveLiveSession: LiveSessionWatchMutationCommit<LiveSessionWatchScreenLeaveMutation>;
  readonly isCurrentViewerHost: boolean;
  readonly liveSessionId: string;
  readonly onEndSucceeded: () => void;
  readonly onLeaveStarted: () => void;
};

export type LiveSessionWatchController = {
  readonly autoLeaveSessionId: string | null;
  readonly hasActiveSubmission: boolean;
  readonly handleEndPress: () => void;
  readonly handleJoinPress: () => void;
  readonly handleLeavePress: () => void;
  readonly isEnding: boolean;
  readonly isJoined: boolean;
  readonly isJoining: boolean;
  readonly isLeaving: boolean;
  readonly shouldAutoLeaveOnUnmount: boolean;
  readonly watchError: string | null;
};

export function useLiveSessionWatchController({
  canEndLiveSession,
  canEnterLiveSession,
  commitEndLiveSession,
  commitJoinLiveSession,
  commitLeaveLiveSession,
  isCurrentViewerHost,
  liveSessionId,
  onEndSucceeded,
  onLeaveStarted,
}: LiveSessionWatchControllerOptions): LiveSessionWatchController {
  const [snapshot, send, actorRef] = useMachine(liveSessionWatchMachine);
  const pendingMutationRef = useRef<LiveSessionWatchPendingMutation | null>(
    null,
  );
  const didUnmountRef = useRef(false);
  const leaveMutationRef = useRef(commitLeaveLiveSession);

  leaveMutationRef.current = commitLeaveLiveSession;

  useEffect(() => {
    didUnmountRef.current = false;
    send({ type: 'session.changed', sessionId: liveSessionId });

    return () => {
      didUnmountRef.current = true;
      if (!selectShouldAutoLeaveOnUnmount(actorRef.getSnapshot())) {
        return;
      }

      commitDetachedLeaveLiveSession(liveSessionId);
    };
  }, [actorRef, liveSessionId, send]);

  function commitDetachedLeaveLiveSession(sessionId: string) {
    if (
      isLiveSessionWatchAnyMutationPending(pendingMutationRef.current, sessionId)
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'leave', sessionId };
    leaveMutationRef.current({
      variables: { input: { liveSessionId: sessionId } },
      onCompleted: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          sessionId,
          'leave',
        );
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          sessionId,
          'leave',
        );
      },
    });
  }

  function handleJoinPress() {
    const currentSnapshot = actorRef.getSnapshot();
    const hasPendingMutation = isLiveSessionWatchAnyMutationPending(
      pendingMutationRef.current,
      liveSessionId,
    );

    if (
      isCurrentViewerHost ||
      !canEnterLiveSession ||
      !selectCanRequestJoin(currentSnapshot) ||
      hasPendingMutation
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'join', sessionId: liveSessionId };
    send({ type: 'join.requested', sessionId: liveSessionId });

    commitJoinLiveSession({
      variables: { input: { liveSessionId } },
      onCompleted: (payload) => {
        const result = payload.joinLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'join',
        );

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!didUnmountRef.current) {
            send({
              error: formatLiveMutationErrors(result?.errors),
              sessionId: liveSessionId,
              type: 'join.failed',
            });
          }
          return;
        }

        if (didUnmountRef.current) {
          commitDetachedLeaveLiveSession(liveSessionId);
          return;
        }

        send({ type: 'join.succeeded', sessionId: liveSessionId });
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'join',
        );

        if (!didUnmountRef.current) {
          send({
            error: formatLiveMutationErrors([]),
            sessionId: liveSessionId,
            type: 'join.failed',
          });
        }
      },
    });
  }

  function handleLeavePress() {
    const currentSnapshot = actorRef.getSnapshot();

    if (
      !selectIsJoined(currentSnapshot) ||
      isLiveSessionWatchAnyMutationPending(
        pendingMutationRef.current,
        liveSessionId,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'leave', sessionId: liveSessionId };
    send({ type: 'leave.requested', sessionId: liveSessionId });
    onLeaveStarted();

    commitLeaveLiveSession({
      variables: { input: { liveSessionId } },
      onCompleted: (payload) => {
        const result = payload.leaveLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'leave',
        );

        if (!result?.left || (result.errors?.length ?? 0) > 0) {
          if (!didUnmountRef.current) {
            send({
              error: formatLiveMutationErrors(result?.errors),
              sessionId: liveSessionId,
              type: 'leave.failed',
            });
          }
          return;
        }

        if (!didUnmountRef.current) {
          send({ type: 'leave.succeeded', sessionId: liveSessionId });
        }
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'leave',
        );

        if (!didUnmountRef.current) {
          send({
            error: formatLiveMutationErrors([]),
            sessionId: liveSessionId,
            type: 'leave.failed',
          });
        }
      },
    });
  }

  function handleEndPress() {
    if (
      !canEndLiveSession ||
      isLiveSessionWatchAnyMutationPending(
        pendingMutationRef.current,
        liveSessionId,
      )
    ) {
      return;
    }

    pendingMutationRef.current = { kind: 'end', sessionId: liveSessionId };
    send({ type: 'end.requested', sessionId: liveSessionId });

    commitEndLiveSession({
      variables: { input: { liveSessionId } },
      onCompleted: (payload) => {
        const result = payload.endLiveSession;
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'end',
        );

        if (!result?.liveSession || (result.errors?.length ?? 0) > 0) {
          if (!didUnmountRef.current) {
            send({
              error: formatLiveMutationErrors(result?.errors),
              sessionId: liveSessionId,
              type: 'end.failed',
            });
          }
          return;
        }

        onEndSucceeded();

        if (!didUnmountRef.current) {
          send({ type: 'end.succeeded', sessionId: liveSessionId });
        }
      },
      onError: () => {
        pendingMutationRef.current = clearLiveSessionWatchPendingMutation(
          pendingMutationRef.current,
          liveSessionId,
          'end',
        );

        if (!didUnmountRef.current) {
          send({
            error: formatLiveMutationErrors([]),
            sessionId: liveSessionId,
            type: 'end.failed',
          });
        }
      },
    });
  }

  const submission = selectVisibleSubmission(snapshot);

  return {
    autoLeaveSessionId: selectShouldAutoLeaveOnUnmount(snapshot)
      ? liveSessionId
      : null,
    hasActiveSubmission: submission !== 'idle',
    handleEndPress,
    handleJoinPress,
    handleLeavePress,
    isEnding: submission === 'ending',
    isJoined: selectIsJoined(snapshot),
    isJoining: submission === 'joining',
    isLeaving: submission === 'leaving',
    shouldAutoLeaveOnUnmount: selectShouldAutoLeaveOnUnmount(snapshot),
    watchError: selectVisibleError(snapshot),
  };
}
```

- [ ] **Step 3: Integrate the controller into the watch screen**

Modify `mobile/src/live/watch/LiveSessionWatchScreen.tsx` so it:

- removes `useReducer(liveSessionWatchReducer, createLiveSessionWatchState())`;
- removes `pendingMutationRef` from `LiveSessionWatchContentProps`;
- removes local `handleJoinPress`, `handleLeavePress`, `handleEndPress`, and `commitDetachedLeaveLiveSession`;
- calls `useLiveSessionWatchController` after `liveSessionId` and `canEndLiveSession` are known;
- keeps chat, realtime, retained host publishing cleanup, and viewer playback behavior unchanged.

The screen should read the returned values like this:

```ts
const watchController = useLiveSessionWatchController({
  canEndLiveSession,
  canEnterLiveSession: enterable,
  commitEndLiveSession,
  commitJoinLiveSession,
  commitLeaveLiveSession,
  isCurrentViewerHost,
  liveSessionId,
  onEndSucceeded: () => {
    hostPublishingSessions.release(liveSessionId);
    stopViewerPlayback({ resetState: true });
  },
  onLeaveStarted: () => {
    stopViewerPlayback({ resetState: true });
  },
});

const {
  handleEndPress,
  handleJoinPress,
  handleLeavePress,
  hasActiveSubmission,
  isEnding,
  isJoined,
  isJoining,
  isLeaving,
  watchError,
} = watchController;
```

- [ ] **Step 4: Route realtime membership loss and ended-session events through the actor**

Expose two commands from `useLiveSessionWatchController`:

```ts
readonly markMembershipLost: () => void;
readonly markSessionEnded: () => void;
```

Implement them inside the hook:

```ts
function markMembershipLost() {
  send({ type: 'membership.lost', sessionId: liveSessionId });
}

function markSessionEnded() {
  send({ type: 'session.ended', sessionId: liveSessionId });
}
```

Replace the current screen `dispatchWatchAction({ type: 'membership_lost' })` calls with `watchController.markMembershipLost()` or `watchController.markSessionEnded()`.

- [ ] **Step 5: Run focused live tests**

Run:

```bash
cd mobile
bun test tests/live/liveSessionWatchMachine.test.ts tests/live/LiveDiscoveryScreen.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionChatReducer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Delete the old watch reducer when no consumers remain**

Run:

```bash
cd mobile
rg "liveSessionWatchReducer|createLiveSessionWatchState|readLiveSessionWatchSubmission|shouldAutoLeaveLiveSession" src tests
```

Expected: only intentional references remain. If no source consumers remain, delete `mobile/src/live/liveSessionWatchReducer.ts` and `mobile/tests/live/liveSessionWatchReducer.test.ts`. If a helper type is still needed by tests, move the narrow type into `mobile/src/live/watch/state/liveSessionWatchMachine.ts`.

- [ ] **Step 7: Verify and commit**

Run:

```bash
cd mobile
bun test tests/live
bun run typecheck
```

Then:

```bash
git add mobile/src/live mobile/tests/live
git commit -m "Move live watch workflow to XState"
```

## Task 4: Move Viewer Playback Status Into A Machine

**Files:**
- Create: `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`
- Create: `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`
- Modify: `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`
- Modify: `mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts`

- [ ] **Step 1: Write playback machine tests**

Create `mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  liveSessionViewerPlaybackMachine,
  selectViewerPlaybackState,
} from '../../src/live/watch/state/liveSessionViewerPlaybackMachine';

function createStartedActor() {
  const actor = createActor(liveSessionViewerPlaybackMachine);
  actor.start();
  return actor;
}

describe('liveSessionViewerPlaybackMachine', () => {
  test('moves from preparing to waiting for host and then playing', () => {
    const actor = createStartedActor();

    actor.send({ type: 'playback.prepareRequested' });
    actor.send({ type: 'playback.connecting' });
    actor.send({ type: 'playback.runtimeStarted' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'playback.remoteStreamReceived',
    });

    expect(selectViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });
  });

  test('closed channel clears remote stream without showing an error', () => {
    const actor = createStartedActor();

    actor.send({ type: 'playback.prepareRequested' });
    actor.send({ type: 'playback.connecting' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'playback.remoteStreamReceived',
    });
    actor.send({ type: 'playback.closed' });

    expect(selectViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });
  });

  test('stop resets state to idle when reset is requested', () => {
    const actor = createStartedActor();

    actor.send({ type: 'playback.prepareRequested' });
    actor.send({
      error: 'Live video playback is not available on this device.',
      type: 'playback.failed',
    });
    actor.send({ resetState: true, type: 'playback.stopped' });

    expect(selectViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });
  });
});
```

Run:

```bash
cd mobile
bun test tests/live/liveSessionViewerPlaybackMachine.test.ts
```

Expected: FAIL because the machine file does not exist.

- [ ] **Step 2: Implement playback machine and selector**

Create `mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts`:

```ts
import { assign, setup, type SnapshotFrom } from 'xstate';

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

type ViewerPlaybackContext = {
  readonly error: string | null;
  readonly remoteStreamUrl: string | null;
};

type ViewerPlaybackEvent =
  | { readonly type: 'playback.prepareRequested' }
  | { readonly type: 'playback.connecting' }
  | { readonly type: 'playback.runtimeStarted' }
  | {
      readonly remoteStreamUrl: string | null;
      readonly type: 'playback.remoteStreamReceived';
    }
  | { readonly error: string; readonly type: 'playback.failed' }
  | { readonly type: 'playback.closed' }
  | { readonly resetState: boolean; readonly type: 'playback.stopped' };

const initialContext: ViewerPlaybackContext = {
  error: null,
  remoteStreamUrl: null,
};

export const liveSessionViewerPlaybackMachine = setup({
  types: {
    context: {} as ViewerPlaybackContext,
    events: {} as ViewerPlaybackEvent,
  },
  actions: {
    clearPlayback: assign({
      error: () => null,
      remoteStreamUrl: () => null,
    }),
    storeError: assign({
      error: ({ event }) =>
        event.type === 'playback.failed' ? event.error : null,
      remoteStreamUrl: () => null,
    }),
    storeRemoteStream: assign({
      error: () => null,
      remoteStreamUrl: ({ event }) =>
        event.type === 'playback.remoteStreamReceived'
          ? event.remoteStreamUrl
          : null,
    }),
  },
}).createMachine({
  id: 'liveSessionViewerPlayback',
  context: initialContext,
  initial: 'idle',
  states: {
    idle: {
      entry: 'clearPlayback',
      on: {
        'playback.prepareRequested': {
          actions: 'clearPlayback',
          target: 'preparing',
        },
      },
    },
    preparing: {
      on: {
        'playback.connecting': 'connecting',
        'playback.failed': {
          actions: 'storeError',
          target: 'errored',
        },
        'playback.stopped': 'idle',
      },
    },
    connecting: {
      on: {
        'playback.failed': {
          actions: 'storeError',
          target: 'errored',
        },
        'playback.remoteStreamReceived': {
          actions: 'storeRemoteStream',
          target: 'playing',
        },
        'playback.runtimeStarted': 'waitingForHost',
        'playback.stopped': 'idle',
      },
    },
    waitingForHost: {
      on: {
        'playback.closed': 'closed',
        'playback.failed': {
          actions: 'storeError',
          target: 'errored',
        },
        'playback.remoteStreamReceived': {
          actions: 'storeRemoteStream',
          target: 'playing',
        },
        'playback.stopped': 'idle',
      },
    },
    playing: {
      on: {
        'playback.closed': {
          actions: 'clearPlayback',
          target: 'closed',
        },
        'playback.failed': {
          actions: 'storeError',
          target: 'errored',
        },
        'playback.remoteStreamReceived': {
          actions: 'storeRemoteStream',
        },
        'playback.stopped': 'idle',
      },
    },
    errored: {
      on: {
        'playback.prepareRequested': {
          actions: 'clearPlayback',
          target: 'preparing',
        },
        'playback.stopped': 'idle',
      },
    },
    closed: {
      on: {
        'playback.prepareRequested': {
          actions: 'clearPlayback',
          target: 'preparing',
        },
        'playback.stopped': 'idle',
      },
    },
  },
});

export type LiveSessionViewerPlaybackSnapshot = SnapshotFrom<
  typeof liveSessionViewerPlaybackMachine
>;

export function selectViewerPlaybackState(
  snapshot: LiveSessionViewerPlaybackSnapshot,
): ViewerPlaybackState {
  if (snapshot.matches('preparing')) {
    return { error: null, remoteStreamUrl: null, status: 'preparing' };
  }

  if (snapshot.matches('connecting')) {
    return {
      error: null,
      remoteStreamUrl: snapshot.context.remoteStreamUrl,
      status: 'connecting',
    };
  }

  if (snapshot.matches('waitingForHost')) {
    return {
      error: null,
      remoteStreamUrl: snapshot.context.remoteStreamUrl,
      status: snapshot.context.remoteStreamUrl ? 'playing' : 'waiting_for_host',
    };
  }

  if (snapshot.matches('playing')) {
    return {
      error: null,
      remoteStreamUrl: snapshot.context.remoteStreamUrl,
      status: 'playing',
    };
  }

  if (snapshot.matches('errored')) {
    return {
      error: snapshot.context.error,
      remoteStreamUrl: null,
      status: 'errored',
    };
  }

  if (snapshot.matches('closed')) {
    return { error: null, remoteStreamUrl: null, status: 'closed' };
  }

  return { error: null, remoteStreamUrl: null, status: 'idle' };
}
```

- [ ] **Step 3: Update the playback controller to send machine events**

Modify `mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts`:

- replace local `useState<ViewerPlaybackState>` with `useMachine(liveSessionViewerPlaybackMachine)`;
- replace each `setViewerPlaybackState(...)` call with one of the explicit playback events;
- keep `viewerPlaybackGenerationRef` and `viewerPlaybackResourceRef` outside the machine;
- return `viewerPlaybackState: selectViewerPlaybackState(snapshot)`.

Use these event replacements:

```ts
send({ type: 'playback.prepareRequested' });
send({ type: 'playback.connecting' });
send({ type: 'playback.runtimeStarted' });
send({
  remoteStreamUrl: stream?.toURL?.() ?? null,
  type: 'playback.remoteStreamReceived',
});
send({ error: reason, type: 'playback.failed' });
send({ type: 'playback.closed' });
send({ resetState, type: 'playback.stopped' });
```

- [ ] **Step 4: Run focused playback tests**

Run:

```bash
cd mobile
bun test tests/live/liveSessionViewerPlaybackMachine.test.ts tests/live/useLiveSessionViewerPlaybackController.test.ts tests/live/liveSessionViewerPlaybackRuntime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add mobile/src/live/watch/state/liveSessionViewerPlaybackMachine.ts mobile/src/live/watch/hooks/useLiveSessionViewerPlaybackController.ts mobile/tests/live/liveSessionViewerPlaybackMachine.test.ts mobile/tests/live/useLiveSessionViewerPlaybackController.test.ts
git commit -m "Move viewer playback status to XState"
```

## Task 5: Move Chat Channel And Send Status Into A Machine

**Files:**
- Create: `mobile/src/live/chat/state/liveSessionChatChannelMachine.ts`
- Create: `mobile/tests/live/liveSessionChatChannelMachine.test.ts`
- Modify: `mobile/src/live/chat/liveSessionChatState.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify: `mobile/src/live/watch/LiveSessionWatchScreen.tsx`
- Modify: `mobile/tests/live/liveSessionChatReducer.test.ts`
- Modify: `mobile/tests/live/LiveSessionChatPanel.test.ts`

- [ ] **Step 1: Write machine tests for channel/send state**

Create `mobile/tests/live/liveSessionChatChannelMachine.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  liveSessionChatChannelMachine,
  selectCanStartChatSend,
  selectChatChannelStatus,
  selectChatSendError,
  selectChatSendStatus,
} from '../../src/live/chat/state/liveSessionChatChannelMachine';

function createStartedActor() {
  const actor = createActor(liveSessionChatChannelMachine);
  actor.start();
  return actor;
}

describe('liveSessionChatChannelMachine', () => {
  test('allows sends only when joined and idle', () => {
    const actor = createStartedActor();

    actor.send({ sessionId: 'session-1', type: 'session.changed' });
    actor.send({ sessionId: 'session-1', type: 'channel.joining' });
    actor.send({ sessionId: 'session-1', type: 'channel.joined' });

    expect(selectChatChannelStatus(actor.getSnapshot())).toBe('joined');
    expect(selectCanStartChatSend(actor.getSnapshot())).toBe(true);

    actor.send({ sessionId: 'session-1', type: 'send.started' });

    expect(selectChatSendStatus(actor.getSnapshot())).toBe('sending');
    expect(selectCanStartChatSend(actor.getSnapshot())).toBe(false);
  });

  test('channel close fails pending send with viewer-safe text', () => {
    const actor = createStartedActor();

    actor.send({ sessionId: 'session-1', type: 'session.changed' });
    actor.send({ sessionId: 'session-1', type: 'channel.joined' });
    actor.send({ sessionId: 'session-1', type: 'send.started' });
    actor.send({
      error: 'Chat disconnected before the message was sent.',
      sessionId: 'session-1',
      type: 'channel.closed',
    });

    expect(selectChatChannelStatus(actor.getSnapshot())).toBe('closed');
    expect(selectChatSendStatus(actor.getSnapshot())).toBe('failed');
    expect(selectChatSendError(actor.getSnapshot())).toBe(
      'Chat disconnected before the message was sent.',
    );
  });
});
```

- [ ] **Step 2: Implement channel/send machine**

Create `mobile/src/live/chat/state/liveSessionChatChannelMachine.ts` with these exported selectors:

```ts
export function selectChatChannelStatus(snapshot: LiveSessionChatChannelSnapshot) {
  return snapshot.context.channelStatus;
}

export function selectChatSendStatus(snapshot: LiveSessionChatChannelSnapshot) {
  return snapshot.context.sendStatus;
}

export function selectChatSendError(snapshot: LiveSessionChatChannelSnapshot) {
  return snapshot.context.sendError;
}

export function selectCanStartChatSend(snapshot: LiveSessionChatChannelSnapshot) {
  return (
    snapshot.context.channelStatus === 'joined' &&
    snapshot.context.sendStatus !== 'sending'
  );
}
```

The machine context must include:

```ts
type LiveSessionChatChannelContext = {
  readonly activeSessionId: string | null;
  readonly channelError: string | null;
  readonly channelStatus:
    | 'idle'
    | 'joining'
    | 'joined'
    | 'errored'
    | 'closed';
  readonly sendError: string | null;
  readonly sendStatus: 'idle' | 'sending' | 'failed';
};
```

The event union must include session-scoped variants:

```ts
type LiveSessionChatChannelEvent =
  | { readonly sessionId: string; readonly type: 'session.changed' }
  | { readonly sessionId: string; readonly type: 'channel.joining' }
  | { readonly sessionId: string; readonly type: 'channel.joined' }
  | { readonly error: string; readonly sessionId: string; readonly type: 'channel.errored' }
  | { readonly error: string; readonly sessionId: string; readonly type: 'channel.closed' }
  | { readonly sessionId: string; readonly type: 'send.started' }
  | { readonly sessionId: string; readonly type: 'send.succeeded' }
  | { readonly sessionId: string; readonly type: 'send.cancelled' }
  | { readonly error: string; readonly sessionId: string; readonly type: 'send.failed' };
```

- [ ] **Step 3: Keep timeline rows in the existing reducer**

Modify `mobile/src/live/chat/liveSessionChatState.ts` and `mobile/src/live/liveSessionChatReducer.ts` so the reducer no longer owns `channelStatus`, `channelError`, `sendStatus`, or `sendError`. It should continue to own:

- `activeSessionId`;
- `eventsById`;
- `eventIds`;
- `pageInfo`;
- retained initial/older/newer history merge actions;
- realtime event merge actions.

- [ ] **Step 4: Update watch screen chat integration**

In `mobile/src/live/watch/LiveSessionWatchScreen.tsx`, use the chat channel machine for:

- channel joining/joined/errored/closed status;
- send started/succeeded/failed/cancelled status;
- `canStartLiveSessionChatSend` replacement.

Keep the existing `LiveSessionChatPanel` props unchanged:

```tsx
<LiveSessionChatPanel
  channelStatus={chatChannelStatus}
  isJoined={isJoined}
  onSendMessage={handleSendChatMessage}
  rows={chatRows}
  sendError={chatSendError}
  sendStatus={chatSendStatus}
/>
```

- [ ] **Step 5: Verify chat tests**

Run:

```bash
cd mobile
bun test tests/live/liveSessionChatChannelMachine.test.ts tests/live/liveSessionChatReducer.test.ts tests/live/LiveSessionChatPanel.test.ts tests/live/liveSessionChatChannelLifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add mobile/src/live/chat mobile/src/live/liveSessionChatReducer.ts mobile/src/live/watch/LiveSessionWatchScreen.tsx mobile/tests/live
git commit -m "Move live chat channel status to XState"
```

## Task 6: Move Host Preflight Workflow Into A Machine

**Files:**
- Create: `mobile/src/host/preflight/state/hostBroadcastPreflightMachine.ts`
- Create: `mobile/tests/host/hostBroadcastPreflightMachine.test.ts`
- Modify: `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts`
- Modify: `mobile/tests/host/useHostBroadcastPreflightController.test.ts`
- Modify: `mobile/tests/host/hostBroadcastPreflight.test.ts`
- Modify: `mobile/tests/host/hostBroadcastSession.test.ts`

- [ ] **Step 1: Write host preflight machine tests**

Create `mobile/tests/host/hostBroadcastPreflightMachine.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  hostBroadcastPreflightMachine,
  selectCanCreateHostSession,
  selectCanGoLive,
  selectCanPrepareHostMedia,
  selectHostBroadcastSessionState,
} from '../../src/host/preflight/state/hostBroadcastPreflightMachine';

function createStartedActor() {
  const actor = createActor(hostBroadcastPreflightMachine);
  actor.start();
  return actor;
}

describe('hostBroadcastPreflightMachine', () => {
  test('moves through create, prepare, and go-live success', () => {
    const actor = createStartedActor();

    expect(selectCanCreateHostSession(actor.getSnapshot())).toBe(true);

    actor.send({ type: 'session.createRequested' });
    actor.send({
      liveSessionId: 'session-1',
      type: 'session.createSucceeded',
    });

    expect(selectCanPrepareHostMedia(actor.getSnapshot())).toBe(true);

    actor.send({ type: 'media.prepareRequested' });
    actor.send({ type: 'media.prepareSucceeded' });
    actor.send({ type: 'publishing.ready' });

    expect(selectCanGoLive(actor.getSnapshot())).toBe(true);

    actor.send({ type: 'goLive.requested' });
    actor.send({ liveSessionId: 'session-1', type: 'goLive.succeeded' });

    expect(selectHostBroadcastSessionState(actor.getSnapshot())).toEqual({
      liveSessionId: 'session-1',
      status: 'live',
      viewerSafeErrorText: null,
    });
  });

  test('go-live retryable media readiness failure keeps prepared media', () => {
    const actor = createStartedActor();

    actor.send({ type: 'session.createRequested' });
    actor.send({
      liveSessionId: 'session-1',
      type: 'session.createSucceeded',
    });
    actor.send({ type: 'media.prepareRequested' });
    actor.send({ type: 'media.prepareSucceeded' });
    actor.send({ type: 'publishing.ready' });
    actor.send({ type: 'goLive.requested' });
    actor.send({
      error: 'Host media is not ready yet.',
      retryableMediaReadiness: true,
      type: 'goLive.failed',
    });

    expect(selectCanGoLive(actor.getSnapshot())).toBe(true);
  });
});
```

- [ ] **Step 2: Implement host preflight machine**

Create `mobile/src/host/preflight/state/hostBroadcastPreflightMachine.ts` with context:

```ts
export type HostBroadcastPreflightMachineContext = {
  readonly backendMediaReady: boolean;
  readonly error: string | null;
  readonly hasPreparedMedia: boolean;
  readonly isGoingLive: boolean;
  readonly isPreparingMedia: boolean;
  readonly liveSessionId: string | null;
  readonly publishingStatus: 'idle' | 'starting' | 'ready' | 'errored';
  readonly sessionStatus:
    | 'idle'
    | 'creating'
    | 'starting'
    | 'ending'
    | 'ended'
    | 'live';
};
```

Export selectors used by the existing cards:

```ts
export function selectCanCreateHostSession(snapshot: HostBroadcastPreflightSnapshot): boolean;
export function selectCanPrepareHostMedia(snapshot: HostBroadcastPreflightSnapshot): boolean;
export function selectCanGoLive(snapshot: HostBroadcastPreflightSnapshot): boolean;
export function selectCanUseHostPreflightBackAction(snapshot: HostBroadcastPreflightSnapshot): boolean;
export function selectHostBroadcastSessionState(snapshot: HostBroadcastPreflightSnapshot): HostBroadcastSessionState;
export function selectHostBroadcastPublishingStatus(snapshot: HostBroadcastPreflightSnapshot): HostBroadcastPublishingStatus;
```

- [ ] **Step 3: Integrate the machine into the preflight controller**

Modify `mobile/src/host/preflight/hooks/useHostBroadcastPreflightController.ts` so:

- `sessionState`, `preparedMedia`, `isPreparingMedia`, `isGoingLive`, `publishingStatus`, and `hostActionError` are derived from machine selectors where possible;
- prepared media payload data remains in React state or refs because it is external operation data consumed by publishing runtime;
- native permission readiness continues to dispatch existing `hostBroadcastPreflightReducer` readiness actions unless that reducer is replaced in the same file with explicit machine events;
- start/prepare/go-live/end mutation callbacks send explicit machine events.

Use event names in the controller:

```ts
send({ type: 'session.createRequested' });
send({ liveSessionId, type: 'session.createSucceeded' });
send({ error: viewerSafeErrorText, type: 'session.createFailed' });
send({ type: 'media.prepareRequested' });
send({ type: 'media.prepareSucceeded' });
send({ error: viewerSafeErrorText, type: 'media.prepareFailed' });
send({ type: 'publishing.ready' });
send({ error: reason, type: 'publishing.failed' });
send({ type: 'goLive.requested' });
send({ liveSessionId, type: 'goLive.succeeded' });
send({
  error: viewerSafeErrorText,
  retryableMediaReadiness,
  type: 'goLive.failed',
});
send({ type: 'session.endRequested' });
send({ type: 'session.endSucceeded' });
send({ error: viewerSafeErrorText, type: 'session.endFailed' });
```

- [ ] **Step 4: Verify host tests**

Run:

```bash
cd mobile
bun test tests/host/hostBroadcastPreflightMachine.test.ts tests/host/useHostBroadcastPreflightController.test.ts tests/host/useHostBroadcastPublishingController.test.ts tests/host/hostBroadcastPreflight.test.ts tests/host/hostBroadcastSession.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add mobile/src/host/preflight mobile/tests/host
git commit -m "Move host preflight workflow to XState"
```

## Task 7: Remove Superseded Reducers And Tighten Verification

**Files:**
- Delete if unused: `mobile/src/live/liveSessionWatchReducer.ts`
- Delete if unused: `mobile/tests/live/liveSessionWatchReducer.test.ts`
- Modify: `mobile/src/live/watch/liveSessionWatchScreenTypes.ts`
- Modify: `mobile/src/live/chat/liveSessionChatState.ts`
- Modify: `mobile/src/live/liveSessionChatReducer.ts`
- Modify: `docs/plans/mobile/2026-06-27-mobile-xstate-live-workflows.md`
- Modify only when activating or closing the batch: `docs/plans/mobile/NOW.md`

- [ ] **Step 1: Find old reducer and helper consumers**

Run:

```bash
rg "liveSessionWatchReducer|createLiveSessionWatchState|LiveSessionWatchPendingMutation|readLiveSessionWatchSubmission|shouldAutoLeaveLiveSession" mobile/src mobile/tests
```

Expected: no source consumers of old reducer behavior after Task 3. A remaining `LiveSessionWatchPendingMutation` type should move into `mobile/src/live/watch/state/liveSessionWatchMachine.ts` or the controller hook.

- [ ] **Step 2: Delete old reducer files when unused**

Run:

```bash
git rm mobile/src/live/liveSessionWatchReducer.ts mobile/tests/live/liveSessionWatchReducer.test.ts
```

Expected: files are removed only after Step 1 shows there are no behavior consumers.

- [ ] **Step 3: Remove obsolete props and refs from watch screen types**

Modify `mobile/src/live/watch/liveSessionWatchScreenTypes.ts` so it no longer exports `PendingMutationRef` or `AutoLeaveOnUnmountRef` if the XState controller owns those concerns.

- [ ] **Step 4: Run full mobile quality gate**

Run:

```bash
cd mobile
bun run test:quality
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run repository diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 6: Commit**

Run:

```bash
git add mobile docs/plans/mobile/2026-06-27-mobile-xstate-live-workflows.md
git commit -m "Clean up superseded mobile workflow reducers"
```

## Final Verification

Run:

```bash
cd mobile
bun run test:quality
bun run typecheck
```

Then:

```bash
git diff --check
git status --short --branch
```

Expected:

- `bun run test:quality` passes all mobile tests under `mobile/tests/**`.
- `bun run typecheck` passes.
- `git diff --check` reports no whitespace errors.
- `git status --short --branch` shows only intentional plan or implementation files before each commit, and a clean branch after the final commit.

## Rollout Notes

- Keep this behind ordinary source refactors. No feature flag is needed because the screen behavior is unchanged.
- Treat Task 2 and Task 3 as the pilot. If they make `LiveSessionWatchScreen.tsx` harder to understand, stop before Task 4 and revise the architecture.
- Do not apply XState to auth forms, profile mutation button state, theme, startup gate, or tiny UI state in this batch.
- Do not move the mobile lane `NOW.md` pointer until the XState work is actually selected as the current mobile batch.

import { describe, expect, test } from 'bun:test';
import { createActor } from 'xstate';

import {
  hostBroadcastPreflightMachine,
  selectCanRequestHostBroadcastBackgroundEnd,
  selectHostBroadcastPreflightCleanupLiveSessionId,
  selectHostBroadcastPreflightWorkflowState,
  selectHostBroadcastPreflightWorkflowStatus,
} from '../../src/host/preflight/state/hostBroadcastPreflightMachine';

function startMachine() {
  return createActor(hostBroadcastPreflightMachine).start();
}

function markNativeReady(actor: ReturnType<typeof startMachine>) {
  actor.send({
    permission: 'camera',
    state: 'granted',
    type: 'PERMISSION_CHANGED',
  });
  actor.send({
    permission: 'microphone',
    state: 'granted',
    type: 'PERMISSION_CHANGED',
  });
  actor.send({
    ready: true,
    type: 'NATIVE_MEDIA_CHANGED',
  });
}

function startSession(
  actor: ReturnType<typeof startMachine>,
  liveSessionId = 'live-session-id',
) {
  markNativeReady(actor);
  actor.send({ type: 'CREATE_SESSION_REQUESTED' });
  actor.send({ liveSessionId, type: 'CREATE_SESSION_SUCCEEDED' });
}

function prepareMedia(
  actor: ReturnType<typeof startMachine>,
  liveSessionId = 'live-session-id',
) {
  startSession(actor, liveSessionId);
  actor.send({ type: 'PREPARE_MEDIA_REQUESTED' });
  actor.send({ type: 'PREPARE_MEDIA_SUCCEEDED' });
}

function prepareReadyToPublish(actor: ReturnType<typeof startMachine>) {
  prepareMedia(actor);
  actor.send({
    ready: true,
    type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
  });
}

describe('hostBroadcastPreflightMachine', () => {
  test('creates a session only after native readiness and stores the live session id on success', () => {
    const actor = startMachine();

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canCreateSession: false,
      sessionState: {
        liveSessionId: null,
        status: 'idle',
      },
    });

    markNativeReady(actor);
    expect(
      selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())
        .canCreateSession,
    ).toBe(true);

    actor.send({ type: 'CREATE_SESSION_REQUESTED' });
    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canCreateSession: false,
      sessionState: {
        liveSessionId: null,
        status: 'creating',
      },
    });

    actor.send({ liveSessionId: 'live-session-id', type: 'CREATE_SESSION_SUCCEEDED' });
    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canCreateSession: false,
      canPrepareMedia: true,
      sessionState: {
        liveSessionId: 'live-session-id',
        status: 'starting',
      },
    });
  });

  test('returns to idle with viewer-safe error text when session creation fails', () => {
    const actor = startMachine();

    markNativeReady(actor);
    actor.send({ type: 'CREATE_SESSION_REQUESTED' });
    actor.send({
      type: 'CREATE_SESSION_FAILED',
      viewerSafeErrorText: 'We could not create this live session.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canCreateSession: true,
      errorMessage: 'We could not create this live session.',
      sessionState: {
        liveSessionId: null,
        status: 'idle',
        viewerSafeErrorText: 'We could not create this live session.',
      },
    });
  });

  test('prepares media only for a started session and marks prepared-media eligibility on success', () => {
    const actor = startMachine();

    startSession(actor);
    actor.send({ type: 'PREPARE_MEDIA_REQUESTED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canPrepareMedia: false,
      hasPreparedMedia: false,
      isPreparingMedia: true,
    });

    actor.send({ type: 'PREPARE_MEDIA_SUCCEEDED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      canPrepareMedia: false,
      hasPreparedMedia: true,
      isPreparingMedia: false,
      preflightState: {
        backendMediaContractReady: false,
      },
    });
  });

  test('media prepare failure clears prepared-media eligibility and records the viewer-safe error', () => {
    const actor = startMachine();

    startSession(actor);
    actor.send({ type: 'PREPARE_MEDIA_REQUESTED' });
    actor.send({
      type: 'PREPARE_MEDIA_FAILED',
      viewerSafeErrorText: 'We could not prepare host media.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canPrepareMedia: true,
      errorMessage: 'We could not prepare host media.',
      hasPreparedMedia: false,
      isPreparingMedia: false,
      preflightState: {
        backendMediaContractReady: false,
      },
    });
  });

  test('publishing readiness enables go-live and publishing failure clears prepared media', () => {
    const actor = startMachine();

    prepareMedia(actor);
    actor.send({
      ready: true,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: true,
      hasPreparedMedia: true,
      preflightState: {
        backendMediaContractReady: true,
      },
    });
    expect(selectHostBroadcastPreflightWorkflowStatus(actor.getSnapshot())).toBe(
      'ready_to_publish',
    );

    actor.send({
      ready: false,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      hasPreparedMedia: true,
      preflightState: {
        backendMediaContractReady: false,
      },
    });
    expect(selectHostBroadcastPreflightWorkflowStatus(actor.getSnapshot())).toBe(
      'starting',
    );

    actor.send({
      ready: true,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });

    actor.send({
      type: 'PUBLISHING_FAILED',
      viewerSafeErrorText: 'Could not start host media publishing. Please try again.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      errorMessage: 'Could not start host media publishing. Please try again.',
      hasPreparedMedia: false,
      preflightState: {
        backendMediaContractReady: false,
      },
    });
  });

  test('go-live request moves to the live workflow state on success', () => {
    const actor = startMachine();

    prepareReadyToPublish(actor);
    actor.send({ type: 'GO_LIVE_REQUESTED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      isGoingLive: true,
    });

    actor.send({ liveSessionId: 'live-session-id', type: 'GO_LIVE_SUCCEEDED' });

    expect(selectHostBroadcastPreflightWorkflowStatus(actor.getSnapshot())).toBe(
      'live',
    );
    expect(
      selectCanRequestHostBroadcastBackgroundEnd(
        actor.getSnapshot(),
        'live-session-id',
      ),
    ).toBe(true);
    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canUseBackAction: false,
      isGoingLive: false,
      sessionState: {
        liveSessionId: 'live-session-id',
      },
    });

    actor.send({ type: 'END_REQUESTED' });
    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      sessionState: {
        liveSessionId: 'live-session-id',
        status: 'ending',
      },
    });
  });

  test('failed end from live keeps the workflow in live state', () => {
    const actor = startMachine();

    prepareReadyToPublish(actor);
    actor.send({ type: 'GO_LIVE_REQUESTED' });
    actor.send({ liveSessionId: 'live-session-id', type: 'GO_LIVE_SUCCEEDED' });
    actor.send({ type: 'END_REQUESTED' });
    actor.send({
      type: 'END_FAILED',
      viewerSafeErrorText: 'We could not end this live session.',
    });

    expect(selectHostBroadcastPreflightWorkflowStatus(actor.getSnapshot())).toBe(
      'live',
    );
    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      errorMessage: 'We could not end this live session.',
      sessionState: {
        liveSessionId: 'live-session-id',
        status: 'starting',
      },
    });
  });

  test('retryable go-live failure preserves prepared media so the host can retry', () => {
    const actor = startMachine();

    prepareReadyToPublish(actor);
    actor.send({ type: 'GO_LIVE_REQUESTED' });
    actor.send({
      retryable: true,
      type: 'GO_LIVE_FAILED',
      viewerSafeErrorText:
        'Media negotiation is not ready yet. Prepare media and try again.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: true,
      errorMessage:
        'Media negotiation is not ready yet. Prepare media and try again.',
      hasPreparedMedia: true,
      isGoingLive: false,
      preflightState: {
        backendMediaContractReady: true,
      },
    });
  });

  test('non-retryable go-live failure clears prepared media', () => {
    const actor = startMachine();

    prepareReadyToPublish(actor);
    actor.send({ type: 'GO_LIVE_REQUESTED' });
    actor.send({
      retryable: false,
      type: 'GO_LIVE_FAILED',
      viewerSafeErrorText: 'We could not start this live session.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canGoLive: false,
      errorMessage: 'We could not start this live session.',
      hasPreparedMedia: false,
      isGoingLive: false,
      preflightState: {
        backendMediaContractReady: false,
      },
    });
  });

  test('tracks end request, success, and retryable end failure', () => {
    const actor = startMachine();

    startSession(actor, 'session-to-end');
    actor.send({ type: 'END_REQUESTED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canUseBackAction: false,
      sessionState: {
        liveSessionId: 'session-to-end',
        status: 'ending',
      },
    });

    actor.send({
      type: 'END_FAILED',
      viewerSafeErrorText: 'We could not end this live session.',
    });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      canUseBackAction: true,
      errorMessage: 'We could not end this live session.',
      sessionState: {
        liveSessionId: 'session-to-end',
        status: 'starting',
      },
    });

    actor.send({ type: 'END_REQUESTED' });
    actor.send({ type: 'END_SUCCEEDED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      sessionState: {
        liveSessionId: null,
        status: 'ended',
      },
    });
  });

  test('returns cleanup target only for abandoned started preflight sessions', () => {
    const actor = startMachine();

    startSession(actor, 'cleanup-session');

    expect(
      selectHostBroadcastPreflightCleanupLiveSessionId(actor.getSnapshot()),
    ).toBe('cleanup-session');

    actor.send({ type: 'PREPARE_MEDIA_REQUESTED' });
    actor.send({ type: 'PREPARE_MEDIA_SUCCEEDED' });
    actor.send({
      ready: true,
      type: 'BACKEND_MEDIA_CONTRACT_CHANGED',
    });
    actor.send({ type: 'GO_LIVE_REQUESTED' });

    expect(
      selectHostBroadcastPreflightCleanupLiveSessionId(actor.getSnapshot()),
    ).toBeNull();
  });

  test('background end requests block duplicate cleanup without changing visible session state', () => {
    const actor = startMachine();

    startSession(actor, 'cleanup-session');
    actor.send({ type: 'BACKGROUND_END_REQUESTED' });

    expect(selectHostBroadcastPreflightWorkflowState(actor.getSnapshot())).toMatchObject({
      sessionState: {
        liveSessionId: 'cleanup-session',
        status: 'starting',
      },
    });
    expect(
      selectHostBroadcastPreflightCleanupLiveSessionId(actor.getSnapshot()),
    ).toBeNull();

    actor.send({ type: 'BACKGROUND_END_FINISHED' });

    expect(
      selectHostBroadcastPreflightCleanupLiveSessionId(actor.getSnapshot()),
    ).toBe('cleanup-session');
  });
});

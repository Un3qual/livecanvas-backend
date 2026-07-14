import { describe, expect, test } from 'vitest';
import { createActor } from 'xstate';

import {
  canRetryLiveSessionViewerPlayback,
  liveSessionViewerPlaybackMachine,
  selectLiveSessionViewerPlaybackState,
} from '../../src/live/watch/state/liveSessionViewerPlaybackMachine';
import type { ViewerPlaybackState } from '../../src/live/watch/liveSessionWatchScreenTypes';

function startMachine() {
  return createActor(liveSessionViewerPlaybackMachine).start();
}

describe('liveSessionViewerPlaybackMachine', () => {
  test('starts idle and moves through prepare, connect, waiting, and playing', () => {
    const actor = startMachine();

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });

    actor.send({ type: 'PREPARE_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    actor.send({ type: 'CONNECT_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });

    actor.send({ type: 'RUNTIME_STARTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });

    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });
  });

  test('keeps playing when the remote stream arrives before runtime start resolves', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({
      remoteStreamUrl: 'stream://early-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ type: 'RUNTIME_STARTED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://early-camera',
      status: 'playing',
    });
  });

  test('keeps the current phase when a null remote stream arrives before playing', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({ remoteStreamUrl: null, type: 'REMOTE_STREAM_RECEIVED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });

    actor.send({ type: 'RUNTIME_STARTED' });
    actor.send({ remoteStreamUrl: null, type: 'REMOTE_STREAM_RECEIVED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'waiting_for_host',
    });
  });

  test('keeps playing when an active stream is cleared by a null remote stream', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({ type: 'RUNTIME_STARTED' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ remoteStreamUrl: null, type: 'REMOTE_STREAM_RECEIVED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'playing',
    });
  });

  test('closes without carrying an error or stream URL', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ type: 'CLOSED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    });
  });

  test('failure after playing clears the stream and records the error', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ error: 'connection failed', type: 'FAILED' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: 'connection failed',
      remoteStreamUrl: null,
      status: 'errored',
    });
  });

  test('prepare and reset both clear a closed playback state', () => {
    const prepareActor = startMachine();

    prepareActor.send({ type: 'PREPARE_REQUESTED' });
    prepareActor.send({ type: 'CONNECT_REQUESTED' });
    prepareActor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    prepareActor.send({ type: 'CLOSED' });
    prepareActor.send({ type: 'PREPARE_REQUESTED' });

    expect(
      selectLiveSessionViewerPlaybackState(prepareActor.getSnapshot()),
    ).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    const resetActor = startMachine();

    resetActor.send({ type: 'PREPARE_REQUESTED' });
    resetActor.send({ type: 'CONNECT_REQUESTED' });
    resetActor.send({ type: 'CLOSED' });
    resetActor.send({ type: 'RESET' });

    expect(selectLiveSessionViewerPlaybackState(resetActor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });
  });

  test('records failures and reset returns to the initial display state', () => {
    const actor = startMachine();

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({
      error: 'Live video playback is not available on this device.',
      type: 'FAILED',
    });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: 'Live video playback is not available on this device.',
      remoteStreamUrl: null,
      status: 'errored',
    });

    actor.send({ type: 'RESET' });

    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'idle',
    });
  });

  test('marks only closed and errored playback as retryable for joined enterable sessions', () => {
    const baseState: ViewerPlaybackState = {
      error: null,
      remoteStreamUrl: null,
      status: 'closed',
    };

    expect(
      canRetryLiveSessionViewerPlayback({
        enterable: true,
        isJoined: true,
        state: baseState,
      }),
    ).toBe(true);
    expect(
      canRetryLiveSessionViewerPlayback({
        enterable: true,
        isJoined: true,
        state: { ...baseState, error: 'connection failed', status: 'errored' },
      }),
    ).toBe(true);
    expect(
      canRetryLiveSessionViewerPlayback({
        enterable: false,
        isJoined: true,
        state: baseState,
      }),
    ).toBe(false);
    expect(
      canRetryLiveSessionViewerPlayback({
        enterable: true,
        isJoined: false,
        state: baseState,
      }),
    ).toBe(false);

    for (const status of [
      'idle',
      'preparing',
      'connecting',
      'waiting_for_host',
      'playing',
    ] satisfies ViewerPlaybackState['status'][]) {
      expect(
        canRetryLiveSessionViewerPlayback({
          enterable: true,
          isJoined: true,
          state: { ...baseState, status },
        }),
      ).toBe(false);
    }
  });

  test('retry from closed and errored playback resets through preparing and connecting', () => {
    const closedActor = startMachine();

    closedActor.send({ type: 'PREPARE_REQUESTED' });
    closedActor.send({ type: 'CONNECT_REQUESTED' });
    closedActor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    closedActor.send({ type: 'CLOSED' });
    closedActor.send({ type: 'RETRY_REQUESTED' });

    expect(
      selectLiveSessionViewerPlaybackState(closedActor.getSnapshot()),
    ).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });

    closedActor.send({ type: 'CONNECT_REQUESTED' });

    expect(
      selectLiveSessionViewerPlaybackState(closedActor.getSnapshot()),
    ).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'connecting',
    });

    const erroredActor = startMachine();

    erroredActor.send({ type: 'PREPARE_REQUESTED' });
    erroredActor.send({
      error: 'connection failed',
      type: 'FAILED',
    });
    erroredActor.send({ type: 'RETRY_REQUESTED' });

    expect(
      selectLiveSessionViewerPlaybackState(erroredActor.getSnapshot()),
    ).toEqual({
      error: null,
      remoteStreamUrl: null,
      status: 'preparing',
    });
  });

  test('ignores retry while playback is idle, active, or already playing', () => {
    const actor = startMachine();

    actor.send({ type: 'RETRY_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot()).status).toBe(
      'idle',
    );

    actor.send({ type: 'PREPARE_REQUESTED' });
    actor.send({ type: 'RETRY_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot()).status).toBe(
      'preparing',
    );

    actor.send({ type: 'CONNECT_REQUESTED' });
    actor.send({ type: 'RETRY_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot()).status).toBe(
      'connecting',
    );

    actor.send({ type: 'RUNTIME_STARTED' });
    actor.send({ type: 'RETRY_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot()).status).toBe(
      'waiting_for_host',
    );

    actor.send({
      remoteStreamUrl: 'stream://host-camera',
      type: 'REMOTE_STREAM_RECEIVED',
    });
    actor.send({ type: 'RETRY_REQUESTED' });
    expect(selectLiveSessionViewerPlaybackState(actor.getSnapshot())).toEqual({
      error: null,
      remoteStreamUrl: 'stream://host-camera',
      status: 'playing',
    });
  });
});
